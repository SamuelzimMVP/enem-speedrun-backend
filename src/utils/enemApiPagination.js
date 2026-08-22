function getNextOffset({ metadata, returnedCount, currentOffset, limit }) {
  if (!Number.isInteger(returnedCount) || returnedCount <= 0) return null;

  if (metadata?.hasMore === false) return null;
  if (metadata?.hasMore === true) return currentOffset + limit;

  // Compatibilidade com respostas antigas da API, que não tinham metadata.
  return returnedCount < limit ? null : currentOffset + limit;
}

module.exports = { getNextOffset };
