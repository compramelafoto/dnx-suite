/**
 * Cliente Prisma unificado: delega en `@repo/db` sin duplicar instancia.
 * Los imports `import { prisma } from "@/lib/prisma"` siguen igual.
 *
 * Reexports de tipos/enums desde el cliente generado (misma fuente que @repo/db):
 * ir ampliando aquí para reducir imports directos a `@prisma/client` en la app.
 */
export { prisma, Prisma } from "@repo/db";
export type { PrismaClient } from "@repo/db";
export type { ZipGenerationJob } from "@prisma/client";
