import { describe, expect, it } from "vitest";
import { MOTIVOS } from "../campos";
import { EMBUDO, ETAPA_1, crudo, mapaDe } from "../ejemplos-alboom";
import { TIPO_ETAPA, claveNombre, traducirCircuito, traducirEtapa, type CtxCircuitos, type CtxEtapas } from "./circuitos";

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

describe("embudos, flujos y etapas: sólo se emparejan", () => {
  it("nombres normalizados con las erratas de Alboom corregidas", () => {
    expect(claveNombre("Recepción de la oportunidnad")).toBe(claveNombre("Recepción de la oportunidad"));
    expect(claveNombre("Impresion de Fotografías")).toBe(claveNombre("Impresión de Fotografías"));
    expect(claveNombre("WSP Recepción del Presupuesto")).toBe(claveNombre("WSP - Recepción del Presupuesto"));
  });

  it("empareja embudo con circuito de VENTA y flujo con TRABAJO; lo que no está se informa, no se crea", () => {
    expect(traducirCircuito(crudo("embudos", "1611", EMBUDO), circuitos)).toMatchObject({ accion: "IGUAL", targetId: "v1", vincula: true });
    expect(traducirCircuito(crudo("flujos_proyecto", "77", { id: "77", name: "Impresion de Fotografías" }), circuitos)).toMatchObject({ targetId: "t1" });
    expect(traducirCircuito(crudo("flujos_proyecto", "78", { id: "78", name: "Embudo de Ventas DNX 2022" }), circuitos)).toEqual({ accion: "OMITIR", motivo: MOTIVOS.sinCircuito });
    expect(traducirCircuito(crudo("embudos", "9", { id: "9", name: "Workshops" }), circuitos)).toEqual({ accion: "OMITIR", motivo: MOTIVOS.sinCircuito });
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
  });

  it("ya cargada con el mismo crudo → IGUAL sin escribir", () => {
    const c = crudo("etapas_embudo", "9001", ETAPA_1);
    const ctx = etapas();
    ctx.mapa.set("9001", mapaDe(c, TIPO_ETAPA, "s1"));
    expect(traducirEtapa(c, ctx)).toMatchObject({ accion: "IGUAL", targetId: "s1", escribirMapa: false });
  });
});
