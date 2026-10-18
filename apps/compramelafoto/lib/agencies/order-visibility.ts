/**
 * Pedidos de álbumes de agencia: los ve y descarga sólo el dueño. El fotógrafo del equipo
 * ve sus ventas por "Mis agencias" (sin datos del comprador), nunca por Pedidos.
 */
export function digitalOrdersVisibilityWhere(userId: number) {
  return {
    OR: [
      { album: { userId } },
      { album: { photos: { some: { userId } }, agencyAlbum: { is: null } } },
    ],
  };
}

export function canCollaboratorDownloadOrder(input: { isCollaborator: boolean; isAgencyAlbum: boolean }): boolean {
  return input.isCollaborator && !input.isAgencyAlbum;
}
