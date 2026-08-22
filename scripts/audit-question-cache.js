const fs = require('fs');
const path = require('path');
const { getDisciplineByExamPosition } = require('../src/utils/questionNormalizer');

const questionsFile = path.join(__dirname, '..', 'data', 'questions.json');
const data = JSON.parse(fs.readFileSync(questionsFile, 'utf8'));
const pools = data.questions || {};
const expectedLetters = new Set(['A', 'B', 'C', 'D', 'E']);
const seenIds = new Set();
const errors = [];
let total = 0;

for (const [poolName, questions] of Object.entries(pools)) {
  if (!Array.isArray(questions)) {
    errors.push(`${poolName}: pool inválido`);
    continue;
  }

  for (const question of questions) {
    total++;

    if (!question.id || seenIds.has(question.id)) errors.push(`${question.id || '<sem-id>'}: ID ausente ou duplicado`);
    seenIds.add(question.id);

    const expectedDiscipline = getDisciplineByExamPosition(question.ano, question.numero);
    if (question.disciplina !== poolName || question.disciplina !== expectedDiscipline) {
      errors.push(`${question.id}: área ${question.disciplina}, esperada ${expectedDiscipline}`);
    }

    if (typeof question.enunciado !== 'string' || question.enunciado.trim().length < 10) {
      errors.push(`${question.id}: enunciado incompleto`);
    }

    if (!Array.isArray(question.alternativas) || question.alternativas.length !== 5) {
      errors.push(`${question.id}: quantidade de alternativas inválida`);
      continue;
    }

    const letters = question.alternativas.map(alternative => alternative.letra);
    if (new Set(letters).size !== 5 || letters.some(letter => !expectedLetters.has(letter))) {
      errors.push(`${question.id}: letras de alternativas inválidas`);
    }

    if (question.alternativas.some(alternative => !alternative.texto?.trim() && !alternative.imgUrl)) {
      errors.push(`${question.id}: alternativa sem texto ou imagem`);
    }

    const correctAlternatives = question.alternativas.filter(alternative => alternative.isCorrect);
    if (correctAlternatives.length !== 1 || correctAlternatives[0]?.letra !== question.gabarito) {
      errors.push(`${question.id}: gabarito inconsistente`);
    }
  }
}

if (errors.length > 0) {
  console.error(`[Audit] ${errors.length} problema(s) em ${total} questões:`);
  for (const error of errors.slice(0, 50)) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const distribution = Object.fromEntries(
    Object.entries(pools).map(([name, questions]) => [name, questions.length])
  );
  console.log(`[Audit] ${total} questões válidas e sem IDs duplicados.`);
  console.log('[Audit] Distribuição:', distribution);
}
