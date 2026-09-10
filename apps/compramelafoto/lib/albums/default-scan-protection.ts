/**
 * Valor inicial de "Protección al ampliar fotos" para un álbum nuevo.
 *
 * La columna de la base nace en `true`, pero hay fotógrafos que trabajan
 * siempre sin esa protección y no quieren destildarla álbum por álbum. En vez
 * de sumar una preferencia nueva a la cuenta, el álbum nuevo arranca como el
 * último álbum que creó ese mismo fotógrafo.
 */

/** Trae el último álbum del fotógrafo con el único dato que hace falta. */
export const LAST_ALBUM_SCAN_PROTECTION_QUERY = {
  orderBy: { id: "desc" },
  select: { scanProtectionEnabled: true },
} as const;

export function pickDefaultScanProtectionEnabled(
  lastAlbum: { scanProtectionEnabled?: boolean | null } | null | undefined
): boolean {
  // Sin álbum previo (o sin dato) el álbum nuevo queda protegido: es el valor seguro.
  return lastAlbum?.scanProtectionEnabled ?? true;
}
