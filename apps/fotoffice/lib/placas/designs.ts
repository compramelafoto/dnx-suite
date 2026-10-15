import {
  PLACA_DPI,
  PLACA_FORMAT_PX,
  PLACA_KIND_LABEL,
  pxToMm,
  type PlacaFormat,
  type PlacaKind,
} from "./constants";

/**
 * Los diseños base de las placas.
 *
 * Son el punto de partida, no la placa: Comunicación los trae al diseñador y desde ahí los
 * cambia como quiera. Mientras no lo haga, la placa sale con este diseño, así nadie se queda sin
 * placa por no haber pasado por el editor.
 *
 * Se escriben en píxeles de la placa final (1080 de ancho) y se convierten a los milímetros del
 * documento con el mismo dpi con el que después se rasteriza: así lo que acá mide 300 px sale de
 * 300 px en el PNG. Los cuerpos tipográficos van en puntos, como pide el documento.
 */

const TEAL = "#0f3d3d";
const GOLD = "#e8b04a";
const CREAM = "#f6f1e7";
const INK = "#1f2937";
const MUTED = "#5b6b6b";

/** Píxeles de la placa a milímetros del documento. */
const mm = (px: number) => Math.round(pxToMm(px) * 1000) / 1000;
/** Píxeles de alto de letra a puntos tipográficos, al dpi de las placas. */
const pt = (px: number) => Math.round(((px * 72) / PLACA_DPI) * 100) / 100;

type Caja = { x: number; y: number; w: number; h: number };

function texto(
  id: string,
  caja: Caja,
  content: string,
  estilo: {
    size: number;
    color: string;
    bold?: boolean;
    italic?: boolean;
    font?: string;
    align?: "left" | "center" | "right";
    upper?: boolean;
    lines?: number;
  },
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
    ...(estilo.italic ? { fontStyle: "italic" } : {}),
    color: estilo.color,
    align: estilo.align ?? "center",
    ...(estilo.upper ? { textTransform: "uppercase" } : {}),
    content,
    maxLines: estilo.lines ?? 1,
  };
}

function rect(id: string, caja: Caja, fillColor: string, radioPx = 0) {
  return {
    id,
    type: "rect",
    x: mm(caja.x),
    y: mm(caja.y),
    width: mm(caja.w),
    height: mm(caja.h),
    fillColor,
    ...(radioPx ? { cornerRadius: mm(radioPx) } : {}),
  };
}

function imagen(
  id: string,
  caja: Caja,
  variableKey: string,
  opciones: { fit?: "cover" | "contain"; mask?: "rect" | "circle"; radioPx?: number } = {},
) {
  return {
    id,
    type: "image",
    x: mm(caja.x),
    y: mm(caja.y),
    width: mm(caja.w),
    height: mm(caja.h),
    variableKey,
    fit: opciones.fit ?? "cover",
    ...(opciones.mask ? { mask: opciones.mask } : {}),
    ...(opciones.radioPx ? { cornerRadius: mm(opciones.radioPx) } : {}),
  };
}

/**
 * La foto de perfil en un círculo, con las iniciales detrás.
 *
 * Las iniciales van debajo y la foto encima: si el socio no tiene foto, el bloque de imagen no
 * se dibuja y quedan a la vista. Una placa de bienvenida con un hueco en el medio sería peor que
 * no tener placa.
 *
 * Sin un círculo de fondo detrás de las iniciales: el módulo de diseño todavía no dibuja las
 * esquinas redondeadas de un rectángulo (el editor sí las muestra), y un cuadrado sólido detrás
 * de una foto circular se ve como un error.
 */
function retrato(prefijo: string, caja: Caja, colorLetra: string) {
  return [
    texto(
      `${prefijo}-iniciales`,
      { x: caja.x, y: caja.y + caja.h * 0.3, w: caja.w, h: caja.h * 0.4 },
      "{{initials}}",
      { size: caja.w * 0.36, color: colorLetra, bold: true, font: "playfairDisplay" },
    ),
    imagen(`${prefijo}-foto`, caja, "profilePhoto", { mask: "circle" }),
  ];
}

