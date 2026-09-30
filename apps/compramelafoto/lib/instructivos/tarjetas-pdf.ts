/**
 * Hoja A4 con tarjetas del álbum para repartir en mano.
 *
 * Ocho tarjetas de 85 × 55 mm en una grilla de 2 × 4, con marcas de corte finas. Cada
 * tarjeta lleva el QR del álbum, el nombre del fotógrafo y el título del evento.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { AlbumInstructivoProfile } from "./album-instructivo-profile";
import { lineaDeAccion } from "./cartel-qr-pdf";

const A4 = { ancho: 595.28, alto: 841.89 };

/** 85 × 55 mm en puntos (1 mm = 72/25.4 pt). */
const MM = 72 / 25.4;
const TARJETA = { ancho: 85 * MM, alto: 55 * MM };

const COLUMNAS = 2;
const FILAS = 4;

function hexARgb(hex: string | null) {
  const limpio = (hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return rgb(0.76, 0.48, 0.24);
  const n = Number.parseInt(limpio, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function soloLatin1(texto: string): string {
  return texto.replace(/[^ -ÿ]/g, "");
}

/**
 * Ajusta el texto al ancho disponible: primero encoge la tipografía, y si aun así no
 * entra, lo corta con puntos suspensivos. Sin el corte, el texto de una tarjeta se
 * derrama sobre la tarjeta vecina.
 */
function ajustarAlAncho(
  texto: string,
  font: PDFFont,
  ancho: number,
  maximo: number,
  minimo: number
): { texto: string; tam: number } {
  let tam = maximo;
  while (tam > minimo && font.widthOfTextAtSize(texto, tam) > ancho) tam -= 0.25;
  if (font.widthOfTextAtSize(texto, tam) <= ancho) return { texto, tam };

  let recortado = texto;
  while (recortado.length > 1 && font.widthOfTextAtSize(`${recortado}…`, tam) > ancho) {
    recortado = recortado.slice(0, -1);
  }
  // "…" (U+2026) no existe en Latin-1: tres puntos sí.
  return { texto: `${recortado.trimEnd()}...`, tam };
}

/** Parte el texto en las líneas que entren, hasta un máximo. */
function enLineas(
  texto: string,
  font: PDFFont,
  ancho: number,
  tam: number,
  maxLineas: number
): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const tentativa = actual ? `${actual} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(tentativa, tam) <= ancho) {
      actual = tentativa;
    } else {
      if (actual) lineas.push(actual);
      actual = palabra;
      if (lineas.length === maxLineas) break;
    }
  }
  if (actual && lineas.length < maxLineas) lineas.push(actual);
  return lineas.slice(0, maxLineas);
}

/** Marcas de corte finas en las esquinas, fuera del área imprimible de la tarjeta. */
function marcasDeCorte(page: PDFPage, x: number, y: number, ancho: number, alto: number) {
  const LARGO = 6;
  const gris = rgb(0.75, 0.75, 0.75);
  const linea = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.3, color: gris });

  linea(x - LARGO, y, x - 1, y);
  linea(x - LARGO, y + alto, x - 1, y + alto);
  linea(x + ancho + 1, y, x + ancho + LARGO, y);
  linea(x + ancho + 1, y + alto, x + ancho + LARGO, y + alto);
  linea(x, y - LARGO, x, y - 1);
  linea(x + ancho, y - LARGO, x + ancho, y - 1);
  linea(x, y + alto + 1, x, y + alto + LARGO);
  linea(x + ancho, y + alto + 1, x + ancho, y + alto + LARGO);
}

export async function buildTarjetasPdf(
  profile: AlbumInstructivoProfile,
  qrPng: Uint8Array,
  logoBytes: Uint8Array | null = null
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4.ancho, A4.alto]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const color = hexARgb(profile.fotografo.color);
  const qr = await pdf.embedPng(qrPng);

  let logo: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  if (logoBytes) {
    try {
      const esPng = logoBytes[0] === 0x89 && logoBytes[1] === 0x50;
      logo = esPng ? await pdf.embedPng(logoBytes) : await pdf.embedJpg(logoBytes);
    } catch {
      logo = null;
    }
  }

  const margenX = (A4.ancho - TARJETA.ancho * COLUMNAS) / 2;
  const margenY = (A4.alto - TARJETA.alto * FILAS) / 2;

  const nombre = soloLatin1(profile.fotografo.nombre);
  const titulo = soloLatin1(profile.album.titulo);
  const accion = soloLatin1(lineaDeAccion(profile));
  const web = soloLatin1(profile.album.url.replace(/^https?:\/\//, ""));

  for (let fila = 0; fila < FILAS; fila += 1) {
    for (let col = 0; col < COLUMNAS; col += 1) {
      const x = margenX + col * TARJETA.ancho;
      const y = A4.alto - margenY - (fila + 1) * TARJETA.alto;

      marcasDeCorte(page, x, y, TARJETA.ancho, TARJETA.alto);

      const PAD = 9;
      // El QR manda, pero no puede comerse el ancho: con 136pt de lado quedaban 75pt
      // para el texto y se derramaba sobre la tarjeta de al lado.
      const ladoQr = Math.min(TARJETA.alto - PAD * 2, TARJETA.ancho * 0.42);
      const yQr = y + (TARJETA.alto - ladoQr) / 2;
      page.drawImage(qr, { x: x + PAD, y: yQr, width: ladoQr, height: ladoQr });

      const xTexto = x + PAD + ladoQr + 9;
      const anchoTexto = x + TARJETA.ancho - PAD - xTexto;
      let yTexto = y + TARJETA.alto - PAD;

      if (logo) {
        const altoLogo = 13;
        const escala = Math.min(altoLogo / logo.height, anchoTexto / logo.width);
        const w = logo.width * escala;
        const h = logo.height * escala;
        page.drawImage(logo, { x: xTexto, y: yTexto - h, width: w, height: h });
        yTexto -= h + 4;
      }

      const nom = ajustarAlAncho(nombre, regular, anchoTexto, 7, 5.5);
      page.drawText(nom.texto, {
        x: xTexto,
        y: yTexto - nom.tam,
        size: nom.tam,
        font: regular,
        color: rgb(0.42, 0.45, 0.5),
      });
      yTexto -= nom.tam + 4;

      // El título puede ocupar dos líneas: es el dato que más varía de largo.
      const tamTitulo = 10;
      const lineasTitulo = enLineas(titulo, negrita, anchoTexto, tamTitulo, 2);
      for (const linea of lineasTitulo) {
        const ajustada = ajustarAlAncho(linea, negrita, anchoTexto, tamTitulo, 6);
        page.drawText(ajustada.texto, {
          x: xTexto,
          y: yTexto - ajustada.tam,
          size: ajustada.tam,
          font: negrita,
          color,
        });
        yTexto -= ajustada.tam + 2;
      }
      yTexto -= 5;

      // Tres renglones: con selfie, número y palabra clave la leyenda no entra en dos, y
      // enLineas corta lo que sobra sin avisar.
      const lineasAccion = enLineas(accion, regular, anchoTexto, 7, 3);
      for (const linea of lineasAccion) {
        const ajustada = ajustarAlAncho(linea, regular, anchoTexto, 7, 5.5);
        page.drawText(ajustada.texto, {
          x: xTexto,
          y: yTexto - ajustada.tam,
          size: ajustada.tam,
          font: regular,
          color: rgb(0.2, 0.2, 0.2),
        });
        yTexto -= ajustada.tam + 2;
      }

      const dir = ajustarAlAncho(web, regular, anchoTexto, 6, 4.5);
      page.drawText(dir.texto, {
        x: xTexto,
        y: y + PAD,
        size: dir.tam,
        font: regular,
        color: rgb(0.42, 0.45, 0.5),
      });
    }
  }

  return pdf.save();
}
