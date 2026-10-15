import "server-only";
import { WINNER_FORMAT_LABEL, winnerTemplateKey, type WinnerFormat } from "./constants";
import { winnerDesignDocument } from "./documents";
import { createDesignTemplate, findWinnerTemplate, type CreatedDesign } from "./templates";

/**
 * La plantilla de imagen de ganador de un concurso en un formato. Si la organización todavía no
 * la abrió nunca, se crea a partir del diseño base: así el primer clic en "Editar diseño" ya
 * muestra algo para cambiar, y la imagen sale aunque nadie haya pasado por el editor.
 *
 * Idempotente: si ya existe la devuelve sin tocarla (volver a crearla borraría lo editado).
 */
export async function ensureWinnerTemplate(input: {
  organizationId: string;
  contestId: string;
  userId: number;
  format: WinnerFormat;
}): Promise<CreatedDesign> {
  const existente = await findWinnerTemplate(input);
  if (existente) return existente;
  return createDesignTemplate({
    organizationId: input.organizationId,
    userId: input.userId,
    name: `Ganador — ${WINNER_FORMAT_LABEL[input.format]}`,
    description: "Imagen de ganador para redes",
    meta: { templateKey: winnerTemplateKey(input.format), contestId: input.contestId },
    document: winnerDesignDocument(input.format),
  });
}
