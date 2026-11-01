import { cookies } from "next/headers";
import {
  reportSuiteReferralSignup,
  SUITE_REFERRAL_COOKIE,
} from "@repo/auth/suite-referral";

import { avisoDeReferido, type UsuarioRecienCreado } from "./avisoDeReferido";

/**
 * Referidos de DNX Suite: si el visitante llegó con `?dnx_ref=CODIGO` (el proxy lo guardó en la
 * cookie `dnx_ref`) y acaba de crear su cuenta, se le avisa a ComprameLaFoto quién lo refirió.
 *
 * Llamar SÓLO después de que el usuario fue creado. Nunca tira error: un fallo acá no puede
 * romper el alta. Devuelve true si había código (y entonces conviene borrar la cookie).
 */
export async function reportarAltaReferida(
  usuario: UsuarioRecienCreado,
  valorDeLaCookie: string | undefined | null,
): Promise<boolean> {
  try {
    const aviso = avisoDeReferido(valorDeLaCookie, usuario);
    if (!aviso) return false;
    await reportSuiteReferralSignup(aviso);
    return true;
  } catch (err) {
    console.warn("[fotorank.suite-referral] no se pudo avisar el alta referida", err);
    return false;
  }
}

/**
 * Variante para server actions: lee la cookie con `cookies()` y la borra después de avisar,
 * para que otra cuenta creada desde el mismo navegador no herede el referido.
 */
export async function reportarAltaReferidaDesdeCookies(
  usuario: UsuarioRecienCreado,
): Promise<void> {
  try {
    const store = await cookies();
    const habia = await reportarAltaReferida(usuario, store.get(SUITE_REFERRAL_COOKIE)?.value);
    if (habia) store.delete(SUITE_REFERRAL_COOKIE);
  } catch (err) {
    console.warn("[fotorank.suite-referral] no se pudo leer o borrar la cookie de referido", err);
  }
}
