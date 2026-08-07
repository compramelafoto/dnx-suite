import {
  createPartnersService,
  type PartnerActor,
  type PartnersService,
} from "@repo/partners";
import { createPrismaPartnersRepository } from "./prisma-partners-adapter";
import type { ClickatonAuthUser } from "@/lib/admin/auth";

export function getClickatonPartnersService(): PartnersService {
  return createPartnersService(createPrismaPartnersRepository());
}

/** v1: admin Clickatón = bundle ops completo (capa aparte de finance partner MP). */
export function toPartnerActor(user: ClickatonAuthUser): PartnerActor {
  return {
    userId: user.id,
    isOpsAdmin: true,
  };
}
