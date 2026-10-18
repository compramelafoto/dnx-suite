import { arPeriod, parseAmount, parseEnglishDate, servicePeriodStart } from "./parse";
import type { MailInput, ReadResult } from "./types";

const DATE = "([A-Z][a-z]+ \\d{1,2}, \\d{4})";
const MONEY = "\\$([\\d,]+\\.\\d{2})";

/**
 * Recibos y reembolsos de Stripe (Anthropic, Resend, ElevenLabs, Cursor, AfterShoot, Vercel).
 * El texto lo arma Stripe igual para todos: "Receipt from X $45.00 Paid October 8, 2026 … Invoice number …".
 */
export function readStripe(vendorKey: string, mail: MailInput): ReadResult {
  const text = mail.bodyText.replace(/\s+/g, " ");
  const invoiceNumber = text.match(/Invoice number ([A-Z0-9][A-Z0-9-]+)/)?.[1] ?? null;
  const override = vendorKey === "anthropic" && /\bAPI\b/.test(text) ? "anthropic-api" : null;

  const receipt = text.match(new RegExp(`Receipt from .+? ${MONEY} Paid ${DATE}`));
  if (receipt) {
    const amount = parseAmount(receipt[1]);
    const paidAt = parseEnglishDate(receipt[2]);
    if (amount === null || !paidAt) return null;
    return {
      docs: [
        {
          kind: "RECIBO",
          amount,
          currency: "USD",
          invoiceNumber,
          docDate: paidAt,
          paidAt,
          ...arPeriod(paidAt),
          refunded: null,
          vendorKey: override,
        },
      ],
    };
  }

  const refund = text.match(new RegExp(`Refund from .+? ${MONEY} Refunded on ${DATE}`));
  const paid = text.match(new RegExp(`Amount paid ${MONEY}`));
  if (refund && paid) {
    const refunded = parseAmount(refund[1]);
    const amount = parseAmount(paid[1]);
    const refundedAt = parseEnglishDate(refund[2]);
    if (refunded === null || amount === null || !refundedAt) return null;
    // El gasto es el de la factura original: se ubica en el mes del servicio, no en el del reembolso.
    const period = servicePeriodStart(text) ?? arPeriod(refundedAt);
    return {
      docs: [
        {
          kind: "REEMBOLSO",
          amount,
          currency: "USD",
          invoiceNumber,
          docDate: refundedAt,
          paidAt: null,
          ...period,
          refunded,
          vendorKey: override,
        },
      ],
    };
  }

  return null;
}
