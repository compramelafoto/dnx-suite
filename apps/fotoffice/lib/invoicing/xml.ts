/**
 * XML mínimo para hablar con ARCA: escapar lo que se manda y leer etiquetas de lo que vuelve.
 *
 * No es un parser general. Las respuestas de WSAA y WSFEv1 son documentos chicos y planos, con o
 * sin prefijo de espacio de nombres según el servidor; esto busca por nombre local, ignora el
 * prefijo y los atributos, y no ejecuta nada (sin DTD ni entidades externas). Módulo PURO.
 */

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Sólo las cinco entidades XML y las numéricas. Cualquier otra cosa queda como está. */
export function unescapeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_m, e: string) => {
    if (e === "amp") return "&";
    if (e === "lt") return "<";
    if (e === "gt") return ">";
    if (e === "quot") return '"';
    if (e === "apos") return "'";
    const code = e.startsWith("#x") ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
}

function esc(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Todos los bloques `<nombre>…</nombre>` (con cualquier prefijo), sin el contenido escapado.
 * Los auto-cerrados `<nombre/>` cuentan como vacíos. No soporta el mismo nombre anidado en sí
 * mismo, que ARCA no usa.
 */
export function blocks(xml: string, name: string): string[] {
  const n = esc(name);
  const re = new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${n}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:[A-Za-z_][\\w.-]*:)?${n}\\s*>)`, "g");
  const out: string[] = [];
  for (const m of xml.matchAll(re)) out.push(m[1] ?? "");
  return out;
}

/** El primer bloque, o null si no está. */
export function block(xml: string, name: string): string | null {
  return blocks(xml, name)[0] ?? null;
}

/** El texto de la primera etiqueta, ya desescapado y sin espacios en los bordes. */
export function text(xml: string, name: string): string | null {
  const b = block(xml, name);
  return b === null ? null : unescapeXml(b).trim();
}

/** Un elemento con texto escapado. `null`/`undefined` no se emite. */
export function el(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}
