/**
 * Clickatón usa el repositorio Prisma canónico de partners (mismo que FotoRank).
 * Evita duplicar un adapter incompleto frente a PartnersRepository en expansión.
 */
export { createPrismaPartnersRepository } from "@repo/db/partners-prisma-repository";
