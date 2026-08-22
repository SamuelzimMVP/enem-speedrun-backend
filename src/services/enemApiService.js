const fs = require('fs');
const path = require('path');
const { normalizeQuestion, resolveDiscipline } = require('../utils/questionNormalizer');
const { getNextOffset } = require('../utils/enemApiPagination');
const { selectBalancedQuestions } = require('../utils/questionSelector');

const ENEM_API_BASE = 'https://api.enem.dev/v1';
const QUESTIONS_FILE = path.join(__dirname, '..', '..', 'data', 'questions.json');

// ─── Fetch com timeout (AbortController) ─────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    // Usa fetch nativo (Node 18+) ou node-fetch
    const fetchFn = globalThis.fetch || require('node-fetch');
    const response = await fetchFn(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

const questionPool = {
  linguagens: [],
  humanas: [],
  natureza: [],
  matematica: [],
};
let cacheLoadedAt = null;
let isLoading = false; // Previne carregamento concorrente
const CACHE_TTL = 3 * 24 * 60 * 60 * 1000; // 3 dias

// ─── Validação de Schema ─────────────────────────────────────────────────────
function validateQuestion(q) {
  if (!q) return false;
  if (!q.id || typeof q.id !== 'string') return false;
  if (!q.enunciado || q.enunciado.trim().length < 10) return false;
  if (!Array.isArray(q.alternativas) || q.alternativas.length < 4) return false;
  if (!q.gabarito || !['A', 'B', 'C', 'D', 'E'].includes(q.gabarito)) return false;
  
  // Verificar se há pelo menos uma alternativa correta
  const hasCorrect = q.alternativas.some(a => a.isCorrect === true);
  if (!hasCorrect) return false;
  
  return true;
}

// ─── Carrega questões do arquivo local ────────────────────────────────────────
function loadFromFile() {
  if (isLoading) return false; // Previne carregamento concorrente
  
  try {
    if (fs.existsSync(QUESTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf-8'));
      if (data.questions) {
        // Validação de schema básica
        let validCount = 0;
        let invalidCount = 0;
        
        for (const [disciplina, questions] of Object.entries(data.questions)) {
          if (!questionPool[disciplina]) continue;
          
          const validQuestions = questions.filter(q => {
            const isValid = validateQuestion(q);
            if (!isValid) {
              invalidCount++;
              console.warn(`[Schema] Questão inválida: ${q?.id || 'unknown'}`);
            } else {
              validCount++;
            }
            return isValid;
          });
          
          questionPool[disciplina] = validQuestions;
        }
        
        cacheLoadedAt = new Date(data.generatedAt).getTime();
        console.log(`[Cache] Carregado de ${QUESTIONS_FILE}`);
        console.log(`[Cache] Válidas: ${validCount}, Inválidas: ${invalidCount}`);
        console.log(`[Cache] Total: linguagens=${questionPool.linguagens.length}, humanas=${questionPool.humanas.length}, natureza=${questionPool.natureza.length}, matematica=${questionPool.matematica.length}`);
        return true;
      }
    }
  } catch (err) {
    console.warn('[Cache] Erro ao carregar arquivo local:', err.message);
  }
  return false;
}

// ─── Mapeamento categorias → disciplinas do ENEM ─────────────────────────────
const CATEGORY_TO_DISCIPLINES = {
  humanas: ['linguagens', 'humanas'],
  exatas: ['natureza', 'matematica'],
  completa: ['linguagens', 'humanas', 'natureza', 'matematica'],
  matematica: ['matematica'],
};

// ─── Busca questões por ano e paginação ──────────────────────────────────────
async function fetchQuestionsByYear(year, limit = 50, retries = 3) {
  let offset = 0;
  let allQuestions = [];

  while (true) {
    const url = `${ENEM_API_BASE}/exams/${year}/questions?limit=${limit}&offset=${offset}`;
    console.log(`[ENEM API] Buscando: ${url}`);

    let res;
    try {
      res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
    } catch (err) {
      const errorMsg = err.name === 'AbortError' ? 'Timeout (15s)' : err.message;
      console.warn(`[ENEM API] Erro de rede para year=${year}: ${errorMsg}`);
      if (retries > 0) {
        console.warn(`[ENEM API] Tentando novamente (${retries} restantes)...`);
        await new Promise(r => setTimeout(r, 2000));
        retries--;
        continue;
      }
      break;
    }

    if (res.status === 429) {
      console.warn(`[ENEM API] Rate limit atingido para year=${year}, esperando 2s...`);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    if (!res.ok) {
      console.warn(`[ENEM API] Ignorando ano ${year} - ${res.status} ${res.statusText}`);
      break;
    }

    const data = await res.json();
    const questions = data.questions || data.data || [];
    if (!Array.isArray(questions) || questions.length === 0) break;

    allQuestions = allQuestions.concat(questions);
    const nextOffset = getNextOffset({
      metadata: data.metadata,
      returnedCount: questions.length,
      currentOffset: offset,
      limit,
    });
    if (nextOffset === null) break;
    offset = nextOffset;

    await new Promise(r => setTimeout(r, 1500)); // evita rate limit
  }

  return allQuestions;
}

// ─── Popula cache ────────────────────────────────────────────────────────────
async function populateCache() {
  if (isLoading) {
    console.log('[Cache] Carregamento já em andamento, aguardando...');
    return;
  }
  
  isLoading = true;
  console.log('[Cache] Populando cache de questões...');
  
  try {
    const exams = await fetchWithTimeout(`${ENEM_API_BASE}/exams`).then(r => r.json());
    if (!Array.isArray(exams)) throw new Error('Falha ao obter lista de exames');

    const seenIds = new Set();
    const newPool = { linguagens: [], humanas: [], natureza: [], matematica: [] };

    for (const exam of exams) {
      console.log(`[Cache] Processando ano ${exam.year}...`);
      let questions = [];
      try {
        questions = await fetchQuestionsByYear(exam.year, 50);
      } catch (err) {
        console.warn(`[Cache] Erro ao buscar ano ${exam.year}: ${err.message}`);
        continue;
      }

      for (const q of questions) {
        const disciplina = resolveDiscipline(q);
        if (!disciplina) continue;

        const normalized = normalizeQuestion(q, disciplina);
        if (normalized && !seenIds.has(normalized.id)) {
          seenIds.add(normalized.id);
          newPool[disciplina].push(normalized);
        }
      }

      await new Promise(r => setTimeout(r, 500));
    }

    // Aplicação atômica do novo pool
    Object.assign(questionPool, newPool);
    cacheLoadedAt = Date.now();

    console.log('[Cache] Cache populado com sucesso!');
    for (const key of Object.keys(questionPool)) {
      console.log(`[Cache] ${key}: ${questionPool[key].length} questões`);
    }
  } catch (err) {
    console.error('[Cache] Erro fatal ao popular cache:', err.message);
  } finally {
    isLoading = false;
  }
}

// ─── Retorna questões aleatórias para categoria ─────────────────────────────
async function getQuestions(category, count, filters = {}) {
  // Verifica se o cache expirou
  const isCacheExpired = cacheLoadedAt && (Date.now() - cacheLoadedAt > CACHE_TTL);

  // Tenta carregar do arquivo local primeiro se o cache estiver zerado ou expirado
  const totalCache = Object.values(questionPool).reduce((sum, arr) => sum + arr.length, 0);
  if (totalCache === 0 || isCacheExpired) {
    if (isCacheExpired) {
      console.log('[Cache] Cache expirado, recarregando...');
    }
    if (!loadFromFile()) {
      console.log('[Cache] Arquivo não encontrado, buscando da API...');
      await populateCache();
    }
  }

  const disciplines = CATEGORY_TO_DISCIPLINES[category];
  if (!disciplines) throw new Error(`Categoria inválida: ${category}`);

  let pool = [];
  for (const disc of disciplines) {
    pool = pool.concat(questionPool[disc] || []);
  }

  // Aplica filtro por ano se especificado
  if (filters.year) {
    const year = Number(filters.year);
    pool = pool.filter(q => q.ano === year);
    console.log(`[Cache] Filtro por ano=${year}: ${pool.length} questões disponíveis`);
  }

  // Se ainda não tem questões suficientes, tenta da API
  if (pool.length < count) {
    console.log(`[Cache] Questões insuficientes para ${category}, buscando da API...`);
    await populateCache();
    pool = [];
    for (const disc of disciplines) {
      pool = pool.concat(questionPool[disc] || []);
    }
    // Reaplica filtro após repopular
    if (filters.year) {
      const year = Number(filters.year);
      pool = pool.filter(q => q.ano === year);
    }
  }

  if (pool.length < count) {
    throw new Error(`Questões insuficientes no cache para ${category} (${pool.length} disponíveis, ${count} solicitadas)`);
  }

  if (category === 'completa') {
    const poolsByDiscipline = Object.fromEntries(
      disciplines.map(discipline => [
        discipline,
        pool.filter(question => question.disciplina === discipline),
      ])
    );
    return selectBalancedQuestions(poolsByDiscipline, count);
  }

  // Embaralha com Fisher-Yates e retorna
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// ─── Inicializa cache ao importar ────────────────────────────────────────────
// Tenta carregar do arquivo primeiro
loadFromFile();

module.exports = { getQuestions, populateCache, loadFromFile, questionPool, CATEGORY_TO_DISCIPLINES };
