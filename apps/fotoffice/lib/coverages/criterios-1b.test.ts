import { describe, expect, it } from "vitest";
import {
  puedeCrearseConvocatoria,
  puedePublicarse,
  planPublicarConvocatoria,
} from "./convocatoria";
import {
  equipoConfirmado,
  lugaresLibres,
  rolCompleto,
  todosLosRolesCompletos,
  type EstadoDeRol,
} from "./cupos";
import { puedePostularse, type CandidatoAConvocatoria } from "./elegibilidad";
import {
  buildAssignmentConfirmedEmail,
  buildAssignmentInvitedEmail,
  buildCallPublishedEmail,
  buildTeamCompleteEmail,
  destinatariosDeColaboradores,
  destinatariosDeCoordinacion,
} from "./emails";
import {
  ROL_YA_LLENO,
  efectosSobreLaBusqueda,
  planResponderInvitacion,
  planSeleccionarPostulacion,
  postulacionesQueSeCierran,
} from "./equipo";
import { planGenerarCobertura, sugerirCobertura, sugerirRoles } from "./generar-cobertura";
import { DEFAULT_COVERAGE_SETTINGS } from "./settings";

/**
 * Los criterios de la etapa 1b, como test: de una solicitud aprobada a un equipo confirmado.
 *
 * No repite lo que ya prueba el test de cada pieza. Recorre el circuito ENTERO con los mismos
 * datos del caso de demostración, que es la única forma de descubrir que siete piezas correctas
 * por separado no encajan entre sí: cada tanda de esta etapa la escribió alguien que veía
 * solamente su pedazo.
 *
 * Todo con funciones puras, sin base de datos y sin mandar un solo correo: lo que se verifica
 * acá son las reglas, que es justo lo que una prueba con base escondería atrás de un `INSERT`.
 *
 * Los datos son los del §32 del documento original, los mismos que usa
 * `criterios-de-aceptacion.test.ts` de la etapa 1a: Asociación Manos Abiertas, jornada solidaria
 * del 26.09.2026 de 14:00 a 18:30 en Rosario, 4 h 30 de duración.
 */

const settings = DEFAULT_COVERAGE_SETTINGS;
const inicio = new Date("2026-09-26T17:00:00Z"); // 14:00 en Argentina
const fin = new Date("2026-09-26T21:30:00Z"); // 18:30
const ahora = new Date("2026-09-15T12:00:00Z");

/** La solicitud ya aprobada por la coordinación, que es donde termina la etapa 1a. */
const solicitud = {
  id: "sol-1",
  workspaceId: "ws-manos",
  status: "APROBADA",
  eventTitle: "Jornada solidaria para familias",
  startsAt: inicio,
  endsAt: fin,
  addressLine: "San Martín 1234",
  city: "Rosario",
  requestedPhotographers: 1,
};

/** Un rol con sus cupos, para no repetir los tres campos en cada paso. */
function rol(estado: Partial<EstadoDeRol> = {}): EstadoDeRol {
  return { vacancies: 1, asignadasVivas: 0, asignadasAceptadas: 0, ...estado };
}

describe("de la solicitud aprobada a la cobertura con sus roles", () => {
  it("la cobertura se precarga con lo que la organización ya escribió", () => {
    // Nadie vuelve a tipear el título, las fechas ni el lugar de una actividad ya aprobada.
    expect(sugerirCobertura(solicitud)).toEqual({
      title: "Jornada solidaria para familias",
      startsAt: inicio,
      endsAt: fin,
      addressLine: "San Martín 1234",
      city: "Rosario",
    });
  });

  it("pidieron un fotógrafo, pero 4 h 30 supera el umbral y se proponen dos roles", () => {
    // Es la recomendación de refuerzo de la etapa 1a convertida en roles concretos: el mismo
    // aviso que la ficha de la solicitud muestra, acá ya viene armado como puesto.
    expect(sugerirRoles(solicitud, settings)).toEqual([
      { name: "Fotógrafo principal", vacancies: 1 },
      { name: "Segundo fotógrafo", vacancies: 1 },
    ]);
  });

  it("solo se genera desde una solicitud APROBADA, y solo de este workspace", () => {
    const roles = sugerirRoles(solicitud, settings);

    expect(planGenerarCobertura({ solicitud, workspaceId: "ws-manos", roles })).toEqual({
      ok: true,
    });
    expect(
      planGenerarCobertura({
        solicitud: { ...solicitud, status: "EN_EVALUACION" },
        workspaceId: "ws-manos",
        roles,
      }).ok,
    ).toBe(false);
    // Una solicitud de otra institución no existe para esta: mismo mensaje que si no existiera.
    expect(planGenerarCobertura({ solicitud, workspaceId: "ws-otra", roles }).ok).toBe(false);
  });
});

