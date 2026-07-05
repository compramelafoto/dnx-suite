import type { CuantoCobroProfileInput } from "@/lib/cuantocobro/types";
import {
  fetchFinancialProfileFromApi,
  saveFinancialProfileToApi,
} from "@/lib/cuantocobro/storage/financial-profile-api-client";

/**
 * Integración con datos compartidos de ComprameLaFoto (sin CRM propio en ¿Cuánto Cobro?).
 *
 * | Dato              | Sprint actual              | Futuro                                      |
 * |-------------------|----------------------------|---------------------------------------------|
 * | Perfil empresa    | localStorage + seed CLF    | GET/PUT /api/cuantocobro/business-profile   |
 * | Clientes          | texto libre en quote.client| GET /api/fotografo/clientes (existente CLF) |
 * | Presupuestos      | sessionStorage wizard      | POST /api/cuantocobro/quotes                |
 */

/**
 * GET /api/cuantocobro/profile
 * Carga el perfil persistido del fotógrafo logueado.
 */
export async function fetchCuantoCobroProfile(): Promise<CuantoCobroProfileInput | null> {
  return fetchFinancialProfileFromApi();
}

/**
 * PUT /api/cuantocobro/profile
 * Guarda el perfil del fotógrafo logueado.
 */
export async function saveCuantoCobroProfileRemote(
  profile: CuantoCobroProfileInput,
): Promise<{ ok: boolean }> {
  const ok = await saveFinancialProfileToApi(profile);
  return { ok };
}

/**
 * Futuro: POST /api/cuantocobro/quotes
 * Guarda un presupuesto / cotización del evento.
 */
export async function saveCuantoCobroQuoteRemote(
  input: Parameters<typeof import("@/lib/cuantocobro/quote/quote-api-client").saveCuantoCobroQuote>[0],
): Promise<{ ok: boolean; id?: number; quoteNumber?: string }> {
  const quote = await import("@/lib/cuantocobro/quote/quote-api-client").then((m) => m.saveCuantoCobroQuote(input));
  return { ok: true, id: quote.id, quoteNumber: quote.quoteNumber };
}

/** Cliente agregado desde el listado CLF (futuro picker en paso Cliente). */
export type ClfPhotographerClientRow = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

/**
 * Futuro sprint clientes: listado compartido con ComprameLaFoto.
 * Reutilizar GET /api/fotografo/clientes?photographerId=… (no crear tabla ni CRM en CC).
 * El bloque `quote.client` seguirá siendo el snapshot del presupuesto actual.
 */
export async function fetchClfPhotographerClients(
  _photographerId: number,
  _search?: string,
): Promise<ClfPhotographerClientRow[]> {
  // TODO: conectar picker del paso Cliente con /api/fotografo/clientes.
  return [];
}
