import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/admin/db";
import { hasEditionCapability } from "@/lib/timeline/permissions";
import { getEditionTemporalState } from "@/lib/timeline/prisma-timeline";
import { hashQrPlaintext } from "@/lib/registration/security/qr-token";
import { AccreditationError } from "./errors";
import {
  evaluateAccreditationEligibility,
  evaluateDeviceGeofence,
} from "./eligibility";
import {
  CAPABILITY_CHECK_IN,
  CAPABILITY_DELIVER_KIT,
  CAPABILITY_GRANT_EXCEPTION,
  CAPABILITY_MANAGE_DEVICES,
  CAPABILITY_REVERSE_CHECKIN,
  CAPABILITY_VERIFY_IDENTITY,
  CAPABILITY_VIEW_ACCREDITATION,
} from "./permissions";

type Actor = {
  id: number;
  email: string;
  globalRole: string;
};

async function requireCap(actor: Actor, editionId: string, capability: string) {
  const ok = await hasEditionCapability({
    userId: actor.id,
    email: actor.email,
    globalRole: actor.globalRole,
    editionId,
    capability,
  });
  if (!ok) throw new AccreditationError("FORBIDDEN", "Sin permiso para esta acción.", 403);
}

async function writeAudit(input: {
  editionId: string;
  registrationId?: string | null;
  checkInId?: string | null;
  action: string;
  actorUserId?: number | null;
  deviceId?: string | null;
  previousValue?: unknown;
  nextValue?: unknown;
  reason?: string | null;
  metadata?: unknown;
}) {
  await prisma.clickatonAccreditationAudit.create({
    data: {
      editionId: input.editionId,
      registrationId: input.registrationId ?? null,
      checkInId: input.checkInId ?? null,
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      deviceId: input.deviceId ?? null,
      previousValue: (input.previousValue as object) ?? undefined,
      nextValue: (input.nextValue as object) ?? undefined,
      reason: input.reason ?? null,
      metadata: (input.metadata as object) ?? undefined,
    },
  });
}

function sanitizeParticipant(reg: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  visibleCode: string | null;
  status: string;
  paymentStatus: string;
  instagramHandle: string | null;
  profilePhotoAssetId: string | null;
  fotoRankSyncStatus: string | null;
  documentNumber: string | null;
}) {
  return {
    registrationId: reg.id,
    firstName: reg.firstName,
    lastName: reg.lastName,
    participantNumber: reg.visibleCode,
    status: reg.status,
    paymentStatus: reg.paymentStatus,
    instagramHandle: reg.instagramHandle,
    hasProfilePhoto: Boolean(reg.profilePhotoAssetId),
    fotoRankSyncStatus: reg.fotoRankSyncStatus,
    // email/document solo parciales para operadores
    emailMasked: maskEmail(reg.email),
    documentMasked: reg.documentNumber ? `••••${reg.documentNumber.slice(-4)}` : null,
  };
}

function maskEmail(email: string): string {
  const [u, d] = email.split("@");
  if (!u || !d) return "***";
  return `${u.slice(0, 2)}***@${d}`;
}

async function loadRegistrationContext(registrationId: string) {
  return prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    include: {
      edition: { include: { accreditationConfig: true } },
      credential: { include: { qrTokens: { where: { status: "ACTIVE" }, take: 1 } } },
      checkIns: { where: { reversedAt: null }, orderBy: { checkedInAt: "desc" }, take: 1 },
      items: {
        select: {
          id: true,
          nameSnapshot: true,
          variantNameSnapshot: true,
          quantity: true,
          fulfillmentStatus: true,
          isIncluded: true,
        },
      },
    },
  });
}

