/**
 * Único lugar que decide qué ve el jurado de una obra.
 *
 * Todo lo que no esté acá no llega a la pantalla. La lista de campos prohibidos
 * existe para que la prueba pueda vigilarla: el anonimato deja de depender de
 * que quien edite se acuerde de la regla.
 */
import { createHmac } from "node:crypto";

/** Debe coincidir con PURPOSE de apps/clickaton/lib/jury-media/signed-link.ts */
const PURPOSE = "clickaton:jury-preview:v1";

/** Vigencia del enlace de vista previa. Corta: el jurado recarga, el enlace no viaja. */
const VIGENCIA_MS = 15 * 60 * 1000;

export const CAMPOS_PROHIBIDOS = [
  "authorUserId",
  "clickatonParticipantNumber",
  "externalRegistrationId",
  "externalParticipantId",
  "imageUrl",
  "title",
  "description",
] as const;

export type JurorVote = {
  id: string;
  valueNumeric: number | null;
  valueBoolean: boolean | null;
  isFavorite: boolean | null;
  selectedRank: number | null;
  version: number;
  /** Del propio jurado, no del autor: se devuelve para que pueda releerlo y corregirlo. */
  comment: string | null;
  criteriaScoresJson: unknown;
};

export type JurorEntry = {
  id: string;
  anonymousCode: string | null;
  previewUrl: string | null;
  technicalSummaryStatus: string | null;
  warningCount: number;
  currentVote: JurorVote | null;
};

/**
 * Fila cruda de la base. Se declara con lo mínimo que se necesita leer: las
 * consultas traen más columnas, y eso está bien — lo que importa es que de acá
 * no salga nada que no esté en `JurorEntry`.
 */
export type RawJuryEntry = {
  id: string;
  entryNumber: string | null;
  technicalSummaryStatus: string | null;
  assets: Array<{ id: string }>;
  votes: Array<{
    id: string;
    valueNumeric: number | null;
    valueBoolean: boolean | null;
    isFavorite: boolean | null;
    selectedRank: number | null;
    version: number;
    comment: string | null;
    criteriaScoresJson: unknown;
  }>;
  checks: Array<{ status: string }>;
};

function juryMediaSecret(): string {
  const secret =
    process.env.CLICKATON_JURY_MEDIA_SECRET?.trim() ||
    process.env.DNX_SESSION_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error(
      "CLICKATON_JURY_MEDIA_SECRET (o DNX_SESSION_SECRET) es obligatorio para mostrar obras de Clickatón",
    );
  }
  return secret;
}

function signedPreviewUrl(assetId: string, baseUrl: string, now: Date): string {
  const expMs = now.getTime() + VIGENCIA_MS;
  const sig = createHmac("sha256", juryMediaSecret())
    .update(`${PURPOSE}:${assetId}:${expMs}`)
    .digest("base64url");
  const qs = new URLSearchParams({ exp: String(expMs), sig });
  return `${baseUrl}/api/jurado/media/${encodeURIComponent(assetId)}?${qs.toString()}`;
}

export function serializeEntryForJuror(input: {
  entry: RawJuryEntry;
  clickatonBaseUrl: string | null;
  now?: Date;
}): JurorEntry {
  const asset = input.entry.assets[0];
  return {
    id: input.entry.id,
    anonymousCode: input.entry.entryNumber,
    previewUrl:
      asset && input.clickatonBaseUrl
        ? signedPreviewUrl(asset.id, input.clickatonBaseUrl, input.now ?? new Date())
        : null,
    technicalSummaryStatus: input.entry.technicalSummaryStatus,
    warningCount: input.entry.checks.filter(
      (c) => c.status === "WARNING" || c.status === "REQUIRES_REVIEW",
    ).length,
    currentVote: input.entry.votes[0]
      ? {
          id: input.entry.votes[0].id,
          valueNumeric: input.entry.votes[0].valueNumeric,
          valueBoolean: input.entry.votes[0].valueBoolean,
          isFavorite: input.entry.votes[0].isFavorite,
          selectedRank: input.entry.votes[0].selectedRank,
          version: input.entry.votes[0].version,
          comment: input.entry.votes[0].comment,
          criteriaScoresJson: input.entry.votes[0].criteriaScoresJson,
        }
      : null,
  };
}
