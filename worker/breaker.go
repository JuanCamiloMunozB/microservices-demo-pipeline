package main

import (
	"errors"
	"log"
	"sync"
	"time"
)

var ErrCircuitOpen = errors.New("circuit breaker is open")

type breakerState string

const (
	stateClosed   breakerState = "Closed"
	stateOpen     breakerState = "Open"
	stateHalfOpen breakerState = "HalfOpen"
)

type CircuitBreaker struct {
	mu                        sync.Mutex
	state                     breakerState
	failureThreshold          int
	openTimeout               time.Duration
	halfOpenSuccessThreshold  int
	consecutiveFailures       int
	consecutiveHalfOpenOK     int
	openedAt                  time.Time
}

func NewCircuitBreaker(failureThreshold int, openTimeout time.Duration, halfOpenSuccessThreshold int) *CircuitBreaker {
	return &CircuitBreaker{
		state:                    stateClosed,
		failureThreshold:         failureThreshold,
		openTimeout:              openTimeout,
		halfOpenSuccessThreshold: halfOpenSuccessThreshold,
	}
}

func (b *CircuitBreaker) Execute(fn func() error) error {
	b.mu.Lock()
	if b.state == stateOpen {
		if time.Since(b.openedAt) < b.openTimeout {
			log.Printf("circuit breaker fast-fail: state=%s", b.state)
			b.mu.Unlock()
			return ErrCircuitOpen
		}

		b.state = stateHalfOpen
		b.consecutiveHalfOpenOK = 0
		log.Printf("circuit breaker transition: Open -> HalfOpen")
	}
	b.mu.Unlock()

	err := fn()

	b.mu.Lock()
	defer b.mu.Unlock()

	if err != nil {
		if b.state == stateHalfOpen {
			b.tripOpenLocked()
			return err
		}

		b.consecutiveFailures++
		if b.consecutiveFailures >= b.failureThreshold {
			b.tripOpenLocked()
		}

		return err
	}

	if b.state == stateHalfOpen {
		b.consecutiveHalfOpenOK++
		if b.consecutiveHalfOpenOK >= b.halfOpenSuccessThreshold {
			b.state = stateClosed
			b.consecutiveFailures = 0
			b.consecutiveHalfOpenOK = 0
			log.Printf("circuit breaker transition: HalfOpen -> Closed")
		}
		return nil
	}

	b.consecutiveFailures = 0
	return nil
}

func (b *CircuitBreaker) tripOpenLocked() {
	b.state = stateOpen
	b.openedAt = time.Now()
	b.consecutiveFailures = 0
	b.consecutiveHalfOpenOK = 0
	log.Printf("circuit breaker transition: -> Open")
}
