const supabase = require('../services/supabaseClient');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth]', err.message);
    return res.status(500).json({ error: 'Erro ao verificar autenticação.' });
  }
}

module.exports = authMiddleware;
