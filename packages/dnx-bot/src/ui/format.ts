// Formato mínimo para el texto del bot. Función pura y apta para el navegador: no arma HTML,
// devuelve segmentos que el componente convierte en elementos de React (nunca innerHTML).

export type BotSegment =
  | { kind: "text"; text: string; bold: boolean }
  | { kind: "link"; href: string; label: string };

export type BotLine = BotSegment[];

/** Ruta interna del panel: sólo minúsculas, números, "/", "_" y "-". Nada con "//" ni ":". */
const INTERNAL_PATH = /^\/[a-z0-9_-][a-z0-9/_-]*$/;
// Una ruta suelta (separada por espacios), opcionalmente entre paréntesis y con puntuación al final
// (la puntuación tiene que cerrar la palabra: "/a:b" o "/a.com" no son rutas).
const PATH_TOKEN = /(^|\s)(\()?(\/[a-z0-9_-][a-z0-9/_-]*)(\))?(?=$|\s|[.,;:!?]+(?:$|\s))/g;
// Énfasis simple *así* o _así_: se quitan las marcas y queda el texto.
const SINGLE_EMPHASIS = /(^|[\s(])[*_]([^*_\s](?:[^*_]*[^*_\s])?)[*_](?=$|[\s.,;:!?)])/g;

const ACENTOS: Record<string, string> = {
  album: "álbum",
  albumes: "álbumes",
  albums: "álbumes",
  estadisticas: "estadísticas",
  catalogo: "catálogo",
  menu: "menú",
};

export function isInternalPath(p: string): boolean {
  return INTERNAL_PATH.test(p) && !p.includes("//") && !p.includes(":");
}

function prettifySegment(seg: string): string {
  return seg
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => ACENTOS[w] ?? w.replace(/cion$/, "ción"))
    .join(" ");
}

export function pathLabel(path: string): string {
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  if (/^\d+$/.test(last) && parts.length > 1) return `Abrir ${prettifySegment(parts[parts.length - 2]!)} ${last}`;
  return `Abrir ${prettifySegment(last)}`;
}

function stripEmphasis(text: string): string {
  return text.replace(SINGLE_EMPHASIS, "$1$2");
}

function pushText(out: BotSegment[], text: string, bold: boolean) {
  if (!text) return;
  const prev = out[out.length - 1];
  if (prev && prev.kind === "text" && prev.bold === bold) prev.text += text;
  else out.push({ kind: "text", text, bold });
}

export type FormatOptions = {
  /** Prefijos de ruta que pueden ser enlace ("/dashboard/albums" cubre "/dashboard/albums/12"). Sin esto, toda ruta interna válida lo es. */
  rutasPermitidas?: readonly string[];
};

/** true si no hay lista (comportamiento de siempre) o si la ruta es un prefijo permitido o cuelga de uno. */
export function rutaPermitida(path: string, rutasPermitidas?: readonly string[]): boolean {
  if (!rutasPermitidas) return true;
  return rutasPermitidas.some((p) => path === p || path.startsWith(`${p}/`));
}

function inline(out: BotSegment[], text: string, bold: boolean, opts?: FormatOptions) {
  let last = 0;
  for (const m of text.matchAll(PATH_TOKEN)) {
    const [whole, lead = "", open, path = "", close] = m;
    // Paréntesis desparejo: no es "(/ruta)", se deja como texto.
    if ((open && !close) || (!open && close) || !isInternalPath(path) || !rutaPermitida(path, opts?.rutasPermitidas)) continue;
    const start = m.index! + lead.length;
    pushText(out, stripEmphasis(text.slice(last, start)), bold);
    out.push({ kind: "link", href: path, label: pathLabel(path) });
    last = m.index! + whole.length;
  }
  pushText(out, stripEmphasis(text.slice(last)), bold);
}

function formatLine(raw: string, opts?: FormatOptions): BotLine {
  let line = raw.replace(/^\s{0,3}#{1,6}\s+/, "");
  line = line.replace(/^(\s*)[-*]\s+/, "$1• ");
  const out: BotSegment[] = [];
  const parts = line.split("**");
  // Con un número par de "**" el último queda desparejo: se muestra tal cual.
  const unmatchedTail = parts.length % 2 === 0;
  parts.forEach((part, idx) => {
    const isLast = idx === parts.length - 1;
    if (unmatchedTail && isLast) {
      inline(out, `**${part}`, false, opts);
      return;
    }
    const bold = idx % 2 === 1;
    if (bold && part.trim() === "") {
      inline(out, `**${part}**`, false, opts);
      return;
    }
    inline(out, part, bold, opts);
  });
  return out;
}

/** Convierte el texto del bot en líneas de segmentos (negrita, texto, enlaces internos). */
export function formatBotText(text: string, opts?: FormatOptions): BotLine[] {
  return text.split("\n").map((l) => formatLine(l, opts));
}
