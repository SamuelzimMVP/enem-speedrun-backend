const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const ENEM_API_BASE = 'https://api.enem.dev/v1';
const QUESTIONS_FILE = path.join(__dirname, '..', '..', 'data', 'questions.json');

// ─── Cache em memória (com limpeza de duplicados) ──────────────────────────────
const questionPool = {
  linguagens: [],
  humanas: [],
  natureza: [],
  matematica: [],
};
let cacheLoadedAt = null;
const CACHE_TTL = 3 * 24 * 60 * 60 * 1000; // 3 dias (mais persistente)

// ─── Carrega questões do arquivo local ────────────────────────────────────────
function loadFromFile() {
  try {
    if (fs.existsSync(QUESTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf-8'));
      if (data.questions) {
        Object.assign(questionPool, data.questions);
        cacheLoadedAt = new Date(data.generatedAt).getTime();
        console.log(`[Cache] Carregado de ${QUESTIONS_FILE}`);
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
};

// ─── Map disciplina da API para chave do cache ───────────────────────────────
function mapDiscipline(apiDiscipline) {
  if (!apiDiscipline) return null;
  const d = apiDiscipline.toString().toLowerCase();

  if (['linguagens', 'portugues', 'ingles', 'literatura', 'espanhol', 'artes', 'educacao_fisica'].includes(d)) return 'linguagens';
  if (['ciencias-humanas', 'humanas', 'historia', 'geografia', 'filosofia', 'sociologia'].includes(d)) return 'humanas';
  if (['ciencias-natureza', 'natureza', 'biologia', 'quimica', 'fisica'].includes(d)) return 'natureza';
  if (['matematica'].includes(d)) return 'matematica';

  console.warn(`[Cache] Disciplina desconhecida: '${apiDiscipline}'`);
  return null;
}

// ─── Normaliza questões ──────────────────────────────────────────────────────
function normalizeQuestion(q, disciplinaKey) {
  // Filtro básico de integridade
  if (!q.alternatives || q.alternatives.length < 4) return null;
  
  const alternativas = (q.alternatives || []).map((a, i) => ({
    letra: a.letter || String.fromCharCode(65 + i),
    texto: a.text || '',
    imgUrl: a.file || null,
    isCorrect: !!a.isCorrect,
  }));

  const gabaritoObj = alternativas.find(a => a.isCorrect === true);
  if (!gabaritoObj) return null; // Sem resposta correta = questão inválida

  // Enunciado pode estar em vários campos dependendo da versão da API
  const enunciado = (q.alternativesIntroduction || q.statement || q.text || '').trim();
  if (enunciado.length < 10) return null; // Enunciado muito curto/vazio

  // Extrai imagens
  const allImages = (q.files || []).filter(
    f => typeof f === 'string' && f.startsWith('http') && !f.includes('broken-image')
  );

  // Gera um ID único e estável: Ano + Numero + Disciplina
  const stableId = `${q.year || '0'}-${q.index || '0'}-${disciplinaKey}`;

  return {
    id: stableId,
    ano: q.year || 0,
    numero: q.index || 0,
    disciplina: disciplinaKey,
    contexto: (q.context || '').trim(),
    enunciado: enunciado,
    alternativas,
    imagens: allImages,
    gabarito: gabaritoObj.letra,
  };
}

// ─── Busca questões por ano e paginação ──────────────────────────────────────
async function fetchQuestionsByYear(year, limit = 50, retries = 3) {
  let offset = 0;
  let allQuestions = [];

  while (true) {
    const url = `${ENEM_API_BASE}/exams/${year}/questions?limit=${limit}&offset=${offset}`;
    console.log(`[ENEM API] Buscando: ${url}`);

    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' }, timeout: 15000 });
    } catch (err) {
      console.warn(`[ENEM API] Erro de rede para year=${year}: ${err.message}`);
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
    if (questions.length < limit) break; // última página
    offset += limit;

    await new Promise(r => setTimeout(r, 1500)); // evita rate limit
  }

  return allQuestions;
}

// ─── Popula cache ────────────────────────────────────────────────────────────
async function populateCache() {
  console.log('[Cache] Populando cache de questões...');
  try {
    const exams = await fetch(`${ENEM_API_BASE}/exams`).then(r => r.json());
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
        const rawDiscipline = q.discipline || q.subject;
        if (!rawDiscipline) continue;

        const disciplina = mapDiscipline(rawDiscipline);
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
  }
}

// ─── Retorna questões aleatórias para categoria ─────────────────────────────
async function getQuestions(category, count) {
  // Tenta carregar do arquivo local primeiro se o cache estiver zerado
  const totalCache = Object.values(questionPool).reduce((sum, arr) => sum + arr.length, 0);
  if (totalCache === 0) {
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

  // Se ainda não tem questões suficientes, tenta da API
  if (pool.length < count) {
    console.log(`[Cache] Questões insuficientes para ${category}, buscando da API...`);
    await populateCache();
    pool = [];
    for (const disc of disciplines) {
      pool = pool.concat(questionPool[disc] || []);
    }
  }

  if (pool.length < count) {
    throw new Error(`Questões insuficientes no cache para ${category} (${pool.length} disponíveis, ${count} solicitadas)`);
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

module.exports = { getQuestions, populateCache, loadFromFile, questionPool };