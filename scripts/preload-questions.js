require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const ENEM_API_BASE = 'https://api.enem.dev/v1';
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'questions.json');

const questionPool = {
  linguagens: [],
  humanas: [],
  natureza: [],
  matematica: [],
};

// Map disciplina da API para chave do cache
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

// Normaliza questões
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

  // Enunciado robusto: tenta vários campos da API
  const enunciado = (q.alternativesIntroduction || q.statement || q.text || '').trim();
  if (enunciado.length < 10) return null; // Enunciado muito curto/vazio

  // Extrai imagens
  const allImages = (q.files || []).filter(
    f => typeof f === 'string' && f.startsWith('http') && !f.includes('broken-image')
  );

  // ID único: Ano + Numero + Disciplina
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
    if (questions.length < limit) break;
    offset += limit;

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
      const rawDiscipline = q.discipline || q.subject;
      if (!rawDiscipline) continue;

      const disciplina = mapDiscipline(rawDiscipline);
      if (!disciplina) continue;

      const normalized = normalizeQuestion(q, disciplina);
      if (normalized && !seenIds.has(normalized.id)) {
        seenIds.add(normalized.id);
        questionPool[disciplina].push(normalized);
      }
    }

    console.log(`[Preload] ${exam.year}: ${questions.length} questões na API → ${seenIds.size} acumuladas no pool`);
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