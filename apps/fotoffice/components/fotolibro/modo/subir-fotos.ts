"use client";

import type { FotoDelLibro } from "@/lib/fotolibro/modo/estado";

/**
 * Subida de las fotos del fotolibro, del lado del navegador.
 *
 * Por cada foto se suben tres archivos directo al almacenamiento (ver `/api/fotolibro/[id]/subida`):
 * - el **original**, que es lo que se imprime;
 * - una **vista** de 2000 px, para dibujar el pliego en pantalla sin bajar originales de 20 MB;
 * - una **miniatura** de 400 px, para la tira de fotos.
 *
 * Las copias livianas se arman acá, con un `<canvas>`: así el servidor nunca tiene que procesar
 * fotos pesadas.
 */

const LADO_VISTA = 2000;
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
async function prepararVersiones(archivo: File): Promise<{ original: Blob; vista: Blob; mini: Blob; w: number; h: number }> {
  const derecha = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  const cruda = await createImageBitmap(archivo, { imageOrientation: "none" });
  const girada = cruda.width !== derecha.width || cruda.height !== derecha.height;
  cruda.close();
  try {
    const original = girada ? await aJpeg(derecha, Number.MAX_SAFE_INTEGER, 0.95) : archivo;
    const [vista, mini] = await Promise.all([aJpeg(derecha, LADO_VISTA, 0.85), aJpeg(derecha, LADO_MINI, 0.8)]);
    return { original, vista, mini, w: derecha.width, h: derecha.height };
  } finally {
    derecha.close();
  }
}

const TIPOS = ["image/jpeg", "image/png", "image/webp"];

async function leerError(r: Response, porDefecto: string): Promise<string> {
  const data = (await r.json().catch(() => ({}))) as { error?: string };
  return data.error || porDefecto;
}

/** Sube una foto y la devuelve registrada, lista para la tira. */
export async function subirFoto(templateId: string, archivo: File): Promise<FotoDelLibro> {
  if (!TIPOS.includes(archivo.type)) throw new Error(`${archivo.name}: sólo JPG, PNG o WebP.`);
  const v = await prepararVersiones(archivo);
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

  const cuerpo: Record<string, Blob> = { original: v.original, vista: v.vista, mini: v.mini };
  const claves: Record<string, string> = {};
  await Promise.all(
    permisos.map(async (p) => {
      const blob = cuerpo[p.tipo]!;
      const r = await fetch(p.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": p.tipo === "original" ? tipoOriginal : "image/jpeg" },
        body: blob,
      });
      if (!r.ok) throw new Error(`${archivo.name}: no se pudo subir (${r.status}).`);
      claves[p.tipo] = p.key;
    }),
  );

  const registro = await fetch(`${base}/fotos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ...claves, w: v.w, h: v.h, nombre: archivo.name.replace(/\.[^.]+$/, "") }),
  });
  if (!registro.ok) throw new Error(await leerError(registro, `${archivo.name}: no se pudo registrar.`));
  return ((await registro.json()) as { foto: FotoDelLibro }).foto;
}
