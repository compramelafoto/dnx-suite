import "server-only";
import QRCode from "qrcode";

/**
 * QR del evento, en SVG.
 *
 * SVG y no PNG: el mismo archivo sirve para la pantalla y para una impresión de un metro
 * sin verse pixelado.
 *
 * Oscuro sobre claro, a propósito. El amarillo de la marca sobre violeta queda lindo y los
 * lectores no lo toman: un QR necesita contraste real, no diseño.
 */
export async function qrDelEvento(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#200638", light: "#FFFFFF" },
  });
}
