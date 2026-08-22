const test = require('node:test');
const assert = require('node:assert/strict');
const { COMPLETE_DISCIPLINES, selectBalancedQuestions } = require('../src/utils/questionSelector');

function buildPools() {
  return Object.fromEntries(COMPLETE_DISCIPLINES.map(discipline => [
    discipline,
    Array.from({ length: 12 }, (_, index) => ({
      id: `${discipline}-${index}`,
      disciplina: discipline,
    })),
  ]));
}

test('distribui a prova completa entre as quatro áreas', () => {
  const selected = selectBalancedQuestions(buildPools(), 10, () => 0.5);
  const counts = COMPLETE_DISCIPLINES.map(
    discipline => selected.filter(question => question.disciplina === discipline).length
  ).sort((left, right) => left - right);

  assert.equal(selected.length, 10);
  assert.deepEqual(counts, [2, 2, 3, 3]);
  assert.equal(new Set(selected.map(question => question.id)).size, 10);
});

test('usa cinco questões de cada área em uma prova completa de 20', () => {
  const selected = selectBalancedQuestions(buildPools(), 20, () => 0.25);

  for (const discipline of COMPLETE_DISCIPLINES) {
    assert.equal(selected.filter(question => question.disciplina === discipline).length, 5);
  }
});

test('rejeita uma prova sem questões suficientes em qualquer área', () => {
  const pools = buildPools();
  pools.natureza = [];

  assert.throws(
    () => selectBalancedQuestions(pools, 10),
    /Questões insuficientes de natureza/
  );
});
