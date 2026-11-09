import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const E = await import("./estado");
const { REGIONES } = await import("./tipos");

const AHORA = new Date("2026-11-08T15:00:00.000Z");

/** Las 6 regiones como las deja el SQL de alta (todas en espera, en el orden de `REGIONES`). */
function sembrarRegiones(estados: Partial<Record<string, string>> = {}) {
  REGIONES.forEach((region, i) => B.agregar("dnxBuscadorRegion", { region, orden: i + 1, estado: estados[region] ?? "EN_ESPERA" }));
}

let n = 0;
function tarea(region: string, estado: string, extra: Record<string, unknown> = {}) {
  // La ciudad distinta evita chocar con el único (region, provincia, ciudad, tipo, nicho, fuente).
  B.agregar("dnxBuscadorTarea", {
    region, provincia: "Santa Fe", ciudad: `ciudad-${n++}`, tipo: "FOTOGRAFO", fuente: "GOOGLE_PLACES",
    consulta: "x", prioridad: 1, estado, ...extra,
  });
}

const ordenActual = () =>
  [...(B.datos.dnxBuscadorRegion as Array<{ region: string; orden: number }>)].sort((a, b) => a.orden - b.orden).map((r) => r.region);

let claveOriginal: string | undefined;
beforeEach(() => {
  B.vaciar();
  claveOriginal = process.env.GOOGLE_PLACES_API_KEY;
});
afterEach(() => {
  if (claveOriginal === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY = claveOriginal;
});

describe("estadoBuscador", () => {
  it("cuenta hechas, total y fallidas por región", async () => {
    sembrarRegiones({ CENTRO: "EN_CURSO" });
    tarea("CENTRO", "HECHA", { hechaEn: AHORA, costoGoogleUsdMicros: 1_500_000 });
    tarea("CENTRO", "HECHA", { hechaEn: AHORA, costoClaudeUsdMicros: 250_000 });
    tarea("CENTRO", "SALTEADA");
    tarea("CENTRO", "FALLO");
    tarea("CENTRO", "PENDIENTE");
    tarea("CENTRO", "EN_CURSO");
    tarea("CUYO", "PENDIENTE");

    const e = await E.estadoBuscador(AHORA);
    expect(e.regiones.map((r) => r.region)).toEqual([...REGIONES]);
    const centro = e.regiones.find((r) => r.region === "CENTRO");
    expect(centro).toMatchObject({ nombre: "Centro", orden: 1, estado: "EN_CURSO", hechas: 3, total: 6, fallidas: 1 });
    expect(e.regiones.find((r) => r.region === "CUYO")).toMatchObject({ hechas: 0, total: 1, fallidas: 0 });
    expect(e.regiones.find((r) => r.region === "NOA")).toMatchObject({ hechas: 0, total: 0, fallidas: 0, estado: "EN_ESPERA" });
    expect(e.actual).toBe("CENTRO");
    expect(e.gasto).toEqual({ googleUsd: 1.5, claudeUsd: 0.25 });
    expect(e.ajustes.pausado).toBe(false);
  });

  it("sin clave de Google lo informa", async () => {
    sembrarRegiones();
    delete process.env.GOOGLE_PLACES_API_KEY;
    expect((await E.estadoBuscador(AHORA)).tieneClaveGoogle).toBe(false);
    process.env.GOOGLE_PLACES_API_KEY = "   ";
    expect((await E.estadoBuscador(AHORA)).tieneClaveGoogle).toBe(false);
    process.env.GOOGLE_PLACES_API_KEY = "clave-de-prueba";
    expect((await E.estadoBuscador(AHORA)).tieneClaveGoogle).toBe(true);
  });
});

describe("reordenarRegiones", () => {
  it("reordenar no mueve regiones completas", async () => {
    // CENTRO (1) y NOA (4) están completas: quedan en su lugar aunque el pedido las ponga en otro.
    sembrarRegiones({ CENTRO: "COMPLETA", NOA: "COMPLETA" });
    await E.reordenarRegiones(["PATAGONIA", "NOA", "NEA", "CENTRO", "CUYO", "BUENOS_AIRES_AMBA"]);
    expect(ordenActual()).toEqual(["CENTRO", "PATAGONIA", "NEA", "NOA", "CUYO", "BUENOS_AIRES_AMBA"]);
  });

  it("las que faltan en el pedido van al final, en su orden de antes", async () => {
    sembrarRegiones();
    await E.reordenarRegiones(["CUYO", "CENTRO"]);
    expect(ordenActual()).toEqual(["CUYO", "CENTRO", "BUENOS_AIRES_AMBA", "NOA", "NEA", "PATAGONIA"]);
  });

  it("rechaza regiones inexistentes o repetidas", async () => {
    sembrarRegiones();
    await expect(E.reordenarRegiones(["CENTRO", "MARTE" as never])).rejects.toThrow();
    await expect(E.reordenarRegiones(["CENTRO", "CENTRO"])).rejects.toThrow();
    expect(ordenActual()).toEqual([...REGIONES]);
  });
});