function bienvenidaCuadrada() {
  return [
    imagen("logo", { x: 80, y: 70, w: 130, h: 130 }, "institutionLogo", { fit: "contain" }),
    texto("institucion", { x: 230, y: 108, w: 770, h: 56 }, "{{institutionName}}", {
      size: 30,
      color: CREAM,
      bold: true,
      align: "left",
      upper: true,
    }),
    texto("titulo", { x: 80, y: 270, w: 920, h: 70 }, "Damos la bienvenida a", {
      size: 46,
      color: GOLD,
      font: "playfairDisplay",
      italic: true,
    }),
    ...retrato("retrato", { x: 390, y: 380, w: 300, h: 300 }, GOLD),
    texto("nombre", { x: 60, y: 715, w: 960, h: 150 }, "{{fullName}}", {
      size: 64,
      color: "#ffffff",
      bold: true,
      lines: 2,
    }),
    texto("especialidad", { x: 80, y: 880, w: 920, h: 48 }, "{{specialty}}", {
      size: 32,
      color: CREAM,
    }),
    texto("zona", { x: 80, y: 932, w: 920, h: 44 }, "{{zone}}", { size: 28, color: "#9fc1bd" }),
    texto("instagram", { x: 80, y: 990, w: 920, h: 44 }, "{{instagramHandle}}", {
      size: 28,
      color: GOLD,
      bold: true,
    }),
  ];
}

function bienvenidaHistoria() {
  return [
    imagen("logo", { x: 415, y: 160, w: 250, h: 250 }, "institutionLogo", { fit: "contain" }),
    texto("institucion", { x: 80, y: 440, w: 920, h: 60 }, "{{institutionName}}", {
      size: 32,
      color: CREAM,
      bold: true,
      upper: true,
    }),
    texto("titulo", { x: 80, y: 600, w: 920, h: 90 }, "Damos la bienvenida a", {
      size: 60,
      color: GOLD,
      font: "playfairDisplay",
      italic: true,
    }),
    ...retrato("retrato", { x: 300, y: 740, w: 480, h: 480 }, GOLD),
    texto("nombre", { x: 60, y: 1290, w: 960, h: 190 }, "{{fullName}}", {
      size: 80,
      color: "#ffffff",
      bold: true,
      lines: 2,
    }),
    texto("especialidad", { x: 80, y: 1500, w: 920, h: 60 }, "{{specialty}}", {
      size: 40,
      color: CREAM,
    }),
    texto("zona", { x: 80, y: 1570, w: 920, h: 54 }, "{{zone}}", { size: 34, color: "#9fc1bd" }),
    texto("instagram", { x: 80, y: 1660, w: 920, h: 54 }, "{{instagramHandle}}", {
      size: 36,
      color: GOLD,
      bold: true,
    }),
  ];
}

function semanaCuadrada() {
  return [
    rect("banda", { x: 0, y: 0, w: 1080, h: 150 }, TEAL),
    texto("titulo", { x: 60, y: 28, w: 960, h: 62 }, "Socio de la semana", {
      size: 46,
      color: GOLD,
      bold: true,
      upper: true,
    }),
    texto("institucion", { x: 60, y: 94, w: 960, h: 40 }, "{{institutionName}}", {
      size: 24,
      color: CREAM,
    }),
    ...retrato("retrato", { x: 70, y: 200, w: 360, h: 360 }, TEAL),
    texto("nombre", { x: 470, y: 230, w: 560, h: 140 }, "{{fullName}}", {
      size: 52,
      color: TEAL,
      bold: true,
      align: "left",
      lines: 2,
    }),
    texto("especialidad", { x: 470, y: 390, w: 560, h: 46 }, "{{specialty}}", {
      size: 30,
      color: INK,
      align: "left",
    }),
    texto("zona", { x: 470, y: 440, w: 560, h: 42 }, "{{zone}}", {
      size: 28,
      color: MUTED,
      align: "left",
    }),
    texto("instagram", { x: 470, y: 494, w: 560, h: 42 }, "{{instagramHandle}}", {
      size: 28,
      color: TEAL,
      bold: true,
      align: "left",
    }),
    imagen("destacada-1", { x: 60, y: 610, w: 300, h: 300 }, "featuredPhoto1", { radioPx: 18 }),
    imagen("destacada-2", { x: 390, y: 610, w: 300, h: 300 }, "featuredPhoto2", { radioPx: 18 }),
    imagen("destacada-3", { x: 720, y: 610, w: 300, h: 300 }, "featuredPhoto3", { radioPx: 18 }),
    texto("frase", { x: 80, y: 945, w: 920, h: 100 }, "{{aboutPhrase}}", {
      size: 28,
      color: INK,
      italic: true,
      font: "playfairDisplay",
      lines: 2,
    }),
  ];
}

