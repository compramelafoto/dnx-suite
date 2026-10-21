/**
 * Preparar en el navegador lo que se sube para importar una factura (stock etapa 3).
 *
 * Las acciones del servidor (y Vercel) cortan los pedidos de más de ~4,5 MB (`bodySizeLimit:
 * "4mb"` en `next.config.ts`), así que una foto del celular no puede viajar tal cual: se achica
 * acá (lado mayor 2000 px, JPEG 85 %), lo mismo que después haría el servidor. Un PDF no se
 * puede achicar: si pesa más de 4 MB se rechaza antes de mandarlo.
 *
 * Este archivo NO importa nada del servidor: lo usa la pantalla (componente de cliente).
 */

export const LADO_MAYOR_MAX = 2000;
export const CALIDAD_JPEG = 0.85;
/** Tope del PDF. Un margen debajo de los 4 MB de la acción, por lo que suma el resto del formulario. */
export const MAX_BYTES_PDF = 4 * 1024 * 1024 - 64 * 1024;
/** Tope de lo que se manda ya comprimido (misma cuenta que el PDF). */
export const MAX_BYTES_ENVIO = MAX_BYTES_PDF;
export const MAX_BYTES_CSV_CLIENTE = 1024 * 1024;

export const ERR_PDF_PESADO = "El PDF pesa más de 4 MB: dividilo o mandá una foto de cada hoja.";
export const ERR_FOTO_NO_SE_ABRE =
  "Esa foto no se puede abrir acá: exportala como JPG o sacala con la cámara en modo compatible.";
export const ERR_TIPO = "Elegí una foto o un PDF de la factura.";
export const ERR_CSV_PESADO = "El CSV pesa más de 1 MB.";
export const ERR_CSV_TIPO = "Elegí un archivo .csv con la plantilla.";
export const ERR_FOTO_PESADA = "La foto sigue pesando demasiado: probá con una captura o recortala.";

type ArchivoInfo = { name: string; type: string; size: number };

export type ClaseArchivo = { ok: true; clase: "imagen" | "pdf" } | { ok: false; error: string };

const EXT_IMAGEN = /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i;

/** ¿Es una foto o un PDF? Y si es PDF, ¿entra? (La foto se mide después de achicarla.) */
export function clasificarArchivo(a: ArchivoInfo): ClaseArchivo {
  const tipo = (a.type || "").toLowerCase();
  if (tipo === "application/pdf" || /\.pdf$/i.test(a.name)) {
    if (a.size > MAX_BYTES_PDF) return { ok: false, error: ERR_PDF_PESADO };
    return { ok: true, clase: "pdf" };
  }
  if (tipo.startsWith("image/") || EXT_IMAGEN.test(a.name)) return { ok: true, clase: "imagen" };
  return { ok: false, error: ERR_TIPO };
}

/** El CSV de la plantilla: hasta 1 MB y con pinta de CSV (misma regla que el servidor). */
export function validarCsv(a: ArchivoInfo): { ok: true } | { ok: false; error: string } {
  if (a.size > MAX_BYTES_CSV_CLIENTE) return { ok: false, error: ERR_CSV_PESADO };
  if (!/\.csv$/i.test(a.name) && !/csv|text\/plain/i.test(a.type)) return { ok: false, error: ERR_CSV_TIPO };
  return { ok: true };
}

/** Medidas para que el lado mayor no pase de `max`, sin agrandar nunca y sin bajar de 1 px. */
export function medidasReducidas(ancho: number, alto: number, max = LADO_MAYOR_MAX): { ancho: number; alto: number } {
  const w = Math.max(1, Math.round(ancho));
  const h = Math.max(1, Math.round(alto));
  const mayor = Math.max(w, h);
  if (mayor <= max) return { ancho: w, alto: h };
  const f = max / mayor;
  return { ancho: Math.max(1, Math.round(w * f)), alto: Math.max(1, Math.round(h * f)) };
}

// ---------------------------------------------------------------------------------------------
// Sólo navegador

type Fuente = { origen: CanvasImageSource; ancho: number; alto: number; cerrar: () => void };

async function decodificar(archivo: Blob): Promise<Fuente | null> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image": respeta la orientación EXIF (la foto del celular sale derecha).
      const bmp = await createImageBitmap(archivo, { imageOrientation: "from-image" });
      return { origen: bmp, ancho: bmp.width, alto: bmp.height, cerrar: () => bmp.close() };
    } catch {
      // Sigue con <img>: Safari abre HEIC por ese camino.
    }
  }
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) {
      URL.revokeObjectURL(url);
      return null;
    }
    return { origen: img, ancho: img.naturalWidth, alto: img.naturalHeight, cerrar: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

/**
 * Achica una foto para mandarla: lado mayor ≤ 2000 px, JPEG 85 %, como `factura.jpg`.
 * Si el navegador no la puede abrir (p. ej. HEIC en Chrome), devuelve el error para mostrar.
 */
export async function comprimirImagen(archivo: Blob): Promise<{ ok: true; file: File } | { ok: false; error: string }> {
  const fuente = await decodificar(archivo);
  if (!fuente) return { ok: false, error: ERR_FOTO_NO_SE_ABRE };
  try {
    const { ancho, alto } = medidasReducidas(fuente.ancho, fuente.alto);
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, error: ERR_FOTO_NO_SE_ABRE };
    // Fondo blanco: un PNG con transparencia saldría negro en JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(fuente.origen, 0, 0, ancho, alto);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", CALIDAD_JPEG));
    if (!blob) return { ok: false, error: ERR_FOTO_NO_SE_ABRE };
    if (blob.size > MAX_BYTES_ENVIO) return { ok: false, error: ERR_FOTO_PESADA };
    return { ok: true, file: new File([blob], "factura.jpg", { type: "image/jpeg" }) };
  } finally {
    fuente.cerrar();
  }
}

/** Baja un texto como archivo. Con BOM, para que Excel lea bien los acentos. */
export function descargarTexto(nombre: string, contenido: string, tipo = "text/csv;charset=utf-8"): void {
  const cuerpo = contenido.startsWith("﻿") ? contenido : `﻿${contenido}`;
  const url = URL.createObjectURL(new Blob([cuerpo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copia al portapapeles; si la API moderna no está (http, navegador viejo), con un textarea. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Sigue con el método viejo.
  }
  try {
    const t = document.createElement("textarea");
    t.value = texto;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  } catch {
    return false;
  }
}

/** El mensaje del resultado de una importación (sin el aviso de cuadre ni el proveedor). */
export function mensajeResultado(r: { agregadas: number; sinAsociar: number; corregidas: number; descartadas: number }): string {
  const partes = [
    r.agregadas === 1
      ? `Se agregó 1 línea (${r.sinAsociar} sin asociar).`
      : `Se agregaron ${r.agregadas} líneas (${r.sinAsociar} sin asociar).`,
  ];
  if (r.corregidas > 0) {
    partes.push(
      r.corregidas === 1 ? "1 cantidad se llevó a 1: revisala." : `${r.corregidas} cantidades se llevaron a 1: revisalas.`,
    );
  }
  if (r.descartadas > 0) {
    partes.push(
      r.descartadas === 1 ? "1 fila sin descripción no se cargó." : `${r.descartadas} filas sin descripción no se cargaron.`,
    );
  }
  return partes.join(" ");
}
