/**
 * Un mensaje del invitado, convertido en imagen para que entre en el paquete.
 *
 * El cliente se baja un ZIP con todo el material de su fiesta. Un `.txt` suelto entre
 * trescientas fotos no lo abre nadie: lo que se guarda y se comparte es una imagen. Y se
 * dibuja **igual que en la pantalla del salón**, con el globo de chat, para que al verla
 * en el carrete se entienda de una que es algo que alguien escribió esa noche.
 *
 * Se arma como SVG y lo pasa a PNG `sharp`, que ya es dependencia del proyecto para las
 * variantes de las fotos. Un navegador sin cabeza para esto sería un servidor aparte.
 */
import sharp from "sharp";

/** Las medidas de la imagen. 4:3 como una foto, para que la galería no se descuadre. */
const ANCHO = 1600;
const ALTO = 1200;
/** Cuántos caracteres entran por línea con el tamaño de letra que usamos. */
const POR_LINEA = 26;
const TAMANO_TEXTO = 84;
const INTERLINEA = 108;

/**
 * Escapa lo que rompería el XML.
 *
 * Un SVG es XML: sin esto, un mensaje con `<` corta la etiqueta y la imagen sale rota, y
 * con `&` el documento no parsea y falla el armado del paquete **entero** por un saludo.
 */
export function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Parte el texto en líneas que entren en el globo.
 *
 * SVG no sabe hacer saltos de línea solo: hay que decidirlos acá.
 *
 * Una palabra más larga que la línea **se deja sobresalir** en vez de partirla o
 * descartarla. Que un nombre largo roce el borde es mejor que un mensaje incompleto.
 */
export function partirEnLineas(texto: string, porLinea = POR_LINEA): string[] {
  const lineas: string[] = [];

  for (const parrafo of texto.split("\n")) {
    let actual = "";

    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const probar = actual ? `${actual} ${palabra}` : palabra;
      if (probar.length <= porLinea) {
        actual = probar;
        continue;
      }
      if (actual) lineas.push(actual);
      actual = palabra;
    }

    if (actual) lineas.push(actual);
  }

  return lineas;
}

export type TemaDelMensaje = { fondo: string; texto: string; acento: string };

/** El dibujo del globo, con el texto ya partido y escapado. */
export function svgDelMensaje({
  texto,
  nombre,
  tema,
}: {
  texto: string;
  nombre: string | null;
  tema: TemaDelMensaje;
}): string {
  const lineas = partirEnLineas(texto);
  const altoDelTexto = lineas.length * INTERLINEA;

  // El globo crece con el texto y queda centrado en la imagen.
  const altoGlobo = altoDelTexto + 160;
  const yGlobo = (ALTO - altoGlobo) / 2 - (nombre ? 50 : 0);
  const xGlobo = 140;
  const anchoGlobo = ANCHO - xGlobo * 2;

  const primeraLinea = yGlobo + 80 + TAMANO_TEXTO * 0.8;

  const tspans = lineas
    .map(
      (l, i) =>
        `<tspan x="${ANCHO / 2}" y="${primeraLinea + i * INTERLINEA}">${escaparXml(l)}</tspan>`,
    )
    .join("");

  const pieDeNombre = nombre
    ? `<text x="${ANCHO / 2}" y="${yGlobo + altoGlobo + 130}" text-anchor="middle"
         font-family="sans-serif" font-size="52" font-weight="700"
         fill="${tema.texto}" opacity="0.85">${escaparXml(nombre)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
  <rect width="${ANCHO}" height="${ALTO}" fill="${tema.fondo}"/>
  <rect x="${xGlobo}" y="${yGlobo}" width="${anchoGlobo}" height="${altoGlobo}" rx="72" fill="#FFFFFF" opacity="0.95"/>
  <polygon points="${xGlobo + 90},${yGlobo + altoGlobo} ${xGlobo + 160},${yGlobo + altoGlobo} ${xGlobo + 100},${yGlobo + altoGlobo + 60}" fill="#FFFFFF" opacity="0.95"/>
  <text text-anchor="middle" font-family="sans-serif" font-size="${TAMANO_TEXTO}" font-weight="800" fill="#1A1A1A">${tspans}</text>
  ${pieDeNombre}
</svg>`;
}

/**
 * El PNG listo para meter en el ZIP.
 *
 * Los emojis salen en blanco y negro o no salen: el renderizador de SVG usa las fuentes
 * del sistema del servidor, que no trae una de emojis en color. El texto se lee igual, y
 * resolverlo pediría empaquetar una fuente de varios megas en la función.
 */
export async function imagenDelMensaje(entrada: {
  texto: string;
  nombre: string | null;
  tema: TemaDelMensaje;
}): Promise<Buffer> {
  return sharp(Buffer.from(svgDelMensaje(entrada))).png({ compressionLevel: 9 }).toBuffer();
}
