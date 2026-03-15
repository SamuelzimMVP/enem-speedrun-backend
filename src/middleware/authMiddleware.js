const supabase = require('../services/supabaseClient');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log(`[StrictAuth] URL: ${req.url} | Header: ${authHeader ? 'Presente' : 'Ausente'}`);

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

async function optionalAuth(req, res, next) {
  req.user = null;
  
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      if (token && token !== 'null' && token !== 'undefined' && token !== '') {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          req.user = user;
        }
      }
    }
  } catch (err) {
    console.error('[OptionalAuth] Erro silencioso:', err.message);
  }
  
  next();
}

module.exports = { authMiddleware, optionalAuth };
