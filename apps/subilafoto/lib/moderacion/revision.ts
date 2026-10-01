/**
 * Qué puede hacer a mano el dueño del evento con una foto ya decidida.
 *
 * El análisis automático se equivoca, y en un evento equivocarse por retener es
 * barato: alguien la aprueba y sale. Equivocarse por publicar no se deshace —
 * ya la vieron ciento cincuenta personas en una pantalla de tres metros.
 *
 * Por eso las reglas de acá no son simétricas: rescatar es fácil, desbloquear
 * lo grave es imposible.
 */

export type EstadoFoto =
  | "PROCESSING"
  | "APPROVED"
  | "REVIEW_REQUIRED"
  | "BLOCKED"
  | "HIDDEN";

export type AccionDeRevision = "APROBAR" | "BLOQUEAR" | "OCULTAR" | "RESTAURAR";

/**
 * Categorías que ni el dueño del evento puede desbloquear.
 *
 * No es desconfianza: es que no hay ninguna razón legítima para proyectar esto
 * en una fiesta, y sí hay razones para que alguien con la cuenta abierta —o que
 * se la prestaron— intente hacerlo.
 *
 * Violencia y contenido perturbador **no** están en la lista a propósito: una
 * espada de cotillón o un disfraz de Halloween dan falso positivo, y eso tiene
 * que poder arreglarse.
 */
export const MOTIVOS_NO_REVERSIBLES = [
  "Explicit",
  "Non-Explicit Nudity of Intimate parts and Kissing",
  "Hate Symbols",
] as const;

const LARGO_MINIMO_DEL_MOTIVO = 10;

const ACCIONES: Record<EstadoFoto, readonly AccionDeRevision[]> = {
  PROCESSING: [],
  REVIEW_REQUIRED: ["APROBAR", "BLOQUEAR"],
  BLOCKED: ["APROBAR"],
  APPROVED: ["OCULTAR"],
  HIDDEN: ["RESTAURAR"],
};

export function accionesPosibles(estado: EstadoFoto): readonly AccionDeRevision[] {
  return ACCIONES[estado] ?? [];
}

/** Contradecir a la máquina exige explicar por qué; ser prudente, no. */
export function exigeMotivo(estado: EstadoFoto, accion: AccionDeRevision): boolean {
  return accion === "APROBAR" && (estado === "REVIEW_REQUIRED" || estado === "BLOCKED");
}

export function estadoResultante(accion: AccionDeRevision): {
  estado: EstadoFoto;
  publicar: boolean;
} {
  switch (accion) {
    case "APROBAR":
    case "RESTAURAR":
      return { estado: "APPROVED", publicar: true };
    case "BLOQUEAR":
      return { estado: "BLOCKED", publicar: false };
    case "OCULTAR":
      return { estado: "HIDDEN", publicar: false };
  }
}

export type Veredicto = { ok: boolean; motivo?: string };

export function validarRevision(entrada: {
  estado: EstadoFoto;
  accion: AccionDeRevision;
  motivo: string;
  /** La etiqueta con la que la IA decidió, si la hubo. */
  motivoDeLaIa?: string | null;
}): Veredicto {
  if (!accionesPosibles(entrada.estado).includes(entrada.accion)) {
    return { ok: false, motivo: "Esa acción no corresponde para el estado de la foto." };
  }

  if (
    entrada.accion === "APROBAR" &&
    entrada.motivoDeLaIa &&
    (MOTIVOS_NO_REVERSIBLES as readonly string[]).includes(entrada.motivoDeLaIa)
  ) {
    return {
      ok: false,
      motivo:
        "Esta foto no se puede aprobar a mano. Si creés que es un error, escribinos y la revisamos.",
    };
  }

  if (exigeMotivo(entrada.estado, entrada.accion)) {
    if (entrada.motivo.trim().length < LARGO_MINIMO_DEL_MOTIVO) {
      return { ok: false, motivo: "Contá en una frase por qué esta foto sí puede publicarse." };
    }
  }

  return { ok: true };
}
