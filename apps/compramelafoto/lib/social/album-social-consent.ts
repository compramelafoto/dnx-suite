import { normalizeInstagramHandle } from "@repo/media-composition";
import { prisma } from "@repo/db";

/**
 * Permiso de difusión en redes sociales, por álbum (spec §8).
 *
 * Los álbumes de CompraMeLaFoto son en gran parte eventos escolares y deportivos: hay
 * menores y gente identificable que nunca autorizó aparecer en una cuenta de Instagram.
 * `decideAlbumSocialGeneration` es el único freno antes de generar cualquier pieza para
 * redes: si se equivoca para el lado permisivo, se publica la foto de un chico sin
 * permiso. Por eso es pura y se testea sin base de datos, igual que
 * `decideAlbumReadiness` en `lib/analysis/album-analysis-readiness.ts`. La persistencia
 * va aparte, en las funciones de más abajo, y esas no se testean unitariamente.
 */

/** Ver spec §8: mínimo 3, máximo 4. */
export const MIN_SOCIAL_PHOTOS = 3;
export const MAX_SOCIAL_PHOTOS = 4;

export type AlbumSocialConsent = {
  albumId: number;
  consentGiven: boolean;
  consentAt: string | null;
  consentByUserId: number | null;
  /** En orden de selección: es el orden del carrusel. */
  selectedPhotoIds: number[];
  photographerHandle: string | null;
};

export type SocialGenerationReason =
  | "NO_CONSENT"
  | "TOO_FEW_PHOTOS"
  | "TOO_MANY_PHOTOS"
  | "ALBUM_NOT_READY"
  | "ALREADY_GENERATED";

export type SocialGenerationDecision =
  | { generate: true }
  | { generate: false; reason: SocialGenerationReason };

/**
 * Decide si corresponde generar las piezas sociales de un álbum.
 *
 * Puro a propósito, como `decideAlbumReadiness`: la regla que protege a la gente
 * fotografiada tiene que poder testearse sin base de datos. Sin permiso tildado o sin
 * fotos elegidas, no hay camino alternativo: no se genera nada.
 */
export function decideAlbumSocialGeneration(input: {
  consentGiven: boolean;
  selectedPhotoIds: number[];
  photographerHandle: string | null;
  albumIsReady: boolean;
  alreadyGenerated: boolean;
}): SocialGenerationDecision {
  if (input.alreadyGenerated) return { generate: false, reason: "ALREADY_GENERATED" };
  if (!input.consentGiven) return { generate: false, reason: "NO_CONSENT" };
  // La cuenta de fotos se hace sobre la lista ya deduplicada: la misma foto repetida
  // tres veces no son tres fotos, es una sola. Si esto no se dedupea antes de contar,
  // el mínimo de 3 no protege nada.
  const selectedPhotoIds = normalizeSelectedPhotoIds(input.selectedPhotoIds);
  if (selectedPhotoIds.length < MIN_SOCIAL_PHOTOS) {
    return { generate: false, reason: "TOO_FEW_PHOTOS" };
  }
  if (selectedPhotoIds.length > MAX_SOCIAL_PHOTOS) {
    return { generate: false, reason: "TOO_MANY_PHOTOS" };
  }
  if (!input.albumIsReady) return { generate: false, reason: "ALBUM_NOT_READY" };
  // Sin usuario de Instagram se publica igual: no poder etiquetar al fotógrafo no es
  // motivo para no difundir su álbum.
  return { generate: true };
}

/** Normaliza el @usuario del fotógrafo; si es inválido, no se etiqueta a nadie. */
export function normalizeConsentHandle(raw: string | null | undefined): string | null {
  return normalizeInstagramHandle(raw)?.handle ?? null;
}

/**
 * Deja solo IDs numéricos, sin repetir, en el orden en que llegaron (orden del
 * carrusel).
 *
 * Se usa en los tres lugares que tocan `selectedPhotoIds` —al decidir, al guardar y
 * al leer— para que no se desincronicen entre sí. Un `metadata` corrupto (por ejemplo
 * con strings en vez de números) no debe mentir un tipo `number[]`: la Task 13 busca
 * las fotos reales con estos IDs, y un ID falso ahí falla de una forma confusa más
 * adelante en vez de descartarse acá.
 */
export function normalizeSelectedPhotoIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const vistos = new Set<number>();
  const result: number[] = [];
  for (const item of raw) {
    if (typeof item !== "number" || !Number.isFinite(item)) continue;
    if (vistos.has(item)) continue;
    vistos.add(item);
    result.push(item);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Persistencia. A partir de acá se habla con Prisma: no se testea unitariamente,
// la regla que importa ya quedó cubierta arriba.
// ---------------------------------------------------------------------------

const CONSENT_ENTITY_TYPE = "ALBUM_SOCIAL_CONSENT";

/**
 * Clave idempotente del borrador de permiso, un `DnxSocialPublishRequest` por álbum.
 * No hay campo nuevo en `Album`: un campo de schema hay que aplicarlo a mano en las
 * cinco bases Neon o rompe las escrituras de las otras apps.
 */
export function albumConsentKey(albumId: number): string {
  return `clf:album-consent:${albumId}`;
}

/**
 * Guarda permiso y selección de fotos como un borrador de publicación (DRAFT).
 *
 * `socialAccountId` es clave foránea obligatoria de `DnxSocialPublishRequest`: todavía
 * no hay ninguna cuenta de Instagram conectada en este punto del plan (eso lo resuelve
 * una tarea posterior), así que quien llama a esta función tiene que resolver la cuenta
 * antes y pasarla acá. No se inventa una cuenta ni se guarda sin ella.
 *
 * Cuando el álbum queda analizado, el disparador lee este borrador, renderiza las
 * piezas y crea las solicitudes reales. Usar `DnxSocialPublishRequest` en DRAFT deja
 * además auditoría en `DnxSocialPublishLog` sin trabajo extra.
 */
export async function saveAlbumSocialConsent(input: {
  albumId: number;
  socialAccountId: string;
  consentGiven: boolean;
  selectedPhotoIds: number[];
  photographerHandle: string | null;
  userId: number;
}): Promise<void> {
  const metadata = {
    consentGiven: input.consentGiven,
    consentAt: input.consentGiven ? new Date().toISOString() : null,
    consentByUserId: input.userId,
    selectedPhotoIds: normalizeSelectedPhotoIds(input.selectedPhotoIds).slice(
      0,
      MAX_SOCIAL_PHOTOS,
    ),
    photographerHandle: normalizeConsentHandle(input.photographerHandle),
  };

  await prisma.dnxSocialPublishRequest.upsert({
    where: { idempotencyKey: albumConsentKey(input.albumId) },
    create: {
      application: "COMPRAMELAFOTO",
      entityType: CONSENT_ENTITY_TYPE,
      entityId: String(input.albumId),
      caption: "",
      assets: [],
      socialAccountId: input.socialAccountId,
      platform: "INSTAGRAM",
      status: "DRAFT",
      approvalRequired: true,
      idempotencyKey: albumConsentKey(input.albumId),
      createdByUserId: input.userId,
      metadata,
    },
    update: { metadata },
  });
}

/** Lee el permiso y la selección guardados para un álbum, si existen. */
export async function getAlbumSocialConsent(
  albumId: number,
): Promise<AlbumSocialConsent | null> {
  const fila = await prisma.dnxSocialPublishRequest.findUnique({
    where: { idempotencyKey: albumConsentKey(albumId) },
    select: { metadata: true },
  });
  if (!fila?.metadata) return null;
  const m = fila.metadata as Record<string, unknown>;
  return {
    albumId,
    consentGiven: m.consentGiven === true,
    consentAt: typeof m.consentAt === "string" ? m.consentAt : null,
    consentByUserId: typeof m.consentByUserId === "number" ? m.consentByUserId : null,
    selectedPhotoIds: normalizeSelectedPhotoIds(m.selectedPhotoIds),
    photographerHandle:
      typeof m.photographerHandle === "string" ? m.photographerHandle : null,
  };
}
