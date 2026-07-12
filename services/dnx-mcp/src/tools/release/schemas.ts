import { z } from "zod";
import { platformIdSchema } from "../../platforms/types.js";

export const releasePlatformIdSchema = platformIdSchema.describe(
  "ID de plataforma en el Platform Catalog (ej. fotorank, compramelafoto)",
);

export const releaseDryRunSchema = z
  .boolean()
  .default(true)
  .describe("Si es true, simula la operación sin efectos en producción");

export const releaseConfirmSchema = z
  .boolean()
  .default(false)
  .describe("Debe ser true junto con dryRun: false para ejecutar en producción");

export const releasePrepareInputSchema = z.object({
  platformId: releasePlatformIdSchema,
  dryRun: releaseDryRunSchema,
});

export const releaseValidateInputSchema = z.object({
  platformId: releasePlatformIdSchema,
  dryRun: releaseDryRunSchema,
});

export const releaseExecuteInputSchema = z.object({
  platformId: releasePlatformIdSchema,
  confirm: releaseConfirmSchema,
  dryRun: releaseDryRunSchema,
});

export const releaseRollbackInputSchema = z.object({
  platformId: releasePlatformIdSchema,
  confirm: releaseConfirmSchema,
  dryRun: releaseDryRunSchema,
});

export type ReleasePrepareInput = z.infer<typeof releasePrepareInputSchema>;
export type ReleaseValidateInput = z.infer<typeof releaseValidateInputSchema>;
export type ReleaseExecuteInput = z.infer<typeof releaseExecuteInputSchema>;
export type ReleaseRollbackInput = z.infer<typeof releaseRollbackInputSchema>;
