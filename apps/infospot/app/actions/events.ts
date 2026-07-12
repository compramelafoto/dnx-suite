"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import {
  canCreateInfoSpotEvent,
  canEditInfoSpotEvent,
  canModerateInfoSpotEvents,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import {
  adminEventUpdateSchema,
  formatFieldErrors,
  parseDateTime,
  publicEventSubmissionSchema,
} from "@/lib/event-validation";
import {
  ensureUniqueEventSlug,
  hashIp,
  tooManyRecentSubmissions,
} from "@/lib/events";
import { uploadInfoSpotEventCover } from "@/lib/storage";
import { slugifyTitle } from "@/lib/slug";
import {
  archiveEventEditorialAction,
  publishEventEditorialAction,
  returnEventWithObservationAction,
  runEventEditorialAction,
} from "@/app/actions/event-editorial-workflow";
import { revalidateEventPaths } from "@/lib/event-revalidate";
import { initialEventStatusForOrigin } from "@/lib/editorial/event-adapter";
import {
  encodeGeohash,
  hasUsableEventCoordinates,
  validateCoordinates,
} from "@/lib/geolocation";

export type ActionResult =
  | { ok: true; id?: string; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function parseOptionalCoord(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Persistencia de campos geo desde formularios (redacción / público). */
function buildGeoWriteData(
  data: {
    city?: string;
    province?: string;
    address?: string;
    venueName?: string;
    postalCode?: string;
    countryCode?: string;
    countryName?: string;
    latitude?: string;
    longitude?: string;
    locationVisibility?: "EXACT" | "APPROXIMATE" | "CITY_ONLY" | "HIDDEN";
    locationConfirmed?: boolean;
    geocodingPlaceId?: string;
    geocodingProvider?: string;
  },
  opts: {
    publicIntake?: boolean;
    existing?: {
      latitude: number | null;
      longitude: number | null;
      locationConfirmedAt: Date | null;
      geocodingStatus: string | null;
    };
  } = {},
) {
  const lat = parseOptionalCoord(data.latitude);
  const lng = parseOptionalCoord(data.longitude);
  const coordsOk = hasUsableEventCoordinates(lat, lng);
  const validated = coordsOk ? validateCoordinates(lat, lng) : null;

  const sameAsExisting =
    opts.existing &&
    opts.existing.latitude === (validated?.ok ? validated.coordinates.latitude : null) &&
    opts.existing.longitude === (validated?.ok ? validated.coordinates.longitude : null);

  const keepConfirmed =
    Boolean(opts.existing?.locationConfirmedAt) &&
    sameAsExisting &&
    coordsOk;

  const confirmed = (Boolean(data.locationConfirmed) && coordsOk) || keepConfirmed;

  let geocodingStatus: "PENDING" | "GEOCODED" | "CONFIRMED" | "NEEDS_REVIEW" =
    "PENDING";
  if (confirmed) geocodingStatus = "CONFIRMED";
  else if (coordsOk) geocodingStatus = opts.publicIntake ? "NEEDS_REVIEW" : "GEOCODED";
  else if (opts.publicIntake) geocodingStatus = "NEEDS_REVIEW";

  return {
    postalCode: data.postalCode ?? null,
    countryCode: data.countryCode ?? "AR",
    countryName: data.countryName ?? "Argentina",
    latitude: validated?.ok ? validated.coordinates.latitude : null,
    longitude: validated?.ok ? validated.coordinates.longitude : null,
    geohash:
      validated?.ok
        ? encodeGeohash(
            validated.coordinates.latitude,
            validated.coordinates.longitude,
          )
        : null,
    locationVisibility: data.locationVisibility ?? "CITY_ONLY",
    geocodingPlaceId: data.geocodingPlaceId ?? null,
    geocodingProvider:
      data.geocodingProvider ?? (coordsOk ? "manual" : null),
    geocodingStatus,
    geocodedAt: coordsOk ? new Date() : null,
    locationConfirmedAt: confirmed
      ? opts.existing?.locationConfirmedAt ?? new Date()
      : null,
    locationPrecision: coordsOk ? ("COORDINATE" as const) : null,
  };
}

function revalidateEvents(slug?: string) {
  revalidateEventPaths(slug);
}

async function clientMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  return {
    ipHash: hashIp(ip),
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  };
}

/** Envío público — sin login. Nace en IN_REVIEW (intake ya enviado). */
export async function submitPublicEventAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData.entries());
  if (typeof raw.website_url === "string" && raw.website_url.trim().length > 0) {
    return { ok: true, message: "Recibimos tu envío." };
  }

  const parsed = publicEventSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisá los campos del formulario.",
      fieldErrors: formatFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const startAt = parseDateTime(data.startAt);
  if (!startAt) {
    return {
      ok: false,
      error: "Fecha de inicio inválida.",
      fieldErrors: { startAt: "Fecha inválida" },
    };
  }
  const endAt = parseDateTime(data.endAt);
  if (data.endAt && !endAt) {
    return {
      ok: false,
      error: "Fecha de fin inválida.",
      fieldErrors: { endAt: "Fecha inválida" },
    };
  }
  if (endAt && endAt < startAt) {
    return {
      ok: false,
      error: "La fecha de fin no puede ser anterior al inicio.",
      fieldErrors: { endAt: "Debe ser posterior al inicio" },
    };
  }

  const { ipHash, userAgent } = await clientMeta();
  if (await tooManyRecentSubmissions(ipHash)) {
    return {
      ok: false,
      error: "Demasiados envíos recientes. Probá de nuevo más tarde.",
    };
  }

  if (data.categoryId) {
    const cat = await prisma.infoSpotCategory.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });
    if (!cat) {
      return {
        ok: false,
        error: "Categoría inválida.",
        fieldErrors: { categoryId: "Categoría inválida" },
      };
    }
  }

  const coverFile = formData.get("coverImage");
  let coverImageUrl: string | null = null;
  let coverImageKey: string | null = null;
  if (coverFile instanceof File && coverFile.size > 0) {
    try {
      const uploaded = await uploadInfoSpotEventCover(coverFile);
      coverImageUrl = uploaded.url;
      coverImageKey = uploaded.key;
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "No se pudo subir la imagen.",
      };
    }
  }

  const slug = await ensureUniqueEventSlug(data.title);
  const now = new Date();
  const status = initialEventStatusForOrigin("PUBLIC_INTAKE");

  const event = await prisma.infoSpotEvent.create({
    data: {
      title: data.title,
      slug,
      summary: data.summary ?? null,
      description: data.description,
      categoryId: data.categoryId ?? null,
      organizerName: data.organizerName,
      organizerEmail: data.organizerEmail,
      organizerPhone: data.organizerPhone ?? null,
      organizerWebsite: data.organizerWebsite ?? null,
      startAt,
      endAt,
      venueName: data.venueName ?? null,
      city: data.city,
      province: data.province,
      address: data.address ?? null,
      ...buildGeoWriteData(data, { publicIntake: true }),
      coverImageUrl,
      coverImageKey,
      registrationUrl: data.registrationUrl ?? null,
      sourceUrl: data.sourceUrl ?? null,
      status,
      originKind: "PUBLIC_INTAKE",
      submittedForReviewAt: now,
      contentTag: "NEEDS_REVIEW",
      submission: {
        create: {
          status: "PENDING_REVIEW",
          ipHash,
          userAgent,
        },
      },
    },
  });

  // Intención de convocatoria: solo draft, sin provisioning.
  if (data.wantPhotographers) {
    const maxRaw = data.photographerMax ? Number(data.photographerMax) : NaN;
    await prisma.infoSpotPhotographerCall.create({
      data: {
        eventId: event.id,
        enabled: true,
        visibility: "PUBLIC",
        joinPolicy: data.photographerJoinPolicy ?? "OPEN",
        maxPhotographers:
          Number.isFinite(maxRaw) && maxRaw > 0 ? Math.trunc(maxRaw) : null,
        photographerTerms: data.photographerTerms ?? null,
        organizerEmail: data.organizerEmail,
        ownershipStatus: "UNRESOLVED",
        provisioningStatus: "PENDING",
        provisioningBlockedReason:
          "Pendiente de revisión editorial. No se crea Event CLF hasta acción explícita.",
      },
    });
  }

  revalidatePath("/admin/eventos");
  revalidatePath("/redaccion/eventos");
  return {
    ok: true,
    id: event.id,
    message: "Recibimos tu evento. Lo revisaremos antes de publicarlo.",
  };
}

