const test = require('node:test');
const assert = require('node:assert/strict');

const { CircuitBreaker, STATES } = require('./circuit-breaker');
const { createResultsRefresher } = require('./results-refresher');

function createFakeRepository(sequence) {
  let index = 0;
  let calls = 0;

  return {
    get calls() {
      return calls;
    },
    getVoteCounts(callback) {
      calls += 1;
      const current = sequence[Math.min(index, sequence.length - 1)];
      index += 1;

      if (current instanceof Error) {
        callback(current);
        return;
      }

      callback(null, current);
    },
  };
}

test('opens result circuit breaker after consecutive failures', async () => {
  const breaker = new CircuitBreaker({
    failureThreshold: 2,
    openTimeoutMs: 1000,
    halfOpenSuccessThreshold: 2,
  });

  const repository = createFakeRepository([new Error('db down'), new Error('db down')]);
  const emitted = [];

  const refreshScores = createResultsRefresher({
    resultsBreaker: breaker,
    resultsRepository: repository,
    emitScores: (votes) => emitted.push(votes),
    logger: { log: () => {}, error: () => {} },
  });

  await assert.rejects(() => refreshScores());
  await assert.rejects(() => refreshScores());

  assert.equal(breaker.state, STATES.OPEN);
  assert.equal(emitted.length, 0);
});

test('returns last snapshot when circuit is open', async () => {
  const breaker = new CircuitBreaker({
    failureThreshold: 1,
    openTimeoutMs: 1000,
    halfOpenSuccessThreshold: 2,
  });

  const repository = createFakeRepository([
    { a: 5, b: 3 },
    new Error('db down'),
  ]);

  const emitted = [];
  const refreshScores = createResultsRefresher({
    resultsBreaker: breaker,
    resultsRepository: repository,
    emitScores: (votes) => emitted.push(votes),
    logger: { log: () => {}, error: () => {} },
  });

  const first = await refreshScores();
  assert.deepEqual(first, { a: 5, b: 3 });

  await assert.rejects(() => refreshScores());
  assert.equal(breaker.state, STATES.OPEN);

  const callsBeforeOpenFallback = repository.calls;
  const fallback = await refreshScores();

  assert.deepEqual(fallback, { a: 5, b: 3 });
  assert.equal(repository.calls, callsBeforeOpenFallback);
  assert.deepEqual(emitted[emitted.length - 1], { a: 5, b: 3 });
});

test('result circuit breaker transitions to HALF_OPEN and recovers to CLOSED', async () => {
  const breaker = new CircuitBreaker({
    failureThreshold: 1,
    openTimeoutMs: 20,
    halfOpenSuccessThreshold: 2,
  });

  let shouldFail = true;
  const repository = {
    getVoteCounts(callback) {
      if (shouldFail) {
        callback(new Error('db down'));
        return;
      }

      callback(null, { a: 7, b: 4 });
    },
  };

  const emitted = [];
  const refreshScores = createResultsRefresher({
    resultsBreaker: breaker,
    resultsRepository: repository,
    emitScores: (votes) => emitted.push(votes),
    logger: { log: () => {}, error: () => {} },
  });

  await assert.rejects(() => refreshScores());
  assert.equal(breaker.state, STATES.OPEN);

  await new Promise((resolve) => setTimeout(resolve, 30));
  shouldFail = false;

  const firstProbe = await refreshScores();
  assert.deepEqual(firstProbe, { a: 7, b: 4 });
  assert.equal(breaker.state, STATES.HALF_OPEN);

  const secondProbe = await refreshScores();
  assert.deepEqual(secondProbe, { a: 7, b: 4 });
  assert.equal(breaker.state, STATES.CLOSED);
});
