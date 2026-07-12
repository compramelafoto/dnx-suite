import type { Provider, ProviderName } from "../../types/provider.js";

/**
 * Factory para crear stubs de providers durante el bootstrap del proyecto.
 * Reemplazar con implementaciones reales al agregar funcionalidad.
 */
export function createProviderStub(name: ProviderName, isConfigured: () => boolean): Provider {
  return {
    name,
    isConfigured,
  };
}