export async function submitPublicEventAndRedirect(formData: FormData) {
  const result = await submitPublicEventAction(formData);
  if (!result.ok) {
    const params = new URLSearchParams();
    params.set("error", result.error);
    if (result.fieldErrors) {
      params.set("fields", JSON.stringify(result.fieldErrors));
    }
    redirect(`/publicar-evento?${params.toString()}`);
  }
  redirect("/publicar-evento/gracias");
}

/** Crear borrador desde Redacción (nace DRAFT). */
export async function createRedaccionEventAction(
  formData: FormData,
): Promise<ActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotEvent(access.subject)) {
    return { ok: false, error: "No tenés permiso para crear eventos." };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = adminEventUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisá los campos.",
      fieldErrors: formatFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const startAt = parseDateTime(data.startAt);
  if (!startAt) {
    return { ok: false, error: "Fecha de inicio inválida." };
  }
  const endAt = parseDateTime(data.endAt);
  const slug = await ensureUniqueEventSlug(data.slug || data.title);

  const coverFile = formData.get("coverImage");
  let coverImageUrl: string | null = null;
  let coverImageKey: string | null = null;
  if (coverFile instanceof File && coverFile.size > 0) {
    try {
      const uploaded = await uploadInfoSpotEventCover(coverFile);
      coverImageUrl = uploaded.url;
      coverImageKey = uploaded.key;
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "No se pudo subir la imagen.",
      };
    }
  }

  const status = initialEventStatusForOrigin("REDACCION");
  const event = await prisma.infoSpotEvent.create({
    data: {
      title: data.title,
      slug,
      summary: data.summary ?? null,
      description: data.description,
      categoryId: data.categoryId ?? null,
      authorId: access.user.id,
      organizerName: data.organizerName,
      organizerEmail: data.organizerEmail,
      organizerPhone: data.organizerPhone ?? null,
      organizerWebsite: data.organizerWebsite ?? null,
      startAt,
      endAt,
      venueName: data.venueName ?? null,
      city: data.city,
      province: data.province,
      address: data.address ?? null,
      ...buildGeoWriteData(data, {}),
      registrationUrl: data.registrationUrl ?? null,
      sourceUrl: data.sourceUrl ?? null,
      internalNotes: data.internalNotes ?? null,
      contentTag: data.contentTag ?? "NEEDS_REVIEW",
      status,
      originKind: "REDACCION",
      coverImageUrl,
      coverImageKey,
      submittedByUserId: access.user.id,
    },
  });

  revalidateEvents(slug);
  return { ok: true, id: event.id, message: "Evento creado como borrador." };
}

