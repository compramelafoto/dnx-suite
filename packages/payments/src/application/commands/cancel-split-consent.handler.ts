import type { SplitConsentProvider } from "../../providers/types.js";
import type { ConsentRepository, AuditSink, Clock } from "../ports.js";
import type { CancelSplitConsentCommand } from "./types.js";

export interface CancelSplitConsentHandlerDeps {
  consentProvider: SplitConsentProvider;
  consentRepo: ConsentRepository;
  audit: AuditSink;
  clock: Clock;
}

export class CancelSplitConsentHandler {
  constructor(private readonly deps: CancelSplitConsentHandlerDeps) {}

  async execute(cmd: CancelSplitConsentCommand) {
    const result = await this.deps.consentProvider.cancel({
      environment: cmd.environment,
      receiverId: cmd.receiverId,
    });

    const existing = await this.deps.consentRepo.findByReceiverId(cmd.receiverId);
    const now = this.deps.clock.now();

    if (existing) {
      await this.deps.consentRepo.save({
        ...existing,
        status: result.status,
        updatedAt: now,
      });
    }

    await this.deps.audit.record({
      actorType: "system",
      action: "split_consent.cancel",
      aggregateType: "split_consent",
      aggregateId: cmd.receiverId,
      data: { status: result.status },
    });

    return result;
  }
}
