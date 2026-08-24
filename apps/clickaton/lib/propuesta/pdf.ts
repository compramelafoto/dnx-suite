/**
 * Arma el dossier en PDF de una propuesta comercial.
 *
 * El documento recorre las líneas del plan: la cantidad de páginas depende de
 * cuántas piezas tenga la propuesta, no de secciones fijas. Es lo que permite
 * que el mismo generador sirva cuando aparezcan precios, extras físicos y
 * merchandising, sin reescribir el armado.
 *
 * Server-only: compone las piezas con `sharp` y lee del sistema de archivos.
 */
import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import { buildProposalPlan, resolvePlateTreatment, type ProposalLine } from "@repo/partners";
import { composePiece, measureLogo } from "./compose";

/** A4 vertical, en puntos. El dossier es vertical por pedido comercial. */
const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 46;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

/** Paleta de Clickatón: negro, amarillo de marca, y violeta solo como cierre. */
const INK = rgb(0.067, 0.067, 0.067);
const BRAND = rgb(1, 0.769, 0);
const PAPER = rgb(1, 1, 1);
const MUTED = rgb(0.45, 0.45, 0.45);
const RULE = rgb(0.85, 0.85, 0.84);
const VIOLET = rgb(0.424, 0.325, 1);

type Fonts = { regular: PDFFont; bold: PDFFont };

export type BuildProposalPdfInput = {
  brandName: string;
  industry?: string | null;
  logo: Buffer;
  /** Piezas que el vendedor sacó de la propuesta. */
  excludePieceIds?: readonly string[];
  /** Fecha del documento. Se inyecta para que el resultado sea reproducible. */
  issuedAt: Date;
};

/** Parte el texto en renglones que entran en el ancho dado. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const palabras = text.split(/\s+/).filter(Boolean);
  const renglones: string[] = [];
  let actual = "";

  for (const palabra of palabras) {
    const tentativa = actual ? `${actual} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(tentativa, size) <= maxWidth) {
      actual = tentativa;
      continue;
    }
    if (actual) renglones.push(actual);
    actual = palabra;
  }
  if (actual) renglones.push(actual);
  return renglones;
}

/** Dibuja un párrafo y devuelve la altura que ocupó. */
function drawParagraph(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; font: PDFFont; size: number; maxWidth: number; color: ReturnType<typeof rgb>; leading?: number },
): number {
  const leading = opts.leading ?? opts.size * 1.45;
  const renglones = wrap(text, opts.font, opts.size, opts.maxWidth);
  renglones.forEach((renglon, i) => {
    page.drawText(renglon, {
      x: opts.x,
      y: opts.y - i * leading,
      size: opts.size,
      font: opts.font,
      color: opts.color,
    });
  });
  return renglones.length * leading;
}

/** Escala una imagen para entrar en una caja, sin deformarla. */
function fitBox(
  natural: { width: number; height: number },
  box: { width: number; height: number },
): { width: number; height: number } {
  const escala = Math.min(box.width / natural.width, box.height / natural.height);
  return { width: natural.width * escala, height: natural.height * escala };
}

/** El logo del cliente convertido a PNG, sea cual sea el formato que subió. */
async function logoComoPng(logo: Buffer): Promise<Buffer> {
  return sharp(logo).png().toBuffer();
}

function formatearFecha(fecha: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(fecha);
}