function semanaHistoria() {
  return [
    rect("banda", { x: 0, y: 0, w: 1080, h: 260 }, TEAL),
    texto("titulo", { x: 60, y: 90, w: 960, h: 80 }, "Socio de la semana", {
      size: 60,
      color: GOLD,
      bold: true,
      upper: true,
    }),
    texto("institucion", { x: 60, y: 178, w: 960, h: 48 }, "{{institutionName}}", {
      size: 30,
      color: CREAM,
    }),
    ...retrato("retrato", { x: 290, y: 330, w: 500, h: 500 }, TEAL),
    texto("nombre", { x: 60, y: 880, w: 960, h: 190 }, "{{fullName}}", {
      size: 76,
      color: TEAL,
      bold: true,
      lines: 2,
    }),
    texto("especialidad", { x: 80, y: 1085, w: 920, h: 56 }, "{{specialty}}", {
      size: 36,
      color: INK,
    }),
    texto("zona", { x: 80, y: 1145, w: 920, h: 50 }, "{{zone}}", { size: 32, color: MUTED }),
    texto("instagram", { x: 80, y: 1205, w: 920, h: 50 }, "{{instagramHandle}}", {
      size: 34,
      color: TEAL,
      bold: true,
    }),
    imagen("destacada-1", { x: 60, y: 1310, w: 300, h: 300 }, "featuredPhoto1", { radioPx: 18 }),
    imagen("destacada-2", { x: 390, y: 1310, w: 300, h: 300 }, "featuredPhoto2", { radioPx: 18 }),
    imagen("destacada-3", { x: 720, y: 1310, w: 300, h: 300 }, "featuredPhoto3", { radioPx: 18 }),
    texto("frase", { x: 80, y: 1660, w: 920, h: 150 }, "{{aboutPhrase}}", {
      size: 36,
      color: INK,
      italic: true,
      font: "playfairDisplay",
      lines: 3,
    }),
  ];
}

const BLOQUES: Record<PlacaKind, Record<PlacaFormat, () => unknown[]>> = {
  bienvenida: { cuadrada: bienvenidaCuadrada, historia: bienvenidaHistoria },
  "socio-semana": { cuadrada: semanaCuadrada, historia: semanaHistoria },
};

const FONDO: Record<PlacaKind, string> = {
  bienvenida: TEAL,
  "socio-semana": CREAM,
};

/**
 * El documento base de una placa: una sola cara, sin sangrado ni margen de imprenta. Una placa
 * es para pantalla; el sangrado agregaría un borde que Instagram recortaría a ciegas.
 */
export function placaDesignDocument(kind: PlacaKind, format: PlacaFormat): unknown {
  const px = PLACA_FORMAT_PX[format];
  return {
    schemaVersion: 1,
    metadata: { name: PLACA_KIND_LABEL[kind], description: "Diseño base de FOTOFFICE, versión 1" },
    format: {
      medium: "PRINT",
      width: mm(px.width),
      height: mm(px.height),
      dpi: PLACA_DPI,
      bleedMm: 0,
      safeAreaMm: 0,
    },
    sides: [
      {
        id: "placa",
        name: "Placa",
        background: FONDO[kind],
        blocks: BLOQUES[kind][format](),
      },
    ],
  };
}
