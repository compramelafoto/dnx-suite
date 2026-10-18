import type { MailKind, ParsedDoc } from "./readers";

/** Lo mínimo de un gasto cargado que hace falta para decidir. */
export type EntryLite = {
  id: number;
  periodYear: number;
  periodMonth: number;
  amountOriginal: number;
  currency: string;
  status: string;
  source: string;
  invoiceNumber: string | null;
  notes: string | null;
  amountRefunded: number | null;
  paidAt: Date | null;
};

export type EntryChanges = Partial<{
  status: string;
  invoiceNumber: string;
  paidAt: Date;
  amountRefunded: number;
  amountOriginal: number;
}>;

export type NewEntry = {
  periodYear: number;
  periodMonth: number;
  amount: number;
  currency: string;
  status: string;
  invoiceNumber: string | null;
  paidAt: Date | null;
  amountRefunded: number | null;
};

export type Decision =
  | { type: "create"; entry: NewEntry }
  | { type: "update"; entryId: number; changes: EntryChanges }
  | { type: "review"; reason: string }
  | { type: "ignore"; reason: string };

const TARGET: Record<MailKind, string> = {
  ESTIMADO: "ESTIMADO",
  FACTURA: "FACTURADO",
  PAGO_FALLIDO: "RECHAZADO",
  PAGO_OK: "PAGADO",
  RECIBO: "PAGADO",
  REEMBOLSO: "PAGADO",
};

/** Un estado sólo avanza: un mail viejo de pago fallido no deshace un pago. */
const RANK: Record<string, number> = { ESTIMADO: 0, FACTURADO: 1, RECHAZADO: 2, IMPAGO: 2, PAGADO: 3, REEMBOLSADO: 4 };
const UNPAID = new Set(["FACTURADO", "RECHAZADO", "IMPAGO"]);
const PAID = new Set(["PAGADO", "REEMBOLSADO"]);
/** Dos avisos de pago del mismo importe con menos de esto de diferencia son el mismo cobro. */
const SAME_CHARGE_MS = 3 * 86_400_000;

function targetStatus(doc: ParsedDoc): string {
  if (doc.kind === "REEMBOLSO" && doc.amount !== null && doc.refunded !== null && doc.refunded >= doc.amount - 0.005) {
    return "REEMBOLSADO";
  }
  return TARGET[doc.kind];
}

function sameMoney(e: EntryLite, doc: ParsedDoc): boolean {
  return doc.amount !== null && e.currency === doc.currency && Math.abs(e.amountOriginal - doc.amount) < 0.01;
}

function notesMention(notes: string | null, invoice: string): boolean {
  return notes !== null && new RegExp(`(^|[^A-Z0-9-])${invoice.replace(/[-]/g, "\\-")}($|[^A-Z0-9-])`, "i").test(notes);
}

function money(currency: string, amount: number): string {
  return `${currency} ${amount.toFixed(2)}`;
}

/** Los cambios que el mail aporta a un gasto existente. Sólo lo que cambia de verdad. */
function changesFor(e: EntryLite, doc: ParsedDoc, opts: { replaceAmount: boolean }): EntryChanges {
  const changes: EntryChanges = {};
  const target = targetStatus(doc);
  const status = (RANK[target] ?? 0) > (RANK[e.status] ?? 0) ? target : e.status;
  if (status !== e.status) changes.status = status;
  if (doc.invoiceNumber && e.invoiceNumber === null) changes.invoiceNumber = doc.invoiceNumber;
  if (doc.paidAt && !e.paidAt && PAID.has(status)) changes.paidAt = doc.paidAt;
  if (doc.kind === "REEMBOLSO" && doc.refunded !== null && doc.refunded > (e.amountRefunded ?? 0) + 0.005) {
    changes.amountRefunded = doc.refunded;
  }
  if (opts.replaceAmount && doc.amount !== null && !sameMoney(e, doc)) changes.amountOriginal = doc.amount;
  return changes;
}

function contradiction(e: EntryLite, doc: ParsedDoc): string | null {
  if (doc.amount === null || e.status === "ESTIMADO" || sameMoney(e, doc)) return null;
  if (e.source === "MAIL" && e.currency === doc.currency) return null;
  return `El gasto ya cargado para esa factura dice ${money(e.currency, e.amountOriginal)} y el mail ${money(doc.currency, doc.amount)}. Revisá cuál es el correcto.`;
}

