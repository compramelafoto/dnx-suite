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
 * Si corresponde crear la convocatoria de esta cobertura.
 *
 * `CoverageCall` es 1:1 con `Coverage` (columna `@unique` en el modelo): una cobertura tiene a
 * lo sumo una convocatoria en toda su vida, así que "ya existe" no se resuelve reintentando ni
 * sobrescribiendo, se avisa. Y se crea mientras la cobertura sigue `PLANIFICADA`: publicar es lo
 * que la mueve a `BUSCANDO_EQUIPO` (ver `planPublicarConvocatoria`), así que crear el borrador
 * en cualquier otro estado adelantaría un paso que todavía no pasó.
 */
export function puedeCrearseConvocatoria(input: {
  coverageStatus: string;
  yaExiste: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (input.yaExiste) {
    return { ok: false, error: "Esta cobertura ya tiene una convocatoria." };
  }
  if (input.coverageStatus !== "PLANIFICADA") {
    return {
      ok: false,
      error: "Solo se puede crear la convocatoria mientras la cobertura está planificada.",
    };
  }
  return { ok: true };
}

/** Solo se edita en `BORRADOR`. Publicada, editarla desde acá dejaría de avisarle a nadie del cambio. */
export function puedeEditarseConvocatoria(status: string): boolean {
  return status === "BORRADOR";
}

export type PlanPublicarConvocatoria = { ok: true } | { ok: false; error: string };

/**
 * Los tres controles antes de publicar, en el orden que importa: primero que la convocatoria
 * sea de este workspace, después que la transición de estado exista, y recién ahí el contenido
 * (título y vacantes). Al publicar, la cobertura pasa a `BUSCANDO_EQUIPO` en la misma
 * transacción — por eso esta función también valida esa transición: publicar una convocatoria
 * sobre una cobertura que ya no puede pasar a `BUSCANDO_EQUIPO` (por ejemplo, cancelada) no
 * tiene que dejar a las dos entidades contando historias distintas.
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

  const transicionCobertura = assertCoverageTransition({
    from: input.coverage.status,
    to: "BUSCANDO_EQUIPO",
  });
  if (!transicionCobertura.ok) return transicionCobertura;

  return { ok: true };
}
