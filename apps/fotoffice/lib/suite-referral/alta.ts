// lib/suite-referral/alta.ts
import "server-only";
import { cookies } from "next/headers";
import { after, type NextResponse } from "next/server";
import { SUITE_REFERRAL_COOKIE, reportSuiteReferralSignup } from "@repo/auth/suite-referral";
import { codigoDeReferidoParaAlta } from "./decidir";

/**
 * Referidos de DNX Suite: si quien acaba de crear su cuenta en FOTOFFICE llegó con
 * `?dnx_ref=CODIGO` (el proxy lo guardó en la cookie `dnx_ref`), le avisa a CompraMeLaFoto
 * quién lo refirió. CLF es el único que guarda la atribución.
 *
 * Se llama SÓLO después de que el usuario quedó creado, y SÓLO en los caminos donde el propio
 * visitante crea su cuenta (no cuando un administrador da de alta a otro).
 *
 * **Nunca lanza ni demora el alta**: el aviso sale en `after()`, cuando la respuesta ya se
 * mandó, y `reportSuiteReferralSignup` tampoco tira error.
 *
 * `borrarCookie`: en server actions la cookie se borra acá con `cookies()`. En un route handler
 * que arma su propia respuesta, pasar `false` y borrarla en esa respuesta
 * (`borrarCookieDeReferido`).
 */
export async function avisarReferidoDeAlta(
  user: { id: number | string; email: string; name?: string | null },
  opciones: { cuentaCreada?: boolean; borrarCookie?: boolean } = {},
): Promise<void> {
  try {
    const store = await cookies();
    const code = codigoDeReferidoParaAlta({
      cuentaCreada: opciones.cuentaCreada ?? true,
      cookie: store.get(SUITE_REFERRAL_COOKIE)?.value,
    });
    if (!code) return;

    after(() =>
      reportSuiteReferralSignup({
        platform: "fotoffice",
        code,
        externalUserId: user.id,
        email: user.email,
        name: user.name ?? null,
      }),
    );

    if (opciones.borrarCookie !== false) {
      try {
        store.delete(SUITE_REFERRAL_COOKIE);
      } catch {
        // Fuera de una server action / route handler no se puede escribir: queda la cookie.
        // Un segundo aviso del mismo usuario no duplica nada en CLF (hace upsert).
      }
    }
  } catch (err) {
    console.warn("[fotoffice][suite-referral] no se pudo procesar el referido del alta", {
      userId: String(user.id),
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Borra la cookie `dnx_ref` en una respuesta armada a mano (route handlers). */
export function borrarCookieDeReferido(res: NextResponse): void {
  res.cookies.set(SUITE_REFERRAL_COOKIE, "", { path: "/", maxAge: 0, expires: new Date(0) });
}
