package main

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/IBM/sarama"
)

type fakeVoteStore struct {
	err error
}

func (f fakeVoteStore) SaveVote(voterID string, vote string) error {
	return f.err
}

type fakeProducer struct {
	sendCount int
	lastMsg   *sarama.ProducerMessage
	err       error
}

func (f *fakeProducer) SendMessage(msg *sarama.ProducerMessage) (partition int32, offset int64, err error) {
	f.sendCount++
	f.lastMsg = msg
	if f.err != nil {
		return 0, 0, f.err
	}
	return 0, 0, nil
}

func (f *fakeProducer) SendMessages(msgs []*sarama.ProducerMessage) error {
	for _, msg := range msgs {
		_, _, err := f.SendMessage(msg)
		if err != nil {
			return err
		}
	}
	return nil
}

func (f *fakeProducer) Close() error {
	return nil
}

func (f *fakeProducer) TxnStatus() sarama.ProducerTxnStatusFlag {
	return 0
}

func (f *fakeProducer) IsTransactional() bool {
	return false
}

func (f *fakeProducer) BeginTxn() error {
	return nil
}

func (f *fakeProducer) CommitTxn() error {
	return nil
}

func (f *fakeProducer) AbortTxn() error {
	return nil
}

func (f *fakeProducer) AddOffsetsToTxn(offsets map[string][]*sarama.PartitionOffsetMetadata, groupID string) error {
	return nil
}

func (f *fakeProducer) AddMessageToTxn(msg *sarama.ConsumerMessage, groupID string, metadata *string) error {
	return nil
}

func TestPersistVoteAndPublishUpdatePublishesOnSuccess(t *testing.T) {
	oldTopic := resultsUpdatedTopic
	resultsUpdatedTopic = "vote-results-updated"
	t.Cleanup(func() { resultsUpdatedTopic = oldTopic })

	producer := &fakeProducer{}

	persisted, err := persistVoteAndPublishUpdate(fakeVoteStore{}, producer, "voter-1", "Burritos")
	if !persisted {
		t.Fatalf("expected vote to be persisted")
	}
	if err != nil {
		t.Fatalf("expected successful publish, got %v", err)
	}

	if producer.sendCount != 1 {
		t.Fatalf("expected one published message, got %d", producer.sendCount)
	}

	if producer.lastMsg == nil {
		t.Fatalf("expected published message")
	}

	payload, err := producer.lastMsg.Value.Encode()
	if err != nil {
		t.Fatalf("encoding message payload: %v", err)
	}

	var event voteResultsUpdatedEvent
	if err := json.Unmarshal(payload, &event); err != nil {
		t.Fatalf("unmarshal event payload: %v", err)
	}

	if event.Type != "VOTE_RESULTS_UPDATED" {
		t.Fatalf("unexpected event type: %s", event.Type)
	}

	if event.Source != "worker" {
		t.Fatalf("unexpected event source: %s", event.Source)
	}

	if event.VoterID != "voter-1" {
		t.Fatalf("unexpected voter id: %s", event.VoterID)
	}

	if event.Vote != "Burritos" {
		t.Fatalf("unexpected vote: %s", event.Vote)
	}

	if _, err := time.Parse(time.RFC3339, event.UpdatedAt); err != nil {
		t.Fatalf("invalid updatedAt: %v", err)
	}
}

func TestPersistVoteAndPublishUpdateDoesNotPublishWhenPersistenceFails(t *testing.T) {
	producer := &fakeProducer{}

	persistErr := errors.New("db unavailable")
	persisted, err := persistVoteAndPublishUpdate(fakeVoteStore{err: persistErr}, producer, "voter-2", "Tacos")
	if persisted {
		t.Fatalf("expected persistence to fail")
	}
	if !errors.Is(err, persistErr) {
		t.Fatalf("expected persist error, got %v", err)
	}

	if producer.sendCount != 0 {
		t.Fatalf("expected no publish attempts, got %d", producer.sendCount)
	}
}

func TestWorkerCircuitBreakerOpensAfterConsecutiveFailures(t *testing.T) {
	breaker := NewCircuitBreaker(2, 200*time.Millisecond, 2)

	_ = breaker.Execute(func() error { return errors.New("db down") })
	_ = breaker.Execute(func() error { return errors.New("db down") })

	if breaker.state != stateOpen {
		t.Fatalf("expected breaker open, got %s", breaker.state)
	}

	err := breaker.Execute(func() error { return nil })
	if !errors.Is(err, ErrCircuitOpen) {
		t.Fatalf("expected fast-fail ErrCircuitOpen, got %v", err)
	}
}
