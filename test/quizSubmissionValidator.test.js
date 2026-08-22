const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAnswerKey, validateSubmissionAnswers } = require('../src/utils/quizSubmissionValidator');

const questions = [
  { id: 'q1', gabarito: 'A' },
  { id: 'q2', gabarito: 'B' },
  { id: 'q3', gabarito: 'C' },
];

const answerKey = buildAnswerKey(questions, 3);

test('buildAnswerKey normaliza o gabarito e rejeita IDs duplicados', () => {
  assert.deepEqual(buildAnswerKey([{ id: 'q1', gabarito: 'a' }], 1), { q1: 'A' });
  assert.throws(
    () => buildAnswerKey([{ id: 'q1', gabarito: 'A' }, { id: 'q1', gabarito: 'B' }], 2),
    /Questão duplicada/
  );
});

test('aceita exatamente as questões da sessão e normaliza alternativas', () => {
  const result = validateSubmissionAnswers([
    { questionId: 'q1', selected: 'a' },
    { questionId: 'q2', selected: null },
    { questionId: 'q3', selected: 'E' },
  ], answerKey, 3);

  assert.deepEqual(result, {
    normalizedAnswers: [
      { questionId: 'q1', selected: 'A' },
      { questionId: 'q2', selected: null },
      { questionId: 'q3', selected: 'E' },
    ],
  });
});

test('rejeita quantidade incorreta de respostas', () => {
  assert.equal(
    validateSubmissionAnswers([{ questionId: 'q1', selected: 'A' }], answerKey, 3).error,
    'Quantidade de respostas inválida. Esperadas: 3.'
  );
});

test('rejeita questão duplicada', () => {
  const result = validateSubmissionAnswers([
    { questionId: 'q1', selected: 'A' },
    { questionId: 'q1', selected: 'A' },
    { questionId: 'q3', selected: 'C' },
  ], answerKey, 3);

  assert.equal(result.error, 'Questão duplicada detectada.');
});

test('rejeita questionId alheio à sessão', () => {
  const result = validateSubmissionAnswers([
    { questionId: 'q1', selected: 'A' },
    { questionId: 'q2', selected: 'B' },
    { questionId: 'foreign', selected: 'C' },
  ], answerKey, 3);

  assert.equal(result.error, 'Uma ou mais questões não pertencem a esta sessão.');
});

test('rejeita alternativa ausente ou fora de A-E/null', () => {
  const missing = validateSubmissionAnswers([
    { questionId: 'q1' },
    { questionId: 'q2', selected: 'B' },
    { questionId: 'q3', selected: 'C' },
  ], answerKey, 3);
  const invalid = validateSubmissionAnswers([
    { questionId: 'q1', selected: 'Z' },
    { questionId: 'q2', selected: 'B' },
    { questionId: 'q3', selected: 'C' },
  ], answerKey, 3);

  assert.equal(missing.error, 'Alternativa inválida.');
  assert.equal(invalid.error, 'Alternativa inválida.');
});

test('rejeita chave de sessão internamente inconsistente', () => {
  const result = validateSubmissionAnswers([
    { questionId: 'q1', selected: 'A' },
    { questionId: 'q2', selected: 'B' },
    { questionId: 'q3', selected: 'C' },
  ], { q1: 'A', q2: 'B' }, 3);

  assert.equal(result.internal, true);
});
