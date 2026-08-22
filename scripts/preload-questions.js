require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { normalizeQuestion, resolveDiscipline } = require('../src/utils/questionNormalizer');
const { getNextOffset } = require('../src/utils/enemApiPagination');

const ENEM_API_BASE = 'https://api.enem.dev/v1';
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'questions.json');

const questionPool = {
  linguagens: [],
  humanas: [],
  natureza: [],
  matematica: [],
};

// Busca questões por ano
async function fetchQuestionsByYear(year, limit = 50) {
  let offset = 0;
  let allQuestions = [];

  while (true) {
    const url = `${ENEM_API_BASE}/exams/${year}/questions?limit=${limit}&offset=${offset}`;

    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' }, timeout: 15000 });
    } catch (err) {
      console.warn(`[ENEM API] Erro de rede para year=${year}: ${err.message}`);
      break;
    }

    if (res.status === 429) {
      console.warn(`[ENEM API] Rate limit, esperando 2s...`);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    if (!res.ok) {
      console.warn(`[ENEM API] Ignorando ano ${year} - ${res.status}`);
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

    await new Promise(r => setTimeout(r, 1500));
  }

  return allQuestions;
}

async function fetchAllQuestions() {
  console.log('[Preload] Buscando provas do ENEM...');

  const examsRes = await fetch(`${ENEM_API_BASE}/exams`);
  const exams = await examsRes.json();

  console.log(`[Preload] Encontradas ${exams.length} provas`);

  const seenIds = new Set();

  for (const exam of exams) {
    console.log(`[Preload] Processando ${exam.year}...`);

    const questions = await fetchQuestionsByYear(exam.year, 50);

    for (const q of questions) {
      const disciplina = resolveDiscipline(q);
      if (!disciplina) continue;

      const normalized = normalizeQuestion(q, disciplina);
      if (normalized && !seenIds.has(normalized.id)) {
        seenIds.add(normalized.id);
        questionPool[disciplina].push(normalized);
      }
    }

    console.log(`[Preload] ${exam.year}: ${questions.length} registros na API → ${seenIds.size} questões válidas acumuladas`);
  }

  return questionPool;
}

async function main() {
  try {
    console.log('[Preload] Iniciando download das questões...');

    const pool = await fetchAllQuestions();

    // Salva no arquivo JSON
    const data = {
      generatedAt: new Date().toISOString(),
      questions: pool,
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
    console.log(`[Preload] Questões salvas em ${OUTPUT_FILE}`);
    console.log(`[Preload] Total:`);
    console.log(`  - Linguagens: ${pool.linguagens.length}`);
    console.log(`  - Humanas: ${pool.humanas.length}`);
    console.log(`  - Natureza: ${pool.natureza.length}`);
    console.log(`  - Matemática: ${pool.matematica.length}`);

    process.exit(0);
  } catch (err) {
    console.error('[Preload] Erro:', err.message);
    process.exit(1);
  }
}

main();