describe("la convocatoria: crearla y publicarla", () => {
  const roles = [rol(), rol()];

  it("se crea tanto desde PLANIFICADA como desde BUSCANDO_EQUIPO", () => {
    // Las dos, y no solo la primera: una invitación directa mueve sola la cobertura a
    // BUSCANDO_EQUIPO (ver `efectosSobreLaBusqueda`), así que exigir PLANIFICADA dejaría sin
    // convocatoria al caso mixto —invito a la que sé que puede, publico para la segunda—.
    expect(puedeCrearseConvocatoria({ coverageStatus: "PLANIFICADA", yaExiste: false })).toEqual({
      ok: true,
    });
    expect(
      puedeCrearseConvocatoria({ coverageStatus: "BUSCANDO_EQUIPO", yaExiste: false }),
    ).toEqual({ ok: true });
  });

  it("una cobertura que ya tiene convocatoria no genera otra, y una cancelada tampoco", () => {
    expect(puedeCrearseConvocatoria({ coverageStatus: "PLANIFICADA", yaExiste: true }).ok).toBe(
      false,
    );
    expect(puedeCrearseConvocatoria({ coverageStatus: "CANCELADA", yaExiste: false }).ok).toBe(
      false,
    );
  });

  it("para publicar hacen falta un título y al menos un rol con lugar", () => {
    expect(puedePublicarse({ title: "Jornada solidaria" }, roles)).toEqual({ ok: true });
    expect(puedePublicarse({ title: null }, roles).ok).toBe(false);
    expect(puedePublicarse({ title: "Jornada solidaria" }, []).ok).toBe(false);
  });

  it("al publicar, la cobertura entra en búsqueda de equipo", () => {
    const plan = planPublicarConvocatoria({
      call: { workspaceId: "ws-manos", status: "BORRADOR", title: "Jornada solidaria" },
      coverage: { status: "PLANIFICADA" },
      roles,
      workspaceId: "ws-manos",
    });
    expect(plan).toEqual({ ok: true, moverCobertura: true });
  });

  it("si ya estaba buscando equipo, publicar no la vuelve a mover", () => {
    // Sin esto, el historial mostraría «buscando equipo → buscando equipo» sobre un cambio que
    // no ocurrió.
    const plan = planPublicarConvocatoria({
      call: { workspaceId: "ws-manos", status: "BORRADOR", title: "Jornada solidaria" },
      coverage: { status: "BUSCANDO_EQUIPO" },
      roles,
      workspaceId: "ws-manos",
    });
    expect(plan).toEqual({ ok: true, moverCobertura: false });
  });
});

