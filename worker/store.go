package main

import (
	"context"
	"database/sql"
	"time"
)

type VoteStore struct {
	db         *sql.DB
	breaker    *CircuitBreaker
	sqlTimeout time.Duration
}

type VoteStoreConfig struct {
	FailureThreshold         int
	OpenTimeout              time.Duration
	HalfOpenSuccessThreshold int
	SQLOperationTimeout      time.Duration
}

func NewVoteStore(db *sql.DB, config VoteStoreConfig) *VoteStore {
	return &VoteStore{
		db:         db,
		breaker:    NewCircuitBreaker(config.FailureThreshold, config.OpenTimeout, config.HalfOpenSuccessThreshold),
		sqlTimeout: config.SQLOperationTimeout,
	}
}

func (s *VoteStore) SaveVote(voterID string, vote string) error {
	insertDynStmt := `insert into "votes"("id", "vote") values($1, $2) on conflict(id) do update set vote = $2`

	return s.breaker.Execute(func() error {
		ctx, cancel := context.WithTimeout(context.Background(), s.sqlTimeout)
		defer cancel()

		_, err := s.db.ExecContext(ctx, insertDynStmt, voterID, vote)
		return err
	})
}
