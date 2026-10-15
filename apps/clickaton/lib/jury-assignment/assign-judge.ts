/**
 * Asignar un jurado del padrón maestro a una maratón de Clickatón.
 *
 * La identidad vive en FotoRank y las obras en Clickatón. Asignar es la
 * operación que cruza las dos: elige a alguien del padrón y le crea el trabajo
 * del lado donde están las fotos.
 *
 * Antes de esto no había forma de hacerlo: la edición Argentina 2026 tenía 270
 * obras y cero jurados, sin ninguna pantalla donde cargar uno.
 */

/** Lo que el padrón maestro dice de una persona. */
export type JuradoDelPadron = {
  id: string;
  email: string;
  accountStatus: string;
  directoryReviewStatus: string;
  nombre: string | null;
};

export type MotivoNoAsignable =
  | "CUENTA_NO_ACTIVA"
  | "FICHA_SIN_APROBAR";

/**
 * ¿A esta persona se le puede dar trabajo de jurado?
 *
 * Mismo criterio que el directorio de FotoRank, con una diferencia a propósito:
 * **no** se exige estar listado en el directorio público. Eso decide quién es
 * *buscable* por otros organizadores; acá ya se sabe a quién se quiere asignar.
 */
export function sePuedeAsignar(
  jurado: Pick<JuradoDelPadron, "accountStatus" | "directoryReviewStatus">,
): { ok: true } | { ok: false; motivo: MotivoNoAsignable } {
  if (jurado.accountStatus !== "ACTIVE") {
    return { ok: false, motivo: "CUENTA_NO_ACTIVA" };
  }
  if (jurado.directoryReviewStatus !== "APPROVED") {
    return { ok: false, motivo: "FICHA_SIN_APROBAR" };
  }
  return { ok: true };
}

export const MOTIVOS_EN_CASTELLANO: Record<MotivoNoAsignable, string> = {
  CUENTA_NO_ACTIVA: "Su cuenta está suspendida o dada de baja.",
  FICHA_SIN_APROBAR: "Su ficha todavía no fue aprobada.",
};

export type AsignacionExistente = {
  judgeAccountId: string;
  categoryId: string;
};

/**
 * Qué categorías quedan por asignarle a esta persona.
 *
 * Repetir una asignación no es un error del organizador: es que ya estaba
 * hecha. Se ignora en silencio en vez de fallar, igual que hace la asignación
 * en tanda de FotoRank.
 */
export function categoriasQueFaltanAsignar(input: {
  judgeAccountId: string;
  categoryIds: string[];
  yaAsignadas: AsignacionExistente[];
}): string[] {
  const suyas = new Set(
    input.yaAsignadas
      .filter((a) => a.judgeAccountId === input.judgeAccountId)
      .map((a) => a.categoryId),
  );
  const sinRepetir = new Set(input.categoryIds.filter((id) => !suyas.has(id)));
  return [...sinRepetir];
}

/**
 * ¿Se puede quitar esta asignación?
 *
 * Con votos cargados, no: borrarla se llevaría los votos puestos, porque
 * cuelgan de ella. En ese caso el camino es suspender a la persona en el
 * padrón maestro, que la deja afuera sin destruir lo que ya hizo.
 */
export function sePuedeQuitar(asignacion: { votos: number }): boolean {
  return asignacion.votos === 0;
}

export const NO_SE_PUEDE_QUITAR =
  "Este jurado ya calificó obras. Si no querés que siga, suspendelo desde FotoRank: quitarle la asignación borraría los votos que ya puso.";

/**
 * Lo que se le dice al organizador cuando la conexión entre bases no está.
 *
 * Es el aviso más importante de la pantalla: sin él, una lista vacía se lee
 * como "no hay jurados" y nadie sabría que falta configurar algo.
 */
export const SIN_CONEXION_AL_PADRON =
  "No podemos consultar el padrón de jurados. Falta configurar la conexión entre Clickatón y FotoRank; avisale a quien administra la plataforma.";

export const SIN_CONEXION_A_CLICKATON =
  "No podemos guardar la asignación. Falta configurar la conexión con la base de la maratón; avisale a quien administra la plataforma.";
