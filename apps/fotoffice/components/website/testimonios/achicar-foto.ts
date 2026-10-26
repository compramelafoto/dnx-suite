import { LADO_MAX_FOTO_AUTOR } from "@/lib/testimonios/dominio";
import { medidasReducidas } from "@/lib/trabajos/reglas";

/**
 * Achicado de la foto del autor en el navegador: lo usan el formulario público y la carga manual
 * del panel. La foto viaja dentro del envío y la sube el servidor (ver `lib/testimonios/foto.ts`).
 */

/** Calidad del JPEG de la foto achicada. */
const CALIDAD = 0.85;

/**
 * La foto del autor como se guarda: JPEG con el lado más largo en 800 px (alcanza de sobra para un
 * círculo de 48 px y pesa poco). Si el navegador no puede achicarla, va la original y el servidor
 * decide al verificarla.
 */
export async function achicarFoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const { ancho, alto } = medidasReducidas(bitmap.width, bitmap.height, LADO_MAX_FOTO_AUTOR);
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return file;
    // Lo transparente queda blanco (en JPEG saldría negro).
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", CALIDAD));
    return blob && blob.type === "image/jpeg" ? blob : file;
  } finally {
    bitmap.close();
  }
}

