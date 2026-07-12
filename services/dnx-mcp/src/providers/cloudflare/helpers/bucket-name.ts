import { CloudflareValidationError } from "../errors.js";

/**
 * Reglas de naming para buckets R2 en DNX.
 * - Staging: debe terminar en `-staging`
 * - Producción: contiene `prod` o `production` (bloqueado para mutaciones)
 */

export function isStagingBucketName(name: string): boolean {
  return name.toLowerCase().endsWith("-staging");
}

export function isProductionBucketName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("production") ||
    /(^|[-_.])prod($|[-_.])/.test(lower) ||
    lower.endsWith("-prod") ||
    lower.startsWith("prod-")
  );
}

export function assertStagingBucketName(name: string): void {
  if (!isStagingBucketName(name)) {
    throw new CloudflareValidationError(
      `Bucket staging inválido: "${name}" debe terminar en "-staging"`,
    );
  }

  if (isProductionBucketName(name)) {
    throw new CloudflareValidationError(
      `Bucket staging inválido: "${name}" no puede contener "prod"/"production"`,
    );
  }
}
