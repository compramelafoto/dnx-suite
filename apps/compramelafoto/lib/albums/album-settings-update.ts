/**
 * Edición de los ajustes básicos de un álbum (título, lugar, fecha, visibilidad,
 * precio digital, descuentos y fotos ocultas).
 *
 * `buildAlbumSettingsUpdateData` es el mismo código que tenía el PATCH de
 * `app/api/dashboard/albums/[id]/route.ts` para esos campos, movido sin cambios:
 * mismo orden de validaciones, mismos textos de error y mismos códigos. La ruta lo
 * sigue usando, y `updateAlbumSettingsForOwner` lo usa para DNX Bot.
 *
 * Importes: `digitalPhotoPriceCents` son PESOS enteros (no centavos).
 */
import { parseHiddenSelfieRetentionDays } from "@/lib/albums/hidden-selfie-retention";
import { prisma } from "@/lib/prisma";
import { ensureAlbumPhotosQueuedForHiddenMode } from "@/lib/hidden-album/prepare-hidden-album-photos";
import {
  loadCollaborativeEventPricingSnapshot,
  MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING,
} from "@/lib/events/collaborative-event-pricing-lock";
import {
  buildAlbumEventScheduleFromDb,
  parseAlbumEventScheduleInput,
  validateAlbumEventSchedule,
  type AlbumEventScheduleInput,
} from "@/lib/albums/album-event-datetime";

export type AlbumSettingsPatch = {
  title?: string;
  location?: string | null;
  eventDate?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  isPublic?: boolean;
  digitalPhotoPriceCents?: number | null; // pesos enteros
  digitalDiscount5Plus?: number | null;
  digitalDiscount10Plus?: number | null;
  digitalDiscount20Plus?: number | null;
  hiddenPhotosEnabled?: boolean;
  hiddenSelfieRetentionDays?: number | null;
};

export type AlbumSettingsExisting = {
  eventId: number | null;
  eventDate: Date | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type AlbumSettingsBuildResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: 400 | 403; error: string };

export function mergeAlbumEventScheduleInput(
  body: {
    eventDate?: unknown;
    eventStartTime?: unknown;
    eventEndTime?: unknown;
  },
  existing: { eventDate: Date | null; startsAt: Date | null; endsAt: Date | null }
): AlbumEventScheduleInput {
  const current = buildAlbumEventScheduleFromDb(existing);
  return {
    eventDate:
      body.eventDate !== undefined
        ? body.eventDate != null && body.eventDate !== ""
          ? String(body.eventDate)
          : null
        : current.eventDate || null,
    eventStartTime:
      body.eventStartTime !== undefined
        ? body.eventStartTime != null && body.eventStartTime !== ""
          ? String(body.eventStartTime)
          : null
        : current.eventStartTime || null,
    eventEndTime:
      body.eventEndTime !== undefined
        ? body.eventEndTime != null && body.eventEndTime !== ""
          ? String(body.eventEndTime)
          : null
        : current.eventEndTime || null,
  };
}

/**
 * Arma los datos a guardar para los campos de ajustes. Recibe el cuerpo tal como
 * llega (puede traer tipos crudos: strings vacíos, números como texto, etc.) y los
 * trata exactamente igual que el PATCH del panel.
 */
export function buildAlbumSettingsUpdateData(
  patch: AlbumSettingsPatch,
  existing: AlbumSettingsExisting,
  deps: { minDigitalPhotoPrice: number; locksPhotographerDigitalPricing: boolean }
): AlbumSettingsBuildResult {
  // El cuerpo del PATCH no viene tipado: se lee crudo para conservar el comportamiento.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = patch as Record<string, any>;
  const {
    title,
    location,
    eventDate,
    eventStartTime,
    eventEndTime,
    digitalPhotoPriceCents,
    digitalDiscount5Plus,
    digitalDiscount10Plus,
    digitalDiscount20Plus,
    isPublic,
    hiddenPhotosEnabled,
    hiddenSelfieRetentionDays,
  } = raw;

  if (deps.locksPhotographerDigitalPricing && digitalPhotoPriceCents !== undefined) {
    return { ok: false, status: 403, error: MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING };
  }

  const data: Record<string, unknown> = {};
  const linkedToEvent = existing.eventId != null;

  if (title !== undefined && !linkedToEvent) {
    if (!title || typeof title !== "string" || !title.trim()) {
      return { ok: false, status: 400, error: "El título no puede estar vacío" };
    }
    data.title = title.trim();
  }

  if (location !== undefined && !linkedToEvent) {
    data.location = location?.trim() || null;
  }

  if (
    !linkedToEvent &&
    (eventDate !== undefined ||
      eventStartTime !== undefined ||
      eventEndTime !== undefined)
  ) {
    const scheduleInput = mergeAlbumEventScheduleInput(
      { eventDate, eventStartTime, eventEndTime },
      {
        eventDate: existing.eventDate,
        startsAt: existing.startsAt,
        endsAt: existing.endsAt,
      }
    );
    const validation = validateAlbumEventSchedule(scheduleInput);
    if (!validation.ok) {
      return { ok: false, status: 400, error: validation.error };
    }
    const schedule = parseAlbumEventScheduleInput(scheduleInput);
    data.eventDate = schedule.eventDate;
    data.startsAt = schedule.startsAt;
    data.endsAt = schedule.endsAt;
  }

  if (digitalPhotoPriceCents !== undefined) {
    if (digitalPhotoPriceCents === null || digitalPhotoPriceCents === "") {
      data.digitalPhotoPriceCents = null;
    } else {
      const parsed = Math.round(Number(digitalPhotoPriceCents));
      if (!Number.isFinite(parsed) || parsed < 0) {
        data.digitalPhotoPriceCents = null;
      } else {
        const min = deps.minDigitalPhotoPrice;
        if (parsed < min) {
          return {
            ok: false,
            status: 400,
            error: `El precio por foto digital no puede ser menor al mínimo del sistema (${min} pesos)`,
          };
        }
        data.digitalPhotoPriceCents = parsed;
      }
    }
  }

  if (!deps.locksPhotographerDigitalPricing) {
    if (digitalDiscount5Plus !== undefined) {
      data.digitalDiscount5Plus =
        digitalDiscount5Plus !== null && digitalDiscount5Plus !== ""
          ? parseFloat(String(digitalDiscount5Plus))
          : null;
    }
    if (digitalDiscount10Plus !== undefined) {
      data.digitalDiscount10Plus =
        digitalDiscount10Plus !== null && digitalDiscount10Plus !== ""
          ? parseFloat(String(digitalDiscount10Plus))
          : null;
    }
    if (digitalDiscount20Plus !== undefined) {
      data.digitalDiscount20Plus =
        digitalDiscount20Plus !== null && digitalDiscount20Plus !== ""
          ? parseFloat(String(digitalDiscount20Plus))
          : null;
    }
  }

  if (isPublic !== undefined) {
    data.isPublic = Boolean(isPublic);
  }

  if (hiddenPhotosEnabled !== undefined) {
    data.hiddenPhotosEnabled = Boolean(hiddenPhotosEnabled);
  }
  if (hiddenSelfieRetentionDays !== undefined) {
    if (hiddenSelfieRetentionDays === null || hiddenSelfieRetentionDays === "") {
      data.hiddenSelfieRetentionDays = null;
    } else {
      data.hiddenSelfieRetentionDays = parseHiddenSelfieRetentionDays(hiddenSelfieRetentionDays);
    }
  }

  return { ok: true, data };
}