describe("quién puede anotarse", () => {
  const candidato: CandidatoAConvocatoria = {
    tienePerfilActivo: true,
    yaSePostulo: false,
    yaEstaAsignado: false,
    convocatoriaStatus: "PUBLICADA",
    cierreDePostulaciones: null,
  };

  it("un colaborador activo se anota a la convocatoria publicada", () => {
    expect(puedePostularse(candidato, ahora)).toEqual({ puede: true });
  });

  it("sin perfil de colaborador activo, no: es la llave de todo el portal", () => {
    expect(puedePostularse({ ...candidato, tienePerfilActivo: false }, ahora)).toEqual({
      puede: false,
      motivo: "Todavía no estás habilitado para anotarte.",
    });
  });

  it("las cinco razones salen en el orden del plan, no en el que convenga a quien programa", () => {
    // Con todo mal a la vez, la persona lee la PRIMERA causa: la del perfil. Si el orden se
    // rompiera, alguien sin perfil recibiría "ya te anotaste", que no le dice nada.
    const todoMal: CandidatoAConvocatoria = {
      tienePerfilActivo: false,
      yaSePostulo: true,
      yaEstaAsignado: true,
      convocatoriaStatus: "CERRADA",
      cierreDePostulaciones: new Date("2026-09-01T00:00:00Z"),
    };
    const motivos = [
      puedePostularse(todoMal, ahora),
      puedePostularse({ ...todoMal, tienePerfilActivo: true }, ahora),
      puedePostularse({ ...todoMal, tienePerfilActivo: true, convocatoriaStatus: "PUBLICADA" }, ahora),
      puedePostularse(
        {
          ...todoMal,
          tienePerfilActivo: true,
          convocatoriaStatus: "PUBLICADA",
          cierreDePostulaciones: null,
        },
        ahora,
      ),
      puedePostularse(
        {
          ...todoMal,
          tienePerfilActivo: true,
          convocatoriaStatus: "PUBLICADA",
          cierreDePostulaciones: null,
          yaEstaAsignado: false,
        },
        ahora,
      ),
    ].map((r) => (r.puede ? null : r.motivo));

    expect(motivos).toEqual([
      "Todavía no estás habilitado para anotarte.",
      "Esta convocatoria no está abierta.",
      "El plazo para anotarse ya cerró.",
      "Ya estás en el equipo de esta cobertura.",
      "Ya te anotaste.",
    ]);
  });

  it("un rol lleno NO impide anotarse: existen los suplentes", () => {
    // El cupo y la elegibilidad son preguntas distintas. La coordinación puede querer alguien
    // de respaldo, y por eso `puedePostularse` ni siquiera recibe cuántos lugares quedan.
    const lleno = rol({ asignadasVivas: 1 });
    expect(rolCompleto(lleno)).toBe(true);
    expect(lugaresLibres(lleno)).toBe(0);
    expect(puedePostularse(candidato, ahora)).toEqual({ puede: true });
  });
});

describe("armar el equipo, y la distinción que sostiene toda la etapa", () => {
  it("la coordinación selecciona a quien se anotó y la persona queda invitada", () => {
    expect(
      planSeleccionarPostulacion({
        coverageStatus: "BUSCANDO_EQUIPO",
        applicationStatus: "RECIBIDA",
        yaEstaAsignado: false,
        rol: rol(),
      }),
    ).toEqual({ ok: true });
  });

  it("dos personas anotadas a un rol de una vacante: solo una puede quedar", () => {
    // La segunda selección ve el rol ya ocupado. Dos coordinadores mirando la misma pantalla es
    // un caso real, y por eso el recuento se rehace antes de escribir.
    const despuesDeLaPrimera = rol({ asignadasVivas: 1 });
    expect(
      planSeleccionarPostulacion({
        coverageStatus: "BUSCANDO_EQUIPO",
        applicationStatus: "RECIBIDA",
        yaEstaAsignado: false,
        rol: despuesDeLaPrimera,
      }),
    ).toEqual({ ok: false, error: ROL_YA_LLENO });
  });

  it("ROL COMPLETO NO ES EQUIPO CONFIRMADO: invitadas a los dos roles, nadie contestó todavía", () => {
    // **La distinción que más importa de toda la etapa.** Con las dos invitaciones mandadas ya
    // no queda a quién invitar —la convocatoria se cierra, «dejá de buscar gente»— pero el
    // equipo NO existe: nadie dijo que sí. Unificar las dos ideas le avisaría a la Asociación
    // Manos Abiertas que ya tiene equipo cuando todavía no contestó nadie.
    const invitadas = [rol({ asignadasVivas: 1 }), rol({ asignadasVivas: 1 })];

    expect(todosLosRolesCompletos(invitadas)).toBe(true);
    expect(equipoConfirmado(invitadas)).toBe(false);

    expect(
      efectosSobreLaBusqueda({
        roles: invitadas,
        callStatus: "PUBLICADA",
        coverageStatus: "BUSCANDO_EQUIPO",
      }),
    ).toEqual({ callStatus: "COMPLETA", coverageStatus: null });
  });

  it("recién cuando las dos aceptan, la cobertura queda con el equipo confirmado", () => {
    const confirmadas = [
      rol({ asignadasVivas: 1, asignadasAceptadas: 1 }),
      rol({ asignadasVivas: 1, asignadasAceptadas: 1 }),
    ];

    expect(equipoConfirmado(confirmadas)).toBe(true);
    expect(
      efectosSobreLaBusqueda({
        roles: confirmadas,
        callStatus: "COMPLETA",
        coverageStatus: "BUSCANDO_EQUIPO",
      }),
    ).toEqual({ callStatus: null, coverageStatus: "EQUIPO_CONFIRMADO" });
  });

  it("con el equipo confirmado se cierran las postulaciones que nadie contestó", () => {
    // Quien se ofreció un sábado y no quedó no puede seguir leyendo "te anotaste" seis meses
    // después. Se cierran sin correo: un "no fuiste elegida" hace más daño que el silencio.
    expect(
      postulacionesQueSeCierran({
        equipoQuedoConfirmado: true,
        postulaciones: [
          { id: "p-ana", status: "SELECCIONADA" },
          { id: "p-juan", status: "RECIBIDA" },
        ],
      }),
    ).toEqual(["p-juan"]);
  });

  it("invitar a alguien con la convocatoria en borrador no la publica de costado", () => {
    // Publicar pone `publishedAt`, valida con `puedePublicarse` y le avisa a cada colaborador.
    // Que armar el equipo lo hiciera solo dejaba la convocatoria visible en el portal sin que
    // nadie se enterara.
    expect(
      efectosSobreLaBusqueda({
        roles: [rol({ asignadasVivas: 1 }), rol()],
        callStatus: "BORRADOR",
        coverageStatus: "BUSCANDO_EQUIPO",
      }),
    ).toEqual({ callStatus: null, coverageStatus: null });
  });
});

