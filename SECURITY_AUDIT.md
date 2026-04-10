# 🔍 Relatório de Segurança e Bugs — ENEM Speedrun Backend

**Data da Análise:** 10/04/2026  
**Escopo:** Todos os arquivos do backend (`server.js`, `src/`, `scripts/`)

---

## 🔴 CRÍTICOS — Corrigir Imediatamente

---

### 1. Service Role Key com Acesso Total ao Banco

| Campo | Detalhe |
|-------|---------|
| **Arquivo** | `src/services/supabaseClient.js` (linha 3) |
| **Severidade** | 🔴 Crítico |
| **Impacto** | Se a `service_role_key` vazar, o atacante tem acesso COMPLETO ao banco, ignorando todas as Row Level Security (RLS) policies. |

**Código atual:**
```js
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY,
  // ...
);
```

**Problema:** O backend usa a `service_role_key` para TODAS as operações, incluindo queries que poderiam usar a `anon_key`. A service role bypassa RLS completamente.

**Solução recomendada:**
- Usar `anon_key` + autenticação JWT para operações normais (quiz, ranking)
- Usar `service_role_key` APENAS para operações admin (registro de usuários)
- Criar dois clients Supabase separados

---

### 2. Registro sem Proteção Anti-Bot

| Campo | Detalhe |
|-------|---------|
| **Arquivo** | `src/routes/auth.js` (linha 28) |
| **Severidade** | 🔴 Crítico |
| **Impacto** | Qualquer pessoa/bot pode criar contas infinitas via `/api/auth/register`, pois não há CAPTCHA, verificação de email ou rate limit específico. |

**Código atual:**
```js
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,  // ⚠️ Pula verificação de email!
  user_metadata: { nome },
});
```

**Problema:**
- `email_confirm: true` significa que contas são ativadas sem verificar se o email é real
- O rate limit geral (200 req/15min) é compartilhado com outras rotas
- Sem CAPTCHA ou Proof-of-Work

**Solução recomendada:**
- Adicionar CAPTCHA (reCAPTCHA / hCaptcha) no registro
- Remover `email_confirm: true` e forçar verificação de email
- Adicionar rate limit dedicado para `/register` (ex: 5 tentativas/hora)

---

### 3. Injeção SQL Potencial na Query de Ranking

| Campo | Detalhe |
|-------|---------|
| **Arquivo** | `src/routes/quiz.js` (linha 320) |
| **Severidade** | 🔴 Crítico |
| **Impacto** | Valores interpolados diretamente na query `.or()` sem sanitização podem quebrar a query ou, em cenários extremos, permitir injeção. |

**Código atual:**
```js
.or(`correct_answers.gt.${correct},and(correct_answers.eq.${correct},time_seconds.lt.${Math.round(timeSeconds)})`)
```

**Problema:** Os valores `correct` e `timeSeconds` vêm do corpo da requisição (`req.body`). Se forem manipulados para valores não-numéricos, a query falha.

**Solução recomendada:**
```js
const safeCorrect = Number(correct) || 0;
const safeTime = Math.round(Number(timeSeconds)) || 0;
.or(`correct_answers.gt.${safeCorrect},and(correct_answers.eq.${safeCorrect},time_seconds.lt.${safeTime})`)
```

---

## 🟡 ALTOS — Corrigir em Breve

---

### 4. Race Condition Não-Atômica

| Campo | Detalhe |
|-------|---------|
| **Arquivo** | `src/routes/quiz.js` (linhas 266-268) |
| **Severidade** | 🟡 Alto |
| **Impacto** | Duas requisições simultâneas podem passar pelo check `processing` antes que o flag seja setado, resultando em submissões duplicadas. |

**Código atual:**
```js
if (session.processing) {
  return res.status(409).json({ error: 'Submissão já em processamento. Aguarde.' });
}
session.processing = true; // ⚠️ Não é atômico!
```

**Problema:** Entre o `if` e o `session.processing = true`, outra requisição pode chegar e também passar pelo check.

**Solução recomendada:**
- Node.js é single-threaded, então em teoria não há race condition real
- MAS: Se houver cluster mode ou múltiplos workers, usar Redis lock
- Para segurança adicional, deletar a sessão do Map antes de processar

---

### 5. Memory Leak — Sessões em Memória

