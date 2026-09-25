/**
 * Cartel con el QR grande para colgar en el evento.
 *
 * Contenido fijo y tamaño fijo, así que no necesita el Designer: logo, título del álbum,
 * QR gigante, dirección web y una sola línea que dice qué hacer, tomada del método de
 * búsqueda real del álbum.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import type { AlbumInstructivoProfile } from "./album-instructivo-profile";

export type TamanoCartel = "a4" | "a5";

const MEDIDAS: Record<TamanoCartel, { ancho: number; alto: number }> = {
  a4: { ancho: 595.28, alto: 841.89 },
  a5: { ancho: 419.53, alto: 595.28 },
};

function hexARgb(hex: string | null) {
  const limpio = (hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return rgb(0.76, 0.48, 0.24);
  const n = Number.parseInt(limpio, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function soloLatin1(texto: string): string {
  return texto.replace(/[^ -ÿ]/g, "");
}

/** La línea que le dice a quien pasa por delante qué va a encontrar del otro lado. */
export function lineaDeAccion(p: AlbumInstructivoProfile): string {
  if (p.momento === "simple") return "Escaneá el código y guardá el enlace de tus fotos";
  if (p.momento === "preventa") return "Escaneá el código y reservá tus fotos";
  if (p.entrada === "selfie_obligatoria") {
    return "Escaneá el código y sacate una selfie para ver tus fotos";
  }
  // La búsqueda por selfie existe en todo álbum abierto con fotos, aunque el análisis
  // facial todavía no haya terminado: el cartel se imprime antes de que termine, y
  // esperar a las caras detectadas lo hacía anunciar sólo el número.
  const metodos: string[] = [];
  if (p.momento === "postventa" || p.busqueda.includes("cara")) metodos.push("una selfie");
  if (p.busqueda.includes("dorsal")) metodos.push("tu número");
  if (p.busqueda.includes("palabra")) metodos.push("palabra clave");
  if (metodos.length === 0) return "Escaneá el código y mirá tus fotos";
  const lista =
    metodos.length === 1
      ? metodos[0]
      : `${metodos.slice(0, -1).join(", ")} o ${metodos[metodos.length - 1]}`;
  return `Escaneá el código y buscá tus fotos con ${lista}`;
}

/** Encoge el texto hasta que entre en una sola línea. */
function tamanoQueEntra(
  texto: string,
  font: PDFFont,
  ancho: number,
  maximo: number,
  minimo = 8
): number {
  let tam = maximo;
  while (tam > minimo && font.widthOfTextAtSize(texto, tam) > ancho) tam -= 1;
  return tam;
}

export async function buildCartelQrPdf(
  profile: AlbumInstructivoProfile,
  qrPng: Uint8Array,
  tamano: TamanoCartel = "a4",
  logoBytes: Uint8Array | null = null
): Promise<Uint8Array> {
  const { ancho: ANCHO, alto: ALTO } = MEDIDAS[tamano];
  const MARGEN = ANCHO * 0.09;
  const ANCHO_UTIL = ANCHO - MARGEN * 2;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([ANCHO, ALTO]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const color = hexARgb(profile.fotografo.color);

  // Se miden todas las piezas antes de dibujar ninguna: un cartel con el contenido
  // arriba y un tercio de hoja vacío abajo se ve incompleto colgado en la pared.
  let logo: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  let logoW = 0;
  let logoH = 0;
  if (logoBytes) {
    try {
      const esPng = logoBytes[0] === 0x89 && logoBytes[1] === 0x50;
      logo = esPng ? await pdf.embedPng(logoBytes) : await pdf.embedJpg(logoBytes);
      const escala = Math.min((ALTO * 0.07) / logo.height, ANCHO_UTIL / logo.width);
      logoW = logo.width * escala;
      logoH = logo.height * escala;
    } catch {
      // Un logo ilegible no puede dejar al fotógrafo sin cartel.
      logo = null;
    }
  }

  const nombre = soloLatin1(profile.fotografo.nombre);
  const tamNombre = tamanoQueEntra(nombre, regular, ANCHO_UTIL, ANCHO * 0.028);
  const tamTituloMedido = tamanoQueEntra(
    soloLatin1(profile.album.titulo),
    negrita,
    ANCHO_UTIL,
    ANCHO * 0.062
  );
  const ladoQrMedido = ANCHO * 0.55;
  const tamAccionMedido = tamanoQueEntra(
    soloLatin1(lineaDeAccion(profile)),
    negrita,
    ANCHO_UTIL,
    ANCHO * 0.038
  );
  const tamWebMedido = tamanoQueEntra(
    soloLatin1(profile.album.url.replace(/^https?:\/\//, "")),
    regular,
    ANCHO_UTIL,
    ANCHO * 0.026
  );

  const altoContenido =
    (logo ? logoH + MARGEN * 0.5 : 0) +
    tamNombre +
    MARGEN * 0.4 +
    tamTituloMedido +
    MARGEN +
    ladoQrMedido +
    MARGEN * 0.8 +
    tamAccionMedido +
    MARGEN * 0.45 +
    tamWebMedido;

  // Un poco por encima del centro geométrico: ópticamente se lee mejor.
  let y = Math.min(ALTO - MARGEN, ALTO - (ALTO - altoContenido) * 0.42);

  if (logo) {
    page.drawImage(logo, { x: (ANCHO - logoW) / 2, y: y - logoH, width: logoW, height: logoH });
    y -= logoH + MARGEN * 0.5;
  }

  page.drawText(nombre, {
    x: (ANCHO - regular.widthOfTextAtSize(nombre, tamNombre)) / 2,
    y: y - tamNombre,
    size: tamNombre,
    font: regular,
    color: rgb(0.42, 0.45, 0.5),
  });
  y -= tamNombre + MARGEN * 0.4;

  const titulo = soloLatin1(profile.album.titulo);
  const tamTitulo = tamanoQueEntra(titulo, negrita, ANCHO_UTIL, ANCHO * 0.062);
  page.drawText(titulo, {
    x: (ANCHO - negrita.widthOfTextAtSize(titulo, tamTitulo)) / 2,
    y: y - tamTitulo,
    size: tamTitulo,
    font: negrita,
    color,
  });
  y -= tamTitulo + MARGEN;

  // El QR es el protagonista: 55% del ancho de la página, centrado.
  const qr = await pdf.embedPng(qrPng);
  const LADO_QR = ANCHO * 0.55;
  page.drawImage(qr, {
    x: (ANCHO - LADO_QR) / 2,
    y: y - LADO_QR,
    width: LADO_QR,
    height: LADO_QR,
  });
  y -= LADO_QR + MARGEN * 0.8;

  const accion = soloLatin1(lineaDeAccion(profile));
  const tamAccion = tamanoQueEntra(accion, negrita, ANCHO_UTIL, ANCHO * 0.038);
  page.drawText(accion, {
    x: (ANCHO - negrita.widthOfTextAtSize(accion, tamAccion)) / 2,
    y: y - tamAccion,
    size: tamAccion,
    font: negrita,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= tamAccion + MARGEN * 0.45;

  const web = soloLatin1(profile.album.url.replace(/^https?:\/\//, ""));
  const tamWeb = tamanoQueEntra(web, regular, ANCHO_UTIL, ANCHO * 0.026);
  page.drawText(web, {
    x: (ANCHO - regular.widthOfTextAtSize(web, tamWeb)) / 2,
    y: y - tamWeb,
    size: tamWeb,
    font: regular,
    color: rgb(0.42, 0.45, 0.5),
  });

  return pdf.save();
}
