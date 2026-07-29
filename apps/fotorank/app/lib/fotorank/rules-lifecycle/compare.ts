import type {
  ContestRulesConfiguration,
  TextCompareSeverity,
  TextCompareStatus,
} from "../rules-config/types";
import { compareRulesTextWithConfiguration as compareLegacy } from "../rules-config/compare-text";

export type RulesCompareItem = {
  key: string;
  status: TextCompareStatus;
  severity: TextCompareSeverity;
  expected: string;
  evidence?: string;
};

function mentions(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function mapLegacySeverity(status: TextCompareStatus, key: string): TextCompareSeverity {
  if (status === "CONFLICT") return "BLOCKING";
  if (status === "MISSING" || status === "NOT_MENTIONED") {
    const blockingKeys = new Set([
      "max_entries",
      "free",
      "min_age",
      "photomontage",
      "ai_generative",
      "license_duration",
    ]);
    return blockingKeys.has(key) ? "WARNING" : "INFO";
  }
  if (status === "EXTRA_RULE") return "WARNING";
  return "INFO";
}

/**
 * Comparación determinística ampliada texto ↔ configuración (P0-09B).
 */
export function compareRulesTextWithConfiguration(
  text: string,
  config: ContestRulesConfiguration,
): RulesCompareItem[] {
  const legacy = compareLegacy(text, config).map((i) => ({
    ...i,
    status: (i.status === "NOT_MENTIONED" ? "MISSING" : i.status) as TextCompareStatus,
    severity: mapLegacySeverity(
      i.status === "NOT_MENTIONED" ? "MISSING" : i.status,
      i.key,
    ),
  }));

  const items: RulesCompareItem[] = [...legacy];
  const t = text;

  // Identidad
  if (mentions(t, [new RegExp(config.identity.officialName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")])) {
    items.push({
      key: "official_name",
      status: "MATCH",
      severity: "INFO",
      expected: config.identity.officialName,
    });
  } else {
    items.push({
      key: "official_name",
      status: "MISSING",
      severity: "BLOCKING",
      expected: config.identity.officialName,
    });
  }

  for (const org of config.identity.organizers) {
    const ok = mentions(t, [new RegExp(org.name.split(/\s+/).slice(0, 3).join("\\s+"), "i")]);
    items.push({
      key: `organizer:${org.name}`,
      status: ok ? "MATCH" : "MISSING",
      severity: ok ? "INFO" : "WARNING",
      expected: org.name,
    });
  }

  if (config.identity.territoryScope) {
    const ok = mentions(t, [/santa\s*fe/i, /provincia/i]);
    items.push({
      key: "territory",
      status: ok ? "MATCH" : "MISSING",
      severity: ok ? "INFO" : "WARNING",
      expected: config.identity.territoryScope,
    });
  }

  // Cronograma / captura
  if (mentions(t, [/1\s+de\s+agosto|01\/08|2026-08-01/i])) {
    items.push({ key: "open_date", status: "MATCH", severity: "INFO", expected: "2026-08-01" });
  } else if (mentions(t, [/apertura|inscripci[oó]n/i])) {
    items.push({ key: "open_date", status: "UNVERIFIABLE", severity: "WARNING", expected: "2026-08-01" });
  } else {
    items.push({ key: "open_date", status: "MISSING", severity: "BLOCKING", expected: "2026-08-01" });
  }

  if (mentions(t, [/30\s+de\s+septiembre|septiembre inclusive|1\s+de\s+octubre|cierre exclusivo/i])) {
    items.push({ key: "close_date", status: "MATCH", severity: "INFO", expected: "exclusive 2026-10-01" });
  } else if (mentions(t, [/23:59|23\.59/])) {
    items.push({
      key: "close_date",
      status: "CONFLICT",
      severity: "WARNING",
      expected: "exclusive 2026-10-01",
      evidence: "Uso de 23:59 aproximado",
    });
  }

  // Menores
  if (config.participation.adultAuthorizationRequired) {
    if (mentions(t, [/tutor|padre|madre|autorizaci[oó]n/i])) {
      items.push({ key: "minors_auth", status: "MATCH", severity: "INFO", expected: "required" });
    } else {
      items.push({ key: "minors_auth", status: "MISSING", severity: "BLOCKING", expected: "required" });
    }
  }

  // ARGRA / dron
  if (config.categories.some((c) => c.membershipRestriction === "ARGRA")) {
    const ok = mentions(t, [/argra/i]);
    items.push({
      key: "argra",
      status: ok ? "MATCH" : "MISSING",
      severity: ok ? "INFO" : "WARNING",
      expected: "ARGRA",
    });
  }
  if (config.categories.some((c) => c.deviceType === "DRONE")) {
    const ok = mentions(t, [/dron|a[eé]rea/i]);
    items.push({
      key: "drone_category",
      status: ok ? "MATCH" : "MISSING",
      severity: ok ? "INFO" : "WARNING",
      expected: "DRONE",
    });
  }

  // Archivo: límites inventados
  if (
    mentions(t, [/m[aá]ximo\s+\d+\s*mb|peso m[aá]ximo|m[ií]nimo\s+\d+\s*px|megap[ií]xeles m[ií]nimos/i]) &&
    config.file.maxFileSizeBytes == null
  ) {
    items.push({
      key: "invented_file_limits",
      status: "EXTRA_RULE",
      severity: "BLOCKING",
      expected: "sin límites reglamentarios de peso/dimensiones",
      evidence: "Texto impone límites no configurados",
    });
  }

  // Metadata no bloqueante
  if (mentions(t, [/sin exif.*(rechaz|descalif)|exif.*obligatori/i]) && config.metadata.exifGeneral.level !== "REQUIRED") {
    items.push({
      key: "exif_blocking",
      status: "CONFLICT",
      severity: "BLOCKING",
      expected: config.metadata.exifGeneral.level,
    });
  }

  // Edición / IA asistida
  if (mentions(t, [/revelado.*(permit|autoriz)/i, /m[aá]scaras?\s+(de\s+)?revelado/i])) {
    items.push({
      key: "basic_develop",
      status: config.editing.exposure === "ALLOWED" ? "MATCH" : "CONFLICT",
      severity: "INFO",
      expected: config.editing.exposure,
    });
  }
  if (mentions(t, [/reducci[oó]n de ruido.*(ia|inteligencia)|ruido mediante ia/i])) {
    items.push({
      key: "ai_noise",
      status: config.ai.aiNoiseReduction === "ALLOWED" ? "MATCH" : "CONFLICT",
      severity: "INFO",
      expected: config.ai.aiNoiseReduction,
    });
  }

  // Derechos
  if (mentions(t, [/conserva(r)?\s+la\s+titularidad|titularidad del autor/i])) {
    items.push({
      key: "authorship",
      status: config.rights.authorRetainsOwnership ? "MATCH" : "CONFLICT",
      severity: "INFO",
      expected: String(config.rights.authorRetainsOwnership),
    });
  }
  if (mentions(t, [/todas las obras|todas las fotograf/i]) && config.rights.licenseAppliesToAllWorks) {
    items.push({ key: "license_all_works", status: "MATCH", severity: "INFO", expected: "all" });
  } else if (config.rights.licenseAppliesToAllWorks) {
    items.push({ key: "license_all_works", status: "MISSING", severity: "WARNING", expected: "all" });
  }
  if (mentions(t, [/licencia exclusiva|car[aá]cter exclusivo/i])) {
    items.push({
      key: "exclusive",
      status: config.rights.exclusive ? "MATCH" : "CONFLICT",
      severity: "INFO",
      expected: String(config.rights.exclusive),
    });
  }

  // Premios 2°/3°
  if (mentions(t, [/400\.?000|400000/])) {
    items.push({ key: "prize_second", status: "MATCH", severity: "INFO", expected: "400000" });
  }
  if (mentions(t, [/300\.?000|300000/])) {
    items.push({ key: "prize_third", status: "MATCH", severity: "INFO", expected: "300000" });
  }

  // Jurado
  if (mentions(t, [/m[aá]ximo\s+5|hasta\s+5\s+jur/i])) {
    items.push({
      key: "jury_max",
      status: config.jury.maxJudges === 5 ? "MATCH" : "CONFLICT",
      severity: "INFO",
      expected: String(config.jury.maxJudges),
    });
  }
  if (mentions(t, [/an[oó]nim/i])) {
    items.push({
      key: "jury_anon",
      status: config.jury.anonymizedEvaluation ? "MATCH" : "CONFLICT",
      severity: "INFO",
      expected: String(config.jury.anonymizedEvaluation),
    });
  }
  if (mentions(t, [/conflicto de inter[eé]s/i])) {
    items.push({
      key: "jury_coi",
      status: config.jury.conflictOfInterestEnabled ? "MATCH" : "CONFLICT",
      severity: "INFO",
      expected: String(config.jury.conflictOfInterestEnabled),
    });
  }
  if (mentions(t, [/inapelable|fallo definitivo/i])) {
    items.push({
      key: "jury_final",
      status: config.jury.decisionFinal ? "MATCH" : "CONFLICT",
      severity: "INFO",
      expected: String(config.jury.decisionFinal),
    });
  }

  return items;
}

export function hasBlockingConflicts(items: RulesCompareItem[]): boolean {
  return items.some((i) => i.status === "CONFLICT" && i.severity === "BLOCKING");
}

export function hasTextConfigConflicts(items: RulesCompareItem[]): boolean {
  return items.some((i) => i.status === "CONFLICT");
}