/** Portada: fondo negro, el logo del cliente sobre una placa clara. */
async function drawCover(
  doc: PDFDocument,
  fonts: Fonts,
  input: { brandName: string; industry: string | null; logo: Buffer; fecha: string; logoOscuro: boolean },
) {
  const page = doc.addPage([PAGE.width, PAGE.height]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: INK });

  const logoPng = await doc.embedPng(await logoComoPng(input.logo));
  const caja = { width: CONTENT_WIDTH - 80, height: 150 };
  const medida = fitBox(logoPng, caja);

  // El logo va sobre una placa clara solo si es oscuro: sobre el negro de la
  // portada un logo oscuro desaparecería.
  const placaAlto = medida.height + 44;
  const placaAncho = medida.width + 64;
  const placaX = (PAGE.width - placaAncho) / 2;
  const placaY = PAGE.height - 300;

  if (input.logoOscuro) {
    page.drawRectangle({
      x: placaX,
      y: placaY,
      width: placaAncho,
      height: placaAlto,
      color: PAPER,
    });
  }
  page.drawImage(logoPng, {
    x: (PAGE.width - medida.width) / 2,
    y: placaY + (placaAlto - medida.height) / 2,
    width: medida.width,
    height: medida.height,
  });

  page.drawRectangle({ x: MARGIN, y: placaY - 58, width: 54, height: 4, color: BRAND });

  page.drawText("PROPUESTA COMERCIAL", {
    x: MARGIN,
    y: placaY - 96,
    size: 11,
    font: fonts.bold,
    color: BRAND,
  });

  const titulo = input.brandName;
  const tamTitulo = fonts.bold.widthOfTextAtSize(titulo, 40) > CONTENT_WIDTH ? 28 : 40;
  page.drawText(titulo, {
    x: MARGIN,
    y: placaY - 148,
    size: tamTitulo,
    font: fonts.bold,
    color: PAPER,
  });

  if (input.industry) {
    page.drawText(input.industry, {
      x: MARGIN,
      y: placaY - 176,
      size: 13,
      font: fonts.regular,
      color: rgb(0.72, 0.72, 0.72),
    });
  }

  page.drawText("DNX Suite · Clickatón · FotoRank · InfoSpot · ComprameLaFoto", {
    x: MARGIN,
    y: MARGIN + 26,
    size: 9.5,
    font: fonts.regular,
    color: rgb(0.6, 0.6, 0.6),
  });
  page.drawText(input.fecha, {
    x: MARGIN,
    y: MARGIN + 8,
    size: 9.5,
    font: fonts.regular,
    color: rgb(0.6, 0.6, 0.6),
  });
}

/** Encabezado común de las páginas de contenido. */
function drawHeader(page: PDFPage, fonts: Fonts, kicker: string) {
  page.drawText(kicker.toUpperCase(), {
    x: MARGIN,
    y: PAGE.height - MARGIN - 10,
    size: 8.5,
    font: fonts.bold,
    color: MUTED,
  });
  page.drawRectangle({
    x: MARGIN,
    y: PAGE.height - MARGIN - 22,
    width: CONTENT_WIDTH,
    height: 1.4,
    color: BRAND,
  });
}

/** Página 2: qué es esto y dónde aparece la marca. */
function drawIntro(doc: PDFDocument, fonts: Fonts, brandName: string, cantidadPiezas: number) {
  const page = doc.addPage([PAGE.width, PAGE.height]);
  drawHeader(page, fonts, "Dónde aparece tu marca");

  let y = PAGE.height - MARGIN - 68;

  page.drawText("Cuatro plataformas, un mismo público", {
    x: MARGIN,
    y,
    size: 22,
    font: fonts.bold,
    color: INK,
  });
  y -= 34;

  y -= drawParagraph(
    page,
    `DNX Suite reúne cuatro plataformas alrededor de la fotografía y los eventos. ${brandName} aparece en las pantallas reales que usan organizadores, fotógrafos y público, no en espacios genéricos.`,
    { x: MARGIN, y, font: fonts.regular, size: 11.5, maxWidth: CONTENT_WIDTH, color: rgb(0.25, 0.25, 0.25) },
  );
  y -= 22;

  const plataformas: Array<[string, string]> = [
    ["Clickatón", "Maratones fotográficas: inscripción, competencia y premiación."],
    ["FotoRank", "Concursos fotográficos con jurado y votación."],
    ["InfoSpot", "Medio de noticias, eventos y cultura."],
    ["ComprameLaFoto", "Venta de fotografías de eventos a sus protagonistas."],
  ];

  for (const [nombre, detalle] of plataformas) {
    page.drawRectangle({ x: MARGIN, y: y - 3, width: 3, height: 26, color: BRAND });
    page.drawText(nombre, { x: MARGIN + 14, y: y + 10, size: 12.5, font: fonts.bold, color: INK });
    page.drawText(detalle, { x: MARGIN + 14, y: y - 5, size: 10.5, font: fonts.regular, color: MUTED });
    y -= 46;
  }

  y -= 12;
  page.drawRectangle({ x: MARGIN, y, width: CONTENT_WIDTH, height: 1, color: RULE });
  y -= 30;

  y -= drawParagraph(
    page,
    `En las páginas que siguen vas a ver ${cantidadPiezas} ${cantidadPiezas === 1 ? "espacio" : "espacios"} publicitarios, cada uno con el logo de ${brandName} montado sobre la pantalla real donde aparecería, en computadora y en celular.`,
    { x: MARGIN, y, font: fonts.regular, size: 11.5, maxWidth: CONTENT_WIDTH, color: rgb(0.25, 0.25, 0.25) },
  );
}

