import {
  CLF_MP_SPLIT_1N_HOMOLOGATION_FLAG,
  isClfMpSplit1nHomologationFlagEnabled,
} from "./feature-flag";

export type HomologationSafetyOk = {
  ok: true;
  environment: "sandbox_homologation";
  productionWrites: "BLOCKED";
};

export type HomologationSafetyFail = {
  ok: false;
  code:
    | "PRODUCTION_HARD_BLOCK"
    | "FLAG_DISABLED"
    | "PRODUCTION_ORDERS_FLAG_ON"
    | "VERCEL_PRODUCTION";
  message: string;
};

export type HomologationSafetyResult =
  | HomologationSafetyOk
  | HomologationSafetyFail;

/**
 * Defense in depth: even if the homologation flag is accidentally true in
 * production, the surface must refuse to run.
 */
export function assertClfMpSplit1nHomologationSafe(
  env: NodeJS.ProcessEnv = process.env,
): HomologationSafetyResult {
  const nodeEnv = (env.NODE_ENV ?? "").trim().toLowerCase();
  const vercelEnv = (env.VERCEL_ENV ?? "").trim().toLowerCase();
  const prodOrders = (env.DNX_MP_ORDERS_1N_PRODUCTION_ENABLED ?? "")
    .trim()
    .toLowerCase();

  if (nodeEnv === "production" && vercelEnv === "production") {
    return {
      ok: false,
      code: "PRODUCTION_HARD_BLOCK",
      message:
        "CLF MP Split 1:N homologation is blocked in production runtime",
    };
  }

  // Explicit Vercel production target
  if (vercelEnv === "production") {
    return {
      ok: false,
      code: "VERCEL_PRODUCTION",
      message: "CLF MP Split 1:N homologation blocked on Vercel production",
    };
  }

  if (prodOrders === "true" || prodOrders === "1" || prodOrders === "yes") {
    return {
      ok: false,
      code: "PRODUCTION_ORDERS_FLAG_ON",
      message: "DNX_MP_ORDERS_1N_PRODUCTION_ENABLED must not be true",
    };
  }

  if (!isClfMpSplit1nHomologationFlagEnabled(env)) {
    return {
      ok: false,
      code: "FLAG_DISABLED",
      message: `${CLF_MP_SPLIT_1N_HOMOLOGATION_FLAG} is not enabled`,
    };
  }

  // Allow: local `next dev` (NODE_ENV=development), Vercel preview, or
  // NODE_ENV=production only when VERCEL_ENV is preview/development (edge case).
  if (nodeEnv === "production" && vercelEnv !== "preview" && vercelEnv !== "development") {
    // Local `next start` without VERCEL_ENV — still block to be safe.
    if (!vercelEnv) {
      return {
        ok: false,
        code: "PRODUCTION_HARD_BLOCK",
        message:
          "CLF MP Split 1:N homologation blocked when NODE_ENV=production without preview env",
      };
    }
  }

  return {
    ok: true,
    environment: "sandbox_homologation",
    productionWrites: "BLOCKED",
  };
}
