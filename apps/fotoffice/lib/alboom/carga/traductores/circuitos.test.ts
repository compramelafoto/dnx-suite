import { describe, expect, it } from "vitest";
import { DUDAS, MOTIVOS } from "../campos";
import { EMBUDO, ETAPA_1, crudo, mapaDe } from "../ejemplos-alboom";
import { TIPO_CIRCUITO, TIPO_ETAPA, claveNombre, deducirEmbudos, fueCreado, huellasDeCreado, traducirCircuito, traducirEtapa, type CtxCircuitos, type CtxEtapas } from "./circuitos";

const circuitos: CtxCircuitos = {
  circuitos: [
    { id: "v1", name: "Embudo de Ventas DNX 2022", kind: "VENTA" },
    { id: "t1", name: "Impresión de Fotografías", kind: "TRABAJO" },
  ],
  mapa: new Map(),
};
const etapas = (): CtxEtapas => ({
  circuitoDe: new Map([["embudos/1611", "v1"]]),
  etapas: [
    { id: "s1", circuitId: "v1", name: "Recepción de la oportunidad" },
    { id: "s2", circuitId: "v1", name: "WSP - Recepción del Presupuesto" },
  ],
  mapa: new Map(),
});

/** Forma real de una etapa de DNX (extracción del 25/10/2026): sin el id del embudo. */
const ETAPA_REAL = { id: "1633", name: "Recepción de la oportunidnad", stage: "1", tasks: null, offset_days: "2" };

describe("embudos, flujos y etapas", () => {
  it("nombres normalizados con las erratas de Alboom corregidas", () => {
    expect(claveNombre("Recepción de la oportunidnad")).toBe(claveNombre("Recepción de la oportunidad"));
    expect(claveNombre("Impresion de Fotografías")).toBe(claveNombre("Impresión de Fotografías"));
    expect(claveNombre("WSP Recepción del Presupuesto")).toBe(claveNombre("WSP - Recepción del Presupuesto"));
  });

  it("empareja embudo con circuito de VENTA y flujo con TRABAJO; lo que no está se CREA inactivo (para que lo histórico tenga destino)", () => {
    expect(traducirCircuito(crudo("embudos", "1611", EMBUDO), circuitos)).toMatchObject({ accion: "IGUAL", targetId: "v1", vincula: true });
    expect(traducirCircuito(crudo("flujos_proyecto", "77", { id: "77", name: "Impresion de Fotografías" }), circuitos)).toMatchObject({ targetId: "t1" });
    const workshops = traducirCircuito(crudo("embudos", "9", { id: "9", name: "Workshops" }), circuitos);
    expect(workshops).toMatchObject({ accion: "CREAR", datos: { name: "Workshops", kind: "VENTA", isActive: false }, dudas: [DUDAS.circuitoCreado] });
    // El nombre es único por workspace: si lo usa uno de la otra clase, va con "(Alboom)".
    expect(traducirCircuito(crudo("flujos_proyecto", "78", { id: "78", name: "Embudo de Ventas DNX 2022" }), circuitos)).toMatchObject({
      accion: "CREAR",
      datos: { name: "Embudo de Ventas DNX 2022 (Alboom)", kind: "TRABAJO" },
    });
    // El embudo real 1611 sin equivalente en FOTOFFICE (simulación del 25/10/2026) también tiene destino.
    expect(traducirCircuito(crudo("embudos", "1611", EMBUDO), { circuitos: [], mapa: new Map() })).toMatchObject({ accion: "CREAR", datos: { name: EMBUDO.name } });
    // Ya creado: queda igual y conserva la marca de "creado por la carga".
    const c = crudo("embudos", "9", { id: "9", name: "Workshops" });
    const m = mapaDe(crudo("embudos", "9", { id: "9", name: "Workshop" }), TIPO_CIRCUITO, "nuevo", huellasDeCreado());
    expect(fueCreado(m)).toBe(true);
    expect(traducirCircuito(c, { circuitos: [{ id: "nuevo", name: "Workshop", kind: "VENTA" }], mapa: new Map([["9", m]]) })).toMatchObject({ accion: "IGUAL", targetId: "nuevo" });
  });

  it("etapa: por nombre dentro de su circuito, con la fila de posición para la 8B-2", () => {
    const d = traducirEtapa(crudo("etapas_embudo", "9001", ETAPA_1), etapas());
    expect(d).toMatchObject({ accion: "IGUAL", targetId: "s1", vincula: true, otrasClaves: [{ entity: "posicion_embudo", alboomId: "1611/1" }] });
    expect(traducirEtapa(crudo("etapas_embudo", "9002", { ...ETAPA_1, id: "9002", stage: "2", name: "WSP Recepción del Presupuesto" }), etapas())).toMatchObject({ targetId: "s2" });
  });

  it("etapa sin equivalente, de un circuito no emparejado o con forma rara → OMITIR", () => {
    expect(traducirEtapa(crudo("etapas_embudo", "9003", { ...ETAPA_1, name: "Cliente dudoso" }), etapas())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.sinEtapa });
    expect(traducirEtapa(crudo("etapas_embudo", "9004", { ...ETAPA_1, type_id: "999" }), etapas())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.circuitoSinCargar });
    expect(traducirEtapa(crudo("etapas_flujo", "9005", ETAPA_1), etapas())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.circuitoSinCargar });
    expect(traducirEtapa(crudo("etapas_embudo", "9006", { name: "x" }), etapas())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.formaDesconocida });
    // Forma real sin embudo y sin poder deducirlo → se pide volver a extraer.
    expect(traducirEtapa(crudo("etapas_embudo", "1633", ETAPA_REAL), etapas())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.etapaSinEmbudo });
  });

  it("ya cargada con el mismo crudo → IGUAL sin escribir", () => {
    const c = crudo("etapas_embudo", "9001", ETAPA_1);
    const ctx = etapas();
    ctx.mapa.set("9001", mapaDe(c, TIPO_ETAPA, "s1"));
    expect(traducirEtapa(c, ctx)).toMatchObject({ accion: "IGUAL", targetId: "s1", escribirMapa: false });
  });
});

