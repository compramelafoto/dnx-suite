import { cookies } from "next/headers";
import { reportSuiteReferralSignup, SUITE_REFERRAL_COOKIE } from "@repo/auth/suite-referral";
import { buildInfoSpotReferralReport, type InfoSpotNewUser } from "./build-report";

/**
 * Referidos de DNX Suite: si el visitante llegó con `?dnx_ref=CODIGO` (el proxy lo guardó en la
 * cookie `dnx_ref`) y acaba de crear su cuenta en Info Spot, se le avisa a ComprameLaFoto quién
 * lo refirió.
 *
 * Llamar SÓLO después de que el usuario fue creado (no en un login de alguien que ya existía).
 * Nunca tira error: un fallo acá no puede romper el alta.
 * Devuelve true si había código (y entonces conviene borrar la cookie).
 */
export async function reportInfoSpotReferralSignup(
  user: InfoSpotNewUser,
  rawCookie: string | undefined | null,
): Promise<boolean> {
  try {
    const report = buildInfoSpotReferralReport(rawCookie, user);
    if (!report) return false;
    await reportSuiteReferralSignup(report);
    return true;
  } catch (err) {
    console.warn("[infospot.suite-referral] no se pudo avisar el alta referida", err);
    return false;
  }
}

/**
 * Variante para server actions / route handlers: lee la cookie con `cookies()` y la borra
 * después de avisar, para que otra cuenta creada desde el mismo navegador no herede el referido.
 * Ojo: en un route handler que devuelve su propio NextResponse, borrar la cookie en la respuesta.
 */
export async function reportInfoSpotReferralSignupFromCookies(
  user: InfoSpotNewUser,
): Promise<void> {
  try {
    const store = await cookies();
    const had = await reportInfoSpotReferralSignup(user, store.get(SUITE_REFERRAL_COOKIE)?.value);
    if (had) store.delete(SUITE_REFERRAL_COOKIE);
  } catch (err) {
    console.warn("[infospot.suite-referral] no se pudo leer o borrar la cookie de referido", err);
  }
}
