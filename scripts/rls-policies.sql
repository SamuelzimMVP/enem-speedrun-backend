-- ═══════════════════════════════════════════════════════════
-- ENEM Speedrun — Row Level Security (RLS) Policies
-- ═══════════════════════════════════════════════════════════
-- Execute tudo de uma vez no SQL Editor do Supabase:
-- Dashboard > SQL Editor > New Query > cole e clique em Run
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- 1. Tabela: profiles
-- ───────────────────────────────────────────────────────────

-- Ativa RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver o próprio perfil
CREATE POLICY "Perfis: leitura do proprio perfil"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Usuários podem atualizar o próprio perfil
CREATE POLICY "Perfis: atualizacao do proprio perfil"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Insert via service_role (registro)
CREATE POLICY "Perfis: insert via service"
  ON profiles FOR INSERT
  WITH CHECK (true);


-- ───────────────────────────────────────────────────────────
-- 2. Tabela: results
-- ───────────────────────────────────────────────────────────

-- Ativa RLS
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver os próprios resultados
CREATE POLICY "Resultados: leitura dos proprios"
  ON results FOR SELECT
  USING (auth.uid() = user_id);

-- Usuários podem inserir próprios resultados
CREATE POLICY "Resultados: insert dos proprios"
  ON results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar os próprios resultados
CREATE POLICY "Resultados: update dos proprios"
  ON results FOR UPDATE
  USING (auth.uid() = user_id);


-- ───────────────────────────────────────────────────────────
-- 3. Tabela: user_achievements
-- ───────────────────────────────────────────────────────────

-- Ativa RLS
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver as próprias conquistas
CREATE POLICY "Conquistas: leitura das proprias"
  ON user_achievements FOR SELECT
  USING (auth.uid() = user_id);

-- Insert das próprias conquistas (via backend)
CREATE POLICY "Conquistas: insert das proprias"
  ON user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ───────────────────────────────────────────────────────────
-- 4. View: ranking_view (acesso público para leitura)
-- ───────────────────────────────────────────────────────────

-- Se a view já existe, tenta ativar RLS (pode falhar se já estiver ativa)
DO $$
BEGIN
  BEGIN
    ALTER VIEW ranking_view ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN
    -- Ignora se já estiver ativa ou se a view não suportar RLS
    NULL;
  END;
END $$;

-- Permite leitura pública do ranking
-- (se a view já tiver policies, pode pular se der conflito)
DO $$
BEGIN
  BEGIN
    CREATE POLICY "Ranking: leitura publica"
      ON ranking_view FOR SELECT
      USING (true);
  EXCEPTION WHEN OTHERS THEN
    -- Ignora se policy já existir
    NULL;
  END;
END $$;


-- ───────────────────────────────────────────────────────────
-- 5. Verificação: listar todas as tabelas com RLS ativo
-- ───────────────────────────────────────────────────────────

SELECT 
  c.relname AS nome_tabela,
  CASE WHEN c.relrowsecurity THEN '✅ SIM' ELSE '❌ NÃO' END AS "RLS Ativo",
  c.relkind AS "Tipo (r=tabela, v=view)"
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'v')
ORDER BY c.relname;
