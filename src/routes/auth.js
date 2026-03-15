const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');

// ─── Cadastro ─────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, nome } = req.body;

  if (!email || !password || !nome) {
    return res.status(400).json({ error: 'Email, senha e nome são obrigatórios.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return res.status(409).json({ error: 'Este email já está cadastrado.' });
      }
      return res.status(400).json({ error: error.message });
    }

    // Salva nome na tabela de perfis
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      nome,
      email,
    });

    if (profileError) {
      console.error('[Auth/register] Erro ao criar perfil:', profileError.message);
      // Mesmo com erro no perfil, o usuário foi criado. 
      // Opcional: deletar usuário ou apenas avisar.
    }

    return res.status(201).json({ message: 'Conta criada com sucesso! Faça login para continuar.' });
  } catch (err) {
    console.error('[Auth/register] Erro inesperado:', err);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }

    // Garante que o perfil existe (Just-In-Time creation)
    await supabase.from('profiles').upsert({
      id: data.user.id,
      nome: data.user.user_metadata?.nome || 'Usuário',
      email: data.user.email,
    });

    // Busca nome do perfil atualizado
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', data.user.id)
      .single();

    return res.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        nome: profile?.nome || data.user.user_metadata?.nome || 'Usuário',
      },
    });
  } catch (err) {
    console.error('[Auth/login]', err);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// ─── Dados do usuário logado ──────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado.' });

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Token inválido.' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', user.id)
      .single();

    return res.json({
      id: user.id,
      email: user.email,
      nome: profile?.nome || user.user_metadata?.nome || 'Usuário',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─── Refresh de token ────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken é obrigatório.' });
  }

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      return res.status(401).json({ error: 'Refresh token inválido ou expirado. Faça login novamente.' });
    }

    return res.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });
  } catch (err) {
    console.error('[Auth/refresh]', err);
    return res.status(500).json({ error: 'Erro interno ao renovar sessão.' });
  }
});

module.exports = router;

