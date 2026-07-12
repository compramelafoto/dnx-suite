import type { PlatformDefinition } from "../types.js";

/**
 * ComprameLaFoto — Platform Catalog (monorepo dnx-suite)
 *
 * Vercel activo (release/staging): `compramelafoto-dnxsuite` — app en `apps/compramelafoto`.
 * Vercel legacy (solo referencia): `compramelafoto` — NO usar como target de release ni staging.
 *
 * Dominios productivos (`compramelafoto.com`, `www.compramelafoto.com`): legacy / NO TOCAR.
 * Dominios preview/staging (`preview.compramelafoto.com`): asociados al proyecto monorepo.
 *
 * Ramas de release:
 * - `main` — producción final.
 * - `migration-legacy-clf-to-monorepo` — solo staging/preparación (dry-run, validate); no cutover prod.
 */
export const comprameLaFotoPlatform: PlatformDefinition = {
  id: "compramelafoto",
  name: "ComprameLaFoto",
  description:
    "Marketplace de fotografía — venta y entrega de imágenes. " +
    "Release/staging en Vercel proyecto monorepo `compramelafoto-dnxsuite` (dnx-suite). " +
    "Proyecto legacy `compramelafoto` documentado solo como referencia — no es target de release. " +
    "Dominios productivos reales (compramelafoto.com) legacy/NO TOCAR.",
  repository: "compramelafoto/dnx-suite",
  defaultBranch: "main",
  vercelProject: "compramelafoto-dnxsuite",
  domains: {
    /** Legacy producción — referencia únicamente; NO modificar DNS ni aliases en release. */
    production: ["compramelafoto.com", "www.compramelafoto.com"],
    /** Preview/staging del monorepo (`compramelafoto-dnxsuite`). */
    preview: ["preview.compramelafoto.com"],
  },
  workers: ["cmlf-image-processor", "cmlf-watermark"],
  database: {
    provider: "prisma",
    urlEnvKey: "DATABASE_URL",
    schema: "public",
  },
  redis: {
    urlEnvKey: "REDIS_URL",
    prefix: "cmlf:",
  },
  r2: {
    /** Alias legacy → producción. */
    bucket: "compramelafoto-prod",
    productionBucket: "compramelafoto-prod",
    stagingBucket: "compramelafoto-staging",
    productionProtected: true,
    stagingOperationsAllowed: true,
    prefix: "uploads/",
    publicUrl: "https://assets.compramelafoto.com",
    expectedPublicUrl: "https://assets.compramelafoto.com",
    smokeTestObjectKey: "smoke/health-check.txt",
  },
  cloudflare: {
    zoneId: "cf_zone_cmlf",
    accountId: "f2657ee448aca18d2af0cf2b0669289b",
  },
  mercadoPago: {
    enabled: true,
    webhookPath: "/api/webhooks/mercadopago",
  },
  gmail: {
    enabled: true,
    senderEnvKey: "GMAIL_SENDER",
  },
  google: {
    enabled: true,
    oauthScopes: ["openid", "email", "profile"],
  },
  healthEndpoints: [
    {
      name: "legacy-production-health",
      url: "https://compramelafoto.com/api/health",
      method: "GET",
      expectedStatus: 200,
    },
  ],
  smokeTests: [
    {
      id: "home-loads",
      name: "Homepage carga (staging monorepo)",
      description: "Verifica homepage en preview del proyecto compramelafoto-dnxsuite",
      type: "http",
      target: "https://preview.compramelafoto.com",
    },
    {
      id: "checkout-flow",
      name: "Checkout accesible (staging monorepo)",
      description: "Verifica ruta de checkout en preview del monorepo",
      type: "http",
      target: "https://preview.compramelafoto.com/checkout",
    },
  ],
  releasePolicy: {
    requireStagingValidation: true,
    requireConfirmation: true,
    autoDeployOnMerge: false,
    /** Solo preview/staging monorepo; producción legacy excluida del pipeline. */
    allowedTargets: ["preview"],
    /**
     * `main` — única rama para release de producción final.
     * `migration-legacy-clf-to-monorepo` — solo staging/preparación y dry-run mientras dura la migración monorepo.
     */
    allowedBranches: ["main", "migration-legacy-clf-to-monorepo"],
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
      key: "new-checkout",
      description: "Nuevo flujo de checkout",
      defaultValue: false,
    },
    {
      key: "ai-tagging",
      description: "Etiquetado automático con IA",
      defaultValue: false,
    },
  ],
};
