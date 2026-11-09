import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const C = await import("./consultas");
const { CIUDADES } = await import("./ciudades");
const { NICHOS } = await import("./tipos");

type Tarea = {
  region: string; provincia: string; ciudad: string | null; tipo: string; nicho: string | null;
  fuente: string; consulta: string; paginas: number; prioridad: number;
};
const tareas = async () => B.datos.dnxBuscadorTarea as unknown as Tarea[];

beforeEach(() => B.vaciar());

describe("generarTareas", () => {
  it("genera tareas de Places por ciudad y de web por provincia", async () => {
    const provincias = CIUDADES.CENTRO;
    const ciudades = provincias.reduce((n, p) => n + p.ciudades.length, 0);
    // Places: tipos con frase (sin fotógrafo ni OTRO) + un nicho por cada nicho con frase.
    const tiposPlaces = Object.entries(C.FRASES).filter(([t, f]) => t !== "FOTOGRAFO" && f.length > 0).length;
    const nichosPlaces = NICHOS.filter((n) => C.FRASES_NICHO[n].length > 0).length;
    const esperadasPlaces = ciudades * (tiposPlaces + nichosPlaces);
    // Web: por provincia, los tipos web (el fotógrafo se abre por nicho).
    const esperadasWeb = provincias.length * (C.TIPOS_WEB.length - 1 + nichosPlaces);

    const r = await C.generarTareas("CENTRO");
    const todas = await tareas();
    expect(r.creadas).toBe(esperadasPlaces + esperadasWeb);
    expect(todas.filter((t) => t.fuente === "GOOGLE_PLACES")).toHaveLength(esperadasPlaces);
    expect(todas.filter((t) => t.fuente === "WEB_SEARCH")).toHaveLength(esperadasWeb);
    expect(todas.filter((t) => t.fuente === "WEB_SEARCH").every((t) => t.ciudad === null)).toBe(true);
    const ros = todas.find((t) => t.ciudad === "Rosario" && t.nicho === "ESCOLAR");
    expect(ros?.consulta).toBe("fotógrafo escolar en Rosario, Santa Fe");
  });

  it("las ciudades grandes piden 3 páginas", async () => {
    await C.generarTareas("CENTRO");
    const todas = await tareas();
    const pag = (ciudad: string) => todas.filter((t) => t.ciudad === ciudad && t.fuente === "GOOGLE_PLACES").map((t) => t.paginas);
    expect(new Set(pag("Rosario"))).toEqual(new Set([3]));
    expect(new Set(pag("Funes"))).toEqual(new Set([1]));
  });

  it("escolar, turística y deportiva y sus contrapartes tienen prioridad 1", async () => {
    await C.generarTareas("CENTRO");
    const todas = await tareas();
    const prio = (f: (t: Tarea) => boolean) => new Set(todas.filter(f).map((t) => t.prioridad));
    for (const nicho of ["ESCOLAR", "TURISTICA", "DEPORTIVA"]) expect(prio((t) => t.nicho === nicho)).toEqual(new Set([1]));
    for (const tipo of ["ESCUELA", "EMPRESA_TURISMO", "CLUB"]) expect(prio((t) => t.tipo === tipo)).toEqual(new Set([1]));
    expect(prio((t) => t.nicho === "SOCIAL")).toEqual(new Set([2]));
    expect(prio((t) => t.tipo === "ASOCIACION_FOTOGRAFOS")).toEqual(new Set([2]));
  });

  it("generar dos veces no duplica", async () => {
    const primera = await C.generarTareas("CENTRO");
    const antes = (await tareas()).length;
    const segunda = await C.generarTareas("CENTRO");
    expect(primera.creadas).toBe(antes);
    expect(segunda.creadas).toBe(0);
    expect(await tareas()).toHaveLength(antes);
  });
});

describe("activarRegion", () => {
  it("activar una región deja las demás fuera de EN_CURSO", async () => {
    const t0 = new Date("2026-11-08T12:00:00.000Z");
    const t1 = new Date("2026-11-09T12:00:00.000Z");
    expect(await C.regionActual()).toBeNull();
    await C.activarRegion("CENTRO", t0);
    expect(await C.regionActual()).toBe("CENTRO");
    await C.activarRegion("CUYO", t1);
    expect(await C.regionActual()).toBe("CUYO");
    const regiones = B.datos.dnxBuscadorRegion as unknown as Array<{ region: string; estado: string; iniciadaEn: Date | null }>;
    expect(regiones.find((r) => r.region === "CENTRO")?.estado).toBe("EN_ESPERA");
    expect(regiones.find((r) => r.region === "CUYO")).toMatchObject({ estado: "EN_CURSO", iniciadaEn: t1 });
    expect((await tareas()).some((t) => t.region === "CUYO")).toBe(true);
  });
});
