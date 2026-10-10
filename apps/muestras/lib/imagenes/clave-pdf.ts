/**
 * Claves de los PDF de piezas en R2: `muestras/piezas/<activityId>/<huella>.pdf`. Vive aparte de
 * `r2.ts` para que `entregar.ts` valide antes de armar nada (y para poder probarla sin R2).
 */
export const CLAVE_PDF = /^muestras\/piezas\/[A-Za-z0-9_-]{1,64}\/[a-f0-9]{32}\.pdf$/;

export const clavePdf = (activityId: string, huella: string) => `muestras/piezas/${activityId}/${huella}.pdf`;
