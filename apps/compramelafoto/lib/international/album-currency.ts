import { prisma } from "@/lib/prisma";
import { currencyForCountry } from "./countries";
import { isInternationalEnabled } from "./flag";
import { isIntlPilotUser } from "./pilot";

/**
 * Moneda con la que se crea un álbum nuevo.
 * Con CLF internacional apagado es siempre "ARS" (igual que el valor por defecto de la base),
 * salvo para los fotógrafos del piloto.
 */
export function currencyForNewAlbum(
  ownerCountryCode: string | null,
  enabled: boolean,
  pilot = false,
): string {
  if (!enabled && !pilot) return "ARS";
  return currencyForCountry(ownerCountryCode);
}

/** Moneda del álbum nuevo. Con el interruptor apagado no consulta nada y devuelve "ARS". */
export async function resolveNewAlbumCurrency(userId: number): Promise<string> {
  const enabled = isInternationalEnabled();
  const pilot = isIntlPilotUser(userId);
  if (!enabled && !pilot) return currencyForNewAlbum(null, false);
  const owner = await prisma.user.findUnique({ where: { id: userId }, select: { countryCode: true } });
  return currencyForNewAlbum(owner?.countryCode ?? null, enabled, pilot);
}
