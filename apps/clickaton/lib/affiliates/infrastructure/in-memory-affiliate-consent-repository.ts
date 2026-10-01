import type {
  AffiliateConsentRecord,
  AffiliateConsentRepository,
  SplitConsentRow,
} from "./split-consent";

/** Repositorio en memoria para los tests de la vinculación. */
export type InMemoryAffiliateConsentRepository = AffiliateConsentRepository & {
  affiliates: Map<string, AffiliateConsentRecord & { consentCheckedAt?: Date | null }>;
  recipients: Map<string, { userId: number | null; recipientType: "AFFILIATE" }>;
  splitConsents: Map<string, SplitConsentRow>;
};

export function createInMemoryAffiliateConsentRepository(
  seed: AffiliateConsentRecord[] = [],
): InMemoryAffiliateConsentRepository {
  const affiliates = new Map(seed.map((a) => [a.id, { ...a }]));
  const recipients = new Map<string, { userId: number | null; recipientType: "AFFILIATE" }>();
  const splitConsents = new Map<string, SplitConsentRow>();
  let seq = 0;

  return {
    affiliates,
    recipients,
    splitConsents,
    async findAffiliate(affiliateId) {
      const found = affiliates.get(affiliateId);
      return found ? { ...found } : null;
    },
    async ensurePaymentRecipient(affiliate) {
      if (affiliate.paymentRecipientId && recipients.has(affiliate.paymentRecipientId)) {
        return affiliate.paymentRecipientId;
      }
      seq += 1;
      const id = `rcp_${seq}`;
      recipients.set(id, { userId: affiliate.userId, recipientType: "AFFILIATE" });
      return id;
    },
    async updateAffiliateConsent(affiliateId, data) {
      const current = affiliates.get(affiliateId);
      if (!current) throw new Error(`afiliado inexistente: ${affiliateId}`);
      affiliates.set(affiliateId, { ...current, ...data });
    },
    async upsertSplitConsent(row) {
      splitConsents.set(row.providerReceiverId, { ...row });
    },
    async findSplitConsent(providerReceiverId) {
      const row = splitConsents.get(providerReceiverId);
      return row ? { status: row.status } : null;
    },
  };
}
