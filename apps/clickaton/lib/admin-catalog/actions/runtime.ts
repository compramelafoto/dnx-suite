import { createCatalogService, type CatalogService } from "../application/catalog-service";
import { createConsoleCatalogLogger } from "../application/catalog-logger";
import { createAdminCatalogAuthorization } from "../auth/admin-catalog-auth";
import { createPrismaCatalogRepository } from "../infrastructure/prisma-catalog-repository";
import type { CatalogActor } from "../domain/types";
import { getClickatonAuthUser, hasClickatonAdminAccess } from "@/lib/admin/auth";
import {
  CatalogForbiddenError,
  CatalogUnauthorizedError,
} from "../domain/errors";

type CatalogTestGlobals = {
  __clickatonCatalogService?: CatalogService;
  /** `null` = sin sesión; ausente = sesión real */
  __clickatonCatalogActor?: CatalogActor | null;
};

function testGlobals(): CatalogTestGlobals {
  return globalThis as unknown as CatalogTestGlobals;
}

/** Solo tests / selfcheck. Usa globalThis para sobrevivir a copias de módulo "use server". */
export function setCatalogServiceForTests(service: CatalogService | null) {
  const g = testGlobals();
  if (service) g.__clickatonCatalogService = service;
  else delete g.__clickatonCatalogService;
}

/** Solo tests / selfcheck. `null` = sin sesión. `undefined` (omit) = usar sesión real. */
export function setCatalogActorForTests(actor: CatalogActor | null | undefined) {
  const g = testGlobals();
  if (actor === undefined) delete g.__clickatonCatalogActor;
  else g.__clickatonCatalogActor = actor;
}

export function getCatalogService(): CatalogService {
  const override = testGlobals().__clickatonCatalogService;
  if (override) return override;
  return createCatalogService({
    repo: createPrismaCatalogRepository(),
    auth: createAdminCatalogAuthorization(),
    logger: createConsoleCatalogLogger(),
  });
}

export async function resolveCatalogActor(): Promise<CatalogActor> {
  const g = testGlobals();
  if ("__clickatonCatalogActor" in g) {
    const actor = g.__clickatonCatalogActor;
    if (actor === null || actor === undefined) throw new CatalogUnauthorizedError();
    if (
      !hasClickatonAdminAccess({
        email: actor.email,
        globalRole: actor.globalRole,
      })
    ) {
      throw new CatalogForbiddenError();
    }
    return actor;
  }

  const user = await getClickatonAuthUser();
  if (!user) throw new CatalogUnauthorizedError();
  if (!hasClickatonAdminAccess(user)) throw new CatalogForbiddenError();
  return {
    userId: user.id,
    email: user.email,
    globalRole: user.globalRole,
  };
}
