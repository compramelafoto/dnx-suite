import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { EventEditorForm } from "@/components/redaccion/event-editor-form";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import {
  canEditInfoSpotEvent,
  canManageInfoSpotSettings,
  canProvisionClfPhotographerCall,
  canNotifyClfPhotographerCall,
  canPublishInfoSpotEvent,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import { mapInfoSpotCategoryToClfEventType } from "@/lib/clf-event-provisioning";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.infoSpotEvent.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: event ? `${event.title} — Redacción` : "Evento — Redacción" };
}

export default async function EditarEventoPage({ params, searchParams }: Props) {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canEditInfoSpotEvent(access.subject)) {
    notFound();
  }
  const { id } = await params;
  const q = await searchParams;

  const event = await prisma.infoSpotEvent.findUnique({
    where: { id },
    include: {
      category: { select: { slug: true } },
      photographerCall: true,
      observations: {
        where: { type: "RETURN" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { author: { select: { name: true } } },
      },
      contentOrigins: {
        where: { sourceType: "COMPRAMELAFOTO", externalEntityType: "EVENT" },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          syncStatus: true,
          lastSyncedAt: true,
          externalUrl: true,
          syncError: true,
          operationalPayload: true,
        },
      },
    },
  });
  if (!event) notFound();

  const categories = await prisma.infoSpotCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const okMessages: Record<string, string> = {
    saved: "Cambios guardados.",
    created: "Evento creado como borrador.",
    call_saved: "Configuración de convocatoria guardada.",
    call_provisioned: "Convocatoria provisionada en ComprameLaFoto.",
    call_closed: "Convocatoria cerrada en ComprameLaFoto.",
  };

  const suggested = mapInfoSpotCategoryToClfEventType(event.category?.slug);
  const call = event.photographerCall;

  return (
    <RedaccionShell variant="editor">
      <EventEditorForm
        event={event}
        categories={categories}
        subject={access.subject}
        canPublish={canPublishInfoSpotEvent(access.subject)}
        isDirector={canManageInfoSpotSettings(access.subject)}
        canProvisionCall={canProvisionClfPhotographerCall(access.subject)}
        canNotifyCall={canNotifyClfPhotographerCall(access.subject)}
        photographerCall={
          call
            ? {
                enabled: call.enabled,
                visibility: call.visibility,
                joinPolicy: call.joinPolicy,
                maxPhotographers: call.maxPhotographers,
                photographerTerms: call.photographerTerms,
                operationalDescription: call.operationalDescription,
                clfEventType: call.clfEventType,
                desiredClfStatus: call.desiredClfStatus,
                organizerEmail: call.organizerEmail,
                ownershipStatus: call.ownershipStatus,
                provisioningStatus: call.provisioningStatus,
                provisioningError: call.provisioningError,
                provisioningBlockedReason: call.provisioningBlockedReason,
                publicUrl: call.publicUrl,
                clfEventId: call.clfEventId,
              }
            : null
        }
        suggestedClfEventType={suggested.type}
        ok={q.ok ? okMessages[q.ok] ?? q.ok : undefined}
        error={q.error}
      />
    </RedaccionShell>
  );
}
