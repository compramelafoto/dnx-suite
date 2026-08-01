import { normalizeEmail } from "@/config/admin/admins";
import { hasClickatonAdminAccess } from "@/lib/admin/access";
import {
  cardForbidden,
  cardNotFound,
  cardUnauthorized,
} from "./participant-card-errors";
import type { ParticipantCardActor } from "./participant-card-types";

type RegistrationAuthTarget = {
  id: string;
  userId: number | null;
  email: string;
};

function assertActorSession(actor: ParticipantCardActor): void {
  const hasIdentity =
    typeof actor.userId === "number" ||
    (typeof actor.email === "string" && actor.email.trim().length > 0);
  if (!hasIdentity) {
    throw cardUnauthorized();
  }
}

function normalizeActorEmail(email: string | undefined): string | null {
  if (!email?.trim()) return null;
  return normalizeEmail(email);
}

function actorOwnsRegistration(
  actor: ParticipantCardActor,
  registration: RegistrationAuthTarget
): boolean {
  if (typeof actor.userId === "number" && registration.userId === actor.userId) {
    return true;
  }
  const actorEmail = normalizeActorEmail(actor.email);
  if (actorEmail && actorEmail === normalizeEmail(registration.email)) {
    return true;
  }
  return false;
}

/**
 * Participante dueño (userId o email case-insensitive) o admin.
 * Participante ajeno → 404 (no revelar existencia).
 */
export function requireParticipantCardReadAccess(
  registration: RegistrationAuthTarget,
  actor: ParticipantCardActor
): void {
  assertActorSession(actor);

  if (actor.kind === "admin") {
    requireParticipantCardAdminAccess(actor);
    return;
  }

  if (actorOwnsRegistration(actor, registration)) {
    return;
  }

  throw cardNotFound();
}

export function requireParticipantCardAdminAccess(actor: ParticipantCardActor): void {
  assertActorSession(actor);

  if (actor.kind !== "admin") {
    throw cardForbidden();
  }

  const email = actor.email?.trim();
  if (!email) {
    throw cardForbidden("Admin sin email de sesión");
  }

  const allowed = hasClickatonAdminAccess({
    email,
    globalRole: actor.globalRole ?? "USER",
  });
  if (!allowed) {
    throw cardForbidden();
  }
}
