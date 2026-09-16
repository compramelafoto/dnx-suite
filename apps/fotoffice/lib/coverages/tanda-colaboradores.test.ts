import { describe, expect, it } from "vitest";
import {
  describirTanda,
  planificarTandaDeColaboradores,
  type SocioParaLaTanda,
} from "./tanda-colaboradores";

/**
 * La tanda decide dos cosas y las dos se prueban acá sin base de datos: qué filas tocar y qué
 * contarle a quien coordina. La escritura en sí es un `updateMany` y un `createMany`; lo que
 * puede salir mal es la decisión, no el SQL.
 */

function socio(id: string, status: string, perfil?: { active: boolean } | null): SocioParaLaTanda {
  return { id, status, coverageProfile: perfil ?? null };
}

const padron: SocioParaLaTanda[] = [
  socio("sin-perfil", "ACTIVE"),
  socio("apagado", "ACTIVE", { active: false }),
  socio("encendido", "ACTIVE", { active: true }),
  socio("de-baja", "INACTIVE"),
  socio("de-baja-encendido", "INACTIVE", { active: true }),
];

describe("planificarTandaDeColaboradores, al habilitar", () => {
  it("le crea el perfil a quien no lo tiene y enciende el que estaba apagado", () => {
    const plan = planificarTandaDeColaboradores({
      accion: "habilitar",
      seleccionados: ["sin-perfil", "apagado"],
      padron,
    });
    expect(plan.crear).toEqual(["sin-perfil"]);
    expect(plan.actualizar).toEqual(["apagado"]);
  });

  it("no toca a quien ya estaba habilitado ni lo cuenta como cambio", () => {
    const plan = planificarTandaDeColaboradores({
      accion: "habilitar",
      seleccionados: ["encendido"],
      padron,
    });
    expect(plan.actualizar).toEqual([]);
    expect(plan.crear).toEqual([]);
    expect(plan.sinCambio).toBe(1);
  });

  it("es idempotente: habilitar dos veces la misma tanda no cambia nada la segunda vez", () => {
    const primera = planificarTandaDeColaboradores({
      accion: "habilitar",
      seleccionados: ["sin-perfil", "apagado"],
      padron,
    });
    expect(primera.crear.length + primera.actualizar.length).toBe(2);

    // El padrón después de esa primera tanda: los dos ya tienen perfil encendido.
    const despues = [socio("sin-perfil", "ACTIVE", { active: true }), socio("apagado", "ACTIVE", { active: true })];
    const segunda = planificarTandaDeColaboradores({
      accion: "habilitar",
      seleccionados: ["sin-perfil", "apagado"],
      padron: despues,
    });
    expect(segunda.crear).toEqual([]);
    expect(segunda.actualizar).toEqual([]);
    expect(segunda.sinCambio).toBe(2);
  });

  it("saltea a quien no está vigente en el padrón, aunque no tenga perfil todavía", () => {
    // Encenderle el perfil no lo dejaría participar igual (`participaDeCoberturas` exige las dos
    // cosas): habilitarlo sería prometer algo que el sistema después no cumple.
    const plan = planificarTandaDeColaboradores({
      accion: "habilitar",
      seleccionados: ["de-baja", "sin-perfil"],
      padron,
    });
    expect(plan.fueraDelPadron).toBe(1);
    expect(plan.crear).toEqual(["sin-perfil"]);
  });

  it("descarta los identificadores que no son de este padrón", () => {
    const plan = planificarTandaDeColaboradores({
      accion: "habilitar",
      seleccionados: ["sin-perfil", "de-otra-institucion"],
      padron,
    });
    expect(plan.desconocidos).toBe(1);
    expect(plan.crear).toEqual(["sin-perfil"]);
    expect(plan.actualizar).toEqual([]);
  });

  it("no cuenta dos veces a la misma persona seleccionada dos veces", () => {
    const plan = planificarTandaDeColaboradores({
      accion: "habilitar",
      seleccionados: ["apagado", "apagado"],
      padron,
    });
    expect(plan.actualizar).toEqual(["apagado"]);
  });

  it("una selección vacía no escribe nada", () => {
    const plan = planificarTandaDeColaboradores({ accion: "habilitar", seleccionados: [], padron });
    expect(plan.actualizar).toEqual([]);
    expect(plan.crear).toEqual([]);
    expect(plan.sinCambio).toBe(0);
  });
});

