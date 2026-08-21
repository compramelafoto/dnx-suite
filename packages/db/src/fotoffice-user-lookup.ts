/**
 * Búsqueda de cuentas para vincular con un socio.
 *
 * Vive SEPARADO de `fotoffice-members.ts` a propósito: ese módulo tiene el invariante de que
 * toda función recibe `workspaceId` como primer parámetro, y un test lo verifica. Acá no se
 * puede cumplir —ni tendría sentido— porque `User` es GLOBAL: la misma persona puede tener
 * cuenta y ser socia de varias instituciones a la vez. Meter esta función allá obligaría a
 * fingir un scope que no existe, o a debilitar un invariante que protege el aislamiento de
 * todo el padrón. Se prefiere el archivo aparte.
 */
import { prisma } from "./client";

export type LinkableUser = { id: number; email: string; name: string | null };

/**
 * Busca una cuenta por email EXACTO (sin distinguir mayúsculas).
 *
 * Deliberadamente NO admite coincidencias parciales ni devuelve listados: una búsqueda por
 * fragmentos permitiría enumerar la base global de usuarios de toda la plataforma desde el
 * panel de cualquier workspace. Devuelve solo lo mínimo para que el administrador confirme
 * identidad — nunca teléfono, rol ni otros workspaces de esa persona.
 */
export async function findLinkableUserByEmail(email: string): Promise<LinkableUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: { id: true, email: true, name: true },
  });
}
