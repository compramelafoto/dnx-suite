import { Prisma } from "@repo/db";

const MISSING_TABLE_HINT =
  /WorkspaceFeatureModule|FotofficeWorkspace|CourseSales/i;

/**
 * BD sin migraciones del módulo courses-sales (tablas nuevas aún no creadas).
 * Evita tumbar el shell de Fotoffice hasta que ejecutes la migración SQL.
 */
export function isMissingCoursesSalesSchemaError(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const msg = typeof e.message === "string" ? e.message : "";
  if (!msg.includes("does not exist")) return false;
  return MISSING_TABLE_HINT.test(msg);
}