describe("planificarTandaDeColaboradores, al quitar", () => {
  it("apaga el perfil de quien estaba habilitado", () => {
    const plan = planificarTandaDeColaboradores({
      accion: "quitar",
      seleccionados: ["encendido"],
      padron,
    });
    expect(plan.actualizar).toEqual(["encendido"]);
  });

  it("nunca crea filas: a quien no tiene perfil no se le crea uno apagado", () => {
    const plan = planificarTandaDeColaboradores({
      accion: "quitar",
      seleccionados: ["sin-perfil", "apagado"],
      padron,
    });
    expect(plan.crear).toEqual([]);
    expect(plan.actualizar).toEqual([]);
    expect(plan.sinCambio).toBe(2);
  });

  it("sí quita a quien está de baja en el padrón: es justo lo que hay que poder hacer", () => {
    const plan = planificarTandaDeColaboradores({
      accion: "quitar",
      seleccionados: ["de-baja-encendido"],
      padron,
    });
    expect(plan.actualizar).toEqual(["de-baja-encendido"]);
    expect(plan.fueraDelPadron).toBe(0);
  });

  it("también descarta los identificadores ajenos al padrón", () => {
    const plan = planificarTandaDeColaboradores({
      accion: "quitar",
      seleccionados: ["de-otra-institucion"],
      padron,
    });
    expect(plan.desconocidos).toBe(1);
    expect(plan.actualizar).toEqual([]);
  });
});

describe("describirTanda", () => {
  it("dice los números reales, no un listo genérico", () => {
    expect(
      describirTanda({ accion: "habilitar", cambiados: 61, sinCambio: 23, fueraDelPadron: 0, desconocidos: 0 }),
    ).toBe("Habilitamos 61. Otros 23 ya estaban habilitados.");
  });

  it("explica por qué se salteó a los que no están activos en el padrón", () => {
    expect(
      describirTanda({ accion: "habilitar", cambiados: 61, sinCambio: 20, fueraDelPadron: 3, desconocidos: 0 }),
    ).toBe(
      "Habilitamos 61. Otros 20 ya estaban habilitados. 3 no se habilitaron porque no están activos en el padrón.",
    );
  });

  it("no inventa un cambio cuando no hubo ninguno", () => {
    expect(
      describirTanda({ accion: "habilitar", cambiados: 0, sinCambio: 5, fueraDelPadron: 0, desconocidos: 0 }),
    ).toBe("No habilitamos a nadie nuevo. Otros 5 ya estaban habilitados.");
    expect(
      describirTanda({ accion: "quitar", cambiados: 0, sinCambio: 0, fueraDelPadron: 0, desconocidos: 0 }),
    ).toBe("No quitamos a nadie.");
  });

  it("habla en singular cuando fue una sola persona", () => {
    expect(
      describirTanda({ accion: "habilitar", cambiados: 1, sinCambio: 1, fueraDelPadron: 1, desconocidos: 0 }),
    ).toBe("Habilitamos 1. Otro ya estaba habilitado. 1 no se habilitó porque no está activo en el padrón.");
  });

  it("al quitar habla de quedar fuera y no menciona el padrón", () => {
    expect(
      describirTanda({ accion: "quitar", cambiados: 4, sinCambio: 2, fueraDelPadron: 0, desconocidos: 0 }),
    ).toBe("Quitamos a 4. Otros 2 ya estaban fuera.");
  });

  it("avisa cuando alguno de los seleccionados ya no estaba en el padrón", () => {
    expect(
      describirTanda({ accion: "habilitar", cambiados: 2, sinCambio: 0, fueraDelPadron: 0, desconocidos: 1 }),
    ).toBe("Habilitamos 2. 1 quedó afuera porque ya no está en el padrón.");
  });
});
