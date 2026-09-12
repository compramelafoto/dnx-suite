/**
 * La dirección a la que lleva el QR del evento.
 *
 * Función pura y aparte del generador de QR: se usa tanto en el servidor (al dibujar el
 * código) como en la vista del panel, y así puede probarse sin arrastrar dependencias.
 */
export function urlDelCodigo(baseUrl: string, codigo: string): string {
  // Una barra de más en la base produciría "//e/", que rompe el enlace y nadie lo nota
  // hasta que alguien escanea el cartel ya impreso.
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/e/${codigo.toUpperCase()}`;
}
