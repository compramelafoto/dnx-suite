import { normalizeTitle } from "./normalize";
import {
  findExactNormalizedDuplicates,
  findSimilarityWarnings,
  type DuplicateCandidate,
} from "./duplicates";
import type {
  ImportRow,
  PhotoPromptDifficulty,
  PhotoPromptInspirationType,
} from "./types";

const DIFFICULTIES = new Set<PhotoPromptDifficulty>(["EASY", "MEDIUM", "HARD"]);
const INSPIRATIONS = new Set<PhotoPromptInspirationType>([
  "DIRECTOR",
  "MOVIE",
  "GENRE",
  "ART_MOVEMENT",
  "PHOTOGRAPHER",
  "VISUAL_STYLE",
  "OTHER",
]);

export type ImportPreviewIssue = {
  rowIndex: number;
  level: "error" | "warning";
  code: string;
  message: string;
};

export type ImportPreviewResult = {
  rows: ImportRow[];
  issues: ImportPreviewIssue[];
  exactDuplicates: ReturnType<typeof findExactNormalizedDuplicates>;
  similarityWarnings: ReturnType<typeof findSimilarityWarnings>;
  okToApply: boolean;
};

function asString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function asOptionalString(v: unknown): string | null {
  const s = asString(v);
  return s.length ? s : null;
}

function asBool(v: unknown, fallback = true): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (["true", "1", "si", "sí", "yes"].includes(t)) return true;
    if (["false", "0", "no"].includes(t)) return false;
  }
  return fallback;
}

function asTags(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => asString(x)).filter(Boolean);
  }
  const s = asString(v);
  if (!s) return [];
  return s
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Parsea JSON array o filas tipo CSV-ish (objetos). */
export function parseImportPayload(raw: unknown): unknown[] {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error("El JSON de importación debe ser un array de filas.");
    }
    return parsed;
  }
  if (Array.isArray(raw)) return raw;
  throw new Error("Formato de importación inválido: se espera array o JSON string.");
}

export function normalizeImportRow(raw: unknown, rowIndex: number): {
  row?: ImportRow;
  issues: ImportPreviewIssue[];
} {
  const issues: ImportPreviewIssue[] = [];
  if (!raw || typeof raw !== "object") {
    return {
      issues: [
        {
          rowIndex,
          level: "error",
          code: "ROW_NOT_OBJECT",
          message: "La fila debe ser un objeto.",
        },
      ],
    };
  }
  const o = raw as Record<string, unknown>;
  const title = asString(o.title ?? o.titulo);
  const description = asString(o.description ?? o.descripcion ?? o.instructions);
  const themeSlug = asString(o.themeSlug ?? o.theme ?? o.tematica).toLowerCase();
  const subthemeSlug = asOptionalString(
    o.subthemeSlug ?? o.subtheme ?? o.subtematica,
  );

  if (!title) {
    issues.push({
      rowIndex,
      level: "error",
      code: "MISSING_TITLE",
      message: "Falta title.",
    });
  }
  if (!description) {
    issues.push({
      rowIndex,
      level: "error",
      code: "MISSING_DESCRIPTION",
      message: "Falta description.",
    });
  }
  if (!themeSlug) {
    issues.push({
      rowIndex,
      level: "error",
      code: "MISSING_THEME",
      message: "Falta themeSlug.",
    });
  }

  let difficulty: PhotoPromptDifficulty = "MEDIUM";
  const diffRaw = asString(o.difficulty ?? o.dificultad).toUpperCase();
  if (diffRaw) {
    if (DIFFICULTIES.has(diffRaw as PhotoPromptDifficulty)) {
      difficulty = diffRaw as PhotoPromptDifficulty;
    } else {
      issues.push({
        rowIndex,
        level: "error",
        code: "INVALID_DIFFICULTY",
        message: `difficulty inválida: ${diffRaw}`,
      });
    }
  }

  let inspirationType: PhotoPromptInspirationType | null = null;
  const inspRaw = asString(o.inspirationType).toUpperCase();
  if (inspRaw) {
    if (INSPIRATIONS.has(inspRaw as PhotoPromptInspirationType)) {
      inspirationType = inspRaw as PhotoPromptInspirationType;
    } else {
      issues.push({
        rowIndex,
        level: "error",
        code: "INVALID_INSPIRATION",
        message: `inspirationType inválido: ${inspRaw}`,
      });
    }
  }

  if (issues.some((i) => i.level === "error")) {
    return { issues };
  }

  return {
    row: {
      title,
      description,
      themeSlug,
      subthemeSlug,
      tags: asTags(o.tags),
      difficulty,
      language: asString(o.language ?? o.idioma) || "es",
      universal: asBool(o.universal, true),
      inspirationType,
      inspirationLabel: asOptionalString(o.inspirationLabel),
      inspirationNotes: asOptionalString(o.inspirationNotes),
      sourceKey: asOptionalString(o.sourceKey),
    },
    issues,
  };
}

export function importPreview(
  raw: unknown,
  existing: DuplicateCandidate[] = [],
): ImportPreviewResult {
  const parsed = parseImportPayload(raw);
  const rows: ImportRow[] = [];
  const issues: ImportPreviewIssue[] = [];

  for (let i = 0; i < parsed.length; i += 1) {
    const { row, issues: rowIssues } = normalizeImportRow(parsed[i], i);
    issues.push(...rowIssues);
    if (row) rows.push(row);
  }

  const candidates: DuplicateCandidate[] = [
    ...existing,
    ...rows.map((r, idx) => ({
      id: `import:${idx}`,
      title: r.title,
      normalizedTitle: normalizeTitle(r.title),
    })),
  ];

  const exactDuplicates = findExactNormalizedDuplicates(candidates);
  const similarityWarnings = findSimilarityWarnings(candidates);

  for (const match of exactDuplicates) {
    const importIds = match.items.filter((x) => x.id.startsWith("import:"));
    if (importIds.length === 0) continue;
    issues.push({
      rowIndex: Number(importIds[0]!.id.split(":")[1] ?? -1),
      level: "warning",
      code: "EXACT_DUPLICATE",
      message: `Título normalizado duplicado: "${match.normalizedTitle}"`,
    });
  }
  for (const w of similarityWarnings) {
    const importSide = w.a.id.startsWith("import:")
      ? w.a
      : w.b.id.startsWith("import:")
        ? w.b
        : null;
    if (!importSide) continue;
    issues.push({
      rowIndex: Number(importSide.id.split(":")[1] ?? -1),
      level: "warning",
      code: "SIMILARITY_WARNING",
      message: `Posible similitud (${w.score.toFixed(2)}): "${w.a.title}" ↔ "${w.b.title}"`,
    });
  }

  const hasErrors = issues.some((i) => i.level === "error");
  return {
    rows,
    issues,
    exactDuplicates,
    similarityWarnings,
    okToApply: !hasErrors && rows.length > 0,
  };
}
