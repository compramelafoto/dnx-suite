import { equipoConfirmado, rolCompleto, todosLosRolesCompletos, type EstadoDeRol } from "./cupos";
import { COVERAGE_LIVE_STATUSES, isCoverageStatus, type AssignmentStatus } from "./states";
import {
  canTransitionApplication,
  canTransitionCall,
  canTransitionCoverage,
} from "./transitions";

/**
 * Armar el equipo: seleccionar una postulación, invitar directo, y responder la invitación.
 *
 * Funciones puras, sin Prisma: quien las llama ya contó las asignaciones vivas del rol y leyó
 * los estados, y acá se decide. La pantalla no decide nada — estas mismas funciones se vuelven
 * a llamar en el servidor, dentro de la transacción que escribe.
 *
 * Los mensajes son de voluntariado: nadie "fue desestimado" ni "no cumple los requisitos".
 * Quien se anotó y hoy no quedó, se anotó y hoy no hizo falta.
 */

export type ResultadoDePlan = { ok: true } | { ok: false; error: string };

/**
 * De dónde salió cada asignación, como se lee en pantalla.
 *
 * `POSTULACION` e `INVITACION_DIRECTA` son los dos valores de `CoverageAssignment.origin` en el
 * modelo. La diferencia importa para quien coordina: no es lo mismo alguien que se ofreció que
 * alguien a quien salimos a buscar, aunque las dos terminen en el mismo estado.
 */
export const ASSIGNMENT_ORIGIN_LABELS: Record<string, string> = {
  POSTULACION: "Se anotó",
  INVITACION_DIRECTA: "La invitamos",
};

export function assignmentOriginLabel(origin: string): string {
  return ASSIGNMENT_ORIGIN_LABELS[origin] ?? origin;
}

/**
 * Un choque de cupo detectado DENTRO de la transacción.
 *
 * Existe como clase propia porque la única forma de abortar una transacción de Prisma sin
 * dejar escrituras a medias es lanzando: devolver `{ ok: false }` desde adentro del callback
 * confirmaría igual lo que ya se escribió. Quien la lanza la vuelve a atrapar afuera y
 * convierte su mensaje en el aviso que lee la coordinación, en vez de un error de sistema.
 */
export class ConflictoDeEquipo extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ConflictoDeEquipo";
  }
}

/**
 * El aviso cuando dos coordinadores miran la misma pantalla.
 *
 * Una sola constante y no el texto repetido en cada rama: es el mismo hecho —el lugar se
 * ocupó mientras tanto— lo vea quien seleccione una postulación o quien invite directo.
 */
export const ROL_YA_LLENO = "Ese rol ya se llenó mientras mirabas la pantalla.";

/**
 * Si esta cobertura todavía admite sumar gente a su equipo.
 *
 * Se apoya en `COVERAGE_LIVE_STATUSES` y no en una lista propia: una cobertura realizada,
 * entregada, cerrada o cancelada ya no tiene equipo que armar, y son exactamente las que esa
 * lista deja afuera. `PLANIFICADA` sí entra: invitar directo antes de publicar una convocatoria
 * es el modo de asignación `DIRECTA` de la configuración, no un adelanto indebido.
 */
export function puedeArmarseElEquipo(coverageStatus: string): boolean {
  return (
    isCoverageStatus(coverageStatus) &&
    (COVERAGE_LIVE_STATUSES as readonly string[]).includes(coverageStatus)
  );
}

/**
 * Si se puede convertir esta postulación en una invitación.
 *
 * El orden importa: primero la cobertura —si ya no admite gente, nada de lo demás importa—,
 * después la persona, y recién al final el cupo. Así el mensaje que lee quien coordina es el
 * de la causa real y no el del último control que se ejecutó.
 */
export function planSeleccionarPostulacion(input: {
  coverageStatus: string;
  /** Estado de la postulación: solo las vivas se pueden seleccionar. */
  applicationStatus: string;
  /** Si esa persona ya tiene una asignación viva en ESTA cobertura. */
  yaEstaAsignado: boolean;
  /** El rol, con las asignaciones vivas contadas recién. */
  rol: EstadoDeRol;
}): ResultadoDePlan {
  if (!puedeArmarseElEquipo(input.coverageStatus)) {
    return { ok: false, error: "Esta cobertura ya no admite sumar gente." };
  }
  // La máquina de estados de la postulación decide esto, no una lista repetida acá: seleccionar
  // es exactamente `X → SELECCIONADA`, y `canTransitionApplication` ya sabe desde qué estados
  // vivos se llega.
  if (!canTransitionApplication(input.applicationStatus, "SELECCIONADA")) {
    return { ok: false, error: "Esa postulación ya está resuelta." };
  }
  if (input.yaEstaAsignado) {
    return { ok: false, error: "Esa persona ya está en el equipo de esta cobertura." };
  }
  if (rolCompleto(input.rol)) {
    return { ok: false, error: ROL_YA_LLENO };
  }
  return { ok: true };
}

