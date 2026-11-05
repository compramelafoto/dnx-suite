import { currencyForCountry } from "./countries";

/**
 * Moneda con la que se crea un álbum nuevo.
 * Con CLF internacional apagado es siempre "ARS" (igual que el valor por defecto de la base).
 */
export function currencyForNewAlbum(ownerCountryCode: string | null, enabled: boolean): string {
  if (!enabled) return "ARS";
  return currencyForCountry(ownerCountryCode);
}
