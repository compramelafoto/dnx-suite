/**
 * PDF imprimible del diploma: una hoja A4 apaisada con el PNG ya renderizado
 * centrado y ajustado sin recorte (se escala por el lado más chico).
 *
 * No agrega dependencias: `pdf-lib` ya está instalada en la app.
 */
import { PDFDocument } from "pdf-lib";

/** A4 apaisado, en puntos (1 pt = 1/72"): 841.89 × 595.28. */
export const A4_LANDSCAPE_PT: [number, number] = [841.89, 595.28];

/** Envuelve el PNG del diploma en una hoja A4 apaisada, centrado y sin recorte. */
export async function buildDiplomaPdf(png: Buffer): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(A4_LANDSCAPE_PT);
  const image = await doc.embedPng(png);
  const escala = Math.min(
    A4_LANDSCAPE_PT[0] / image.width,
    A4_LANDSCAPE_PT[1] / image.height
  );
  const width = image.width * escala;
  const height = image.height * escala;
  page.drawImage(image, {
    x: (A4_LANDSCAPE_PT[0] - width) / 2,
    y: (A4_LANDSCAPE_PT[1] - height) / 2,
    width,
    height,
  });
  return Buffer.from(await doc.save());
}
