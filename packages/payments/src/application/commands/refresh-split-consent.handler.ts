import type { SplitConsentProvider } from "../../providers/types.js";
import type { ConsentRepository, AuditSink, Clock } from "../ports.js";
import type { RefreshSplitConsentCommand } from "./types.js";

export interface RefreshSplitConsentHandlerDeps {
  consentProvider: SplitConsentProvider;
  consentRepo: ConsentRepository;
  audit: AuditSink;
  clock: Clock;
}

export class RefreshSplitConsentHandler {
  constructor(private readonly deps: RefreshSplitConsentHandlerDeps) {}

  async execute(cmd: RefreshSplitConsentCommand) {
    const remote = await this.deps.consentProvider.list({
      environment: cmd.environment,
    });

    const now = this.deps.clock.now();
    const filtered = cmd.receiverId
      ? remote.filter((c) => c.receiverId === cmd.receiverId)
      : remote;

    for (const c of filtered) {
      const existing = await this.deps.consentRepo.findByReceiverId(c.receiverId);
      await this.deps.consentRepo.save({
        id: existing?.id ?? crypto.randomUUID(),
        provider: "mercadopago",
        environment: cmd.environment,
        primaryExternalUserId: existing?.primaryExternalUserId ?? "",
        sellerEmail: c.sellerEmail,
        receiverId: c.receiverId,
        status: c.status,
        inviteUrl: existing?.inviteUrl ?? null,
        recipientId: existing?.recipientId ?? null,
        idempotencyKey: existing?.idempotencyKey ?? "",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
    }

    await this.deps.audit.record({
      actorType: "system",
      action: "split_consent.refresh",
      aggregateType: "split_consent",
      aggregateId: cmd.receiverId ?? "all",
      data: { count: String(filtered.length) },
    });

    return filtered;
  }
}