/**
 * Decide qué hacer con un documento leído de un mail frente a los gastos del mismo proveedor.
 * Nunca inventa un importe ni pisa un gasto cargado a mano que no coincida: en la duda, a revisar.
 */
export function decide(doc: ParsedDoc, entries: EntryLite[]): Decision {
  const samePeriod = entries.filter((e) => e.periodYear === doc.periodYear && e.periodMonth === doc.periodMonth);
  const period = `${String(doc.periodMonth).padStart(2, "0")}/${doc.periodYear}`;

  if (doc.kind === "ESTIMADO") {
    const estimate = samePeriod.find((e) => e.status === "ESTIMADO" && e.invoiceNumber === null);
    if (estimate) return { type: "update", entryId: estimate.id, changes: changesFor(estimate, doc, { replaceAmount: true }) };
    if (samePeriod.length > 0) return { type: "ignore", reason: `Estimado de ${period}: ese mes ya tiene un gasto real.` };
  }

  const inv = doc.invoiceNumber;
  const byInvoice = inv ? entries.find((e) => e.invoiceNumber === inv || (e.invoiceNumber === null && notesMention(e.notes, inv))) : undefined;
  if (byInvoice) {
    const why = contradiction(byInvoice, doc);
    if (why) return { type: "review", reason: why };
    return { type: "update", entryId: byInvoice.id, changes: changesFor(byInvoice, doc, { replaceAmount: byInvoice.status === "ESTIMADO" }) };
  }

  // Un pago sin número de factura (Cloudflare "compra confirmada") paga la factura pendiente del
  // mismo importe, que suele ser de un mes anterior. Nunca reemplaza un estimado.
  if (!inv && doc.kind === "PAGO_OK" && doc.amount !== null) {
    const unpaid = entries
      .filter((e) => UNPAID.has(e.status) && sameMoney(e, doc))
      .sort((a, b) => b.periodYear * 12 + b.periodMonth - (a.periodYear * 12 + a.periodMonth))[0];
    if (unpaid) return { type: "update", entryId: unpaid.id, changes: changesFor(unpaid, doc, { replaceAmount: false }) };
    // Cloudflare avisa el mismo cobro dos veces ("renovada con la tarjeta de reserva" con factura y
    // "compra confirmada" sin factura): si ya hay un pago del mismo importe en esos días, es ése.
    const when = (doc.paidAt ?? doc.docDate).getTime();
    const already = entries.find(
      (e) => PAID.has(e.status) && sameMoney(e, doc) && e.paidAt !== null && Math.abs(e.paidAt.getTime() - when) <= SAME_CHARGE_MS,
    );
    if (already) return { type: "update", entryId: already.id, changes: {} };
  }

  // La factura o el recibo real del mes reemplaza al estimado de ese mes.
  if ((inv || doc.kind === "FACTURA" || doc.kind === "RECIBO") && doc.kind !== "ESTIMADO" && doc.amount !== null) {
    const estimate = samePeriod.find((e) => e.status === "ESTIMADO" && e.invoiceNumber === null);
    if (estimate) return { type: "update", entryId: estimate.id, changes: changesFor(estimate, doc, { replaceAmount: true }) };
  }

  const twin = samePeriod.find((e) => e.invoiceNumber === null && sameMoney(e, doc));
  if (twin) return { type: "update", entryId: twin.id, changes: changesFor(twin, doc, { replaceAmount: false }) };

  const manual = samePeriod.find((e) => e.invoiceNumber === null && e.source !== "MAIL");
  if (manual) {
    return {
      type: "review",
      reason: `Ya hay un gasto de ${period} cargado a mano por ${money(manual.currency, manual.amountOriginal)}. Revisá si este mail es ese mismo gasto o uno aparte.`,
    };
  }

  if (doc.amount === null) return { type: "review", reason: "El mail no trae el importe y no hay una factura cargada a la que asociarlo." };

  return {
    type: "create",
    entry: {
      periodYear: doc.periodYear,
      periodMonth: doc.periodMonth,
      amount: doc.amount,
      currency: doc.currency,
      status: targetStatus(doc),
      invoiceNumber: inv,
      paidAt: PAID.has(targetStatus(doc)) ? doc.paidAt : null,
      amountRefunded: doc.kind === "REEMBOLSO" ? doc.refunded : null,
    },
  };
}
