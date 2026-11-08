import { z } from "zod";
import { categoriaValida, CATEGORIAS_NOTA, type CategoriaNota } from "./gustos";
import type { CreditoFoto } from "./imagen";
import { normalizarUrl } from "./url";

/**
 * Lo que devuelve Claude, validado. El modelo contesta un bloque ```json (no se usa la salida
 * estructurada de la API porque se combina con la búsqueda web y sus citas): acá se extrae, se
 * valida con zod y se arma el contenido Tiptap del borrador (párrafos y subtítulos H2, nunca H1,
 * con la fuente y el crédito de la foto enlazados al final). Módulo PURO.
 */

export const MIN_PALABRAS = 300;
export const MAX_PALABRAS = 900;

const bloque = z.object({
  tipo: z.enum(["parrafo", "subtitulo"]),
  texto: z.string().trim().min(1).max(3000),
});

const camposDeNota = {
  titulo: z.string().trim().min(10).max(120),
  bajada: z.string().trim().min(20).max(300),
  cuerpo: z.array(bloque).min(2).max(40),
};

export type BloqueNota = z.infer<typeof bloque>;

const esquemaReescritura = z.object(camposDeNota);
export type NotaReescrita = z.infer<typeof esquemaReescritura>;

const esquemaNota = z.object({
  fuenteUrl: z.string().trim().max(2000),
  fuenteTitulo: z.string().trim().min(3).max(300),
  fuenteMedio: z.string().trim().max(120).optional().nullable(),
  ...camposDeNota,
  /** El hecho del que trata la noticia, corto (para no repetir temas). */
  tema: z.string().trim().min(5).max(120),
  /** Una de `CATEGORIAS_NOTA` (sin importar mayúsculas ni tildes). */
  categoria: z
    .string()
    .refine((c) => categoriaValida(c) !== null, { message: `tiene que ser una de: ${CATEGORIAS_NOTA.join(", ")}` })
    .transform((c): CategoriaNota => categoriaValida(c) ?? CATEGORIAS_NOTA[0]),
});

export type NotaPropuesta = z.infer<typeof esquemaNota> & { fuenteUrlNormalizada: string };

export type ResultadoParseo<T> = { ok: true; valor: T } | { ok: false; error: string };

/** El JSON de la respuesta: el último bloque ```json, o si no hay, de la primera "{" a la última "}". */
export function extraerJson(texto: string): unknown {
  const bloques = [...texto.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]?.trim() ?? "");
  const candidatos = bloques.filter((b) => b.startsWith("{")).reverse();
  const desde = texto.indexOf("{");
  const hasta = texto.lastIndexOf("}");
  if (desde >= 0 && hasta > desde) candidatos.push(texto.slice(desde, hasta + 1));
  for (const c of candidatos) {
    try {
      return JSON.parse(c);
    } catch {
      // probar el siguiente
    }
  }
  return undefined;
}

export function contarPalabras(cuerpo: BloqueNota[]): number {
  return cuerpo.reduce((n, b) => n + b.texto.split(/\s+/).filter(Boolean).length, 0);
}

function errorZod(e: z.ZodError): string {
  return e.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`)
    .join("; ");
}

function validarLargo(cuerpo: BloqueNota[]): string | null {
  const n = contarPalabras(cuerpo);
  if (n < MIN_PALABRAS) return `el cuerpo tiene ${n} palabras; tienen que ser entre 400 y 700`;
  if (n > MAX_PALABRAS) return `el cuerpo tiene ${n} palabras; tienen que ser entre 400 y 700`;
  if (!cuerpo.some((b) => b.tipo === "parrafo")) return "el cuerpo no tiene párrafos";
  return null;
}

export function parsearNota(texto: string): ResultadoParseo<NotaPropuesta> {
  const json = extraerJson(texto);
  if (json === undefined) return { ok: false, error: "no encontré un JSON válido en la respuesta" };
  const r = esquemaNota.safeParse(json);
  if (!r.success) return { ok: false, error: errorZod(r.error) };
  const fuenteUrlNormalizada = normalizarUrl(r.data.fuenteUrl);
  if (!fuenteUrlNormalizada) return { ok: false, error: "fuenteUrl no es una dirección http(s) válida" };
  const largo = validarLargo(r.data.cuerpo);
  if (largo) return { ok: false, error: largo };
  return { ok: true, valor: { ...r.data, fuenteUrlNormalizada } };
}

export function parsearReescritura(texto: string): ResultadoParseo<NotaReescrita> {
  const json = extraerJson(texto);
  if (json === undefined) return { ok: false, error: "no encontré un JSON válido en la respuesta" };
  const r = esquemaReescritura.safeParse(json);
  if (!r.success) return { ok: false, error: errorZod(r.error) };
  const largo = validarLargo(r.data.cuerpo);
  if (largo) return { ok: false, error: largo };
  return { ok: true, valor: r.data };
}

/** Todo el texto de la nota junto (para el detector de copia). */
export function textoDeLaNota(nota: Pick<NotaReescrita, "titulo" | "bajada" | "cuerpo">): string {
  return [nota.titulo, nota.bajada, ...nota.cuerpo.map((b) => b.texto)].join("\n");
}

export type DocTiptap = { type: "doc"; content: Record<string, unknown>[] };

const texto = (t: string) => ({ type: "text", text: t });

const enlace = (t: string, href: string) => ({
  type: "text",
  text: t,
  marks: [{ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer nofollow" } }],
});

/**
 * El contenido del borrador: párrafos y H2; al final "Fuente: <medio: título enlazado>" y, si la
 * nota lleva la foto de la noticia, "Foto: <autor / medio> — <dominio enlazado a la fuente>".
 */
export function notaATiptap(
  cuerpo: BloqueNota[],
  fuente: { url: string; titulo: string; medio?: string | null },
  foto?: CreditoFoto | null,
): DocTiptap {
  const content: Record<string, unknown>[] = cuerpo.map((b) =>
    b.tipo === "subtitulo"
      ? { type: "heading", attrs: { level: 2 }, content: [texto(b.texto)] }
      : { type: "paragraph", content: [texto(b.texto)] },
  );
  const etiqueta = fuente.medio?.trim() ? `${fuente.medio.trim()}: ${fuente.titulo}` : fuente.titulo;
  content.push({ type: "paragraph", content: [texto("Fuente: "), enlace(etiqueta, fuente.url)] });
  if (foto) content.push({ type: "paragraph", content: [texto(`Foto: ${foto.texto} — `), enlace(foto.enlace, foto.url)] });
  return { type: "doc", content };
}
