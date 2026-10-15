/**
 * Precio base (pesos) de una foto digital suelta en un álbum, resuelto sólo con datos del servidor.
 *
 * Regla (la misma que muestra `/api/a/[id]/order-photos` en la pantalla de compra):
 * - Foto del dueño del álbum y el álbum tiene precio cargado (> 0) → manda `Album.digitalPhotoPriceCents`.
 * - Foto de otro fotógrafo (álbum colaborativo) → su `defaultDigitalPhotoPrice` (o el mínimo de plataforma).
 * - Sin dato del que subió → precio normalizado del álbum (álbum → default del dueño → mínimo).
 * - Si todo da 0 → `photographerDigitalFallback`.
 *
 * Nunca usa el precio que manda el navegador: el cliente sólo puede mostrar, no fijar el cobro.
 * Las políticas de evento/organizador (ORGANIZER_FIXED / ORGANIZER_MINIMUM) se aplican después,
 * tomando este valor como `currentResolvedBasePrice`.
 */
export function resolveAlbumDigitalBasePesos(params: {
  uploaderId: number | null;
  albumOwnerUserId: number;
  albumDigitalStoredRaw: number | null | undefined;
  uploaderDigitalMap: Map<number, number>;
  albumDigitalNormalizedFallback: number;
  photographerDigitalFallback: number | null;
}): number {
  const raw = params.albumDigitalStoredRaw;
  const albumHasStoredPrice =
    raw != null &&
    typeof raw === "number" &&
    Number.isFinite(raw) &&
    raw > 0;
  const uid = params.uploaderId;
  let legacy = 0;
  if (
    uid != null &&
    uid === params.albumOwnerUserId &&
    albumHasStoredPrice
  ) {
    legacy = Math.round(Number(raw));
  } else if (uid != null && params.uploaderDigitalMap.has(uid)) {
    legacy = params.uploaderDigitalMap.get(uid)!;
  } else {
    legacy = Math.round(Number(params.albumDigitalNormalizedFallback || 0));
  }
  if (
    (!legacy || legacy <= 0) &&
    params.photographerDigitalFallback != null &&
    params.photographerDigitalFallback > 0
  ) {
    legacy = Math.round(Number(params.photographerDigitalFallback));
  }
  return legacy;
}
