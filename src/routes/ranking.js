const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');

// ─── GET /api/ranking?category=matematica&count=10 ────────────────────────────
router.get('/', async (req, res) => {
  const { category, count } = req.query;

  if (!category || !count) {
    return res.status(400).json({ error: 'category e count são obrigatórios.' });
  }

  const questionCount = Number(count);
  if (![10, 20, 30].includes(questionCount)) {
    return res.status(400).json({ error: 'count deve ser 10, 20 ou 30.' });
  }

  try {
    const { data, error } = await supabase
      .from('ranking_view')
      .select('*')
      .eq('category', category)
      .eq('question_count', questionCount)
      .order('correct_answers', { ascending: false })
      .order('time_seconds', { ascending: true })
      .limit(50);

    if (error) throw error;

    return res.json({ ranking: data || [] });
  } catch (err) {
    console.error('[Ranking]', err.message);
    return res.status(500).json({ error: 'Erro ao buscar ranking.' });
  }
});

// ─── GET /api/ranking/me?category=matematica&count=10 ─────────────────────────
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado.' });

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Token inválido.' });

  try {
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return res.json({ history: data || [] });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
});

module.exports = router;
