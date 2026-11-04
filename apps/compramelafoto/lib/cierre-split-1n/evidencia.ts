import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export type EvidenciaCierre = {
  providerOrderId: string;
  externalReference: string;
  status: string;
  statusDetail: string | null;
  liveMode: boolean | null;
  totalMinor: string;
  currency: "ARS";
  receptores: number;
  repartoBps: Record<string, number>;
  splitSumValid: boolean;
  deviceSessionIdLength: number;
  creadoEn: string;
};

function directorio(): string {
  // apps/compramelafoto → raíz del monorepo
  return resolve(process.cwd(), "../../.local/cierre-split-1n");
}

/**
 * Guarda el comprobante de la orden de cierre.
 *
 * A diferencia de la evidencia de homologación, acá el `providerOrderId` se guarda
 * **entero**: es el dato que hay que mandarle a Mercado Pago para cerrar el expediente, y
 * un prefijo no sirve. No contiene tokens, ni datos de la tarjeta, ni correos.
 *
 * Si falla la escritura no se interrumpe nada: la orden ya está creada y el Order ID
 * también vuelve por pantalla. Perder el archivo es molesto, perder el cobro sería peor.
 */
export function escribirEvidenciaCierre(evidencia: EvidenciaCierre): string | null {
  try {
    const dir = directorio();
    mkdirSync(dir, { recursive: true });
    const destino = resolve(dir, `orden-${Date.now()}.json`);
    writeFileSync(destino, JSON.stringify(evidencia, null, 2));
    writeFileSync(resolve(dir, "ultima.json"), JSON.stringify(evidencia, null, 2));
    return destino;
  } catch {
    return null;
  }
}
