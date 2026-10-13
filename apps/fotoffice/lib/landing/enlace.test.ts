import { describe, expect, it } from "vitest";
import { armarConsulta, leerSeleccion } from "./enlace";

const VALIDAS = new Set(["members", "membership-dues", "carnets", "raffles"]);

describe("enlace con la selección de la portada", () => {
  it("lee el tipo y los módulos en el orden del enlace", () => {
    expect(leerSeleccion({ tipo: "sociedad", modulos: "carnets,members" }, VALIDAS)).toEqual({
      tipoId: "sociedad",
      modulos: ["carnets", "members"],
    });
  });

  it("descarta tipos y módulos que no existen sin romper la portada", () => {
    expect(leerSeleccion({ tipo: "inventado", modulos: "members,nada, carnets ,members" }, VALIDAS)).toEqual({
      tipoId: null,
      modulos: ["members", "carnets"],
    });
  });

  it("sin módulos válidos vuelve a los del tipo", () => {
    expect(leerSeleccion({ tipo: "sociedad", modulos: "nada" }, VALIDAS).modulos).toBeNull();
    expect(leerSeleccion({ tipo: "sociedad" }, VALIDAS).modulos).toBeNull();
  });

  it("si el parámetro viene repetido, vale el primero", () => {
    expect(leerSeleccion({ tipo: ["sociedad", "ong"] }, VALIDAS).tipoId).toBe("sociedad");
  });

  it("arma una consulta legible que se vuelve a leer igual", () => {
    const seleccion = { tipoId: "sociedad", modulos: ["members", "membership-dues"] };
    const consulta = armarConsulta(seleccion);
    expect(consulta).toBe("?tipo=sociedad&modulos=members,membership-dues");
    const params = Object.fromEntries(new URLSearchParams(consulta));
    expect(leerSeleccion(params, VALIDAS)).toEqual(seleccion);
  });

  it("sin selección no deja un signo de pregunta suelto", () => {
    expect(armarConsulta({ tipoId: null, modulos: null })).toBe("");
  });
});
