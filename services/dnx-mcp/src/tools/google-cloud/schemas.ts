import { z } from "zod";

/** dryRun por defecto true para operaciones GCP mutables. */
export const gcpDryRunSchema = z.boolean().default(true);

export const gcpEnvironmentSchema = z.enum(["development", "staging", "production"]);

export const gcpProjectIdSchema = z.string().min(6).max(30);

export const gcpConfirmationSchema = z.string().optional();

export const gcpDisplayNameSchema = z.string().min(1).max(30);

export const gcpBillingAccountIdSchema = z.string().min(14).max(40);

export const gcpParentTypeSchema = z.enum(["organization", "folder"]).nullable().optional();

export const gcpParentIdSchema = z.string().nullable().optional();

export const gcpLabelsSchema = z.record(z.string(), z.string()).optional();
