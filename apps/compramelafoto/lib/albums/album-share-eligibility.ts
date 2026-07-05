import {
  ALBUM_SALES_GAP_LABELS,
  evaluateAlbumSalesReadiness,
  type AlbumSalesReadinessInput,
  type AlbumSalesReadinessResult,
} from "@/lib/albums/album-sales-readiness";

export type AlbumShareEligibilityInput = AlbumSalesReadinessInput & {
  mpConnected: boolean | null;
  isTest?: boolean;
  photoCount?: number;
};

export type AlbumShareEligibilityResult = {
  canShare: boolean;
  blockReasons: string[];
  /** Avisos que no bloquean compartir (p. ej. galería “próximamente” sin fotos). */
  shareWarnings: string[];
  salesReadiness: AlbumSalesReadinessResult;
};

/**
 * El álbum puede compartirse cuando hay cobros habilitados (MP + términos) y al menos
 * un canal de venta listo (digital y/o impresiones). Sin fotos se permite el enlace
 * (la landing muestra aviso hasta que haya contenido).
 */
export function evaluateAlbumShareEligibility(
  input: AlbumShareEligibilityInput
): AlbumShareEligibilityResult {
  const salesReadiness = evaluateAlbumSalesReadiness(input);
  const blockReasons: string[] = [];
  const shareWarnings: string[] = [];

  if (input.isTest) {
    blockReasons.push("Desactivá el modo prueba antes de compartir con clientes.");
  }
  if (input.mpConnected === false) {
    blockReasons.push("Conectá Mercado Pago para cobrar ventas.");
  } else if (input.mpConnected === null) {
    blockReasons.push("Estamos verificando tu cuenta de Mercado Pago…");
  }

  if (!salesReadiness.termsOk) {
    const label = ALBUM_SALES_GAP_LABELS.terms;
    if (!blockReasons.includes(label)) blockReasons.push(label);
  }

  if (!salesReadiness.hasAnySaleChannel) {
    const label = ALBUM_SALES_GAP_LABELS.active_product;
    if (!blockReasons.includes(label)) blockReasons.push(label);
  } else {
    const hasReadyChannel =
      (salesReadiness.enableDigital && salesReadiness.digitalReady) ||
      (salesReadiness.enablePrinted && salesReadiness.printsReady);

    if (!hasReadyChannel) {
      if (salesReadiness.enableDigital && !salesReadiness.digitalReady) {
        const label = ALBUM_SALES_GAP_LABELS.digital_price;
        if (!blockReasons.includes(label)) blockReasons.push(label);
      }
      if (salesReadiness.enablePrinted && !salesReadiness.printsReady) {
        const label = ALBUM_SALES_GAP_LABELS.prints;
        if (!blockReasons.includes(label)) blockReasons.push(label);
      }
    }
  }

  if ((input.photoCount ?? 0) < 1) {
    shareWarnings.push(
      "Todavía no hay fotos publicadas: el enlace abrirá la galería con un aviso hasta que subas contenido."
    );
  }

  return {
    canShare: blockReasons.length === 0,
    blockReasons,
    shareWarnings,
    salesReadiness,
  };
}