| Campo | Detalhe |
|-------|---------|
| **Arquivo** | `src/routes/quiz.js` (linhas 121-130) |
| **Severidade** | 🟡 Alto |
| **Impacto** | Sessões ficam na memória do processo. Se o servidor reiniciar, todas são perdidas. Em múltiplas instâncias, sessões não são compartilhadas. |

**Código atual:**
```js
const sessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.startedAt > 5 * 60 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);
```

**Problema:**
- Não funciona com múltiplas instâncias (PM2 cluster, Render, etc.)
- Se o processo morre, todas as sessões ativas são perdidas
- O cleanup só roda a cada 5 min — sessões "órfãs" ficam até lá

**Solução recomendada:**
- Usar Redis (ou Upstash) para sessões distribuídas
- Ou: salvar sessões no Supabase com TTL

---

### 6. Rota de Teste Exposta Publicamente

| Campo | Detalhe |
|-------|---------|
| **Arquivo** | `src/routes/quiz.js` (linha 241) |
| **Severidade** | 🟡 Alto |
| **Impacto** | `/api/quiz/start-test` retorna 10 questões sem autenticação. Pode ser spamada para extrair todas as questões do banco. |

**Código atual:**
```js
router.get('/start-test', async (req, res) => {
  try {
    const questions = await getQuestions('completa', 10);
    res.json({ questions });
  } catch (err) {
    // ...
  }
});
```

**Problema:** Rota pública, sem rate limit dedicado, sem autenticação.

**Solução recomendada:**
- Remover a rota em produção
- Ou: proteger com `NODE_ENV === 'development'`
- Ou: adicionar um token secreto via header

---

### 7. Autenticação Duplicada e Inconsistente no Ranking

| Campo | Detalhe |
|-------|---------|
| **Arquivo** | `src/routes/ranking.js` (linhas 40-43) |
| **Severidade** | 🟡 Alto |
| **Impacto** | A rota `/ranking/me` não usa o `authMiddleware` existente. Lógica manual de extração de token, sem verificar se o header começa com `Bearer `. |

**Código atual:**
```js
const authHeader = req.headers.authorization;
if (!authHeader) return res.status(401).json({ error: 'Não autenticado.' });

const token = authHeader.split(' ')[1];
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
```

**Problema:**
- Se o header for `Bearer` (sem token), `split(' ')[1]` retorna `undefined`
- Se o header for malformado (`Token xyz`), o código tenta validar mesmo assim
- Duplicação de lógica já existente no `optionalAuth` middleware

**Solução recomendada:**
```js
const { authMiddleware } = require('../middleware/authMiddleware');
router.get('/me', authMiddleware, async (req, res) => { ... });
```

---

## 🟢 MÉDIOS — Melhorias

---

### 8. `timeSeconds` Vem do Frontend (Manipulável)

| Campo | Detalhe |
|-------|---------|
| **Arquivo** | `src/routes/quiz.js` (linha 311) |
| **Severidade** | 🟢 Médio |
| **Impacto** | Usuário pode enviar `timeSeconds: 0` ou negativo para "gabartir" instantaneamente no ranking. |

**Código atual:**
```js
time_seconds: Math.round(timeSeconds),  // Vem do req.body!
```

**Solução recomendada:**
```js
const serverTime = Math.round((Date.now() - session.startedAt) / 1000);
// Usar serverTime ao invés de timeSeconds do frontend
```

---

### 9. Mensagem de Erro Interna Exposta

| Campo | Detalhe |
|-------|---------|
| **Arquivo** | `src/routes/quiz.js` (linha 199) |
| **Severidade** | 🟢 Médio |
| **Impacto** | `err.message` pode vazar caminhos internos, queries SQL, detalhes de infraestrutura. |

**Código atual:**
```js
return res.status(500).json({ error: `Erro ao buscar questões: ${err.message}` });
```

**Solução recomendada:**
```js
console.error('[Quiz/start]', err);
return res.status(500).json({ error: 'Erro ao buscar questões. Tente novamente.' });
```

---

### 10. `CACHE_TTL` Declarado mas Nunca Usado

| Campo | Detalhe |
|-------|---------|
| **Arquivo** | `src/services/enemApiService.js` (linha 32) |
| **Severidade** | 🟢 Médio |
| **Impacto** | O cache nunca expira. Se o arquivo `questions.json` for atualizado externamente, o servidor não percebe. |

**Código atual:**
```js
const CACHE_TTL = 3 * 24 * 60 * 60 * 1000; // 3 dias
// ...mas nunca é verificado
```

