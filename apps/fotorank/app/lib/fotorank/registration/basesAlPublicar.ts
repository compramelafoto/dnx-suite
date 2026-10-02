import { contentHasCriticalPlaceholder } from "./production-gate";

/**
 * Qué hacer con las bases cuando el organizador guarda el concurso.
 *
 * La inscripción sólo acepta una `FotorankContestRulesVersion` PUBLISHED, pero el modal
 * "Publicar" sólo pedía `rulesText`. Así se publicó "Retratos del mundo 2026" sin versión
 * oficial y nadie podía inscribirse. Regla: al pasar a PUBLISHED/ACTIVE sin versión
 * oficial, se publica la versión 1 con el texto cargado; sin texto válido, no se publica.
 * Si ya existe una versión oficial no se toca: los cambios van por el circuito de Bases.
 * Sólo bloquea al pasar a publicado (editar uno ya publicado no lo traba) y nunca en
 * concursos que se inscriben por Clickatón (`exigeBases: false`).
 */
export type DecisionBasesAlPublicar =
  | { accion: "nada" }
  | { accion: "publicar"; contenido: string }
  | { accion: "bloquear"; error: string };

export function decidirBasesAlPublicar(input: {
  estadoAnterior: string;
  estadoNuevo: string;
  tieneVersionPublicada: boolean;
  textoDeBases: string | null | undefined;
  produccion: boolean;
  exigeBases?: boolean;
}): DecisionBasesAlPublicar {
  if (!esPublicado(input.estadoNuevo) || input.tieneVersionPublicada) return { accion: "nada" };

  const contenido = (input.textoDeBases ?? "").trim();
  const puedeBloquear = !esPublicado(input.estadoAnterior) && input.exigeBases !== false;
  if (!contenido) {
    if (!puedeBloquear) return { accion: "nada" };
    return {
      accion: "bloquear",
      error: "Para publicar el concurso cargá las bases y condiciones: sin bases nadie puede inscribirse.",
    };
  }
  if (input.produccion && contentHasCriticalPlaceholder(contenido)) {
    if (!puedeBloquear) return { accion: "nada" };
    return {
      accion: "bloquear",
      error:
        "Las bases tienen marcas de borrador (BORRADOR, REEMPLAZAR, TODO…). Quitalas antes de publicar el concurso.",
    };
  }
  return { accion: "publicar", contenido };
}

function esPublicado(estado: string): boolean {
  return estado === "PUBLISHED" || estado === "ACTIVE";
}
