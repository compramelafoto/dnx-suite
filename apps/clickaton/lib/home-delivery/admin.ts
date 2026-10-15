"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";

import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { sendParticipantFunnelEmail } from "@/lib/registration/notifications/participant-email";

function pagePath(editionId: string) {
  return `${adminRoutes.editions}/${editionId}/kits-a-domicilio`;
}

function texto(formData: FormData, key: string, max: number): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** "2026-12-12" → último instante de ese día en Argentina. */
function endOfArgentineDay(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T23:59:59.999-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function saveHomeDeliveryConfigAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const editionId = texto(formData, "editionId", 64);
  const enabled = formData.get("enabled") === "on";
  const feePesos = Number(texto(formData, "feePesos", 12).replace(/\./g, "").replace(",", "."));
  if (!editionId || !Number.isFinite(feePesos) || feePesos <= 0) {
    throw new Error("Monto de envío inválido.");
  }
  const guaranteedUntil = endOfArgentineDay(texto(formData, "guaranteedUntil", 10));
  const data = {
    enabled,
    feeAmount: Math.round(feePesos * 100),
    guaranteedUntil,
    updatedByUserId: user.id,
  };
  await prisma.clickatonEditionHomeDelivery.upsert({
    where: { editionId },
    create: { editionId, ...data },
    update: data,
  });
  revalidatePath(pagePath(editionId));
}

export async function markKitDispatchedAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const shippingId = texto(formData, "shippingId", 64);
  const carrier = texto(formData, "carrier", 60) || null;
  const trackingNumber = texto(formData, "trackingNumber", 80) || null;
  const notify = formData.get("notify") === "on";

  const shipping = await prisma.clickatonRegistrationShipping.update({
    where: { id: shippingId },
    data: {
      status: "DISPATCHED",
      carrier,
      trackingNumber,
      dispatchedAt: new Date(),
      dispatchedByUserId: user.id,
      returnedAt: null,
    },
    select: {
      editionId: true,
      registration: {
        select: {
          id: true,
          email: true,
          firstName: true,
          edition: { select: { name: true, slug: true } },
        },
      },
    },
  });

  if (notify) {
    try {
      const reg = shipping.registration;
      await sendParticipantFunnelEmail({
        kind: "kit_dispatched",
        to: reg.email,
        participantName: reg.firstName,
        editionName: reg.edition.name,
        editionSlug: reg.edition.slug,
        registrationId: reg.id,
        shipment: { carrier, trackingNumber },
      });
    } catch (error) {
      // El despacho queda anotado igual; el aviso se puede reenviar.
      console.error("[clickaton] aviso de kit despachado falló:", error);
    }
  }
  revalidatePath(pagePath(shipping.editionId));
}

export async function markKitReturnedAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const shippingId = texto(formData, "shippingId", 64);
  const notes = texto(formData, "notes", 300) || null;
  const s = await prisma.clickatonRegistrationShipping.update({
    where: { id: shippingId },
    data: { status: "RETURNED", returnedAt: new Date(), ...(notes ? { notes } : {}) },
    select: { editionId: true },
  });
  revalidatePath(pagePath(s.editionId));
}

/** Deshacer un despacho cargado por error: vuelve a "por despachar". */
export async function markKitPendingAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const shippingId = texto(formData, "shippingId", 64);
  const s = await prisma.clickatonRegistrationShipping.update({
    where: { id: shippingId },
    data: { status: "PENDING", dispatchedAt: null, dispatchedByUserId: null, returnedAt: null },
    select: { editionId: true },
  });
  revalidatePath(pagePath(s.editionId));
}
