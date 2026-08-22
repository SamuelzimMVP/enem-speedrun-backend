const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.SUPABASE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY
  || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !publishableKey || !secretKey) {
  throw new Error(
    'Configuração Supabase incompleta. Defina SUPABASE_URL, uma chave publicável/anon e uma chave secreta/service_role.'
  );
}

// ─── Client ANON (para operações normais, respeita RLS) ──────────────────────
const supabase = createClient(
  supabaseUrl,
  publishableKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// ─── Client SERVICE_ROLE (apenas para admin, bypass RLS) ─────────────────────
const supabaseAdmin = createClient(
  supabaseUrl,
  secretKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

module.exports = { supabase, supabaseAdmin };