async function buildScanResult(registrationId: string, actor: Actor, grantException = false) {
  const reg = await loadRegistrationContext(registrationId);
  if (!reg) throw new AccreditationError("NOT_FOUND", "Inscripción no encontrada.", 404);

  const temporal = await getEditionTemporalState(reg.editionId);
  const config = reg.edition.accreditationConfig;
  const activeCheckIn = reg.checkIns[0] ?? null;
  const eligibility = evaluateAccreditationEligibility({
    registrationStatus: reg.status,
    paymentStatus: reg.paymentStatus,
    hasActiveCredential: reg.credential?.status === "ACTIVE",
    alreadyCheckedIn: Boolean(activeCheckIn),
    accreditationEnabled: Boolean(config?.accreditationEnabled),
    withinAccreditationWindow: temporal.canCheckIn,
    grantException,
  });

  let operatorName: string | null = null;
  if (activeCheckIn) {
    const op = await prisma.user.findUnique({
      where: { id: activeCheckIn.operatorUserId },
      select: { name: true, email: true },
    });
    operatorName = op?.name ?? op?.email ?? null;
  }

  return {
    tone: eligibility.tone,
    reason: eligibility.reason,
    canCheckIn: eligibility.canCheckIn,
    participant: sanitizeParticipant(reg),
    kitItems: reg.items.filter((i) => i.isIncluded || i.fulfillmentStatus !== "CANCELLED"),
    checkIn: activeCheckIn
      ? {
          id: activeCheckIn.id,
          checkedInAt: activeCheckIn.checkedInAt.toISOString(),
          source: activeCheckIn.source,
          operatorName,
          identityStatus: activeCheckIn.identityStatus,
        }
      : null,
    window: {
      canCheckIn: temporal.canCheckIn,
      serverNow: temporal.serverNow,
      timelineVersion: temporal.timelineVersion,
      accreditationEnabled: Boolean(config?.accreditationEnabled),
      // Horarios para que el operador sepa desde/hasta cuándo puede acreditar,
      // en vez de encontrarse con el botón ausente y sin explicación.
      opensAt:
        temporal.milestones.find((m) => m.eventType === "ACCREDITATION_OPEN")?.startsAt ??
        null,
      closesAt:
        temporal.milestones.find((m) => m.eventType === "ACCREDITATION_CLOSE")?.startsAt ??
        null,
      timezone: temporal.timezone,
    },
    editionId: reg.editionId,
  };
}

/** Lookup por token QR opaco (plaintext del QR). */
export async function resolveByQrToken(input: {
  editionId: string;
  qrPlaintext: string;
  actor: Actor;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_VIEW_ACCREDITATION);
  const tokenHash = hashQrPlaintext(input.qrPlaintext.trim());
  const token = await prisma.clickatonQrToken.findUnique({
    where: { tokenHash },
    include: {
      credential: {
        include: { registration: { select: { id: true, editionId: true } } },
      },
    },
  });

  if (!token || token.status !== "ACTIVE") {
    await writeAudit({
      editionId: input.editionId,
      action: "QR_SCANNED",
      actorUserId: input.actor.id,
      metadata: { result: "INVALID" },
    });
    return { tone: "RED" as const, reason: "QR_INVALID", canCheckIn: false };
  }
  if (token.expiresAt && token.expiresAt.getTime() < Date.now()) {
    return { tone: "RED" as const, reason: "QR_EXPIRED", canCheckIn: false };
  }
  if (token.credential.status !== "ACTIVE") {
    return { tone: "RED" as const, reason: "CREDENTIAL_REVOKED", canCheckIn: false };
  }
  if (token.credential.registration.editionId !== input.editionId) {
    await writeAudit({
      editionId: input.editionId,
      registrationId: token.credential.registration.id,
      action: "QR_SCANNED",
      actorUserId: input.actor.id,
      metadata: { result: "WRONG_EDITION" },
    });
    return { tone: "RED" as const, reason: "WRONG_EDITION", canCheckIn: false };
  }

  await prisma.clickatonQrToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });

  const result = await buildScanResult(token.credential.registration.id, input.actor);
  await writeAudit({
    editionId: input.editionId,
    registrationId: token.credential.registration.id,
    action: result.tone === "BLUE" ? "DUPLICATE_SCAN" : "QR_SCANNED",
    actorUserId: input.actor.id,
    metadata: { tone: result.tone, reason: result.reason },
  });
  return result;
}

