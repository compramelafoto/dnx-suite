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

  if (salida.files.length === 0) {
    throw new Error(`La plantilla ${spec.pieceId} no produjo ninguna imagen.`);
  }

  // El import es dinámico: sharp trae binarios nativos y no debe entrar en el grafo de
  // quien solo importe los tipos de este paquete.
  const { default: sharp } = await import("sharp");

  // PNG_PER_SIDE emite un archivo por cada cara del documento (ver emit.ts). En una plantilla
  // de carrusel, cada cara ES una diapositiva: hay que convertirlas todas, no solo la primera,
  // o el resto se pierde en silencio.
  const images = await Promise.all(
    salida.files.map(async (archivo) => {
      const jpeg = await sharp(Buffer.from(archivo.bytes))
        // Sobre fondo blanco: un PNG con transparencia se vuelve negro al pasar a JPEG.
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();

      return {
        // Mismo nombre que trae el Designer, solo cambia la extensión: conserva el id de la
        // cara (p. ej. "clf-album-carousel-slide-2.png" → "...-slide-2.jpg") y no colisiona
        // entre diapositivas.
        fileName: archivo.name.replace(/\.[^./]+$/, ".jpg"),
        contentType: "image/jpeg" as const,
        bytes: new Uint8Array(jpeg),
      };
    }),
  );

  return {
    images,
    rendererVersion: salida.rendererVersion,
    schemaVersion: salida.schemaVersion,
    resolvedValues: salida.resolvedValues,
    omittedVariables: salida.omittedVariables,
  };
}
