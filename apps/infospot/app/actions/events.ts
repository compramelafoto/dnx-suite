"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import {
  canModerateInfoSpotEvents,
  canPublishInfoSpotEvent,
  requireInfoSpotAdminAccess,
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

export type ActionResult =
  | { ok: true; id?: string; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function revalidateEvents(slug?: string) {
  revalidatePath("/");
  revalidatePath("/eventos");
  revalidatePath("/admin/eventos");
  if (slug) revalidatePath(`/eventos/${slug}`);
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

/** Envío público — sin login. Siempre PENDING_REVIEW. */
export async function submitPublicEventAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData.entries());
  // honeypot
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
      coverImageUrl,
      coverImageKey,
      registrationUrl: data.registrationUrl ?? null,
      sourceUrl: data.sourceUrl ?? null,
      status: "PENDING_REVIEW",
      submission: {
        create: {
          status: "PENDING_REVIEW",
          ipHash,
          userAgent,
        },
      },
    },
  });

  revalidatePath("/admin/eventos");
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

export async function updateAdminEventAction(
  eventId: string,
  formData: FormData,
): Promise<ActionResult> {
  const access = await requireInfoSpotAdminAccess();
  if (!canModerateInfoSpotEvents(access.subject)) {
    return { ok: false, error: "No tenés permiso para moderar eventos." };
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
    select: { id: true, slug: true },
  });
  if (!existing) return { ok: false, error: "Evento no encontrado." };

  const slug = await ensureUniqueEventSlug(
    data.slug || slugifyTitle(data.title),
    eventId,
  );

  const coverFile = formData.get("coverImage");
  let coverPatch: { coverImageUrl?: string; coverImageKey?: string } = {};
  if (coverFile instanceof File && coverFile.size > 0) {
    try {
      const uploaded = await uploadInfoSpotEventCover(coverFile, eventId);
      coverPatch = {
        coverImageUrl: uploaded.url,
        coverImageKey: uploaded.key,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "No se pudo subir la imagen.",
      };
    }
  } else if (data.coverImageUrl) {
    coverPatch = { coverImageUrl: data.coverImageUrl };
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
      registrationUrl: data.registrationUrl ?? null,
      sourceUrl: data.sourceUrl ?? null,
      internalNotes: data.internalNotes ?? null,
      contentTag: data.contentTag ?? "NEEDS_REVIEW",
      reviewedByUserId: access.user.id,
      ...coverPatch,
    },
  });

  revalidateEvents(slug);
  return { ok: true, id: eventId, message: "Evento actualizado." };
}

export async function publishEventAction(eventId: string): Promise<ActionResult> {
  const access = await requireInfoSpotAdminAccess();
  if (!canPublishInfoSpotEvent(access.subject)) {
    return { ok: false, error: "No tenés permiso para publicar eventos." };
  }

  const event = await prisma.infoSpotEvent.findUnique({
    where: { id: eventId },
    include: { submission: true },
  });
  if (!event) return { ok: false, error: "Evento no encontrado." };
  if (event.status === "ARCHIVED") {
    return { ok: false, error: "No se puede publicar un evento archivado." };
  }
  if (event.contentTag !== "REAL") {
    return {
      ok: false,
      error:
        "Marcá el evento como REAL antes de publicarlo. El contenido DEMO no puede salir a producción.",
    };
  }

  await prisma.$transaction([
    prisma.infoSpotEvent.update({
      where: { id: eventId },
      data: {
        status: "PUBLISHED",
        publishedAt: event.publishedAt ?? new Date(),
        reviewedByUserId: access.user.id,
      },
    }),
    ...(event.submission
      ? [
          prisma.infoSpotEventSubmission.update({
            where: { id: event.submission.id },
            data: {
              status: "APPROVED",
              reviewedAt: new Date(),
            },
          }),
        ]
      : []),
  ]);

  revalidateEvents(event.slug);
  return { ok: true, id: eventId, message: "Evento publicado." };
}

export async function rejectEventAction(
  eventId: string,
  formData?: FormData,
): Promise<ActionResult> {
  const access = await requireInfoSpotAdminAccess();
  if (!canModerateInfoSpotEvents(access.subject)) {
    return { ok: false, error: "No tenés permiso para rechazar eventos." };
  }

  const notes = formData?.get("internalNotes");
  const event = await prisma.infoSpotEvent.findUnique({
    where: { id: eventId },
    include: { submission: true },
  });
  if (!event) return { ok: false, error: "Evento no encontrado." };

  await prisma.$transaction([
    prisma.infoSpotEvent.update({
      where: { id: eventId },
      data: {
        status: "REJECTED",
        reviewedByUserId: access.user.id,
        ...(typeof notes === "string" && notes.trim()
          ? { internalNotes: notes.trim() }
          : {}),
      },
    }),
    ...(event.submission
      ? [
          prisma.infoSpotEventSubmission.update({
            where: { id: event.submission.id },
            data: { status: "REJECTED", reviewedAt: new Date() },
          }),
        ]
      : []),
  ]);

  revalidateEvents(event.slug);
  return { ok: true, id: eventId, message: "Evento rechazado." };
}

export async function archiveEventAction(eventId: string): Promise<ActionResult> {
  const access = await requireInfoSpotAdminAccess();
  if (!canModerateInfoSpotEvents(access.subject)) {
    return { ok: false, error: "No tenés permiso para archivar eventos." };
  }

  const event = await prisma.infoSpotEvent.findUnique({
    where: { id: eventId },
    select: { id: true, slug: true },
  });
  if (!event) return { ok: false, error: "Evento no encontrado." };

  await prisma.infoSpotEvent.update({
    where: { id: eventId },
    data: {
      status: "ARCHIVED",
      reviewedByUserId: access.user.id,
    },
  });

  revalidateEvents(event.slug);
  return { ok: true, id: eventId, message: "Evento archivado." };
}

export async function publishEventAndRedirect(eventId: string) {
  const result = await publishEventAction(eventId);
  if (!result.ok) redirect(`/admin/eventos/${eventId}?error=${encodeURIComponent(result.error)}`);
  redirect(`/admin/eventos/${eventId}?ok=published`);
}

export async function rejectEventAndRedirect(eventId: string, formData: FormData) {
  const result = await rejectEventAction(eventId, formData);
  if (!result.ok) redirect(`/admin/eventos/${eventId}?error=${encodeURIComponent(result.error)}`);
  redirect(`/admin/eventos/${eventId}?ok=rejected`);
}

export async function archiveEventAndRedirect(eventId: string) {
  const result = await archiveEventAction(eventId);
  if (!result.ok) redirect(`/admin/eventos/${eventId}?error=${encodeURIComponent(result.error)}`);
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