export async function createRedaccionEventAndRedirect(formData: FormData) {
  const result = await createRedaccionEventAction(formData);
  if (!result.ok) {
    redirect(`/redaccion/eventos/nuevo?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/redaccion/eventos/${result.id}/editar?ok=created`);
}

export async function updateAdminEventAction(
  eventId: string,
  formData: FormData,
): Promise<ActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  const canEdit =
    canEditInfoSpotEvent(access.subject) ||
    canModerateInfoSpotEvents(access.subject);
  if (!canEdit) {
    return { ok: false, error: "No tenés permiso para editar eventos." };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = adminEventUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisá los campos.",
      fieldErrors: formatFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const startAt = parseDateTime(data.startAt);
  if (!startAt) {
    return { ok: false, error: "Fecha de inicio inválida." };
  }
  const endAt = parseDateTime(data.endAt);

  const existing = await prisma.infoSpotEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      slug: true,
      status: true,
      title: true,
      description: true,
      summary: true,
      categoryId: true,
      coverImageUrl: true,
      coverImageKey: true,
      titleOverridden: true,
      descriptionOverridden: true,
      summaryOverridden: true,
      categoryOverridden: true,
      coverOverridden: true,
      latitude: true,
      longitude: true,
      locationConfirmedAt: true,
      geocodingStatus: true,
    },
  });
  if (!existing) return { ok: false, error: "Evento no encontrado." };

  // Guardar/autosalvar no salta el workflow.
  if (existing.status === "ARCHIVED") {
    return { ok: false, error: "No se puede editar un evento archivado." };
  }

  const slug = await ensureUniqueEventSlug(
    data.slug || slugifyTitle(data.title),
    eventId,
  );

  const coverFile = formData.get("coverImage");
  let coverPatch: { coverImageUrl?: string; coverImageKey?: string } = {};
  let coverChanged = false;
  if (coverFile instanceof File && coverFile.size > 0) {
    try {
      const uploaded = await uploadInfoSpotEventCover(coverFile, eventId);
      coverPatch = {
        coverImageUrl: uploaded.url,
        coverImageKey: uploaded.key,
      };
      coverChanged = true;
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "No se pudo subir la imagen.",
      };
    }
  } else if (data.coverImageUrl) {
    coverPatch = { coverImageUrl: data.coverImageUrl };
    coverChanged = data.coverImageUrl !== existing.coverImageUrl;
  }

  await prisma.infoSpotEvent.update({
    where: { id: eventId },
    data: {
      title: data.title,
      slug,
      summary: data.summary ?? null,
      description: data.description,
      categoryId: data.categoryId ?? null,
      organizerName: data.organizerName,
      organizerEmail: data.organizerEmail,
      organizerPhone: data.organizerPhone ?? null,
      organizerWebsite: data.organizerWebsite ?? null,
      startAt,
      endAt,
      venueName: data.venueName ?? null,
      city: data.city,
      province: data.province,
      address: data.address ?? null,
      ...buildGeoWriteData(data, {
        existing: {
          latitude: existing.latitude,
          longitude: existing.longitude,
          locationConfirmedAt: existing.locationConfirmedAt,
          geocodingStatus: existing.geocodingStatus,
        },
      }),
      registrationUrl: data.registrationUrl ?? null,
      sourceUrl: data.sourceUrl ?? null,
      internalNotes: data.internalNotes ?? null,
      contentTag: data.contentTag ?? "NEEDS_REVIEW",
      reviewedByUserId: access.user.id,
      ...coverPatch,
      // Overrides: una vez que redacción edita, sync CLF no pisa.
      titleOverridden: existing.titleOverridden || data.title !== existing.title,
      descriptionOverridden:
        existing.descriptionOverridden || data.description !== existing.description,
      summaryOverridden:
        existing.summaryOverridden ||
        (data.summary ?? null) !== existing.summary,
      categoryOverridden:
        existing.categoryOverridden ||
        (data.categoryId ?? null) !== existing.categoryId,
      coverOverridden: existing.coverOverridden || coverChanged,
      locationOverridden: true,
      coordinatesOverridden: true,
    },
  });

  revalidateEvents(slug);
  revalidatePath(`/redaccion/eventos/${eventId}/editar`);
  return { ok: true, id: eventId, message: "Evento actualizado." };
}

