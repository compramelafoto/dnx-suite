import QRCode from "qrcode";

/**
 * La matriz de módulos del QR (`true` = negro), para dibujarlo como vectores en el PDF: se
 * imprime nítido a cualquier tamaño. Corrección M: aguanta una ficha algo rayada o sucia.
 */
export function matrizDelQr(url: string): boolean[][] {
  if (!url.trim()) throw new Error("No se puede armar un QR sin dirección.");
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const datos = qr.modules.data;
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => Boolean(datos[y * n + x])));
}
