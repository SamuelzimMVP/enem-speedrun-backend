const test = require('node:test');
const assert = require('node:assert/strict');
const { getNextOffset } = require('../src/utils/enemApiPagination');

test('continua quando a API informa hasMore mesmo com página incompleta', () => {
  assert.equal(getNextOffset({
    metadata: { hasMore: true },
    returnedCount: 49,
    currentOffset: 0,
    limit: 50,
  }), 50);
});

test('encerra quando a API informa que não há mais páginas', () => {
  assert.equal(getNextOffset({
    metadata: { hasMore: false },
    returnedCount: 50,
    currentOffset: 150,
    limit: 50,
  }), null);
});

test('mantém fallback para respostas antigas sem metadata', () => {
  assert.equal(getNextOffset({
    returnedCount: 50,
    currentOffset: 50,
    limit: 50,
  }), 100);
  assert.equal(getNextOffset({
    returnedCount: 12,
    currentOffset: 100,
    limit: 50,
  }), null);
});
