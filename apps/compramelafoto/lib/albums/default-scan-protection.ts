/**
 * Valor inicial de "Protección al ampliar fotos" para un álbum nuevo.
 *
 * Dos reglas, en orden:
 *
 * 1. Si el fotógrafo tiene la marca SCAN_PROTECTION_OFF, sus álbumes nuevos
 *    nacen SIEMPRE sin protección. Es una decisión de cuenta, no del álbum.
 * 2. Si no, el álbum nuevo arranca como el último álbum que creó, así quien
 *    trabaja siempre igual no tiene que destildarla una por una.
 *
 * La marca vive en `User.tags`, el mismo campo que ya usa el login para
 * SECURITY_ALERTS: no hace falta una columna nueva en el schema compartido
 * por las cinco bases de la suite.
 */
export const SCAN_PROTECTION_OFF_TAG = "SCAN_PROTECTION_OFF";

/** Trae el último álbum del fotógrafo con el único dato que hace falta. */
export const LAST_ALBUM_SCAN_PROTECTION_QUERY = {
  orderBy: { id: "desc" },
  select: { scanProtectionEnabled: true },
} as const;

export function photographerForcesScanProtectionOff(
  photographer: { tags?: string[] | null } | null | undefined
): boolean {
  return Boolean(photographer?.tags?.includes(SCAN_PROTECTION_OFF_TAG));
}

export function pickDefaultScanProtectionEnabled(
  photographer: { tags?: string[] | null } | null | undefined,
  lastAlbum: { scanProtectionEnabled?: boolean | null } | null | undefined
): boolean {
  if (photographerForcesScanProtectionOff(photographer)) return false;
  // Sin álbum previo (o sin dato) el álbum nuevo queda protegido: es el valor seguro.
  return lastAlbum?.scanProtectionEnabled ?? true;
}
