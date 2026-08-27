import assert from "node:assert/strict";
import { test } from "node:test";

import { countCriticalAlerts, toSnapshotRow } from "./daily-report-repository";

const SNAPSHOT = {
  reportDate: "2026-08-23",
  timeZone: "America/Argentina/Buenos_Aires",
  generatedAt: "2026-08-24T03:00:05.000Z",
  generationMs: 5000,
  status: "partial" as const,
  sections: [],
  failedSections: ["fotoffice"],
  alerts: [
    {
      id: "a",
      platform: "platform" as const,
      title: "A",
      detail: "",
      severity: "critical" as const,
      urgency: "immediate" as const,
      affectedCount: null,
      since: null,
    },
    {
      id: "b",
      platform: "platform" as const,
      title: "B",
      detail: "",
      severity: "medium" as const,
      urgency: "today" as const,
      affectedCount: null,
      since: null,
    },
  ],
};

test("cuenta solo las alertas críticas", () => {
  assert.equal(countCriticalAlerts(SNAPSHOT), 1);
});

test("traduce el estado del informe al enum de la base", () => {
  const row = toSnapshotRow(SNAPSHOT);

  assert.equal(row.status, "PARTIAL");
  assert.equal(row.reportDate, "2026-08-23");
  assert.equal(row.generationMs, 5000);
  assert.deepEqual(row.failedSections, ["fotoffice"]);
  assert.equal(row.criticalAlerts, 1);
});

test("un informe completo se traduce a COMPLETE", () => {
  const row = toSnapshotRow({ ...SNAPSHOT, status: "complete", failedSections: [] });

  assert.equal(row.status, "COMPLETE");
});

test("un informe totalmente fallido se traduce a FAILED", () => {
  const row = toSnapshotRow({ ...SNAPSHOT, status: "failed" });

  assert.equal(row.status, "FAILED");
});
