/**
 * Validación e identidad de organizador para provisioning.
 */

import {
  getClfWriteClient,
  getClfWriteConnectionInfo,
} from "@repo/db";

type EventLike = {
  title: string;
  city: string;
  startAt: Date;
  latitude: number | null;
  longitude: number | null;
  status: string;
  locationConfirmedAt?: Date | null;
  geocodingStatus?: string | null;
};

type CallLike = {
  enabled: boolean;
  visibility: string;
  joinPolicy: string;
  clfEventType: string;
  ownershipStatus: string;
  organizerUserId: number | null;
};

export type OrganizerIdentity = {
  ownershipStatus: "RESOLVED" | "UNRESOLVED" | "BLOCKED";
  organizerUserId: number | null;
  organizerEmail: string | null;
  provisioningBlockedReason: string | null;
};

export type ProvisionValidation =
  | { ok: true; warnings: string[] }
  | { ok: false; status: "BLOCKED" | "PENDING"; reasons: string[]; warnings: string[] };

export async function resolveOrganizerIdentity(input: {
  organizerEmail: string | null | undefined;
  preferredUserId?: number | null;
}): Promise<OrganizerIdentity> {
  const email = input.organizerEmail?.trim().toLowerCase() || null;
  if (!email) {
    return {
      ownershipStatus: "BLOCKED",
      organizerUserId: null,
      organizerEmail: null,
      provisioningBlockedReason: "Falta email del organizador.",
    };
  }

  const writeInfo = getClfWriteConnectionInfo();
  if (!writeInfo.configured) {
    return {
      ownershipStatus: "BLOCKED",
      organizerUserId: null,
      organizerEmail: email,
      provisioningBlockedReason: "Escritura CLF no configurada.",
    };
  }

  const clf = getClfWriteClient();
  if (input.preferredUserId) {
    const byId = await clf.user.findUnique({
      where: { id: input.preferredUserId },
      select: { id: true, email: true, isBlocked: true },
    });
    if (byId && !byId.isBlocked) {
      return {
        ownershipStatus: "RESOLVED",
        organizerUserId: byId.id,
        organizerEmail: byId.email,
        provisioningBlockedReason: null,
      };
    }
  }

  const user = await clf.user.findUnique({
    where: { email },
    select: { id: true, email: true, isBlocked: true, role: true },
  });

  if (!user) {
    return {
      ownershipStatus: "BLOCKED",
      organizerUserId: null,
      organizerEmail: email,
      provisioningBlockedReason:
        "No hay cuenta CLF con ese email. El organizador debe registrarse en ComprameLaFoto antes de provisionar.",
    };
  }
  if (user.isBlocked) {
    return {
      ownershipStatus: "BLOCKED",
      organizerUserId: user.id,
      organizerEmail: user.email,
      provisioningBlockedReason: "La cuenta del organizador está bloqueada en CLF.",
    };
  }

  return {
    ownershipStatus: "RESOLVED",
    organizerUserId: user.id,
    organizerEmail: user.email,
    provisioningBlockedReason: null,
  };
}

export function validateEventForClfProvisioning(input: {
  event: EventLike;
  call: CallLike;
  identity: OrganizerIdentity;
}): ProvisionValidation {
  const warnings: string[] = [];
  const reasons: string[] = [];

  if (!input.call.enabled) {
    return { ok: false, status: "PENDING", reasons: ["Convocatoria no activada."], warnings };
  }
  if (input.identity.ownershipStatus !== "RESOLVED" || !input.identity.organizerUserId) {
    reasons.push(
      input.identity.provisioningBlockedReason || "Falta identificar al organizador.",
    );
  }
  if (!input.event.title?.trim()) reasons.push("Falta título.");
  if (!input.event.city?.trim()) reasons.push("Falta ciudad.");
  if (!input.event.startAt) reasons.push("Falta fecha de inicio.");

  const lat = input.event.latitude;
  const lng = input.event.longitude;
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    (lat === 0 && lng === 0) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    reasons.push("Falta georreferenciar el evento.");
  } else if (!input.event.locationConfirmedAt) {
    reasons.push("Falta georreferenciar el evento (ubicación no confirmada).");
  }

  if (input.call.joinPolicy === "INVITE_ONLY" && input.call.visibility === "PUBLIC") {
    warnings.push("INVITE_ONLY forzará visibilidad UNLISTED/PRIVATE en CLF.");
  }

  if (reasons.length > 0) {
    return { ok: false, status: "BLOCKED", reasons, warnings };
  }
  return { ok: true, warnings };
}
