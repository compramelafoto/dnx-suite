import type { ConnectProduct } from "@repo/payments/mercado-pago-connect";

/**
 * Clave de producto en la tabla compartida `DnxMercadoPagoOAuthState`.
 *
 * Nunca la de otro producto: el retorno de una conexión de Subí la Foto no puede
 * completar la de FotoOffice ni al revés, y la tabla es la misma para todos.
 */
export const SUBILAFOTO_PRODUCT_KEY = "subilafoto" as const;

/** Variables de la aplicación de MercadoPago, con la convención `<PRODUCTO>_MP_*`. */
export const SUBILAFOTO_MP_ENV = {
  clientId: "SUBILAFOTO_MP_CLIENT_ID",
  clientSecret: "SUBILAFOTO_MP_CLIENT_SECRET",
  redirectUri: "SUBILAFOTO_MP_REDIRECT_URI",
} as const;

/**
 * Subí la Foto conecta **cobradores**, no receptores de reparto.
 *
 * El modelo es el de dos vías (`marketplace_fee`), igual que CompraMeLaFoto hoy: el
 * vendedor cobra en su cuenta y la plataforma retiene su comisión en la misma operación.
 * Nadie consiente nada porque no hay reparto que consentir.
 *
 * Cuando se habilite el split 1:N habrá que sumar `SPLIT_RECEIVER` y pedir el
 * consentimiento — y recién ahí se encienden los referidos.
 */
export const SUBILAFOTO_PRODUCTO: ConnectProduct = {
  key: SUBILAFOTO_PRODUCT_KEY,
  nombre: "Subí la Foto",
  capabilities: ["COLLECTOR"],
};

const PREFIJO_DE_VENDEDOR = "subilafoto-seller:";

/**
 * Referencia opaca del vendedor dentro de la capa financiera.
 *
 * Con prefijo de producto porque `DnxFinancialIdentity.organizationRef` es único en toda
 * la suite: sin él, el vendedor de Subí la Foto podría chocar con un workspace de
 * FotoOffice que tenga el mismo identificador.
 */
export function referenciaDelVendedor(perfilId: string): string {
  return `${PREFIJO_DE_VENDEDOR}${perfilId}`;
}

/** Inversa. Devuelve `null` si la referencia no es de Subí la Foto. */
export function perfilDesdeReferencia(referencia: string): string | null {
  if (!referencia.startsWith(PREFIJO_DE_VENDEDOR)) return null;
  const id = referencia.slice(PREFIJO_DE_VENDEDOR.length).trim();
  return id || null;
}
