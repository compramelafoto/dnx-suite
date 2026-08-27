/**
 * Validación de la imagen que llega del administrador.
 *
 * Regla de oro: nada de lo que dice el navegador se cree. Ni la extensión del
 * archivo ni el `Content-Type` del formulario son prueba de nada — los dos los
 * escribe el cliente. El tipo real se decide leyendo los primeros bytes, y las
 * dimensiones las decide el decodificador de imágenes.
 */

import {
  CONTEST_MEDIA_ALLOWED_MIME,
  CONTEST_MEDIA_MAX_SOURCE_DIMENSION,
  CONTEST_MEDIA_MAX_UPLOAD_BYTES,
  CONTEST_MEDIA_MIN_SOURCE_HEIGHT,
  CONTEST_MEDIA_MIN_SOURCE_WIDTH,
  formatBytes,
  formatDimensions,
  isSixteenByNine,
  type ContestMediaMime,
} from "./specs";

export type ContestMediaValidationError = {
  code:
    | "empty_file"
    | "too_large"
    | "unsupported_type"
    | "type_mismatch"
    | "corrupt_image"
    | "too_small"
    | "too_large_dimensions"
    | "bad_aspect_ratio"
    | "missing_alt";
  /** Mensaje para mostrar tal cual a quien organiza el concurso. */
  message: string;
};

export type SniffedImageType = {
  mime: ContestMediaMime;
  extension: "jpg" | "png" | "webp";
};

/**
 * Identifica el formato real por su firma binaria.
 *
 * Un `.jpg` renombrado desde un `.svg` o un `.html` pasa cualquier control de
 * extensión y después el navegador lo interpreta como lo que realmente es. Por
 * eso miramos los bytes.
 */
export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (PNG.every((b, i) => bytes[i] === b)) {
    return { mime: "image/png", extension: "png" };
  }

  // WebP: "RIFF" .... "WEBP"
  const riff = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  const webp = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
  if (riff === "RIFF" && webp === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }

  return null;
}

/** Comprueba tamaño y tipo real. No decodifica: eso es responsabilidad de sharp. */
export function validateUploadBytes(input: {
  bytes: Uint8Array;
  /** Lo que declaró el navegador. Sólo se usa para detectar la discrepancia. */
  declaredMime?: string | null;
}): { ok: true; sniffed: SniffedImageType } | { ok: false; error: ContestMediaValidationError } {
  if (input.bytes.length === 0) {
    return { ok: false, error: { code: "empty_file", message: "El archivo está vacío." } };
  }

  if (input.bytes.length > CONTEST_MEDIA_MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: {
        code: "too_large",
        message: `La imagen pesa ${formatBytes(input.bytes.length)} y el máximo es ${formatBytes(
          CONTEST_MEDIA_MAX_UPLOAD_BYTES,
        )}. Probá exportarla en JPG con algo menos de calidad.`,
      },
    };
  }

  const sniffed = sniffImageType(input.bytes);
  if (!sniffed) {
    return {
      ok: false,
      error: {
        code: "unsupported_type",
        message:
          "El archivo no es una imagen JPG, PNG ni WebP. Si lo exportaste de otro programa, guardalo como JPG y volvé a intentar.",
      },
    };
  }

  /**
   * La discrepancia no es fatal — un `.jpeg` declarado como `image/pjpeg` por un
   * navegador viejo es inofensivo — pero sí lo es cuando lo declarado no está
   * siquiera en la lista de permitidos: ahí alguien está probando algo.
   */
  const declared = input.declaredMime?.trim().toLowerCase();
  if (
    declared &&
    declared !== sniffed.mime &&
    !(CONTEST_MEDIA_ALLOWED_MIME as readonly string[]).includes(declared)
  ) {
    return {
      ok: false,
      error: {
        code: "type_mismatch",
        message: "El archivo dice ser de un tipo y su contenido es de otro. No se puede usar.",
      },
    };
  }

  return { ok: true, sniffed };
}

/** Valida lo que el decodificador leyó de la imagen. */
export function validateImageDimensions(input: {
  width: number;
  height: number;
}): { ok: true } | { ok: false; error: ContestMediaValidationError } {
  const { width, height } = input;

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      ok: false,
      error: {
        code: "corrupt_image",
        message: "No se pudo leer la imagen. Puede estar dañada o incompleta.",
      },
    };
  }

  if (width > CONTEST_MEDIA_MAX_SOURCE_DIMENSION || height > CONTEST_MEDIA_MAX_SOURCE_DIMENSION) {
    return {
      ok: false,
      error: {
        code: "too_large_dimensions",
        message: `La imagen mide ${formatDimensions(width, height)}, demasiado grande para procesarla. El máximo por lado es ${CONTEST_MEDIA_MAX_SOURCE_DIMENSION} px.`,
      },
    };
  }

  if (width < CONTEST_MEDIA_MIN_SOURCE_WIDTH || height < CONTEST_MEDIA_MIN_SOURCE_HEIGHT) {
    return {
      ok: false,
      error: {
        code: "too_small",
        message: `La imagen mide ${formatDimensions(width, height)} y el mínimo es ${formatDimensions(
          CONTEST_MEDIA_MIN_SOURCE_WIDTH,
          CONTEST_MEDIA_MIN_SOURCE_HEIGHT,
        )}. Una imagen más chica se vería borrosa al agrandarla.`,
      },
    };
  }

  return { ok: true };
}

/**
 * La proporción no bloquea la carga: si no es 16:9 se recorta desde el punto
 * focal, y quien organiza ve el resultado antes de guardar. Pero avisamos,
 * porque un recorte automático sobre una imagen vertical se come el motivo.
 */
export function aspectRatioWarning(width: number, height: number): string | null {
  if (isSixteenByNine(width, height)) return null;
  return `La imagen mide ${formatDimensions(width, height)}, que no es 16:9. Se va a recortar para que entre; revisá la vista previa antes de guardar.`;
}

/** El texto alternativo es obligatorio: sin él la imagen no es accesible. */
export function validateAltText(
  altText: string,
): { ok: true; value: string } | { ok: false; error: ContestMediaValidationError } {
  const value = altText.trim().replace(/\s+/g, " ");
  if (value.length < 3) {
    return {
      ok: false,
      error: {
        code: "missing_alt",
        message:
          "Escribí una descripción de la imagen. La leen los lectores de pantalla y se muestra si la imagen no carga.",
      },
    };
  }
  return { ok: true, value: value.slice(0, 300) };
}
