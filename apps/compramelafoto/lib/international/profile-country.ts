import { getCountry } from "./countries";

export type ProfileCountryResult =
  | { ok: true; countryCode: string | null; countryName: string | null }
  | { ok: false; status: 400 | 409; error: string };

/**
 * Decide si el fotógrafo puede quedar con el país pedido.
 * - Sin país pedido: no cambia nada.
 * - País no soportado: 400.
 * - Cambiar un país ya cargado teniendo álbumes: 409 (lo hace el equipo a mano).
 */
export function resolveProfileCountryUpdate(input: {
  requestedCode: string | undefined;
  currentCode: string | null;
  albumCount: number;
}): ProfileCountryResult {
  const { requestedCode, currentCode, albumCount } = input;

  if (requestedCode === undefined) {
    const current = currentCode ? getCountry(currentCode) : undefined;
    return { ok: true, countryCode: current ? current.code : null, countryName: current ? current.name : null };
  }

  const requested = getCountry(requestedCode);
  if (!requested) return { ok: false, status: 400, error: "País no válido" };

  if (currentCode && currentCode !== requested.code && albumCount > 0) {
    return {
      ok: false,
      status: 409,
      error: "Para cambiar el país con álbumes creados, escribinos y lo hacemos nosotros.",
    };
  }

  return { ok: true, countryCode: requested.code, countryName: requested.name };
}
