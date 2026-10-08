import { DESIGN_DPI, WINNER_FORMAT_PX, pxToMm, type WinnerFormat } from "./constants";

/**
 * Los diseños base de FotoRank: el diploma y las dos imágenes de ganador.
 *
 * Son el punto de partida, no la pieza final: cada organización los abre en el diseñador y los
 * cambia como quiera. Están escritos como documentos de `@repo/design-studio` (milímetros y
 * puntos tipográficos) y se traducen al modelo del editor al crear la plantilla.
 *
 * Módulo puro.
 */

const GOLD = "#b8892d";
const GOLD_SOFT = "#d4af37";
const INK = "#1c1a17";
const MUTED = "#6b6458";
const CREAM = "#fbf8f1";
const NIGHT = "#0b0b0b";

type Caja = { x: number; y: number; w: number; h: number };

type EstiloTexto = {
  size: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
  font?: string;
  align?: "left" | "center" | "right";
  upper?: boolean;
  lines?: number;
};

/** Bloques en milímetros y puntos: así se escribe el diploma, que es papel. */
function textoMm(id: string, c: Caja, content: string, e: EstiloTexto) {
  return {
    id,
    type: "text",
    x: c.x,
    y: c.y,
    width: c.w,
    height: c.h,
    fontId: e.font ?? "dmSans",
    fontSize: e.size,
    ...(e.bold ? { fontWeight: "bold" } : {}),
    ...(e.italic ? { fontStyle: "italic" } : {}),
    color: e.color,
    align: e.align ?? "center",
    ...(e.upper ? { textTransform: "uppercase" } : {}),
    content,
    maxLines: e.lines ?? 1,
  };
}

function imagenMm(id: string, c: Caja, variableKey: string, fit: "cover" | "contain") {
  return { id, type: "image", x: c.x, y: c.y, width: c.w, height: c.h, variableKey, fit };
}

function rectMm(id: string, c: Caja, estilo: { fill?: string; stroke?: string; strokeWidth?: number }) {
  return {
    id,
    type: "rect",
    x: c.x,
    y: c.y,
    width: c.w,
    height: c.h,
    ...(estilo.fill ? { fillColor: estilo.fill } : {}),
    ...(estilo.stroke ? { strokeColor: estilo.stroke, strokeWidth: estilo.strokeWidth ?? 0.5 } : {}),
  };
}

/** El diploma base: A4 apaisado, marco dorado, QR de verificación abajo a la derecha. */
export function diplomaDesignDocument(): unknown {
  const W = 297;
  const H = 210;
  return {
    schemaVersion: 1,
    metadata: { name: "Diploma", description: "Diseño base de FotoRank, versión 1" },
    format: { medium: "PRINT", width: W, height: H, dpi: DESIGN_DPI, bleedMm: 0, safeAreaMm: 0 },
    sides: [
      {
        id: "diploma",
        name: "Diploma",
        background: CREAM,
        blocks: [
          rectMm("marco", { x: 9, y: 9, w: W - 18, h: H - 18 }, { fill: CREAM, stroke: GOLD, strokeWidth: 1.2 }),
          rectMm("marco-fino", { x: 12.5, y: 12.5, w: W - 25, h: H - 25 }, { fill: CREAM, stroke: GOLD_SOFT, strokeWidth: 0.35 }),
          imagenMm("logo", { x: W / 2 - 12, y: 16, w: 24, h: 24 }, "organizerLogo", "contain"),
          textoMm("organiza", { x: 30, y: 41, w: W - 60, h: 7 }, "{{organizerName}}", {
            size: 10,
            color: MUTED,
            upper: true,
          }),
          textoMm("titulo", { x: 30, y: 51, w: W - 60, h: 20 }, "Diploma", {
            size: 40,
            color: GOLD,
            font: "cinzel",
            bold: true,
            upper: true,
          }),
          textoMm("otorga", { x: 30, y: 75, w: W - 60, h: 9 }, "Se otorga a", {
            size: 14,
            color: MUTED,
            font: "playfairDisplay",
            italic: true,
          }),
          textoMm("premiado", { x: 25, y: 85, w: W - 50, h: 24 }, "{{recipientName}}", {
            size: 40,
            color: INK,
            font: "greatVibes",
          }),
          { id: "separador", type: "line", x: 88, y: 112, width: W - 176, height: 0.6, strokeColor: GOLD, strokeWidth: 0.6 },
          textoMm("premio", { x: 30, y: 117, w: W - 60, h: 10 }, "{{prizeLabel}}", {
            size: 17,
            color: GOLD,
            bold: true,
            upper: true,
          }),
          textoMm("obra", { x: 30, y: 129, w: W - 60, h: 8 }, "por la obra «{{entryTitle}}»", {
            size: 12,
            color: INK,
            font: "playfairDisplay",
            italic: true,
          }),
          textoMm("concurso", { x: 30, y: 139, w: W - 60, h: 9 }, "{{contestTitle}}", {
            size: 14,
            color: INK,
            bold: true,
          }),
          { id: "firma-linea", type: "line", x: 115, y: 178, width: 67, height: 0.6, strokeColor: INK, strokeWidth: 0.3 },
          textoMm("firma", { x: 100, y: 180, w: 97, h: 6 }, "{{organizerName}}", { size: 8, color: MUTED }),
          textoMm("fecha", { x: 22, y: 174, w: 80, h: 6 }, "{{issuedDate}}", { size: 9, color: MUTED, align: "left" }),
          textoMm("codigo", { x: 22, y: 181, w: 80, h: 6 }, "Código {{diplomaCode}}", {
            size: 8,
            color: MUTED,
            align: "left",
          }),
          {
            id: "qr",
            type: "qrcode",
            x: W - 47,
            y: 158,
            width: 25,
            height: 25,
            variableKey: "verificationUrl",
            errorCorrection: "M",
            quietZoneModules: 2,
            darkColor: INK,
            lightColor: CREAM,
          },
          textoMm("verificar", { x: W - 57, y: 184, w: 45, h: 5 }, "Verificá este diploma", {
            size: 6.5,
            color: MUTED,
          }),
        ],
      },
    ],
  };
}