/** Código corto = tokenPrefix (8 chars) + número visible opcional — rate-limit en route. */
export async function resolveByShortCode(input: {
  editionId: string;
  shortCode: string;
  actor: Actor;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_VIEW_ACCREDITATION);
  const code = input.shortCode.trim();
  if (code.length < 6) {
    throw new AccreditationError("SHORT_CODE_TOO_SHORT", "Código demasiado corto.", 400);
  }

  // Prefer visibleCode exacto
  const byNumber = await prisma.clickatonRegistration.findFirst({
    where: {
      editionId: input.editionId,
      OR: [
        { visibleCode: { equals: code, mode: "insensitive" } },
        { credential: { publicCode: { equals: code, mode: "insensitive" } } },
      ],
    },
    select: { id: true },
  });
  if (byNumber) return buildScanResult(byNumber.id, input.actor);

  const byPrefix = await prisma.clickatonQrToken.findFirst({
    where: {
      tokenPrefix: code.slice(0, 8),
      status: "ACTIVE",
      credential: { registration: { editionId: input.editionId }, status: "ACTIVE" },
    },
    include: { credential: { select: { registrationId: true } } },
  });
  if (!byPrefix) {
    return { tone: "RED" as const, reason: "NOT_FOUND", canCheckIn: false };
  }
  return buildScanResult(byPrefix.credential.registrationId, input.actor);
}

