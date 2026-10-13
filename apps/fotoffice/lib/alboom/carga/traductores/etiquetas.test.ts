import { describe, expect, it } from "vitest";
import { MOTIVOS } from "../campos";
import { ETIQUETA, crudo } from "../ejemplos-alboom";
import { registrarEtiqueta, traducirEtiqueta, type CtxEtiquetas } from "./etiquetas";

const ctx = (): CtxEtiquetas => ({ etiquetas: [{ id: "t1", nameKey: "boda 2026" }], mapa: new Map() });

describe("etiquetas de contactos", () => {
  it("crea las nuevas con su nameKey y vincula las existentes (sin duplicar)", () => {
    expect(traducirEtiqueta(crudo("etiquetas", "contacts/1", ETIQUETA), ctx())).toMatchObject({ accion: "CREAR", datos: { name: "VIP", nameKey: "vip" } });
    expect(traducirEtiqueta(crudo("etiquetas", "contacts/2", { name: "Boda  2026" }), ctx())).toMatchObject({ accion: "IGUAL", targetId: "t1", vincula: true });
    const c = ctx();
    registrarEtiqueta(c, traducirEtiqueta(crudo("etiquetas", "contacts/1", ETIQUETA), c), "t2");
    expect(traducirEtiqueta(crudo("etiquetas", "contacts/3", { tag: "vip" }), c)).toMatchObject({ accion: "IGUAL", targetId: "t2" });
  });
  it("las de oportunidades quedan para 8B-2; largas o vacías se omiten", () => {
    expect(traducirEtiqueta(crudo("etiquetas", "leads/1", ETIQUETA), ctx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.etiquetaDeOportunidad });
    expect(traducirEtiqueta(crudo("etiquetas", "contacts/9", { tag: "x".repeat(41) }), ctx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.etiquetaLarga });
    expect(traducirEtiqueta(crudo("etiquetas", "contacts/8", {}), ctx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.sinNombre });
  });
});
