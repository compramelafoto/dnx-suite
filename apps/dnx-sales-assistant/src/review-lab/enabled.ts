/**
 * Laboratorio de revisión — solo desarrollo local explícito.
 * Nunca en production, aunque exista la variable de entorno.
 */
export function isReviewLabEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV === "production") return false;
  const flag = env.DNX_SALES_ASSISTANT_REVIEW_LAB;
  return flag === "true" || flag === "1";
}

export const REVIEW_LAB_ENV_FLAG = "DNX_SALES_ASSISTANT_REVIEW_LAB" as const;
