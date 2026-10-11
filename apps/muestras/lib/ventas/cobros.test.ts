import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalPayoutAccount: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  culturalSaleOrder: { count: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const mp = vi.hoisted(() => ({ invitarAReparto: vi.fn(), leerConsentimiento: vi.fn() }));
const cfg = vi.hoisted(() => ({ modo: "TEST" as string, ambienteCuenta: "SANDBOX" as "SANDBOX" | "PRODUCTION" }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./mp", () => mp);
vi.mock("./config", () => ({ leerConfigDeVentas: () => ({ modo: cfg.modo, ambienteCuenta: cfg.ambienteCuenta, motivo: null, faltan: [], probadores: new Set() }) }));

const { guardarCuentaDeCobro, verificarCuentaDeCobro } = await import("./cobros");
const { consentimientoVigente, cuentaDeCobro } = await import("./cuentas");
const { resetRateLimit } = await import("@/lib/limite");

const ana = { id: 50, esSuperAdmin: false, email: "ana@x.com", name: "Ana" };
const RECEPTOR = "0b6f3a3e-2f7e-4d8c-9a55-2f5c1f1e9a01";
let filas: Record<string, Record<string, unknown>>;
const clave = (userId: number, environment: string) => `${userId}:${environment}`;

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = ana;
  cfg.modo = "TEST";
  cfg.ambienteCuenta = "SANDBOX";
  filas = {};
  db.culturalPayoutAccount.findUnique.mockImplementation(async (q: { where: { userId_environment: { userId: number; environment: string } } }) =>
    filas[clave(q.where.userId_environment.userId, q.where.userId_environment.environment)] ?? null);
  db.culturalPayoutAccount.upsert.mockImplementation(async (q: { where: { userId_environment: { userId: number; environment: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
    const k = clave(q.where.userId_environment.userId, q.where.userId_environment.environment);
    filas[k] = filas[k] ? { ...filas[k], ...q.update } : { id: `pa${Object.keys(filas).length + 1}`, ...q.create };
    return filas[k];
  });
  db.culturalPayoutAccount.updateMany.mockImplementation(async (q: { where: { id: string }; data: Record<string, unknown> }) => {
    const k = Object.keys(filas).find((x) => filas[x]!.id === q.where.id);
    if (k) filas[k] = { ...filas[k], ...q.data };
    return { count: k ? 1 : 0 };
  });
  db.culturalPayoutAccount.findFirst.mockImplementation(async (q: { where: { environment: string; userId: { not: number }; OR: Record<string, unknown>[] } }) =>
    Object.values(filas).find((f) => f.environment === q.where.environment && f.userId !== q.where.userId.not && q.where.OR.some((c) => Object.entries(c).every(([k, v]) => f[k] === v))) ?? null);
  db.culturalSaleOrder.count.mockResolvedValue(0);
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => fn(db));
  db.$queryRaw.mockResolvedValue([]);
  mp.invitarAReparto.mockResolvedValue({ receiverId: RECEPTOR, status: "PENDING", inviteUrl: "https://www.mercadopago.com.ar/split-consent/abc" });
  mp.leerConsentimiento.mockResolvedValue({ receiverId: RECEPTOR, status: "ACTIVE", inviteUrl: null });
});

describe("guardarCuentaDeCobro", () => {
  it("sin sesión no hace nada", async () => {
    usuarioActual.valor = null;
    expect(await guardarCuentaDeCobro(fd({ email: "ana@x.com" }))).toEqual({ ok: false, errores: ["Tenés que ingresar."] });
    expect(mp.invitarAReparto).not.toHaveBeenCalled();
  });

  it("email inválido → mensaje, sin llamar a Mercado Pago", async () => {
    const r = await guardarCuentaDeCobro(fd({ email: "no-es-un-email" }));
    expect(r).toEqual({ ok: false, errores: ["Escribí el email de tu cuenta de Mercado Pago."] });
    expect(mp.invitarAReparto).not.toHaveBeenCalled();
  });

  it("invita y guarda la cuenta en minúsculas, por persona y ambiente", async () => {
    expect(await guardarCuentaDeCobro(fd({ email: "  Ana@MP.com " }))).toMatchObject({ ok: true, estado: "PENDING", aviso: expect.stringContaining("quedará a nombre de la cuenta de Mercado Pago de ana@mp.com") });
    expect(mp.invitarAReparto).toHaveBeenCalledWith("ana@mp.com");
    expect(filas[clave(50, "SANDBOX")]).toMatchObject({
      userId: 50, environment: "SANDBOX", mpEmail: "ana@mp.com", receiverId: RECEPTOR, consentStatus: "PENDING",
      inviteUrl: "https://www.mercadopago.com.ar/split-consent/abc",
    });
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it("aunque Mercado Pago ya lo dé por aceptado, queda pendiente hasta verificar (no revela qué emails aceptaron)", async () => {
    mp.invitarAReparto.mockResolvedValue({ receiverId: RECEPTOR, status: "ACTIVE", inviteUrl: null });
    expect(await guardarCuentaDeCobro(fd({ email: "ana@mp.com" }))).toMatchObject({ ok: true, estado: "PENDING" });
    expect(filas[clave(50, "SANDBOX")]).toMatchObject({ consentStatus: "PENDING", receiverId: RECEPTOR });
    expect(await verificarCuentaDeCobro()).toEqual({ ok: true, estado: "ACTIVE" });
  });

  it("el receptor (o el email) de otra persona no se toma: la fila queda sin receptor y la respuesta es la misma", async () => {
    filas[clave(60, "SANDBOX")] = { id: "pa9", userId: 60, environment: "SANDBOX", mpEmail: "beto@mp.com", receiverId: RECEPTOR, consentStatus: "ACTIVE" };
    mp.invitarAReparto.mockResolvedValue({ receiverId: RECEPTOR, status: "ACTIVE", inviteUrl: null });
    const r = await guardarCuentaDeCobro(fd({ email: "beto@mp.com" }));
    expect(r).toMatchObject({ ok: true, estado: "PENDING" });
    expect(filas[clave(50, "SANDBOX")]).toMatchObject({ mpEmail: "beto@mp.com", receiverId: null, consentStatus: "PENDING" });
    expect((await verificarCuentaDeCobro()).ok).toBe(false);
    expect(mp.leerConsentimiento).not.toHaveBeenCalled();
    expect(filas[clave(60, "SANDBOX")]).toMatchObject({ receiverId: RECEPTOR, consentStatus: "ACTIVE" });
  });

  it("un segundo pedido con el mismo email no duplica la fila (upsert)", async () => {
    await guardarCuentaDeCobro(fd({ email: "ana@mp.com" }));
    await guardarCuentaDeCobro(fd({ email: "ana@mp.com" }));
    expect(Object.keys(filas)).toEqual([clave(50, "SANDBOX")]);
    expect(db.culturalPayoutAccount.upsert).toHaveBeenCalledTimes(2);
  });

  it("si Mercado Pago no acepta, devuelve su mensaje y no guarda", async () => {
    mp.invitarAReparto.mockResolvedValue({ error: "Mercado Pago todavía no habilitó esta función." });
    expect(await guardarCuentaDeCobro(fd({ email: "ana@mp.com" }))).toEqual({ ok: false, errores: ["Mercado Pago todavía no habilitó esta función."] });
    expect(db.culturalPayoutAccount.upsert).not.toHaveBeenCalled();
  });

  it("cambiar el email con ventas esperando el pago donde cobra → frena", async () => {
    filas[clave(50, "SANDBOX")] = { id: "pa1", userId: 50, environment: "SANDBOX", mpEmail: "vieja@mp.com", receiverId: "r-viejo", consentStatus: "ACTIVE" };
    db.culturalSaleOrder.count.mockResolvedValue(1);
    expect(await guardarCuentaDeCobro(fd({ email: "nueva@mp.com" }))).toEqual({ ok: false, errores: ["Tenés ventas esperando el pago: probá en unos minutos."] });
    expect(mp.invitarAReparto).not.toHaveBeenCalled();
    expect(filas[clave(50, "SANDBOX")]!.mpEmail).toBe("vieja@mp.com");
  });

  it("frena después de muchos pedidos", async () => {
    for (let i = 0; i < 10; i++) await guardarCuentaDeCobro(fd({ email: "ana@mp.com" }));
    expect(await guardarCuentaDeCobro(fd({ email: "ana@mp.com" }))).toEqual({ ok: false, errores: ["Hiciste muchos pedidos seguidos. Esperá unos minutos."] });
  });
});

describe("verificarCuentaDeCobro", () => {
  it("pasa de PENDING a ACTIVE leyendo a Mercado Pago", async () => {
    filas[clave(50, "SANDBOX")] = { id: "pa1", userId: 50, environment: "SANDBOX", mpEmail: "ana@mp.com", receiverId: RECEPTOR, consentStatus: "PENDING", inviteUrl: "https://x" };
    expect(await verificarCuentaDeCobro()).toEqual({ ok: true, estado: "ACTIVE" });
    expect(mp.leerConsentimiento).toHaveBeenCalledWith(RECEPTOR);
    expect(filas[clave(50, "SANDBOX")]).toMatchObject({ consentStatus: "ACTIVE" });
  });

  it("sin cuenta → pide el email primero", async () => {
    expect(await verificarCuentaDeCobro()).toEqual({ ok: false, errores: ["Primero escribí el email de tu cuenta de Mercado Pago."] });
  });

  it("si Mercado Pago no responde, no cambia nada", async () => {
    filas[clave(50, "SANDBOX")] = { id: "pa1", userId: 50, environment: "SANDBOX", mpEmail: "ana@mp.com", receiverId: RECEPTOR, consentStatus: "PENDING" };
    mp.leerConsentimiento.mockResolvedValue(null);
    expect(await verificarCuentaDeCobro()).toEqual({ ok: false, errores: ["No pudimos consultar a Mercado Pago. Probá de nuevo en unos minutos."] });
    expect(filas[clave(50, "SANDBOX")]!.consentStatus).toBe("PENDING");
  });
});

describe("ambientes separados", () => {
  it("una cuenta de SANDBOX no sirve en PRODUCTION", async () => {
    filas[clave(50, "SANDBOX")] = { id: "pa1", userId: 50, environment: "SANDBOX", mpEmail: "ana@mp.com", receiverId: RECEPTOR, consentStatus: "ACTIVE", lastCheckedAt: new Date() };
    expect(await cuentaDeCobro(50, "PRODUCTION")).toBeNull();
    expect(await consentimientoVigente(50, "PRODUCTION")).toEqual({ status: "NONE", receiverId: null, verificado: true });
    expect((await cuentaDeCobro(50, "SANDBOX"))?.consentStatus).toBe("ACTIVE");
  });

  it("al guardar en producción, la fila es de PRODUCTION", async () => {
    cfg.ambienteCuenta = "PRODUCTION";
    cfg.modo = "OFF";
    await guardarCuentaDeCobro(fd({ email: "ana@mp.com" }));
    expect(Object.keys(filas)).toEqual([clave(50, "PRODUCTION")]);
  });
});

describe("consentimientoVigente", () => {
  const ahora = new Date("2026-11-14T15:00:00Z");
  it("no vuelve a preguntar si la lectura tiene menos de 10 minutos", async () => {
    filas[clave(50, "SANDBOX")] = { id: "pa1", userId: 50, environment: "SANDBOX", receiverId: RECEPTOR, consentStatus: "ACTIVE", lastCheckedAt: new Date(ahora.getTime() - 9 * 60_000) };
    expect(await consentimientoVigente(50, "SANDBOX", { ahora })).toEqual({ status: "ACTIVE", receiverId: RECEPTOR, verificado: true });
    expect(mp.leerConsentimiento).not.toHaveBeenCalled();
  });

  it("vuelve a leer a Mercado Pago si pasaron más de 10 minutos, y guarda lo que dice", async () => {
    filas[clave(50, "SANDBOX")] = { id: "pa1", userId: 50, environment: "SANDBOX", receiverId: RECEPTOR, consentStatus: "ACTIVE", lastCheckedAt: new Date(ahora.getTime() - 11 * 60_000) };
    mp.leerConsentimiento.mockResolvedValue({ receiverId: RECEPTOR, status: "CANCELED", inviteUrl: null });
    expect(await consentimientoVigente(50, "SANDBOX", { ahora })).toEqual({ status: "CANCELED", receiverId: RECEPTOR, verificado: true });
    expect(filas[clave(50, "SANDBOX")]).toMatchObject({ consentStatus: "CANCELED", lastCheckedAt: ahora });
  });

  it("si Mercado Pago no responde, devuelve lo guardado sin marcarlo como verificado", async () => {
    filas[clave(50, "SANDBOX")] = { id: "pa1", userId: 50, environment: "SANDBOX", receiverId: RECEPTOR, consentStatus: "ACTIVE", lastCheckedAt: null };
    mp.leerConsentimiento.mockResolvedValue(null);
    expect(await consentimientoVigente(50, "SANDBOX", { ahora })).toEqual({ status: "ACTIVE", receiverId: RECEPTOR, verificado: false });
  });
});
