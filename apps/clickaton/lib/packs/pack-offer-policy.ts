/**
 * Quién puede ver el Pack de 4 maratones.
 *
 * El pack es la única oferta paga que se da de alta sola en cada edición, cada
 * vez que alguien abre la página de inscripción. En una edición oculta de prueba
 * eso significa mostrarle a un invitado una compra de $100.000 que termina en un
 * cobro real de Mercado Pago. No se ofrece ahí.
 */

export function debeOfrecerPackDeMaratones(
  edition: { isOpsFixture?: boolean | null } | null | undefined,
): boolean {
  // Sin edición no hay contexto para decidir: no se ofrece nada pago.
  if (!edition) return false;
  return edition.isOpsFixture !== true;
}
