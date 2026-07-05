import type { BenefitSelectionMode, BenefitTemplatePolicy, PackBenefitKind } from "@/lib/prisma";
import { formatExtraUnitPriceDashboard } from "@/lib/preventa-canjeable/extra-unit-price-copy";

/** Textos de UI y de términos públicos (sin cambiar enums). */

export function kindLabelEs(kind: PackBenefitKind): string {
  return kind === "DIGITAL" ? "Fotos digitales" : "Producto impreso";
}

export function selectionModeExplainEs(mode: BenefitSelectionMode): string {
  switch (mode) {
    case "SINGLE_PHOTO":
      return "el cliente elige una foto del álbum por cada ítem incluido";
    case "MULTI_PHOTO_FIXED":
      return "el cliente elige una cantidad fija de fotos distintas por ítem (la definís en el pack)";
    case "ALBUM_CHOICE":
      return "el cliente elige del álbum con más libertad; podés poner mínimo y tope por ítem";
    default:
      return "según cómo armaste el pack";
  }
}

export function templatePolicyShortEs(pol: BenefitTemplatePolicy): string {
  switch (pol) {
    case "NONE":
      return "sin plantilla";
    case "REQUIRED":
      return "obligatoria";
    case "OPTIONAL":
      return "opcional";
    default:
      return String(pol);
  }
}

export type BenefitSummaryInput = {
  kind: PackBenefitKind;
  includedQuantity: number;
  selectionMode: BenefitSelectionMode;
  requiredPhotoCount: number;
  maxPhotosPerUnit: number | null;
  templatePolicy: BenefitTemplatePolicy;
  templateName: string | null;
  photographerProductName: string | null;
  extraUnitPriceOverrideArs: number | null;
};

/**
 * Línea corta para el catálogo público de preventa (cliente final).
 * Sin tecnicismos ni referencias a laboratorio/plataforma.
 */
export function buildBenefitPublicShortLine(b: {
  kind: PackBenefitKind;
  includedQuantity: number;
  selectionMode: BenefitSelectionMode;
  requiredPhotoCount: number;
  photographerProductName: string | null;
}): string {
  const iq = b.includedQuantity;
  const rpc = b.requiredPhotoCount;
  const product = b.photographerProductName?.trim();
  if (b.kind === "DIGITAL") {
    if (b.selectionMode === "SINGLE_PHOTO") {
      return `${iq} ${iq === 1 ? "foto digital" : "fotos digitales"} a elección`;
    }
    if (b.selectionMode === "MULTI_PHOTO_FIXED") {
      return `${iq} ${iq === 1 ? "descarga" : "descargas"} (${rpc} ${rpc === 1 ? "foto" : "fotos"} c/u)`;
    }
    return `${iq} ${iq === 1 ? "descarga digital" : "descargas digitales"} a elección`;
  }
  if (product && b.selectionMode === "SINGLE_PHOTO") {
    return `${iq}× ${product}`;
  }
  if (b.selectionMode === "SINGLE_PHOTO") {
    return `${iq} ${iq === 1 ? "impresión" : "impresiones"} a elección`;
  }
  if (b.selectionMode === "MULTI_PHOTO_FIXED") {
    return `${iq} ${iq === 1 ? "impresión" : "impresiones"} (${rpc} fotos c/u)`;
  }
  return `${iq} ${iq === 1 ? "producto impreso" : "productos impresos"} a elección`;
}

/** Una línea corta para el listado del modal (título + cantidad). */
export function buildBenefitListHeadline(b: {
  kind: PackBenefitKind;
  includedQuantity: number;
  selectionMode: BenefitSelectionMode;
  requiredPhotoCount: number;
}): string {
  const iq = b.includedQuantity;
  const rpc = b.requiredPhotoCount;
  if (b.kind === "DIGITAL") {
    if (b.selectionMode === "SINGLE_PHOTO") {
      return `${iq} ${iq === 1 ? "foto digital" : "fotos digitales"}`;
    }
    if (b.selectionMode === "MULTI_PHOTO_FIXED") {
      return `${iq} ${iq === 1 ? "descarga" : "descargas"} · ${rpc} ${rpc === 1 ? "foto" : "fotos"} por descarga`;
    }
    return `${iq} ${iq === 1 ? "descarga digital" : "descargas digitales"} · elección flexible`;
  }
  if (b.selectionMode === "SINGLE_PHOTO") {
    return `${iq} ${iq === 1 ? "impreso" : "impresos"}`;
  }
  if (b.selectionMode === "MULTI_PHOTO_FIXED") {
    return `${iq} ${iq === 1 ? "impresión" : "impresiones"} · ${rpc} fotos c/u`;
  }
  return `${iq} ${iq === 1 ? "producto impreso" : "productos impresos"} · elección flexible`;
}

