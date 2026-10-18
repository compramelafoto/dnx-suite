import { decide, type EntryChanges, type EntryLite, type NewEntry } from "./decide";
import { readMail, type ParsedDoc } from "./readers";

/** Pagos fallidos más viejos que esto son historial: se cargan pero no se avisan. */
const ALERT_WINDOW_MS = 7 * 86_400_000;

export type PendingMail = {
  id: number;
  vendorKey: string;
  fromAddress: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
  alertedAt: Date | null;
};

export type MessageUpdate = {
  status: "CARGADO" | "PARA_REVISAR" | "DESCARTADO";
  reviewReason: string | null;
  kind?: string | null;
  amount?: number | null;
  currency?: string | null;
  invoiceNumber?: string | null;
  periodYear?: number | null;
  periodMonth?: number | null;
  paidAt?: Date | null;
  entryId?: number | null;
  alertedAt?: Date | null;
};

export type VendorBook = { id: number; entries: EntryLite[] };

export type ProcessPorts = {
  loadVendor(vendorKey: string): Promise<VendorBook | null>;
  fxFor(date: Date): Promise<number | null>;
  /** `fx` es null sólo para gastos en pesos. Devuelve el id del gasto creado. */
  createEntry(vendor: VendorBook, entry: NewEntry, fx: number | null, mail: PendingMail): Promise<number>;
  updateEntry(entryId: number, changes: EntryChanges, fx: number | null): Promise<void>;
  markMessage(id: number, data: MessageUpdate): Promise<void>;
  notify(text: string): Promise<boolean>;
};

type DocOutcome = { kind: "loaded"; entryId: number } | { kind: "review"; reason: string } | { kind: "ignored"; reason: string };

function parsedFields(d: ParsedDoc) {
  return {
    kind: d.kind,
    amount: d.amount,
    currency: d.currency,
    invoiceNumber: d.invoiceNumber,
    periodYear: d.periodYear,
    periodMonth: d.periodMonth,
    paidAt: d.paidAt,
  };
}

async function applyDoc(vendorKey: string, d: ParsedDoc, mail: PendingMail, ports: ProcessPorts): Promise<DocOutcome> {
  const vendor = await ports.loadVendor(vendorKey);
  if (!vendor) return { kind: "review", reason: `El proveedor "${vendorKey}" no existe en Finanzas.` };
  const decision = decide(d, vendor.entries);
  if (decision.type === "review") return { kind: "review", reason: decision.reason };
  if (decision.type === "ignore") return { kind: "ignored", reason: decision.reason };

  const needsFx = d.currency === "USD" && (decision.type === "create" || decision.changes.amountOriginal !== undefined);
  const fx = needsFx ? await ports.fxFor(d.docDate) : null;
  if (needsFx && fx === null) {
    return { kind: "review", reason: `Todavía no hay cotización del dólar para el ${d.docDate.toISOString().slice(0, 10)}: se reintenta en la próxima lectura.` };
  }
  if (decision.type === "create") {
    return { kind: "loaded", entryId: await ports.createEntry(vendor, decision.entry, fx, mail) };
  }
  if (Object.keys(decision.changes).length > 0) await ports.updateEntry(decision.entryId, decision.changes, fx);
  return { kind: "loaded", entryId: decision.entryId };
}

/**
 * Convierte en gastos los mails pendientes, del más viejo al más nuevo (así la factura se
 * carga antes que su pago). Es idempotente: reprocesar un mail no duplica nada.
 */
export async function processMessages(
  mails: PendingMail[],
  ports: ProcessPorts,
  now: Date,
): Promise<{ loaded: number; review: number; ignored: number }> {
  const totals = { loaded: 0, review: 0, ignored: 0 };
  const ordered = [...mails].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
  for (const mail of ordered) {
    const read = readMail(mail.vendorKey, mail);
    const recent = now.getTime() - mail.receivedAt.getTime() <= ALERT_WINDOW_MS;

    if (read === null) {
      await ports.markMessage(mail.id, { status: "PARA_REVISAR", reviewReason: "No se reconoce el formato de este mail: cargalo a mano si es un cobro." });
      totals.review++;
      continue;
    }

    if ("ignore" in read) {
      let alertedAt = mail.alertedAt;
      if (read.alert && recent && !alertedAt && (await ports.notify(`Finanzas DNX: ${read.alert}`))) alertedAt = now;
      await ports.markMessage(mail.id, { status: "DESCARTADO", reviewReason: `Automático: ${read.ignore}`, alertedAt });
      totals.ignored++;
      continue;
    }

    const outcomes: DocOutcome[] = [];
    for (const d of read.docs) outcomes.push(await applyDoc(d.vendorKey ?? mail.vendorKey, d, mail, ports));

    let alertedAt = mail.alertedAt;
    const failed = read.docs.find((d) => d.kind === "PAGO_FALLIDO");
    if (failed && recent && !alertedAt) {
      const amount = failed.amount !== null ? ` (${failed.currency} ${failed.amount.toFixed(2)})` : "";
      const sent = await ports.notify(`Finanzas DNX: ${mail.vendorKey} no pudo cobrar la factura ${failed.invoiceNumber ?? "sin número"}${amount}.`);
      if (sent) alertedAt = now;
    }

    const review = outcomes.find((o): o is Extract<DocOutcome, { kind: "review" }> => o.kind === "review");
    const loaded = [...outcomes].reverse().find((o): o is Extract<DocOutcome, { kind: "loaded" }> => o.kind === "loaded");
    const first = read.docs[0];
    if (review) {
      await ports.markMessage(mail.id, { status: "PARA_REVISAR", reviewReason: review.reason, ...parsedFields(first), entryId: loaded?.entryId ?? null, alertedAt });
      totals.review++;
    } else if (loaded) {
      await ports.markMessage(mail.id, { status: "CARGADO", reviewReason: null, ...parsedFields(first), entryId: loaded.entryId, alertedAt });
      totals.loaded++;
    } else {
      const reason = outcomes.map((o) => (o.kind === "ignored" ? o.reason : "")).join(" ");
      await ports.markMessage(mail.id, { status: "DESCARTADO", reviewReason: `Automático: ${reason}`.trim(), ...parsedFields(first), alertedAt });
      totals.ignored++;
    }
  }
  return totals;
}
