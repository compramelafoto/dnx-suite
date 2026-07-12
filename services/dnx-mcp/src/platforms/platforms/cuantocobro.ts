import type { PlatformDefinition } from "../types.js";

export const cuantoCobroPlatform: PlatformDefinition = {
  id: "cuantocobro",
  name: "CuantoCobro",
  description: "Calculadora y gestión de precios para fotógrafos",
  repository: "dnx-studio/cuantocobro",
  defaultBranch: "main",
  vercelProject: "cuantocobro",
  domains: {
    production: ["cuantocobro.com", "www.cuantocobro.com"],
    preview: ["preview.cuantocobro.com"],
  },
  workers: [],
  database: {
    provider: "prisma",
    urlEnvKey: "DATABASE_URL",
  },
  redis: null,
  r2: null,
  cloudflare: {
    zoneId: "cf_zone_cc",
    accountId: "cf_account_dnx",
  },
  mercadoPago: {
    enabled: false,
  },
  gmail: {
    enabled: true,
    senderEnvKey: "GMAIL_SENDER",
  },
  google: {
    enabled: true,
    oauthScopes: ["openid", "email"],
  },
  healthEndpoints: [
    {
      name: "api-health",
      url: "https://cuantocobro.com/api/health",
      method: "GET",
      expectedStatus: 200,
    },
  ],
  smokeTests: [
    {
      id: "calculator",
      name: "Calculadora accesible",
      description: "Verifica calculadora en preview",
      type: "http",
      target: "https://preview.cuantocobro.com/calculator",
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
      key: "premium-templates",
      description: "Plantillas premium de presupuesto",
      defaultValue: false,
    },
  ],
};
