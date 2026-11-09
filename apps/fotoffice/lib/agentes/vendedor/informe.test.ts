import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null, DbNull: null } }));

const I = await import("./informe");
const { AJUSTES_VENDEDOR_POR_OMISION } = await import("./ajustes");

type Fila = Record<string, unknown>;
const ajustes = (o: Partial<typeof AJUSTES_VENDEDOR_POR_OMISION> = {}) => ({ ...AJUSTES_VENDEDOR_POR_OMISION, pausado: false, ...o });

/** Martes 10/11/2026 a las 19:00 argentinas. */
const A19 = new Date("2026-11-10T22:00:00.000Z");
const A1859 = new Date("2026-11-10T21:59:00.000Z");
/** Domingo 1/11/2026 a las 9:00 y a las 8:59 argentinas. */
const D1_9 = new Date("2026-11-01T12:00:00.000Z");
const D1_859 = new Date("2026-11-01T11:59:00.000Z");

let nHilo = 0;
function hilo(o: Fila = {}): string {
  const n = ++nHilo;
  return (B.agregar("dnxVendedorHilo", { contactoId: `c${n}`, grupo: "FOTOGRAFO:ESCOLAR", token: `t${n}`, estado: "ENVIADO", ...o }) as { id: string }).id;
}
function salida(hiloId: string | null, paso: string, creadoEn: Date, o: Fila = {}) {
  B.agregar("dnxVendedorCorreo", { hiloId, direccion: "SALIDA", paso, de: "d", para: "p", asunto: "a", texto: "t", creadoEn, ...o });
}
function entrada(hiloId: string, creadoEn: Date, clase: string | null = "INTERESADO") {
  B.agregar("dnxVendedorCorreo", { hiloId, direccion: "ENTRADA", paso: null, de: "p", para: "d", asunto: "a", texto: "t", creadoEn, clase });
}

type VentaClf = { userId: number; ventas: number; totalPesos: number };
function clfFalso(ventas: VentaClf[] | "caido") {
  const pedidos: Array<Record<string, unknown>> = [];
  const falso = (async (_u: string, init?: RequestInit) => {
    pedidos.push(JSON.parse(String(init?.body)));
    if (ventas === "caido") return new Response("{}", { status: 503 });
    return Response.json({ ventas });
  }) as unknown as typeof fetch;
  return { pedidos, deps: { fetch: falso, url: "https://clf.test", secreto: "s" } };
}

beforeEach(() => {
  B.vaciar();
  nHilo = 0;
});

