import { describe, expect, it } from "vitest";
import {
  ROL_YA_LLENO,
  YA_RESPONDIDA,
  efectosSobreLaBusqueda,
  planInvitacionDirecta,
  planResponderInvitacion,
  planSeleccionarPostulacion,
  puedeArmarseElEquipo,
} from "./equipo";
import type { EstadoDeRol } from "./cupos";

/** Un rol de una vacante, vacío, para no repetir el objeto en cada caso. */
function rol(parcial: Partial<EstadoDeRol> = {}): EstadoDeRol {
  return { vacancies: 1, asignadasVivas: 0, asignadasAceptadas: 0, ...parcial };
}

describe("puedeArmarseElEquipo", () => {
  it("deja sumar gente mientras la cobertura está viva", () => {
    expect(puedeArmarseElEquipo("PLANIFICADA")).toBe(true);
    expect(puedeArmarseElEquipo("BUSCANDO_EQUIPO")).toBe(true);
    expect(puedeArmarseElEquipo("EQUIPO_CONFIRMADO")).toBe(true);
    expect(puedeArmarseElEquipo("SIN_EQUIPO")).toBe(true);
  });

  it("no deja sumar gente a una cobertura que ya pasó o se canceló", () => {
    expect(puedeArmarseElEquipo("REALIZADA")).toBe(false);
    expect(puedeArmarseElEquipo("ENTREGADA")).toBe(false);
    expect(puedeArmarseElEquipo("CERRADA")).toBe(false);
    expect(puedeArmarseElEquipo("CANCELADA")).toBe(false);
  });

  it("un estado inventado no habilita nada", () => {
    expect(puedeArmarseElEquipo("EN_VUELO")).toBe(false);
  });
});

describe("planSeleccionarPostulacion", () => {
  const base = {
    coverageStatus: "BUSCANDO_EQUIPO",
    applicationStatus: "RECIBIDA",
    yaEstaAsignado: false,
    rol: rol(),
  };

  it("el camino feliz: postulación viva, rol con lugar, persona sin asignar", () => {
    expect(planSeleccionarPostulacion(base)).toEqual({ ok: true });
  });

  it("se puede seleccionar desde cualquier estado vivo de la postulación", () => {
    for (const applicationStatus of ["RECIBIDA", "EN_REVISION", "PRESELECCIONADA"]) {
      expect(planSeleccionarPostulacion({ ...base, applicationStatus })).toEqual({ ok: true });
    }
  });

  it("una postulación ya resuelta no se vuelve a seleccionar", () => {
    for (const applicationStatus of ["SELECCIONADA", "NO_SELECCIONADA", "RETIRADA", "VENCIDA"]) {
      expect(planSeleccionarPostulacion({ ...base, applicationStatus })).toEqual({
        ok: false,
        error: "Esa postulación ya está resuelta.",
      });
    }
  });

  it("un rol sin lugar avisa que se llenó mientras mirabas la pantalla", () => {
    // Justo el caso de los dos coordinadores con la misma pantalla abierta.
    expect(
      planSeleccionarPostulacion({ ...base, rol: rol({ vacancies: 1, asignadasVivas: 1 }) }),
    ).toEqual({ ok: false, error: ROL_YA_LLENO });
  });

  it("nadie entra dos veces a la misma cobertura", () => {
    expect(planSeleccionarPostulacion({ ...base, yaEstaAsignado: true })).toEqual({
      ok: false,
      error: "Esa persona ya está en el equipo de esta cobertura.",
    });
  });

  it("una cobertura cerrada frena antes que cualquier otro control", () => {
    // El orden importa: aunque además el rol esté lleno, el mensaje es el de la cobertura.
    expect(
      planSeleccionarPostulacion({
        ...base,
        coverageStatus: "CERRADA",
        rol: rol({ asignadasVivas: 1 }),
      }),
    ).toEqual({ ok: false, error: "Esta cobertura ya no admite sumar gente." });
  });
});

describe("planInvitacionDirecta", () => {
  const base = {
    coverageStatus: "BUSCANDO_EQUIPO",
    tienePerfilActivo: true,
    yaEstaAsignado: false,
    rol: rol(),
  };

  it("el camino feliz: colaboradora activa y rol con lugar", () => {
    expect(planInvitacionDirecta(base)).toEqual({ ok: true });
  });

  it("se puede invitar directo con la cobertura todavía planificada", () => {
    // El modo de asignación DIRECTA no necesita convocatoria publicada.
    expect(planInvitacionDirecta({ ...base, coverageStatus: "PLANIFICADA" })).toEqual({ ok: true });
  });

  it("sin perfil activo no se invita a nadie", () => {
    expect(planInvitacionDirecta({ ...base, tienePerfilActivo: false })).toEqual({
      ok: false,
      error: "Esa persona todavía no está habilitada como colaboradora.",
    });
  });

  it("un rol sin lugar avisa que se llenó mientras mirabas la pantalla", () => {
    expect(planInvitacionDirecta({ ...base, rol: rol({ asignadasVivas: 1 }) })).toEqual({
      ok: false,
      error: ROL_YA_LLENO,
    });
  });

  it("nadie entra dos veces a la misma cobertura", () => {
    expect(planInvitacionDirecta({ ...base, yaEstaAsignado: true })).toEqual({
      ok: false,
      error: "Esa persona ya está en el equipo de esta cobertura.",
    });
  });
});