/**
 * Si se puede invitar directo a esta persona.
 *
 * Mismo orden que al seleccionar, con un control más: el perfil de colaborador activo. Al
 * seleccionar una postulación ese control ya lo hizo el portal cuando la persona se anotó; acá
 * no hay postulación previa, así que se mira de nuevo.
 */
export function planInvitacionDirecta(input: {
  coverageStatus: string;
  tienePerfilActivo: boolean;
  yaEstaAsignado: boolean;
  rol: EstadoDeRol;
}): ResultadoDePlan {
  if (!puedeArmarseElEquipo(input.coverageStatus)) {
    return { ok: false, error: "Esta cobertura ya no admite sumar gente." };
  }
  if (!input.tienePerfilActivo) {
    return { ok: false, error: "Esa persona todavía no está habilitada como colaboradora." };
  }
  if (input.yaEstaAsignado) {
    return { ok: false, error: "Esa persona ya está en el equipo de esta cobertura." };
  }
  if (rolCompleto(input.rol)) {
    return { ok: false, error: ROL_YA_LLENO };
  }
  return { ok: true };
}

export type RespuestaAInvitacion = "CONFIRMO" | "NO_PUEDO";

export type PlanDeRespuesta =
  | { ok: true; nuevoEstado: Extract<AssignmentStatus, "CONFIRMADA" | "RECHAZADA"> }
  /** Ya había contestado: no es un error de nadie, así que se avisa con calma. */
  | { ok: false; yaRespondida: true; aviso: string }
  | { ok: false; yaRespondida: false; error: string };

export const YA_RESPONDIDA = "Ya respondiste esta invitación. No hace falta que hagas nada más.";

/**
 * Qué hacer con la respuesta de quien fue invitada.
 *
 * Responder dos veces —el botón apretado dos veces en el teléfono, el enlace de WhatsApp
 * abierto de nuevo al día siguiente— no es un error de la persona, y tratarlo como tal la deja
 * pensando que algo se rompió. Por eso "ya respondiste" sale por una rama propia y no mezclado
 * con los errores de verdad: quien llama puede mostrarlo en gris y no en rojo.
 */
export function planResponderInvitacion(input: {
  assignmentStatus: string;
  respuesta: string;
}): PlanDeRespuesta {
  if (input.assignmentStatus !== "INVITADA") {
    return { ok: false, yaRespondida: true, aviso: YA_RESPONDIDA };
  }
  if (input.respuesta === "CONFIRMO") return { ok: true, nuevoEstado: "CONFIRMADA" };
  if (input.respuesta === "NO_PUEDO") return { ok: true, nuevoEstado: "RECHAZADA" };
  return { ok: false, yaRespondida: false, error: "No entendimos tu respuesta. Probá de nuevo." };
}

export type EfectosSobreLaBusqueda = {
  /** Nuevo estado de la convocatoria, o `null` si no hay que tocarla. */
  callStatus: string | null;
  /** Nuevo estado de la cobertura, o `null` si no hay que tocarla. */
  coverageStatus: string | null;
};

/**
 * Qué le pasa a la convocatoria y a la cobertura después de tocar el equipo.
 *
 * **Son dos momentos distintos y por eso se deciden con dos funciones distintas**, aunque el
 * plan los nombre en una sola frase:
 *
 * - La convocatoria se cierra (`COMPLETA`) cuando ya no queda a quién invitar
 *   (`todosLosRolesCompletos`, que cuenta las asignaciones VIVAS). Significa "dejá de buscar
 *   gente", y es verdad apenas se manda la última invitación.
 * - La cobertura pasa a `EQUIPO_CONFIRMADO` solo cuando todo el mundo dijo que sí
 *   (`equipoConfirmado`, que cuenta las ACEPTADAS). Significa "el equipo existe de verdad".
 *
 * Unificarlos le avisaría a la organización solicitante que ya tiene equipo cuando en realidad
 * nadie contestó todavía.
 *
 * Y al revés: cuando alguien rechaza, el rol vuelve a tener lugar libre, así que la
 * convocatoria vuelve de `COMPLETA` a `PUBLICADA` y la cobertura de `EQUIPO_CONFIRMADO` a
 * `BUSCANDO_EQUIPO`. Sin ese camino de vuelta, un rechazo deja la cobertura diciendo que tiene
 * equipo y nadie se entera de que falta cubrir un lugar.
 *
 * Cada cambio pasa por `canTransitionX` antes de proponerse: una cobertura `PLANIFICADA` con
 * todo el equipo invitado directo no salta a `EQUIPO_CONFIRMADO` —esa transición no existe—
 * y esta función simplemente no la propone, en vez de que la acción escriba un estado
 * imposible.
 *
 * Los roles que recibe son los de DESPUÉS del cambio: quien la llama ya volvió a contar.
 */
