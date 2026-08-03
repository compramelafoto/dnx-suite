export type ParticipantCardCircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type ParticipantCardCircuitBreakerOptions = {
  failureThreshold?: number;
  halfOpenAfterMs?: number;
  now?: () => number;
};

export class ParticipantCardCircuitBreaker {
  private state: ParticipantCardCircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  private readonly failureThreshold: number;
  private readonly halfOpenAfterMs: number;
  private readonly now: () => number;

  constructor(options: ParticipantCardCircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.halfOpenAfterMs = options.halfOpenAfterMs ?? 30_000;
    this.now = options.now ?? (() => Date.now());
  }

  getState(): ParticipantCardCircuitState {
    this.refreshHalfOpen();
    return this.state;
  }

  canAttempt(): boolean {
    this.refreshHalfOpen();
    if (this.state === "OPEN") return false;
    return true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = "CLOSED";
    this.openedAt = null;
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = this.now();
    }
  }

  private refreshHalfOpen(): void {
    if (this.state !== "OPEN" || this.openedAt == null) return;
    if (this.now() - this.openedAt >= this.halfOpenAfterMs) {
      this.state = "HALF_OPEN";
    }
  }
}

let defaultRemoteRenderCircuit: ParticipantCardCircuitBreaker | null = null;

export function getParticipantCardRemoteRenderCircuit(): ParticipantCardCircuitBreaker {
  if (!defaultRemoteRenderCircuit) {
    defaultRemoteRenderCircuit = new ParticipantCardCircuitBreaker();
  }
  return defaultRemoteRenderCircuit;
}

export function __resetParticipantCardRemoteRenderCircuitForTests(): void {
  defaultRemoteRenderCircuit = null;
}
