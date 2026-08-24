/**
 * Clave de producto en `DnxMercadoPagoOAuthState.productKey`.
 *
 * Nunca `"clickaton"`: el estado OAuth de una conexión de FotoOffice no puede confundirse
 * con el de otro producto del monorepo, que comparte tabla.
 */
export const FOTOFFICE_PRODUCT_KEY = "fotoffice" as const;

/** Nombres de las variables de entorno de la aplicación de MercadoPago de FotoOffice. */
export const FOTOFFICE_MP_ENV = {
  clientId: "FOTOFFICE_MP_CLIENT_ID",
  clientSecret: "FOTOFFICE_MP_CLIENT_SECRET",
  redirectUri: "FOTOFFICE_MP_REDIRECT_URI",
} as const;

const ORG_REF_PREFIX = "fotoffice-workspace:";

/**
 * Referencia opaca de la institución dentro de la capa financiera.
 *
 * Sigue el formato que el esquema documenta con el ejemplo `lab:123`: prefijo de producto
 * más identificador propio. El prefijo evita que la identidad financiera de un workspace
 * de FotoOffice se confunda con la de un laboratorio o la de Clickatón, que viven en la
 * misma tabla con `organizationRef` único.
 */
export function workspaceOrganizationRef(workspaceId: string): string {
  return `${ORG_REF_PREFIX}${workspaceId}`;
}

/** Inversa de `workspaceOrganizationRef`. Devuelve null si el ref no es de FotoOffice. */
export function parseWorkspaceOrganizationRef(ref: string): string | null {
  if (!ref.startsWith(ORG_REF_PREFIX)) return null;
  const id = ref.slice(ORG_REF_PREFIX.length).trim();
  return id ? id : null;
}
