const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const { getQuestions } = require('../services/enemApiService');
const supabase = require('../services/supabaseClient');

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

// ─── Sessões em memória (TTL 2 horas) ──────────────────────────────────────
const sessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.startedAt > 2 * 60 * 60 * 1000) sessions.delete(id);
  }
}, 5 * 60 * 1000);

// ─── Categorias válidas ───────────────────────────────────────────────────────
const VALID_CATEGORIES = [
  'humanas', 'exatas', 'completa',
];

const VALID_COUNTS = [10, 20, 30];

// ─── Rótulos das categorias para exibição ─────────────────────────────────────
const CATEGORY_LABELS = {
  humanas: 'Humanas (Ling. + C. Humanas)',
  exatas: 'Exatas (C. Natureza + Mat.)',
  completa: 'Prova Completa',
};

// ─── POST /api/quiz/start ─────────────────────────────────────────────────────
router.post('/start', optionalAuth, async (req, res) => {
  const { category, count } = req.body;
  const isGuest = !req.user;

  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Categoria inválida: ${category}` });
  }

  const questionCount = Number(count);
  if (!VALID_COUNTS.includes(questionCount)) {
    return res.status(400).json({ error: 'Quantidade inválida. Use 10, 20 ou 30.' });
  }

  try {
    const questions = await getQuestions(category, questionCount);

    const sessionId = uuidv4();

    // Armazena gabarito na sessão (não enviado ao frontend)
    sessions.set(sessionId, {
      userId: isGuest ? 'GUEST' : req.user.id,
      category,
      count: questionCount,
      startedAt: Date.now(),
      gabarito: Object.fromEntries(questions.map(q => [q.id, q.gabarito])),
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
router.post('/submit', optionalAuth, async (req, res) => {
  const { sessionId, answers, timeSeconds } = req.body;

  if (!sessionId || !answers || timeSeconds === undefined) {
    return res.status(400).json({ error: 'Dados incompletos.' });
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada ou expirada.' });
  }

  // Se a sessão era de usuário logado, valida o usuário atual
  if (session.userId !== 'GUEST' && (!req.user || session.userId !== req.user.id)) {
    return res.status(403).json({ error: 'Sessão não pertence a este usuário.' });
  }

  const isGuest = session.userId === 'GUEST';

  let correct = 0;
  const details = [];

  for (const { questionId, selected } of answers) {
    const gabarito = session.gabarito[questionId];
    const isCorrect = selected?.toUpperCase() === gabarito?.toUpperCase();
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

    const { data: result, error } = await supabase.from('results').insert({
      user_id: req.user.id,
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
    const newAchievements = await checkAndGrantAchievements(req.user.id, {
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
    return res.status(500).json({ error: 'Erro ao salvar resultado.' });
  }
});

module.exports = router;