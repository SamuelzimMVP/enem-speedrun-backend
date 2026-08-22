const VALID_ALTERNATIVE_LETTERS = new Set(['A', 'B', 'C', 'D', 'E']);

function mapDiscipline(apiDiscipline) {
  if (!apiDiscipline) return null;
  const discipline = apiDiscipline.toString().toLowerCase();

  if (['linguagens', 'portugues', 'ingles', 'literatura', 'espanhol', 'artes', 'educacao_fisica'].includes(discipline)) {
    return 'linguagens';
  }
  if (['ciencias-humanas', 'humanas', 'historia', 'geografia', 'filosofia', 'sociologia'].includes(discipline)) {
    return 'humanas';
  }
  if (['ciencias-natureza', 'natureza', 'biologia', 'quimica', 'fisica'].includes(discipline)) {
    return 'natureza';
  }
  if (discipline === 'matematica') return 'matematica';

  console.warn(`[Cache] Disciplina desconhecida: '${apiDiscipline}'`);
  return null;
}

function getDisciplineByExamPosition(year, index) {
  const examYear = Number(year);
  const questionIndex = Number(index);
  if (!Number.isInteger(examYear) || !Number.isInteger(questionIndex) || questionIndex < 1 || questionIndex > 180) {
    return null;
  }

  if (examYear === 2009) {
    if (questionIndex <= 45) return 'natureza';
    if (questionIndex <= 90) return 'humanas';
    if (questionIndex <= 135) return 'linguagens';
    return 'matematica';
  }

  if (examYear <= 2016) {
    if (questionIndex <= 45) return 'humanas';
    if (questionIndex <= 90) return 'natureza';
    if (questionIndex <= 135) return 'linguagens';
    return 'matematica';
  }

  if (questionIndex <= 45) return 'linguagens';
  if (questionIndex <= 90) return 'humanas';
  if (questionIndex <= 135) return 'natureza';
  return 'matematica';
}

function resolveDiscipline(question) {
  return getDisciplineByExamPosition(question?.year, question?.index)
    || mapDiscipline(question?.discipline || question?.subject);
}

function normalizeQuestion(question, disciplineKey) {
  // Questões do ENEM sempre têm exatamente cinco alternativas.
  if (!Array.isArray(question?.alternatives) || question.alternatives.length !== 5) return null;

  const alternatives = question.alternatives.map((alternative, index) => ({
    letra: (alternative.letter || String.fromCharCode(65 + index)).toUpperCase(),
    texto: alternative.text || '',
    imgUrl: alternative.file || null,
    isCorrect: !!alternative.isCorrect,
  }));

  const letters = alternatives.map(alternative => alternative.letra);
  if (new Set(letters).size !== 5 || letters.some(letter => !VALID_ALTERNATIVE_LETTERS.has(letter))) {
    return null;
  }

  if (alternatives.some(alternative => !alternative.texto.trim() && !alternative.imgUrl)) return null;

  const correctAlternatives = alternatives.filter(alternative => alternative.isCorrect);
  if (correctAlternatives.length !== 1) return null;

  const correctAlternative = correctAlternatives[0];
  const declaredAnswer = typeof question.correctAlternative === 'string'
    ? question.correctAlternative.toUpperCase()
    : null;
  if (declaredAnswer && declaredAnswer !== correctAlternative.letra) return null;

  const mainContext = (question.context || question.statement || question.text || '').trim();
  const finalPrompt = (question.alternativesIntroduction || '').trim();

  // A pergunta final sozinha não contém os dados necessários para resolver o item.
  // Registros sem contexto não podem ser completados com texto de outro caderno.
  if (mainContext.length < 10) return null;

  let statement = mainContext;
  if (finalPrompt && !mainContext.includes(finalPrompt)) {
    statement = `${mainContext}\n\n${finalPrompt}`;
  }

  const images = (question.files || []).filter(
    file => typeof file === 'string' && file.startsWith('http') && !file.includes('broken-image')
  );
  const stableId = `${question.year || '0'}-${question.index || '0'}-${disciplineKey}`;

  return {
    id: stableId,
    ano: question.year || 0,
    numero: question.index || 0,
    disciplina: disciplineKey,
    contexto: '',
    enunciado: statement,
    alternativas: alternatives,
    imagens: images,
    gabarito: correctAlternative.letra,
  };
}

module.exports = { getDisciplineByExamPosition, mapDiscipline, normalizeQuestion, resolveDiscipline };
