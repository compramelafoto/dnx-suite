import { createPackAccessTokenForOrder } from "./pack-access-tokens";
import { rutaDelPackConCodigo } from "./destino-pago-exitoso";

/**
 * Enlace personal del pack de preventa para la pantalla de pago exitoso (sólo servidor).
 *
 * La familia casi siempre paga sin cuenta: `/cliente/pack/<número>` pide sesión y le mostraba
 * "Error: No autenticado". Con el código del pack (`/cliente/pack/<token>`) entra sin sesión,
 * igual que desde el comprobante. NO anula los enlaces anteriores: el del correo sigue andando.
 *
 * Devuelve null si el pedido no es un pack de preventa pagado o si algo falla (la pantalla
 * entonces sigue con su camino de siempre). Nunca rompe la confirmación del pago.
 */
export async function enlaceDelPackParaPagoExitoso(orderId: number): Promise<string | null> {
  try {
    const creado = await createPackAccessTokenForOrder(orderId, { revokeExisting: false });
    return creado ? rutaDelPackConCodigo(creado.token) : null;
  } catch (err) {
    console.error("[mp-confirm] no se pudo crear el enlace del pack", { orderId, err: String(err) });
    return null;
  }
}
