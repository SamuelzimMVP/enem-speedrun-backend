const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getDisciplineByExamPosition,
  mapDiscipline,
  normalizeQuestion,
  resolveDiscipline,
} = require('../src/utils/questionNormalizer');

function buildQuestion(overrides = {}) {
  return {
    year: 2023,
    index: 136,
    discipline: 'matematica',
    context: 'Uma questão completa com todas as informações necessárias.',
    alternativesIntroduction: 'Qual é a resposta correta?',
    correctAlternative: 'C',
    alternatives: ['A', 'B', 'C', 'D', 'E'].map(letter => ({
      letter,
      text: `Alternativa ${letter}`,
      file: null,
      isCorrect: letter === 'C',
    })),
    files: [],
    ...overrides,
  };
}

test('normaliza uma questão completa e consistente', () => {
  const result = normalizeQuestion(buildQuestion(), 'matematica');

  assert.equal(result.id, '2023-136-matematica');
  assert.equal(result.gabarito, 'C');
  assert.match(result.enunciado, /informações necessárias/);
  assert.match(result.enunciado, /resposta correta/);
  assert.equal(result.alternativas.length, 5);
});

test('rejeita questão sem contexto mesmo que possua pergunta final', () => {
  const result = normalizeQuestion(buildQuestion({ context: null }), 'matematica');
  assert.equal(result, null);
});

test('rejeita alternativas duplicadas ou incompletas', () => {
  const duplicateLetters = buildQuestion();
  duplicateLetters.alternatives[4].letter = 'A';

  const emptyAlternative = buildQuestion();
  emptyAlternative.alternatives[0].text = '';

  assert.equal(normalizeQuestion(duplicateLetters, 'matematica'), null);
  assert.equal(normalizeQuestion(emptyAlternative, 'matematica'), null);
});

test('rejeita gabarito declarado diferente da alternativa marcada', () => {
  const result = normalizeQuestion(buildQuestion({ correctAlternative: 'D' }), 'matematica');
  assert.equal(result, null);
});

test('preserva contexto com imagem em Markdown', () => {
  const result = normalizeQuestion(buildQuestion({
    context: '![Gráfico](https://enem.dev/question-image.png)',
  }), 'matematica');

  assert.match(result.enunciado, /question-image\.png/);
});

test('mapeia apenas disciplinas conhecidas', () => {
  assert.equal(mapDiscipline('ciencias-humanas'), 'humanas');
  assert.equal(mapDiscipline('FISICA'), 'natureza');
  assert.equal(mapDiscipline('matematica'), 'matematica');
  assert.equal(mapDiscipline('desconhecida'), null);
});

test('determina a área pela posição oficial e pela ordem vigente no ano', () => {
  assert.equal(getDisciplineByExamPosition(2009, 1), 'natureza');
  assert.equal(getDisciplineByExamPosition(2016, 1), 'humanas');
  assert.equal(getDisciplineByExamPosition(2016, 90), 'natureza');
  assert.equal(getDisciplineByExamPosition(2017, 1), 'linguagens');
  assert.equal(getDisciplineByExamPosition(2023, 109), 'natureza');
  assert.equal(getDisciplineByExamPosition(2023, 148), 'matematica');
});

test('corrige disciplina inconsistente informada pela API', () => {
  assert.equal(resolveDiscipline({
    year: 2023,
    index: 148,
    discipline: 'ciencias-humanas',
  }), 'matematica');
});
