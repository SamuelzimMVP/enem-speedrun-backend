const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
process.env.SUPABASE_SECRET_KEY = 'test-secret-key';

const app = require('../app');

async function postJson(baseUrl, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  return { response, body: await response.json() };
}

test('fluxo HTTP do quiz valida submissões e impede replay', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections?.();
  }));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const start = await postJson(baseUrl, '/api/quiz/start', {
    category: 'matematica',
    count: 10,
  });

  assert.equal(start.response.status, 200);
  assert.match(start.body.sessionId, /^[0-9a-f-]{36}$/i);
  assert.equal(start.body.count, 10);
  assert.equal(start.body.questions.length, 10);

  for (const question of start.body.questions) {
    assert.equal(Object.hasOwn(question, 'gabarito'), false);
    assert.ok(question.alternativas.every((alternative) => !Object.hasOwn(alternative, 'isCorrect')));
  }

  const questionIds = start.body.questions.map((question) => question.id);
  const unanswered = questionIds.map((questionId) => ({ questionId, selected: null }));

  await t.test('rejeita uma questão duplicada sem consumir a sessão', async () => {
    const answers = unanswered.map((answer) => ({ ...answer }));
    answers[9].questionId = answers[0].questionId;
    const result = await postJson(baseUrl, '/api/quiz/submit', {
      sessionId: start.body.sessionId,
      answers,
    });

    assert.equal(result.response.status, 400);
    assert.equal(result.body.error, 'Questão duplicada detectada.');
  });

  await t.test('rejeita uma questão alheia sem consumir a sessão', async () => {
    const answers = unanswered.map((answer) => ({ ...answer }));
    answers[9].questionId = 'questao-de-outra-sessao';
    const result = await postJson(baseUrl, '/api/quiz/submit', {
      sessionId: start.body.sessionId,
      answers,
    });

    assert.equal(result.response.status, 400);
    assert.equal(result.body.error, 'Uma ou mais questões não pertencem a esta sessão.');
  });

  await t.test('rejeita uma alternativa ausente sem consumir a sessão', async () => {
    const answers = unanswered.map((answer) => ({ ...answer }));
    delete answers[0].selected;
    const result = await postJson(baseUrl, '/api/quiz/submit', {
      sessionId: start.body.sessionId,
      answers,
    });

    assert.equal(result.response.status, 400);
    assert.equal(result.body.error, 'Alternativa inválida.');
  });

  await t.test('aceita uma submissão válida e calcula o tempo no servidor', async () => {
    const result = await postJson(baseUrl, '/api/quiz/submit', {
      sessionId: start.body.sessionId,
      answers: unanswered,
      timeSeconds: -999,
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.body.total, 10);
    assert.equal(result.body.isGuest, true);
    assert.ok(Number.isInteger(result.body.timeSeconds));
    assert.ok(result.body.timeSeconds >= 0);
    assert.notEqual(result.body.timeSeconds, -999);
  });

  await t.test('rejeita replay da mesma sessão', async () => {
    const result = await postJson(baseUrl, '/api/quiz/submit', {
      sessionId: start.body.sessionId,
      answers: unanswered,
    });

    assert.equal(result.response.status, 404);
    assert.equal(result.body.error, 'Sessão não encontrada ou expirada.');
  });

  await t.test('monta prova completa equilibrada entre as quatro áreas', async () => {
    const result = await postJson(baseUrl, '/api/quiz/start', {
      category: 'completa',
      count: 20,
    });

    assert.equal(result.response.status, 200);
    for (const discipline of ['linguagens', 'humanas', 'natureza', 'matematica']) {
      assert.equal(
        result.body.questions.filter(question => question.disciplina === discipline).length,
        5
      );
    }
  });
});
