"use client";

import type { FotoDelLibro } from "@/lib/fotolibro/modo/estado";
import { BYTES_EXIF, fechaDeToma } from "@/lib/fotolibro/modo/exif";
import type { Cara } from "@/lib/fotolibro/modo/caras";
import { detectarCaras } from "./detectar-caras";

/**
 * Subida de las fotos del fotolibro, del lado del navegador.
 *
 * Por cada foto se suben tres archivos directo al almacenamiento (ver `/api/fotolibro/[id]/subida`):
 * - el **original**, que es lo que se imprime;
 * - una **vista** de 1600 px, para dibujar el pliego en pantalla sin bajar originales de 20 MB
 *   (a pantalla completa alcanza y sobra; pesa un tercio menos que una de 2000);
 * - una **miniatura** de 400 px, para la tira de fotos y los pliegos chicos.
 *
 * Las copias livianas se arman acá, con un `<canvas>`: así el servidor nunca tiene que procesar
 * fotos pesadas.
 *
 * Se sube en dos pasos: primero la vista y la miniatura (unos cientos de KB), y la foto ya aparece
 * en la tira para armar; el original (varios MB) sigue de fondo y se confirma al terminar.
 */

const LADO_VISTA = 1600;
const LADO_MINI = 400;

async function aJpeg(bitmap: ImageBitmap, ladoMax: number, calidad: number): Promise<Blob> {
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * escala));
  const h = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no pudo procesar la foto.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo preparar la foto."))), "image/jpeg", calidad),
  );
}

/**
 * Las tres versiones de una foto, ya derechas.
 *
 * Muchas cámaras guardan la foto vertical "acostada", con una marca que dice girarla. El navegador
 * la respeta, pero el PDF de impresión no: la foto saldría acostada y deformada. Por eso, si la foto
 * viene girada, el original se vuelve a guardar derecho antes de subirlo.
 */
async function prepararVersiones(archivo: File): Promise<{ original: Blob; vista: Blob; mini: Blob; w: number; h: number; caras: Cara[] | null }> {
  const derecha = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  const cruda = await createImageBitmap(archivo, { imageOrientation: "none" });
  const girada = cruda.width !== derecha.width || cruda.height !== derecha.height;
  cruda.close();
  try {
    const original = girada ? await aJpeg(derecha, Number.MAX_SAFE_INTEGER, 0.95) : archivo;
    const [vista, mini, caras] = await Promise.all([aJpeg(derecha, LADO_VISTA, 0.85), aJpeg(derecha, LADO_MINI, 0.8), detectarCaras(derecha)]);
    return { original, vista, mini, w: derecha.width, h: derecha.height, caras };
  } finally {
    derecha.close();
  }
}

const TIPOS = ["image/jpeg", "image/png", "image/webp"];

/**
 * Cuándo se sacó: del EXIF si es un JPG de cámara; si no, la fecha del archivo (en la hora de
 * esta computadora, igual que la cámara guarda la suya), que suele ser la de la toma o la copia.
 */
async function cuandoSeSaco(archivo: File): Promise<string> {
  try {
    const exif = fechaDeToma(await archivo.slice(0, BYTES_EXIF).arrayBuffer());
    if (exif) return exif;
  } catch {
    // Sin EXIF legible: se usa la fecha del archivo.
  }
  const d = new Date(archivo.lastModified || Date.now());
  const dd = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}T${dd(d.getHours())}:${dd(d.getMinutes())}:${dd(d.getSeconds())}`;
}

async function leerError(r: Response, porDefecto: string): Promise<string> {
  const data = (await r.json().catch(() => ({}))) as { error?: string };
  return data.error || porDefecto;
}

export type FotoSubida = {
  /** La foto ya registrada, con el original todavía subiendo (`claveOriginal`). */
  foto: FotoDelLibro;
  /** Sube el original. Termina sin error cuando quedó en el almacenamiento. */
  subirOriginal: () => Promise<void>;
};

/**
 * Primer paso de la subida: vista y miniatura. Devuelve la foto lista para usar y la tarea que
 * sube el original, para que quien llama la corra de fondo.
 */
export async function subirFoto(templateId: string, archivo: File): Promise<FotoSubida> {
  if (!TIPOS.includes(archivo.type)) throw new Error(`${archivo.name}: sólo JPG, PNG o WebP.`);
  const [v, tomada] = await Promise.all([prepararVersiones(archivo), cuandoSeSaco(archivo)]);
  const tipoOriginal = v.original === archivo ? archivo.type : "image/jpeg";

  const base = `/api/fotolibro/${encodeURIComponent(templateId)}`;
  const pedido = await fetch(`${base}/subida`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      archivos: [
        { tipo: "original", filename: archivo.name, contentType: tipoOriginal },
        { tipo: "vista", filename: "vista.jpg", contentType: "image/jpeg" },
        { tipo: "mini", filename: "mini.jpg", contentType: "image/jpeg" },
      ],
    }),
  });
  if (!pedido.ok) throw new Error(await leerError(pedido, "No se pudo preparar la subida."));
  const { permisos } = (await pedido.json()) as { permisos: { tipo: string; uploadUrl: string; key: string }[] };
  const permiso = (tipo: string) => {
    const p = permisos.find((x) => x.tipo === tipo);
    if (!p) throw new Error("No se pudo preparar la subida.");
    return p;
  };
  const subir = async (tipo: string, blob: Blob, contentType: string) => {
    const r = await fetch(permiso(tipo).uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
    if (!r.ok) throw new Error(`${archivo.name}: no se pudo subir (${r.status}).`);
  };

  await Promise.all([subir("vista", v.vista, "image/jpeg"), subir("mini", v.mini, "image/jpeg")]);

  const registro = await fetch(`${base}/fotos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      original: permiso("original").key,
      vista: permiso("vista").key,
      mini: permiso("mini").key,
      originalPendiente: true,
      tomada,
      ...(v.caras ? { caras: v.caras } : {}),
      w: v.w,
      h: v.h,
      nombre: archivo.name.replace(/\.[^.]+$/, ""),
    }),
  });
  if (!registro.ok) throw new Error(await leerError(registro, `${archivo.name}: no se pudo registrar.`));
  const foto = ((await registro.json()) as { foto: FotoDelLibro }).foto;
  return { foto, subirOriginal: () => subir("original", v.original, tipoOriginal) };
}

/** Pregunta al servidor si llegaron estos originales (por su clave). */
export async function confirmarOriginalesEnServidor(templateId: string, claves: string[]): Promise<Record<string, boolean>> {
  if (claves.length === 0) return {};
  const r = await fetch(`/api/fotolibro/${encodeURIComponent(templateId)}/fotos/confirmar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ claves }),
  });
  if (!r.ok) throw new Error(await leerError(r, "No se pudo confirmar la subida de los originales."));
  return ((await r.json()) as { resultado: Record<string, boolean> }).resultado;
}
