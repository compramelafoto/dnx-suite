const FORBIDDEN_HOST = "maratonfotografica.com";

const URL_ENV_KEYS = [
  "APP_URL",
  "CLICKATON_PUBLIC_URL",
  "CLICKATON_PUBLIC_WEB_BASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "CLICKATON_RETURN_URL",
  "CLICKATON_MP_RETURN_URL",
  "MERCADOPAGO_RETURN_URL",
] as const;

function pointsToProduction(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === FORBIDDEN_HOST || host === `www.${FORBIDDEN_HOST}`;
  } catch {
    return /(^|[/:.])maratonfotografica\.com(?:[/:]|$)/i.test(value);
  }
}

export function assertStagingPublicUrls(options?: {
  env?: NodeJS.ProcessEnv;
  expectStaging?: boolean;
}): void {
  const env = options?.env ?? process.env;
  const stagingExpected =
    options?.expectStaging === true ||
    env.CLICKATON_EXPECTED_PRODUCT_ENV?.trim().toLowerCase() === "staging";
  if (!stagingExpected) return;

  const forbidden = URL_ENV_KEYS.filter((key) => {
    const value = env[key]?.trim();
    return value ? pointsToProduction(value) : false;
  });
  if (forbidden.length > 0) {
    throw new Error(
      `STAGING URL GUARD ABORTED: ${forbidden.join(", ")} apunta al dominio de producción; usá una URL de staging.`,
    );
  }
}
