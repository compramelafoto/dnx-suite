import { lugaresLibres, type EstadoDeRol } from "./cupos";
import { assertCallTransition, assertCoverageTransition } from "./transitions";

/**
 * Crear, editar y publicar la convocatoria.
 *
 * Función pura, sin Prisma: qué hace falta para publicar se prueba sin base de datos, igual que
 * el resto del dominio del módulo.
 */

export type ConvocatoriaParaPublicar = { title: string | null };

/**
 * Si esta convocatoria puede publicarse: hace falta un título y al menos un rol con lugar.
 *
 * "Con lugar" es `lugaresLibres(rol) > 0`, no "con vacantes definidas": la misma función sirve
 * para la primera publicación (nadie tiene asignación todavía, así que alcanza con que el rol
 * tenga alguna vacante) y para cuando la convocatoria vuelve de `COMPLETA` a `PUBLICADA` porque
 * alguien ya asignado rechazó — ahí el rol vuelve a tener lugar libre y esta misma regla lo
 * detecta sin que nadie tenga que repetirla.
 */
export function puedePublicarse(
  call: ConvocatoriaParaPublicar,
  roles: EstadoDeRol[],
): { ok: true } | { ok: false; error: string } {
  if (!call.title?.trim()) {
    return { ok: false, error: "Ponele un título a la convocatoria." };
  }
  if (!roles.some((r) => lugaresLibres(r) > 0)) {
    return { ok: false, error: "Agregá al menos un rol con vacantes." };
  }
  return { ok: true };
}

/**
 * Los dos estados en los que todavía tiene sentido salir a buscar gente.
 *
 * `PLANIFICADA` es "todavía no se movió nadie"; `BUSCANDO_EQUIPO`, "falta gente". Las dos
 * admiten una convocatoria. Más adelante —realizada, entregada, cerrada, cancelada, o con el
 * equipo ya confirmado— publicar una sería llamar a gente para un lugar que no existe.
 */
const ESTADOS_QUE_ADMITEN_CONVOCATORIA = ["PLANIFICADA", "BUSCANDO_EQUIPO"];

/**
 * Si corresponde crear la convocatoria de esta cobertura.
 *
 * `CoverageCall` es 1:1 con `Coverage` (columna `@unique` en el modelo): una cobertura tiene a
 * lo sumo una convocatoria en toda su vida, así que "ya existe" no se resuelve reintentando ni
 * sobrescribiendo, se avisa.
 *
 * Acepta `BUSCANDO_EQUIPO` además de `PLANIFICADA`, y no es un detalle: desde que una invitación
 * directa mueve la cobertura a `BUSCANDO_EQUIPO` (ver `efectosSobreLaBusqueda` en `equipo.ts`),
 * exigir `PLANIFICADA` dejaría sin convocatoria a toda cobertura donde se haya invitado a
 * alguien a dedo primero — que es justo el caso mixto que esto tiene que permitir: invito a la
 * fotógrafa que sé que puede, y publico para conseguir la segunda.
 */
export function puedeCrearseConvocatoria(input: {
  coverageStatus: string;
  yaExiste: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (input.yaExiste) {
    return { ok: false, error: "Esta cobertura ya tiene una convocatoria." };
  }
  if (!ESTADOS_QUE_ADMITEN_CONVOCATORIA.includes(input.coverageStatus)) {
    return {
      ok: false,
      error: "Esta cobertura ya no admite una convocatoria: solo se crea mientras falta gente.",
    };
  }
  return { ok: true };
}

/** Solo se edita en `BORRADOR`. Publicada, editarla desde acá dejaría de avisarle a nadie del cambio. */
export function puedeEditarseConvocatoria(status: string): boolean {
  return status === "BORRADOR";
}

export type PlanPublicarConvocatoria =
  /**
   * `moverCobertura` dice si además hay que pasar la cobertura a `BUSCANDO_EQUIPO`.
   *
   * No siempre hace falta: desde que una invitación directa la mueve sola, la cobertura puede
   * llegar a la publicación ya en `BUSCANDO_EQUIPO`, y ahí escribir el mismo estado otra vez
   * duplicaría el evento del historial —«cambio de estado: buscando equipo → buscando
   * equipo»— sobre un cambio que no ocurrió.
   */
  | { ok: true; moverCobertura: boolean }
  | { ok: false; error: string };

/**
 * Los tres controles antes de publicar, en el orden que importa: primero que la convocatoria
 * sea de este workspace, después que la transición de estado exista, y recién ahí el contenido
 * (título y vacantes).
 *
 * La cobertura pasa a `BUSCANDO_EQUIPO` en la misma transacción **si todavía no estaba ahí**, y
 * por eso esta función valida esa transición: publicar sobre una cobertura que ya no puede
 * entrar en búsqueda (por ejemplo, cancelada) no tiene que dejar a las dos entidades contando
 * historias distintas. Una que YA está buscando equipo pasa igual —no hay nada que mover— y por
 * eso el estado propio no se revalida contra la tabla de transiciones, que con razón rechaza
 * quedarse donde uno está.
 */
export function planPublicarConvocatoria(input: {
  call: { workspaceId: string; status: string; title: string | null } | null;
  coverage: { status: string };
  roles: EstadoDeRol[];
  workspaceId: string;
}): PlanPublicarConvocatoria {
  if (!input.call || input.call.workspaceId !== input.workspaceId) {
    return { ok: false, error: "No encontramos esa convocatoria." };
  }

  const transicionConvocatoria = assertCallTransition({
    from: input.call.status,
    to: "PUBLICADA",
  });
  if (!transicionConvocatoria.ok) return transicionConvocatoria;

  const publicable = puedePublicarse(input.call, input.roles);
  if (!publicable.ok) return publicable;

  if (input.coverage.status === "BUSCANDO_EQUIPO") return { ok: true, moverCobertura: false };

  const transicionCobertura = assertCoverageTransition({
    from: input.coverage.status,
    to: "BUSCANDO_EQUIPO",
  });
  if (!transicionCobertura.ok) return transicionCobertura;

  return { ok: true, moverCobertura: true };
}
