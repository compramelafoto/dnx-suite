import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalActivity: { findFirst: vi.fn() } }));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const limpieza = vi.hoisted(() => ({ purgarAsistencias: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/inauguracion/limpieza", () => limpieza);
const { GET } = await import("@/app/api/inauguracion/[id]/csv/route");
const { LIMITES, resetRateLimit } = await import("@/lib/limite");

const co = { id: 2, esSuperAdmin: false, email: "co@x.com", name: "Co" };
const pedir = (id = "a1") => GET(new Request(`http://localhost:3014/api/inauguracion/${id}/csv`), { params: Promise.resolve({ id }) });
const muestra = (extra: Record<string, unknown> = {}) => ({
  slug: "rosario", endsAt: new Date(Date.now() + 86_400_000), rsvpPurgedAt: null,
  rsvps: [{ name: "Ana", email: "ana@x.com", companions: 1, status: "CONFIRMED", createdAt: new Date("2026-11-10T21:40:00Z") }], ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = co;
  db.culturalActivity.findFirst.mockResolvedValue(muestra());
});

describe("GET /api/inauguracion/[id]/csv", () => {
  it("sin sesión → al ingreso", async () => {
    usuarioActual.valor = null;
    const r = await pedir();
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).pathname + new URL(r.headers.get("location")!).search).toBe("/login?next=%2Fpanel%2Fdifusion");
  });
  it("TEXT_EDITOR (o cualquiera sin `rsvp`) → 404", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(null);
    expect((await pedir()).status).toBe(404);
    expect(db.culturalActivity.findFirst.mock.calls[0]![0].where).toMatchObject({
      AND: [{ id: "a1", type: "MUESTRA" }, { OR: [{ proposedByUserId: 2 }, { members: { some: { userId: 2, status: "ACTIVE", role: { in: ["CO_ORGANIZER"] } } } }] }],
    });
  });
  it("coorganización → el CSV para Excel, sin caché compartida", async () => {
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="asistencia-rosario.csv"');
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const cuerpo = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await r.arrayBuffer());
    expect(cuerpo.charCodeAt(0)).toBe(0xfeff);
    expect(cuerpo).toContain("Ana;ana@x.com;1;2;Confirmada");
  });
  it("datos ya borrados → 404 con explicación", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ rsvpPurgedAt: new Date(), rsvps: [] }));
    const r = await pedir();
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Los datos de asistencia se borraron 30 días después del cierre de la muestra.");
  });
  it("vencida y sin borrar todavía: se borra en el momento y no se entrega", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ endsAt: new Date(Date.now() - 31 * 86_400_000) }));
    const r = await pedir();
    expect(r.status).toBe(404);
    expect(limpieza.purgarAsistencias).toHaveBeenCalledWith("a1", expect.any(Date));
  });
  it("freno → 429", async () => {
    for (let i = 0; i < LIMITES.exportarAsistencias.limit; i++) expect((await pedir()).status).toBe(200);
    expect((await pedir()).status).toBe(429);
  });
  it("id sin forma → 404 sin consultar", async () => {
    expect((await pedir("a b")).status).toBe(404);
    expect(db.culturalActivity.findFirst).not.toHaveBeenCalled();
  });
});
