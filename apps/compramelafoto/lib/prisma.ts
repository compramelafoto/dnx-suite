/**
 * Cliente Prisma unificado: delega en `@repo/db` sin duplicar instancia.
 * Los imports `import { prisma } from "@/lib/prisma"` siguen igual.
 *
 * Reexports de enums/tipos desde el cliente generado (misma fuente que @repo/db):
 * ampliar aquí para reducir imports directos a `@prisma/client` en la app.
 */
export { prisma, Prisma, Role } from "@repo/db";
export type { PrismaClient } from "@repo/db";
