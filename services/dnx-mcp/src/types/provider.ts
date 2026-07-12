/**
 * Contrato base para todos los providers de DNX-MCP.
 * Cada integración externa (git, vercel, docker, etc.) implementa esta interfaz.
 */
export interface Provider {
  /** Identificador único del provider (ej: "git", "vercel"). */
  readonly name: string;

  /** Indica si el provider tiene la configuración necesaria para operar. */
  isConfigured(): boolean;
}

export type ProviderName =
  | "git"
  | "vercel"
  | "docker"
  | "postgres"
  | "prisma"
  | "cloudflare"
  | "mercadopago"
  | "r2"
  | "redis"
  | "gmail"
  | "google"
  | "cursor";
