import type { PlatformDefinition } from "../types.js";

export const fotoOfficePlatform: PlatformDefinition = {
  id: "fotooffice",
  name: "FotoOffice",
  description: "Suite de gestión para estudios fotográficos",
  repository: "dnx-studio/fotooffice",
  defaultBranch: "main",
  vercelProject: "fotooffice",
  domains: {
    production: ["fotooffice.com", "www.fotooffice.com"],
    preview: ["preview.fotooffice.com"],
  },
  workers: ["fo-scheduler", "fo-notifications"],
  database: {
    provider: "postgres",
    urlEnvKey: "POSTGRES_URL",
    schema: "fotooffice",
  },
  redis: {
    urlEnvKey: "REDIS_URL",
    prefix: "fo:",
  },
  r2: {
    bucket: "fotooffice-assets",
    prefix: "media/",
    productionProtected: true,
    stagingOperationsAllowed: true,
  },
  cloudflare: {
    zoneId: "cf_zone_fo",
    accountId: "cf_account_dnx",
  },
  mercadoPago: {
    enabled: true,
    webhookPath: "/api/payments/webhook",
  },
  gmail: {
    enabled: true,
    senderEnvKey: "GMAIL_SENDER",
  },
  google: {
    enabled: true,
    oauthScopes: ["openid", "email", "profile", "calendar"],
  },
  healthEndpoints: [
    {
      name: "api-health",
      url: "https://fotooffice.com/api/health",
      method: "GET",
      expectedStatus: 200,
    },
  ],
  smokeTests: [
    {
      id: "dashboard-loads",
      name: "Dashboard accesible",
      description: "Verifica dashboard en preview",
      type: "http",
      target: "https://preview.fotooffice.com/dashboard",
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
    maxRollbackSteps: 2,
    requireConfirmation: true,
  },
  maintenanceMode: {
    enabled: false,
    allowedIps: [],
  },
  featureFlags: [
    {
      key: "calendar-sync",
      description: "Sincronización con Google Calendar",
      defaultValue: true,
    },
  ],
};