export function efectosSobreLaBusqueda(input: {
  roles: EstadoDeRol[];
  /** `null` cuando la cobertura todavía no tiene convocatoria (invitación directa pura). */
  callStatus: string | null;
  coverageStatus: string;
}): EfectosSobreLaBusqueda {
  const sinLugares = todosLosRolesCompletos(input.roles);
  const confirmado = equipoConfirmado(input.roles);

  let callStatus: string | null = null;
  if (input.callStatus !== null) {
    const destinoConvocatoria = sinLugares ? "COMPLETA" : "PUBLICADA";
    if (canTransitionCall(input.callStatus, destinoConvocatoria)) {
      callStatus = destinoConvocatoria;
    }
  }

  /**
   * El camino de IDA a `BUSCANDO_EQUIPO`, que antes no existía.
   *
   * Hasta acá, una cobertura solo salía de `PLANIFICADA` al publicar su convocatoria. Un
   * workspace que arma el equipo únicamente a dedo —el modo de asignación `DIRECTA`— no publica
   * ninguna, así que su cobertura se quedaba en `PLANIFICADA` aunque todo el mundo confirmara,
   * y nunca podía llegar a `EQUIPO_CONFIRMADO` (esa transición sale de `BUSCANDO_EQUIPO`).
   *
   * Ahora invitar a alguien alcanza para entrar en búsqueda, y cada estado conserva un solo
   * significado: `PLANIFICADA` = todavía no se movió nadie; `BUSCANDO_EQUIPO` = falta gente, sea
   * por convocatoria o a dedo. El precio es que la convocatoria ya no se puede crear solo desde
   * `PLANIFICADA`: `puedeCrearseConvocatoria` acepta también `BUSCANDO_EQUIPO` (ver
   * `convocatoria.ts`), así que invitar a alguien primero no deja a la coordinación sin poder
   * publicar después.
   *
   * La ida se mira ANTES que la confirmación a propósito: desde `PLANIFICADA` no existe el salto
   * directo a `EQUIPO_CONFIRMADO`, así que proponerlo devolvería `null` y la cobertura quedaría
   * trabada. Avanzando un paso, el toque siguiente sobre el equipo la confirma.
   */
  const hayGenteViva = input.roles.some((r) => r.asignadasVivas > 0);

  let destinoCobertura: string | null = null;
  if (input.coverageStatus === "PLANIFICADA") {
    destinoCobertura = hayGenteViva ? "BUSCANDO_EQUIPO" : null;
  } else if (confirmado) {
    destinoCobertura = "EQUIPO_CONFIRMADO";
  } else if (input.coverageStatus === "EQUIPO_CONFIRMADO") {
    // La vuelta: alguien ya asignado rechazó y el rol volvió a tener lugar libre.
    destinoCobertura = "BUSCANDO_EQUIPO";
  }
  const coverageStatus =
    destinoCobertura !== null && canTransitionCoverage(input.coverageStatus, destinoCobertura)
      ? destinoCobertura
      : null;

  return { callStatus, coverageStatus };
}

/**
 * Las postulaciones que hay que cerrar cuando el equipo ya quedó armado.
 *
 * Hasta acá, quien se anotaba y no era elegida se quedaba en `RECIBIDA` para siempre: la
 * coordinación elegía a otra persona y nadie volvía a tocar su postulación, así que el portal
 * le seguía diciendo "te anotaste" meses después de la actividad. Dejar a alguien esperando una
 * respuesta que nunca va a llegar es peor que decirle que esta vez no hizo falta.
 *
 * Se cierra **cuando la cobertura llega a `EQUIPO_CONFIRMADO`**, no cuando la convocatoria se
 * pone `COMPLETA`: `COMPLETA` es "dejamos de buscar" y todavía puede volver atrás si alguien
 * rechaza —y ahí esas postulaciones vuelven a servir—. `EQUIPO_CONFIRMADO` es "el equipo
 * existe", y recién ahí la espera dejó de tener sentido.
 *
 * **Sin correo.** Nadie recibe un "no fuiste elegida": en un voluntariado, un aviso así hace más
 * daño que el silencio. El estado se ve en el portal, con las palabras del portal.
 *
 * Decide con `canTransitionApplication` en vez de comparar contra `"RECIBIDA"` a mano: así
 * también alcanza a las que quedaron `EN_REVISION` o `PRESELECCIONADA` —hoy ninguna pantalla las
 * pone ahí, pero el día que exista esa revisión formal no van a quedar colgadas— y es imposible
 * que esta función proponga una transición que la máquina de estados no admite.
 */
export function postulacionesQueSeCierran(input: {
  equipoQuedoConfirmado: boolean;
  postulaciones: readonly { id: string; status: string }[];
}): string[] {
  if (!input.equipoQuedoConfirmado) return [];
  return input.postulaciones
    .filter((p) => canTransitionApplication(p.status, "NO_SELECCIONADA"))
    .map((p) => p.id);
}
