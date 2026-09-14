import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import { qrVerificado } from "./qr-verificado";

/**
 * El PDF del centro de mesa: cuatro tarjetas por hoja A4, listas para imprenta.
 *
 * Pensado para que alguien lo mande a imprimir sin saber de imprenta. Por eso
 * trae **sangrado y marcas de corte**: sin sangrado, el mínimo desvío de la
 * guillotina deja una línea blanca en el borde, y en una tarjeta de fondo
 * oscuro se ve muchísimo.
 *
 * El QR se dibuja como vectores a partir de su matriz, no como imagen. Se
 * imprime nítido a cualquier tamaño y no depende de la resolución.
 */

const MM = 2.834645669;

const A4 = { ancho: 210 * MM, alto: 297 * MM };
/** Tamaño final de cada tarjeta, ya cortada. */
const TARJETA = { ancho: 90 * MM, alto: 120 * MM };
/** Lo que se imprime de más para que la guillotina tenga por dónde equivocarse. */
const SANGRADO = 3 * MM;
/** Separación entre tarjetas: el doble del sangrado, para que no se pisen. */
const CALLE = SANGRADO * 2;
const LARGO_DE_MARCA = 4 * MM;

export type DatosDelImpreso = {
  nombreDelEvento: string;
  codigo: string;
  url: string;
  /** Colores del tema del evento. */
  fondo: string;
  texto: string;
  acento: string;
  /** PNG del logo de quien vende. Opcional. */
  logoPng?: Uint8Array | null;
};

