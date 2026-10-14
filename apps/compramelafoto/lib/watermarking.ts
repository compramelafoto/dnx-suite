import { sanitizeWatermarkAscii, watermarkTextPath } from "@/lib/images/watermark-svg-font";

export function buildViewerWatermarkText(params: {
  viewerLabel: string;
  albumId: number | null;
  orderId?: number | null;
  timestamp: string;
}) {
  const viewer = params.viewerLabel
    .replace(/[:|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  // Formatear timestamp de forma más legible
  const date = new Date(params.timestamp);
  const dateStr = date.toLocaleDateString("es-AR", { 
    day: "2-digit", 
    month: "2-digit", 
    year: "numeric" 
  });
  const timeStr = date.toLocaleTimeString("es-AR", { 
    hour: "2-digit", 
    minute: "2-digit" 
  });
  
  // Construir texto más legible con información útil
  const parts: string[] = [];
  
  if (params.albumId) {
    parts.push(`Album #${params.albumId}`);
  }
  
  if (params.orderId) {
    parts.push(`Orden #${params.orderId}`);
  }
  
  // Información del visor de forma más legible
  if (viewer.includes("USER:")) {
    const email = viewer.replace("USER:", "").trim();
    parts.push(`Usuario: ${email}`);
  } else if (viewer.includes("VISITANTE:")) {
    const visitorInfo = viewer.replace("VISITANTE:", "").trim();
    parts.push(`Visitante ${visitorInfo}`);
  }
  
  // Fecha y hora
  parts.push(`${dateStr} ${timeStr}`);
  
  return parts.filter(Boolean).join(" - ");
}

/** Texto de marca de agua repetido en varias direcciones */
export const WATERMARK_TILED_TEXT = "Compramelafoto.com - Fotoffice.com";

function resolveDynamicQuantity(params: {
  rotations: number[];
  quantityFactor?: number;
}): { rotations: number[]; lineCount: number; patternSizeMultiplier: number } {
  const factor = params.quantityFactor ?? 1;
  if (factor >= 1) {
    return { rotations: params.rotations, lineCount: 2, patternSizeMultiplier: 1 };
  }
  return {
    rotations: params.rotations.slice(0, Math.max(1, Math.ceil(params.rotations.length * factor))),
    lineCount: Math.max(1, Math.round(2 * factor)),
    patternSizeMultiplier: 1 / factor,
  };
}

export function buildTiledWatermarkSvg(params: {
  width: number;
  height: number;
  text: string;
  opacity: number;
  fontSize: number;
  rotationDeg?: number;
  /** Rotaciones adicionales para repetir el texto en varias direcciones (grados) */
  rotations?: number[];
  /** 0.7 = ~30 % menos densidad (menos capas, patrón más espaciado). */
  quantityFactor?: number;
  centerText?: string;
  blurStdDev?: number;
  blurDx?: number;
  blurDy?: number;
}) {
  const { width, height, text, opacity, fontSize } = params;
  // En trazos el texto no pasa por XML: se dibuja tal cual, sólo con caracteres imprimibles.
  const patternText = sanitizeWatermarkAscii(text);
  const baseRotations = params.rotations ?? [0, -30, 30, -60];
  const quantity = resolveDynamicQuantity({
    rotations: baseRotations,
    quantityFactor: params.quantityFactor,
  });
  const lineCount = quantity.lineCount;
  const baseLineSpacing = fontSize * 1.2;
  const lineSpacing = Math.max(10, Math.floor(baseLineSpacing * 0.75));
  const patternSize = Math.max(
    220,
    Math.floor(lineSpacing * lineCount * 2 * quantity.patternSizeMultiplier)
  );
  const textX = Math.floor(patternSize * 0.05);
  const textY = Math.floor(fontSize * 1.2);
  const centerFontSize = Math.max(fontSize + 6, Math.floor(Math.min(width, height) / 14));
  const scaledCenterFontSize = Math.max(16, Math.floor(centerFontSize * 0.8));
  const blurStdDev = params.blurStdDev ?? 0;
  const blurDx = params.blurDx ?? 0;
  const blurDy = params.blurDy ?? 0;

  const rotations = quantity.rotations;

  const strokeWidth = Math.max(1, Math.floor(fontSize * 0.06));
  const strokeOpacity = Math.min(0.35, opacity);

  const singlePatternContent = Array.from({ length: lineCount }).map((_, i) => {
    const y = textY + i * lineSpacing;
    return `
              ${watermarkTextPath({
                text: patternText,
                fontSize,
                x: textX,
                y,
                attrs: `fill="white" fill-opacity="${opacity}" stroke="black" stroke-width="${strokeWidth}" stroke-opacity="${strokeOpacity}" paint-order="stroke fill"${blurStdDev > 0 ? ' filter="url(#wm-blur)"' : ""}`,
              })}
            `;
  }).join("");

  const patterns = rotations.map((rot, idx) =>
    `<pattern id="wm-${idx}" patternUnits="userSpaceOnUse" width="${patternSize}" height="${patternSize}" patternTransform="rotate(${rot})">
          ${singlePatternContent}
        </pattern>`
  ).join("\n        ");

  const rects = rotations.map((_, idx) => `<rect width="100%" height="100%" fill="url(#wm-${idx})" />`).join("\n      ");

  const centerText = params.centerText ? sanitizeWatermarkAscii(params.centerText) : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        ${blurStdDev > 0 ? `
          <filter id="wm-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="${blurStdDev}" />
            ${blurDx !== 0 || blurDy !== 0 ? `<feOffset dx="${blurDx}" dy="${blurDy}" />` : ""}
          </filter>
        ` : ""}
        ${patterns}
      </defs>
      ${rects}
      ${centerText ? `
        ${watermarkTextPath({
          text: centerText,
          fontSize: scaledCenterFontSize,
          x: width / 2,
          y: height / 2,
          anchor: "middle",
          baseline: "middle",
          attrs: `fill="white" fill-opacity="1" stroke="black" stroke-width="${Math.max(2, Math.floor(centerFontSize * 0.08))}" stroke-opacity="0.7" paint-order="stroke fill"`,
        })}
      ` : ""}
    </svg>
  `;

  return Buffer.from(svg, "utf8");
}
