import { arPeriod, parseAmount, parseEnglishDate, parseIsoDate } from "./parse";
import type { MailInput, ParsedDoc, ReadResult } from "./types";

function doc(partial: Omit<ParsedDoc, "currency" | "refunded" | "vendorKey"> & Partial<ParsedDoc>): ParsedDoc {
  return { currency: "USD", refunded: null, vendorKey: null, ...partial };
}

/** AWS: "Invoice 2810533809 - Billing Date 2026-08-01 - Charge Amount: 106.72 USD", una línea por factura pagada. */
export function readAws(mail: MailInput): ReadResult {
  const text = mail.bodyText;
  const paidRaw = text.match(/intent[oó] pagar el (\d{4}-\d{2}-\d{2})/)?.[1] ?? text.match(/attempted to pay on (\d{4}-\d{2}-\d{2})/)?.[1];
  const paidAt = (paidRaw && parseIsoDate(paidRaw)) || mail.receivedAt;
  const docs: ParsedDoc[] = [];
  for (const m of text.matchAll(/Invoice (\d+) - Billing Date (\d{4}-\d{2}-\d{2}) - Charge Amount: ([\d.,]+) USD/g)) {
    const billing = parseIsoDate(m[2]);
    const amount = parseAmount(m[3]);
    if (!billing || amount === null) continue;
    docs.push(doc({ kind: "PAGO_OK", amount, invoiceNumber: m[1], docDate: paidAt, paidAt, ...arPeriod(billing) }));
  }
  return docs.length ? { docs } : null;
}

/** Neon: el asunto trae la factura y si se pagó; el importe ("127,31 $" o "$127.31") viene en el cuerpo, a veces no. */
export function readNeon(mail: MailInput): ReadResult {
  const m = mail.subject.match(/Payment (failed|received) for Neon, LLC invoice \(#([A-Z0-9-]+)\)/i);
  if (!m) return null;
  const rawAmount = mail.bodyText.match(/\(([\d.,]+)\s*\$\)/)?.[1] ?? mail.bodyText.match(/\$\s?([\d,]+\.\d{2})/)?.[1];
  const ok = m[1].toLowerCase() === "received";
  return {
    docs: [
      doc({
        kind: ok ? "PAGO_OK" : "PAGO_FALLIDO",
        amount: rawAmount ? parseAmount(rawAmount) : null,
        invoiceNumber: m[2].toUpperCase(),
        docDate: mail.receivedAt,
        paidAt: ok ? mail.receivedAt : null,
        ...arPeriod(mail.receivedAt),
      }),
    ],
  };
}

/** Cloudflare: facturas, pagos, pagos fallidos y alertas de uso salen de notify.cloudflare.com; el resto es promoción. */
export function readCloudflare(mail: MailInput): ReadResult {
  if (!/@notify\.cloudflare\.com>?$/i.test(mail.fromAddress.trim())) return { ignore: "Promoción de Cloudflare." };
  const subject = mail.subject;
  const text = mail.bodyText.replace(/\s+/g, " ");
  const invoice = text.match(/#?(IN-\d+)/)?.[1] ?? subject.match(/#?(IN-\d+)/)?.[1] ?? null;
  const base = { docDate: mail.receivedAt, ...arPeriod(mail.receivedAt) };

  if (/pague antes|paga antes|se cancelar[aá]|degradad/i.test(subject)) {
    return { ignore: "Recordatorio de pago de Cloudflare (la factura llega en otro mail)." };
  }
  if (/uso medido|metered usage|budget/i.test(subject)) {
    const total = text.match(/Total (?:actual|current)[^$\d]*\$?([\d.,]+)/i)?.[1];
    const end = text.match(/\d{4}-\d{2}-\d{2} (?:hasta|to) (\d{4}-\d{2}-\d{2})/)?.[1];
    const endDate = end ? parseIsoDate(end) : null;
    const amount = total ? parseAmount(total) : null;
    if (amount === null) return null;
    return { docs: [doc({ kind: "ESTIMADO", amount, invoiceNumber: null, paidAt: null, ...base, ...(endDate ? arPeriod(endDate) : {}) })] };
  }
  if (/m[eé]todo de pago de reserva|backup payment method/i.test(subject)) {
    const amount = text.match(/por \$([\d.,]+)/)?.[1] ?? text.match(/for \$([\d.,]+)/)?.[1];
    if (!amount || !invoice) return null;
    return { docs: [doc({ kind: "PAGO_OK", amount: parseAmount(amount), invoiceNumber: invoice, paidAt: mail.receivedAt, ...base })] };
  }
  if (/compra confirmada|purchase confirmed/i.test(subject)) {
    const amount = text.match(/compra de \$([\d.,]+)/)?.[1] ?? text.match(/purchase of \$([\d.,]+)/)?.[1];
    if (!amount) return null;
    return { docs: [doc({ kind: "PAGO_OK", amount: parseAmount(amount), invoiceNumber: null, paidAt: mail.receivedAt, ...base })] };
  }
  if (/factura est[aá] disponible|invoice is available/i.test(subject)) {
    const amount = text.match(/(?:Importe|Amount): \$?([\d.,]+)/)?.[1];
    const due = text.match(/(?:Vence el|Fecha de vencimiento|Due on): ([A-Z][a-z]+ \d{1,2}, \d{4})/)?.[1];
    const dueDate = due ? parseEnglishDate(due) : null;
    if (!amount || !invoice) return null;
    return {
      docs: [doc({ kind: "FACTURA", amount: parseAmount(amount), invoiceNumber: invoice, paidAt: null, ...base, ...(dueDate ? arPeriod(dueDate) : {}) })],
    };
  }
  if (/pago fallido|payment failed/i.test(subject)) {
    if (!invoice) return null;
    return { docs: [doc({ kind: "PAGO_FALLIDO", amount: null, invoiceNumber: invoice, paidAt: null, ...base })] };
  }
  return null;
}
