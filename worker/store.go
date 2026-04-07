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

func NewVoteStore(db *sql.DB) *VoteStore {
	return &VoteStore{
		db:         db,
		breaker:    NewCircuitBreaker(3, 15*time.Second, 2),
		sqlTimeout: 3 * time.Second,
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