/**
 * Compat: publica vía workflow editorial (misma semántica que PUBLISH).
 * Requiere sesión de redacción (no solo admin).
 */
export async function publishEventAction(eventId: string): Promise<ActionResult> {
  const result = await publishEventEditorialAction(eventId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, id: eventId, message: result.message };
}

/**
 * Compat: rechazo legacy → RETURN editorial con observación.
 * Preserva la intención de devolver el evento al autor/redacción.
 */
export async function rejectEventAction(
  eventId: string,
  formData?: FormData,
): Promise<ActionResult> {
  const notes = formData?.get("internalNotes");
  const observation =
    typeof notes === "string" && notes.trim().length >= 8
      ? notes.trim()
      : "Evento devuelto desde moderación. Revisá los datos y volvé a enviarlo a revisión.";
  const result = await returnEventWithObservationAction(eventId, observation);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, id: eventId, message: "Evento devuelto con observación." };
}

/** Compat: archivar vía workflow editorial. */
export async function archiveEventAction(eventId: string): Promise<ActionResult> {
  const result = await archiveEventEditorialAction(eventId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, id: eventId, message: result.message };
}

export async function publishEventAndRedirect(eventId: string) {
  const result = await publishEventAction(eventId);
  if (!result.ok) {
    redirect(`/admin/eventos/${eventId}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/admin/eventos/${eventId}?ok=published`);
}

export async function rejectEventAndRedirect(eventId: string, formData: FormData) {
  const result = await rejectEventAction(eventId, formData);
  if (!result.ok) {
    redirect(`/admin/eventos/${eventId}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/admin/eventos/${eventId}?ok=returned`);
}

export async function archiveEventAndRedirect(eventId: string) {
  const result = await archiveEventAction(eventId);
  if (!result.ok) {
    redirect(`/admin/eventos/${eventId}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/admin/eventos/${eventId}?ok=archived`);
}

export async function updateAdminEventAndRedirect(
  eventId: string,
  formData: FormData,
) {
  const result = await updateAdminEventAction(eventId, formData);
  if (!result.ok) {
    redirect(
      `/admin/eventos/${eventId}?error=${encodeURIComponent(result.error)}`,
    );
  }
  redirect(`/admin/eventos/${eventId}?ok=saved`);
}

export async function updateRedaccionEventAndRedirect(
  eventId: string,
  formData: FormData,
) {
  const result = await updateAdminEventAction(eventId, formData);
  if (!result.ok) {
    redirect(
      `/redaccion/eventos/${eventId}/editar?error=${encodeURIComponent(result.error)}`,
    );
  }
  redirect(`/redaccion/eventos/${eventId}/editar?ok=saved`);
}

/** Despublicar (nuevo en wrappers admin). */
export async function unpublishEventCompatAction(eventId: string): Promise<ActionResult> {
  const result = await runEventEditorialAction(eventId, "UNPUBLISH");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, id: eventId, message: result.message };
}