**Solução recomendada:**
```js
const isCacheExpired = cacheLoadedAt && (Date.now() - cacheLoadedAt > CACHE_TTL);
if (totalCache === 0 || isCacheExpired) {
  // recarregar
}
```

---

### 11. CORS Permite `localhost` em Produção

| Campo | Detalhe |
|-------|---------|
| **Arquivo** | `server.js` (linhas 23-27) |
| **Severidade** | 🟢 Médio |
| **Impacto** | `localhost:5500`, `localhost:3000`, `127.0.0.1:5500` estão sempre permitidos, mesmo em produção. |

**Código atual:**
```js
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://enem-practice.vercel.app',
  'http://localhost:5500',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
];
```

**Solução recomendada:**
```js
const isDev = process.env.NODE_ENV !== 'production';
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://enem-practice.vercel.app',
  ...(isDev ? ['http://localhost:5500', 'http://localhost:3000', 'http://127.0.0.1:5500'] : []),
];
```

---

### 12. Documentação `.env` Incompleta

| Campo | Detalhe |
|-------|---------|
| **Arquivo** | `.env.example` |
| **Severidade** | 🟢 Baixo |
| **Impacto** | Não está claro que `SUPABASE_SERVICE_KEY` precisa ser a **service_role key**, não a anon key. |

**Solução recomendada:**
```env
# URL do projeto Supabase
SUPABASE_URL=https://SEU-PROJETO.supabase.co

# Chave ANON (para operações normais)
SUPABASE_ANON_KEY=sua-anon-key-aqui

# Chave SERVICE_ROLE (apenas para admin — NUNCA expor no frontend)
SUPABASE_SERVICE_KEY=sua-service-role-key-aqui

# URL do frontend (produção)
FRONTEND_URL=https://enem-practice.vercel.app

NODE_ENV=production
PORT=3001
```

---

## 📊 Resumo Geral

| # | Problema | Severidade | Arquivo | Linha(s) |
|---|----------|-----------|---------|----------|
| 1 | Service Role Key com acesso total | 🔴 Crítico | `src/services/supabaseClient.js` | 3-4 |
| 2 | Registro sem proteção anti-bot | 🔴 Crítico | `src/routes/auth.js` | 28-33 |
| 3 | Injeção SQL na query de ranking | 🔴 Crítico | `src/routes/quiz.js` | 320 |
| 4 | Race condition não-atômica | 🟡 Alto | `src/routes/quiz.js` | 266-268 |
| 5 | Memory leak de sessões | 🟡 Alto | `src/routes/quiz.js` | 121-130 |
| 6 | Rota de teste exposta | 🟡 Alto | `src/routes/quiz.js` | 241-247 |
| 7 | Auth duplicada no ranking | 🟡 Alto | `src/routes/ranking.js` | 40-43 |
| 8 | timeSeconds manipulável | 🟢 Médio | `src/routes/quiz.js` | 311 |
| 9 | Erro interno exposto | 🟢 Médio | `src/routes/quiz.js` | 199 |
| 10 | CACHE_TTL não usado | 🟢 Médio | `src/services/enemApiService.js` | 32 |
| 11 | CORS localhost em produção | 🟢 Médio | `server.js` | 23-27 |
| 12 | Documentação .env | 🟢 Baixo | `.env.example` | — |

---

## ✅ Boas Práticas Já Implementadas

Nem tudo está ruim! O código já possui:

- ✅ **Helmet** para headers de segurança
- ✅ **Rate limiting** geral e para auth
- ✅ **CORS configurado** com validação de origem
- ✅ **Morgan** para logging de requisições
- ✅ **Sanitização de gabaritos** antes de enviar ao frontend (remove `isCorrect`)
- ✅ **Race condition flag** (parcialmente funcional)
- ✅ **Validação de input** (categoria, count, year)
- ✅ **Error handler global** que não vaza stack traces
- ✅ **Refatoração de código duplicado** (ENUNCIADOS_PROTEGIDOS, normalizeQuestion)

---

## 📋 Próximos Passos Sugeridos

1. **Imediato:** Corrigir os 3 problemas críticos (#1, #2, #3)
2. **Curto prazo:** Resolver os 4 problemas altos (#4-#7)
3. **Médio prazo:** Aplicar melhorias médias (#8-#11)
4. **Contínuo:** Adicionar testes automatizados e CI/CD