describe("planResponderInvitacion", () => {
  it("confirmar deja la asignación CONFIRMADA", () => {
    expect(planResponderInvitacion({ assignmentStatus: "INVITADA", respuesta: "CONFIRMO" })).toEqual(
      { ok: true, nuevoEstado: "CONFIRMADA" },
    );
  });

  it("avisar que no se puede la deja RECHAZADA", () => {
    expect(
      planResponderInvitacion({ assignmentStatus: "INVITADA", respuesta: "NO_PUEDO" }),
    ).toEqual({ ok: true, nuevoEstado: "RECHAZADA" });
  });

  it("responder dos veces no rompe nada: se avisa con calma, no como error", () => {
    // La rama tiene `yaRespondida: true` a propósito, separada de los errores de verdad: quien
    // llama la muestra en gris, no en rojo. Apretar el botón dos veces en el teléfono no es
    // culpa de nadie.
    for (const assignmentStatus of ["CONFIRMADA", "RECHAZADA", "ACEPTADA", "CANCELADA"]) {
      expect(planResponderInvitacion({ assignmentStatus, respuesta: "CONFIRMO" })).toEqual({
        ok: false,
        yaRespondida: true,
        aviso: YA_RESPONDIDA,
      });
    }
  });

  it("una respuesta que no es ninguna de las dos no escribe nada", () => {
    expect(planResponderInvitacion({ assignmentStatus: "INVITADA", respuesta: "TAL_VEZ" })).toEqual({
      ok: false,
      yaRespondida: false,
      error: "No entendimos tu respuesta. Probá de nuevo.",
    });
  });
});

describe("efectosSobreLaBusqueda", () => {
  it("con todos los roles invitados, la convocatoria se cierra pero la cobertura NO se confirma", () => {
    // El corazón de la separación: se invitó a todo el mundo y nadie contestó todavía. Avisarle
    // a la organización que ya tiene equipo acá sería mentirle.
    expect(
      efectosSobreLaBusqueda({
        roles: [rol({ asignadasVivas: 1, asignadasAceptadas: 0 })],
        callStatus: "PUBLICADA",
        coverageStatus: "BUSCANDO_EQUIPO",
      }),
    ).toEqual({ callStatus: "COMPLETA", coverageStatus: null });
  });

  it("recién cuando todos aceptan, la cobertura pasa a EQUIPO_CONFIRMADO", () => {
    expect(
      efectosSobreLaBusqueda({
        roles: [rol({ asignadasVivas: 1, asignadasAceptadas: 1 })],
        callStatus: "COMPLETA",
        coverageStatus: "BUSCANDO_EQUIPO",
      }),
    ).toEqual({ callStatus: null, coverageStatus: "EQUIPO_CONFIRMADO" });
  });

  it("falta un rol por invitar: no se toca nada", () => {
    expect(
      efectosSobreLaBusqueda({
        roles: [rol({ asignadasVivas: 1, asignadasAceptadas: 1 }), rol()],
        callStatus: "PUBLICADA",
        coverageStatus: "BUSCANDO_EQUIPO",
      }),
    ).toEqual({ callStatus: null, coverageStatus: null });
  });

  it("un rechazo reabre la convocatoria y saca a la cobertura de EQUIPO_CONFIRMADO", () => {
    // Sin este camino de vuelta, un rechazo deja la cobertura diciendo que tiene equipo.
    expect(
      efectosSobreLaBusqueda({
        roles: [rol({ asignadasVivas: 0, asignadasAceptadas: 0 })],
        callStatus: "COMPLETA",
        coverageStatus: "EQUIPO_CONFIRMADO",
      }),
    ).toEqual({ callStatus: "PUBLICADA", coverageStatus: "BUSCANDO_EQUIPO" });
  });

  it("una invitación directa no saca a la cobertura de PLANIFICADA", () => {
    // Entrar en búsqueda es lo que hace publicar la convocatoria, y la convocatoria solo se
    // crea mientras la cobertura está planificada: moverla acá dejaría a la coordinación sin
    // poder crearla.
    expect(
      efectosSobreLaBusqueda({
        roles: [rol(), rol()],
        callStatus: null,
        coverageStatus: "PLANIFICADA",
      }),
    ).toEqual({ callStatus: null, coverageStatus: null });
  });

  it("sin convocatoria, la cobertura igual se confirma cuando todos aceptaron", () => {
    // Equipo armado entero por invitación directa sobre una cobertura que ya estaba buscando.
    expect(
      efectosSobreLaBusqueda({
        roles: [rol({ asignadasVivas: 1, asignadasAceptadas: 1 })],
        callStatus: null,
        coverageStatus: "BUSCANDO_EQUIPO",
      }),
    ).toEqual({ callStatus: null, coverageStatus: "EQUIPO_CONFIRMADO" });
  });

  it("una cobertura sin roles no queda confirmada por un `every` sobre una lista vacía", () => {
    expect(
      efectosSobreLaBusqueda({ roles: [], callStatus: "PUBLICADA", coverageStatus: "BUSCANDO_EQUIPO" }),
    ).toEqual({ callStatus: null, coverageStatus: null });
  });

  it("un estado de convocatoria que no admite el cambio no se fuerza", () => {
    // Un borrador con todos los roles llenos no salta a COMPLETA: esa transición no existe.
    expect(
      efectosSobreLaBusqueda({
        roles: [rol({ asignadasVivas: 1, asignadasAceptadas: 1 })],
        callStatus: "BORRADOR",
        coverageStatus: "BUSCANDO_EQUIPO",
      }),
    ).toEqual({ callStatus: null, coverageStatus: "EQUIPO_CONFIRMADO" });
  });
});
