import { decodificarEntidades } from "./copia";
import { esDireccionPublica } from "./url";

/**
 * La foto de la nota es la imagen principal de la noticia fuente (la que el medio declara para
 * redes: `og:image` o `twitter:image`), con crédito visible al medio. Acá lo puro: encontrarla en
 * el HTML, decidir si el tipo y el tamaño sirven, y armar el crédito. Módulo PURO.
 */

/** Tope de la imagen que se baja (igual que las portadas del blog). */
export const MAX_BYTES_IMAGEN = 8 * 1024 * 1024;
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"] as const;

export type ImagenDeLaFuente = {
  /** Dirección absoluta de la imagen en el sitio del medio. */
  url: string;
  /** Crédito de la foto si la página lo declara (autor / agencia). */
  credito: string | null;
  /** `og:site_name`: el nombre del medio según la página. */
  sitio: string | null;
};

type Meta = { clave: string; valor: string };

/** Las etiquetas `<meta>` de la página como pares clave (property o name, en minúscula) → content. */
export function metasDeHtml(html: string): Meta[] {
  const cabeza = html.slice(0, 400_000);
  const metas: Meta[] = [];
  for (const m of cabeza.matchAll(/<meta\b[^>]*>/gi)) {
    const etiqueta = m[0];
    const attr = (nombre: string) => {
      const r = new RegExp(`\\s${nombre}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(etiqueta);
      return r ? (r[2] ?? r[3] ?? r[4] ?? "") : null;
    };
    const clave = (attr("property") ?? attr("name") ?? attr("itemprop"))?.trim().toLowerCase();
    const valor = attr("content");
    if (!clave || valor === null) continue;
    const limpio = decodificarEntidades(valor).trim();
    if (limpio) metas.push({ clave, valor: limpio });
  }
  return metas;
}

/** Orden de preferencia de la imagen principal. */
const CLAVES_IMAGEN = ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src", "image"];
/** Etiquetas que declaran el crédito de la FOTO (no el autor de la nota, que puede ser otra persona). */
const CLAVES_CREDITO = ["og:image:credit", "image:credit", "twitter:image:credit", "photo:credit", "copyrightholder"];

/** Una dirección absoluta y pública (resuelve las relativas contra la página), o null. */
function absoluta(cruda: string, base: string): string | null {
  try {
    const u = new URL(cruda, base);
    const texto = u.toString();
    return esDireccionPublica(texto) ? texto : null;
  } catch {
    return null;
  }
}

/** La imagen principal que declara la página, o null si no hay una usable. */
export function imagenDeHtml(html: string, urlPagina: string): ImagenDeLaFuente | null {
  const metas = metasDeHtml(html);
  const valor = (clave: string) => metas.find((m) => m.clave === clave)?.valor ?? null;
  let url: string | null = null;
  for (const clave of CLAVES_IMAGEN) {
    const v = valor(clave);
    if (!v) continue;
    const a = absoluta(v, urlPagina);
    // Un SVG o un GIF no sirven de portada (suelen ser logos o animaciones).
    if (a && !/\.(svg|gif)(\?|#|$)/i.test(a)) {
      url = a;
      break;
    }
  }
  if (!url) return null;
  let credito: string | null = null;
  for (const clave of CLAVES_CREDITO) {
    const v = valor(clave);
    if (v && !/^https?:\/\//i.test(v) && v.length <= 120) {
      credito = v;
      break;
    }
  }
  const sitio = valor("og:site_name");
  return { url, credito, sitio: sitio && sitio.length <= 80 ? sitio : null };
}

/** ¿El tipo informado por el servidor es una imagen que aceptamos? Devuelve el tipo limpio o null. */
export function tipoDeImagenAceptado(contentType: string | null | undefined): (typeof TIPOS_IMAGEN)[number] | null {
  const t = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return (TIPOS_IMAGEN as readonly string[]).includes(t) ? (t as (typeof TIPOS_IMAGEN)[number]) : null;
}

/** Un nombre de archivo para la copia: "periodista-<dominio>.<ext>". */
export function nombreDeArchivo(urlImagen: string, tipo: string): string {
  const ext = tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";
  let host = "fuente";
  try {
    host = new URL(urlImagen).hostname.replace(/^www\./, "").replace(/[^a-z0-9.-]/gi, "") || "fuente";
  } catch {
    // queda "fuente"
  }
  return `periodista-${host}.${ext}`.slice(0, 120);
}

export type CreditoFoto = {
  /** Lo que se muestra: "Jane Doe / PetaPixel" o "PetaPixel". */
  texto: string;
  /** La noticia fuente (a donde lleva el enlace del crédito). */
  url: string;
  /** El texto del enlace: el dominio del medio. */
  enlace: string;
};

/** El crédito visible: "Foto: <autor / medio> — <dominio enlazado a la fuente>". */
export function creditoDeFoto(input: { medio?: string | null; sitio?: string | null; credito?: string | null; fuenteUrl: string }): CreditoFoto {
  let dominio = input.fuenteUrl;
  try {
    dominio = new URL(input.fuenteUrl).hostname.replace(/^www\./, "");
  } catch {
    // queda la dirección entera
  }
  const medio = input.medio?.trim() || input.sitio?.trim() || dominio;
  const credito = input.credito?.trim();
  const texto = credito && credito.toLowerCase() !== medio.toLowerCase() ? `${credito} / ${medio}` : medio;
  return { texto, url: input.fuenteUrl, enlace: dominio };
}
