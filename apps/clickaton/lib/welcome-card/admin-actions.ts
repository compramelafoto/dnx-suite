"use server";

import { revalidatePath } from "next/cache";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { processWelcomeCardById } from "./process";

function revalidateRegistration(registrationId?: string | null) {
  revalidatePath("/admin/inscripciones");
  if (registrationId) {
    revalidatePath(`/admin/inscripciones/${registrationId}`);
  }
}

export async function enqueueWelcomeCardForRegistrationAction(registrationId: string) {
  await requireClickatonAdmin();
  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      editionId: true,
      status: true,
      paymentStatus: true,
    },
  });
  if (!reg || reg.status !== "CONFIRMED" || reg.paymentStatus !== "APPROVED") return;
  const { enqueueWelcomeCardAfterPaid } = await import("./enqueue");
  await enqueueWelcomeCardAfterPaid({
    registrationId: reg.id,
    editionId: reg.editionId,
  });
  revalidateRegistration(reg.id);
}

export async function regenerateWelcomeCardAction(cardId: string) {
  await requireClickatonAdmin();
  const card = await prisma.dnxWelcomeCard.findUnique({
    where: { id: cardId },
    select: { registrationId: true },
  });
  await processWelcomeCardById(cardId, undefined, true);
  revalidateRegistration(card?.registrationId);
}

export async function retryWelcomeCardAction(cardId: string) {
  await requireClickatonAdmin();
  const card = await prisma.dnxWelcomeCard.update({
    where: { id: cardId },
    data: { status: "PENDING", nextRetryAt: new Date() },
    select: { registrationId: true },
  });
  await processWelcomeCardById(cardId);
  revalidateRegistration(card.registrationId);
}

export async function approveWelcomeCardAction(cardId: string) {
  await requireClickatonAdmin();
  const card = await prisma.dnxWelcomeCard.update({
    where: { id: cardId },
    data: { status: "APPROVED", approvedAt: new Date() },
    select: { registrationId: true },
  });
  if (card.registrationId) {
    await prisma.clickatonRegistration.update({
      where: { id: card.registrationId },
      data: { welcomeCardStatus: "APPROVED" },
    });
  }
  revalidateRegistration(card.registrationId);
}

export async function rejectWelcomeCardAction(cardId: string) {
  await requireClickatonAdmin();
  const card = await prisma.dnxWelcomeCard.update({
    where: { id: cardId },
    data: {
      status: "FAILED",
      rejectedAt: new Date(),
      lastErrorCode: "ADMIN_REJECTED",
    },
    select: { registrationId: true },
  });
  if (card.registrationId) {
    await prisma.clickatonRegistration.update({
      where: { id: card.registrationId },
      data: { welcomeCardStatus: "FAILED" },
    });
  }
  revalidateRegistration(card.registrationId);
}

export async function updateWelcomeCardCropAction(cardId: string, crop: { x: number; y: number; zoom: number; rotation: number; boundingBox?: object | null }) {
  await requireClickatonAdmin();
  const card = await prisma.dnxWelcomeCard.findUniqueOrThrow({ where: { id: cardId }, select: { registrationId: true } });
  if (!card.registrationId) return;
  await prisma.clickatonRegistration.update({
    where: { id: card.registrationId },
    data: { profilePhotoCropX: crop.x, profilePhotoCropY: crop.y, profilePhotoZoom: crop.zoom, profilePhotoRotation: crop.rotation, profilePhotoBoundingBox: crop.boundingBox ?? undefined },
  });
  await processWelcomeCardById(cardId, undefined, true);
}

export async function changeWelcomeCardPhotoAction(cardId: string, assetId: string) {
  await requireClickatonAdmin();
  const card = await prisma.dnxWelcomeCard.findUniqueOrThrow({ where: { id: cardId }, select: { registrationId: true } });
  if (!card.registrationId) return;
  await prisma.clickatonRegistration.update({ where: { id: card.registrationId }, data: { profilePhotoAssetId: assetId, profilePhotoSource: "ADMIN_UPLOAD", profilePhotoStatus: "READY" } });
  await processWelcomeCardById(cardId, undefined, true);
}