/**
 * Arma el dossier completo.
 * Devuelve los bytes del PDF, listos para descargar.
 */
export async function buildProposalPdf(input: BuildProposalPdfInput): Promise<Uint8Array> {
  const plate = resolvePlateTreatment(await measureLogo(input.logo));
  const plan = buildProposalPlan({
    brandName: input.brandName,
    industry: input.industry ?? null,
    plate,
    excludePieceIds: input.excludePieceIds,
  });

  const doc = await PDFDocument.create();
  doc.setTitle(`Propuesta comercial · ${plan.brandName}`);
  doc.setProducer("DNX Partners");
  doc.setCreationDate(input.issuedAt);
  doc.setModificationDate(input.issuedAt);

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  await drawCover(doc, fonts, {
    brandName: plan.brandName,
    industry: plan.industry,
    logo: input.logo,
    fecha: formatearFecha(input.issuedAt),
    logoOscuro: plate.plate !== "DARK",
  });

  const incluidas = plan.lines.filter((l) => l.selection === "INCLUDED");
  drawIntro(doc, fonts, plan.brandName, incluidas.length);

  for (const [i, line] of incluidas.entries()) {
    const [desktop, mobile] = await Promise.all([
      composePiece({ pieceId: line.pieceId, logo: input.logo, brandName: plan.brandName, viewport: "desktop" }),
      composePiece({ pieceId: line.pieceId, logo: input.logo, brandName: plan.brandName, viewport: "mobile" }),
    ]);
    await drawPieceSpread(doc, fonts, line, { desktop, mobile }, i + 1, incluidas.length);
  }

  drawSummary(doc, fonts, incluidas);
  drawBackCover(doc, fonts, plan.brandName, formatearFecha(input.issuedAt));

  return doc.save();
}

/** Página de una pieza: título, dónde aparece, y los dos mockups. */
async function drawPieceSpread(
  doc: PDFDocument,
  fonts: Fonts,
  line: ProposalLine,
  imagenes: { desktop: Buffer; mobile: Buffer },
  indice: number,
  total: number,
) {
  const page = doc.addPage([PAGE.width, PAGE.height]);
  drawHeader(page, fonts, `Espacio ${indice} de ${total}`);

  let y = PAGE.height - MARGIN - 62;

  page.drawText(line.label, { x: MARGIN, y, size: 18, font: fonts.bold, color: INK });
  y -= 22;

  const altoTexto = drawParagraph(page, line.location, {
    x: MARGIN,
    y,
    font: fonts.regular,
    size: 11,
    maxWidth: CONTENT_WIDTH,
    color: MUTED,
  });
  y -= altoTexto + 20;

  // Vista de computadora: ancha, arriba.
  const desktopPng = await doc.embedPng(imagenes.desktop);
  const desktopBox = fitBox(desktopPng, { width: CONTENT_WIDTH, height: 320 });
  page.drawImage(desktopPng, {
    x: MARGIN + (CONTENT_WIDTH - desktopBox.width) / 2,
    y: y - desktopBox.height,
    width: desktopBox.width,
    height: desktopBox.height,
  });
  page.drawText("EN COMPUTADORA", {
    x: MARGIN,
    y: y - desktopBox.height - 15,
    size: 8,
    font: fonts.bold,
    color: MUTED,
  });
  y -= desktopBox.height + 40;

  // Vista de celular: angosta, a la izquierda; a la derecha, la ficha técnica.
  const mobilePng = await doc.embedPng(imagenes.mobile);
  const mobileBox = fitBox(mobilePng, { width: 150, height: 250 });
  page.drawImage(mobilePng, {
    x: MARGIN,
    y: y - mobileBox.height,
    width: mobileBox.width,
    height: mobileBox.height,
  });
  page.drawText("EN CELULAR", {
    x: MARGIN,
    y: y - mobileBox.height - 15,
    size: 8,
    font: fonts.bold,
    color: MUTED,
  });

  const fichaX = MARGIN + mobileBox.width + 28;
  const fichaAncho = CONTENT_WIDTH - mobileBox.width - 28;
  let fichaY = y - 6;

  const filas: Array<[string, string]> = [
    ["Formato", line.label.split(" · ")[0] ?? line.label],
    ["Plataforma", line.label.split(" · ")[1] ?? "—"],
    ["Cantidad", String(line.quantity)],
  ];

  for (const [etiqueta, valor] of filas) {
    page.drawText(etiqueta.toUpperCase(), { x: fichaX, y: fichaY, size: 7.5, font: fonts.bold, color: MUTED });
    fichaY -= 14;
    const alto = drawParagraph(page, valor, {
      x: fichaX,
      y: fichaY,
      font: fonts.regular,
      size: 11,
      maxWidth: fichaAncho,
      color: INK,
    });
    fichaY -= alto + 12;
    page.drawRectangle({ x: fichaX, y: fichaY + 6, width: fichaAncho, height: 0.8, color: RULE });
    fichaY -= 12;
  }
}

