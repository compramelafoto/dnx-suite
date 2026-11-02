import { LADO_MAX_FOTO_INSCRIPTO } from "@/lib/eventos/inscripcion";
import { medidasReducidas } from "@/lib/trabajos/reglas";

/**
 * Achicado de la foto del inscripto en el navegador, como el de los testimonios: JPEG con el lado
 * más largo en 1600 px (alcanza para la placa de 1080 y pesa menos de 1 MB). Vercel corta los envíos
 * de más de 4,5 MB; una foto de celular de 8 MB no llegaría. Si el navegador no puede achicarla, va
 * la original y el servidor decide.
 */
export async function achicarFoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const { ancho, alto } = medidasReducidas(bitmap.width, bitmap.height, LADO_MAX_FOTO_INSCRIPTO);
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.88));
    return blob && blob.type === "image/jpeg" ? blob : file;
  } finally {
    bitmap.close();
  }
}
