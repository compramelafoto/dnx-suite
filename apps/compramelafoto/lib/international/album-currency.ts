import { prisma } from "@/lib/prisma";
import { currencyForCountry } from "./countries";
import { isInternationalEnabled } from "./flag";

/**
 * Moneda con la que se crea un álbum nuevo.
 * Con CLF internacional apagado es siempre "ARS" (igual que el valor por defecto de la base).
 */
export function currencyForNewAlbum(ownerCountryCode: string | null, enabled: boolean): string {
  if (!enabled) return "ARS";
  return currencyForCountry(ownerCountryCode);
}

/** Moneda del álbum nuevo. Con el interruptor apagado no consulta nada y devuelve "ARS". */
export async function resolveNewAlbumCurrency(userId: number): Promise<string> {
  if (!isInternationalEnabled()) return currencyForNewAlbum(null, false);
  const owner = await prisma.user.findUnique({ where: { id: userId }, select: { countryCode: true } });
  return currencyForNewAlbum(owner?.countryCode ?? null, true);
}
