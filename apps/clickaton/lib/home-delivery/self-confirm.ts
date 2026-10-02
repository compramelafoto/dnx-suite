import { prisma } from "@repo/db";

import { ESTADOS_SIN_PARTICIPANTE } from "@/lib/registration/domain/participante-definido";

import { evaluateKitSelfConfirm, type KitSelfConfirmState } from "./self-confirm-rules";

/**
 * Acreditación de quien recibió el kit por correo.
 *
 * El instructivo del kit trae un único QR, igual para todos, que lleva a
 * `/recibi-mi-kit`. Ahí la persona inicia sesión y se busca su inscripción con
 * envío: el QR no identifica a nadie, la sesión sí.
 */

type SessionUser = { id: number; email: string };

export type KitSelfConfirmCandidate = {
  registrationId: string;
  editionName: string;
  visibleCode: string | null;
  firstName: string;
  city: string;
  state: KitSelfConfirmState;
};

function ownedBy(user: SessionUser) {
  return {
    OR: [
      { userId: user.id },
      { email: { equals: user.email, mode: "insensitive" as const } },
    ],
  };
}

async function loadCandidates(user: SessionUser, registrationId?: string) {
  return prisma.clickatonRegistration.findMany({
    where: {
      ...ownedBy(user),
      ...(registrationId ? { id: registrationId } : {}),
      status: { notIn: [...ESTADOS_SIN_PARTICIPANTE] },
      shipping: { isNot: null },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      editionId: true,
      venueId: true,
      firstName: true,
      status: true,
      paymentStatus: true,
      visibleCode: true,
      edition: { select: { name: true, endAt: true } },
      credential: { select: { id: true, status: true } },
      checkIns: { where: { reversedAt: null }, select: { id: true }, take: 1 },
      shipping: { select: { id: true, city: true, status: true } },
    },
  });
}

function stateOf(row: Awaited<ReturnType<typeof loadCandidates>>[number], now: Date) {
  return evaluateKitSelfConfirm({
    registrationStatus: row.status,
    paymentStatus: row.paymentStatus,
    hasActiveCredential: row.credential?.status === "ACTIVE",
    alreadyCheckedIn: row.checkIns.length > 0,
    editionEndAt: row.edition.endAt,
    now,
  });
}

export async function listKitSelfConfirmCandidates(
  user: SessionUser,
  now = new Date(),
): Promise<KitSelfConfirmCandidate[]> {
  const rows = await loadCandidates(user);
  return rows
    .map((row) => ({
      registrationId: row.id,
      editionName: row.edition.name,
      visibleCode: row.visibleCode,
      firstName: row.firstName,
      city: row.shipping?.city ?? "",
      state: stateOf(row, now),
    }))
    // Lo que ya terminó no sirve de nada en la pantalla.
    .filter((c) => c.state !== "EDITION_OVER");
}

export async function confirmKitReceived(input: {
  user: SessionUser;
  registrationId: string;
  now?: Date;
}): Promise<{ state: KitSelfConfirmState; confirmed: boolean }> {
  const now = input.now ?? new Date();
  const [row] = await loadCandidates(input.user, input.registrationId);
  if (!row || !row.shipping) {
    return { state: "NOT_CONFIRMED", confirmed: false };
  }
  const state = stateOf(row, now);

  if (state === "ALREADY_ACCREDITED") {
    // Acreditado por otra vía (p. ej. a mano desde el panel): sólo se anota
    // que el kit llegó.
    if (row.shipping.status !== "RECEIVED") {
      await prisma.clickatonRegistrationShipping.update({
        where: { id: row.shipping.id },
        data: { status: "RECEIVED", receivedAt: now },
      });
    }
    return { state, confirmed: false };
  }
  if (state !== "CAN_CONFIRM" || !row.credential) {
    return { state, confirmed: false };
  }

  const credentialId = row.credential.id;
  await prisma.$transaction(async (tx) => {
    // Dentro de la transacción, por si tocó dos veces el botón.
    const active = await tx.clickatonCheckIn.findFirst({
      where: { registrationId: row.id, reversedAt: null },
      select: { id: true },
    });
    if (active) return;

    const checkIn = await tx.clickatonCheckIn.create({
      data: {
        registrationId: row.id,
        credentialId,
        venueId: row.venueId,
        // Quien se acredita es el propio participante.
        operatorUserId: input.user.id,
        source: "KIT_SELF_CONFIRM",
        requestId: `kit-self:${row.id}`,
        identityStatus: "NOT_REQUIRED",
        identityMethod: "NOT_REQUIRED",
        onlineMode: true,
        notes: "Confirmó con el QR del instructivo que recibió el kit por correo.",
      },
    });
    await tx.clickatonRegistrationShipping.update({
      where: { id: row.shipping!.id },
      data: { status: "RECEIVED", receivedAt: now },
    });
    // El kit está en sus manos: los artículos incluidos quedan entregados.
    await tx.clickatonRegistrationItem.updateMany({
      where: { registrationId: row.id, isIncluded: true, fulfillmentStatus: { not: "DELIVERED" } },
      data: {
        fulfillmentStatus: "DELIVERED",
        fulfilledAt: now,
        fulfilledByUserId: input.user.id,
        fulfillmentLocation: "home_delivery",
      },
    });
    await tx.clickatonRegistrationAudit.create({
      data: {
        registrationId: row.id,
        actorUserId: input.user.id,
        action: "CHECKIN_CONFIRMED",
        source: "home_delivery_kit_qr",
        requestId: `kit-self:${row.id}`,
        metadata: { checkInId: checkIn.id, paymentUnchanged: true },
      },
    });
    await tx.clickatonAccreditationAudit.create({
      data: {
        editionId: row.editionId,
        registrationId: row.id,
        checkInId: checkIn.id,
        action: "CHECKIN_CONFIRMED",
        actorUserId: input.user.id,
        reason: "Autoacreditación: kit recibido por correo",
        nextValue: { checkedInAt: checkIn.checkedInAt.toISOString() },
      },
    });
  });

  return { state: "ALREADY_ACCREDITED", confirmed: true };
}