/** Resumen: qué se incluye y qué tiene que entregar el anunciante. */
function drawSummary(doc: PDFDocument, fonts: Fonts, lines: ProposalLine[]) {
  const page = doc.addPage([PAGE.width, PAGE.height]);
  drawHeader(page, fonts, "Resumen");

  let y = PAGE.height - MARGIN - 66;
  page.drawText("Todo lo que incluye", { x: MARGIN, y, size: 22, font: fonts.bold, color: INK });
  y -= 36;

  for (const line of lines) {
    page.drawRectangle({ x: MARGIN, y: y + 3, width: 5, height: 5, color: BRAND });
    page.drawText(line.label, { x: MARGIN + 16, y, size: 11, font: fonts.regular, color: INK });
    y -= 21;
    if (y < MARGIN + 240) break;
  }

  y -= 18;
  page.drawRectangle({ x: MARGIN, y, width: CONTENT_WIDTH, height: 1, color: RULE });
  y -= 32;

  page.drawText("Qué necesitamos de tu parte", { x: MARGIN, y, size: 14, font: fonts.bold, color: INK });
  y -= 24;

  const requisitos = [
    "Logo en PNG o SVG, con fondo transparente y buena resolución.",
    "Dirección web o red social a la que llevar los clics.",
    "Una frase corta de la marca, si querés que acompañe al logo.",
  ];
  for (const requisito of requisitos) {
    const alto = drawParagraph(page, `·  ${requisito}`, {
      x: MARGIN,
      y,
      font: fonts.regular,
      size: 11,
      maxWidth: CONTENT_WIDTH,
      color: rgb(0.25, 0.25, 0.25),
    });
    y -= alto + 8;
  }
}

/** Contratapa: cierre y validez. */
function drawBackCover(doc: PDFDocument, fonts: Fonts, brandName: string, fecha: string) {
  const page = doc.addPage([PAGE.width, PAGE.height]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: INK });

  page.drawRectangle({ x: MARGIN, y: PAGE.height / 2 + 60, width: 54, height: 4, color: BRAND });

  page.drawText("Hablemos", {
    x: MARGIN,
    y: PAGE.height / 2,
    size: 38,
    font: fonts.bold,
    color: PAPER,
  });

  drawParagraph(
    page,
    `Esta propuesta se armó para ${brandName}. Los espacios se reservan por orden de confirmación y la disponibilidad se verifica al cerrar el acuerdo.`,
    {
      x: MARGIN,
      y: PAGE.height / 2 - 44,
      font: fonts.regular,
      size: 12,
      maxWidth: CONTENT_WIDTH - 60,
      color: rgb(0.75, 0.75, 0.75),
    },
  );

  page.drawRectangle({ x: MARGIN, y: MARGIN + 58, width: 26, height: 3, color: VIOLET });
  page.drawText("DNX Suite", { x: MARGIN, y: MARGIN + 30, size: 12, font: fonts.bold, color: PAPER });
  page.drawText(`Propuesta emitida el ${fecha}`, {
    x: MARGIN,
    y: MARGIN + 12,
    size: 9.5,
    font: fonts.regular,
    color: rgb(0.55, 0.55, 0.55),
  });
}
