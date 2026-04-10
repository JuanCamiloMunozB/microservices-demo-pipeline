const test = require('node:test');
const assert = require('node:assert/strict');

const { handleResultsUpdateMessage } = require('./kafka-consumer');

test('refreshes results when receiving VOTE_RESULTS_UPDATED event', () => {
  let refreshCalls = 0;

  handleResultsUpdateMessage(
    { value: Buffer.from('{"type":"VOTE_RESULTS_UPDATED"}') },
    () => {
      refreshCalls += 1;
    },
    {
      log: () => {},
      error: () => {},
    }
  );

  assert.equal(refreshCalls, 1);
});

test('ignores invalid or irrelevant messages', () => {
  let refreshCalls = 0;

  handleResultsUpdateMessage(
    { value: Buffer.from('{not-valid-json') },
    () => {
      refreshCalls += 1;
    },
    {
      log: () => {},
      error: () => {},
    }
  );

  handleResultsUpdateMessage(
    { value: Buffer.from('{"type":"OTHER_EVENT"}') },
    () => {
      refreshCalls += 1;
    },
    {
      log: () => {},
      error: () => {},
    }
  );

  assert.equal(refreshCalls, 0);
});
