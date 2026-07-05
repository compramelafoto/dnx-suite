import type { PrintPricingSource } from "@/lib/prisma";
import { totalFromBase } from "@/lib/pricing/fee-formula";
import { resolveClientMarketplaceFeePercent } from "@/lib/pricing/client-price";
import { getPhotographerPricing } from "@/lib/pricing/photographer-pricing";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";

export type PreventaTermsPriceRow = { label: string; value: string; hint?: string };

/**
 * Precios orientativos "fuera del pack de preventa" cuando el cliente compre en el checkout del álbum.
 * Misma lógica base que el flujo de compra (fee sobre base del fotógrafo).
 */
export async function buildPostCheckoutPriceRowsForPreventaTerms(params: {
  photographerId: number | null;
  digitalPhotoPriceCents: number | null;
  enableDigitalPhotos: boolean;
  enablePrintedPhotos: boolean;
  enableFaceBulkPurchase: boolean;
  faceBulkPriceCents: number | null;
  albumProfitMarginPercent: number | null;
  printPricingSource: PrintPricingSource;
  selectedLabId: number | null;
}): Promise<PreventaTermsPriceRow[]> {
  const rows: PreventaTermsPriceRow[] = [];

  const digitalFeePercent = await resolveClientMarketplaceFeePercent({
    photographerId: params.photographerId,
    labId: params.selectedLabId,
  });

  const printPlatformPercent = await resolvePlatformCommissionPercent({
    photographerId: params.photographerId,
    labId: params.selectedLabId,
  });

  if (params.enableDigitalPhotos && params.digitalPhotoPriceCents != null && params.digitalPhotoPriceCents > 0) {
    const clientArs = totalFromBase(Math.round(params.digitalPhotoPriceCents), digitalFeePercent);
    rows.push({
      label: "Foto digital suelta (en el álbum, fuera del pack)",
      value: `$${clientArs.toLocaleString("es-AR")} c/u`,
      hint: "Precio orientativo; el monto final se confirma en el checkout del álbum.",
    });
  }

  if (params.enableFaceBulkPurchase && params.faceBulkPriceCents != null && params.faceBulkPriceCents > 0) {
    const clientArs = totalFromBase(Math.round(params.faceBulkPriceCents), digitalFeePercent);
    rows.push({
      label: "Pack «todas las fotos donde aparecés» (si el fotógrafo lo ofrece)",
      value: `$${clientArs.toLocaleString("es-AR")}`,
      hint: "Precio orientativo al cliente en el checkout del álbum.",
    });
  }

  if (params.enablePrintedPhotos) {
    if (params.printPricingSource === "PHOTOGRAPHER" && params.photographerId) {
      const pricing = await getPhotographerPricing(params.photographerId);
      const margin = (params.albumProfitMarginPercent ?? 0) / 100;
      const samples: { label: string; clientArs: number }[] = [];
      for (const p of pricing.products) {
        const base = Number((p as { retailPrice?: number }).retailPrice ?? 0);
        if (!Number.isFinite(base) || base <= 0) continue;
        const withMargin = Math.round(base * (1 + margin));
        const clientArs = totalFromBase(withMargin, printPlatformPercent);
        const name = (p as { name?: string; size?: string | null }).name ?? "Producto";
        const size = (p as { size?: string | null }).size;
        samples.push({
          label: `${name}${size ? ` · ${size}` : ""}`,
          clientArs,
        });
      }
      samples.sort((a, b) => a.clientArs - b.clientArs);
      if (samples.length > 0) {
        const top = samples.slice(0, 6);
        rows.push({
          label: "Impresiones (ejemplos del catálogo del fotógrafo)",
          value: `desde $${top[0].clientArs.toLocaleString("es-AR")} c/u`,
          hint: top.map((t) => `${t.label}: $${t.clientArs.toLocaleString("es-AR")}`).join(" · "),
        });
      } else {
        rows.push({
          label: "Impresiones",
          value: "Ver tamaños y precios en la compra del álbum",
          hint: "El fotógrafo puede cargar productos en su lista de precios.",
        });
      }
    } else {
      rows.push({
        label: "Impresiones",
        value: "Se cotizan en el checkout del álbum",
        hint:
          params.printPricingSource === "LAB_PREFERRED"
            ? "Precios según laboratorio y productos; el total se ve al comprar en el álbum."
            : "Los montos dependen del catálogo configurado para este álbum.",
      });
    }
  }

  return rows;
}
