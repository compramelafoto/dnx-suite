import { hasClickatonAdminAccess } from "@/lib/admin/access";
import {
  AdminRegistrationForbiddenError,
  AdminRegistrationUnauthorizedError,
} from "../domain/errors";
import type { AdminRegistrationActor } from "../domain/types";

export type AdminRegistrationCapability = "registration.read" | "registration.mutate_exceptional";

export type AdminRegistrationAuthorization = {
  requireActor(actor: AdminRegistrationActor | null | undefined): AdminRegistrationActor;
  assertCapability(actor: AdminRegistrationActor, capability: AdminRegistrationCapability): void;
};

export function createAdminRegistrationAuthorization(): AdminRegistrationAuthorization {
  return {
    requireActor(actor) {
      if (!actor?.userId || !actor.email) throw new AdminRegistrationUnauthorizedError();
      if (
        !hasClickatonAdminAccess({
          email: actor.email,
          globalRole: actor.globalRole,
        })
      ) {
        throw new AdminRegistrationForbiddenError();
      }
      return actor;
    },
    assertCapability(actor, capability) {
      void capability;
      this.requireActor(actor);
      // MVP: admin general / SUPER_ADMIN / allowlist — mismo gate que catálogo.
      // Capabilities específicos (venue admin) quedan diferidos.
    },
  };
}
