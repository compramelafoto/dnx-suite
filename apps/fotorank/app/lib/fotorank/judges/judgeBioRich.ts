/**
 * Bio enriquecida del jurado: documento estructurado versionado (sin HTML libre).
 * Se valida en servidor al guardar; el render público solo usa texto + URLs permitidas.
 */

export const JUDGE_BIO_DOCUMENT_VERSION = 1 as const;

export type JudgeBioBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "bulletList"; items: string[] }
  | { type: "numberedList"; items: string[] }
  | { type: "link"; text: string; url: string };

export type JudgeBioDocument = {
  version: typeof JUDGE_BIO_DOCUMENT_VERSION;
  blocks: JudgeBioBlock[];
};

const MAX_BLOCKS = 40;
const MAX_PARAGRAPH_LEN = 4000;
const MAX_HEADING_LEN = 200;
const MAX_LIST_ITEMS = 30;
const MAX_ITEM_LEN = 800;
const MAX_LINK_TEXT_LEN = 200;
const URL_MAX_LEN = 2048;

/** Evita HTML/script u otros marcadores peligrosos en campos de texto. */
function assertPlainTextField(value: string, field: string, maxLen: number): string | null {
  const t = value.trim();
  if (t.length > maxLen) return `${field}: demasiado largo (máx. ${maxLen} caracteres).`;
  if (/[<>]/.test(t)) return `${field}: no se permiten los caracteres < o >.`;
  if (/javascript:/i.test(t)) return `${field}: contenido no permitido.`;
  return null;
}

export function isSafeExternalUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s || s.length > URL_MAX_LEN) return false;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (!url.hostname) return false;
  return true;
}

function parseBlock(raw: unknown, index: number): { ok: true; block: JudgeBioBlock } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: `Bloque ${index + 1}: formato inválido.` };
  }
  const b = raw as Record<string, unknown>;
  const type = b.type;

  if (type === "paragraph") {
    const text = String(b.text ?? "");
    const err = assertPlainTextField(text, "Párrafo", MAX_PARAGRAPH_LEN);
    if (err) return { ok: false, error: err };
    return { ok: true, block: { type: "paragraph", text: text.trim() } };
  }

  if (type === "heading") {
    const level = Number(b.level);
    if (level !== 2 && level !== 3) {
      return { ok: false, error: `Título (bloque ${index + 1}): el nivel debe ser 2 o 3.` };
    }
    const text = String(b.text ?? "");
    const err = assertPlainTextField(text, "Título", MAX_HEADING_LEN);
    if (err) return { ok: false, error: err };
    return { ok: true, block: { type: "heading", level, text: text.trim() } };
  }

  if (type === "bulletList" || type === "numberedList") {
    const itemsRaw = b.items;
    if (!Array.isArray(itemsRaw)) {
      return { ok: false, error: `Lista (bloque ${index + 1}): falta el arreglo de ítems.` };
    }
    if (itemsRaw.length > MAX_LIST_ITEMS) {
      return { ok: false, error: `Lista (bloque ${index + 1}): demasiados ítems (máx. ${MAX_LIST_ITEMS}).` };
    }
    const items: string[] = [];
    for (let j = 0; j < itemsRaw.length; j++) {
      const item = String(itemsRaw[j] ?? "");
      const err = assertPlainTextField(item, `Ítem ${j + 1}`, MAX_ITEM_LEN);
      if (err) return { ok: false, error: err };
      items.push(item.trim());
    }
    return {
      ok: true,
      block: type === "bulletList" ? { type: "bulletList", items } : { type: "numberedList", items },
    };
  }

  if (type === "link") {
    const text = String(b.text ?? "");
    const url = String(b.url ?? "");
    const te = assertPlainTextField(text, "Texto del enlace", MAX_LINK_TEXT_LEN);
    if (te) return { ok: false, error: te };
    if (!isSafeExternalUrl(url)) {
      return { ok: false, error: `Enlace (bloque ${index + 1}): URL no válida (solo http/https).` };
    }
    return { ok: true, block: { type: "link", text: text.trim(), url: url.trim() } };
  }

  return { ok: false, error: `Bloque ${index + 1}: tipo desconocido.` };
}

