import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn() },
  culturalWorkOffer: { findUnique: vi.fn(), updateMany: vi.fn() },
  culturalEditionCopy: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const conciliar = vi.hoisted(() => ({ certificarCopia: vi.fn(async () => "OK") }));
vi.mock("./conciliar", () => conciliar);
vi.mock("./config", () => ({ leerConfigDeVentas: () => ({ modo: "TEST", ambienteCuenta: "SANDBOX" }) }));

const { aprobarOferta, emitirPruebaDeAutor, pausarOferta, pedirCambiosOferta, reanudarOferta } = await import("./revision");
const { resetRateLimit } = await import("@/lib/limite");

const dueno = { id: 7, esSuperAdmin: false, email: "d@x", name: "Dueña" };
const coorg = { id: 8, esSuperAdmin: false, email: "c@x", name: "Coorg" };
let oferta: Record<string, unknown>;
const base = (extra: Record<string, unknown> = {}) => ({
  id: "of1", activityId: "a1", activityWorkId: "aw1", authorUserId: 50, format: "PRINT", editionKind: "LIMITED", editionSize: 10, proofCount: 2,
  priceArs: 100_000, approvedPriceArs: null, paper: "Hahnemühle", widthCm: 40, heightCm: 60, status: "PROPOSED", reviewNote: null, firstSoldAt: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = dueno;
  oferta = base();
  db.culturalActivity.findUnique.mockImplementation(async () => ({
    proposedByUserId: 7,
    members: usuarioActual.valor!.id === 8 ? [{ userId: 8, role: "CO_ORGANIZER", status: "ACTIVE" }] : [],
  }));
  db.culturalWorkOffer.findUnique.mockImplementation(async () => oferta);
  db.culturalWorkOffer.updateMany.mockImplementation(async (q: { where: { status?: string }; data: Record<string, unknown> }) => {
    if (q.where.status && q.where.status !== oferta.status) return { count: 0 };
    oferta = { ...oferta, ...q.data };
    return { count: 1 };
  });
  db.culturalEditionCopy.findMany.mockResolvedValue([]);
  db.culturalEditionCopy.create.mockResolvedValue({});
  db.culturalEditionCopy.updateMany.mockResolvedValue({ count: 1 });
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => fn(db));
  db.$queryRaw.mockResolvedValue([]);
});

describe("revisión de formatos", () => {
  it("la coorganización no aprueba", async () => {
    usuarioActual.valor = coorg;
    expect(await aprobarOferta("of1")).toEqual({ ok: false, errores: ["Ese formato no existe."] });
    expect(oferta.status).toBe("PROPOSED");
  });

  it("aprobar un formato propuesto → aprobado, con su precio y quién lo aprobó", async () => {
    expect(await aprobarOferta("of1")).toEqual({ ok: true });
    expect(oferta).toMatchObject({ status: "APPROVED", approvedPriceArs: 100_000, approvedByUserId: 7, reviewNote: null });
    expect(oferta.approvedAt).toBeInstanceOf(Date);
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it("aprobar un cambio de precio de un formato con ventas → precio nuevo, la edición intacta", async () => {
    oferta = base({ priceArs: 130_000, approvedPriceArs: 100_000, firstSoldAt: new Date("2026-11-01T12:00:00Z") });
    expect(await aprobarOferta("of1")).toEqual({ ok: true });
    expect(oferta).toMatchObject({ status: "APPROVED", approvedPriceArs: 130_000, editionSize: 10 });
    expect(db.culturalWorkOffer.updateMany.mock.calls[0]![0].data).not.toHaveProperty("editionSize");
  });

  it("pedir cambios sin nota → mensaje", async () => {
    expect(await pedirCambiosOferta("of1", "   ")).toEqual({ ok: false, errores: ["Escribí qué hay que cambiar."] });
    expect(await pedirCambiosOferta("of1", "El papel no corresponde a la medida.")).toEqual({ ok: true });
    expect(oferta).toMatchObject({ status: "CHANGES_REQUESTED", reviewNote: "El papel no corresponde a la medida." });
  });

  it("pausar y reanudar", async () => {
    oferta = base({ status: "APPROVED", approvedPriceArs: 100_000 });
    expect(await pausarOferta("of1")).toEqual({ ok: true });
    expect(oferta).toMatchObject({ status: "PAUSED", pausedBy: "ORGANIZER" });
    expect(await reanudarOferta("of1")).toEqual({ ok: true });
    expect(oferta).toMatchObject({ status: "APPROVED", pausedBy: null });
  });

  it("no se pausa lo que no está aprobado", async () => {
    expect(await pausarOferta("of1")).toEqual({ ok: false, errores: ["Sólo se pausa un formato aprobado."] });
  });
});

describe("pruebas de autor", () => {
  it("emite la P/A más baja libre, de prueba en modo sandbox", async () => {
    oferta = base({ status: "APPROVED", approvedPriceArs: 100_000, reviewNote: "Pedido de P/A: el autor pidió sus pruebas" });
    db.culturalEditionCopy.findMany.mockResolvedValue([{ id: "c1", number: 1, status: "ISSUED", reservedUntil: null, kind: "PROOF", isTest: true }]);
    db.culturalEditionCopy.create.mockResolvedValue({ id: "c9" });
    expect(await emitirPruebaDeAutor("of1")).toEqual({ ok: true, aviso: "Emitimos la P/A 2/2 con su certificado." });
    // La P/A sale con su certificado firmado (sin comprador).
    expect(conciliar.certificarCopia).toHaveBeenCalledWith("c9");
    expect(db.culturalEditionCopy.create.mock.calls[0]![0].data).toMatchObject({ offerId: "of1", kind: "PROOF", number: 2, status: "ISSUED", isTest: true });
    expect(oferta.reviewNote).toBeNull();
  });
  it("sin P/A libres → mensaje", async () => {
    oferta = base({ status: "APPROVED", approvedPriceArs: 100_000 });
    db.culturalEditionCopy.findMany.mockResolvedValue([
      { id: "c1", number: 1, status: "ISSUED", reservedUntil: null, kind: "PROOF", isTest: true },
      { id: "c2", number: 2, status: "VOIDED", reservedUntil: null, kind: "PROOF", isTest: true },
    ]);
    expect(await emitirPruebaDeAutor("of1")).toEqual({ ok: false, errores: ["Ya se emitieron todas las pruebas de autor."] });
    expect(db.culturalEditionCopy.create).not.toHaveBeenCalled();
    expect(conciliar.certificarCopia).not.toHaveBeenCalled();
  });
});
