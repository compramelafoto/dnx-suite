import type { GoogleCloudProvider } from "../../providers/google-cloud/index.js";
import { googleCloudProvider } from "../../providers/google-cloud/index.js";
import { GoogleCloudError } from "../../providers/google-cloud/errors.js";

/**
 * Resuelve el provider GCP. A diferencia de otros providers, "configurado"
 * significa DNX_GCP_ENABLED=true (no credenciales en env).
 */
export function getGoogleCloudProvider(
  provider: GoogleCloudProvider = googleCloudProvider,
): GoogleCloudProvider {
  if (!provider.isConfigured()) {
    throw new GoogleCloudError(
      "GCP_DISABLED",
      "Módulo Google Cloud deshabilitado (DNX_GCP_ENABLED=false).",
      {
        recommendedAction: "Definí DNX_GCP_ENABLED=true en services/dnx-mcp/.env.local.",
      },
    );
  }
  return provider;
}
