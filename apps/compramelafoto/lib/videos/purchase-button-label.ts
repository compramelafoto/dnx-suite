/**
 * Texto y estado del botón de comprar, con fotos y videos.
 *
 * Antes había dos botones a la vez: el de fotos, que quedaba gris diciendo
 * "Seleccioná fotos" aunque el cliente hubiera elegido un video, y una barra
 * aparte para los videos. Dos llamados a la acción compitiendo en la misma
 * pantalla, y ninguno reflejaba lo que el cliente tenía elegido.
 *
 * Ahora hay uno solo y dice exactamente qué se está por comprar.
 */

export type PurchaseButtonInput = {
  photos: number;
  videos: number;
  submitting?: boolean;
  /** Si el álbum no vende videos, el texto ni los menciona. */
  videosEnabled?: boolean;
};

export type PurchaseButtonState = {
  label: string;
  disabled: boolean;
};

function safeCount(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}

export function purchaseButtonState(input: PurchaseButtonInput): PurchaseButtonState {
  const videosEnabled = input.videosEnabled ?? true;
  const photos = safeCount(input.photos);
  const videos = videosEnabled ? safeCount(input.videos) : 0;

  if (input.submitting) {
    return { label: "Procesando...", disabled: true };
  }

  if (photos === 0 && videos === 0) {
    return {
      label: videosEnabled ? "Seleccioná fotos o videos" : "Seleccioná fotos",
      disabled: true,
    };
  }

  const partes: string[] = [];
  if (photos > 0) partes.push(plural(photos, "foto", "fotos"));
  if (videos > 0) partes.push(plural(videos, "video", "videos"));

  return { label: `Comprar ${partes.join(" y ")}`, disabled: false };
}
