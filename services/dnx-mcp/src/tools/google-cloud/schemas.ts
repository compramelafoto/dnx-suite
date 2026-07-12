import { z } from "zod";

/** dryRun por defecto true para operaciones GCP mutables. */
export const gcpDryRunSchema = z.boolean().default(true);

export const gcpEnvironmentSchema = z.enum(["development", "staging", "production"]);

export const gcpProjectIdSchema = z.string().min(6).max(30);

export const gcpConfirmationSchema = z.string().optional();
