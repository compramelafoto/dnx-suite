/**
 * La atribución viaja en cookie y no en el query string.
 *
 * Quien llega por un link de invitación va a mirar el programa, la sede y las
 * fotos antes de decidir. Si la atribución viviera en la URL, se perdería en
 * el primer clic y el colega que lo trajo no contaría.
 */

export const REFERRAL_COOKIE_NAME = "ck_ref";

/** 90 días: cubre de sobra el ciclo entre que alguien mira y se inscribe. */
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export type OpcionesCookie = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

export function opcionesCookieReferido(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): OpcionesCookie {
  return {
    httpOnly: true,
    sameSite: "lax",
    // `next dev` sirve por HTTP: una cookie Secure nunca llegaría.
    secure: nodeEnv === "production",
    path: "/",
    maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
  };
}