describe("cuando alguien no puede", () => {
  it("contesta «no puedo» y su asignación queda rechazada", () => {
    expect(planResponderInvitacion({ assignmentStatus: "INVITADA", respuesta: "NO_PUEDO" })).toEqual(
      { ok: true, nuevoEstado: "RECHAZADA" },
    );
  });

  it("el rechazo devuelve el lugar, reabre la convocatoria y saca a la cobertura de confirmada", () => {
    // **Sin este camino de vuelta, un rechazo deja la cobertura diciendo que tiene equipo y
    // nadie se entera de que falta cubrir un lugar.**
    const despuesDelRechazo = [
      rol({ asignadasVivas: 1, asignadasAceptadas: 1 }),
      rol({ asignadasVivas: 0, asignadasAceptadas: 0 }),
    ];

    expect(lugaresLibres(despuesDelRechazo[1])).toBe(1);
    expect(todosLosRolesCompletos(despuesDelRechazo)).toBe(false);
    expect(equipoConfirmado(despuesDelRechazo)).toBe(false);

    expect(
      efectosSobreLaBusqueda({
        roles: despuesDelRechazo,
        callStatus: "COMPLETA",
        coverageStatus: "EQUIPO_CONFIRMADO",
      }),
    ).toEqual({ callStatus: "PUBLICADA", coverageStatus: "BUSCANDO_EQUIPO" });
  });

  it("la convocatoria reabierta vuelve a ser publicable: el rol tiene lugar otra vez", () => {
    expect(
      puedePublicarse({ title: "Jornada solidaria" }, [
        rol({ asignadasVivas: 1, asignadasAceptadas: 1 }),
        rol(),
      ]),
    ).toEqual({ ok: true });
  });

  it("responder dos veces no es un error de nadie", () => {
    // El botón apretado dos veces en el teléfono, o el enlace de WhatsApp abierto al día
    // siguiente. Sale por una rama propia para que la pantalla lo muestre en gris, no en rojo.
    const r = planResponderInvitacion({ assignmentStatus: "CONFIRMADA", respuesta: "CONFIRMO" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.yaRespondida).toBe(true);
  });
});

describe("cada correo le llega a quien tiene que llegarle", () => {
  const contexto = { organizationName: "FOTOPOSITIVA", signature: null };
  const fechaLabel = "26.09.2026 14:00";

  it("el de la convocatoria sale uno por persona, nunca en copia", () => {
    // La dirección de un voluntario es un dato suyo: ponerla a la vista de los otros cuarenta
    // colaboradores la reparte sin que nadie lo haya autorizado. Por eso esto devuelve una
    // LISTA de direcciones sueltas y no una cadena para el campo «para».
    const destinatarios = destinatariosDeColaboradores([
      { email: "ana@manos.org" },
      { email: "  JUAN@manos.org " },
      { email: "juan@manos.org" }, // la misma persona, escrita distinto
      { email: null },
      { email: "ana@manos.org, juan@manos.org" }, // dos en un campo de texto libre
    ]);
    expect(destinatarios).toEqual(["ana@manos.org", "JUAN@manos.org"]);
  });

  it("el de la convocatoria no promete cuántos lugares quedan", () => {
    // Entre que sale el correo y que la persona lo abre, ese número ya cambió.
    const m = buildCallPublishedEmail({
      context: contexto,
      greetingName: "Ana",
      callTitle: "Jornada solidaria",
      coverageTitle: "Jornada solidaria para familias",
      fechaLabel,
      city: "Rosario",
      publicSummary: null,
      callUrl: "https://fotoffice.com/portal/coberturas/call-1",
    });
    expect(m.text).toContain("Hola Ana,");
    expect(m.text).toContain("https://fotoffice.com/portal/coberturas/call-1");
    expect(m.text).not.toMatch(/lugares? libres?/);
  });

  it("el de la invitación va a esa persona y la lleva derecho a contestar", () => {
    const m = buildAssignmentInvitedEmail({
      context: contexto,
      greetingName: "Ana",
      coverageTitle: "Jornada solidaria para familias",
      roleName: "Fotógrafo principal",
      fechaLabel,
      city: "Rosario",
      assignmentUrl: "https://fotoffice.com/portal/coberturas/asignacion/asig-1",
      respondByLabel: "20.09.2026",
    });
    expect(m.subject).toContain("Jornada solidaria para familias");
    expect(m.text).toContain("Fotógrafo principal");
    expect(m.text).toContain("/portal/coberturas/asignacion/asig-1");
    expect(m.text).toContain("20.09.2026");
  });

  it("el de la confirmación es interno: va a la coordinación y no lleva firma", () => {
    const destinatarios = destinatariosDeCoordinacion({
      notifyEmails: ["coordinacion@fotopositiva.org"],
      contactEmail: "hola@fotopositiva.org",
    });
    expect(destinatarios).toEqual(["coordinacion@fotopositiva.org"]);

    // Sin nadie configurado cae al contacto de la institución, y sin eso no sale para nadie.
    expect(
      destinatariosDeCoordinacion({ notifyEmails: [], contactEmail: "hola@fotopositiva.org" }),
    ).toEqual(["hola@fotopositiva.org"]);
    expect(destinatariosDeCoordinacion({ notifyEmails: [], contactEmail: null })).toEqual([]);

    const m = buildAssignmentConfirmedEmail({
      coverageTitle: "Jornada solidaria para familias",
      personName: "Ana Pérez",
      roleName: "Fotógrafo principal",
      fechaLabel,
      equipoCompleto: true,
      panelUrl: "https://fotoffice.com/coberturas/c/cob-1",
    });
    expect(m.text).toContain("Ana Pérez");
    expect(m.text).toContain("el equipo quedó completo");
    // El nombre de quien confirmó NO va en el asunto: el registro de envíos lo guarda, y ese
    // registro es para saber si un aviso salió, no para anotar quién participa de qué.
    expect(m.subject).not.toContain("Ana Pérez");
  });

  it("el de equipo completo va a la organización solicitante y no dice quiénes van", () => {
    const m = buildTeamCompleteEmail({
      context: contexto,
      publicCode: "SC-2026-0042",
      eventTitle: "Jornada solidaria para familias",
      contactName: "María",
      fechaLabel,
      city: "Rosario",
      trackingUrl: "https://fotoffice.com/sc/UN-TOKEN-NUEVO",
    });
    expect(m.subject).toContain("SC-2026-0042");
    expect(m.text).toContain("Hola María,");
    expect(m.text).toContain("https://fotoffice.com/sc/UN-TOKEN-NUEVO");
    // Quiénes son las personas es asunto del día de la actividad, no de un correo reenviable.
    expect(m.text).not.toContain("Ana Pérez");
    expect(m.text).not.toContain("Fotógrafo principal");
  });

  it("sin enlace no se pinta un botón muerto", () => {
    // Pasa cuando no hay `appUrl()` con qué armarlo: el resto del correo sale igual.
    const m = buildAssignmentInvitedEmail({
      context: contexto,
      greetingName: null,
      coverageTitle: "Jornada solidaria para familias",
      roleName: "Segundo fotógrafo",
      fechaLabel,
      city: null,
      assignmentUrl: "",
      respondByLabel: null,
    });
    expect(m.html).not.toContain("<a href");
    expect(m.text).toContain("Segundo fotógrafo");
  });
});
