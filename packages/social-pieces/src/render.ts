import { emitDesign } from "@repo/design-studio";
import type { EmitPort, RenderedPiece, SocialPieceSpec } from "./types";

/** Meta acepta únicamente JPEG. Ver spec §9. */
const JPEG_QUALITY = 88;

const emitPorDefecto: EmitPort = (input) =>
  emitDesign({ ...input, formats: ["PNG_PER_SIDE"] });

export async function renderSocialPiece(
  spec: SocialPieceSpec,
  deps: { emit?: EmitPort } = {},
): Promise<RenderedPiece> {
  const emit = deps.emit ?? emitPorDefecto;

  const salida = await emit({
    document: spec.document,
    contract: spec.contract,
    values: spec.values,
    resources: spec.resources,
    fileBaseName: spec.pieceId,
    pngDpi: spec.dpi,
  });

  if (!salida.ok) {
    throw new Error(`No se pudo emitir la pieza ${spec.pieceId}: ${salida.errors.join(" ")}`);
  }

  const primera = salida.files[0];
  if (!primera) {
    throw new Error(`La plantilla ${spec.pieceId} no produjo ninguna imagen.`);
  }

  // El import es dinámico: sharp trae binarios nativos y no debe entrar en el grafo de
  // quien solo importe los tipos de este paquete.
  const { default: sharp } = await import("sharp");
  const jpeg = await sharp(Buffer.from(primera.bytes))
    // Sobre fondo blanco: un PNG con transparencia se vuelve negro al pasar a JPEG.
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return {
    fileName: `${spec.pieceId}.jpg`,
    contentType: "image/jpeg",
    bytes: new Uint8Array(jpeg),
    rendererVersion: salida.rendererVersion,
    schemaVersion: salida.schemaVersion,
    resolvedValues: salida.resolvedValues,
    omittedVariables: salida.omittedVariables,
  };
}
