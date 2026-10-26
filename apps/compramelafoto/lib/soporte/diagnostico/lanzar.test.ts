import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  after: vi.fn(), diag: vi.fn(), dFind: vi.fn(), dCreate: vi.fn(), dUpdMany: vi.fn(), dUpdate: vi.fn(),
  tFind: vi.fn(), conv: vi.fn(), msg: vi.fn(), usage: vi.fn(),
}));
vi.mock("next/server", async (orig) => ({ ...(await orig<object>()), after: (...a: unknown[]) => m.after(...a) }));
vi.mock("./diagnosticar", () => ({ diagnosticar: (...a: unknown[]) => m.diag(...a) }));
vi.mock("@/lib/bot/config", () => ({ BOT_PLATFORM: "CLF", readBotConfig: () => ({}) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    supportDiagnosis: { findUnique: (...a: unknown[]) => m.dFind(...a), create: (...a: unknown[]) => m.dCreate(...a), updateMany: (...a: unknown[]) => m.dUpdMany(...a), update: (...a: unknown[]) => m.dUpdate(...a) },
    supportTicket: { findUnique: (...a: unknown[]) => m.tFind(...a) },
    botConversation: { findFirst: (...a: unknown[]) => m.conv(...a) },
    supportMessage: { findFirst: (...a: unknown[]) => m.msg(...a) },
    botUsageDaily: { upsert: (...a: unknown[]) => m.usage(...a) },
  },
}));
import { lanzarDiagnostico, programarDiagnostico, puedeReclamar } from "./lanzar";

const now = new Date("2026-10-26T12:00:00Z");
const hace = (min: number) => new Date(now.getTime() - min * 60_000);
const listo = { estado: "LISTO", costMicroUsd: 40_000, mailSinVerificar: true, resultado: { categoria: "OPERATIVO", resumen: "r", hallazgos: "h", respuestaSugerida: "s", acciones: [], confianza: "MEDIA" } };

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  delete process.env.CLF_SUPPORT_DIAG_ENABLED;
  m.dFind.mockResolvedValue(null);
  m.dCreate.mockResolvedValue({});
  m.dUpdMany.mockResolvedValue({ count: 1 });
  m.tFind.mockResolvedValue({ id: 60, reason: "OTHER", description: "d", requesterRole: "CUSTOMER", requesterEmail: "a@x.com" });
  m.conv.mockResolvedValue({ id: "c1", audience: "BUYER", buyerEmail: "a@x.com", albumId: 3, orderId: null });
  m.msg.mockResolvedValue({ message: "Derivado por DNX Bot.\n\nUsuario: hola" });
});

describe("programarDiagnostico", () => {
  it("con el interruptor apagado no programa nada", () => {
    programarDiagnostico(60);
    expect(m.after).not.toHaveBeenCalled();
  });
  it("encendido, lo programa para después de responder", () => {
    process.env.CLF_SUPPORT_DIAG_ENABLED = "1";
    programarDiagnostico(60);
    expect(m.after).toHaveBeenCalledTimes(1);
  });
});

describe("puedeReclamar", () => {
  it("nadie lo está haciendo → sí; uno pendiente reciente → no; pendiente colgado → sí", () => {
    expect(puedeReclamar(null, now, false)).toBe(true);
    expect(puedeReclamar({ estado: "PENDIENTE", updatedAt: hace(5) }, now, false)).toBe(false);
    expect(puedeReclamar({ estado: "PENDIENTE", updatedAt: hace(11) }, now, false)).toBe(true);
  });
  it("uno listo sólo se rehace si se fuerza; fallas y falta de presupuesto se reintentan", () => {
    expect(puedeReclamar({ estado: "LISTO", updatedAt: hace(60) }, now, false)).toBe(false);
    expect(puedeReclamar({ estado: "LISTO", updatedAt: hace(60) }, now, true)).toBe(true);
    expect(puedeReclamar({ estado: "FALLO", updatedAt: hace(1) }, now, false)).toBe(true);
    expect(puedeReclamar({ estado: "SIN_PRESUPUESTO", updatedAt: hace(1) }, now, false)).toBe(true);
    expect(puedeReclamar({ estado: "PENDIENTE", updatedAt: hace(5) }, now, true)).toBe(false);
  });
});

describe("lanzarDiagnostico", () => {
  it("dos lanzamientos seguidos: el segundo no vuelve a diagnosticar", async () => {
    m.diag.mockResolvedValue(listo);
    m.dCreate.mockResolvedValueOnce({}).mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
    m.dFind.mockResolvedValueOnce(null).mockResolvedValueOnce({ estado: "PENDIENTE", updatedAt: new Date() });
    await lanzarDiagnostico(60);
    await lanzarDiagnostico(60);
    expect(m.diag).toHaveBeenCalledTimes(1);
  });

  it("guarda el resultado, suma un intento y registra el costo en el tope del bot", async () => {
    m.diag.mockResolvedValue(listo);
    await lanzarDiagnostico(60);
    expect(m.diag.mock.calls[0]![0]).toMatchObject({ id: 60, internalNote: "Derivado por DNX Bot.\n\nUsuario: hola", conversacion: { id: "c1" } });
    expect(m.dUpdate.mock.calls[0]![0]).toMatchObject({ where: { ticketId: 60 }, data: { estado: "LISTO", categoria: "OPERATIVO", mailSinVerificar: true, intentos: { increment: 1 }, costMicroUsd: { increment: 40_000 }, error: null } });
    expect(m.usage.mock.calls[0]![0].where.platform_day_actorKey).toMatchObject({ platform: "CLF", actorKey: "soporte:diagnostico" });
  });

  it("una falla queda guardada con el error; sin presupuesto no gasta un intento", async () => {
    m.diag.mockResolvedValueOnce({ estado: "FALLO", error: "JSON", costMicroUsd: 10 });
    await lanzarDiagnostico(60);
    expect(m.dUpdate.mock.calls[0]![0].data).toMatchObject({ estado: "FALLO", error: "JSON", intentos: { increment: 1 } });
    m.diag.mockResolvedValueOnce({ estado: "SIN_PRESUPUESTO", error: "tope", costMicroUsd: 0 });
    await lanzarDiagnostico(60);
    expect(m.dUpdate.mock.calls[1]![0].data).toMatchObject({ estado: "SIN_PRESUPUESTO", intentos: { increment: 0 } });
    expect(m.usage).toHaveBeenCalledTimes(1);
  });

  it("nunca lanza: si todo explota, deja el diagnóstico en FALLO", async () => {
    m.diag.mockRejectedValue(new Error("boom"));
    await expect(lanzarDiagnostico(60)).resolves.toBeUndefined();
    expect(m.dUpdate.mock.calls[0]![0].data).toMatchObject({ estado: "FALLO", error: "boom" });
  });
});
