import { getClickatonAuthUser, hasClickatonAdminAccess } from "@/lib/admin/auth";
import { createAdminRegistrationAuthorization } from "../auth/admin-registration-auth";
import { createAdminRegistrationService, type AdminRegistrationService } from "../application/registration-service";
import {
  AdminRegistrationForbiddenError,
  AdminRegistrationUnauthorizedError,
} from "../domain/errors";
import type { AdminRegistrationActor } from "../domain/types";
import { createPrismaAdminRegistrationRepository } from "../infrastructure/prisma-registration-repository";

type G = {
  __clickatonAdminRegService?: AdminRegistrationService;
  __clickatonAdminRegActor?: AdminRegistrationActor | null;
};

function g(): G {
  return globalThis as unknown as G;
}

export function setAdminRegistrationServiceForTests(service: AdminRegistrationService | null) {
  const globals = g();
  if (service) globals.__clickatonAdminRegService = service;
  else delete globals.__clickatonAdminRegService;
}

export function setAdminRegistrationActorForTests(
  actor: AdminRegistrationActor | null | undefined,
) {
  const globals = g();
  if (actor === undefined) delete globals.__clickatonAdminRegActor;
  else globals.__clickatonAdminRegActor = actor;
}

export function getAdminRegistrationService(): AdminRegistrationService {
  const override = g().__clickatonAdminRegService;
  if (override) return override;
  return createAdminRegistrationService({
    repo: createPrismaAdminRegistrationRepository(),
    auth: createAdminRegistrationAuthorization(),
  });
}

export async function resolveAdminRegistrationActor(): Promise<AdminRegistrationActor> {
  const globals = g();
  if ("__clickatonAdminRegActor" in globals) {
    const actor = globals.__clickatonAdminRegActor;
    if (!actor) throw new AdminRegistrationUnauthorizedError();
    if (
      !hasClickatonAdminAccess({
        email: actor.email,
        globalRole: actor.globalRole,
      })
    ) {
      throw new AdminRegistrationForbiddenError();
    }
    return actor;
  }
  const user = await getClickatonAuthUser();
  if (!user) throw new AdminRegistrationUnauthorizedError();
  if (!hasClickatonAdminAccess(user)) throw new AdminRegistrationForbiddenError();
  return { userId: user.id, email: user.email, globalRole: user.globalRole };
}
