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

async function startResultsUpdateConsumer(options) {
  const onResultsUpdated = options.onResultsUpdated;
  const setup = createResultsUpdateConsumer(options);

  console.log('Connecting to Kafka broker', setup.broker);
  await setup.consumer.connect();

  console.log('Subscribing to topic', setup.topic);
  await setup.consumer.subscribe({ topic: setup.topic, fromBeginning: false });

  await setup.consumer.run({
    eachMessage: async ({ message }) => {
      let event = {};

      if (message.value) {
        try {
          event = JSON.parse(message.value.toString());
        } catch (err) {
          console.error('Failed to parse results update event', err);
          return;
        }
      }

      if (event.type === 'VOTE_RESULTS_UPDATED') {
        console.log('Results update event received');
        try {
          onResultsUpdated();
        } catch (err) {
          console.error('Failed to refresh scores after event', err);
        }
      }
    },
  });
}

module.exports = {
  createResultsUpdateConsumer,
  startResultsUpdateConsumer,
};
