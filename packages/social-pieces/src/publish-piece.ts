import {
  planMentions,
  type CreatePublishRequestInput,
  type MentionCandidate,
  type PublishAsset,
  type PublishFormat,
  type SocialApplication,
} from "@repo/social-publisher";
import type { RenderedPiece, SocialPieceSpec } from "./types";
import { renderSocialPiece } from "./render";

/** Puerto de almacenamiento: cada app trae su R2. Devuelve la URL pública. */
export type AssetUploader = (file: {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}) => Promise<string>;

export type PublishPieceInput = {
  application: SocialApplication;
  entityType: string;
  entityId: string;
  pieceId: string;
  format: PublishFormat;
  caption: string;
  hashtags?: string[];
  mentionCandidates: MentionCandidate[];
  socialAccountId: string;
  idempotencyKey: string;
  maxCollaborators?: number;
  createdByUserId?: number | null;
  extraMetadata?: Record<string, unknown>;
};

/**
 * Arma la solicitud a partir de las URLs ya subidas. Puro: acá vive el reparto de
 * menciones y el `metadata` que después lee el motor.
 */
export function buildPublishRequestInput(
  input: PublishPieceInput,
  uploadedUrls: string[],
): CreatePublishRequestInput {
  const esCarrusel = input.format === "CAROUSEL";
  // Las historias no admiten colaboradores: todo el mundo va al copy.
  const admiteColaboradores = input.format !== "STORY";

  const plan = admiteColaboradores
    ? planMentions(input.mentionCandidates, input.maxCollaborators)
    : { collaborators: [], captionMentions: planMentions(input.mentionCandidates, 0).captionMentions };

  const assets: PublishAsset[] = uploadedUrls.map((url, i) => ({
    assetId: `${input.pieceId}-${i}`,
    kind: esCarrusel ? "CAROUSEL_ITEM" : "IMAGE",
    publicUrl: url,
    mimeType: "image/jpeg",
    sortOrder: i,
  }));

  return {
    application: input.application,
    entityType: input.entityType,
    entityId: input.entityId,
    templateRef: input.pieceId,
    caption: input.caption,
    hashtags: input.hashtags ?? [],
    mentions: plan.captionMentions,
    assets,
    target: { platform: "INSTAGRAM", socialAccountId: input.socialAccountId },
    approvalRequired: true,
    idempotencyKey: input.idempotencyKey,
    createdByUserId: input.createdByUserId ?? null,
    metadata: {
      ...(input.extraMetadata ?? {}),
      format: input.format,
      collaborators: plan.collaborators,
      pieceId: input.pieceId,
    },
  };
}

/**
 * Renderiza UNA sola pieza, sube todas sus imágenes (en orden: son las diapositivas
 * del carrusel) y arma la solicitud lista para crear.
 *
 * Ojo: no hay que confundir esto con "varias piezas → una solicitud". Cada spec es
 * una publicación propia (el carrusel es una, la historia es otra); mezclarlas acá
 * publicaría dos piezas distintas como si fueran una sola.
 */
export async function publishPiece(
  input: PublishPieceInput,
  deps: {
    spec: SocialPieceSpec;
    upload: AssetUploader;
    render?: (spec: SocialPieceSpec) => Promise<RenderedPiece>;
  },
): Promise<CreatePublishRequestInput> {
  const render = deps.render ?? ((s: SocialPieceSpec) => renderSocialPiece(s));
  const pieza = await render(deps.spec);

  // El orden importa: son las diapositivas del carrusel. Se suben en serie (no con
  // Promise.all) para no saturar el uploader del llamador con pedidos en paralelo.
  const urls: string[] = [];
  for (const imagen of pieza.images) {
    urls.push(
      await deps.upload({
        fileName: imagen.fileName,
        contentType: imagen.contentType,
        bytes: imagen.bytes,
      }),
    );
  }

  return buildPublishRequestInput(input, urls);
}
