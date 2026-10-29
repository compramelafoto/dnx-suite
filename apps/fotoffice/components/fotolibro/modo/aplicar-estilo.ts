"use client";

import type { EstiloFotolibro, TipoPliego } from "@/lib/fotolibro/estilos/tipos";
import type { GeometriaTapa } from "@/lib/fotolibro/tapa/geometria";
import { svgDeTapaIlustrada } from "@/lib/fotolibro/tapa/ilustrada";

/**
 * Dibuja los fondos de un estilo a la medida de este libro y los sube.
 *
 * El navegador convierte el SVG del estilo en una imagen JPG de alta resolución —200 ppp alcanza
 * de sobra para un fondo— y la sube directo al almacenamiento, como las fotos. Son cuatro: uno por
 * tipo de pliego (apertura, dos interiores que se alternan y cierre).
 */

const TIPOS: TipoPliego[] = ["apertura", "interior", "interior-alt", "cierre"];
const PPP_FONDO = 200;

async function svgAJpeg(svg: string, anchoPx: number, altoPx: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = anchoPx;
    canvas.height = altoPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no pudo dibujar el fondo.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, anchoPx, altoPx);
    ctx.drawImage(img, 0, 0, anchoPx, altoPx);
    return await new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo dibujar el fondo."))), "image/jpeg", 0.9));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function subirFondo(templateId: string, tipo: string, blob: Blob): Promise<string> {
  const base = `/api/fotolibro/${encodeURIComponent(templateId)}`;
  const pedido = await fetch(`${base}/subida`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ archivos: [{ tipo: "fondo", filename: `${tipo}.jpg`, contentType: "image/jpeg" }] }),
  });
  const p = (await pedido.json().catch(() => ({}))) as { permisos?: { uploadUrl: string; key: string }[]; error?: string };
  const permiso = p.permisos?.[0];
  if (!pedido.ok || !permiso) throw new Error(p.error || "No se pudo preparar la subida del fondo.");
  const put = await fetch(permiso.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
  if (!put.ok) throw new Error(`No se pudo subir el fondo (${put.status}).`);
  const reg = await fetch(`${base}/fondo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ key: permiso.key }),
  });
  const r = (await reg.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!reg.ok || !r.url) throw new Error(r.error || "No se pudo registrar el fondo.");
  return r.url;
}

export async function dibujarYSubirFondos(
  templateId: string,
  estilo: EstiloFotolibro,
  medidas: { anchoMm: number; altoMm: number },
  alAvanzar?: (hechos: number, total: number) => void,
): Promise<Partial<Record<TipoPliego, string>>> {
  const anchoPx = Math.round((medidas.anchoMm / 25.4) * PPP_FONDO);
  const altoPx = Math.round((medidas.altoMm / 25.4) * PPP_FONDO);
  const fondos: Partial<Record<TipoPliego, string>> = {};
  let hechos = 0;
  await Promise.all(
    TIPOS.map(async (tipo) => {
      const blob = await svgAJpeg(estilo.fondo(tipo, medidas), anchoPx, altoPx);
      fondos[tipo] = await subirFondo(templateId, tipo, blob);
      hechos += 1;
      alAvanzar?.(hechos, TIPOS.length);
    }),
  );
  return fondos;
}

/**
 * La portada ilustrada del estilo (ver `lib/fotolibro/tapa/ilustrada.ts`), dibujada a la medida
 * de la pieza de tapa de este libro y subida como un fondo más.
 */
export async function dibujarYSubirPortada(templateId: string, estilo: EstiloFotolibro, g: GeometriaTapa): Promise<string> {
  const anchoPx = Math.round((g.pieza.ancho / 25.4) * PPP_FONDO);
  const altoPx = Math.round((g.pieza.alto / 25.4) * PPP_FONDO);
  const blob = await svgAJpeg(svgDeTapaIlustrada(estilo, g), anchoPx, altoPx);
  return subirFondo(templateId, "portada", blob);
}
