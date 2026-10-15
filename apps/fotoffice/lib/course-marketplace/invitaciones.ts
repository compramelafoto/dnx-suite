/** Las invitaciones de un negocio: a su nombre, o a un correo suyo que todavía no tenía negocio. Puro. */
export function invitacionesPendientesWhere(workspaceId: string, email: string) {
  return {
    status: "INVITADO" as const,
    OR: [{ workspaceId }, { workspaceId: null, invitedEmail: email.trim().toLowerCase() }],
  };
}
