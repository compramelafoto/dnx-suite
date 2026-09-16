import { describe, expect, it } from "vitest";
import {
  ROL_YA_LLENO,
  YA_RESPONDIDA,
  efectosSobreLaBusqueda,
  planInvitacionDirecta,
  planResponderInvitacion,
  planSeleccionarPostulacion,
  postulacionesQueSeCierran,
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

  it("una invitación directa saca a la cobertura de PLANIFICADA", () => {
    // El modo DIRECTA no publica ninguna convocatoria, así que sin este camino de ida la
    // cobertura se quedaba en PLANIFICADA aunque todo el mundo confirmara — y desde ahí no
    // existe el salto a EQUIPO_CONFIRMADO.
    expect(
      efectosSobreLaBusqueda({
        roles: [rol({ asignadasVivas: 1 }), rol()],
        callStatus: null,
        coverageStatus: "PLANIFICADA",
      }),
    ).toEqual({ callStatus: null, coverageStatus: "BUSCANDO_EQUIPO" });
  });

  it("una cobertura planificada sin nadie invitado no se mueve sola", () => {
    // PLANIFICADA quiere decir "todavía no se movió nadie". Sin gente viva, nada cambió.
    expect(
      efectosSobreLaBusqueda({
        roles: [rol(), rol()],
        callStatus: null,
        coverageStatus: "PLANIFICADA",
      }),
    ).toEqual({ callStatus: null, coverageStatus: null });
  });

  it("desde PLANIFICADA se avanza de a un paso, nunca salteando a EQUIPO_CONFIRMADO", () => {
    // Esa transición no existe: proponerla dejaría la cobertura trabada en PLANIFICADA. Se
    // avanza a BUSCANDO_EQUIPO y el toque siguiente sobre el equipo la confirma.
    expect(
      efectosSobreLaBusqueda({
        roles: [rol({ asignadasVivas: 1, asignadasAceptadas: 1 })],
        callStatus: null,
        coverageStatus: "PLANIFICADA",
      }),
    ).toEqual({ callStatus: null, coverageStatus: "BUSCANDO_EQUIPO" });
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

  it("invitar a alguien con la convocatoria en borrador NO la publica", () => {
    // Publicar es una decisión de la coordinación: pone `publishedAt`, valida título y vacantes
    // con `puedePublicarse` y le avisa por correo a cada colaborador activo. Si armar el equipo
    // la publicara de costado, la convocatoria aparecería en el portal sin que nadie se entere
    // y el botón «Publicar» del panel pasaría a fallar por una transición que ya ocurrió.
    expect(
      efectosSobreLaBusqueda({
        roles: [rol({ asignadasVivas: 1 }), rol()],
        callStatus: "BORRADOR",
        coverageStatus: "BUSCANDO_EQUIPO",
      }),
    ).toEqual({ callStatus: null, coverageStatus: null });
  });

  it("solo vuelve a PUBLICADA la que estaba COMPLETA, no cualquier otra", () => {
    // `PUBLICADA` es el destino de la VUELTA, no un destino al que se empuje a cualquier
    // convocatoria que todavía tenga lugares libres.
    expect(
      efectosSobreLaBusqueda({
        roles: [rol({ asignadasVivas: 1 }), rol()],
        callStatus: "PUBLICADA",
        coverageStatus: "BUSCANDO_EQUIPO",
      }),
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

describe("postulacionesQueSeCierran", () => {
  const anotadas = [
    { id: "p1", status: "RECIBIDA" },
    { id: "p2", status: "RECIBIDA" },
    { id: "p3", status: "SELECCIONADA" },
  ];

  it("mientras el equipo no esté confirmado, no cierra nada", () => {
    // La convocatoria puede estar COMPLETA y volver atrás si alguien rechaza: ahí esas
    // postulaciones vuelven a servir. Cerrarlas antes sería tirar a la gente que todavía
    // podríamos necesitar.
    expect(postulacionesQueSeCierran({ equipoQuedoConfirmado: false, postulaciones: anotadas })).toEqual(
      [],
    );
  });

  it("con el equipo confirmado, cierra las que siguen esperando respuesta", () => {
    expect(
      postulacionesQueSeCierran({ equipoQuedoConfirmado: true, postulaciones: anotadas }),
    ).toEqual(["p1", "p2"]);
  });

  it("no vuelve a tocar las que ya están resueltas", () => {
    const resueltas = [
      { id: "a", status: "SELECCIONADA" },
      { id: "b", status: "NO_SELECCIONADA" },
      { id: "c", status: "RETIRADA" },
      { id: "d", status: "VENCIDA" },
    ];
    expect(
      postulacionesQueSeCierran({ equipoQuedoConfirmado: true, postulaciones: resueltas }),
    ).toEqual([]);
  });

  it("también alcanza a las que quedaron a mitad de una revisión", () => {
    // Hoy ninguna pantalla las pone ahí, pero el día que exista la revisión formal no tienen
    // que quedar colgadas.
    const enRevision = [
      { id: "a", status: "EN_REVISION" },
      { id: "b", status: "PRESELECCIONADA" },
    ];
    expect(
      postulacionesQueSeCierran({ equipoQuedoConfirmado: true, postulaciones: enRevision }),
    ).toEqual(["a", "b"]);
  });

  it("un estado inventado no se toca: la máquina de estados decide, no esta función", () => {
    expect(
      postulacionesQueSeCierran({
        equipoQuedoConfirmado: true,
        postulaciones: [{ id: "x", status: "EN_VUELO" }],
      }),
    ).toEqual([]);
  });

  it("sin postulaciones, no hay nada que cerrar", () => {
    expect(postulacionesQueSeCierran({ equipoQuedoConfirmado: true, postulaciones: [] })).toEqual([]);
  });
});
