import { describe, expect, it } from "vitest";
import { etiquetasDeFiltro } from "./etiquetas";
import type { ConsultaResuelta, DefinicionListado } from "./tipos";

const def = {
  filtros: [
    { tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: [{ valor: "ACTIVO", etiqueta: "Activo" }] },
    { tipo: "relacion", clave: "categoria", etiqueta: "Categoría" },
    { tipo: "periodo", clave: "alta", etiqueta: "Alta" },
    { tipo: "siNo", clave: "deuda", etiqueta: "Deuda", si: "Con deuda", no: "Al día" },
  ],
} as unknown as DefinicionListado<unknown>;

it("arma un chip legible por filtro activo, en el orden de la definición", () => {
  const r = {
    filtros: { deuda: "no", estado: "ACTIVO", categoria: "c1", alta: "mes-pasado" },
    etiquetasRelacion: { categoria: "Vitalicio" },
  } as unknown as ConsultaResuelta;
  expect(etiquetasDeFiltro(def, r)).toEqual([
    { clave: "estado", texto: "Estado: Activo" },
    { clave: "categoria", texto: "Categoría: Vitalicio" },
    { clave: "alta", texto: "Alta: Mes pasado" },
    { clave: "deuda", texto: "Deuda: Al día" },
  ]);
});
