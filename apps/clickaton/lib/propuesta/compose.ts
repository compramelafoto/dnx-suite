/**
 * Compone una pieza de propuesta: el logo del anunciante sobre el fondo de la
 * página pública que corresponde.
 *
 * Server-only: usa `sharp` y lee del sistema de archivos.
 */
import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  getProposalPiece,
  getProposalPieceLayout,
  resolvePlateTreatment,
  type LogoLuminanceInput,
} from "@repo/partners";

export type ProposalViewport = "desktop" | "mobile";

export type ComposePieceInput = {
  pieceId: string;
  logo: Buffer;
  brandName: string;
  viewport: ProposalViewport;
};

const VIEWPORTS: Record<ProposalViewport, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

/** Colores de la superficie sobre la que se apoya el logo. */
const PLATE_FILL = {
  LIGHT: { r: 255, g: 255, b: 255, alpha: 1 },
  DARK: { r: 32, g: 36, b: 38, alpha: 1 },
} as const;

/** Lado mínimo, en píxeles, que se acepta de un recorte de `trim()`. */
const TRIM_MIN_SIDE = 8;

function backgroundsDir(): string {
  return path.join(process.cwd(), "public", "propuesta", "backgrounds");
}

/**
 * Mide la luminancia media de los píxeles visibles del logo.
 * Los píxeles transparentes no cuentan: si contaran, cualquier logo con mucho
 * espacio vacío mediría igual.
 */
export async function measureLogo(buffer: Buffer): Promise<LogoLuminanceInput> {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const hasAlpha = Boolean(meta.hasAlpha);

  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let suma = 0;
  let visibles = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const alpha = data[i + 3] ?? 255;
    if (alpha < 16) continue;
    // Luminancia perceptual (Rec. 709)
    const lum =
      (0.2126 * (data[i] ?? 0) +
        0.7152 * (data[i + 1] ?? 0) +
        0.0722 * (data[i + 2] ?? 0)) /
      255;
    suma += lum;
    visibles++;
  }

  return {
    meanLuminance: visibles === 0 ? 0.5 : suma / visibles,
    hasAlpha,
  };
}

/**
 * Recorta el margen vacío alrededor del logo. Sobre una imagen de un solo
 * color uniforme (por ejemplo los logos sintéticos de las pruebas) `trim()`
 * no encuentra ningún borde distinto del color de fondo y puede devolver una
 * imagen colapsada (por debajo de `TRIM_MIN_SIDE` píxeles de lado) o lanzar
 * una excepción. El recorte es una mejora estética, no un requisito: ante
 * cualquiera de esos dos casos se descarta y se sigue con la imagen
 * original sin recortar.
 */
async function trimSeguro(logo: Buffer): Promise<Buffer> {
  try {
    const recortado = await sharp(logo).trim().png().toBuffer();
    const metaRecortado = await sharp(recortado).metadata();
    const ladoValido =
      (metaRecortado.width ?? 0) >= TRIM_MIN_SIDE &&
      (metaRecortado.height ?? 0) >= TRIM_MIN_SIDE;
    return ladoValido ? recortado : logo;
  } catch {
    return logo;
  }
}

/** SVG de un rectángulo redondeado del tamaño que se pida. */
function panelSvg(
  ancho: number,
  alto: number,
  radio: number,
  fill: { r: number; g: number; b: number },
): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">` +
      `<rect width="${ancho}" height="${alto}" rx="${radio}" ` +
      `fill="rgb(${fill.r},${fill.g},${fill.b})"/></svg>`,
  );
}

/**
 * El logo, recortado y escalado para entrar en una caja.
 * `withoutEnlargement: false` es a propósito: un logo chico debe agrandarse
 * hasta ocupar su lugar, si no la pieza se ve vacía.
 */