describe("resumen diario", () => {
  it("el resumen sale a las 19, sólo con actividad y una vez por día", async () => {
    expect(I.tocaResumen(A1859, ajustes())).toBe(false);
    expect(I.tocaResumen(A19, ajustes())).toBe(true);
    expect(I.tocaResumen(A19, ajustes({ resumenDia: "2026-11-10" }))).toBe(false);
    expect(I.tocaResumen(A19, ajustes({ resumenDia: "2026-11-09" }))).toBe(true);

    // Sin actividad: nada.
    expect(await I.resumenDelDia(A19)).toBeNull();

    // Un hilo con dos salidas (primero y recordatorio) cuenta DOS correos: se cuentan filas, no hilos.
    const h = hilo();
    salida(h, "PRIMERO", new Date("2026-11-10T13:00:00Z"), { abiertoEn: new Date("2026-11-10T14:00:00Z") });
    salida(h, "RECORDATORIO", new Date("2026-11-10T14:00:00Z"));
    salida(hilo(), "RESPUESTA", new Date("2026-11-10T15:00:00Z"));
    // De ayer (antes de las 0:00 argentinas) y de otro día: no cuentan.
    salida(hilo(), "PRIMERO", new Date("2026-11-10T02:59:00Z"));
    // Entradas: dos del mismo hilo y una automática: contesta 1 hilo.
    entrada(h, new Date("2026-11-10T16:00:00Z"));
    entrada(h, new Date("2026-11-10T17:00:00Z"));
    entrada(hilo(), new Date("2026-11-10T17:00:00Z"), "AUTOMATICA");
    hilo({ registradoEn: new Date("2026-11-10T18:00:00Z") });
    B.agregar("dnxVendedorGasto", { usdMicros: 1_500_000, motivo: "CORREO", creadoEn: new Date("2026-11-10T13:00:00Z") });
    B.agregar("dnxVendedorGasto", { usdMicros: 2_000_000, motivo: "CORREO", creadoEn: new Date("2026-11-03T13:00:00Z") });
    B.agregar("dnxVendedorGasto", { usdMicros: 9_000_000, motivo: "CORREO", creadoEn: new Date("2026-10-31T13:00:00Z") });

    const t = (await I.resumenDelDia(A19)) as string;
    expect(t).toContain("📬 Vendedor: resumen de hoy");
    expect(t).toContain("Salieron 3 correos: 1 primero, 1 recordatorio, 1 respuesta");
    expect(t).toContain("Abiertos: 1");
    expect(t).toContain("Contestaron: 1");
    expect(t).toContain("Se registraron: 1");
    expect(t).toContain("Gasto de Claude: hoy USD 1,50 · del mes USD 3,50 de USD 30,00");
    expect(t).not.toContain("Esperan tu aprobación");
    expect(t).not.toMatch(/plata/i);
  });

  it("sólo con una apertura, una respuesta o un registro ya hay resumen", async () => {
    salida(hilo(), "PRIMERO", new Date("2026-11-08T13:00:00Z"), { abiertoEn: new Date("2026-11-10T14:00:00Z") });
    expect(await I.resumenDelDia(A19)).toContain("Abiertos: 1");
    B.vaciar();
    entrada(hilo(), new Date("2026-11-10T14:00:00Z"));
    expect(await I.resumenDelDia(A19)).toContain("Contestaron: 1");
    B.vaciar();
    hilo({ registradoEn: new Date("2026-11-10T14:00:00Z") });
    expect(await I.resumenDelDia(A19)).toContain("Se registraron: 1");
  });

  it("recuerda los modelos que esperan hace más de 48 h", async () => {
    B.agregar("dnxVendedorModelo", { grupo: "CLUB", estado: "PROPUESTO", asunto: "a", cuerpo: "c", indicaciones: "i", landing: "/l", creadoEn: new Date("2026-11-07T10:00:00Z") });
    B.agregar("dnxVendedorModelo", { grupo: "ESCUELA", estado: "PROPUESTO", asunto: "a", cuerpo: "c", indicaciones: "i", landing: "/l", creadoEn: new Date("2026-11-10T10:00:00Z") });
    B.agregar("dnxVendedorModelo", { grupo: "ORGANIZADOR_EVENTOS", estado: "APROBADO", asunto: "a", cuerpo: "c", indicaciones: "i", landing: "/l", creadoEn: new Date("2026-11-01T10:00:00Z") });
    // Sin otra actividad, un modelo viejo alcanza para que haya resumen.
    const t = (await I.resumenDelDia(A19)) as string;
    expect(t).toContain("Esperan tu aprobación: Clubes");
    expect(t).not.toContain("Escuelas");
    expect(t).not.toContain("Organizadores");
  });
});