export async function searchParticipants(input: {
  editionId: string;
  query: string;
  actor: Actor;
  limit?: number;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_VIEW_ACCREDITATION);
  const q = input.query.trim();
  if (q.length < 2) return [];
  const limit = Math.min(input.limit ?? 20, 40);

  const rows = await prisma.clickatonRegistration.findMany({
    where: {
      editionId: input.editionId,
      OR: [
        { visibleCode: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { instagramHandle: { contains: q, mode: "insensitive" } },
        { documentNumber: { contains: q, mode: "insensitive" } },
        { id: q.length >= 20 ? q : undefined },
      ].filter(Boolean) as never[],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      visibleCode: true,
      status: true,
      paymentStatus: true,
      email: true,
      instagramHandle: true,
      checkIns: { where: { reversedAt: null }, select: { id: true }, take: 1 },
    },
  });

  return rows.map((r) => ({
    registrationId: r.id,
    name: `${r.firstName} ${r.lastName}`,
    participantNumber: r.visibleCode,
    status: r.status,
    paymentStatus: r.paymentStatus,
    emailMasked: maskEmail(r.email),
    instagramHandle: r.instagramHandle,
    checkedIn: r.checkIns.length > 0,
  }));
}

export async function performCheckIn(input: {
  editionId: string;
  registrationId: string;
  actor: Actor;
  source?: "QR_SCAN" | "MANUAL_SEARCH" | "ADMIN" | "PARTICIPANT_NUMBER" | "OFFLINE_SYNC";
  requestId: string;
  deviceId?: string | null;
  identityStatus?: "NOT_REQUIRED" | "VERIFIED" | "PENDING" | "MISMATCH" | "EXCEPTION_GRANTED";
  identityNotes?: string | null;
  exceptionReason?: string | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  onlineMode?: boolean;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_CHECK_IN);
  const grantException = Boolean(input.exceptionReason);
  if (grantException) {
    await requireCap(input.actor, input.editionId, CAPABILITY_GRANT_EXCEPTION);
  }

  // Idempotencia por requestId
  const existingByRequest = await prisma.clickatonCheckIn.findFirst({
    where: { requestId: input.requestId },
  });
  if (existingByRequest) {
    return {
      duplicate: true as const,
      checkInId: existingByRequest.id,
      alreadyCheckedIn: true as const,
      result: await buildScanResult(input.registrationId, input.actor, grantException),
    };
  }

  const reg = await loadRegistrationContext(input.registrationId);
  if (!reg || reg.editionId !== input.editionId) {
    throw new AccreditationError("NOT_FOUND", "Inscripción no encontrada en esta edición.", 404);
  }
  if (!reg.credential || reg.credential.status !== "ACTIVE") {
    throw new AccreditationError("CREDENTIAL_MISSING", "Credencial no disponible.", 409);
  }

  const active = reg.checkIns[0];
  if (active) {
    await writeAudit({
      editionId: input.editionId,
      registrationId: reg.id,
      checkInId: active.id,
      action: "DUPLICATE_SCAN",
      actorUserId: input.actor.id,
      deviceId: input.deviceId,
    });
    return {
      duplicate: true as const,
      checkInId: active.id,
      alreadyCheckedIn: true as const,
      result: await buildScanResult(reg.id, input.actor, grantException),
    };
  }

  const temporal = await getEditionTemporalState(reg.editionId);
  const config = reg.edition.accreditationConfig;
  const eligibility = evaluateAccreditationEligibility({
    registrationStatus: reg.status,
    paymentStatus: reg.paymentStatus,
    hasActiveCredential: true,
    alreadyCheckedIn: false,
    accreditationEnabled: Boolean(config?.accreditationEnabled),
    withinAccreditationWindow: temporal.canCheckIn,
    grantException,
  });
  if (!eligibility.canCheckIn) {
    throw new AccreditationError(eligibility.reason, "No se puede acreditar en este estado.", 409);
  }

  if (config && input.lat != null) {
    const geo = evaluateDeviceGeofence({
      mode: config.geofenceMode,
      lat: input.lat,
      lng: input.lng ?? null,
      centerLat: config.geofenceCenterLat,
      centerLng: config.geofenceCenterLng,
      radiusMeters: config.geofenceRadiusMeters,
      toleranceMeters: config.geofenceToleranceMeters ?? 50,
    });
    if (!geo.ok) {
      throw new AccreditationError("GEOFENCE", `Ubicación del dispositivo: ${geo.status}`, 403);
    }
  }

  if (input.deviceId) {
    const device = await prisma.clickatonAccreditationDevice.findFirst({
      where: { id: input.deviceId, editionId: input.editionId },
    });
    if (!device || device.status !== "ACTIVE") {
      throw new AccreditationError("DEVICE_REVOKED", "Dispositivo no autorizado.", 403);
    }
    await prisma.clickatonAccreditationDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });
  }

  const checkIn = await prisma.clickatonCheckIn.create({
    data: {
      registrationId: reg.id,
      credentialId: reg.credential.id,
      venueId: reg.venueId,
      operatorUserId: input.actor.id,
      source: input.source ?? "QR_SCAN",
      requestId: input.requestId,
      deviceId: input.deviceId ?? null,
      identityStatus: input.identityStatus ?? (config?.identityMode === "NOT_REQUIRED" ? "NOT_REQUIRED" : "PENDING"),
      identityMethod: config?.identityMode ?? "VISUAL",
      identityNotes: input.identityNotes ?? null,
      exceptionReason: input.exceptionReason ?? null,
      timelineVersionSnapshot: temporal.timelineVersion,
      onlineMode: input.onlineMode ?? true,
      checkInLocationLat: input.lat ?? null,
      checkInLocationLng: input.lng ?? null,
      notes: input.notes ?? null,
    },
  });

  await prisma.clickatonRegistrationAudit.create({
    data: {
      registrationId: reg.id,
      actorUserId: input.actor.id,
      action: "CHECKIN_CONFIRMED",
      source: "accreditation",
      requestId: input.requestId,
      metadata: { checkInId: checkIn.id, paymentUnchanged: true },
    },
  });

  await writeAudit({
    editionId: input.editionId,
    registrationId: reg.id,
    checkInId: checkIn.id,
    action: grantException ? "EXCEPTION_GRANTED" : "CHECKIN_CONFIRMED",
    actorUserId: input.actor.id,
    deviceId: input.deviceId,
    reason: input.exceptionReason,
    nextValue: { checkedInAt: checkIn.checkedInAt.toISOString() },
  });

  // Soft hint FotoRank — durable audit only; never blocks check-in.
  await writeAudit({
    editionId: input.editionId,
    registrationId: reg.id,
    checkInId: checkIn.id,
    action: "FOTORANK_CHECKIN_HINT",
    actorUserId: input.actor.id,
    metadata: {
      fotoRankParticipantId: reg.fotoRankParticipantId,
      nonBlocking: true,
      checkedInAt: checkIn.checkedInAt.toISOString(),
    },
  });

  return {
    duplicate: false as const,
    checkInId: checkIn.id,
    alreadyCheckedIn: false as const,
    result: await buildScanResult(reg.id, input.actor, grantException),
  };
}

