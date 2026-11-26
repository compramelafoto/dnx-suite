import type { ProviderResult } from "./resultado";
import { SimulatedProvider } from "./proveedor-simulado";

export interface IdentityProvider {
  name: string;
  startSession(input: {
    userId: number;
    returnUrl: string;
  }): Promise<{ redirectUrl: string; providerRef: string }>;
  /** `null` = firma inválida (o cuerpo ilegible). */
  parseWebhook(rawBody: string, headers: Headers): Promise<ProviderResult | null>;
}

export function getIdentityProvider(): IdentityProvider {
  const name = process.env.IDENTITY_PROVIDER;
  if (name === "simulado") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("El proveedor de identidad simulado no puede usarse en producción.");
    }
    return new SimulatedProvider();
  }
  throw new Error(`Proveedor de identidad no configurado: ${name ?? "(vacío)"}`);
}