describe("informe mensual", () => {
  it("el informe separa por grupo y suma las ventas de CLF por grupo", async () => {
    const mes = (d: number) => new Date(`2026-10-${String(d).padStart(2, "0")}T15:00:00Z`);
    const a = hilo({ grupo: "FOTOGRAFO:ESCOLAR", registradoEn: mes(5), usuarioClfId: 11 });
    const b = hilo({ grupo: "FOTOGRAFO:ESCOLAR", registradoEn: mes(6), usuarioClfId: 12 });
    const c = hilo({ grupo: "CLUB", registradoEn: new Date("2026-09-20T15:00:00Z"), usuarioClfId: 13 });
    const d = hilo({ grupo: "CLUB" });
    // Enviados: sólo PRIMERO del mes (dos filas del mismo hilo no se cuentan dos veces como PRIMERO: hay una).
    for (const h of [a, b]) salida(h, "PRIMERO", mes(2));
    salida(c, "PRIMERO", new Date("2026-09-10T15:00:00Z"));
    salida(d, "PRIMERO", mes(3));
    salida(d, "RECORDATORIO", mes(9));
    salida(a, "PRIMERO", new Date("2026-11-01T10:00:00Z"));
    // Respondieron: la primera entrada no automática cae en el mes (a: sí; b: automática; c: la primera fue en septiembre).
    entrada(a, mes(7));
    entrada(a, mes(8));
    entrada(b, mes(7), "AUTOMATICA");
    entrada(c, new Date("2026-09-25T15:00:00Z"));
    entrada(c, mes(10));
    B.agregar("dnxVendedorGasto", { usdMicros: 4_250_000, motivo: "CORREO", creadoEn: mes(12) });
    B.agregar("dnxVendedorGasto", { usdMicros: 7_000_000, motivo: "CORREO", creadoEn: new Date("2026-11-02T10:00:00Z") });
    const clf = clfFalso([
      { userId: 11, ventas: 3, totalPesos: 120_000 },
      { userId: 12, ventas: 0, totalPesos: 0 },
      { userId: 13, ventas: 2, totalPesos: 40_500 },
    ]);

    const i = await I.armarInforme("2026-10", { clf: clf.deps });
    expect(i.mes).toBe("2026-10");
    expect(i.ventasDisponibles).toBe(true);
    expect(i.gastoUsd).toBeCloseTo(4.25);
    const esc = i.porGrupo.find((g) => g.grupo === "FOTOGRAFO:ESCOLAR");
    const club = i.porGrupo.find((g) => g.grupo === "CLUB");
    expect(esc).toMatchObject({ enviados: 2, respondieron: 1, registros: 2, vendieron: 1, ventas: 3, totalPesos: 120_000 });
    expect(club).toMatchObject({ enviados: 1, respondieron: 0, registros: 0, vendieron: 1, ventas: 2, totalPesos: 40_500 });
    expect(i.total).toEqual({ enviados: 3, respondieron: 1, registros: 2, vendieron: 2, ventas: 5, totalPesos: 160_500 });
    // Los grupos sin actividad no figuran.
    expect(i.porGrupo.map((g) => g.grupo).sort()).toEqual(["CLUB", "FOTOGRAFO:ESCOLAR"]);
  });

  it("registrados antes del mes cuentan sus ventas del mes; los de después no se piden", async () => {
    hilo({ registradoEn: new Date("2026-09-01T15:00:00Z"), usuarioClfId: 1 });
    hilo({ registradoEn: new Date("2026-10-31T23:00:00Z"), usuarioClfId: 2 });
    // 1/11 0:00 argentinas = 03:00Z: es del mes siguiente, no se pide.
    hilo({ registradoEn: new Date("2026-11-01T03:00:00Z"), usuarioClfId: 3 });
    hilo({ registradoEn: new Date("2026-11-05T15:00:00Z"), usuarioClfId: 4 });
    hilo({ registradoEn: new Date("2026-09-01T15:00:00Z"), usuarioClfId: null });
    hilo({ registradoEn: null, usuarioClfId: 6 });
    const clf = clfFalso([]);
    await I.armarInforme("2026-10", { clf: clf.deps });
    expect(clf.pedidos).toHaveLength(1);
    expect(clf.pedidos[0]).toMatchObject({ consulta: "ventas", desde: "2026-10-01T03:00:00.000Z", hasta: "2026-11-01T03:00:00.000Z" });
    const usuarios = clf.pedidos[0].usuarios as Array<{ userId: number; registradoEn: string }>;
    expect(usuarios.map((u) => u.userId).sort()).toEqual([1, 2]);
    expect(usuarios.find((u) => u.userId === 1)?.registradoEn).toBe("2026-09-01T15:00:00.000Z");
  });

  it("dice mínimo comprobado, pesos en formato argentino y gasto en dólares", async () => {
    const fila = { enviados: 40, respondieron: 5, registros: 3, vendieron: 2, ventas: 9, totalPesos: 1_234_567 };
    const t = I.textoInforme({
      mes: "2026-10",
      porGrupo: [{ grupo: "FOTOGRAFO:ESCOLAR", ...fila }],
      total: fila,
      gastoUsd: 12.3,
      ventasDisponibles: true,
    });
    expect(t).toContain("📊 Vendedor: informe de octubre de 2026");
    expect(t).toContain("$ 1.234.567");
    expect(t).toContain("USD 12,30");
    expect(t).toContain("Ventas y registros: mínimo comprobado (alguien que se registró con otro correo y desde otro navegador no se cuenta).");
    expect(t).not.toContain("No pude traer");
    expect(t).not.toMatch(/plata/i);
    expect(I.pesos(999)).toBe("$ 999");
    expect(I.pesos(1000)).toBe("$ 1.000");
    expect(I.pesos(12_345_678)).toBe("$ 12.345.678");
  });

  it("el día 1 a las 9 sale el del mes anterior una sola vez", () => {
    expect(I.tocaInforme(D1_859, ajustes())).toBe(false);
    expect(I.tocaInforme(D1_9, ajustes())).toBe(true);
    expect(I.tocaInforme(D1_9, ajustes({ informeMes: "2026-10" }))).toBe(false);
    expect(I.tocaInforme(D1_9, ajustes({ informeMes: "2026-09" }))).toBe(true);
    // Otro día no.
    expect(I.tocaInforme(new Date("2026-11-02T15:00:00Z"), ajustes())).toBe(false);
    // El mes anterior de enero es diciembre del año anterior.
    expect(I.mesAnterior(new Date("2027-01-01T15:00:00Z"))).toBe("2026-12");
    expect(I.tocaInforme(new Date("2027-01-01T15:00:00Z"), ajustes({ informeMes: "2026-12" }))).toBe(false);
  });

  it("si CLF falla, el informe sale igual y lo dice", async () => {
    hilo({ registradoEn: new Date("2026-10-05T15:00:00Z"), usuarioClfId: 1 });
    const i = await I.armarInforme("2026-10", { clf: clfFalso("caido").deps });
    expect(i.ventasDisponibles).toBe(false);
    expect(i.total).toMatchObject({ registros: 1, vendieron: 0, ventas: 0, totalPesos: 0 });
    const t = I.textoInforme(i);
    expect(t).toContain("No pude traer las ventas de CLF: van en el próximo informe.");
    expect(t).not.toContain("vendieron");
    expect(t).not.toContain("$ 0");
    expect(t).toContain("mínimo comprobado");
  });

  it("guarda el informe por mes y los devuelve del más nuevo al más viejo", async () => {
    const f = { enviados: 1, respondieron: 0, registros: 0, vendieron: 0, ventas: 0, totalPesos: 0 };
    for (const mes of ["2026-09", "2026-11", "2026-10"]) await I.guardarInforme({ mes, porGrupo: [], total: f, gastoUsd: 1, ventasDisponibles: true });
    await I.guardarInforme({ mes: "2026-10", porGrupo: [], total: f, gastoUsd: 2, ventasDisponibles: true });
    expect((B.datos.systemSettings as Fila[]).map((s) => s.key).sort()).toEqual([
      "fotoffice_vendedor_informe_2026-09", "fotoffice_vendedor_informe_2026-10", "fotoffice_vendedor_informe_2026-11",
    ]);
    const todos = await I.informesGuardados();
    expect(todos.map((x) => x.mes)).toEqual(["2026-11", "2026-10", "2026-09"]);
    expect(todos[1].gastoUsd).toBe(2);
  });
});
