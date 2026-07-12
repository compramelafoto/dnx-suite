import { ProviderNotConfiguredError } from "../../utils/errors.js";
import type { CloudflareProvider } from "../../providers/cloudflare/index.js";
import { cloudflareProvider } from "../../providers/cloudflare/index.js";

export function getCloudflareProvider(
  provider: CloudflareProvider = cloudflareProvider,
): CloudflareProvider {
  if (!provider.isConfigured()) {
    throw new ProviderNotConfiguredError("cloudflare");
  }
  return provider;
}
