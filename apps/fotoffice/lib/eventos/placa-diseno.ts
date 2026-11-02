/**
 * El diseño base de la placa de bienvenida de un evento. Módulo PURO (lo usa la prueba).
 *
 * Como en las placas de Comunicación (`lib/placas/designs.ts`): se escribe en píxeles de la placa
 * final (1080 × 1080) y se pasa a los milímetros del documento con el mismo dpi con el que después
 * se rasteriza, así lo que acá mide 300 px sale de 300 px en el PNG. Fondo negro con dorado, como el
 * diploma; desde el diseñador se cambia todo.
 */

export const PLACA_EVENTO_DPI = 300;
export const PLACA_EVENTO_PX = { width: 1080, height: 1080 };

const NEGRO = "#0b0c0c";
const ORO = "#c9a24a";
const CREMA = "#f3ead2";

const mm = (px: number) => Math.round(((px * 25.4) / PLACA_EVENTO_DPI) * 1000) / 1000;
const pt = (px: number) => Math.round(((px * 72) / PLACA_EVENTO_DPI) * 100) / 100;

type Caja = { x: number; y: number; w: number; h: number };

function texto(
  id: string,
  caja: Caja,
  content: string,
  estilo: { size: number; color: string; font?: string; bold?: boolean; upper?: boolean; lines?: number },
) {
  return {
    id,
    type: "text",
    x: mm(caja.x),
    y: mm(caja.y),
    width: mm(caja.w),
    height: mm(caja.h),
    fontId: estilo.font ?? "dmSans",
    fontSize: pt(estilo.size),
    ...(estilo.bold ? { fontWeight: "bold" } : {}),
    color: estilo.color,
    align: "center",
    ...(estilo.upper ? { textTransform: "uppercase" } : {}),
    content,
    maxLines: estilo.lines ?? 1,
  };
}

export function placaEventoDesignDocument(): unknown {
  return {
    schemaVersion: 1,
    metadata: { name: "Placa de bienvenida", description: "Diseño base de FOTOFFICE para eventos, versión 1" },
    format: {
      medium: "PRINT",
      width: mm(PLACA_EVENTO_PX.width),
      height: mm(PLACA_EVENTO_PX.height),
      dpi: PLACA_EVENTO_DPI,
      bleedMm: 0,
      safeAreaMm: 0,
    },
    sides: [
      {
        id: "placa",
        name: "Placa",
        background: NEGRO,
        blocks: [
          { id: "marco", type: "rect", x: mm(30), y: mm(30), width: mm(1020), height: mm(1020), strokeColor: ORO, strokeWidth: 0.5 },
          {
            id: "logo",
            type: "image",
            x: mm(390),
            y: mm(60),
            width: mm(300),
            height: mm(120),
            variableKey: "institutionLogo",
            fit: "contain",
          },
          texto("titulo", { x: 80, y: 200, w: 920, h: 50 }, "Te damos la bienvenida", { size: 34, color: ORO, font: "cinzel", bold: true, upper: true }),
          // Las iniciales no hacen falta: sin foto el bloque se poda y queda el nombre, que es lo importante.
          { id: "foto", type: "image", x: mm(320), y: mm(270), width: mm(440), height: mm(440), variableKey: "attendeePhoto", fit: "cover", mask: "circle" },
          texto("nombre", { x: 50, y: 730, w: 980, h: 110 }, "{{attendeeName}}", { size: 80, color: ORO, font: "greatVibes" }),
          texto("instagram", { x: 80, y: 845, w: 920, h: 44 }, "{{attendeeInstagram}}", { size: 30, color: CREMA }),
          texto("evento", { x: 80, y: 900, w: 920, h: 60 }, "{{eventName}}", { size: 42, color: CREMA, font: "playfairDisplay", bold: true }),
          texto("cuando", { x: 80, y: 965, w: 920, h: 40 }, "{{eventDate}}", { size: 26, color: ORO }),
        ],
      },
    ],
  };
}
