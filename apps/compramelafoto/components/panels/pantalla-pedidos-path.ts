/**
 * La pantalla de pedidos escolares (`/fotografo/escuelas/pedidos/pantalla`) va sin menú lateral
 * ni burbuja del bot: se muestra en un televisor y el rincón de abajo a la derecha es para la
 * cámara del que presenta.
 */
export function isPantallaPedidosPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return /^\/fotografo\/escuelas\/pedidos\/pantalla\/?$/.test(pathname);
}
