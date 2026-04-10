const { CircuitOpenError } = require('./circuit-breaker');

function createResultsRefresher(options) {
  const resultsBreaker = options.resultsBreaker;
  const resultsRepository = options.resultsRepository;
  const emitScores = options.emitScores;
  const logger = options.logger || console;

  let lastValidVotes = null;

  return function refreshScores() {
    return resultsBreaker
      .execute(function () {
        return new Promise(function (resolve, reject) {
          resultsRepository.getVoteCounts(function (err, votes) {
            if (err) {
              reject(err);
              return;
            }

            resolve(votes);
          });
        });
      })
      .then(function (votes) {
        lastValidVotes = votes;
        emitScores(votes);
        logger.log('Scores refreshed and emitted');
        return votes;
      })
      .catch(function (err) {
        if (err instanceof CircuitOpenError && lastValidVotes !== null) {
          logger.log('Circuit breaker open, returning fallback snapshot');
          emitScores(lastValidVotes);
          return lastValidVotes;
        }

        logger.error('Error performing query: ' + err);
        throw err;
      });
  };
}

module.exports = {
  createResultsRefresher,
};
