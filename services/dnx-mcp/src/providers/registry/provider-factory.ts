import type { Provider, ProviderName } from "../../types/provider.js";
import { cloudflareProvider } from "../cloudflare/index.js";
import { cursorProvider } from "../cursor/index.js";
import { dockerProvider } from "../docker/index.js";
import { gitProvider } from "../git/index.js";
import { gmailProvider } from "../gmail/index.js";
import { googleProvider } from "../google/index.js";
import { mercadopagoProvider } from "../mercadopago/index.js";
import { postgresProvider } from "../postgres/index.js";
import { prismaProvider } from "../prisma/index.js";
import { r2Provider } from "../r2/index.js";
import { redisProvider } from "../redis/index.js";
import { vercelProvider } from "../vercel/index.js";
import { ProviderRegistry } from "./provider-registry.js";
import type { DefaultProviderRegistryConfig } from "./provider-registry-types.js";

const DEFAULT_PROVIDERS: ReadonlyArray<{ name: ProviderName; provider: Provider }> = [
  { name: "vercel", provider: vercelProvider },
  { name: "git", provider: gitProvider },
  { name: "prisma", provider: prismaProvider },
  { name: "docker", provider: dockerProvider },
  { name: "postgres", provider: postgresProvider },
  { name: "cloudflare", provider: cloudflareProvider },
  { name: "mercadopago", provider: mercadopagoProvider },
  { name: "r2", provider: r2Provider },
  { name: "redis", provider: redisProvider },
  { name: "gmail", provider: gmailProvider },
  { name: "google", provider: googleProvider },
  { name: "cursor", provider: cursorProvider },
];

export function createDefaultProviderRegistry(
  config: DefaultProviderRegistryConfig = {},
): ProviderRegistry {
  const registry = new ProviderRegistry();
  const overrides = config.providers ?? {};

  for (const { name, provider } of DEFAULT_PROVIDERS) {
    registry.registerProvider(name, overrides[name] ?? provider);
  }

  return registry;
}
