/**
 * Módulo PURO (lo usa la pantalla de pago exitoso en el navegador): sin base de datos.
 */

const PREFIJO_PACK = "/cliente/pack/";

/** Ruta relativa del pack con su código personal. */
export function rutaDelPackConCodigo(token: string): string {
  return `${PREFIJO_PACK}${encodeURIComponent(token)}`;
}

/**
 * A dónde mandar a la familia después de un pago aprobado de preventa. Primero el enlace con
 * código, que sirve sin sesión (casi todas compran sin cuenta). Si no vino, el camino de siempre:
 * `/cliente/pack/<id>` (pide sesión) o, con la preventa vieja, la carga de selfies.
 */
export function destinoTrasPagoDePreventa(input: {
  packAccessUrl: unknown;
  preventaUxV2: boolean;
  orderId: string | number | null | undefined;
  selfiesOrderId: string | number;
}): string {
  const enlace = input.packAccessUrl;
  if (
    typeof enlace === "string" &&
    enlace.startsWith(PREFIJO_PACK) &&
    enlace.length > PREFIJO_PACK.length &&
    !enlace.includes("//")
  ) {
    return enlace;
  }
  if (input.preventaUxV2 && input.orderId) return `${PREFIJO_PACK}${input.orderId}`;
  return `/order/${input.selfiesOrderId}/selfies`;
}
