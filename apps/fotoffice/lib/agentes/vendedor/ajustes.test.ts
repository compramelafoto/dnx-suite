import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const A = await import("./ajustes");

const AHORA = new Date("2026-11-20T15:00:00.000Z");

beforeEach(() => B.vaciar());

describe("ajustes y tope del Vendedor", () => {
  it("sin fila arranca en pausa con tope 30", async () => {
    const a = await A.leerAjustesVendedor();
    expect(a.pausado).toBe(true);
    expect(a.topeClaudeUsd).toBe(30);
    expect(a).toEqual(A.AJUSTES_VENDEDOR_POR_OMISION);
  });

  it("frena en USD 28 con tope 30", async () => {
    await A.anotarGasto({ usd: 27.99, motivo: "MODELO" });
    expect(await A.puedeGastar(AHORA)).toEqual({ ok: true });
    await A.anotarGasto({ usd: 0.01, motivo: "CORREO" });
    expect(await A.puedeGastar(AHORA)).toEqual({ ok: false, motivo: "TOPE" });
  });

  it("el gasto cuenta en el mes argentino", async () => {
    B.agregar("dnxVendedorGasto", { usdMicros: 5_000_000, motivo: "MODELO", creadoEn: new Date("2026-12-01T02:30:00.000Z") });
    expect(await A.gastoDelMesVendedor(new Date("2026-11-20T15:00:00.000Z"))).toBe(5);
    expect(await A.gastoDelMesVendedor(new Date("2026-12-01T03:00:00.000Z"))).toBe(0);
  });

  it("no crea fila si el gasto es 0", async () => {
    await A.anotarGasto({ usd: 0, motivo: "MODELO" });
    expect(B.datos.dnxVendedorGasto ?? []).toHaveLength(0);
  });

  it("un campo inválido no pisa los demás", async () => {
    B.agregar("systemSettings", { key: A.CLAVE_AJUSTES_VENDEDOR, value: JSON.stringify({ pausado: false, topeClaudeUsd: "x" }) });
    const a = await A.leerAjustesVendedor();
    expect(a.pausado).toBe(false);
    expect(a.topeClaudeUsd).toBe(30);
  });

  it("guardar mezcla con lo actual", async () => {
    await A.guardarAjustesVendedor({ pausado: false, arrancoEn: "2026-11-10" });
    await A.guardarAjustesVendedor({ correosPorDia: 15 });
    const a = await A.leerAjustesVendedor();
    expect(a).toMatchObject({ pausado: false, arrancoEn: "2026-11-10", correosPorDia: 15 });
  });

  it("un arrancoEn que no es una fecha AAAA-MM-DD se ignora y guardarlo lanza", async () => {
    B.agregar("systemSettings", { key: A.CLAVE_AJUSTES_VENDEDOR, value: JSON.stringify({ pausado: false, arrancoEn: "ayer" }) });
    expect((await A.leerAjustesVendedor()).arrancoEn).toBeNull();
    await expect(A.guardarAjustesVendedor({ arrancoEn: "10/11/2026" })).rejects.toThrow();
  });

  it("guardar no pisa una pausa por salud escrita entre la lectura y la escritura", async () => {
    await A.guardarAjustesVendedor({ pausado: false });
    const fila = B.datos.systemSettings.find((f) => f.key === A.CLAVE_AJUSTES_VENDEDOR)!;
    const original = B.tablas.systemSettings.updateMany;
    let primera = true;
    B.tablas.systemSettings.updateMany = async (a: Parameters<typeof original>[0]) => {
      if (primera) {
        primera = false;
        // Otra escritura (el webhook frena por salud) gana justo antes que esta.
        fila.value = JSON.stringify({ ...JSON.parse(fila.value as string), pausado: true, pausadoPor: "SALUD" });
      }
      return original(a);
    };
    try {
      await A.guardarAjustesVendedor({ consultaClfDia: "2026-11-20" });
    } finally {
      B.tablas.systemSettings.updateMany = original;
    }
    expect(await A.leerAjustesVendedor()).toMatchObject({ pausado: true, pausadoPor: "SALUD", consultaClfDia: "2026-11-20" });
  });
});
