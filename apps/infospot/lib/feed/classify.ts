/**
 * Clasificación de tipo de feed a partir de señales existentes (sin schema nuevo).
 */

import type { InfoSpotFeedItemType } from "./types";

function normalize(text: string | null | undefined): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Infere el tipo editorial de un artículo público.
 * `storyType` del asistente no se persiste en Prisma; usamos categoría, coberturas y texto.
 */
export function classifyArticleFeedType(input: {
  categorySlug?: string | null;
  categoryName?: string | null;
  title?: string | null;
  hasCoverageLink?: boolean;
  clfAlbumId?: number | null;
}): InfoSpotFeedItemType {
  if (input.hasCoverageLink || input.clfAlbumId) return "COVERAGE";

  const blob = normalize(
    `${input.categorySlug || ""} ${input.categoryName || ""} ${input.title || ""}`,
  );

  if (/\bentrevista/.test(blob)) return "INTERVIEW";
  if (/\bcronica|\bcrónica/.test(blob) || /\bcronica\b/.test(blob)) return "CHRONICLE";
  if (/\bguia|\bguía|\bhowto|\bcomo hacer/.test(blob)) return "GUIDE";
  if (/\binstitucional|\bcomunicado|\bprensa/.test(blob)) return "INSTITUTIONAL";
  if (/\bconcurso|\bcertamen|\bpremio/.test(blob)) return "CONTEST";
  if (/\bcobertura|\bgaleria|\bgalería/.test(blob)) return "COVERAGE";
  if (/\bmaraton|\bmaratón|\btaller|\bactividad/.test(blob)) return "OTHER";

  return "NEWS";
}

export function classifyEventFeedType(input: {
  seekingPhotographers?: boolean;
  categorySlug?: string | null;
  categoryName?: string | null;
  title?: string | null;
}): InfoSpotFeedItemType {
  if (input.seekingPhotographers) return "PHOTOGRAPHER_CALL";

  const blob = normalize(
    `${input.categorySlug || ""} ${input.categoryName || ""} ${input.title || ""}`,
  );
  if (/\bconcurso|\bcertamen/.test(blob)) return "CONTEST";
  if (/\bmaraton|\bmaratón/.test(blob)) return "EVENT";
  return "EVENT";
}