/**
 * Valida y normaliza el JSON guardado en fullBioRichJson.
 */
export function parseAndValidateJudgeBioDocument(
  input: unknown
): { ok: true; doc: JudgeBioDocument } | { ok: false; error: string } {
  if (input === null || input === undefined) {
    return { ok: true, doc: { version: JUDGE_BIO_DOCUMENT_VERSION, blocks: [] } };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "La bio enriquecida tiene un formato inválido." };
  }
  const obj = input as Record<string, unknown>;
  const version = Number(obj.version);
  if (version !== JUDGE_BIO_DOCUMENT_VERSION) {
    return { ok: false, error: "Versión de bio no soportada." };
  }
  const blocksRaw = obj.blocks;
  if (!Array.isArray(blocksRaw)) {
    return { ok: false, error: "La bio enriquecida debe incluir una lista de bloques." };
  }
  if (blocksRaw.length > MAX_BLOCKS) {
    return { ok: false, error: `Demasiados bloques en la bio (máx. ${MAX_BLOCKS}).` };
  }
  const blocks: JudgeBioBlock[] = [];
  for (let i = 0; i < blocksRaw.length; i++) {
    const parsed = parseBlock(blocksRaw[i], i);
    if (!parsed.ok) return parsed;
    blocks.push(parsed.block);
  }
  return { ok: true, doc: { version: JUDGE_BIO_DOCUMENT_VERSION, blocks } };
}

export function emptyJudgeBioDocument(): JudgeBioDocument {
  return { version: JUDGE_BIO_DOCUMENT_VERSION, blocks: [] };
}

/* ---------- Enlaces adicionales (otherLinksJson) ---------- */

export const JUDGE_OTHER_LINKS_VERSION = 1 as const;
export type JudgeOtherLinksDocument = {
  version: typeof JUDGE_OTHER_LINKS_VERSION;
  links: Array<{ label: string; url: string }>;
};

const MAX_OTHER_LINKS = 12;
const MAX_LINK_LABEL_LEN = 80;

export function parseAndValidateJudgeOtherLinks(
  input: unknown
): { ok: true; doc: JudgeOtherLinksDocument } | { ok: false; error: string } {
  if (input === null || input === undefined) {
    return { ok: true, doc: { version: JUDGE_OTHER_LINKS_VERSION, links: [] } };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Enlaces adicionales: formato inválido." };
  }
  const obj = input as Record<string, unknown>;
  if (Number(obj.version) !== JUDGE_OTHER_LINKS_VERSION) {
    return { ok: false, error: "Versión de enlaces no soportada." };
  }
  const linksRaw = obj.links;
  if (!Array.isArray(linksRaw)) {
    return { ok: false, error: "Enlaces adicionales: falta la lista links." };
  }
  if (linksRaw.length > MAX_OTHER_LINKS) {
    return { ok: false, error: `Demasiados enlaces (máx. ${MAX_OTHER_LINKS}).` };
  }
  const links: Array<{ label: string; url: string }> = [];
  for (let i = 0; i < linksRaw.length; i++) {
    const row = linksRaw[i];
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, error: `Enlace ${i + 1}: formato inválido.` };
    }
    const r = row as Record<string, unknown>;
    const label = String(r.label ?? "");
    const url = String(r.url ?? "");
    const le = assertPlainTextField(label, "Etiqueta del enlace", MAX_LINK_LABEL_LEN);
    if (le) return { ok: false, error: le };
    if (!isSafeExternalUrl(url)) {
      return { ok: false, error: `Enlace ${i + 1}: URL no válida.` };
    }
    links.push({ label: label.trim(), url: url.trim() });
  }
  return { ok: true, doc: { version: JUDGE_OTHER_LINKS_VERSION, links } };
}

export function emptyJudgeOtherLinksDocument(): JudgeOtherLinksDocument {
  return { version: JUDGE_OTHER_LINKS_VERSION, links: [] };
}
