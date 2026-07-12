import {
  CloudflareConfirmationRequiredError,
  CloudflareGuardError,
  CloudflareValidationError,
} from "../errors.js";
import { isProductionBucketName } from "./bucket-name.js";

export interface MutableGateInput {
  dryRun?: boolean;
  confirm?: boolean;
}

export function assertMutableAllowed(action: string, input: MutableGateInput): void {
  const dryRun = input.dryRun ?? true;
  const confirm = input.confirm ?? false;

  if (dryRun) {
    return;
  }

  if (!confirm) {
    throw new CloudflareConfirmationRequiredError(action);
  }
}

export interface SafeBucketNameOptions {
  /** Permite leer buckets de producción (nunca mutar). */
  allowProductionRead?: boolean;
}

export function assertSafeBucketName(name: string, options: SafeBucketNameOptions = {}): void {
  if (!name || name.trim().length === 0) {
    throw new CloudflareValidationError("Nombre de bucket vacío");
  }

  if (!/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(name)) {
    throw new CloudflareValidationError(
      `Nombre de bucket inválido: "${name}". Debe ser DNS-compatible (3–63 chars).`,
    );
  }

  if (isProductionBucketName(name) && options.allowProductionRead !== true) {
    throw new CloudflareGuardError(
      `Operación bloqueada sobre bucket de producción "${name}" (NO TOCAR)`,
    );
  }
}

export { isProductionBucketName, isStagingBucketName } from "./bucket-name.js";
