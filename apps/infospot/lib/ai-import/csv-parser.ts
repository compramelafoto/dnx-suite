import {
  AI_IMPORT_MAX_CHARS,
  ARTICLE_CSV_HEADERS,
  EVENT_CSV_HEADERS,
  type AiImportContext,
} from "./schemas";

const FORMULA_RE = /^\s*[=+\-@]/;

export type ParsedCsvTable = {
  headers: string[];
  rows: Record<string, string>[];
};

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

/** Extrae bloque CSV si la IA agregó fences o texto alrededor. */
export function extractCsvPayload(raw: string): string {
  let text = stripBom(raw).trim();
  const fence = text.match(/```(?:csv)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();
  return text;
}

export function parseCsvWithPapa(
  raw: string,
  Papa: {
    parse: (
      input: string,
      config: Record<string, unknown>,
    ) => { data: unknown; errors: Array<{ message: string }>; meta: { fields?: string[] } };
  },
): { ok: true; table: ParsedCsvTable } | { ok: false; error: string } {
  const text = extractCsvPayload(raw);
  if (!text) return { ok: false, error: "Pegá el CSV generado por la IA." };
  if (text.length > AI_IMPORT_MAX_CHARS) {
    return {
      ok: false,
      error: `El texto es demasiado largo (máx. ${AI_IMPORT_MAX_CHARS.toLocaleString("es-AR")} caracteres).`,
    };
  }

  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h: string) => h.trim().toLowerCase(),
    transform: (v: string) => (typeof v === "string" ? v.trim() : v),
  });

  if (result.errors.length > 0) {
    return {
      ok: false,
      error: `CSV inválido: ${result.errors[0]?.message ?? "error de parseo"}.`,
    };
  }

  const headers = (result.meta.fields ?? []).map((h) => h.trim().toLowerCase());
  if (headers.length === 0) {
    return { ok: false, error: "No se detectaron encabezados en el CSV." };
  }

  const rows = (result.data as Record<string, unknown>[])
    .map((row) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        out[k.trim().toLowerCase()] =
          v == null ? "" : String(v).replace(/\r\n/g, "\n").trim();
      }
      return out;
    })
    .filter((row) => Object.values(row).some((v) => v.length > 0));

  if (rows.length === 0) {
    return { ok: false, error: "El CSV no tiene filas de datos." };
  }
  if (rows.length > 1) {
    return {
      ok: false,
      error: `Se encontraron ${rows.length} filas. Solo se permite una fila por importación.`,
    };
  }

  const row = rows[0]!;
  for (const [key, value] of Object.entries(row)) {
    if (value && FORMULA_RE.test(value)) {
      return {
        ok: false,
        error: `Valor bloqueado por seguridad en «${key}» (posible fórmula CSV).`,
      };
    }
  }

  return { ok: true, table: { headers, rows: [row] } };
}

export function detectCsvContext(
  headers: string[],
): AiImportContext | null {
  const set = new Set(headers);
  const eventHits = EVENT_CSV_HEADERS.filter((h) => set.has(h)).length;
  const articleHits = ARTICLE_CSV_HEADERS.filter((h) => set.has(h)).length;
  if (eventHits === 0 && articleHits === 0) return null;
  if (set.has("event_name") && set.has("venue_name")) return "EVENT";
  if (set.has("title") && (set.has("body_markdown") || set.has("excerpt"))) return "ARTICLE";
  if (eventHits >= articleHits) return "EVENT";
  return "ARTICLE";
}

export function assertHeadersForContext(
  context: AiImportContext,
  headers: string[],
): string | null {
  const expected = context === "EVENT" ? EVENT_CSV_HEADERS : ARTICLE_CSV_HEADERS;
  const set = new Set(headers);
  const missingRequired =
    context === "EVENT"
      ? ["event_name"].filter((h) => !set.has(h))
      : ["title"].filter((h) => !set.has(h));
  if (missingRequired.length > 0) {
    return `Faltan encabezados obligatorios: ${missingRequired.join(", ")}.`;
  }
  const overlap = expected.filter((h) => set.has(h)).length;
  if (overlap < 3) {
    return `Los encabezados no coinciden con el formato de ${context === "EVENT" ? "evento" : "artículo"}.`;
  }
  return null;
}
