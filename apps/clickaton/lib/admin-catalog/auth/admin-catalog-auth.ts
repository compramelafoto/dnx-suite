import { hasClickatonAdminAccess } from "@/lib/admin/access";
import type { CatalogAdminCapability } from "../design/contracts";
import { CATALOG_ROLE_CAPABILITIES } from "../design/contracts";
import {
  CatalogForbiddenError,
  CatalogUnauthorizedError,
} from "../domain/errors";
import type { CatalogActor } from "../domain/types";

export type AdminCatalogAuthorization = {
  requireActor(actor: CatalogActor | null | undefined): CatalogActor;
  assertCapability(actor: CatalogActor, capability: CatalogAdminCapability): void;
  can(actor: CatalogActor, capability: CatalogAdminCapability): boolean;
};

export function createAdminCatalogAuthorization(): AdminCatalogAuthorization {
  return {
    requireActor(actor) {
      if (!actor || !actor.userId || !actor.email) {
        throw new CatalogUnauthorizedError();
      }
      if (
        !hasClickatonAdminAccess({
          email: actor.email,
          globalRole: actor.globalRole,
        })
      ) {
        throw new CatalogForbiddenError();
      }
      return actor;
    },
    can(actor, capability) {
      if (
        !hasClickatonAdminAccess({
          email: actor.email,
          globalRole: actor.globalRole,
        })
      ) {
        return false;
      }
      // MVP: ADMIN_GENERAL capabilities only
      return CATALOG_ROLE_CAPABILITIES.ADMIN_GENERAL.includes(capability);
    },
    assertCapability(actor, capability) {
      this.requireActor(actor);
      if (!this.can(actor, capability)) {
        throw new CatalogForbiddenError(`Permiso denegado: ${capability}`);
      }
    },
  };
}

/** Scope futuro (no implementado): filtrar por venueId del operador. */
export type FutureVenueScope = {
  venueIds: string[];
};
