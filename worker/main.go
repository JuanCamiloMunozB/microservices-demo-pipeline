package main

import (
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"strconv"
	"time"

	"database/sql"
	"fmt"

	_ "github.com/lib/pq"

	kingpin "github.com/alecthomas/kingpin/v2"

	"github.com/IBM/sarama"
)

var (
	brokerList        = kingpin.Flag("brokerList", "List of brokers to connect").Default(getEnv("KAFKA_BROKER", "kafka:9092")).Strings()
	topic             = kingpin.Flag("topic", "Topic name").Default(getEnv("PENDING_VOTES_TOPIC", "votes")).String()
	messageCountStart = kingpin.Flag("messageCountStart", "Message counter start from:").Int()
	resultsUpdatedTopic = getEnv("RESULTS_UPDATED_TOPIC", "vote-results-updated")
	dbHost            = getEnv("DB_HOST", "postgresql")
	dbPort            = getEnv("DB_PORT", "5432")
	dbUser            = getEnv("DB_USER", "okteto")
	dbPassword        = getEnv("DB_PASSWORD", "okteto")
	dbName            = getEnv("DB_NAME", "votes")
	cbFailureThreshold = getEnvAsInt("CB_FAILURE_THRESHOLD", 3)
	cbOpenTimeoutMs = getEnvAsInt("CB_OPEN_TIMEOUT_MS", 15000)
	cbHalfOpenSuccessThreshold = getEnvAsInt("CB_HALF_OPEN_SUCCESS_THRESHOLD", 2)
	dbOperationTimeoutMs = getEnvAsInt("DB_OPERATION_TIMEOUT_MS", 3000)
)

type voteResultsUpdatedEvent struct {
	Type      string `json:"type"`
	Source    string `json:"source"`
	VoterID   string `json:"voterId"`
	Vote      string `json:"vote"`
	UpdatedAt string `json:"updatedAt"`
}

func main() {
	kingpin.Parse()

	db := openDatabase()
	defer db.Close()

	pingDatabase(db)

	dropTableStmt := `DROP TABLE IF EXISTS votes`
	if _, err := db.Exec(dropTableStmt); err != nil {
		log.Panic(err)
	}

	createTableStmt := `CREATE TABLE IF NOT EXISTS votes (id VARCHAR(255) NOT NULL UNIQUE, vote VARCHAR(255) NOT NULL)`
	if _, err := db.Exec(createTableStmt); err != nil {
		log.Panic(err)
	}

	voteStore := NewVoteStore(db, VoteStoreConfig{
		FailureThreshold:         cbFailureThreshold,
		OpenTimeout:              time.Duration(cbOpenTimeoutMs) * time.Millisecond,
		HalfOpenSuccessThreshold: cbHalfOpenSuccessThreshold,
		SQLOperationTimeout:      time.Duration(dbOperationTimeoutMs) * time.Millisecond,
	})

	consumerMaster := getKafkaConsumer()
	defer consumerMaster.Close()

	producer := newKafkaProducer()
	defer producer.Close()

	consumer, err := consumerMaster.ConsumePartition(*topic, 0, sarama.OffsetOldest)
	if err != nil {
		log.Panic(err)
	}
	defer consumer.Close()

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt)
	doneCh := make(chan struct{})
	go func() {
		for {
			select {
			case err := <-consumer.Errors():
				fmt.Println(err)
			case msg := <-consumer.Messages():
				*messageCountStart++

				voterID := string(msg.Key)
				vote := string(msg.Value)
				log.Printf("vote received: voterId=%s vote=%s", voterID, vote)

				if err := voteStore.SaveVote(voterID, vote); err != nil {
					log.Printf("failed to persist vote: voterId=%s error=%v", voterID, err)
					continue
				}
				log.Printf("vote persisted: voterId=%s vote=%s", voterID, vote)

				if err := publishResultsUpdated(producer, voterID, vote); err != nil {
					log.Printf("failed to publish results update event: %v", err)
				} else {
					log.Printf("results update event published: voterId=%s topic=%s", voterID, resultsUpdatedTopic)
				}
			case <-signals:
				fmt.Println("Interrupt is detected")
				doneCh <- struct{}{}
			}
		}
	}()
	<-doneCh
	log.Println("Processed", *messageCountStart, "messages")
}

func openDatabase() *sql.DB {
	psqlconn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", dbHost, dbPort, dbUser, dbPassword, dbName)
	for {
		db, err := sql.Open("postgres", psqlconn)
		if err == nil {
			return db
		}
	}
}

func pingDatabase(db *sql.DB) {
	fmt.Println("Waiting for postgresql...")
	for {
		if err := db.Ping(); err == nil {
			fmt.Println("Postgresql connected!")
			return
		}
	}
}

func publishResultsUpdated(producer sarama.SyncProducer, voterID string, vote string) error {
	event := voteResultsUpdatedEvent{
		Type:      "VOTE_RESULTS_UPDATED",
		Source:    "worker",
		VoterID:   voterID,
		Vote:      vote,
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}

	message := &sarama.ProducerMessage{
		Topic: resultsUpdatedTopic,
		Key:   sarama.StringEncoder(voterID),
		Value: sarama.ByteEncoder(payload),
	}

	_, _, err = producer.SendMessage(message)
	return err
}

func getKafkaConsumer() sarama.Consumer {
	config := sarama.NewConfig()
	config.Consumer.Return.Errors = true
	brokers := *brokerList
	fmt.Println("Waiting for kafka...")
	for {
		master, err := sarama.NewConsumer(brokers, config)
		if err == nil {
			fmt.Println("Kafka connected!")
			return master
		}
	}
}

func newKafkaProducer() sarama.SyncProducer {
	config := sarama.NewConfig()
	config.Producer.Return.Successes = true
	brokers := *brokerList

	fmt.Println("Waiting for kafka producer...")
	for {
		producer, err := sarama.NewSyncProducer(brokers, config)
		if err == nil {
			fmt.Println("Kafka producer connected!")
			return producer
		}
	}
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func getEnvAsInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}
