/**
 * Persistencia del Informe Diario DNX.
 *
 * El snapshot completo se guarda como JSON: el panel lo lee tal cual, sin
 * recalcular, y la comparativa del día siguiente puede leer el valor de ayer
 * sin volver a consultar toda la base.
 */

import type { PrismaClient } from "@prisma/client";
import type { DailyReportSnapshot } from "@repo/ops-daily-report";

export type DailyReportStatusRow = "COMPLETE" | "PARTIAL" | "FAILED";

export type DailyReportSnapshotRow = {
  reportDate: string;
  timeZone: string;
  status: DailyReportStatusRow;
  payload: DailyReportSnapshot;
  generationMs: number;
  failedSections: string[];
  criticalAlerts: number;
};

export type DailyReportSnapshotSummary = {
  id: string;
  reportDate: string;
  status: DailyReportStatusRow;
  criticalAlerts: number;
  failedSections: string[];
  createdAt: Date;
};

const STATUS_MAP: Record<DailyReportSnapshot["status"], DailyReportStatusRow> = {
  complete: "COMPLETE",
  partial: "PARTIAL",
  failed: "FAILED",
};

export function countCriticalAlerts(snapshot: DailyReportSnapshot): number {
  return snapshot.alerts.filter((alert) => alert.severity === "critical").length;
}

export function toSnapshotRow(snapshot: DailyReportSnapshot): DailyReportSnapshotRow {
  return {
    reportDate: snapshot.reportDate,
    timeZone: snapshot.timeZone,
    status: STATUS_MAP[snapshot.status],
    payload: snapshot,
    generationMs: snapshot.generationMs,
    failedSections: snapshot.failedSections,
    criticalAlerts: countCriticalAlerts(snapshot),
  };
}

/** Guarda el informe del día; si ya existía uno para esa fecha, lo reemplaza. */
export async function saveDailyReportSnapshot(
  client: PrismaClient,
  snapshot: DailyReportSnapshot,
): Promise<{ id: string }> {
  const row = toSnapshotRow(snapshot);

  return client.dnxDailyReportSnapshot.upsert({
    where: { reportDate: row.reportDate },
    create: {
      reportDate: row.reportDate,
      timeZone: row.timeZone,
      status: row.status,
      payload: row.payload as unknown as object,
      generationMs: row.generationMs,
      failedSections: row.failedSections,
      criticalAlerts: row.criticalAlerts,
    },
    update: {
      timeZone: row.timeZone,
      status: row.status,
      payload: row.payload as unknown as object,
      generationMs: row.generationMs,
      failedSections: row.failedSections,
      criticalAlerts: row.criticalAlerts,
    },
    select: { id: true },
  });
}

export type RecordDeliveryInput = {
  snapshotId: string;
  recipient: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  providerMessageId?: string | null;
  error?: string | null;
};

export async function recordDailyReportDelivery(
  client: PrismaClient,
  input: RecordDeliveryInput,
): Promise<void> {
  await client.dnxDailyReportDelivery.create({
    data: {
      snapshotId: input.snapshotId,
      channel: "email",
      recipient: input.recipient,
      status: input.status,
      providerMessageId: input.providerMessageId ?? null,
      error: input.error ?? null,
    },
  });
}

export async function findDailyReportSnapshot(
  client: PrismaClient,
  reportDate: string,
): Promise<DailyReportSnapshot | null> {
  const found = await client.dnxDailyReportSnapshot.findUnique({
    where: { reportDate },
    select: { payload: true },
  });

  return found ? (found.payload as unknown as DailyReportSnapshot) : null;
}

export async function listDailyReportSnapshots(
  client: PrismaClient,
  limit = 30,
): Promise<DailyReportSnapshotSummary[]> {
  const rows = await client.dnxDailyReportSnapshot.findMany({
    orderBy: { reportDate: "desc" },
    take: limit,
    select: {
      id: true,
      reportDate: true,
      status: true,
      criticalAlerts: true,
      failedSections: true,
      createdAt: true,
    },
  });

  return rows as DailyReportSnapshotSummary[];
}