/** Lee el mínimo del sistema igual que el PATCH del panel. */
export async function loadMinDigitalPhotoPrice(): Promise<number> {
  const app = await prisma.appConfig.findUnique({ where: { id: 1 } });
  return app?.minDigitalPhotoPrice ?? 5000;
}

const ALBUM_SETTINGS_SELECT = {
  id: true,
  userId: true,
  deletedAt: true,
  eventId: true,
  eventDate: true,
  startsAt: true,
  endsAt: true,
  title: true,
  location: true,
  isPublic: true,
  digitalPhotoPriceCents: true,
  digitalDiscount5Plus: true,
  digitalDiscount10Plus: true,
  digitalDiscount20Plus: true,
  hiddenPhotosEnabled: true,
  hiddenSelfieRetentionDays: true,
} as const;

const NOT_FOUND = { ok: false as const, status: 404 as const, error: "Álbum no encontrado" };

/**
 * Edita los ajustes de un álbum en nombre de su dueño (DNX Bot). Un álbum ajeno
 * responde igual que uno inexistente (404) para no revelar que existe.
 * `before`/`after` sólo incluyen las claves que se escribieron.
 */
export async function updateAlbumSettingsForOwner(p: {
  actorUserId: number;
  albumId: number;
  patch: AlbumSettingsPatch;
}): Promise<
  | { ok: true; before: Record<string, unknown>; after: Record<string, unknown> }
  | { ok: false; status: 400 | 403 | 404; error: string }
> {
  const album = await prisma.album.findUnique({
    where: { id: p.albumId },
    select: ALBUM_SETTINGS_SELECT,
  });
  if (!album || album.deletedAt) return NOT_FOUND;
  if (album.userId !== p.actorUserId) return NOT_FOUND;

  // Igual que la ruta: el bloqueo del evento se carga siempre que haya evento,
  // porque además de rechazar el precio hace que los descuentos se ignoren.
  const locksPhotographerDigitalPricing =
    album.eventId != null
      ? Boolean(
          (await loadCollaborativeEventPricingSnapshot(album.eventId))
            ?.locksPhotographerDigitalPricing
        )
      : false;

  const price = p.patch.digitalPhotoPriceCents;
  const needsMin =
    !locksPhotographerDigitalPricing && price !== undefined && price !== null && (price as unknown) !== "";
  const minDigitalPhotoPrice = needsMin ? await loadMinDigitalPhotoPrice() : 5000;

  const built = buildAlbumSettingsUpdateData(p.patch, album, {
    minDigitalPhotoPrice,
    locksPhotographerDigitalPricing,
  });
  if (!built.ok) return built;

  const keys = Object.keys(built.data);
  if (keys.length === 0) {
    return { ok: false, status: 400, error: "No hay cambios para aplicar" };
  }

  const albumRow = album as unknown as Record<string, unknown>;
  const before = Object.fromEntries(keys.map((k) => [k, albumRow[k]]));
  const updated = await prisma.album.update({
    where: { id: p.albumId },
    data: built.data,
    select: ALBUM_SETTINGS_SELECT,
  });
  if (updated.hiddenPhotosEnabled) {
    try {
      await ensureAlbumPhotosQueuedForHiddenMode(p.albumId);
    } catch (queueErr) {
      console.warn("No se pudo encolar análisis facial para fotos ocultas:", queueErr);
    }
  }
  const updatedRow = updated as unknown as Record<string, unknown>;
  const after = Object.fromEntries(keys.map((k) => [k, updatedRow[k]]));
  return { ok: true, before, after };
}
