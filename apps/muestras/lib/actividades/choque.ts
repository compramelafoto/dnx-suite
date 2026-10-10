import "server-only";
import { EDIT_PART_LABELS, EDIT_PARTS, type EditPart } from "@repo/muestras";
import { nombreDeUsuario } from "@/lib/equipo/registro";

/**
 * Otra persona del equipo guardó la ficha o los textos entre que se abrió el formulario y ahora
 * (etapa 5, D7). Lo comparten `guardarBorrador` y `guardarTextos`.
 */
export class Choque extends Error {
  constructor(readonly fila: { lastEditedByUserId: number | null; lastEditedPart: string | null } | null) {
    super("choque");
  }
}

export const PAGINA_VIEJA = "La página quedó vieja. Recargala y volvé a guardar.";

export async function mensajeDeChoque(c: Choque): Promise<string> {
  const quien = c.fila?.lastEditedByUserId != null ? await nombreDeUsuario(c.fila.lastEditedByUserId) : null;
  const parte = (EDIT_PARTS as readonly string[]).includes(c.fila?.lastEditedPart ?? "") ? ` en ${EDIT_PART_LABELS[c.fila!.lastEditedPart as EditPart]}` : "";
  const inicio = quien ? `Mientras editabas, ${quien} guardó cambios${parte}.` : "Mientras editabas, alguien del equipo guardó cambios.";
  return `${inicio} Recargá la página para ver la versión nueva (lo que escribiste se pierde: copialo antes).`;
}
