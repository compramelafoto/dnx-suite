import { profileDestination, type UserProfile } from "../portal/profiles";

export type WelcomeAccess =
  /** Mostrar la pregunta: esta persona no tiene por dónde entrar. */
  | { ask: true }
  /** Ya tiene lugar (o una ficha para reconocer): se la manda ahí sin preguntar nada. */
  | { redirectTo: string };

/**
 * Quién ve la pregunta "¿a qué viniste?" y quién no.
 *
 * Función pura a propósito: la pantalla solo consulta la base y le pasa el resultado. Así la
 * regla —que es donde estaba el defecto— se puede probar entera sin levantar Next.
 *
 * El orden importa. Reconocer va primero: a un socio que figura en el padrón con este mismo
 * email hay que ofrecerle su ficha, no un menú donde una de las opciones es fabricarse una
 * institución. Ese menú es justo lo que les faltó evitar a Emeveph y a Libardi.
 */
export function resolveWelcomeAccess(input: {
  profiles: UserProfile[];
  claimable: boolean;
}): WelcomeAccess {
  if (input.claimable) return { redirectTo: "/soy-socio" };

  const [unico] = input.profiles;
  if (input.profiles.length === 1 && unico) {
    return { redirectTo: profileDestination(unico) };
  }
  if (input.profiles.length > 1) return { redirectTo: "/elegir-perfil" };

  return { ask: true };
}
