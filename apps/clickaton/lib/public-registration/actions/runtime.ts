import { confirmFreeRegistration } from "@/lib/registration/application/confirm-free-registration";
import {
  attachPromotionRedemptionRegistration,
  releaseClickatonPromotionRedemption,
  reserveClickatonPromotion,
} from "@/lib/promotions/prisma-promotions-adapter";
import { createPublicRegistrationService, type PublicRegistrationService } from "../application/public-registration-service";
import { createPrismaPublicRegistrationRepository } from "../infrastructure/prisma-public-registration-repository";

type G = {
  __clickatonPublicRegService?: PublicRegistrationService;
};

function g(): G {
  return globalThis as unknown as G;
}

export function setPublicRegistrationServiceForTests(
  service: PublicRegistrationService | null,
) {
  const globals = g();
  if (service) globals.__clickatonPublicRegService = service;
  else delete globals.__clickatonPublicRegService;
}

export function getPublicRegistrationService(): PublicRegistrationService {
  const override = g().__clickatonPublicRegService;
  if (override) return override;
  return createPublicRegistrationService({
    repo: createPrismaPublicRegistrationRepository(),
    confirmFree: confirmFreeRegistration,
    promotions: {
      reserve: reserveClickatonPromotion,
      attachRegistration: attachPromotionRedemptionRegistration,
      releaseByRegistration: releaseClickatonPromotionRedemption,
    },
  });
}