export async function reverseCheckIn(input: {
  editionId: string;
  checkInId: string;
  actor: Actor;
  reason: string;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_REVERSE_CHECKIN);
  const checkIn = await prisma.clickatonCheckIn.findUnique({
    where: { id: input.checkInId },
    include: { registration: { select: { editionId: true, id: true } } },
  });
  if (!checkIn || checkIn.registration.editionId !== input.editionId) {
    throw new AccreditationError("NOT_FOUND", "Check-in no encontrado.", 404);
  }
  if (checkIn.reversedAt) {
    return { alreadyReversed: true as const, checkInId: checkIn.id };
  }
  await prisma.clickatonCheckIn.update({
    where: { id: checkIn.id },
    data: {
      reversedAt: new Date(),
      reversedByUserId: input.actor.id,
      reversalReason: input.reason.slice(0, 240),
    },
  });
  await writeAudit({
    editionId: input.editionId,
    registrationId: checkIn.registration.id,
    checkInId: checkIn.id,
    action: "CHECKIN_REVERSED",
    actorUserId: input.actor.id,
    reason: input.reason,
  });
  return { alreadyReversed: false as const, checkInId: checkIn.id };
}

export async function verifyIdentity(input: {
  editionId: string;
  checkInId: string;
  actor: Actor;
  status: "VERIFIED" | "MISMATCH" | "EXCEPTION_GRANTED";
  notes?: string;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_VERIFY_IDENTITY);
  const checkIn = await prisma.clickatonCheckIn.findUnique({
    where: { id: input.checkInId },
    include: { registration: { select: { editionId: true, id: true } } },
  });
  if (!checkIn || checkIn.registration.editionId !== input.editionId) {
    throw new AccreditationError("NOT_FOUND", "Check-in no encontrado.", 404);
  }
  await prisma.clickatonCheckIn.update({
    where: { id: checkIn.id },
    data: {
      identityStatus: input.status,
      identityNotes: input.notes?.slice(0, 240) ?? null,
    },
  });
  await writeAudit({
    editionId: input.editionId,
    registrationId: checkIn.registration.id,
    checkInId: checkIn.id,
    action: input.status === "VERIFIED" ? "IDENTITY_VERIFIED" : "IDENTITY_REJECTED",
    actorUserId: input.actor.id,
    reason: input.notes,
  });
}

