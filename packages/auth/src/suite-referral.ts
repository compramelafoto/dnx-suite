/**
 * Referidos de DNX Suite: el código de referido de ComprameLaFoto viaja a cualquier
 * plataforma de la suite y, cuando el visitante crea su cuenta ahí, la plataforma le
 * avisa a CLF quién lo refirió. CLF es el único que guarda la atribución.
 *
 * Archivo sin dependencias (ni Prisma ni Next): lo importan middlewares en edge.
 *
 * Por qué `dnx_ref` y no `ref`: Clickatón ya usa `?ref=` para su propio programa
 * de descuentos, y los dos programas tienen que poder convivir.
 */

/** Parámetro de la URL y nombre de la cookie, iguales en todas las plataformas. */
export const SUITE_REFERRAL_PARAM = "dnx_ref";
export const SUITE_REFERRAL_COOKIE = "dnx_ref";
export const SUITE_REFERRAL_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Endpoint de CLF que registra el alta. */
export const SUITE_REFERRAL_ENDPOINT_PATH = "/api/referrals/suite-signup";
/** Header con el secreto compartido entre las plataformas y CLF. */
export const SUITE_REFERRAL_SECRET_HEADER = "x-dnx-suite-referral-secret";

export const SUITE_REFERRAL_PLATFORMS = [
  "fotoffice",
  "fotorank",
  "muestras",
  "subilafoto",
  "infospot",
  "clickaton",
] as const;
export type SuiteReferralPlatform = (typeof SUITE_REFERRAL_PLATFORMS)[number];

export function isSuiteReferralPlatform(value: unknown): value is SuiteReferralPlatform {
  return (
    typeof value === "string" &&
    (SUITE_REFERRAL_PLATFORMS as readonly string[]).includes(value)
  );
}

/**
 * Normaliza un código tal como llega de la URL o de la cookie. Los códigos de CLF
 * son alfanuméricos; cualquier otra cosa se descarta para no guardar basura.
 */
export function normalizeSuiteReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,40}$/.test(code) ? code : null;
}

/** Header `Set-Cookie` para guardar el código (lo usan los middlewares). */
export function buildSuiteReferralSetCookie(code: string, secure = true): string {
  return [
    `${SUITE_REFERRAL_COOKIE}=${encodeURIComponent(code)}`,
    "Path=/",
    `Max-Age=${SUITE_REFERRAL_COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    "HttpOnly",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * Lee el código de la URL de un request. El primer link gana: si ya hay cookie,
 * el middleware no la pisa (mismo criterio que los referidos de Clickatón).
 */
export function suiteReferralCodeToStore(
  url: URL,
  existingCookie: string | undefined | null,
): string | null {
  if (normalizeSuiteReferralCode(existingCookie)) return null;
  return normalizeSuiteReferralCode(url.searchParams.get(SUITE_REFERRAL_PARAM));
}

export type SuiteReferralSignupReport = {
  platform: SuiteReferralPlatform;
  code: string;
  /** Id del usuario en la base de la plataforma (no existe en CLF). */
  externalUserId: string | number;
  email: string;
  name?: string | null;
};

export type SuiteReferralReportResult =
  | { ok: true; outcome: string }
  | { ok: false; reason: string };

function resolveEndpoint(): string {
  const base = (process.env.DNX_SUITE_REFERRAL_URL || "https://www.compramelafoto.com").replace(
    /\/$/,
    "",
  );
  return `${base}${SUITE_REFERRAL_ENDPOINT_PATH}`;
}

/**
 * Le avisa a CLF que alguien se registró con un código. Nunca tira error: un fallo
 * acá no puede romper el alta de la cuenta. Deja rastro en el log para revisarlo.
 */
export async function reportSuiteReferralSignup(
  input: SuiteReferralSignupReport,
): Promise<SuiteReferralReportResult> {
  const code = normalizeSuiteReferralCode(input.code);
  if (!code) return { ok: false, reason: "INVALID_CODE" };
  const secret = process.env.DNX_SUITE_REFERRAL_SECRET;
  if (!secret) {
    console.warn("[dnx.suite-referral] falta DNX_SUITE_REFERRAL_SECRET; no se registra", {
      platform: input.platform,
      code,
    });
    return { ok: false, reason: "NO_SECRET" };
  }

  try {
    const res = await fetch(resolveEndpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [SUITE_REFERRAL_SECRET_HEADER]: secret,
      },
      body: JSON.stringify({
        platform: input.platform,
        code,
        externalUserId: String(input.externalUserId),
        email: input.email,
        name: input.name ?? null,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json().catch(() => null)) as { outcome?: string } | null;
    if (!res.ok) {
      console.warn("[dnx.suite-referral] CLF rechazó el aviso", {
        platform: input.platform,
        code,
        status: res.status,
        outcome: data?.outcome,
      });
      return { ok: false, reason: data?.outcome ?? `HTTP_${res.status}` };
    }
    console.info("[dnx.suite-referral] alta registrada", {
      platform: input.platform,
      code,
      outcome: data?.outcome,
    });
    return { ok: true, outcome: data?.outcome ?? "OK" };
  } catch (err) {
    console.warn("[dnx.suite-referral] no se pudo avisar a CLF", {
      platform: input.platform,
      code,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: "NETWORK" };
  }
}
