import { createHash } from "node:crypto";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getFotofficeR2Bucket, getFotofficeR2Client, getFotofficeR2PublicUrl, uploadToFotofficeR2 } from "@/lib/images/r2-client";
import { FOTOFFICE_R2_PREFIXES, isFotofficeOwnedR2Key } from "@/lib/images/r2-key-policy";
import { sniffImageFormat, type SniffedImageFormat } from "@/lib/images/validation";

/**
 * Copia de las fotos de Alboom a R2 para el importador.
 *
 * - Se baja la ORIGINAL de `storage.alboom.ninja`, no el redimensionador de Alboom: alfred agranda
 *   las fotos chicas (pedirle 2560 de ancho a una original de 1200 devuelve 2560 inventados y el
 *   doble de peso), y las originales del sitio de DNX son de 1200 px. Si una original pasa el tope
 *   (2560 px del lado largo; 800 para las fotos de testimonios), se achica acá con sharp.
 * - La firma binaria manda (`sniffImageFormat`), no lo que diga el servidor.
 * - Idempotente: la key sale del hash de la dirección de origen. En la misma corrida una foto se
 *   copia una sola vez (memoria); en otra corrida se encuentra en R2 por su key y no se vuelve a
 *   bajar. El ancho y el alto viajan como metadatos del objeto para poder devolverlos sin bajarlo.
 * - Un error (404, no es imagen, pesa demasiado) se devuelve como `{ error }`: quien carga crea el
 *   trabajo o el artículo igual y lo anota en el informe.
 *
 * Red, R2 y sharp entran como dependencias para poder probarlo sin nada de eso.
 */

export type ResultadoCopia = { url: string; key: string; ancho: number | null; alto: number | null } | { error: string };

export type DepsCopia = {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  subir: (bytes: Buffer, key: string, tipo: string, metadata?: Record<string, string>) => Promise<{ key: string; url: string }>;
  /** Metadatos del objeto si existe; null si no está. */
  cabecera: (key: string) => Promise<{ metadata: Record<string, string> } | null>;
  urlPublica: (key: string) => string;
  /** Medidas y, si pasa el tope, la versión achicada. */
  procesar: (bytes: Buffer, tipo: NonNullable<SniffedImageFormat>, ladoMaximo: number) => Promise<{ bytes: Buffer; ancho: number; alto: number }>;
  esperar: (ms: number) => Promise<void>;
};

export const LADO_MAXIMO_PX = 2560;
export const LADO_MAXIMO_AVATAR_PX = 800;
export const MAX_BYTES_FOTO = 25 * 1024 * 1024;
const REINTENTOS = 2;
const USER_AGENT = "FOTOFFICE-importador/1.0";

/** Imágenes de páginas propias del sitio importadas (Quién soy, Capacitate…). */
export function prefijoImagenesPagina(workspaceId: string): string {
  return `${FOTOFFICE_R2_PREFIXES.sitePaginaImage}/${workspaceId}/`;
}

/** Las mismas carpetas que usa la biblioteca del blog (`uploadBlogImage`). */
export function prefijoImagenesBlog(workspaceId: string, tipo: "hero" | "media"): string {
  return `${tipo === "hero" ? FOTOFFICE_R2_PREFIXES.blogHero : FOTOFFICE_R2_PREFIXES.blogMedia}/${workspaceId}/`;
}

const EXTENSIONES: Record<string, string> = { jpg: ".jpg", jpeg: ".jpg", png: ".png", webp: ".webp" };

/** Key de la copia: prefijo + hash del origen (+ tope, si no es el de siempre) + extensión del origen. */
export function keyDeFoto(urlOrigen: string, prefijo: string, ladoMaximo = LADO_MAXIMO_PX): string {
  const semilla = ladoMaximo === LADO_MAXIMO_PX ? urlOrigen : `${urlOrigen}|${ladoMaximo}`;
  const hash = createHash("sha256").update(semilla).digest("hex").slice(0, 32);
  let ext = ".jpg";
  try {
    const m = /\.([a-z0-9]+)$/i.exec(new URL(urlOrigen).pathname);
    ext = (m && EXTENSIONES[m[1].toLowerCase()]) || ".jpg";
  } catch {
    // dirección rara: queda .jpg; el Content-Type real sale de la firma.
  }
  return `${prefijo.replace(/\/*$/, "/")}${hash}${ext}`;
}

class ErrorDeCopia extends Error {
  constructor(
    message: string,
    readonly reintentable: boolean,
  ) {
    super(message);
  }
}

const medida = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);

