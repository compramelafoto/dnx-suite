import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const G = await import("./gasto");

const AHORA = new Date("2026-11-08T15:00:00.000Z");
const TAREA_BASE = { regionId: "r", provincia: "Santa Fe", tipo: "FOTOGRAFO", fuente: "GOOGLE", prioridad: 1, estado: "HECHA" };

async function tarea(extra: Record<string, unknown>) {
  await B.prisma.dnxBuscadorTarea.create({ data: { ...TAREA_BASE, hechaEn: new Date("2026-11-03T12:00:00.000Z"), ...extra } });
}

beforeEach(() => B.vaciar());

describe("puedeUsar", () => {
  it("Google frena al llegar a USD 18 con tope 20", async () => {
    await tarea({ costoGoogleUsdMicros: 17_990_000 });
    expect(await G.puedeUsar("GOOGLE", AHORA)).toEqual({ ok: true });
    await tarea({ costoGoogleUsdMicros: 10_000 });
    expect(await G.puedeUsar("GOOGLE", AHORA)).toEqual({ ok: false, motivo: "TOPE" });
  });

  it("Claude frena en USD 28 con tope 30", async () => {
    await tarea({ costoClaudeUsdMicros: 27_990_000 });
    expect((await G.puedeUsar("CLAUDE", AHORA)).ok).toBe(true);
    await tarea({ costoClaudeUsdMicros: 10_000 });
    expect(await G.puedeUsar("CLAUDE", AHORA)).toEqual({ ok: false, motivo: "TOPE" });
  });

  it("pausado frena las dos fuentes", async () => {
    await G.guardarAjustes({ pausado: true });
    expect(await G.puedeUsar("GOOGLE", AHORA)).toEqual({ ok: false, motivo: "PAUSADO" });
    expect(await G.puedeUsar("CLAUDE", AHORA)).toEqual({ ok: false, motivo: "PAUSADO" });
  });

  it("un tope editado se respeta", async () => {
    await G.guardarAjustes({ topeGoogleUsd: 50 });
    await tarea({ costoGoogleUsdMicros: 30_000_000 });
    expect((await G.puedeUsar("GOOGLE", AHORA)).ok).toBe(true);
  });
});

describe("gastoDelMes", () => {
  it("el mes cambia en hora argentina", async () => {
    // 01/12 02:30 UTC = 30/11 23:30 en Argentina: cuenta en noviembre.
    await tarea({ costoGoogleUsdMicros: 5_000_000, hechaEn: new Date("2026-12-01T02:30:00.000Z") });
    const nov = await G.gastoDelMes(new Date("2026-12-01T02:45:00.000Z"));
    expect(nov.googleUsd).toBe(5);
    // 01/12 03:00 UTC = 00:00 argentino de diciembre: empieza de cero.
    const dic = await G.gastoDelMes(new Date("2026-12-01T03:00:00.000Z"));
    expect(dic).toEqual({ googleUsd: 0, claudeUsd: 0, llamadasPorSku: {} });
  });

  it("suma costos y llamadas por SKU, ignorando tareas de otro mes", async () => {
    await tarea({ costoGoogleUsdMicros: 1_500_000, costoClaudeUsdMicros: 500_000, resultado: { llamadas: { A: 2, B: 1 } } });
    await tarea({ costoGoogleUsdMicros: 500_000, resultado: { llamadas: { A: 3 } } });
    await tarea({ costoGoogleUsdMicros: 9_000_000, hechaEn: new Date("2026-10-30T12:00:00.000Z"), resultado: { llamadas: { A: 99 } } });
    expect(await G.gastoDelMes(AHORA)).toEqual({ googleUsd: 2, claudeUsd: 0.5, llamadasPorSku: { A: 5, B: 1 } });
  });
});

describe("costoLlamadaPlaces", () => {
  const precios = { X: { usdPorMil: 32, gratisPorMes: 1000 } };
  it("las llamadas dentro del uso gratis cuestan 0", () => {
    expect(G.costoLlamadaPlaces("X", 999, precios)).toBe(0);
    expect(G.costoLlamadaPlaces("X", 1000, precios)).toBeCloseTo(0.032);
  });
  it("un SKU desconocido se cobra al precio más alto, sin gratis", () => {
    expect(G.costoLlamadaPlaces("NO_EXISTE", 0, precios)).toBeCloseTo(0.032);
  });
});

describe("ajustes", () => {
  it("por omisión y ante basura", async () => {
    expect(await G.leerAjustes()).toEqual({ topeGoogleUsd: 20, topeClaudeUsd: 30, pausado: false, avisoTope: {} });
    await B.prisma.systemSettings.create({ data: { key: "fotoffice_buscador_ajustes", value: "{basura", description: "x" } });
    expect((await G.leerAjustes()).topeGoogleUsd).toBe(20);
  });
  it("guarda y mezcla parcialmente", async () => {
    await G.guardarAjustes({ topeClaudeUsd: 10 });
    await G.guardarAjustes({ avisoTope: { GOOGLE: "2026-11" } });
    expect(await G.leerAjustes()).toEqual({ topeGoogleUsd: 20, topeClaudeUsd: 10, pausado: false, avisoTope: { GOOGLE: "2026-11" } });
  });
  it("un campo inválido no tira los demás: pausado sigue pausado", async () => {
    await B.prisma.systemSettings.create({
      data: { key: "fotoffice_buscador_ajustes", description: "x", value: JSON.stringify({ topeGoogleUsd: -5, pausado: true, avisoTope: { GOOGLE: "2026-11" } }) },
    });
    expect(await G.leerAjustes()).toEqual({ topeGoogleUsd: 20, topeClaudeUsd: 30, pausado: true, avisoTope: { GOOGLE: "2026-11" } });
  });
  it("guardar un tope inválido lanza", async () => {
    await expect(G.guardarAjustes({ topeGoogleUsd: -1 })).rejects.toThrow();
  });
  it("avisoTope se mezcla por fuente", async () => {
    await G.guardarAjustes({ avisoTope: { GOOGLE: "2026-11" } });
    await G.guardarAjustes({ avisoTope: { CLAUDE: "2026-11" } });
    expect((await G.leerAjustes()).avisoTope).toEqual({ GOOGLE: "2026-11", CLAUDE: "2026-11" });
  });
});

describe("gasto de tareas devueltas", () => {
  it("una tarea PENDIENTE con tomadaEn del mes y sin hechaEn suma su costo", async () => {
    await tarea({ estado: "PENDIENTE", hechaEn: null, tomadaEn: new Date("2026-11-05T12:00:00.000Z"), costoClaudeUsdMicros: 5_000_000 });
    await tarea({ estado: "PENDIENTE", hechaEn: null, tomadaEn: new Date("2026-10-05T12:00:00.000Z"), costoClaudeUsdMicros: 7_000_000 });
    expect((await G.gastoDelMes(AHORA)).claudeUsd).toBe(5);
  });
});
