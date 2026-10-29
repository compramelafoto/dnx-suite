import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const versiones: { id: string; templateId: string; metaJson: Record<string, unknown>; revision: number }[] = [];
const plantillas: { id: string; currentVersionId: string | null }[] = [];
let n = 0;
type FiltroJson = { metaJson: { path: string[]; equals: unknown } };
const db = {
  templateV2: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => plantillas.find((t) => t.id === where.id) ?? null),
    create: vi.fn(async () => {
      const t = { id: `t${++n}`, currentVersionId: null };
      plantillas.push(t);
      return { id: t.id };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: { currentVersionId: string } }) => {
      plantillas.find((t) => t.id === where.id)!.currentVersionId = data.currentVersionId;
    }),
  },
  templateV2Version: {
    findMany: vi.fn(async ({ where }: { where: { AND: FiltroJson[] } }) =>
      versiones.filter((v) => where.AND.every((f) => v.metaJson[f.metaJson.path[0]!] === f.metaJson.equals)).slice(0, 1),
    ),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => versiones.find((v) => v.id === where.id) ?? null),
    create: vi.fn(async ({ data }: { data: { templateId: string; metaJson: Record<string, unknown> } }) => {
      const v = { id: `v${++n}`, templateId: data.templateId, metaJson: data.metaJson, revision: 0 };
      versiones.push(v);
      return { id: v.id };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: { metaJson: Record<string, unknown> } }) => {
      versiones.find((v) => v.id === where.id)!.metaJson = data.metaJson;
    }),
  },
};
vi.mock("@repo/db", () => ({ prisma: { ...db, $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) } }));

describe("aprobación del cliente", () => {
  beforeEach(() => {
    versiones.length = 0;
    plantillas.length = 0;
    // El fotolibro, guardado 7 veces.
    plantillas.push({ id: "libro", currentVersionId: "vlibro" });
    versiones.push({ id: "vlibro", templateId: "libro", metaJson: { templateKey: "fotolibro" }, revision: 7 });
  });

  it("crea el enlace una vez, el cliente comenta y aprueba sobre el guardado actual", async () => {
    const m = await import("./revision-cliente");
    const r = await m.compartirConCliente("libro", 1);
    expect(r.token!.length).toBeGreaterThanOrEqual(20);
    expect((await m.compartirConCliente("libro", 1)).token).toBe(r.token);
    const c = await m.comentar(r.token!, { pliego: 2, texto: "  Cambiar la foto  ", nombre: "Ana" });
    expect(c!.estado).toBe("cambios");
    expect(c!.comentarios[0]).toMatchObject({ pliego: 2, texto: "Cambiar la foto", nombre: "Ana", resuelto: false });
    const a = await m.aprobar(r.token!, "Ana");
    expect(a!.aprobacion).toMatchObject({ nombre: "Ana", revision: 7 });
    // Aprobado, ya no se comenta.
    expect(await m.comentar(r.token!, { pliego: 0, texto: "otra", nombre: "Ana" })).toBeNull();
  });

  it("dejar de compartir corta el enlace, y un enlace corto o inventado no abre nada", async () => {
    const m = await import("./revision-cliente");
    const r = await m.compartirConCliente("libro", 1);
    await m.dejarDeCompartir("libro");
    expect(await m.revisionPorEnlace(r.token!)).toBeNull();
    expect(await m.revisionPorEnlace("corto")).toBeNull();
    // Volver a compartir da un enlace nuevo.
    expect((await m.compartirConCliente("libro", 1)).token).not.toBe(r.token);
  });
});

describe("fecha de los comentarios", () => {
  it("sale en hora argentina y en 24 horas, igual en cualquier lado", async () => {
    const { fechaCorta } = await import("./revision-cliente-tipos");
    expect(fechaCorta("2026-10-29T15:00:00Z")).toBe("29/10 12:00");
    expect(fechaCorta("2026-10-29T23:30:00Z")).toBe("29/10 20:30");
  });
});
