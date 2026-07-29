import type { ContestRulesConfiguration, TextCompareStatus } from "./types";

export type TextConfigCompareItem = {
  key: string;
  status: TextCompareStatus;
  expected: string;
  evidence?: string;
};

function mentions(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Comparación determinística texto ↔ configuración (sin IA).
 */
export function compareRulesTextWithConfiguration(
  text: string,
  config: ContestRulesConfiguration,
): TextConfigCompareItem[] {
  const t = text;
  const items: TextConfigCompareItem[] = [];

  // Cantidad de obras
  const onePhoto = config.participation.maxEntriesPerRegistration === 1;
  if (mentions(t, [/una sola fotograf[ií]a/i, /una fotograf[ií]a/i, /1 fotograf[ií]a/i])) {
    items.push({
      key: "max_entries",
      status: onePhoto ? "MATCH" : "CONFLICT",
      expected: String(config.participation.maxEntriesPerRegistration),
    });
  } else if (mentions(t, [/\d+\s+fotograf/i])) {
    items.push({
      key: "max_entries",
      status: "UNVERIFIABLE",
      expected: String(config.participation.maxEntriesPerRegistration),
    });
  } else {
    items.push({
      key: "max_entries",
      status: "NOT_MENTIONED",
      expected: String(config.participation.maxEntriesPerRegistration),
    });
  }

  // Gratuidad
  if (mentions(t, [/gratuit/i, /sin costo/i, /participaci[oó]n gratuita/i])) {
    items.push({
      key: "free",
      status: config.participation.pricingMode === "FREE" ? "MATCH" : "CONFLICT",
      expected: config.participation.pricingMode,
    });
  } else {
    items.push({ key: "free", status: "NOT_MENTIONED", expected: config.participation.pricingMode });
  }

  // Precio de participación (no confundir con premios ni con "sin precio"/"no se cobra")
  const claimsPaidParticipation = mentions(t, [
    /el concurso cuesta/i,
    /inscripci[oó]n paga/i,
    /arancel de\s/i,
    /precio de inscripci[oó]n\s*(es|:|\d)/i,
    /costo de participaci[oó]n\s*(es|:|\d)/i,
  ]);
  if (claimsPaidParticipation && config.participation.pricingMode === "FREE") {
    items.push({
      key: "price",
      status: "CONFLICT",
      expected: "0",
      evidence: "FREE con mención de precio de participación",
    });
  }

  // GPS
  const gpsRequiredInText = mentions(t, [/gps\s+(ser[aá]\s+)?obligatori/i, /ubicaci[oó]n\s+obligatori/i]);
  const gpsRecommendedInText = mentions(t, [/gps\s+recomend/i, /ubicaci[oó]n\s+recomend/i]);
  if (gpsRequiredInText) {
    items.push({
      key: "gps",
      status: config.metadata.gps.level === "REQUIRED" ? "MATCH" : "CONFLICT",
      expected: config.metadata.gps.level,
    });
  } else if (gpsRecommendedInText) {
    items.push({
      key: "gps",
      status: config.metadata.gps.level === "RECOMMENDED" ? "MATCH" : "CONFLICT",
      expected: config.metadata.gps.level,
    });
  } else {
    items.push({ key: "gps", status: "NOT_MENTIONED", expected: config.metadata.gps.level });
  }

  // EXIF
  if (mentions(t, [/exif\s+obligatori/i])) {
    items.push({
      key: "exif",
      status: config.metadata.exifGeneral.level === "REQUIRED" ? "MATCH" : "CONFLICT",
      expected: config.metadata.exifGeneral.level,
    });
  } else if (mentions(t, [/exif\s+recomend/i])) {
    items.push({
      key: "exif",
      status: config.metadata.exifGeneral.level === "RECOMMENDED" ? "MATCH" : "CONFLICT",
      expected: config.metadata.exifGeneral.level,
    });
  } else {
    items.push({ key: "exif", status: "NOT_MENTIONED", expected: config.metadata.exifGeneral.level });
  }

  // Fotomontaje
  if (mentions(t, [/fotomontaje\s+prohib/i, /no\s+se\s+permite\s+fotomontaje/i])) {
    items.push({
      key: "photomontage",
      status: config.editing.photomontage === "PROHIBITED" ? "MATCH" : "CONFLICT",
      expected: config.editing.photomontage,
    });
  } else {
    items.push({ key: "photomontage", status: "NOT_MENTIONED", expected: config.editing.photomontage });
  }

  // IA generativa
  if (mentions(t, [/inteligencia artificial generativa\s+prohib/i, /ia generativa\s+prohib/i])) {
    items.push({
      key: "ai_generative",
      status: config.ai.fullyGeneratedImage === "PROHIBITED" ? "MATCH" : "CONFLICT",
      expected: config.ai.fullyGeneratedImage,
    });
  } else {
    items.push({
      key: "ai_generative",
      status: "NOT_MENTIONED",
      expected: config.ai.fullyGeneratedImage,
    });
  }

  // Edad
  if (config.participation.minAge != null) {
    const ageRe = new RegExp(`mayores? de ${config.participation.minAge}|${config.participation.minAge}\\s*a[nñ]os`, "i");
    if (ageRe.test(t)) {
      items.push({ key: "min_age", status: "MATCH", expected: String(config.participation.minAge) });
    } else if (/edad|a[nñ]os/.test(t)) {
      items.push({ key: "min_age", status: "UNVERIFIABLE", expected: String(config.participation.minAge) });
    } else {
      items.push({ key: "min_age", status: "NOT_MENTIONED", expected: String(config.participation.minAge) });
    }
  }

  // Categorías count
  const catCount = config.categories.filter((c) => c.active).length;
  if (mentions(t, [/cuatro categor/i, /4 categor/i]) && catCount === 4) {
    items.push({ key: "categories_count", status: "MATCH", expected: String(catCount) });
  } else if (mentions(t, [/categor[ií]as?/i])) {
    items.push({ key: "categories_count", status: "UNVERIFIABLE", expected: String(catCount) });
  } else {
    items.push({ key: "categories_count", status: "NOT_MENTIONED", expected: String(catCount) });
  }

  // Licencia 12 meses
  if (mentions(t, [/12\s*meses|doce meses/i])) {
    items.push({
      key: "license_duration",
      status: config.rights.durationMonths === 12 ? "MATCH" : "CONFLICT",
      expected: String(config.rights.durationMonths),
    });
  } else {
    items.push({
      key: "license_duration",
      status: "NOT_MENTIONED",
      expected: String(config.rights.durationMonths),
    });
  }

  // Premios
  if (mentions(t, [/500\.?000|500000/])) {
    items.push({ key: "prize_first", status: "MATCH", expected: "500000" });
  } else {
    items.push({ key: "prize_first", status: "NOT_MENTIONED", expected: "500000" });
  }

  return items;
}

export function hasTextConfigConflicts(items: TextConfigCompareItem[]): boolean {
  return items.some((i) => i.status === "CONFLICT");
}
