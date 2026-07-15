import type { SplitConsentProvider } from "../../providers/types.js";
import type { ConsentRepository, AuditSink, Clock, IdGenerator } from "../ports.js";
import type { InviteSplitRecipientsCommand } from "./types.js";

export interface InviteSplitRecipientsHandlerDeps {
  consentProvider: SplitConsentProvider;
  consentRepo: ConsentRepository;
  audit: AuditSink;
  clock: Clock;
  idGen: IdGenerator;
}

export class InviteSplitRecipientsHandler {
  constructor(private readonly deps: InviteSplitRecipientsHandlerDeps) {}

  async execute(cmd: InviteSplitRecipientsCommand) {
    const results = await this.deps.consentProvider.invite({
      environment: cmd.environment,
      sellerEmails: cmd.sellerEmails,
      idempotencyKey: cmd.idempotencyKey,
    });

    const now = this.deps.clock.now();
    for (const r of results) {
      await this.deps.consentRepo.save({
        id: this.deps.idGen.nextId(),
        provider: "mercadopago",
        environment: cmd.environment,
        primaryExternalUserId: "",
        sellerEmail: r.sellerEmail,
        receiverId: r.receiverId,
        status: r.status,
        inviteUrl: r.inviteUrl ?? null,
        recipientId: null,
        idempotencyKey: cmd.idempotencyKey,
        createdAt: now,
        updatedAt: now,
      });
    }

    await this.deps.audit.record({
      actorType: "system",
      action: "split_consent.invite",
      aggregateType: "split_consent",
      aggregateId: cmd.idempotencyKey,
      data: { emailCount: String(cmd.sellerEmails.length) },
    });

    return results;
  }
}
