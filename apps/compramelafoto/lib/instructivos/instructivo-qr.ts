/**
 * QR generado localmente.
 *
 * El QR que se muestra hoy en Publicación se le pide a `api.qrserver.com`
 * (`lib/albums/album-share-url.ts`). Eso no sirve acá por dos razones: un PDF que se
 * compone en el servidor no puede depender de que un tercero conteste, y esa llamada le
 * informa a ese tercero la dirección de cada álbum. `qrcode` ya es dependencia del
 * proyecto (se usa en las etiquetas escolares).
 */

import QRCode from "qrcode";

export async function buildQrPng(url: string, tamanoPx = 320): Promise<Buffer> {
  const destino = url.trim();
  if (!destino) throw new Error("El QR necesita una dirección");
  return QRCode.toBuffer(destino, {
    type: "png",
    width: tamanoPx,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

/** El mismo QR listo para incrustar en un `<img src>`. */
export async function buildQrDataUrl(url: string, tamanoPx = 320): Promise<string> {
  const png = await buildQrPng(url, tamanoPx);
  return `data:image/png;base64,${png.toString("base64")}`;
}
