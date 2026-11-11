import { describe, expect, it } from "vitest";
import { TIPOS_CONTACTO } from "../buscador/tipos";
import {
  CURSO_POR_GRUPO, GRUPOS, GRUPOS_SIEMPRE_A_DANIEL, grupoDe, LANDING_POR_GRUPO, LANDINGS_PERMITIDAS, ROTULO_GRUPO,
} from "./tipos";

describe("grupoDe", () => {
  it("fotógrafo: el primer nicho conocido manda", () => {
    expect(grupoDe({ tipo: "FOTOGRAFO", nichos: ["ESCOLAR", "SOCIAL"] })).toBe("FOTOGRAFO:ESCOLAR");
  });
  it("fotógrafo: ESCOLAR en cualquier posición manda, aunque haya TURISTICA antes", () => {
    expect(grupoDe({ tipo: "FOTOGRAFO", nichos: ["SOCIAL", "ESCOLAR"] })).toBe("FOTOGRAFO:ESCOLAR");
    expect(grupoDe({ tipo: "FOTOGRAFO", nichos: ["TURISTICA", "DEPORTIVA", "ESCOLAR"] })).toBe("FOTOGRAFO:ESCOLAR");
  });
  it("fotógrafo: sin ESCOLAR, TURISTICA en cualquier posición manda", () => {
    expect(grupoDe({ tipo: "FOTOGRAFO", nichos: ["DEPORTIVA", "TURISTICA"] })).toBe("FOTOGRAFO:TURISTICA");
    expect(grupoDe({ tipo: "FOTOGRAFO", nichos: ["OTRO:bodas", "TURISTICA"] })).toBe("FOTOGRAFO:TURISTICA");
  });
  it("fotógrafo sin ESCOLAR ni TURISTICA: el primer nicho, como antes", () => {
    expect(grupoDe({ tipo: "FOTOGRAFO", nichos: ["DEPORTIVA", "SOCIAL"] })).toBe("FOTOGRAFO:DEPORTIVA");
    expect(grupoDe({ tipo: "FOTOGRAFO", nichos: ["OTRO:bodas", "SOCIAL"] })).toBe("FOTOGRAFO:GENERAL");
  });
  it("el nicho no cambia el grupo de los demás tipos", () => {
    expect(grupoDe({ tipo: "CLUB", nichos: ["ESCOLAR"] })).toBe("CLUB");
  });
  it("fotógrafo con nicho libre o sin nichos: general", () => {
    expect(grupoDe({ tipo: "FOTOGRAFO", nichos: ["OTRO:bodas"] })).toBe("FOTOGRAFO:GENERAL");
    expect(grupoDe({ tipo: "FOTOGRAFO", nichos: [] })).toBe("FOTOGRAFO:GENERAL");
  });
  it("OTRO y tipos desconocidos no tienen grupo", () => {
    expect(grupoDe({ tipo: "OTRO", nichos: [] })).toBeNull();
    expect(grupoDe({ tipo: "INVENTADO", nichos: [] })).toBeNull();
  });
  it("escuela de fotografía", () => {
    expect(grupoDe({ tipo: "ESCUELA_FOTOGRAFIA", nichos: [] })).toBe("ESCUELA_FOTOGRAFIA");
  });
});

describe("grupos", () => {
  it("son 17 y el Buscador incluye ESCUELA_FOTOGRAFIA", () => {
    expect(GRUPOS.length).toBe(17);
    expect(TIPOS_CONTACTO).toContain("ESCUELA_FOTOGRAFIA");
  });
  it("cada grupo tiene landing permitida, curso y rótulo", () => {
    for (const g of GRUPOS) {
      expect(LANDINGS_PERMITIDAS).toContain(LANDING_POR_GRUPO[g]);
      expect(CURSO_POR_GRUPO[g]).toBeTruthy();
      expect(ROTULO_GRUPO[g]).toBeTruthy();
    }
  });
  it("ningún enlace usa ?ref=", () => {
    for (const v of [...Object.values(LANDING_POR_GRUPO), ...Object.values(CURSO_POR_GRUPO)]) {
      expect(v).not.toContain("ref");
    }
  });
  it("los organizadores de muestras van a Muestras Fotográficas", () => {
    expect(LANDING_POR_GRUPO.ORGANIZADOR_MUESTRAS).toBe("https://muestrasfotograficas.com");
  });
  it("las escuelas de fotografía siempre van a Daniel", () => {
    expect(GRUPOS_SIEMPRE_A_DANIEL).toEqual(["ESCUELA_FOTOGRAFIA"]);
  });
});
