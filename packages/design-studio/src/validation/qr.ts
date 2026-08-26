import QRCode from "qrcode";
import { ptToMm, ptToPx } from "../document/units";
import type { DesignMedium } from "../document/schema";

/**
 * Piso de tamaño de módulo para impresión comercial leída con teléfonos. Por debajo, la
 * lectura empieza a depender de la impresora y de la luz.
 */
export const MIN_MODULE_MM = 0.5;
/** Por debajo de esto conviene avisar aunque técnicamente entre. */
export const WARN_MODULE_MM = 0.65;
/** En pantalla el límite lo pone el píxel, no la tinta. */
export const MIN_MODULE_PX = 2;
export const WARN_MODULE_PX = 3;

export type QrLegibilityLevel = "OK" | "WARNING" | "BLOCKS_PUBLISH" | "INVALID";

export type QrLegibility = {
  level: QrLegibilityLevel;
  message: string;
  /** Versión del QR: 1 a 40. Más versión, más módulos. */
  version?: number;
  /** Módulos por lado, sin contar la zona de silencio. */
  modules?: number;
  moduleSizeMm?: number;
  moduleSizePx?: number;
};

export type QrLegibilityInput = {
  payload: string;
  errorCorrection: "L" | "M" | "Q" | "H";
  quietZoneModules: number;
  /** Lado del cuadrado en puntos PDF. */
  sidePt: number;
  medium: DesignMedium;
  dpi: number;
};

export function evaluateQrLegibility(input: QrLegibilityInput): QrLegibility {
  if (input.payload.trim() === "") {
    return { level: "INVALID", message: "El código QR no tiene contenido." };
  }

  let version: number;
  let modules: number;
  try {
    const qr = QRCode.create(input.payload, { errorCorrectionLevel: input.errorCorrection });
    version = qr.version;
    modules = qr.modules.size;
  } catch (e) {
    return {
      level: "INVALID",
      message: `El contenido no entra en un código QR: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const total = modules + input.quietZoneModules * 2;

  if (input.medium === "SCREEN") {
    const moduleSizePx = ptToPx(input.sidePt, input.dpi) / total;
    if (moduleSizePx < MIN_MODULE_PX) {
      return {
        level: "BLOCKS_PUBLISH",
        message: `El código QR queda muy chico: cada módulo mediría ${moduleSizePx.toFixed(2)} píxeles y el mínimo es ${MIN_MODULE_PX}. Agrandalo o acortá el contenido.`,
        version,
        modules,
        moduleSizePx,
      };
    }
    if (moduleSizePx < WARN_MODULE_PX) {
      return {
        level: "WARNING",
        message: `El código QR entra justo: cada módulo mide ${moduleSizePx.toFixed(2)} píxeles. Va a leerse, pero con poco margen.`,
        version,
        modules,
        moduleSizePx,
      };
    }
    return {
      level: "OK",
      message: "El código QR se lee bien en pantalla.",
      version,
      modules,
      moduleSizePx,
    };
  }

  const moduleSizeMm = ptToMm(input.sidePt) / total;
  if (moduleSizeMm < MIN_MODULE_MM) {
    return {
      level: "BLOCKS_PUBLISH",
      message: `El código QR queda muy chico para imprimir: cada módulo mediría ${moduleSizeMm.toFixed(2)} mm y el mínimo es ${MIN_MODULE_MM} mm. Agrandalo o acortá el contenido.`,
      version,
      modules,
      moduleSizeMm,
    };
  }
  if (moduleSizeMm < WARN_MODULE_MM) {
    return {
      level: "WARNING",
      message: `El código QR va a leerse en pantalla, pero impreso es riesgoso: cada módulo mide ${moduleSizeMm.toFixed(2)} mm.`,
      version,
      modules,
      moduleSizeMm,
    };
  }
  return {
    level: "OK",
    message: "El código QR es legible impreso.",
    version,
    modules,
    moduleSizeMm,
  };
}
