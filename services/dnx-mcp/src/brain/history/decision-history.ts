import type { BrainDecision, BrainInput, BrainStats, DecisionRecord } from "../types.js";

let recordCounter = 0;

export class DecisionHistory {
  private readonly records: DecisionRecord[] = [];
  private readonly maxRecords: number;

  constructor(maxRecords = 500) {
    this.maxRecords = maxRecords;
  }

  record(input: BrainInput, decision: BrainDecision): DecisionRecord {
    recordCounter += 1;
    const entry: DecisionRecord = {
      id: `decision-${String(recordCounter)}`,
      input,
      decision,
      recordedAt: new Date().toISOString(),
    };

    this.records.push(entry);

    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }

    return entry;
  }

  getAll(): readonly DecisionRecord[] {
    return this.records;
  }

  getByPlatform(platformId: string): DecisionRecord[] {
    return this.records.filter((r) => r.input.context.platformId === platformId);
  }

  getLatest(platformId?: string): DecisionRecord | undefined {
    const filtered = platformId ? this.getByPlatform(platformId) : [...this.records];
    return filtered.at(-1);
  }

  getStats(): BrainStats {
    if (this.records.length === 0) {
      return {
        totalDecisions: 0,
        approvals: 0,
        rejections: 0,
        cautions: 0,
        averageScore: 0,
        averageConfidence: 0,
      };
    }

    const approvals = this.records.filter((r) => r.decision.verdict === "approve").length;
    const rejections = this.records.filter((r) => r.decision.rejected).length;
    const cautions = this.records.filter((r) => r.decision.verdict === "caution").length;
    const totalScore = this.records.reduce((sum, r) => sum + r.decision.score, 0);
    const totalConfidence = this.records.reduce((sum, r) => sum + r.decision.confidence, 0);

    return {
      totalDecisions: this.records.length,
      approvals,
      rejections,
      cautions,
      averageScore: Math.round(totalScore / this.records.length),
      averageConfidence: roundConfidence(totalConfidence / this.records.length),
    };
  }

  clear(): void {
    this.records.length = 0;
  }
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}