export function crearCopiadorDeFotos(parciales: Partial<DepsCopia> = {}) {
  const deps: DepsCopia = { ...depsReales(), ...parciales };
  const memoria = new Map<string, Promise<ResultadoCopia>>();

  async function bajar(url: string): Promise<Buffer> {
    let ultimo: ErrorDeCopia = new ErrorDeCopia("no se pudo bajar", true);
    for (let intento = 0; intento <= REINTENTOS; intento++) {
      if (intento > 0) await deps.esperar(1000 * intento);
      try {
        const res = await deps.fetch(url, { redirect: "follow", headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(30_000) });
        if (!res.ok) {
          const reintentable = res.status >= 500 || res.status === 408 || res.status === 429;
          ultimo = new ErrorDeCopia(`respondió ${res.status}`, reintentable);
          if (!reintentable) break;
          continue;
        }
        if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES_FOTO) throw new ErrorDeCopia("pesa más de 25 MB", false);
        const bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.byteLength > MAX_BYTES_FOTO) throw new ErrorDeCopia("pesa más de 25 MB", false);
        return bytes;
      } catch (err) {
        if (err instanceof ErrorDeCopia && !err.reintentable) throw err;
        ultimo = err instanceof ErrorDeCopia ? err : new ErrorDeCopia(err instanceof Error ? err.message : String(err), true);
      }
    }
    throw ultimo;
  }

  async function copiar(urlOrigen: string, prefijo: string, ladoMaximo: number): Promise<ResultadoCopia> {
    const key = keyDeFoto(urlOrigen, prefijo, ladoMaximo);
    // La key tiene que ser borrable por FOTOFFICE: si no, nadie podría limpiarla después.
    if (!isFotofficeOwnedR2Key(key)) return { error: "destino fuera del espacio de FOTOFFICE" };
    try {
      const existente = await deps.cabecera(key);
      if (existente) {
        return { url: deps.urlPublica(key), key, ancho: medida(existente.metadata.ancho), alto: medida(existente.metadata.alto) };
      }
      const original = await bajar(urlOrigen);
      const tipo = sniffImageFormat(original.subarray(0, 16));
      if (!tipo) return { error: "no es una imagen JPG, PNG o WebP" };
      const final = await deps.procesar(original, tipo, ladoMaximo);
      const subida = await deps.subir(final.bytes, key, tipo, { ancho: String(final.ancho), alto: String(final.alto), origen: urlOrigen.slice(0, 1000) });
      return { url: subida.url, key: subida.key, ancho: final.ancho, alto: final.alto };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return {
    /** Copia una foto (o devuelve la copia que ya existe). Nunca lanza. */
    copiarFoto(urlOrigen: string, destinoPrefijo: string, opciones: { ladoMaximo?: number } = {}): Promise<ResultadoCopia> {
      const lado = opciones.ladoMaximo ?? LADO_MAXIMO_PX;
      const clave = `${lado}|${destinoPrefijo}|${urlOrigen}`;
      let p = memoria.get(clave);
      if (!p) {
        p = copiar(urlOrigen, destinoPrefijo, lado);
        memoria.set(clave, p);
      }
      return p;
    },
  };
}

/** Medidas reales (respetando la orientación EXIF) y, si pasa el tope, la versión achicada. */
async function procesarConSharp(bytes: Buffer, tipo: NonNullable<SniffedImageFormat>, ladoMaximo: number) {
  const { default: sharp } = await import("sharp");
  const meta = await sharp(bytes).metadata();
  const girada = (meta.orientation ?? 1) >= 5;
  const ancho = (girada ? meta.height : meta.width) ?? 0;
  const alto = (girada ? meta.width : meta.height) ?? 0;
  if (Math.max(ancho, alto) <= ladoMaximo) return { bytes, ancho, alto };

  let tubo = sharp(bytes).rotate().resize({ width: ladoMaximo, height: ladoMaximo, fit: "inside", withoutEnlargement: true });
  tubo = tipo === "image/png" ? tubo.png() : tipo === "image/webp" ? tubo.webp({ quality: 85 }) : tubo.jpeg({ quality: 85, mozjpeg: true });
  const { data, info } = await tubo.toBuffer({ resolveWithObject: true });
  return { bytes: data, ancho: info.width, alto: info.height };
}

function depsReales(): DepsCopia {
  return {
    fetch: (url, init) => fetch(url, init),
    subir: async (bytes, key, tipo, metadata) => uploadToFotofficeR2(bytes, key, tipo, metadata),
    cabecera: async (key) => {
      try {
        const r = await getFotofficeR2Client().send(new HeadObjectCommand({ Bucket: getFotofficeR2Bucket(), Key: key }));
        return { metadata: r.Metadata ?? {} };
      } catch (err) {
        const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (e?.name === "NotFound" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) return null;
        throw err;
      }
    },
    urlPublica: (key) => getFotofficeR2PublicUrl(key),
    procesar: procesarConSharp,
    esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}