/** Párrafo largo para el fotógrafo (listado en dashboard y vista previa del formulario). */
export function buildBenefitDashboardSummary(b: BenefitSummaryInput): string {
  const parts: string[] = [];
  const iq = b.includedQuantity;
  const rpc = b.requiredPhotoCount;
  const max = b.maxPhotosPerUnit;

  if (b.kind === "DIGITAL") {
    if (b.selectionMode === "SINGLE_PHOTO") {
      parts.push(
        `Este ítem incluye ${iq} ${iq === 1 ? "foto digital" : "fotos digitales"}. Cuando las fotos estén en el álbum, el cliente podrá elegir ${iq} ${iq === 1 ? "foto" : "fotos"} para descargar.`
      );
    } else if (b.selectionMode === "MULTI_PHOTO_FIXED") {
      parts.push(
        `Este ítem incluye ${iq} ${iq === 1 ? "descarga digital" : "descargas digitales"}. Para obtener ${iq === 1 ? "la descarga" : "cada descarga"}, el cliente elige ${rpc} ${rpc === 1 ? "foto distinta" : "fotos distintas"} del álbum; luego puede descargar los archivos.`
      );
    } else {
      let line = `Este ítem incluye ${iq} ${iq === 1 ? "descarga digital" : "descargas digitales"}. Cuando el álbum esté listo, el cliente elige del álbum las fotos de cada descarga`;
      if (rpc > 1) {
        line += `; en cada descarga hace falta elegir al menos ${rpc} fotos distintas`;
      }
      if (max != null) {
        line += `. Por descarga puede usar hasta ${max} ${max === 1 ? "foto" : "fotos"}`;
      }
      line += ". Después recibe los archivos para descargar.";
      parts.push(line);
    }
  } else {
    if (b.selectionMode === "SINGLE_PHOTO") {
      parts.push(
        `Este ítem incluye ${iq} ${iq === 1 ? "producto impreso" : "productos impresos"}. Cuando las fotos estén en el álbum, el cliente elige una foto por cada uno para armar el pedido.`
      );
    } else if (b.selectionMode === "MULTI_PHOTO_FIXED") {
      parts.push(
        `Este ítem incluye ${iq} ${iq === 1 ? "impresión" : "impresiones"}: en cada una el cliente elige ${rpc} fotos distintas del álbum para armar el pedido.`
      );
    } else {
      let line = `Este ítem incluye ${iq} ${iq === 1 ? "producto impreso" : "productos impresos"}. Cuando el álbum esté listo, el cliente elige fotos del álbum para cada una de las incluidas`;
      if (rpc > 1) {
        line += ` (mínimo ${rpc} distintas por cada una)`;
      }
      if (max != null) {
        line += `, hasta ${max} por cada una`;
      }
      line += ".";
      parts.push(line);
    }

    if (b.photographerProductName) {
      parts.push(`Producto base en el laboratorio: ${b.photographerProductName}.`);
    } else {
      parts.push(`Podés vincular el producto del laboratorio cuando edites el ítem.`);
    }

    if (b.templatePolicy !== "NONE") {
      const pol = templatePolicyShortEs(b.templatePolicy);
      if (b.templateName) {
        parts.push(`Plantilla (${pol}): ${b.templateName}.`);
      } else {
        parts.push(`Plantilla (${pol}).`);
      }
    }
  }

  parts.push(formatExtraUnitPriceDashboard(b.extraUnitPriceOverrideArs));

  return parts.join(" ");
}
