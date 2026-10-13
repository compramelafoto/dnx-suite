import { describe, expect, it } from "vitest";
import { DUDAS, MOTIVOS, huellasDe } from "../campos";
import { CATEGORIA_15, crudo, mapaDe } from "../ejemplos-alboom";
import { CATEGORIAS_DNX } from "@/lib/consultas/constantes";
import { TIPO_CATEGORIA, grupoPorNombre, traducirCategoria, unificarNombre, type CtxCategorias } from "./categorias";

const dnx = (): CtxCategorias => ({
  categorias: CATEGORIAS_DNX.map((c, i) => ({ id: `c${i}`, name: c.name, group: c.group })),
  ordenBase: 21,
  mapa: new Map(),
});
const cat = (id: string, payload: object) => crudo("categorias", `lead_type/${id}`, { id, type: "lead_type", active: "1", ...payload });

describe("categorías de consulta", () => {
  it("unifica los nombres en portugués", () => {
    expect(unificarNombre("15 anos")).toBe("Fiesta 15 Años");
    expect(unificarNombre("Casamento")).toBe("Boda");
    expect(unificarNombre("Ensaio")).toBe("Sesión de Fotos");
    expect(unificarNombre("Aniversário")).toBe("Cumpleaños");
    expect(unificarNombre("Família")).toBe("Familia");
    expect(unificarNombre("Pré Casamento")).toBe("Pre Boda");
    expect(unificarNombre("Graduación")).toBe("Graduación");
  });

  it("empareja con las 21 de DNX, también a través de la equivalencia del nombre unificado", () => {
    const ctx = dnx();
    const idDe = (name: string) => ctx.categorias.find((c) => c.name === name)!.id;
    expect(traducirCategoria(crudo("categorias", "lead_type/12", CATEGORIA_15), ctx)).toMatchObject({ accion: "IGUAL", targetId: idDe("Fotografía o Video de Cumpleaños de 15"), vincula: true });
    expect(traducirCategoria(cat("2", { name: "Casamento", subtype: "Boda" }), ctx)).toMatchObject({ accion: "IGUAL", targetId: idDe("Boda") });
    expect(traducirCategoria(cat("3", { name: "Ensaio" }), ctx)).toMatchObject({ targetId: idDe("Sesión de Fotos") });
    expect(traducirCategoria(cat("4", { name: "Aniversário" }), ctx)).toMatchObject({ targetId: idDe("Cumpleaños Infantiles/adultos") });
    expect(traducirCategoria(cat("5", { name: "bar mitzvá" }), ctx)).toMatchObject({ targetId: idDe("Bar Mitzvá.") });
  });

  it("crea lo que no existe con su grupo; sin grupo legible lo deduce del nombre (duda); inactiva → archivada", () => {
    const ctx = dnx();
    expect(traducirCategoria(cat("6", { name: "Família", subtype: "Trabajo sin fecha" }), ctx)).toMatchObject({
      accion: "CREAR",
      datos: { name: "Familia", group: "TRABAJO_SIN_FECHA", archivada: false, order: 42 },
    });
    expect(traducirCategoria(cat("7", { name: "Pré Casamento", subtype: "x" }), ctx)).toMatchObject({ accion: "CREAR", datos: { name: "Pre Boda", group: "BODA" }, dudas: [DUDAS.grupoDesconocido] });
    expect(traducirCategoria(cat("8", { name: "Mascotas", active: "0" }), ctx)).toMatchObject({ datos: { archivada: true, group: "TRABAJO_SIN_FECHA" } });
    expect(grupoPorNombre("Fiesta de egresados")).toBe("EVENTO");
  });

  it("no pisa el grupo de una existente; si Alboom dice otro, es conflicto", () => {
    const d = traducirCategoria(cat("2", { name: "Boda", subtype: "Evento" }), dnx());
    expect(d).toMatchObject({ accion: "IGUAL", conservados: ["group"] });
  });

  it("ya cargada: si Alboom cambió el grupo y nadie lo tocó en FOTOFFICE, se actualiza", () => {
    const ctx: CtxCategorias = { categorias: [{ id: "k", name: "Familia", group: "TRABAJO_SIN_FECHA" }], ordenBase: 1, mapa: new Map() };
    const antes = cat("6", { name: "Família", subtype: "Trabajo sin fecha" });
    ctx.mapa.set(antes.alboomId, mapaDe(antes, TIPO_CATEGORIA, "k", huellasDe({ group: "TRABAJO_SIN_FECHA" })));
    expect(traducirCategoria(cat("6", { name: "Família", subtype: "Evento" }), ctx)).toMatchObject({ accion: "ACTUALIZAR", targetId: "k", datos: { group: "EVENTO" } });
  });

  it("otras categorías (contacto, producto…) no son de consulta; sin nombre → OMITIR", () => {
    expect(traducirCategoria(crudo("categorias", "contact/1", { name: "Cliente" }), dnx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.noEsCategoriaDeConsulta });
    expect(traducirCategoria(cat("9", { name: "" }), dnx())).toEqual({ accion: "OMITIR", motivo: MOTIVOS.sinNombre });
  });
});
