import { createHash } from "node:crypto";

const MAX_RULES_DOCUMENT_CHARS = 400_000;

export type NormalizedRulesDocument = {
  original: string;
  normalized: string;
  contentHash: string;
  format: "markdown" | "html" | "plain";
};

/** Elimina scripts/iframes/handlers peligrosos sin reescribir el sentido legal. */
export function sanitizeRulesHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:\s*text\/html/gi, "");
}

export function detectRulesFormat(content: string): "markdown" | "html" | "plain" {
  if (/<\/?(?:h[1-6]|p|ul|ol|li|article|section)\b/i.test(content)) return "html";
  if (/^#{1,6}\s|^\*\s|^\-\s|^\d+\.\s/m.test(content)) return "markdown";
  return "plain";
}

/**
 * Normaliza documento de bases: saltos, trim final, sanitización HTML si aplica.
 * No altera el contenido sustantivo más allá de seguridad.
 */
export function normalizeContestRulesDocument(content: string): NormalizedRulesDocument {
  if (content.length > MAX_RULES_DOCUMENT_CHARS) {
    throw new Error(`Documento supera el máximo de ${MAX_RULES_DOCUMENT_CHARS} caracteres.`);
  }
  const original = content;
  let working = content.replace(/\r\n/g, "\n");
  const format = detectRulesFormat(working);
  if (format === "html") {
    working = sanitizeRulesHtml(working);
  }
  const normalized = working.replace(/[ \t]+$/gm, "").replace(/\s+$/u, "");
  const contentHash = createHash("sha256").update(normalized, "utf8").digest("hex");
  return { original, normalized, contentHash, format };
}

export { MAX_RULES_DOCUMENT_CHARS };
