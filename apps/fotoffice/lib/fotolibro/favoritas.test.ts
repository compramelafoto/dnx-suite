import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Una base en memoria con lo justo: plantillas y versiones.
const plantillas: { id: string; ownerUserId: number; workspaceId: string | null; status: string; currentVersionId: string | null; name: string }[] = [];
const versiones = new Map<string, { id: string; metaJson: unknown }>();
let n = 0;
const db = {
  templateV2: {
    findMany: vi.fn(async ({ where }: { where: { ownerUserId: number; status: string } }) => plantillas.filter((t) => t.ownerUserId === where.ownerUserId && t.status === where.status && t.workspaceId === null)),
    create: vi.fn(async ({ data }: { data: { ownerUserId: number; name: string; status: string } }) => {
      const t = { id: `t${++n}`, ownerUserId: data.ownerUserId, workspaceId: null, status: data.status, currentVersionId: null, name: data.name };
      plantillas.push(t);
      return { id: t.id };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: { currentVersionId: string } }) => {
      plantillas.find((t) => t.id === where.id)!.currentVersionId = data.currentVersionId;
    }),
  },
  templateV2Version: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => versiones.get(where.id) ?? null),
    create: vi.fn(async ({ data }: { data: { metaJson: unknown } }) => {
      const v = { id: `v${++n}`, metaJson: data.metaJson };
      versiones.set(v.id, v);
      return { id: v.id };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: { metaJson: unknown } }) => {
      versiones.get(where.id)!.metaJson = data.metaJson;
    }),
  },
};
vi.mock("@repo/db", () => ({ prisma: { ...db, $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) } }));

describe("favoritas guardadas por persona", () => {
  beforeEach(() => {
    plantillas.length = 0;
    versiones.clear();
  });

  it("la primera vez crea su plantilla oculta; después la reusa", async () => {
    const { guardarFavoritas, leerFavoritas } = await import("./favoritas");
    expect(await leerFavoritas(7)).toEqual([]);
    const f = { id: "a", nombre: "Tres columnas", marcos: [{ x: 0, y: 0, w: 0.33, h: 1 }] };
    await guardarFavoritas(7, [f]);
    await guardarFavoritas(7, [f, { ...f, id: "b" }]);
    expect(plantillas).toHaveLength(1);
    expect(plantillas[0]!.status).toBe("ARCHIVED");
    expect((await leerFavoritas(7)).map((x) => x.id)).toEqual(["a", "b"]);
    expect(await leerFavoritas(8)).toEqual([]);
  });
});