export async function deliverKitItem(input: {
  editionId: string;
  registrationId: string;
  itemId: string;
  actor: Actor;
  deviceId?: string | null;
  notes?: string | null;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_DELIVER_KIT);
  const item = await prisma.clickatonRegistrationItem.findFirst({
    where: {
      id: input.itemId,
      registrationId: input.registrationId,
      registration: { editionId: input.editionId },
    },
  });
  if (!item) throw new AccreditationError("ITEM_NOT_FOUND", "Artículo no encontrado.", 404);

  const previous = item.fulfillmentStatus;
  await prisma.clickatonRegistrationItem.update({
    where: { id: item.id },
    data: {
      fulfillmentStatus: "DELIVERED",
      fulfilledAt: new Date(),
      fulfilledByUserId: input.actor.id,
      fulfillmentNotes: input.notes?.slice(0, 240) ?? item.fulfillmentNotes,
      fulfillmentLocation: "accreditation_desk",
    },
  });

  await writeAudit({
    editionId: input.editionId,
    registrationId: input.registrationId,
    action: "KIT_ITEM_DELIVERED",
    actorUserId: input.actor.id,
    deviceId: input.deviceId,
    previousValue: { fulfillmentStatus: previous },
    nextValue: { fulfillmentStatus: "DELIVERED", itemId: item.id },
  });

  return buildScanResult(input.registrationId, input.actor);
}

export async function registerDevice(input: {
  editionId: string;
  name: string;
  actor: Actor;
  assignedUserId?: number | null;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_MANAGE_DEVICES);
  const plaintext = randomBytes(32).toString("base64url");
  const deviceTokenHash = createHash("sha256").update(plaintext).digest("hex");
  const device = await prisma.clickatonAccreditationDevice.create({
    data: {
      editionId: input.editionId,
      name: input.name.slice(0, 80),
      deviceTokenHash,
      createdByUserId: input.actor.id,
      assignedUserId: input.assignedUserId ?? null,
      status: "ACTIVE",
    },
  });
  await writeAudit({
    editionId: input.editionId,
    action: "DEVICE_REGISTERED",
    actorUserId: input.actor.id,
    deviceId: device.id,
    nextValue: { name: device.name },
  });
  // Plaintext solo se devuelve una vez
  return { deviceId: device.id, deviceToken: plaintext };
}

