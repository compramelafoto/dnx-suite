import { z } from "zod";

/**
 * Campos comunes para herramientas MCP.
 * - dryRun: simula la operación sin efectos secundarios
 * - confirm: requerido en operaciones mutables para evitar ejecución accidental
 */
export const dryRunSchema = z
  .boolean()
  .default(false)
  .describe("Si es true, simula la operación sin ejecutar cambios");

export const confirmSchema = z
  .boolean()
  .default(false)
  .describe("Debe ser true para ejecutar operaciones que modifican infraestructura");

export const projectSchema = z.string().min(1).describe("Nombre o ID del proyecto en Vercel");

export const optionalProjectSchema = z
  .string()
  .min(1)
  .optional()
  .describe("Nombre o ID del proyecto. Si se omite, aplica a todos los proyectos visibles");

export const deploymentTargetSchema = z
  .enum(["production", "preview", "development"])
  .default("production")
  .describe("Target de deployment en Vercel");

export const timeoutMsSchema = z
  .number()
  .int()
  .min(10_000)
  .max(1_800_000)
  .default(600_000)
  .describe("Timeout en ms para esperar deployments");

export type DryRunInput = z.infer<typeof dryRunSchema>;
export type ConfirmInput = z.infer<typeof confirmSchema>;
