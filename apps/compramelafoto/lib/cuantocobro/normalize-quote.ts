import {
  resolveCommercialDisplayMode,
  resolveCommercialNote,
} from "@/lib/cuantocobro/commercial-presentation";
import { normalizePaymentOptions } from "@/lib/cuantocobro/payment/normalize-payment-options";
import { parseCuantoCobroAmount } from "@/lib/cuantocobro/amount-format";
import { createEmptyQuoteItem, createQuoteItemId, normalizeQuoteItem } from "@/lib/cuantocobro/quote-items";
import {
  INITIAL_CUANTO_COBRO_CLIENT,
  INITIAL_CUANTO_COBRO_CLIENT_HOURS,
  INITIAL_CUANTO_COBRO_QUOTE,
  type CuantoCobroClientHoursInput,
  type CuantoCobroClientInput,
  type CuantoCobroQuoteInput,
} from "@/lib/cuantocobro/types";

type LegacyQuoteShape = Partial<CuantoCobroQuoteInput> & {
  clientName?: string;
  clientContact?: string;
  jobDate?: string;
  jobLocation?: string;
  jobLatitude?: string;
  jobLongitude?: string;
  jobType?: string;
  items?: CuantoCobroQuoteInput["concepts"];
  eventDate?: string;
  eventLocation?: string;
  eventCoverageHours?: string;
  eventEditingHours?: string;
  eventTravelHours?: string;
  eventPrepHours?: string;
  eventVariableCosts?: string;
  outsourcedStaffCosts?: string;
  physicalProductsCosts?: string;
  estimatedShots?: string;
  deliverables?: string;
};

function parseHours(value: string | undefined): number {
  return parseCuantoCobroAmount(value ?? "") ?? 0;
}

function parseAmount(value: string | undefined): number {
  return parseCuantoCobroAmount(value ?? "") ?? 0;
}

function splitLegacyContact(contact: string): Pick<CuantoCobroClientInput, "email" | "phone"> {
  const trimmed = contact.trim();
  if (!trimmed) return { email: "", phone: "" };
  if (trimmed.includes("@")) return { email: trimmed, phone: "" };
  return { email: "", phone: trimmed };
}

function normalizeClientHours(raw: Partial<CuantoCobroClientHoursInput> | undefined): CuantoCobroClientHoursInput {
  return {
    ...INITIAL_CUANTO_COBRO_CLIENT_HOURS,
    ...(raw ?? {}),
  };
}

function normalizeClient(raw: LegacyQuoteShape): CuantoCobroClientInput {
  if (raw.client && typeof raw.client === "object") {
    return {
      ...INITIAL_CUANTO_COBRO_CLIENT,
      ...raw.client,
      hours: normalizeClientHours(raw.client.hours),
    };
  }

  const legacyContact = splitLegacyContact(raw.clientContact ?? "");

  return {
    ...INITIAL_CUANTO_COBRO_CLIENT,
    name: raw.clientName ?? "",
    company: "",
    email: legacyContact.email,
    phone: legacyContact.phone,
    jobDate: raw.jobDate ?? raw.eventDate ?? "",
    jobLocation: raw.jobLocation ?? raw.eventLocation ?? "",
    jobLatitude: raw.jobLatitude ?? "",
    jobLongitude: raw.jobLongitude ?? "",
    jobType: raw.jobType ?? "",
    hours: normalizeClientHours(undefined),
  };
}

function migrateLegacyConcepts(raw: LegacyQuoteShape): CuantoCobroQuoteInput["concepts"] {
  const concepts: CuantoCobroQuoteInput["concepts"] = [];

  const ownHours =
    parseHours(raw.eventCoverageHours) +
    parseHours(raw.eventEditingHours) +
    parseHours(raw.eventPrepHours);
  const travelHours = parseHours(raw.eventTravelHours);

  if (ownHours > 0 || travelHours > 0) {
    concepts.push(
      createEmptyQuoteItem({
        id: createQuoteItemId(),
        name: "Servicio fotográfico",
        itemType: "own-service",
        coverageHours: ownHours > 0 ? String(ownHours) : "",
        travelHours: travelHours > 0 ? String(travelHours) : "",
        estimatedShots: raw.estimatedShots ?? "",
        quantity: "1",
      }),
    );
  }

  if (parseAmount(raw.outsourcedStaffCosts) > 0) {
    concepts.push(
      createEmptyQuoteItem({
        id: createQuoteItemId(),
        name: "Personal tercerizado",
        itemType: "outsourced",
        outsourcedLaborCost: raw.outsourcedStaffCosts ?? "",
        quantity: "1",
      }),
    );
  }

  if (parseAmount(raw.physicalProductsCosts) > 0) {
    concepts.push(
      createEmptyQuoteItem({
        id: createQuoteItemId(),
        name: "Productos físicos",
        itemType: "physical-product",
        supplierCost: raw.physicalProductsCosts ?? "",
        quantity: "1",
      }),
    );
  }

  if (parseAmount(raw.eventVariableCosts) > 0) {
    concepts.push(
      createEmptyQuoteItem({
        id: createQuoteItemId(),
        name: "Gastos del evento",
        itemType: "expense",
        expenseCost: raw.eventVariableCosts ?? "",
        quantity: "1",
      }),
    );
  }

  return concepts;
}

export function normalizeCuantoCobroQuote(raw: LegacyQuoteShape): CuantoCobroQuoteInput {
  const base = { ...INITIAL_CUANTO_COBRO_QUOTE };
  const client = normalizeClient(raw);

  const rawConcepts = raw.concepts ?? raw.items;
  const concepts =
    Array.isArray(rawConcepts) && rawConcepts.length > 0
      ? rawConcepts.map((concept) => normalizeQuoteItem(concept))
      : migrateLegacyConcepts(raw);

  const clientNote =
    raw.clientNote?.trim() ||
    (typeof raw.deliverables === "string" && raw.deliverables.trim() ? raw.deliverables : "");

  return {
    ...base,
    client,
    concepts,
    internalNotes: raw.internalNotes ?? base.internalNotes,
    commercialDisplayMode: resolveCommercialDisplayMode(raw),
    commercialNote: resolveCommercialNote({ ...raw, clientNote: raw.clientNote ?? clientNote }),
    chosenPrice: typeof raw.chosenPrice === "string" ? raw.chosenPrice : base.chosenPrice,
    paymentOptions: normalizePaymentOptions(raw.paymentOptions ?? base.paymentOptions),
    status: raw.status ?? base.status,
  };
}
