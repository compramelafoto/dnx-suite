import type { Provider } from "../types/provider.js";
import { cloudflareProvider } from "./cloudflare/index.js";
import { cursorProvider } from "./cursor/index.js";
import { dockerProvider } from "./docker/index.js";
import { gitProvider } from "./git/index.js";
import { gmailProvider } from "./gmail/index.js";
import { googleProvider } from "./google/index.js";
import { mercadopagoProvider } from "./mercadopago/index.js";
import { postgresProvider } from "./postgres/index.js";
import { prismaProvider } from "./prisma/index.js";
import { r2Provider } from "./r2/index.js";
import { redisProvider } from "./redis/index.js";
import { vercelProvider } from "./vercel/index.js";

/** Registro central de todos los providers disponibles. */
export const providers: Provider[] = [
  gitProvider,
  vercelProvider,
  dockerProvider,
  postgresProvider,
  prismaProvider,
  cloudflareProvider,
  mercadopagoProvider,
  r2Provider,
  redisProvider,
  gmailProvider,
  googleProvider,
  cursorProvider,
];

export function getProvider(name: string): Provider | undefined {
  return providers.find((provider) => provider.name === name);
}

export function getConfiguredProviders(): Provider[] {
  return providers.filter((provider) => provider.isConfigured());
}

export {
  cloudflareProvider,
  CloudflareProvider,
  createCloudflareProvider,
  resolveCloudflareConfig,
  isCloudflareConfigured,
} from "./cloudflare/index.js";
export { cursorProvider } from "./cursor/index.js";
export { dockerProvider } from "./docker/index.js";
export { gitProvider } from "./git/index.js";
export { gmailProvider } from "./gmail/index.js";
export { googleProvider } from "./google/index.js";
export { mercadopagoProvider } from "./mercadopago/index.js";
export { postgresProvider } from "./postgres/index.js";
export { prismaProvider } from "./prisma/index.js";
export { r2Provider } from "./r2/index.js";
export { redisProvider } from "./redis/index.js";
export { vercelProvider } from "./vercel/index.js";
export {
  ProviderRegistry,
  createDefaultProviderRegistry,
  ProviderNotRegisteredError,
  ProviderNameMismatchError,
} from "./registry/index.js";
export type { ProviderHealthReport, DefaultProviderRegistryConfig } from "./registry/index.js";
