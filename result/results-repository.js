class ResultsRepository {
  constructor(client) {
    this.client = client;
  }

  getVoteCounts(callback) {
    this.client.query(
      'SELECT vote, COUNT(id) AS count FROM votes GROUP BY vote',
      [],
      function (err, result) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, collectVotesFromResult(result));
      }
    );
  }
}

function collectVotesFromResult(result) {
  var votes = { a: 0, b: 0 };

  result.rows.forEach(function (row) {
    votes[row.vote] = parseInt(row.count);
  });

  return votes;
}

module.exports = {
  ResultsRepository,
};
