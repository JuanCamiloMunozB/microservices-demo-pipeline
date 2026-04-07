const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

class CircuitOpenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

class CircuitBreaker {
  constructor(options) {
    this.failureThreshold = options.failureThreshold;
    this.openTimeoutMs = options.openTimeoutMs;
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold;

    this.state = STATES.CLOSED;
    this.consecutiveFailures = 0;
    this.consecutiveHalfOpenSuccesses = 0;
    this.openedAt = 0;
  }

  async execute(fn) {
    if (this.state === STATES.OPEN) {
      if (Date.now() - this.openedAt < this.openTimeoutMs) {
        throw new CircuitOpenError('circuit breaker is open');
      }

      this.state = STATES.HALF_OPEN;
      this.consecutiveHalfOpenSuccesses = 0;
      console.log('Circuit breaker transition: OPEN -> HALF_OPEN');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    if (this.state === STATES.HALF_OPEN) {
      this.consecutiveHalfOpenSuccesses += 1;
      if (this.consecutiveHalfOpenSuccesses >= this.halfOpenSuccessThreshold) {
        this.state = STATES.CLOSED;
        this.consecutiveFailures = 0;
        this.consecutiveHalfOpenSuccesses = 0;
        console.log('Circuit breaker transition: HALF_OPEN -> CLOSED');
      }
      return;
    }

    this.consecutiveFailures = 0;
  }

  onFailure() {
    if (this.state === STATES.HALF_OPEN) {
      this.open();
      return;
    }

    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.open();
    }
  }

  open() {
    this.state = STATES.OPEN;
    this.openedAt = Date.now();
    this.consecutiveFailures = 0;
    this.consecutiveHalfOpenSuccesses = 0;
    console.log('Circuit breaker transition: -> OPEN');
  }
}

module.exports = {
  CircuitBreaker,
  CircuitOpenError,
  STATES,
};
