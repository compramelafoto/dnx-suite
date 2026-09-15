import { describe, expect, it } from "vitest";
import { equipoCompleto, lugaresLibres, rolCompleto, type EstadoDeRol } from "./cupos";

/**
 * Cupos por rol, no por cobertura.
 *
 * "Necesito un fotógrafo y un videógrafo" son dos roles con una vacante cada uno, no una
 * cobertura con dos vacantes genéricas: por eso todo acá mira un solo rol a la vez.
 */
describe("lugaresLibres", () => {
  it("resta las asignaciones vivas de las vacantes", () => {
    expect(lugaresLibres({ vacancies: 3, asignadasVivas: 1 })).toBe(2);
  });

  it("un rol sin ninguna asignación tiene todas sus vacantes libres", () => {
    expect(lugaresLibres({ vacancies: 2, asignadasVivas: 0 })).toBe(2);
  });

  it("nunca devuelve negativo, aunque haya más asignaciones que vacantes", () => {
    // Puede pasar si alguien bajó las vacantes de 3 a 1 después de asignar a las tres personas.
    expect(lugaresLibres({ vacancies: 1, asignadasVivas: 3 })).toBe(0);
  });
});

describe("rolCompleto", () => {
  it("no está completo si quedan lugares", () => {
    expect(rolCompleto({ vacancies: 2, asignadasVivas: 1 })).toBe(false);
  });

  it("está completo cuando las asignaciones vivas igualan las vacantes", () => {
    expect(rolCompleto({ vacancies: 2, asignadasVivas: 2 })).toBe(true);
  });

  it("está completo también si se pasó, no solo si empata", () => {
    expect(rolCompleto({ vacancies: 1, asignadasVivas: 3 })).toBe(true);
  });
});

describe("equipoCompleto", () => {
  it("la cobertura está completa cuando todos sus roles lo están", () => {
    const roles: EstadoDeRol[] = [
      { vacancies: 1, asignadasVivas: 1 },
      { vacancies: 2, asignadasVivas: 2 },
    ];
    expect(equipoCompleto(roles)).toBe(true);
  });

  it("alcanza con que un solo rol le falte gente para que no esté completa", () => {
    const roles: EstadoDeRol[] = [
      { vacancies: 1, asignadasVivas: 1 },
      { vacancies: 2, asignadasVivas: 1 },
    ];
    expect(equipoCompleto(roles)).toBe(false);
  });

  it("una cobertura sin roles no se considera completa", () => {
    // Nadie generó los roles todavía; "completa" acá sería un falso positivo.
    expect(equipoCompleto([])).toBe(false);
  });
});