describe("etapas con la forma real (sin embudo)", () => {
  const embudos = [
    { alboomId: "1611", payload: { id: "1611", name: "Embudo de Ventas DNX 2022" } },
    { alboomId: "1700", payload: { id: "1700", name: "Workshops", stage_count: "2" } },
  ];
  const etapasReales = [
    { alboomId: "1633", payload: ETAPA_REAL },
    { alboomId: "1634", payload: { id: "1634", name: "WSP Recepción del Presupuesto", stage: "2", tasks: null, offset_days: "1" } },
    { alboomId: "1640", payload: { id: "1640", name: "Inscripción", stage: "1", tasks: null, offset_days: "0" } },
    { alboomId: "1641", payload: { id: "1641", name: "Pago", stage: "2", tasks: null, offset_days: "0" } },
  ];

  it("deduce el embudo por el orden de los ids (cada vez que la posición vuelve a 1) y lo valida con stage_count", () => {
    const d = deducirEmbudos(etapasReales, embudos);
    expect(Object.fromEntries(d)).toEqual({ "1633": "1611", "1634": "1611", "1640": "1700", "1641": "1700" });
    // Si no cierra (otra cantidad de grupos, o stage_count distinto), no deduce nada.
    expect(deducirEmbudos(etapasReales, embudos.slice(0, 1)).size).toBe(0);
    expect(deducirEmbudos(etapasReales, [embudos[0]!, { alboomId: "1700", payload: { stage_count: "3" } }]).size).toBe(0);
    // Las que ya traen su embudo (extractor nuevo) no se deducen.
    expect(deducirEmbudos([{ alboomId: "1", payload: { ...ETAPA_REAL, type_id: "1611" } }], embudos).size).toBe(0);
  });

  it("la etapa real se ubica en su circuito con la duda; en un circuito creado por la carga se crea", () => {
    const ctx: CtxEtapas = { ...etapas(), deducido: new Map([["1633", "1611"]]) };
    expect(traducirEtapa(crudo("etapas_embudo", "1633", ETAPA_REAL), ctx)).toMatchObject({
      accion: "IGUAL",
      targetId: "s1",
      otrasClaves: [{ entity: "posicion_embudo", alboomId: "1611/1" }],
      dudas: [DUDAS.embudoDeducido],
    });
    // Con el extractor nuevo trae `type_id` y no hay duda.
    expect(traducirEtapa(crudo("etapas_embudo", "1633", { ...ETAPA_REAL, type_id: "1611" }), etapas()).dudas).toBeUndefined();
    // Circuito creado por la carga: la etapa que falta se crea con su orden y sus días.
    const creado: CtxEtapas = { circuitoDe: new Map([["embudos/1700", "nuevo"]]), creados: new Set(["nuevo"]), etapas: [], mapa: new Map(), deducido: new Map([["1641", "1700"]]) };
    expect(traducirEtapa(crudo("etapas_embudo", "1641", etapasReales[3]!.payload), creado)).toMatchObject({
      accion: "CREAR",
      datos: { circuitId: "nuevo", name: "Pago", order: 2, days: 0 },
      otrasClaves: [{ entity: "posicion_embudo", alboomId: "1700/2" }],
    });
    // En la simulación el circuito tiene id simulado: también se crea.
    expect(traducirEtapa(crudo("etapas_embudo", "1641", { ...etapasReales[3]!.payload, type_id: "1700" }), { ...creado, creados: new Set(), circuitoDe: new Map([["embudos/1700", "sim:embudos/1700"]]) }).accion).toBe("CREAR");
    // En un circuito que ya existía nunca se crean etapas.
    expect(traducirEtapa(crudo("etapas_embudo", "1642", { id: "1642", name: "Nueva", stage: "3", type_id: "1611" }), etapas())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.sinEtapa });
  });
});