export async function revokeDevice(input: {
  editionId: string;
  deviceId: string;
  actor: Actor;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_MANAGE_DEVICES);
  await prisma.clickatonAccreditationDevice.updateMany({
    where: { id: input.deviceId, editionId: input.editionId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  await writeAudit({
    editionId: input.editionId,
    action: "DEVICE_REVOKED",
    actorUserId: input.actor.id,
    deviceId: input.deviceId,
  });
}

export async function enqueueOfflineEvent(input: {
  editionId: string;
  deviceId?: string | null;
  idempotencyKey: string;
  action: string;
  clientOccurredAt: Date;
  qrPlaintext?: string | null;
  registrationIdHint?: string | null;
  payload?: unknown;
}) {
  const config = await prisma.clickatonEditionAccreditationConfig.findUnique({
    where: { editionId: input.editionId },
  });
  if (config && !config.allowOfflineEvents) {
    throw new AccreditationError("OFFLINE_DISABLED", "Offline no permitido.", 403);
  }

  const existing = await prisma.clickatonAccreditationOfflineEvent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return existing;

  return prisma.clickatonAccreditationOfflineEvent.create({
    data: {
      editionId: input.editionId,
      deviceId: input.deviceId ?? null,
      idempotencyKey: input.idempotencyKey,
      action: input.action,
      clientOccurredAt: input.clientOccurredAt,
      qrTokenHashHint: input.qrPlaintext ? hashQrPlaintext(input.qrPlaintext) : null,
      registrationIdHint: input.registrationIdHint ?? null,
      payload: (input.payload as object) ?? undefined,
      syncStatus: "PENDING",
    },
  });
}

export async function syncOfflineEvents(input: {
  editionId: string;
  actor: Actor;
  limit?: number;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_CHECK_IN);
  const pending = await prisma.clickatonAccreditationOfflineEvent.findMany({
    where: { editionId: input.editionId, syncStatus: "PENDING" },
    orderBy: { clientOccurredAt: "asc" },
    take: input.limit ?? 50,
  });

  const results: Array<{ id: string; syncStatus: string; reason?: string }> = [];
  for (const ev of pending) {
    try {
      if (ev.action === "CHECKIN" && ev.registrationIdHint) {
        await performCheckIn({
          editionId: input.editionId,
          registrationId: ev.registrationIdHint,
          actor: input.actor,
          source: "OFFLINE_SYNC",
          requestId: ev.idempotencyKey,
          deviceId: ev.deviceId,
          onlineMode: false,
        });
        await prisma.clickatonAccreditationOfflineEvent.update({
          where: { id: ev.id },
          data: { syncStatus: "SYNCED", syncedAt: new Date() },
        });
        results.push({ id: ev.id, syncStatus: "SYNCED" });
      } else if (ev.action === "CHECKIN" && ev.qrTokenHashHint) {
        const token = await prisma.clickatonQrToken.findUnique({
          where: { tokenHash: ev.qrTokenHashHint },
          include: { credential: { select: { registrationId: true } } },
        });
        if (!token) {
          await prisma.clickatonAccreditationOfflineEvent.update({
            where: { id: ev.id },
            data: { syncStatus: "REJECTED", conflictReason: "QR_INVALID", syncedAt: new Date() },
          });
          results.push({ id: ev.id, syncStatus: "REJECTED", reason: "QR_INVALID" });
          continue;
        }
        await performCheckIn({
          editionId: input.editionId,
          registrationId: token.credential.registrationId,
          actor: input.actor,
          source: "OFFLINE_SYNC",
          requestId: ev.idempotencyKey,
          deviceId: ev.deviceId,
          onlineMode: false,
        });
        await prisma.clickatonAccreditationOfflineEvent.update({
          where: { id: ev.id },
          data: { syncStatus: "SYNCED", syncedAt: new Date() },
        });
        results.push({ id: ev.id, syncStatus: "SYNCED" });
      } else {
        await prisma.clickatonAccreditationOfflineEvent.update({
          where: { id: ev.id },
          data: { syncStatus: "REJECTED", conflictReason: "UNSUPPORTED_ACTION", syncedAt: new Date() },
        });
        results.push({ id: ev.id, syncStatus: "REJECTED", reason: "UNSUPPORTED_ACTION" });
      }
    } catch (error) {
      const reason = error instanceof AccreditationError ? error.code : "CONFLICT";
      await prisma.clickatonAccreditationOfflineEvent.update({
        where: { id: ev.id },
        data: {
          syncStatus: reason === "ALREADY_CHECKED_IN" || reason.includes("DUPLICATE") ? "CONFLICT" : "REJECTED",
          conflictReason: reason,
          syncedAt: new Date(),
        },
      });
      results.push({ id: ev.id, syncStatus: "CONFLICT", reason });
      await writeAudit({
        editionId: input.editionId,
        action: "CONFLICT_DETECTED",
        actorUserId: input.actor.id,
        metadata: { offlineEventId: ev.id, reason },
      });
    }
  }
  return results;
}

export async function getAccreditationDashboard(editionId: string, actor: Actor) {
  await requireCap(actor, editionId, CAPABILITY_VIEW_ACCREDITATION);
  const [total, paid, checkedIn, kitDelivered, config, temporal, devices] = await Promise.all([
    prisma.clickatonRegistration.count({ where: { editionId, status: { not: "DRAFT" } } }),
    prisma.clickatonRegistration.count({
      where: {
        editionId,
        status: "CONFIRMED",
        paymentStatus: { in: ["APPROVED", "NOT_REQUIRED"] },
      },
    }),
    prisma.clickatonCheckIn.count({ where: { registration: { editionId }, reversedAt: null } }),
    prisma.clickatonRegistrationItem.count({
      where: {
        registration: { editionId },
        fulfillmentStatus: "DELIVERED",
      },
    }),
    prisma.clickatonEditionAccreditationConfig.findUnique({ where: { editionId } }),
    getEditionTemporalState(editionId),
    prisma.clickatonAccreditationDevice.findMany({
      where: { editionId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  const shirtPending = await prisma.clickatonRegistrationItem.count({
    where: {
      registration: {
        editionId,
        status: "CONFIRMED",
        paymentStatus: { in: ["APPROVED", "NOT_REQUIRED"] },
      },
      fulfillmentStatus: { in: ["PENDING", "READY"] },
      isIncluded: true,
    },
  });

  const sizeRows = await prisma.clickatonRegistrationItem.groupBy({
    by: ["variantNameSnapshot", "fulfillmentStatus"],
    where: {
      registration: {
        editionId,
        status: "CONFIRMED",
        paymentStatus: { in: ["APPROVED", "NOT_REQUIRED"] },
      },
      isIncluded: true,
    },
    _count: { _all: true },
  });

  const bySize: Record<string, { reserved: number; delivered: number; pending: number }> = {};
  for (const row of sizeRows) {
    const key = row.variantNameSnapshot?.trim() || "SIN_TALLE";
    bySize[key] ??= { reserved: 0, delivered: 0, pending: 0 };
    bySize[key].reserved += row._count._all;
    if (row.fulfillmentStatus === "DELIVERED") bySize[key].delivered += row._count._all;
    if (row.fulfillmentStatus === "PENDING" || row.fulfillmentStatus === "READY") {
      bySize[key].pending += row._count._all;
    }
  }

  return {
    totals: {
      registered: total,
      paid,
      checkedIn,
      notCheckedIn: Math.max(0, paid - checkedIn),
      kitDelivered,
      kitPending: shirtPending,
    },
    stockOperational: {
      note: "Stock físico no inventado. 10.000 placeholder no es inventario productivo.",
      bySize,
      configuredPhysicalStock: null as number | null,
    },
    window: {
      canCheckIn: temporal.canCheckIn,
      serverNow: temporal.serverNow,
      timelineVersion: temporal.timelineVersion,
      enabled: Boolean(config?.accreditationEnabled),
    },
    config,
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      lastSyncAt: d.lastSyncAt?.toISOString() ?? null,
    })),
  };
}

export async function ensureAccreditationConfig(editionId: string) {
  return prisma.clickatonEditionAccreditationConfig.upsert({
    where: { editionId },
    create: {
      editionId,
      accreditationEnabled: false,
      identityMode: "VISUAL",
      geofenceMode: "OFF",
      allowOfflineEvents: true,
    },
    update: {},
  });
}

export async function exportAccreditationCsv(editionId: string, actor: Actor): Promise<string> {
  await requireCap(actor, editionId, CAPABILITY_VIEW_ACCREDITATION);
  const rows = await prisma.clickatonRegistration.findMany({
    where: { editionId, status: { not: "DRAFT" } },
    include: {
      checkIns: { where: { reversedAt: null }, take: 1, orderBy: { checkedInAt: "desc" } },
      items: { where: { isIncluded: true }, take: 5 },
    },
    orderBy: { sequenceNumber: "asc" },
  });

  const header = [
    "numero",
    "nombre",
    "apellido",
    "instagram",
    "pago",
    "acreditado",
    "hora_checkin",
    "identidad",
    "remera_talle",
    "entrega",
    "fotorank",
  ].join(",");

  const lines = rows.map((r) => {
    const ci = r.checkIns[0];
    const shirt = r.items[0];
    return [
      r.visibleCode ?? "",
      csv(r.firstName),
      csv(r.lastName),
      csv(r.instagramHandle ?? ""),
      r.paymentStatus,
      ci ? "SI" : "NO",
      ci?.checkedInAt.toISOString() ?? "",
      ci?.identityStatus ?? "",
      csv(shirt?.variantNameSnapshot ?? ""),
      shirt?.fulfillmentStatus ?? "",
      r.fotoRankSyncStatus ?? "",
    ].join(",");
  });

  return [header, ...lines].join("\n");
}

function csv(v: string) {
  if (v.includes(",") || v.includes('"')) return `"${v.replaceAll('"', '""')}"`;
  return v;
}
