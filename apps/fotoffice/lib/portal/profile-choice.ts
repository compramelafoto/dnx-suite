import { cookies } from "next/headers";

/**
 * Recuerda con qué perfil eligió entrar la persona.
 *
 * Existe para no preguntar lo mismo en cada inicio de sesión. Guarda ÚNICAMENTE la clave del
 * perfil (`TEAM:ws-abc` / `MEMBER:ws-abc`), que no es un secreto: es equivalente a un "última
 * pestaña abierta".
 *
 * No es un control de acceso y no debe usarse como tal. La cookie decide A DÓNDE se entra;
 * QUÉ se puede hacer lo sigue resolviendo cada ruta por su cuenta — el panel exige membresía
 * de workspace y el portal exige ficha de socio. Una cookie manipulada, apuntando a un perfil
 * que la persona no tiene, se descarta al no encontrarse en su lista real de perfiles.
 */

export const PROFILE_CHOICE_COOKIE = "fotoffice_perfil";

/** 90 días: la elección es una preferencia, no una sesión. */
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export async function readProfileChoice(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(PROFILE_CHOICE_COOKIE)?.value?.trim();
  return value ? value : null;
}

export async function setProfileChoice(key: string): Promise<void> {
  const store = await cookies();
  store.set(PROFILE_CHOICE_COOKIE, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearProfileChoice(): Promise<void> {
  const store = await cookies();
  store.delete(PROFILE_CHOICE_COOKIE);
}
