import { describe, expect, it } from "vitest";
import { DUDAS, MOTIVOS } from "../campos";
import { ORIGEN, crudo, mapaDe } from "../ejemplos-alboom";
import { TIPO_ORIGEN, registrarOrigen, traducirOrigen, type CtxOrigenes } from "./origenes";

const ctx = (): CtxOrigenes => ({ origenes: [{ id: "o1", name: "Instagram" }], ordenBase: 8, mapa: new Map() });

describe("orígenes", () => {
  it("crea lo que no existe, al final de la lista", () => {
    const d = traducirOrigen(crudo("origenes", ORIGEN.name, ORIGEN), ctx());
    expect(d).toMatchObject({ accion: "CREAR", datos: { name: "Recomendado por un amigo/a", order: 9 } });
  });
  it("empareja por nombre sin mayúsculas ni acentos (no duplica)", () => {
    expect(traducirOrigen(crudo("origenes", "INSTAGRAM", { name: " INSTAGRAM ", posicion: 2 }), ctx())).toMatchObject({ accion: "IGUAL", targetId: "o1", vincula: true });
  });
  it("dos crudos con el mismo nombre en la misma corrida: el segundo se vincula al creado", () => {
    const c = ctx();
    const d1 = traducirOrigen(crudo("origenes", "Otros", { name: "Otros", posicion: 1 }), c);
    registrarOrigen(c, d1, "nuevo");
    expect(traducirOrigen(crudo("origenes", "otros", { name: "otros", posicion: 2 }), c)).toMatchObject({ accion: "IGUAL", targetId: "nuevo" });
  });
  it("sin nombre → OMITIR; nombre larguísimo → recortado con duda; ya cargado igual → IGUAL", () => {
    expect(traducirOrigen(crudo("origenes", "x", { name: "" }), ctx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.sinNombre });
    expect(traducirOrigen(crudo("origenes", "y", { name: "a".repeat(150) }), ctx()).dudas).toEqual([DUDAS.nombreLargo]);
    const c = crudo("origenes", "Instagram", { name: "Instagram", posicion: 1 });
    const x = ctx();
    x.mapa.set(c.alboomId, mapaDe(c, TIPO_ORIGEN, "o1"));
    expect(traducirOrigen(c, x)).toEqual({ accion: "IGUAL", targetId: "o1", escribirMapa: false });
  });
  it("si lo borraron en FOTOFFICE después de cargarlo, no se recrea", () => {
    const c = crudo("origenes", "Facebook", { name: "Facebook" });
    const x = ctx();
    x.mapa.set(c.alboomId, mapaDe(c, TIPO_ORIGEN, "borrado"));
    expect(traducirOrigen(c, x)).toEqual({ accion: "OMITIR", motivo: MOTIVOS.borradoEnFotoffice });
  });
});
