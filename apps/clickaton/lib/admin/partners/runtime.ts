import { createPartnersService, type PartnerActor } from "@repo/partners";
import { createPrismaPartnersRepository } from "./prisma-partners-adapter";
import type { ClickatonAuthUser } from "@/lib/admin/auth";

export function getClickatonPartnersService() {
  return createPartnersService(createPrismaPartnersRepository());
}

/** v1: admin Clickatón = bundle ops completo (capa aparte de finance partner MP). */
export function toPartnerActor(user: ClickatonAuthUser): PartnerActor {
  return {
    userId: user.id,
    isOpsAdmin: true,
  };
}
