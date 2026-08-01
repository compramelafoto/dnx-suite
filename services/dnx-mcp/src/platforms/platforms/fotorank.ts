import type { PlatformDefinition } from "../types.js";

export const fotorankPlatform: PlatformDefinition = {
  id: "fotorank",
  name: "FotoRank",
  description: "Ranking y competencias de fotografía",
  repository: "dnx-studio/fotorank",
  defaultBranch: "main",
  /** Proyecto Vercel real en el team: fotorank-dnxsuite (alias operativo: fotorank). */
  vercelProject: "fotorank-dnxsuite",
  domains: {
    production: ["fotorank.com", "www.fotorank.com", "fotorank.dnxsuite.com"],
    preview: ["fotorank.staging.dnxsuite.com", "preview.fotorank.com"],
  },
  workers: ["fr-vote-counter", "fr-leaderboard"],
  database: {
    provider: "prisma",
    urlEnvKey: "DATABASE_URL",
  },
  redis: {
    urlEnvKey: "REDIS_URL",
    prefix: "fr:",
  },
  r2: {
    bucket: "fotorank-uploads",
    /** Bucket privado de staging (P0-08). Nunca usar el de producción. */
    stagingBucket: "fotorank-private-staging",
    prefix: "fotorank/",
    productionProtected: true,
    stagingOperationsAllowed: true,
  },
  cloudflare: {
    zoneId: "cf_zone_fr",
    accountId: "cf_account_dnx",
  },
  mercadoPago: {
    enabled: false,
  },
  gmail: {
    enabled: false,
  },
  google: {
    enabled: true,
    oauthScopes: ["openid", "email", "profile"],
  },
  healthEndpoints: [
    {
      name: "api-health",
      url: "https://fotorank.com/api/health",
      method: "GET",
      expectedStatus: 200,
    },
  ],
  smokeTests: [
    {
      id: "ranking-page",
      name: "Ranking page",
      description: "Verifica página de ranking en preview",
      type: "http",
      target: "https://preview.fotorank.com/ranking",
    },
  ],
  releasePolicy: {
    requireStagingValidation: true,
    requireConfirmation: true,
    autoDeployOnMerge: false,
    allowedTargets: ["production", "preview"],
  },
  rollbackPolicy: {
    enabled: true,
    maxRollbackSteps: 1,
    requireConfirmation: true,
  },
  maintenanceMode: {
    enabled: false,
    allowedIps: [],
  },
  featureFlags: [
    {
      key: "live-voting",
      description: "Votación en tiempo real",
      defaultValue: false,
    },
  ],
};
