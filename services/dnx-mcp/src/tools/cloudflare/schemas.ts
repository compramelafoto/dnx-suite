import { z } from "zod";

/** Defaults seguros para tools Cloudflare/R2. */
export const cfDryRunSchema = z
  .boolean()
  .default(true)
  .describe("Si es true (default), simula sin cambios. Mutaciones requieren dryRun: false");

export const cfConfirmSchema = z
  .boolean()
  .default(false)
  .describe("Debe ser true junto con dryRun: false para ejecutar mutaciones");

export const bucketNameSchema = z.string().min(1).describe("Nombre del bucket R2");

export const platformIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/)
  .describe("ID de plataforma en el Platform Catalog");

export const objectKeySchema = z.string().min(1).describe("Clave del objeto R2");
