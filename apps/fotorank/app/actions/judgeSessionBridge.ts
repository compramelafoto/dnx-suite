"use server";

/**
 * Confirmar el correo del sitio para dejar de tener dos contraseñas.
 *
 * Quien ya entró a FotoRank y además es jurado debería llegar a su panel sin
 * que le pidan nada. El puente lo permite, pero exige que el correo del sitio
 * esté confirmado — ver `puenteDeSesion.ts`. Esta acción manda ese enlace.
 */
import { requestEmailVerification } from "@repo/auth";

import { getAuthUser } from "../lib/auth";

export type EstadoDeLaConfirmacion = { info: string | null; error: string | null };

function baseUrl(): string {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_FOTORANK_URL?.trim() ||
    "";
  return raw ? raw.replace(/\/+$/, "") : "http://localhost:3000";
}

export async function pedirConfirmacionDeCorreoAction(): Promise<EstadoDeLaConfirmacion> {
  /*
   * El correo sale de la sesión, nunca de un formulario.
   *
   * Si lo eligiera quien llama, esto sería una forma de mandarle correos de
   * FotoRank a cualquier dirección.
   */
  const usuario = await getAuthUser();
  if (!usuario?.email) {
    return { info: null, error: "Entrá a FotoRank primero." };
  }

  await requestEmailVerification({
    email: usuario.email,
    appBaseUrl: baseUrl(),
    appLabel: "FotoRank",
    verifyPath: "/verificar-email",
    sourceApplication: "fotorank",
  });

  return {
    info: `Te mandamos el enlace a ${usuario.email}. Cuando confirmes, entrás a tu panel de jurado con la misma contraseña del sitio.`,
    error: null,
  };
}
