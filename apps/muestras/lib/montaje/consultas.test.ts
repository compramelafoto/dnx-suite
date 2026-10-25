import { beforeEach, describe, expect, it, vi } from "vitest";
import { FRAME_BATCH_SIZE, frameBatches } from "@repo/muestras";

const db = vi.hoisted(() => ({ culturalActivity: { findFirst: vi.fn() }, culturalExhibitorWork: { findMany: vi.fn() } }));
const pub = vi.hoisted(() => ({ obrasSoloOnline: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/concursos/publico", () => pub);

const { cargarMontaje } = await import("./consultas");

const obra = (i: number) => ({ id: `w${i}`, title: `Obra ${i}`, authorName: "Ana", sortOrder: i });
const u = { id: 7, esSuperAdmin: false };
const item = (workId: string) => ({ workId, frameWidthCm: 40, frameHeightCm: 50 });
// Dos tandas con todas las obras impresas: FRAME_BATCH_SIZE + 2.
const obras = Array.from({ length: FRAME_BATCH_SIZE + 2 }, (_, i) => obra(i));
const ultima = obras.at(-1)!.id;

beforeEach(() => {
  vi.clearAllMocks();
  db.culturalActivity.findFirst.mockResolvedValue({
    id: "a1", slug: "m", title: "Muestra", reviewStatus: "APPROVED", curatorialText: null,
    hangingPlan: { centerHeightCm: 150, walls: [{ id: "p1", name: "Pared 1", widthCm: 500, items: [item("w0"), item(ultima), item("borrada")] }] },
    works: obras,
  });
  db.culturalExhibitorWork.findMany.mockResolvedValue([]);
  pub.obrasSoloOnline.mockResolvedValue(new Set());
});

describe("cargarMontaje (etapa 7)", () => {
  it("sin concurso: todas las obras y nada sólo online", async () => {
    const m = await cargarMontaje("a1", u);
    expect(m?.works).toHaveLength(FRAME_BATCH_SIZE + 2);
    expect(m?.soloOnline).toBe(0);
  });

  it("saca las obras sólo online de la lista, las tandas y el plano, igual que los PDF", async () => {
    pub.obrasSoloOnline.mockResolvedValue(new Set([ultima, "w1"]));
    const m = await cargarMontaje("a1", u);
    const ids = m!.works.map((w) => w.id);
    expect(ids).not.toContain(ultima);
    expect(ids).not.toContain("w1");
    expect(m!.soloOnline).toBe(2);
    // Las tandas se cuentan sobre la misma lista que usa el PDF: entra todo en una sola.
    expect(frameBatches(ids.length)).toEqual([{ n: 1, from: 1, to: FRAME_BATCH_SIZE }]);
    // El plano no ofrece la obra sólo online; el aviso de "ya no están" cuenta sólo la borrada.
    expect(m!.plan.walls[0]!.items.map((i) => i.workId)).toEqual(["w0"]);
    expect(m!.droppedItems).toBe(1);
    // Las medidas con marco se buscan sólo para las obras que se imprimen.
    expect(db.culturalExhibitorWork.findMany.mock.calls[0]![0].where.activityWorkId.in).toEqual(ids);
  });

  it("con una sola obra sólo online en la última tanda, quedan dos tandas sin ella", async () => {
    obras.push(obra(FRAME_BATCH_SIZE + 2));
    try {
      pub.obrasSoloOnline.mockResolvedValue(new Set([obras.at(-1)!.id]));
      const m = await cargarMontaje("a1", u);
      expect(m!.works).toHaveLength(FRAME_BATCH_SIZE + 2);
      expect(frameBatches(m!.works.length).at(-1)).toEqual({ n: 2, from: FRAME_BATCH_SIZE + 1, to: FRAME_BATCH_SIZE + 2 });
      expect(m!.works.map((w) => w.id)).not.toContain(obras.at(-1)!.id);
    } finally {
      obras.pop();
    }
  });
});
