import { DecisionEngine } from "./decision-engine/index.js";
import { DecisionHistory } from "./history/index.js";
import type { BrainDecision, BrainEvaluateOptions, BrainInput } from "./types.js";

export interface DnxBrainOptions {
  decisionEngine?: DecisionEngine;
  history?: DecisionHistory;
}

/**
 * Facade principal del DNX Brain.
 * Motor de decisión que evalúa información estructurada de Orchestrators.
 */
export class DnxBrain {
  private readonly engine: DecisionEngine;
  private readonly history: DecisionHistory;

  constructor(options: DnxBrainOptions = {}) {
    this.engine = options.decisionEngine ?? new DecisionEngine();
    this.history = options.history ?? new DecisionHistory();
  }

  /**
   * Evalúa un conjunto de señales y produce una decisión estructurada.
   */
  evaluate(input: BrainInput, options: BrainEvaluateOptions = {}): BrainDecision {
    const decision = this.engine.evaluate(input);

    if (options.recordHistory !== false) {
      this.history.record(input, decision);
    }

    return decision;
  }

  /** Historial de decisiones. */
  getHistory(): DecisionHistory {
    return this.history;
  }

  /** Motor de decisión subyacente (para testing/extensión). */
  getEngine(): DecisionEngine {
    return this.engine;
  }
}
