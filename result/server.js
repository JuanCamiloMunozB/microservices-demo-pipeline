var express = require('express'),
  async = require('async'),
  pg = require('pg'),
  path = require('path'),
  { startResultsUpdateConsumer } = require('./kafka-consumer'),
  cookieParser = require('cookie-parser'),
  methodOverride = require('method-override'),
  app = express(),
  server = require('http').Server(app),
  io = require('socket.io')(server, {
    transports: ['polling']
  });

var port = process.env.PORT || 4000;
var KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
var RESULTS_UPDATED_TOPIC = process.env.RESULTS_TOPIC || 'vote-results-updated';
var DB_HOST = process.env.DB_HOST || 'postgresql';
var DB_PORT = process.env.DB_PORT || '5432';
var DB_USER = process.env.DB_USER || 'okteto';
var DB_PASSWORD = process.env.DB_PASSWORD || 'okteto';
var DB_NAME = process.env.DB_NAME || 'votes';
var DATABASE_URL = process.env.DATABASE_URL || 'postgres://' + DB_USER + ':' + DB_PASSWORD + '@' + DB_HOST + ':' + DB_PORT + '/' + DB_NAME;

io.sockets.on('connection', function (socket) {
  socket.emit('message', { text: 'Welcome!' });

  socket.on('subscribe', function (data) {
    socket.join(data.channel);
  });
});

var pool = new pg.Pool({
  connectionString: DATABASE_URL,
});

async.retry(
  { times: 1000, interval: 1000 },
  function (callback) {
    pool.connect(function (err, client, done) {
      if (err) {
        console.error('Waiting for db', err);
      }
      callback(err, client);
    });
  },
  function (err, client) {
    if (err) {
      console.error('Giving up');
      return;
    }
    console.log('Connected to db');

    refreshScores(client);

    startResultsUpdateConsumer({
      kafkaBroker: KAFKA_BROKER,
      resultsTopic: RESULTS_UPDATED_TOPIC,
      onResultsUpdated: function () {
        refreshScores(client);
      },
    }).catch(function (consumerErr) {
      console.error('Kafka consumer stopped', consumerErr);
    });
  }
);

function refreshScores(client) {
  client.query(
    'SELECT vote, COUNT(id) AS count FROM votes GROUP BY vote',
    [],
    function (err, result) {
      if (err) {
        console.error('Error performing query: ' + err);
      } else {
        var votes = collectVotesFromResult(result);
        io.sockets.emit('scores', JSON.stringify(votes));
        console.log('Scores refreshed and emitted');
      }
    }
  );
}

function collectVotesFromResult(result) {
  var votes = { a: 0, b: 0 };

  result.rows.forEach(function (row) {
    votes[row.vote] = parseInt(row.count);
  });

  return votes;
}

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  next();
});

app.use(express.static(__dirname + '/views'));

app.get('/', function (req, res) {
  res.sendFile(path.resolve(__dirname + '/views/index.html'));
});

server.listen(port, function () {
  var port = server.address().port;
  console.log('App running on port ' + port);
});
