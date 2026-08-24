import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveArgentinaDayWindow } from "../window/day-window";
import { buildDailyReport } from "./build";
import type { Collector } from "./run-collector";

const NOW = new Date("2026-08-24T03:00:00.000Z");
const WINDOW = resolveArgentinaDayWindow(NOW);

function okCollector(key: string): Collector {
  return {
    key,
    title: key,
    async run() {
      return {
        section: { key, title: key, status: "ok", error: null, groups: [], tables: [] },
        alerts: [],
      };
    },
  };
}

function failingCollector(key: string): Collector {
  return {
    key,
    title: key,
    async run(): Promise<never> {
      throw new Error("se cayó");
    },
  };
}

test("con todos los colectores bien el informe queda completo", async () => {
  const snapshot = await buildDailyReport({
    window: WINDOW,
    collectors: [okCollector("a"), okCollector("b")],
    now: NOW,
  });

  assert.equal(snapshot.status, "complete");
  assert.equal(snapshot.sections.length, 2);
  assert.deepEqual(snapshot.failedSections, []);
  assert.equal(snapshot.reportDate, "2026-08-23");
});

test("si un colector falla el informe sale parcial pero sale", async () => {
  const snapshot = await buildDailyReport({
    window: WINDOW,
    collectors: [okCollector("a"), failingCollector("b")],
    now: NOW,
  });

  assert.equal(snapshot.status, "partial");
  assert.deepEqual(snapshot.failedSections, ["b"]);
  assert.equal(snapshot.sections.length, 2);
});

test("si fallan todos el informe queda marcado como fallido", async () => {
  const snapshot = await buildDailyReport({
    window: WINDOW,
    collectors: [failingCollector("a"), failingCollector("b")],
    now: NOW,
  });

  assert.equal(snapshot.status, "failed");
  assert.equal(snapshot.alerts.length, 2);
});

test("las alertas llegan ya ordenadas por urgencia", async () => {
  const lowCollector: Collector = {
    key: "baja",
    title: "baja",
    async run() {
      return {
        section: { key: "baja", title: "baja", status: "ok", error: null, groups: [], tables: [] },
        alerts: [
          {
            id: "baja",
            platform: "platform",
            title: "Baja",
            detail: "",
            severity: "low",
            urgency: "informational",
            affectedCount: null,
            since: null,
          },
        ],
      };
    },
  };

  const urgentCollector: Collector = {
    key: "urgente",
    title: "urgente",
    async run() {
      return {
        section: {
          key: "urgente",
          title: "urgente",
          status: "ok",
          error: null,
          groups: [],
          tables: [],
        },
        alerts: [
          {
            id: "urgente",
            platform: "platform",
            title: "Urgente",
            detail: "",
            severity: "critical",
            urgency: "immediate",
            affectedCount: null,
            since: null,
          },
        ],
      };
    },
  };

  const snapshot = await buildDailyReport({
    window: WINDOW,
    collectors: [lowCollector, urgentCollector],
    now: NOW,
  });

  assert.deepEqual(
    snapshot.alerts.map((item) => item.id),
    ["urgente", "baja"],
  );
});

test("registra cuánto tardó en generarse", async () => {
  const snapshot = await buildDailyReport({
    window: WINDOW,
    collectors: [okCollector("a")],
    now: NOW,
  });

  assert.ok(snapshot.generationMs >= 0);
  assert.equal(snapshot.timeZone, "America/Argentina/Buenos_Aires");
});
