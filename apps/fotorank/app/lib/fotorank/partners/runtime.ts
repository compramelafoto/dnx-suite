import {
  createPartnersService,
  type PartnerActor,
  type PartnersService,
} from "@repo/partners";
import { createPrismaPartnersRepository } from "@repo/db/partners-prisma-repository";
import type { AuthUser } from "../../auth";

let cached: PartnersService | null = null;

/** Servicio partners para redirects `/r/` e impresiones (misma DB FotoRank). */
export function getFotorankPartnersService(): PartnersService {
  if (!cached) {
    cached = createPartnersService(createPrismaPartnersRepository());
  }
  return cached;
}

/** Organizador autenticado con acceso al concurso = ops partners en scope FotoRank. */
export function toFotorankPartnerActor(user: AuthUser): PartnerActor {
  return {
    userId: user.id,
    isOpsAdmin: true,
  };
}
