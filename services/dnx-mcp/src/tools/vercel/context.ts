import type { VercelProvider } from "../../providers/vercel/index.js";
import { vercelProvider } from "../../providers/vercel/index.js";
import type { VercelDeployment } from "../../providers/vercel/types/deployment.js";
import { ProviderNotConfiguredError } from "../../utils/errors.js";

export function getVercelProvider(provider: VercelProvider = vercelProvider): VercelProvider {
  if (!provider.isConfigured()) {
    throw new ProviderNotConfiguredError("vercel");
  }
  return provider;
}

export function summarizeDeployment(deployment: VercelDeployment) {
  return {
    id: deployment.id,
    url: deployment.url ?? null,
    state: deployment.readyState ?? deployment.state ?? "unknown",
    target: deployment.target ?? null,
    createdAt: deployment.createdAt ?? null,
  };
}
