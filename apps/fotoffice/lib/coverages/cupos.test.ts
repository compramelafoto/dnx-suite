import { describe, expect, it } from "vitest";
import {
  equipoConfirmado,
  lugaresLibres,
  rolCompleto,
  todosLosRolesCompletos,
  type EstadoDeRol,
} from "./cupos";

/**
 * Cupos por rol, no por cobertura.
 *
 * "Necesito un fotógrafo y un videógrafo" son dos roles con una vacante cada uno, no una
 * cobertura con dos vacantes genéricas: por eso todo acá mira un solo rol a la vez.
 */
describe("lugaresLibres", () => {
  it("resta las asignaciones vivas de las vacantes", () => {
    expect(lugaresLibres({ vacancies: 3, asignadasVivas: 1, asignadasAceptadas: 0 })).toBe(2);
  });

  it("un rol sin ninguna asignación tiene todas sus vacantes libres", () => {
    expect(lugaresLibres({ vacancies: 2, asignadasVivas: 0, asignadasAceptadas: 0 })).toBe(2);
  });

  it("nunca devuelve negativo, aunque haya más asignaciones que vacantes", () => {
    // Puede pasar si alguien bajó las vacantes de 3 a 1 después de asignar a las tres personas.
    expect(lugaresLibres({ vacancies: 1, asignadasVivas: 3, asignadasAceptadas: 0 })).toBe(0);
  });
});

describe("rolCompleto", () => {
  it("no está completo si quedan lugares", () => {
    expect(rolCompleto({ vacancies: 2, asignadasVivas: 1, asignadasAceptadas: 0 })).toBe(false);
  });

  it("está completo cuando las asignaciones vivas igualan las vacantes", () => {
    expect(rolCompleto({ vacancies: 2, asignadasVivas: 2, asignadasAceptadas: 0 })).toBe(true);
  });

  it("está completo también si se pasó, no solo si empata", () => {
    expect(rolCompleto({ vacancies: 1, asignadasVivas: 3, asignadasAceptadas: 0 })).toBe(true);
  });

  it("está completo con una sola persona invitada que todavía no respondió: el caso que importa", () => {
    // El lugar ya está ocupado aunque nadie haya dicho que sí — por eso no se invita a otra
    // persona encima. `equipoConfirmado` es la función que sí exige una respuesta.
    const rol: EstadoDeRol = { vacancies: 1, asignadasVivas: 1, asignadasAceptadas: 0 };
    expect(rolCompleto(rol)).toBe(true);
    expect(equipoConfirmado([rol])).toBe(false);
  });
});

describe("equipoConfirmado", () => {
  it("es falso mientras la única persona invitada no respondió, aunque el rol esté completo", () => {
    const roles: EstadoDeRol[] = [{ vacancies: 1, asignadasVivas: 1, asignadasAceptadas: 0 }];
    expect(rolCompleto(roles[0])).toBe(true);
    expect(equipoConfirmado(roles)).toBe(false);
  });

  it("pasa a verdadero cuando esa misma persona acepta", () => {
    const roles: EstadoDeRol[] = [{ vacancies: 1, asignadasVivas: 1, asignadasAceptadas: 1 }];
    expect(rolCompleto(roles[0])).toBe(true);
    expect(equipoConfirmado(roles)).toBe(true);
  });

  it("con dos roles, uno aceptado y otro solo invitado: los roles están completos pero el equipo no", () => {
    const roles: EstadoDeRol[] = [
      { vacancies: 1, asignadasVivas: 1, asignadasAceptadas: 1 },
      { vacancies: 1, asignadasVivas: 1, asignadasAceptadas: 0 },
    ];
    expect(todosLosRolesCompletos(roles)).toBe(true);
    expect(equipoConfirmado(roles)).toBe(false);
  });

  it("una cobertura sin roles no tiene equipo confirmado", () => {
    // Nadie generó los roles todavía; que un `every` sobre lista vacía dé `true` es la trampa
    // que esto evita.
    expect(equipoConfirmado([])).toBe(false);
  });
});

describe("todosLosRolesCompletos", () => {
  it("es verdadero cuando todos los roles están completos", () => {
    const roles: EstadoDeRol[] = [
      { vacancies: 1, asignadasVivas: 1, asignadasAceptadas: 1 },
      { vacancies: 2, asignadasVivas: 2, asignadasAceptadas: 0 },
    ];
    expect(todosLosRolesCompletos(roles)).toBe(true);
  });

  it("alcanza con que un solo rol le falte gente para que no estén todos completos", () => {
    const roles: EstadoDeRol[] = [
      { vacancies: 1, asignadasVivas: 1, asignadasAceptadas: 1 },
      { vacancies: 2, asignadasVivas: 1, asignadasAceptadas: 0 },
    ];
    expect(todosLosRolesCompletos(roles)).toBe(false);
  });

  it("una cobertura sin roles no se considera completa", () => {
    expect(todosLosRolesCompletos([])).toBe(false);
  });
});