async function encajarLogo(logo: Buffer, ancho: number, alto: number): Promise<Buffer> {
  const recortado = await trimSeguro(logo);
  return sharp(recortado)
    .resize({ width: ancho, height: alto, fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();
}

/**
 * Decide el color de la superficie sobre la que se apoya el logo.
 *
 * Los logos suelen venir diseñados para un solo fondo. Cuando el logo no
 * necesita placa igual hace falta una superficie para la pieza —un banner o
 * una franja son bloques opacos dentro de la página—, así que en ese caso se
 * usa la clara.
 */
async function resolverSuperficie(logo: Buffer): Promise<{ r: number; g: number; b: number }> {
  const tratamiento = resolvePlateTreatment(await measureLogo(logo));
  return tratamiento.plate === "DARK" ? PLATE_FILL.DARK : PLATE_FILL.LIGHT;
}

/** Gris de los logos vecinos, elegido para contrastar apenas con la franja. */
function grisVecino(fill: { r: number; g: number; b: number }) {
  const claro = fill.r > 128;
  return claro ? { r: 214, g: 214, b: 210 } : { r: 58, g: 63, b: 66 };
}

export async function composePiece(input: ComposePieceInput): Promise<Buffer> {
  const piece = getProposalPiece(input.pieceId);
  if (!piece) {
    throw new Error(`La pieza "${input.pieceId}" no existe en el catálogo.`);
  }

  const { width, height } = VIEWPORTS[input.viewport];
  const layout = getProposalPieceLayout(piece.kind, input.viewport);
  const fondo = await readFile(path.join(backgroundsDir(), piece.background));

  const base = sharp(fondo).resize(width, height, { fit: "cover", position: "center" });

  // El resto de la página se oscurece para que la pieza destaque, pero sigue
  // viéndose: el cliente tiene que reconocer dónde va a aparecer su marca.
  const velo = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="${width}" height="${height}" fill="rgba(8,11,13,${layout.veilOpacity})"/></svg>`,
  );

  const panelAncho = Math.round(width * layout.widthRatio);
  const panelAlto = Math.round(height * layout.heightRatio);
  const panelLeft = Math.round((width - panelAncho) / 2);
  const panelTop = Math.round(height * layout.centerYRatio - panelAlto / 2);
  const radio = piece.kind === "WELCOME" ? Math.round(panelAlto * 0.05) : Math.round(panelAlto * 0.12);

  const superficie = await resolverSuperficie(input.logo);
  const panelBase = panelSvg(panelAncho, panelAlto, radio, superficie);

  // Cuántos lugares tiene la pieza y en cuál va el cliente. En la franja el
  // logo queda en el medio, rodeado de las marcas que comparten el espacio.
  const lugares = layout.neighbours + 1;
  const indiceCliente = Math.floor(layout.neighbours / 2);

  // La franja necesita aire vertical porque comparte el renglón con otras
  // marcas; la placa y el banner son piezas de una sola marca y el logo tiene
  // que ocupar su lugar, si no la pieza se ve vacía.
  const margenYPorFormato = { WELCOME: 0.12, BANNER: 0.12, MARQUEE: 0.22 } as const;
  const margenX = Math.round(panelAncho * (piece.kind === "MARQUEE" ? 0.03 : 0.08));
  const margenY = Math.round(panelAlto * margenYPorFormato[piece.kind]);
  const anchoUtil = panelAncho - margenX * 2;
  const altoUtil = panelAlto - margenY * 2;
  const anchoLugar = Math.floor(anchoUtil / lugares);
  const anchoContenido = Math.round(anchoLugar * (lugares === 1 ? 1 : 0.74));

  const piezas: sharp.OverlayOptions[] = [];

  for (let i = 0; i < lugares; i++) {
    const centroX = margenX + anchoLugar * i + Math.round(anchoLugar / 2);
    if (i === indiceCliente) {
      const logoEncajado = await encajarLogo(input.logo, anchoContenido, altoUtil);
      const meta = await sharp(logoEncajado).metadata();
      piezas.push({
        input: logoEncajado,
        left: centroX - Math.round((meta.width ?? anchoContenido) / 2),
        top: margenY + Math.round((altoUtil - (meta.height ?? altoUtil)) / 2),
      });
      continue;
    }
    // Marca vecina: un bloque gris. No se inventa el logo de nadie.
    const altoVecino = Math.round(altoUtil * 0.5);
    piezas.push({
      input: panelSvg(anchoContenido, altoVecino, Math.round(altoVecino * 0.18), grisVecino(superficie)),
      left: centroX - Math.round(anchoContenido / 2),
      top: margenY + Math.round((altoUtil - altoVecino) / 2),
    });
  }

  const panel = await sharp(panelBase).composite(piezas).png().toBuffer();

  return base
    .composite([
      { input: velo, top: 0, left: 0 },
      { input: panel, left: panelLeft, top: panelTop },
    ])
    .png()
    .toBuffer();
}
