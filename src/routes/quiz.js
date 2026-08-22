const express = require('express');
const router = express.Router();
const { v4: uuidv4, validate: validateUuid } = require('uuid');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const { getQuestions } = require('../services/enemApiService');
const { supabaseAdmin } = require('../services/supabaseClient');
const { buildAnswerKey, validateSubmissionAnswers } = require('../utils/quizSubmissionValidator');

// ─── Definições de conquistas ──────────────────────────────────────
const ACHIEVEMENTS = [
  {
    id: 'rank_bronze',
    title: 'Competidor Bronze',
    description: 'Completou uma prova com pelo menos 50% de acertos.',
    icon: '🥉',
    check: ({ correct, total }) => correct / total >= 0.5,
  },
  {
    id: 'rank_silver',
    title: 'Competidor Prata',
    description: 'Completou uma prova com pelo menos 80% de acertos.',
    icon: '🥈',
    check: ({ correct, total }) => correct / total >= 0.8,
  },
  {
    id: 'rank_gold',
    title: 'Competidor Ouro',
    description: 'Gabaritou uma prova de 10 questões.',
    icon: '🥇',
    check: ({ correct, total }) => correct === total && total >= 10,
  },
  {
    id: 'rank_platinum',
    title: 'Competidor Platina',
    description: 'Gabaritou uma prova de 10 questões em menos de 3 minutos.',
    icon: '💍',
    check: ({ correct, total, timeSeconds }) => correct === total && total >= 10 && timeSeconds < 180,
  },
  {
    id: 'rank_diamond',
    title: 'Lenda de Diamante',
    description: 'Gabaritou uma prova de 10 questões em menos de 1:30 min.',
    icon: '💎',
    check: ({ correct, total, timeSeconds }) => correct === total && total >= 10 && timeSeconds < 90,
  },
  {
    id: 'marathonist',
    title: 'Maratonista',
    description: 'Completou o desafio de 30 questões.',
    icon: '🏃',
    check: ({ total }) => total >= 30,
  }
];

// ─── Busca conquistas do usuário ──────────────────────────────────────────
router.get('/achievements/me', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', req.user.id);

    if (error) throw error;

    // Mapeia para incluir os detalhes (título, ícone, etc)
    const detailed = data.map(ua => {
      const def = ACHIEVEMENTS.find(a => a.id === ua.achievement_id);
      return { ...ua, ...def };
    });

    return res.json({ achievements: detailed, all_possible: ACHIEVEMENTS });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar conquistas.' });
  }
});

// ─── Verifica e concede conquistas ──────────────────────────────────────
async function checkAndGrantAchievements(userId, context) {
  // Busca conquistas que o usuário já tem
  const { data: existing } = await supabaseAdmin
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId);

  const alreadyHas = new Set((existing || []).map(r => r.achievement_id));
  const newlyUnlocked = [];

  for (const ach of ACHIEVEMENTS) {
    if (alreadyHas.has(ach.id)) continue; // já tem essa conquista
    if (!ach.check(context)) continue;    // não cumpriu a condição

    // Tenta inserir (falha silenciosamente se já existir por UNIQUE)
    const { error } = await supabaseAdmin.from('user_achievements').insert({
      user_id: userId,
      achievement_id: ach.id,
    });

    if (!error) {
      newlyUnlocked.push({ id: ach.id, title: ach.title, description: ach.description, icon: ach.icon });
    }
  }

  return newlyUnlocked;
}

