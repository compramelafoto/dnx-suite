/**
 * La cookie del pedido del comprador (etapa 8, D25), sin base ni secretos: la usan el `proxy` (que
 * cambia el `?t=` del enlace por la cookie) y las acciones. El valor es el mismo token del enlace;
 * quien lo lee lo valida siempre contra el hash guardado (`pedidoConAcceso`).
 */
export const COOKIE_PEDIDO_DIAS = 30;

export const nombreCookieDePedido = (publicId: string) => `mf_pedido_${publicId}`;

/** Un token con la forma de los que emitimos (HMAC-SHA256 en base64url). No dice si es válido. */
export function tokenConForma(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(t);
}

/** La cookie del pedido: sólo para `/compras/<publicId>` (y sus descargas), 30 días. */
export function cookieDePedido(publicId: string, token: string) {
  return {
    name: nombreCookieDePedido(publicId),
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: `/compras/${publicId}`,
    maxAge: COOKIE_PEDIDO_DIAS * 24 * 60 * 60,
  };
}
