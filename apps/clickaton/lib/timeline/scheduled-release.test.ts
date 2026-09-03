import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDuePromptsWhere,
  groupDueByEdition,
  releaseScheduledPrompts,
  type DuePrompt,
  type PromptReleaseStore,
} from "./scheduled-release";

const NOW = new Date("2026-09-02T13:30:00.000Z");
const TEN = new Date("2026-09-02T13:00:00.000Z");
const ONCE = new Date("2026-09-02T13:20:00.000Z");

function fakeStore(rows: DuePrompt[], releasedPerEdition = 3) {
  const writes: Array<{ editionId: string; releasedAt: Date }> = [];
  const store: PromptReleaseStore = {
    async findDuePrompts() {
      return rows;
    },
    async markEditionReleased(input) {
      writes.push(input);
      return releasedPerEdition;
    },
  };
  return { store, writes };
}

test("libera usando la hora planificada, no la del cron", async () => {
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

test("una sola apertura por edición: todas las consignas juntas", async () => {
  const f = fakeStore([
    { id: "p1", editionId: "e1", sequence: 1, captureStartsAt: ONCE },
    { id: "p2", editionId: "e1", sequence: 2, captureStartsAt: TEN },
    { id: "p3", editionId: "e2", sequence: 1, captureStartsAt: ONCE },
  ]);
  const r = await releaseScheduledPrompts(f.store, { now: NOW });

  assert.equal(f.writes.length, 2, "una escritura por edición, no una por consigna");
  assert.deepEqual(
    f.writes.find((w) => w.editionId === "e1")?.releasedAt,
    TEN,
    "toma la hora planificada más temprana de la edición",
  );
  assert.equal(r.released.find((x) => x.editionId === "e1")?.prompts, 3);
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

test("groupDueByEdition usa `now` cuando la consigna no tiene hora planificada", () => {
  const grouped = groupDueByEdition(
    [{ id: "p1", editionId: "e1", sequence: 1, captureStartsAt: null }],
    NOW,
  );
  assert.deepEqual(grouped, [{ editionId: "e1", releasedAt: NOW, pending: 1 }]);
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