// ─── Sessões em memória (TTL 5 horas) ──────────────────────────────────────
const sessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.startedAt > 5 * 60 * 60 * 1000) {
      console.log(`[Session] Expulsa por inatividade: ${id} (Iniciada em: ${new Date(session.startedAt).toISOString()})`);
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

// ─── Categorias válidas ───────────────────────────────────────────────────────
const VALID_CATEGORIES = [
  'humanas', 'exatas', 'completa', 'matematica',
];

const VALID_COUNTS = [10, 20, 30];

// ─── Rótulos das categorias para exibição ─────────────────────────────────────
const CATEGORY_LABELS = {
  humanas: 'Humanas (Ling. + C. Humanas)',
  exatas: 'Exatas (C. Natureza + Mat.)',
  completa: 'Prova Completa',
  matematica: 'Matemática',
};

// ─── Anos disponíveis para filtro ─────────────────────────────────────────────
const AVAILABLE_YEARS = [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];

// ─── POST /api/quiz/start ─────────────────────────────────────────────────────
router.post('/start', optionalAuth, async (req, res) => {
  const currentUser = req.user;
  const isGuest = !currentUser;

  const { category, count, year } = req.body;

  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Categoria inválida: ${category}` });
  }

  const questionCount = Number(count);
  if (!VALID_COUNTS.includes(questionCount)) {
    return res.status(400).json({ error: 'Quantidade inválida. Use 10, 20 ou 30.' });
  }

  // Validação do ano (opcional)
  const filters = {};
  if (year) {
    const yearNum = Number(year);
    if (!AVAILABLE_YEARS.includes(yearNum)) {
      return res.status(400).json({ error: `Ano inválido. Use um dos anos: ${AVAILABLE_YEARS.join(', ')}` });
    }
    filters.year = yearNum;
  }

  try {
    const questions = await getQuestions(category, questionCount, filters);
    const answerKey = buildAnswerKey(questions, questionCount);

    const sessionId = uuidv4();

    // Armazena gabarito na sessão (não enviado ao frontend)
    sessions.set(sessionId, {
      userId: isGuest ? 'GUEST' : currentUser.id,
      category,
      count: questionCount,
      startedAt: Date.now(),
      gabarito: answerKey,
      processing: false, // Flag para prevenir race condition
    });

    const sanitizedQuestions = questions.map(({ gabarito, ...q }) => ({
      ...q,
      alternativas: (q.alternativas || []).map(({ isCorrect, ...alt }) => alt),
    }));

    return res.json({
      sessionId,
      category,
      categoryLabel: CATEGORY_LABELS[category] || category,
      count: questionCount,
      questions: sanitizedQuestions,
    });
  } catch (err) {
    console.error('[Quiz/start]', err);
    return res.status(500).json({ error: 'Erro ao buscar questões. Tente novamente.' });
  }
});

// ─── GET /api/quiz/years ──────────────────────────────────────────────────────
// Retorna anos disponíveis e contagem de questões por ano/categoria
router.get('/years', async (req, res) => {
  try {
    const { questionPool, CATEGORY_TO_DISCIPLINES } = require('../services/enemApiService');

    const result = {};

    // Para cada categoria, conta questões por ano
    for (const [category, disciplines] of Object.entries(CATEGORY_TO_DISCIPLINES)) {
      result[category] = {};

      let pool = [];
      for (const disc of disciplines) {
        pool = pool.concat(questionPool[disc] || []);
      }

      // Conta por ano
      for (const q of pool) {
        if (q.ano && q.ano > 0) {
          result[category][q.ano] = (result[category][q.ano] || 0) + 1;
        }
      }
    }

    return res.json({ years: AVAILABLE_YEARS, counts: result });
  } catch (err) {
    console.error('[Quiz/years]', err.message);
    return res.status(500).json({ error: 'Erro ao buscar anos disponíveis.' });
  }
});

// ─── GET /api/quiz/start-test ─────────────────────────────────────────────────
// Rota de teste — disponível apenas em desenvolvimento
router.get('/start-test', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Rota indisponível em produção.' });
  }
  try {
    const questions = await getQuestions('completa', 10);
    res.json({ questions });
  } catch (err) {
    console.error('[Quiz/start-test]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/quiz/submit ────────────────────────────────────────────────────
router.post('/submit', optionalAuth, async (req, res) => {
  const currentUser = req.user;

  const { sessionId, answers } = req.body;

  if (!sessionId || answers === undefined) {
    return res.status(400).json({ error: 'Dados incompletos.' });
  }

  if (typeof sessionId !== 'string' || !validateUuid(sessionId)) {
    return res.status(400).json({ error: 'sessionId inválido.' });
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada ou expirada.' });
  }

  // Se a sessão era de usuário logado, valida o usuário atual
  if (session.userId !== 'GUEST' && (!currentUser || session.userId !== currentUser.id)) {
    return res.status(403).json({ error: 'Sessão não pertence a este usuário.' });
  }

  const isGuest = session.userId === 'GUEST';

  // ─── Validação anti-cheat das respostas ──────────────────────────────────
  const validation = validateSubmissionAnswers(answers, session.gabarito, session.count);
  if (validation.error) {
    if (validation.internal) {
      console.error(`[Quiz/submit] ${validation.error} sessionId=${sessionId}`);
      return res.status(500).json({ error: 'Sessão inválida. Inicie uma nova prova.' });
    }
    return res.status(400).json({ error: validation.error });
  }

  // Anti-replay/race condition. A partir daqui a sessão só pode ser submetida uma vez.
  sessions.delete(sessionId);

  let correct = 0;
  const details = [];

  for (const { questionId, selected } of validation.normalizedAnswers) {
    const gabarito = session.gabarito[questionId];
    const isCorrect = selected === gabarito;
    if (isCorrect) correct++;
    details.push({ questionId, selected, gabarito, correct: isCorrect });
  }

  const total = session.count;

  // Defesa em profundidade: nunca persiste pontuação impossível.
  if (correct < 0 || correct > total) {
    console.error(`[Quiz/submit] Pontuação impossível detectada: ${correct}/${total}`);
    return res.status(400).json({ error: 'Resultado inválido.' });
  }

  // Calcula tempo no servidor (anti-cheat)
  const serverTimeSeconds = Math.max(
    0,
    Math.round((Date.now() - session.startedAt) / 1000)
  );

  try {
    if (isGuest) {
      return res.json({
        correct,
        total,
        timeSeconds: serverTimeSeconds,
        percentage: Math.round((correct / total) * 100),
        position: null,
        details,
        isGuest: true
      });
    }

    // Garante que o perfil existe antes de salvar o resultado
    await supabaseAdmin.from('profiles').upsert({
      id: currentUser.id,
      nome: currentUser.user_metadata?.nome || 'Usuário',
      email: currentUser.email,
    });

    const { data: result, error } = await supabaseAdmin.from('results').insert({
      user_id: currentUser.id,
      category: session.category,
      question_count: total,
      correct_answers: correct,
      time_seconds: serverTimeSeconds,
      completed_at: new Date().toISOString(),
    }).select().single();

    if (error) {
      console.error('[Quiz/submit] Erro ao inserir resultado no Supabase:', error.message);
      throw new Error('Falha ao salvar resultado no banco de dados.');
    }

    const safeCorrect = Number(correct) || 0;
    const safeTime = Math.max(0, serverTimeSeconds);

    const { count: position } = await supabaseAdmin
      .from('results')
      .select('*', { count: 'exact', head: true })
      .eq('category', session.category)
      .eq('question_count', total)
      .or(`correct_answers.gt.${safeCorrect},and(correct_answers.eq.${safeCorrect},time_seconds.lt.${safeTime})`);

    // Verifica conquistas
    const newAchievements = await checkAndGrantAchievements(currentUser.id, {
      correct, total, timeSeconds: serverTimeSeconds, category: session.category,
    });

    return res.json({
      correct,
      total,
      timeSeconds: serverTimeSeconds,
      percentage: Math.round((correct / total) * 100),
      position: (position || 0) + 1,
      details,
      newAchievements,
    });
  } catch (err) {
    console.error('[Quiz/submit]', err.message);
    return res.status(500).json({ error: 'Erro ao salvar resultado.' });
  }
});

module.exports = router;
