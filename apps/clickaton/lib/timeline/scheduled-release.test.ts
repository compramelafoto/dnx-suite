import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDuePromptsWhere,
  releaseScheduledPrompts,
  type DuePrompt,
  type PromptReleaseStore,
} from "./scheduled-release";

const NOW = new Date("2026-09-02T13:30:00.000Z");
const TEN = new Date("2026-09-02T13:00:00.000Z");

function fakeStore(rows: DuePrompt[]) {
  const writes: Array<{ promptId: string; releasedAt: Date }> = [];
  const store: PromptReleaseStore = {
    async findDuePrompts() {
      return rows;
    },
    async markReleased(input) {
      writes.push(input);
    },
  };
  return { store, writes };
}

test("libera la consigna vencida usando la hora planificada, no la del cron", async () => {
  const f = fakeStore([{ id: "p1", editionId: "e1", sequence: 1, captureStartsAt: TEN }]);
  const r = await releaseScheduledPrompts(f.store, { now: NOW });

  assert.equal(r.count, 1);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(
    f.writes[0]?.releasedAt,
    TEN,
    "si releasedAt fuera la hora del cron, una foto tomada 10:00 quedaría fuera de ventana",
  );
});

test("dryRun informa sin escribir", async () => {
  const f = fakeStore([{ id: "p1", editionId: "e1", sequence: 1, captureStartsAt: TEN }]);
  const r = await releaseScheduledPrompts(f.store, { now: NOW, dryRun: true });

  assert.equal(r.count, 1);
  assert.equal(f.writes.length, 0);
});

test("no libera nada cuando no hay consignas vencidas", async () => {
  const f = fakeStore([]);
  const r = await releaseScheduledPrompts(f.store, { now: NOW });
  assert.equal(r.count, 0);
  assert.equal(f.writes.length, 0);
});

test("la condición de búsqueda excluye borradores, canceladas y sin fecha", () => {
  const where = buildDuePromptsWhere(NOW);

  assert.deepEqual(where.status, { in: ["READY", "LOCKED"] }, "DRAFT y CANCELLED afuera");
  assert.deepEqual(where.releaseMode, {
    in: ["SCHEDULED", "SCHEDULED_WITH_MANUAL_OVERRIDE"],
  });
  assert.deepEqual(
    where.captureStartsAt,
    { not: null, lte: NOW },
    "una consigna sin hora planificada nunca se libera sola",
  );
  assert.equal(where.releasedAt, null, "no vuelve a tocar lo ya liberado");
  assert.deepEqual(where.edition, { status: { not: "CANCELLED" } });
});
