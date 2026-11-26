/**
 * Regla del sello «Fotógrafo verificado»: identidad aprobada, sin reverificación pendiente
 * y cuenta con rol de fotógrafo. Tipos de texto a propósito: sin depender de Prisma.
 */
export function isVerifiedPhotographer(
  user: { role: string },
  identity: { status: string; reverifyRequiredAt: Date | null } | null,
): boolean {
  if (!identity) return false;
  return (
    user.role === "PHOTOGRAPHER" &&
    identity.status === "APPROVED" &&
    identity.reverifyRequiredAt === null
  );
}
