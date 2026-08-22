const VALID_ALTERNATIVES = new Set(['A', 'B', 'C', 'D', 'E']);

function buildAnswerKey(questions, expectedCount) {
  if (!Array.isArray(questions) || questions.length !== expectedCount) {
    throw new Error('Quantidade de questões recebida não corresponde à solicitada.');
  }

  const answerKey = {};

  for (const question of questions) {
    const questionId = question?.id;
    const correctAnswer = question?.gabarito;

    if (typeof questionId !== 'string' || questionId.length === 0) {
      throw new Error('Questão sem identificador válido.');
    }

    if (Object.hasOwn(answerKey, questionId)) {
      throw new Error(`Questão duplicada recebida da fonte: ${questionId}`);
    }

    if (typeof correctAnswer !== 'string' || !VALID_ALTERNATIVES.has(correctAnswer.toUpperCase())) {
      throw new Error(`Gabarito inválido para a questão: ${questionId}`);
    }

    answerKey[questionId] = correctAnswer.toUpperCase();
  }

  return answerKey;
}

function validateSubmissionAnswers(answers, answerKey, expectedCount) {
  if (!Array.isArray(answers)) {
    return { error: 'answers deve ser uma lista.' };
  }

  if (answers.length !== expectedCount) {
    return { error: `Quantidade de respostas inválida. Esperadas: ${expectedCount}.` };
  }

  const expectedQuestionIds = new Set(Object.keys(answerKey));
  if (expectedQuestionIds.size !== expectedCount) {
    return { error: 'Sessão contém um conjunto de questões inválido.', internal: true };
  }

  const receivedQuestionIds = new Set();
  const normalizedAnswers = [];

  for (const answer of answers) {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
      return { error: 'Formato de resposta inválido.' };
    }

    const { questionId, selected } = answer;

    if (typeof questionId !== 'string' || !expectedQuestionIds.has(questionId)) {
      return { error: 'Uma ou mais questões não pertencem a esta sessão.' };
    }

    if (receivedQuestionIds.has(questionId)) {
      return { error: 'Questão duplicada detectada.' };
    }
    receivedQuestionIds.add(questionId);

    if (selected !== null && (typeof selected !== 'string' || !VALID_ALTERNATIVES.has(selected.toUpperCase()))) {
      return { error: 'Alternativa inválida.' };
    }

    normalizedAnswers.push({
      questionId,
      selected: typeof selected === 'string' ? selected.toUpperCase() : null,
    });
  }

  if (receivedQuestionIds.size !== expectedQuestionIds.size) {
    return { error: 'Conjunto de questões incompleto.' };
  }

  return { normalizedAnswers };
}

module.exports = { buildAnswerKey, validateSubmissionAnswers };
