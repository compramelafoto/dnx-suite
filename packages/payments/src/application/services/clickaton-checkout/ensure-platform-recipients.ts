import type { DnxPaymentsPersistence } from "../../persistence/ports";

const OWNER_ID = "dnx_recipient_clickaton_platform_owner";
const PARTNER_ID = "dnx_recipient_clickaton_platform_partner";

/**
 * Recipients stub 100% owner + partner placeholder (requisito de splits inmutables).
 * Idempotente; sin PII.
 */
export async function ensureClickatonPlatformRecipients(
  db: DnxPaymentsPersistence,
): Promise<{ ownerRecipientId: string; partnerRecipientId: string }> {
  const now = new Date().toISOString();
  const existingOwner = await db.recipients.findById(OWNER_ID);
  if (!existingOwner) {
    await db.recipients.save({
      id: OWNER_ID,
      recipientType: "PLATFORM",
      status: "ACTIVE",
      displayReference: "clickaton-platform-owner",
      createdAt: now,
      updatedAt: now,
    });
  }
  const existingPartner = await db.recipients.findById(PARTNER_ID);
  if (!existingPartner) {
    await db.recipients.save({
      id: PARTNER_ID,
      recipientType: "PLATFORM",
      status: "ACTIVE",
      displayReference: "clickaton-platform-partner-stub",
      createdAt: now,
      updatedAt: now,
    });
  }
  return { ownerRecipientId: OWNER_ID, partnerRecipientId: PARTNER_ID };
}
