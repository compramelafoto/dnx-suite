import path from "node:path";
import { fileURLToPath } from "node:url";

/** Raíz de `apps/dnx-sales-assistant` (sin side effects de carga de config). */
export function resolveSalesAssistantRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/pricing/config → app root
  return path.resolve(here, "../../..");
}

export function defaultPricingConfigDir(appRoot = resolveSalesAssistantRoot()): string {
  return path.join(appRoot, "config", "pricing");
}

export function defaultProfileLocalPath(appRoot = resolveSalesAssistantRoot()): string {
  return path.join(defaultPricingConfigDir(appRoot), "dnx-pricing-profile.local.json");
}

export function defaultTemplatesLocalPath(appRoot = resolveSalesAssistantRoot()): string {
  return path.join(
    defaultPricingConfigDir(appRoot),
    "dnx-service-templates.local.json",
  );
}

export function defaultProfileExamplePath(appRoot = resolveSalesAssistantRoot()): string {
  return path.join(
    defaultPricingConfigDir(appRoot),
    "dnx-pricing-profile.example.json",
  );
}

export function defaultTemplatesExamplePath(appRoot = resolveSalesAssistantRoot()): string {
  return path.join(
    defaultPricingConfigDir(appRoot),
    "dnx-service-templates.example.json",
  );
}

export function defaultJobLocalPath(appRoot = resolveSalesAssistantRoot()): string {
  return path.join(defaultPricingConfigDir(appRoot), "dnx-pricing-job.local.json");
}

export function defaultJobExamplePath(appRoot = resolveSalesAssistantRoot()): string {
  return path.join(defaultPricingConfigDir(appRoot), "dnx-pricing-job.example.json");
}
