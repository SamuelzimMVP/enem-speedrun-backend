const COMPLETE_DISCIPLINES = ['linguagens', 'humanas', 'natureza', 'matematica'];

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function selectBalancedQuestions(poolsByDiscipline, count, random = Math.random) {
  const baseCount = Math.floor(count / COMPLETE_DISCIPLINES.length);
  const remainder = count % COMPLETE_DISCIPLINES.length;
  const priorityOrder = shuffle(COMPLETE_DISCIPLINES, random);
  const selected = [];

  for (const discipline of COMPLETE_DISCIPLINES) {
    const extra = priorityOrder.indexOf(discipline) < remainder ? 1 : 0;
    const disciplineCount = baseCount + extra;
    const pool = poolsByDiscipline[discipline] || [];

    if (pool.length < disciplineCount) {
      throw new Error(`Questões insuficientes de ${discipline}: ${pool.length} disponíveis, ${disciplineCount} necessárias`);
    }

    selected.push(...shuffle(pool, random).slice(0, disciplineCount));
  }

  return shuffle(selected, random);
}

module.exports = { COMPLETE_DISCIPLINES, selectBalancedQuestions, shuffle };