function color(hex: string) {
  const limpio = hex.replace("#", "");
  const n = parseInt(limpio.length === 3 ? limpio.replace(/./g, "$&$&") : limpio, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/**
 * Marcas de corte: cuatro pares de líneas finas, por fuera del sangrado.
 *
 * Van en negro y afuera del área impresa para que el operario las vea y la
 * guillotina se las lleve.
 */
function marcasDeCorte(pagina: PDFPage, x: number, y: number) {
  const negro = rgb(0, 0, 0);
  const grosor = 0.25;
  const separacion = SANGRADO;

  const esquinas = [
    { ex: x, ey: y },
    { ex: x + TARJETA.ancho, ey: y },
    { ex: x, ey: y + TARJETA.alto },
    { ex: x + TARJETA.ancho, ey: y + TARJETA.alto },
  ];

  for (const { ex, ey } of esquinas) {
    const haciaAfueraX = ex === x ? -1 : 1;
    const haciaAfueraY = ey === y ? -1 : 1;

    pagina.drawLine({
      start: { x: ex + haciaAfueraX * separacion, y: ey },
      end: { x: ex + haciaAfueraX * (separacion + LARGO_DE_MARCA), y: ey },
      thickness: grosor,
      color: negro,
    });
    pagina.drawLine({
      start: { x: ex, y: ey + haciaAfueraY * separacion },
      end: { x: ex, y: ey + haciaAfueraY * (separacion + LARGO_DE_MARCA) },
      thickness: grosor,
      color: negro,
    });
  }
}

export async function pdfDelCentroDeMesa(datos: DatosDelImpreso): Promise<Uint8Array> {
  // Se verifica el QR ANTES de armar nada. Si no se lee, no hay PDF.
  const { modulos } = await qrVerificado(datos.url);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Subí la Foto — ${datos.nombreDelEvento}`);
  pdf.setSubject("Centro de mesa para imprimir");

  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const logo = datos.logoPng ? await pdf.embedPng(datos.logoPng).catch(() => null) : null;

  const pagina = pdf.addPage([A4.ancho, A4.alto]);

  const anchoTotal = TARJETA.ancho * 2 + CALLE;
  const altoTotal = TARJETA.alto * 2 + CALLE;
  const desdeX = (A4.ancho - anchoTotal) / 2;
  const desdeY = (A4.alto - altoTotal) / 2;

  for (let fila = 0; fila < 2; fila++) {
    for (let columna = 0; columna < 2; columna++) {
      const x = desdeX + columna * (TARJETA.ancho + CALLE);
      const y = desdeY + fila * (TARJETA.alto + CALLE);
      dibujarTarjeta(pagina, x, y, { datos, modulos, negrita, normal, logo });
      marcasDeCorte(pagina, x, y);
    }
  }

  return pdf.save();
}

function dibujarTarjeta(
  pagina: PDFPage,
  x: number,
  y: number,
  ctx: {
    datos: DatosDelImpreso;
    modulos: boolean[][];
    negrita: Awaited<ReturnType<PDFDocument["embedFont"]>>;
    normal: Awaited<ReturnType<PDFDocument["embedFont"]>>;
    logo: Awaited<ReturnType<PDFDocument["embedPng"]>> | null;
  },
) {
  const { datos, modulos, negrita, normal, logo } = ctx;

  // El fondo se pinta con sangrado: se sale 3 mm por los cuatro lados.
  pagina.drawRectangle({
    x: x - SANGRADO,
    y: y - SANGRADO,
    width: TARJETA.ancho + SANGRADO * 2,
    height: TARJETA.alto + SANGRADO * 2,
    color: color(datos.fondo),
  });

  const centro = x + TARJETA.ancho / 2;

  // El logo de quien vende, arriba. La marca que ve el cliente es la suya.
  let cursorY = y + TARJETA.alto - 12 * MM;
  if (logo) {
    const anchoLogo = 34 * MM;
    const escala = anchoLogo / logo.width;
    const altoLogo = logo.height * escala;
    pagina.drawImage(logo, {
      x: centro - anchoLogo / 2,
      y: cursorY - altoLogo,
      width: anchoLogo,
      height: altoLogo,
    });
    cursorY -= altoLogo + 8 * MM;
  }

  const titulo = recortar(datos.nombreDelEvento, 26);
  const anchoTitulo = negrita.widthOfTextAtSize(titulo, 13);
  pagina.drawText(titulo, {
    x: centro - anchoTitulo / 2,
    y: cursorY - 6 * MM,
    size: 13,
    font: negrita,
    color: color(datos.texto),
  });

  /*
    El QR sobre un recuadro blanco, siempre. El fondo del evento puede ser
    oscuro, claro o de color, y un QR necesita contraste real: acá el diseño
    pierde contra la lectura.
  */
  const ladoQr = 46 * MM;
  const qrX = centro - ladoQr / 2;
  const qrY = y + 38 * MM;
  const marco = 4 * MM;

  pagina.drawRectangle({
    x: qrX - marco,
    y: qrY - marco,
    width: ladoQr + marco * 2,
    height: ladoQr + marco * 2,
    color: rgb(1, 1, 1),
  });

  const lado = modulos.length;
  const modulo = ladoQr / lado;
  for (let f = 0; f < lado; f++) {
    for (let c = 0; c < lado; c++) {
      if (!modulos[f]![c]) continue;
      pagina.drawRectangle({
        x: qrX + c * modulo,
        // La matriz se lee de arriba hacia abajo y el PDF mide desde abajo.
        y: qrY + (lado - 1 - f) * modulo,
        width: modulo,
        height: modulo,
        color: rgb(0, 0, 0),
      });
    }
  }

  const invitacion = "Escaneá y subí tus fotos";
  const anchoInv = normal.widthOfTextAtSize(invitacion, 10);
  pagina.drawText(invitacion, {
    x: centro - anchoInv / 2,
    y: y + 26 * MM,
    size: 10,
    font: normal,
    color: color(datos.texto),
  });

  /*
    El código escrito, siempre debajo del QR. Alguien va a tener el teléfono sin
    batería, o una cámara que no lee códigos, o el QR va a quedar tapado por una
    copa. Con el código a mano entra igual.
  */
  const anchoCodigo = negrita.widthOfTextAtSize(datos.codigo, 16);
  pagina.drawText(datos.codigo, {
    x: centro - anchoCodigo / 2,
    y: y + 15 * MM,
    size: 16,
    font: negrita,
    color: color(datos.acento),
  });

  const pie = "subilafoto.com";
  const anchoPie = normal.widthOfTextAtSize(pie, 7);
  pagina.drawText(pie, {
    x: centro - anchoPie / 2,
    y: y + 8 * MM,
    size: 7,
    font: normal,
    color: color(datos.texto),
  });
}

/** Corta un nombre largo sin partir la última palabra al medio. */
function recortar(texto: string, maximo: number): string {
  const limpio = texto.trim();
  if (limpio.length <= maximo) return limpio;
  return `${limpio.slice(0, maximo - 1).trimEnd()}…`;
}
