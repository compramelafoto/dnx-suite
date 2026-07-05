/** Ruta principal (centro de trabajo) de ¿Cuánto Cobro? */
export const CC_APP_PATH = "/cuantocobro/app" as const;

/** Wizard de cotización */
export const CC_COTIZAR_PATH = "/cuantocobro/app/cotizar" as const;

export const CC_PRODUCT_KEY = "cuantocobro" as const;

export function getCuantoCobroLoginUrl(redirect: string = CC_APP_PATH): string {
  return `/cuantocobro/login?redirect=${encodeURIComponent(redirect)}`;
}

export function getCuantoCobroRegisterUrl(): string {
  return `/registro?redirect=${encodeURIComponent(CC_APP_PATH)}&product=${CC_PRODUCT_KEY}`;
}

export function isCuantoCobroRedirectPath(path: string): boolean {
  return path === CC_APP_PATH || path.startsWith(`${CC_APP_PATH}/`);
}

export function getCuantoCobroCotizarUrl(params?: { consultaId?: number; quoteId?: number }): string {
  if (!params?.consultaId && !params?.quoteId) return CC_COTIZAR_PATH;
  const search = new URLSearchParams();
  if (params.consultaId) search.set("consultaId", String(params.consultaId));
  if (params.quoteId) search.set("quoteId", String(params.quoteId));
  return `${CC_COTIZAR_PATH}?${search.toString()}`;
}

export function getCuantoCobroPresupuestoUrl(quoteId?: number): string {
  if (!quoteId) return `${CC_APP_PATH}/presupuestos`;
  return `${CC_APP_PATH}/presupuestos?quoteId=${quoteId}`;
}
