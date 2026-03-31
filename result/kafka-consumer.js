const { Kafka } = require('kafkajs');

function createResultsUpdateConsumer(options) {
  const broker = options.kafkaBroker || 'kafka:9092';
  const topic = options.resultsTopic || 'vote-results-updated';
  const groupId = options.groupId || 'result-service';

  const kafka = new Kafka({
    brokers: [broker],
  });

  const consumer = kafka.consumer({ groupId });

  return {
    broker,
    topic,
    consumer,
  };
}

module.exports = {
  createResultsUpdateConsumer,
};
