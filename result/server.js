var express = require('express'),
  pg = require('pg'),
  path = require('path'),
  { createResultsRefresher } = require('./results-refresher'),
  { ResultsRepository } = require('./results-repository'),
  { CircuitBreaker } = require('./circuit-breaker'),
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
var CB_FAILURE_THRESHOLD = parseEnvInt('CB_FAILURE_THRESHOLD', 3);
var CB_OPEN_TIMEOUT_MS = parseEnvInt('CB_OPEN_TIMEOUT_MS', 15000);
var CB_HALF_OPEN_SUCCESS_THRESHOLD = parseEnvInt('CB_HALF_OPEN_SUCCESS_THRESHOLD', 2);

io.sockets.on('connection', function (socket) {
  socket.emit('message', { text: 'Welcome!' });

  socket.on('subscribe', function (data) {
    socket.join(data.channel);
  });
});

var pool = new pg.Pool({
  connectionString: DATABASE_URL,
});

var resultsBreaker = new CircuitBreaker({
  failureThreshold: CB_FAILURE_THRESHOLD,
  openTimeoutMs: CB_OPEN_TIMEOUT_MS,
  halfOpenSuccessThreshold: CB_HALF_OPEN_SUCCESS_THRESHOLD,
});

var resultsRepository = new ResultsRepository(pool);
var refreshScores = createResultsRefresher({
  resultsBreaker: resultsBreaker,
  resultsRepository: resultsRepository,
  emitScores: function (votes) {
    io.sockets.emit('scores', JSON.stringify(votes));
  },
  logger: console,
});

refreshScores();

startResultsUpdateConsumer({
  kafkaBroker: KAFKA_BROKER,
  resultsTopic: RESULTS_UPDATED_TOPIC,
  onResultsUpdated: function () {
    refreshScores();
  },
}).catch(function (consumerErr) {
  console.error('Kafka consumer stopped', consumerErr);
});

function parseEnvInt(key, fallback) {
  var raw = process.env[key];
  if (!raw) {
    return fallback;
  }

  var parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
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