/** Píxeles de la imagen final a milímetros del documento. */
const mm = (px: number) => Math.round(pxToMm(px) * 1000) / 1000;
/** Píxeles de alto de letra a puntos tipográficos, al dpi de diseño. */
const pt = (px: number) => Math.round(((px * 72) / DESIGN_DPI) * 100) / 100;

function texto(id: string, c: Caja, content: string, e: EstiloTexto) {
  return textoMm(id, { x: mm(c.x), y: mm(c.y), w: mm(c.w), h: mm(c.h) }, content, { ...e, size: pt(e.size) });
}

function imagen(id: string, c: Caja, variableKey: string, fit: "cover" | "contain") {
  return imagenMm(id, { x: mm(c.x), y: mm(c.y), w: mm(c.w), h: mm(c.h) }, variableKey, fit);
}

function franja(id: string, c: Caja, fill: string) {
  return rectMm(id, { x: mm(c.x), y: mm(c.y), w: mm(c.w), h: mm(c.h) }, { fill });
}

function ganadorCuadrada() {
  return [
    imagen("obra", { x: 0, y: 0, w: 1080, h: 720 }, "entryImage", "cover"),
    franja("acento", { x: 60, y: 760, w: 120, h: 6 }, GOLD_SOFT),
    texto("premio", { x: 60, y: 785, w: 960, h: 60 }, "{{prizeLabel}} · {{categoryName}}", {
      size: 40,
      color: GOLD_SOFT,
      font: "cinzel",
      bold: true,
      align: "left",
      upper: true,
    }),
    texto("premiado", { x: 60, y: 850, w: 960, h: 75 }, "{{recipientName}}", {
      size: 58,
      color: "#ffffff",
      bold: true,
      align: "left",
    }),
    texto("obra-titulo", { x: 60, y: 930, w: 960, h: 48 }, "«{{entryTitle}}»", {
      size: 32,
      color: "#e9e2d3",
      font: "playfairDisplay",
      italic: true,
      align: "left",
    }),
    imagen("logo", { x: 60, y: 995, w: 64, h: 64 }, "organizerLogo", "contain"),
    texto("concurso", { x: 140, y: 1008, w: 880, h: 40 }, "{{contestTitle}}", {
      size: 24,
      color: "#a39b8b",
      align: "left",
      upper: true,
    }),
  ];
}

function ganadorHistoria() {
  return [
    imagen("logo", { x: 460, y: 110, w: 160, h: 160 }, "organizerLogo", "contain"),
    texto("concurso", { x: 60, y: 290, w: 960, h: 60 }, "{{contestTitle}}", {
      size: 34,
      color: "#e9e2d3",
      bold: true,
      upper: true,
    }),
    imagen("obra", { x: 60, y: 400, w: 960, h: 960 }, "entryImage", "cover"),
    texto("premio", { x: 60, y: 1420, w: 960, h: 80 }, "{{prizeLabel}}", {
      size: 62,
      color: GOLD_SOFT,
      font: "cinzel",
      bold: true,
      upper: true,
    }),
    texto("premiado", { x: 60, y: 1515, w: 960, h: 170 }, "{{recipientName}}", {
      size: 76,
      color: "#ffffff",
      bold: true,
      lines: 2,
    }),
    texto("obra-titulo", { x: 60, y: 1700, w: 960, h: 60 }, "«{{entryTitle}}»", {
      size: 40,
      color: "#e9e2d3",
      font: "playfairDisplay",
      italic: true,
    }),
    texto("categoria", { x: 60, y: 1775, w: 960, h: 50 }, "{{categoryName}}", {
      size: 32,
      color: "#a39b8b",
      upper: true,
    }),
  ];
}

const BLOQUES_GANADOR: Record<WinnerFormat, () => unknown[]> = {
  cuadrada: ganadorCuadrada,
  historia: ganadorHistoria,
};

/** La imagen de ganador base: una sola cara, sin sangrado (es para pantalla, no para papel). */
export function winnerDesignDocument(format: WinnerFormat): unknown {
  const px = WINNER_FORMAT_PX[format];
  return {
    schemaVersion: 1,
    metadata: { name: "Imagen de ganador", description: "Diseño base de FotoRank, versión 1" },
    format: {
      medium: "PRINT",
      width: mm(px.width),
      height: mm(px.height),
      dpi: DESIGN_DPI,
      bleedMm: 0,
      safeAreaMm: 0,
    },
    sides: [{ id: "ganador", name: "Ganador", background: NIGHT, blocks: BLOQUES_GANADOR[format]() }],
  };
}
