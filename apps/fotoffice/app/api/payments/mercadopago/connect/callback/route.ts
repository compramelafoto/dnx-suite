import { NextResponse } from "next/server";
import { createConnectDeps } from "@/lib/payments/connect/deps";
import { ConnectError, completeMpConnection } from "@/lib/payments/connect/service";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";

const SETTINGS_URL = "/workspace/configuracion/cobros";

/**
 * Recibe el retorno de MercadoPago y completa la vinculación.
 *
 * No hay guard de sesión acá a propósito: quien vuelve de MercadoPago puede haber perdido
 * la cookie en el camino. La autorización ya se verificó al iniciar, y lo que protege este
 * paso es el **estado OAuth**: existe en la base, es de FotoOffice, no venció y no se usó
 * antes. Sin ese estado no se conecta nada, tenga o no sesión quien llegue.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const mpError = url.searchParams.get("error");

  // La institución canceló la autorización en MercadoPago.
  if (mpError) {
    return NextResponse.redirect(new URL(`${SETTINGS_URL}?error=cancelado`, request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL(`${SETTINGS_URL}?error=respuesta_incompleta`, request.url));
  }

  try {
    await completeMpConnection({ code, state }, createConnectDeps());
    return NextResponse.redirect(new URL(`${SETTINGS_URL}?ok=conectado`, request.url));
  } catch (error) {
    const codeError = error instanceof ConnectError ? error.code : "ERROR";
    // El código de autorización y el state nunca se registran: son secretos de un solo uso.
    // El detalle del error sí, saneado: sin él no se puede distinguir un rechazo del
    // proveedor de un bug propio.
    console.error("[fotoffice][mp-connect] callback falló", {
      code: codeError,
      detalle: sanitizeError(error),
    });
    return NextResponse.redirect(new URL(`${SETTINGS_URL}?error=${codeError}`, request.url));
  }
}
