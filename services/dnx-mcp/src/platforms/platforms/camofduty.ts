import type { PlatformDefinition } from "../types.js";

export const camOfDutyPlatform: PlatformDefinition = {
  id: "camofduty",
  name: "CamOfDuty",
  description: "Plataforma de eventos y cobertura fotográfica en vivo",
  repository: "dnx-studio/camofduty",
  defaultBranch: "main",
  vercelProject: "camofduty",
  domains: {
    production: ["camofduty.com", "www.camofduty.com"],
    preview: ["preview.camofduty.com"],
  },
  workers: ["cod-live-ingest", "cod-face-detect"],
  database: {
    provider: "postgres",
    urlEnvKey: "POSTGRES_URL",
  },
  redis: {
    urlEnvKey: "REDIS_URL",
    prefix: "cod:",
  },
  r2: {
    bucket: "camofduty-media",
    prefix: "events/",
    publicUrl: "https://media.camofduty.com",
    productionProtected: true,
    stagingOperationsAllowed: true,
  },
  cloudflare: {
    zoneId: "cf_zone_cod",
    accountId: "cf_account_dnx",
  },
  mercadoPago: {
    enabled: true,
    webhookPath: "/api/webhooks/mp",
  },
  gmail: null,
  google: {
    enabled: false,
  },
  healthEndpoints: [
    {
      name: "api-health",
      url: "https://camofduty.com/api/health",
      method: "GET",
      expectedStatus: 200,
    },
    {
      name: "worker-health",
      url: "https://camofduty.com/api/workers/health",
      method: "GET",
      expectedStatus: 200,
    },
  ],
  smokeTests: [
    {
      id: "event-page",
      name: "Event page",
      description: "Verifica página de evento en preview",
      type: "http",
      target: "https://preview.camofduty.com/events/demo",
    },
  ],
  releasePolicy: {
    requireStagingValidation: true,
    requireConfirmation: true,
    autoDeployOnMerge: false,
    allowedTargets: ["production", "preview", "development"],
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
      key: "live-stream",
      description: "Transmisión en vivo de eventos",
      defaultValue: false,
    },
  ],
};
