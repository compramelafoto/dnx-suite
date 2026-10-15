/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctxDePrueba } from "./ctx-prueba";

const M = vi.hoisted(() => {
  const prisma = {
    fotofficeInformesAjustes: {
      findUnique: vi.fn(async (_a?: unknown): Promise<unknown> => null),
      upsert: vi.fn(async (_a?: any): Promise<unknown> => ({ id: "x" })),
      updateMany: vi.fn(async (_a?: any): Promise<unknown> => ({ count: 1 })),
    },
  };
  return { prisma };
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: M.prisma, Prisma: {} }));

const { leerAjustesInformes, guardarAjustesInformes, AJUSTES_INFORMES_DE_FABRICA } = await import("./ajustes");
const duenio = ctxDePrueba("w1");

beforeEach(() => {
  vi.clearAllMocks();
  M.prisma.fotofficeInformesAjustes.upsert.mockResolvedValue({ id: "x" });
});

describe("leerAjustesInformes", () => {
  it("sin fila devuelve los valores de fábrica", async () => {
    M.prisma.fotofficeInformesAjustes.findUnique.mockResolvedValue(null);
    expect(await leerAjustesInformes("w1")).toEqual({ minBalanceCentavos: null, monotributoCategory: null, monotributoCapCentavos: null, monotributoWarnPct: 80 });
    expect(M.prisma.fotofficeInformesAjustes.findUnique.mock.calls[0][0]).toMatchObject({ where: { workspaceId: "w1" } });
  });
  it("con fila convierte los importes a centavos", async () => {
    M.prisma.fotofficeInformesAjustes.findUnique.mockResolvedValue({
      minBalanceArs: { toString: () => "1500.50" }, monotributoCategory: "D", monotributoCapArs: { toString: () => "9000000.00" }, monotributoWarnPct: 90,
    });
    expect(await leerAjustesInformes("w1")).toEqual({ minBalanceCentavos: 150050, monotributoCategory: "D", monotributoCapCentavos: 900000000, monotributoWarnPct: 90 });
  });
});

describe("guardarAjustesInformes", () => {
  it("guarda con upsert por workspace, en centavos exactos", async () => {
    const r = await guardarAjustesInformes(duenio, { minBalanceArs: "1.500,50", monotributoCategory: " C ", monotributoCapArs: 8000000.1, monotributoWarnPct: "85" });
    expect(r).toEqual({ ok: true });
    expect(M.prisma.fotofficeInformesAjustes.upsert.mock.calls[0][0]).toMatchObject({
      where: { workspaceId: "w1" },
      create: { workspaceId: "w1", minBalanceArs: "1500.50", monotributoCategory: "C", monotributoCapArs: "8000000.10", monotributoWarnPct: 85 },
      update: { minBalanceArs: "1500.50", monotributoCategory: "C", monotributoCapArs: "8000000.10", monotributoWarnPct: 85 },
    });
  });

  it("lo vacío queda sin configurar y el aviso por omisión es 80", async () => {
    await guardarAjustesInformes(duenio, { minBalanceArs: "", monotributoCategory: "  ", monotributoCapArs: null });
    expect(M.prisma.fotofficeInformesAjustes.upsert.mock.calls[0][0].update).toEqual({ minBalanceArs: null, monotributoCategory: null, monotributoCapArs: null, monotributoWarnPct: 80 });
  });

  it("un mínimo de cero es válido", async () => {
    expect(await guardarAjustesInformes(duenio, { minBalanceArs: "0" })).toEqual({ ok: true });
  });

  it.each([
    [{ minBalanceArs: "-5" }, /saldo mínimo/],
    [{ minBalanceArs: "abc" }, /saldo mínimo/],
    [{ minBalanceArs: -1 }, /saldo mínimo/],
    [{ monotributoCapArs: "0" }, /tope anual/],
    [{ monotributoCapArs: "-10" }, /tope anual/],
    [{ monotributoCapArs: {} }, /tope anual/],
    [{ monotributoWarnPct: 49 }, /entre 50 y 99/],
    [{ monotributoWarnPct: 100 }, /entre 50 y 99/],
    [{ monotributoWarnPct: 80.5 }, /entre 50 y 99/],
    [{ monotributoWarnPct: "" }, /entre 50 y 99/],
    [{ monotributoCategory: "x".repeat(21) }, /hasta 20/],
    [{ monotributoCategory: 5 }, /hasta 20/],
  ])("rechaza %j", async (datos, mensaje) => {
    const r = await guardarAjustesInformes(duenio, datos);
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toMatch(mensaje);
    expect((r as { error: string }).error).not.toMatch(/plata/i);
    expect(M.prisma.fotofficeInformesAjustes.upsert).not.toHaveBeenCalled();
  });

  it("acepta 50, 99 y 20 caracteres", async () => {
    expect(await guardarAjustesInformes(duenio, { monotributoWarnPct: 50, monotributoCategory: "x".repeat(20) })).toEqual({ ok: true });
    expect(await guardarAjustesInformes(duenio, { monotributoWarnPct: 99 })).toEqual({ ok: true });
  });

  it("sin configurar no guarda (aunque pueda ver dinero)", async () => {
    const verDinero = ctxDePrueba("w1", "STAFF", { reports: "VIEW" });
    const r = await guardarAjustesInformes(verDinero, { monotributoWarnPct: 80 });
    expect(r).toMatchObject({ ok: false });
    expect(M.prisma.fotofficeInformesAjustes.upsert).not.toHaveBeenCalled();
  });

  it("datos que no son un objeto", async () => {
    expect(await guardarAjustesInformes(duenio, null)).toMatchObject({ ok: false });
    expect(await guardarAjustesInformes(duenio, [])).toMatchObject({ ok: false });
  });

  it("si dos pestañas crean a la vez, gana la última", async () => {
    M.prisma.fotofficeInformesAjustes.upsert.mockRejectedValueOnce({ code: "P2002" });
    expect(await guardarAjustesInformes(duenio, {})).toEqual({ ok: true });
    expect(M.prisma.fotofficeInformesAjustes.updateMany.mock.calls[0][0]).toMatchObject({ where: { workspaceId: "w1" } });
  });

  it("un fallo de la base devuelve un mensaje sin detalles", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    M.prisma.fotofficeInformesAjustes.upsert.mockRejectedValueOnce(new Error("boom"));
    expect(await guardarAjustesInformes(duenio, {})).toEqual({ ok: false, error: "No se pudo guardar. Probá de nuevo." });
    espia.mockRestore();
  });

  it("los valores de fábrica son los de la spec", () => {
    expect(AJUSTES_INFORMES_DE_FABRICA.monotributoWarnPct).toBe(80);
  });
});
