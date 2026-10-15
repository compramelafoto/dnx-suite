import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn(), count: vi.fn() },
  culturalActivityMember: { count: vi.fn() },
  culturalSaleSetup: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  culturalSaleOrder: { count: vi.fn() },
  culturalWorkOffer: { count: vi.fn() },
  culturalPayoutAccount: { findUnique: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const cfg = vi.hoisted(() => ({ modo: "TEST" as string, ambienteCuenta: "SANDBOX" as string }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./config", () => ({ leerConfigDeVentas: () => ({ modo: cfg.modo, ambienteCuenta: cfg.ambienteCuenta, motivo: null, faltan: [], probadores: new Set() }) }));

const { cambiarEstadoDeVenta, cambiarQuienCobra, guardarVenta } = await import("./configurar");
const { resetRateLimit } = await import("@/lib/limite");

const dueno = { id: 7, esSuperAdmin: false, email: "d@x", name: "Dueña" };
const coorg = { id: 8, esSuperAdmin: false, email: "c@x", name: "Coorg" };
let muestra: Record<string, unknown>;
let setup: Record<string, unknown> | null;
let cuenta: Record<string, unknown> | null;

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const formulario = (extra: Record<string, string> = {}) => fd({ organizacion: "25", fotografo: "60", retiro: "En la sede, de martes a domingo de 15 a 20.", ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = dueno;
  cfg.modo = "TEST";
  muestra = { id: "a1", slug: "silos", type: "MUESTRA", reviewStatus: "APPROVED", isCancelled: false, endsAt: new Date(Date.now() + 86_400_000), proposedByUserId: 7 };
  setup = null;
  cuenta = { consentStatus: "ACTIVE" };
  db.culturalActivity.findUnique.mockImplementation(async (q: { select: Record<string, unknown> }) =>
    q.select.members
      ? { proposedByUserId: 7, members: usuarioActual.valor!.id === 8 ? [{ userId: 8, role: "CO_ORGANIZER", status: "ACTIVE" }] : [] }
      : muestra);
  db.culturalActivity.count.mockResolvedValue(1);
  db.culturalActivityMember.count.mockResolvedValue(1);
  db.culturalSaleSetup.findUnique.mockImplementation(async () => setup);
  db.culturalSaleSetup.create.mockImplementation(async (q: { data: Record<string, unknown> }) => (setup = { id: "s1", ...q.data }));
  db.culturalSaleSetup.update.mockImplementation(async (q: { data: Record<string, unknown> }) => {
    const data = { ...q.data } as Record<string, unknown>;
    const inc = data.splitVersion as { increment?: number } | undefined;
    if (inc && typeof inc === "object") data.splitVersion = (setup!.splitVersion as number) + (inc.increment ?? 0);
    return (setup = { ...setup!, ...data });
  });
  db.culturalSaleOrder.count.mockResolvedValue(0);
  db.culturalWorkOffer.count.mockResolvedValue(0);
  db.culturalPayoutAccount.findUnique.mockImplementation(async () => cuenta);
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => fn(db));
  db.$queryRaw.mockResolvedValue([]);
});

const existente = (extra: Record<string, unknown> = {}) => ({
  id: "s1", activityId: "a1", status: "DRAFT", organizerUserId: 7, platformFeeBps: 1500, organizerBps: 2500, photographerBps: 6000, splitVersion: 1,
  pickupText: "En la sede", shippingEnabled: false, shippingCostArs: null, shippingText: null, extraTerms: null, openedAt: null, ...extra,
});

describe("guardarVenta", () => {
  it("la coorganización no puede guardar", async () => {
    usuarioActual.valor = coorg;
    expect(await guardarVenta("a1", formulario())).toEqual({ ok: false, errores: ["La muestra no existe."] });
    expect(db.culturalSaleSetup.create).not.toHaveBeenCalled();
  });

  it("porcentajes que no suman 85 → mensaje", async () => {
    const r = await guardarVenta("a1", formulario({ organizacion: "30", fotografo: "60" }));
    expect(r).toEqual({ ok: false, errores: ["La organización y el fotógrafo se reparten el 85 %: tienen que sumar 85."] });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("sin porcentajes → mensaje (no hay valor por defecto)", async () => {
    const r = await guardarVenta("a1", fd({ retiro: "x" }));
    expect(r.ok).toBe(false);
  });

  it("la primera vez crea la fila con el dueño como quien cobra y la plataforma en 15 %", async () => {
    expect(await guardarVenta("a1", formulario())).toEqual({ ok: true });
    expect(db.culturalSaleSetup.create.mock.calls[0]![0].data).toMatchObject({
      activityId: "a1", status: "DRAFT", organizerUserId: 7, platformFeeBps: 1500, organizerBps: 2500, photographerBps: 6000,
      pickupText: "En la sede, de martes a domingo de 15 a 20.", shippingEnabled: false, shippingCostArs: null, createdByUserId: 7,
    });
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it("el envío habilitado exige el costo", async () => {
    const r = await guardarVenta("a1", formulario({ envio: "on" }));
    expect(r).toEqual({ ok: false, errores: ["Poné el costo del envío en pesos enteros (0 si es gratis)."] });
  });

  it("con impresas aprobadas, el texto del retiro es obligatorio", async () => {
    db.culturalWorkOffer.count.mockResolvedValue(2);
    const r = await guardarVenta("a1", formulario({ retiro: "  " }));
    expect(r).toEqual({ ok: false, errores: ["Escribí cómo se retiran las impresas en la sede."] });
  });

  it("cambiar los porcentajes sube la versión del reparto", async () => {
    setup = existente();
    expect(await guardarVenta("a1", formulario({ organizacion: "35", fotografo: "50" }))).toEqual({ ok: true, aviso: expect.stringContaining("aceptar") });
    expect(setup).toMatchObject({ organizerBps: 3500, photographerBps: 5000, splitVersion: 2 });
  });

  it("guardar sin cambiar porcentajes no sube la versión", async () => {
    setup = existente();
    expect(await guardarVenta("a1", formulario({ retiro: "Otro texto" }))).toEqual({ ok: true });
    expect(setup).toMatchObject({ splitVersion: 1, pickupText: "Otro texto" });
  });

  it("con pedidos esperando el pago, el reparto no cambia", async () => {
    setup = existente();
    db.culturalSaleOrder.count.mockResolvedValue(1);
    expect(await guardarVenta("a1", formulario({ organizacion: "35", fotografo: "50" }))).toEqual({ ok: false, errores: ["Hay ventas esperando el pago: probá en unos minutos."] });
    expect(setup).toMatchObject({ organizerBps: 2500, splitVersion: 1 });
  });
});

describe("cambiarEstadoDeVenta", () => {
  it("abrir sin la cuenta de cobro activa (modo prueba) → manda a Cobros", async () => {
    setup = existente();
    cuenta = { consentStatus: "PENDING" };
    expect(await cambiarEstadoDeVenta("a1", "OPEN")).toEqual({ ok: false, errores: ["Primero conectá tu Mercado Pago en Cobros."] });
    expect(setup!.status).toBe("DRAFT");
  });

  it("con la venta apagada en la plataforma se puede abrir igual", async () => {
    cfg.modo = "OFF";
    setup = existente();
    cuenta = null;
    expect(await cambiarEstadoDeVenta("a1", "OPEN")).toEqual({ ok: true });
    expect(setup!.status).toBe("OPEN");
  });

  it("abre con la cuenta activa y anota cuándo", async () => {
    setup = existente();
    expect(await cambiarEstadoDeVenta("a1", "OPEN")).toEqual({ ok: true });
    expect(setup).toMatchObject({ status: "OPEN" });
    expect(setup!.openedAt).toBeInstanceOf(Date);
  });

  it("una muestra cancelada no abre", async () => {
    setup = existente();
    muestra.isCancelled = true;
    expect(await cambiarEstadoDeVenta("a1", "OPEN")).toEqual({ ok: false, errores: ["La muestra está cancelada: no se puede vender."] });
  });

  it("una muestra que cerró hace más de 30 días no abre", async () => {
    setup = existente();
    muestra.endsAt = new Date(Date.now() - 31 * 86_400_000);
    const r = await cambiarEstadoDeVenta("a1", "OPEN");
    expect(r.ok).toBe(false);
  });

  it("sin reparto guardado no abre", async () => {
    expect(await cambiarEstadoDeVenta("a1", "OPEN")).toEqual({ ok: false, errores: ["Primero guardá el reparto y la entrega."] });
  });

  it("pausar una abierta", async () => {
    setup = existente({ status: "OPEN" });
    expect(await cambiarEstadoDeVenta("a1", "PAUSED")).toEqual({ ok: true });
    expect(setup!.status).toBe("PAUSED");
  });

  it("la coorganización no abre ni pausa", async () => {
    usuarioActual.valor = coorg;
    setup = existente();
    expect(await cambiarEstadoDeVenta("a1", "OPEN")).toEqual({ ok: false, errores: ["La muestra no existe."] });
  });
});

describe("cambiarQuienCobra", () => {
  it("el dueño pasa el cobro a alguien de la coorganización", async () => {
    setup = existente();
    expect(await cambiarQuienCobra("a1", 8)).toEqual({ ok: true });
    expect(setup!.organizerUserId).toBe(8);
  });

  it("no a alguien que no está en el equipo", async () => {
    setup = existente();
    db.culturalActivityMember.count.mockResolvedValue(0);
    expect(await cambiarQuienCobra("a1", 99)).toEqual({ ok: false, errores: ["Sólo puede cobrar quien organiza o alguien de la coorganización."] });
  });

  it("con pedidos esperando el pago no cambia", async () => {
    setup = existente();
    db.culturalSaleOrder.count.mockResolvedValue(2);
    expect(await cambiarQuienCobra("a1", 8)).toEqual({ ok: false, errores: ["Hay ventas esperando el pago: probá en unos minutos."] });
    expect(setup!.organizerUserId).toBe(7);
  });

  it("la coorganización no puede", async () => {
    usuarioActual.valor = coorg;
    setup = existente();
    expect(await cambiarQuienCobra("a1", 8)).toEqual({ ok: false, errores: ["La muestra no existe."] });
  });
});
