import type { AdminRegistrationDetail, AdminRegistrationListItem } from "../domain/types";

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export type RegistrationExportRow = {
  registrationId: string;
  visibleCode: string | null;
  participantNumber: string | null;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  paymentStatus: string;
  includedProduct: string | null;
  shirtSize: string | null;
  quantity: number | null;
  fulfillmentStatus: string | null;
  fulfilledAt: string | null;
  totalAmount: number;
  currency: string;
  instagramHandle?: string | null;
  profilePhotoAssetId?: string | null;
  welcomeCardStatus?: string | null;
  welcomePublicationStatus?: string | null;
  welcomeUrl?: string | null;
};

export function toExportRowsFromList(
  rows: AdminRegistrationListItem[],
): RegistrationExportRow[] {
  return rows.map((r) => ({
    registrationId: r.id,
    visibleCode: r.visibleCode,
    participantNumber: r.visibleCode,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    status: r.status,
    paymentStatus: r.paymentStatus,
    includedProduct: r.includedProductLabel,
    shirtSize: r.shirtSizeLabel,
    quantity: r.itemCount > 0 ? 1 : null,
    fulfillmentStatus: r.itemFulfillmentStatus,
    fulfilledAt: null,
    totalAmount: r.totalAmount,
    currency: r.currency,
  }));
}

export function toExportRowsFromDetails(
  details: AdminRegistrationDetail[],
): RegistrationExportRow[] {
  const out: RegistrationExportRow[] = [];
  for (const r of details) {
    const items = r.items.filter((i) => i.isIncluded);
    if (items.length === 0) {
      out.push({
        registrationId: r.id,
        visibleCode: r.visibleCode,
        participantNumber: r.visibleCode,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        status: r.status,
        paymentStatus: r.paymentStatus,
        includedProduct: null,
        shirtSize: null,
        quantity: null,
        fulfillmentStatus: null,
        fulfilledAt: null,
        totalAmount: r.totalAmount,
        currency: r.currency,
      });
      continue;
    }
    for (const item of items) {
      out.push({
        registrationId: r.id,
        visibleCode: r.visibleCode,
        participantNumber: r.visibleCode,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        status: r.status,
        paymentStatus: r.paymentStatus,
        includedProduct: item.nameSnapshot,
        shirtSize: item.variantNameSnapshot ?? null,
        quantity: item.quantity,
        fulfillmentStatus: item.fulfillmentStatus ?? null,
        fulfilledAt: item.fulfilledAt ? item.fulfilledAt.toISOString() : null,
        totalAmount: r.totalAmount,
        currency: r.currency,
      });
    }
  }
  return out;
}

export function buildRegistrationsCsv(rows: RegistrationExportRow[]): string {
  const header = [
    "registrationId",
    "visibleCode",
    "participantNumber",
    "firstName",
    "lastName",
    "email",
    "status",
    "paymentStatus",
    "includedProduct",
    "shirtSize",
    "quantity",
    "fulfillmentStatus",
    "fulfilledAt",
    "totalAmount",
    "currency",
    "instagramHandle",
    "profilePhotoAssetId",
    "welcomeCardStatus",
    "welcomePublicationStatus",
    "welcomeUrl",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.registrationId,
        r.visibleCode,
        r.participantNumber,
        r.firstName,
        r.lastName,
        r.email,
        r.status,
        r.paymentStatus,
        r.includedProduct,
        r.shirtSize,
        r.quantity,
        r.fulfillmentStatus,
        r.fulfilledAt,
        r.totalAmount,
        r.currency,
        r.instagramHandle,
        r.profilePhotoAssetId,
        r.welcomeCardStatus,
        r.welcomePublicationStatus,
        r.welcomeUrl,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Resumen agrupado por talle (usa snapshot histórico). */
export function summarizeShirtSizes(
  rows: RegistrationExportRow[],
  sizes: readonly string[],
): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const size of sizes) summary[size] = 0;
  for (const row of rows) {
    const key = (row.shirtSize ?? "").trim().toUpperCase();
    if (!key) continue;
    if (summary[key] == null) summary[key] = 0;
    summary[key] += row.quantity && row.quantity > 0 ? row.quantity : 1;
  }
  return summary;
}

export function buildShirtSizeSummaryCsv(
  summary: Record<string, number>,
  orderedSizes: readonly string[],
): string {
  const lines = ["shirtSize,quantity"];
  const keys = [
    ...orderedSizes,
    ...Object.keys(summary).filter((k) => !orderedSizes.includes(k)),
  ];
  for (const size of keys) {
    lines.push(`${csvEscape(size)},${csvEscape(summary[size] ?? 0)}`);
  }
  return `${lines.join("\n")}\n`;
}
