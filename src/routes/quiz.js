const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const { getQuestions } = require('../services/enemApiService');
const supabase = require('../services/supabaseClient');

// ─── Helper: extrair usuário do token (DRY) ─────────────────────────────────
async function getUserFromToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  const token = authHeader.split(' ')[1];
  if (!token || token === 'null' || token === 'undefined') return null;
  
  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    return user;
  } catch (e) {
    console.warn('[Auth] Token inválido:', e.message);
    return null;
  }
}

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
    const { data, error } = await supabase
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
  const { data: existing } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId);

  const alreadyHas = new Set((existing || []).map(r => r.achievement_id));
  const newlyUnlocked = [];

  for (const ach of ACHIEVEMENTS) {
    if (alreadyHas.has(ach.id)) continue; // já tem essa conquista
    if (!ach.check(context)) continue;    // não cumpriu a condição

    // Tenta inserir (falha silenciosamente se já existir por UNIQUE)
    const { error } = await supabase.from('user_achievements').insert({
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
router.post('/start', async (req, res) => {
  // Usa helper DRY ao invés de lógica duplicada
  const currentUser = await getUserFromToken(req);
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

    const sessionId = uuidv4();

    // Armazena gabarito na sessão (não enviado ao frontend)
    sessions.set(sessionId, {
      userId: isGuest ? 'GUEST' : currentUser.id,
      category,
      count: questionCount,
      startedAt: Date.now(),
      gabarito: Object.fromEntries(questions.map(q => [q.id, q.gabarito])),
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
    console.error('[Quiz/start]', err.message);
    return res.status(500).json({ error: `Erro ao buscar questões: ${err.message}` });
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
// Rota de teste sem auth, apenas para debug rápido
router.get('/start-test', async (req, res) => {
  try {
    const questions = await getQuestions('completa', 10);
    res.json({ questions });
  } catch (err) {
    console.error('[Quiz/start-test]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/quiz/submit ────────────────────────────────────────────────────
router.post('/submit', async (req, res) => {
  // Usa helper DRY ao invés de lógica duplicada
  const currentUser = await getUserFromToken(req);

  const { sessionId, answers, timeSeconds } = req.body;

  if (!sessionId || !answers || timeSeconds === undefined) {
    return res.status(400).json({ error: 'Dados incompletos.' });
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada ou expirada.' });
  }

  // Previne race condition: marca sessão como processando
  if (session.processing) {
    return res.status(409).json({ error: 'Submissão já em processamento. Aguarde.' });
  }
  session.processing = true;

  // Se a sessão era de usuário logado, valida o usuário atual
  if (session.userId !== 'GUEST' && (!currentUser || session.userId !== currentUser.id)) {
    sessions.delete(sessionId); // Limpa sessão inválida
    return res.status(403).json({ error: 'Sessão não pertence a este usuário.' });
  }

  const isGuest = session.userId === 'GUEST';

  // Validação das respostas
  if (!Array.isArray(answers) || answers.length === 0) {
    sessions.delete(sessionId);
    return res.status(400).json({ error: 'Nenhuma resposta enviada.' });
  }

  let correct = 0;
  const details = [];

  for (const { questionId, selected } of answers) {
    const gabarito = session.gabarito[questionId];
    if (!gabarito) {
      console.warn(`[Quiz/submit] Questão não encontrada no gabarito: ${questionId}`);
      continue;
    }
    
    const isCorrect = selected?.toUpperCase() === gabarito.toUpperCase();
    if (isCorrect) correct++;
    details.push({ questionId, selected, gabarito, correct: isCorrect });
  }

  const total = session.count;

  try {
    if (isGuest) {
      sessions.delete(sessionId);
      return res.json({
        correct,
        total,
        timeSeconds: Math.round(timeSeconds),
        percentage: Math.round((correct / total) * 100),
        position: null,
        details,
        isGuest: true
      });
    }

    // Garante que o perfil existe antes de salvar o resultado
    await supabase.from('profiles').upsert({
      id: currentUser.id,
      nome: currentUser.user_metadata?.nome || 'Usuário',
      email: currentUser.email,
    });

    const { data: result, error } = await supabase.from('results').insert({
      user_id: currentUser.id,
      category: session.category,
      question_count: total,
      correct_answers: correct,
      time_seconds: Math.round(timeSeconds),
      completed_at: new Date().toISOString(),
    }).select().single();

    if (error) {
      console.error('[Quiz/submit] Erro ao inserir resultado no Supabase:', error.message);
      throw new Error('Falha ao salvar resultado no banco de dados.');
    }

    const { count: position } = await supabase
      .from('results')
      .select('*', { count: 'exact', head: true })
      .eq('category', session.category)
      .eq('question_count', total)
      .or(`correct_answers.gt.${correct},and(correct_answers.eq.${correct},time_seconds.lt.${Math.round(timeSeconds)})`);

    sessions.delete(sessionId);

    // Verifica conquistas
    const newAchievements = await checkAndGrantAchievements(currentUser.id, {
      correct, total, timeSeconds: Math.round(timeSeconds), category: session.category,
    });

    return res.json({
      correct,
      total,
      timeSeconds: Math.round(timeSeconds),
      percentage: Math.round((correct / total) * 100),
      position: (position || 0) + 1,
      details,
      newAchievements,
    });
  } catch (err) {
    console.error('[Quiz/submit]', err.message);
    sessions.delete(sessionId); // Garante limpeza em caso de erro
    return res.status(500).json({ error: 'Erro ao salvar resultado.' });
  }
});

module.exports = router;