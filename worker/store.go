package main

import "database/sql"

type VoteStore struct {
	db *sql.DB
}

func NewVoteStore(db *sql.DB) *VoteStore {
	return &VoteStore{db: db}
}

func (s *VoteStore) SaveVote(voterID string, vote string) error {
	insertDynStmt := `insert into "votes"("id", "vote") values($1, $2) on conflict(id) do update set vote = $2`
	_, err := s.db.Exec(insertDynStmt, voterID, vote)
	return err
}
