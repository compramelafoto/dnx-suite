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

/** Placa uniforme donde se apoya el logo. */
const PLATE = { width: 520, height: 260, radius: 22, padX: 54, padY: 46 };

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

/** SVG de un rectángulo redondeado, para usar como placa. */
function plateSvg(fill: { r: number; g: number; b: number }): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PLATE.width}" height="${PLATE.height}">` +
      `<rect width="${PLATE.width}" height="${PLATE.height}" rx="${PLATE.radius}" ` +
      `fill="rgb(${fill.r},${fill.g},${fill.b})"/></svg>`,
  );
}

/** Logo centrado sobre su placa, listo para superponer. */
async function buildPlatedLogo(logo: Buffer): Promise<Buffer> {
  const medida = await measureLogo(logo);
  const tratamiento = resolvePlateTreatment(medida);

  const recortado = await trimSeguro(logo);
  const encajado = await sharp(recortado)
    .resize({
      width: PLATE.width - PLATE.padX * 2,
      height: PLATE.height - PLATE.padY * 2,
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  if (tratamiento.plate === "NONE") return encajado;

  const fill = PLATE_FILL[tratamiento.plate];
  return sharp(plateSvg(fill))
    .composite([{ input: encajado, gravity: "center" }])
    .png()
    .toBuffer();
}

export async function composePiece(input: ComposePieceInput): Promise<Buffer> {
  const piece = getProposalPiece(input.pieceId);
  if (!piece) {
    throw new Error(`La pieza "${input.pieceId}" no existe en el catálogo.`);
  }

  const { width, height } = VIEWPORTS[input.viewport];
  const fondo = await readFile(path.join(backgroundsDir(), piece.background));

  const base = sharp(fondo).resize(width, height, {
    fit: "cover",
    position: "center",
  });

  // Velo oscuro para que la pieza destaque sobre el contenido de la página.
  const velo = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="${width}" height="${height}" fill="rgba(8,11,13,0.72)"/></svg>`,
  );

  const plated = await buildPlatedLogo(input.logo);
  const anchoLogo = Math.round(width * (input.viewport === "mobile" ? 0.62 : 0.3));
  const logoEscalado = await sharp(plated)
    .resize({ width: anchoLogo, fit: "inside" })
    .png()
    .toBuffer();

  return base
    .composite([
      { input: velo, top: 0, left: 0 },
      { input: logoEscalado, gravity: "center" },
    ])
    .png()
    .toBuffer();
}
