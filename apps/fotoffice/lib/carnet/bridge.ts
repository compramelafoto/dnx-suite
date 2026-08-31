import { FONT_CATALOG, type FontId } from "@repo/design-studio";

/**
 * Puente entre el diseñador de plantillas y el módulo que imprime.
 *
 * Son dos modelos distintos y ninguno es el "correcto":
 *
 * - El **editor** piensa en píxeles sobre un lienzo, con los bloques en filas de base y las
 *   caras como `pageIndex`. Es lo que necesita una interfaz que se arrastra con el mouse.
 * - **design-studio** piensa en milímetros sobre papel, con cuerpos tipográficos en puntos y
 *   las caras como `sides`. Es lo que necesita una imprenta.
 *
 * Sin esta traducción se puede diseñar y guardar, pero lo que sale impreso es el diseño de
 * fábrica: el trabajo de quien diseñó no llega al PDF.
 *
 * La conversión de unidades sale del `dpi` del lienzo, no de una constante: si mañana una
 * institución diseña a 600 dpi, las medidas siguen dando.
 */

export type EditorCanvas = {
  width: number;
  height: number;
  background?: string | null;
  dpi?: number | null;
  bleedMm?: number | null;
  safeAreaMm?: number | null;
};

export type EditorBlock = {
  id: string;
  type: string;
  name?: string | null;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  configJson: unknown;
};

/** Variable sintética: la genera el puente, no la declara el producto. Ver los QR fijos. */
export type VariableSintetica = {
  key: string;
  label: string;
  value: string;
};

export type PuenteResultado = {
  document: unknown;
  /**
   * Un QR con URL fija no tiene de dónde sacar su valor: design-studio solo sabe leer QR de
   * una variable. El puente inventa una por cada uno y entrega su valor junto al documento.
   */
  variablesSinteticas: VariableSintetica[];
  /** Lo que no se pudo traducir. No frena la impresión; sirve para poder explicarlo. */
  avisos: string[];
};

const DPI_POR_DEFECTO = 300;
const FUENTE_POR_DEFECTO: FontId = "dmSans";

function num(v: unknown, porDefecto: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : porDefecto;
}

function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

function texto(v: unknown, porDefecto = ""): string {
  return typeof v === "string" ? v : porDefecto;
}

/**
 * Elige la tipografía de design-studio a partir de la familia CSS del editor.
 *
 * El catálogo es cerrado: si la familia no está, se usa DM Sans y se avisa. Es preferible a
 * fallar la impresión, y preferible también a un cambio silencioso de familia que nadie ve
 * hasta que llegan las tarjetas de la imprenta.
 */
function fuenteDesde(familia: string, avisos: string[]): FontId {
  const normal = familia.trim().toLowerCase().replace(/['"]/g, "");
  if (!normal) return FUENTE_POR_DEFECTO;

  for (const [id, def] of Object.entries(FONT_CATALOG)) {
    if (
      id.toLowerCase() === normal ||
      def.label.toLowerCase() === normal ||
      def.cssFamily.toLowerCase() === normal ||
      normal.startsWith(def.cssFamily.toLowerCase())
    ) {
      return id as FontId;
    }
  }
  avisos.push(
    `La tipografía "${familia}" no está en el catálogo de impresión; se usó ${FONT_CATALOG[FUENTE_POR_DEFECTO].label}.`,
  );
  return FUENTE_POR_DEFECTO;
}

function alineacion(v: unknown): "left" | "center" | "right" {
  const a = texto(v, "CENTER").toLowerCase();
  return a === "left" || a === "right" ? a : "center";
}

/**
 * Traduce un diseño del editor al documento que imprime design-studio.
 */
export function editorADocumento(input: {
  canvas: EditorCanvas;
  blocks: readonly EditorBlock[];
  nombre?: string;
}): PuenteResultado {
  const avisos: string[] = [];
  const variablesSinteticas: VariableSintetica[] = [];

  const dpi = num(input.canvas.dpi, DPI_POR_DEFECTO) || DPI_POR_DEFECTO;
  /** Píxeles del lienzo a milímetros de papel. */
  const mm = (px: number) => (px * 25.4) / dpi;
  /** Píxeles a puntos tipográficos. Un punto es 1/72 de pulgada. */
  const pt = (px: number) => (px * 72) / dpi;

  const anchoMm = mm(num(input.canvas.width, 1011));
  const altoMm = mm(num(input.canvas.height, 638));

  // Las caras salen de `pageIndex`. Un diseño de una sola cara —la historia de bienvenida—
  // produce un documento de un solo lado, que es exactamente lo que se quiere.
  const porCara = new Map<number, EditorBlock[]>();
  for (const b of input.blocks) {
    const cara = Math.max(0, Math.trunc(num(b.pageIndex, 0)));
    if (!porCara.has(cara)) porCara.set(cara, []);
    porCara.get(cara)!.push(b);
  }
  if (porCara.size === 0) porCara.set(0, []);

  const sides = [...porCara.entries()]
    .sort(([a], [b]) => a - b)
    .map(([indice, bloques]) => {
      let fondo = texto(input.canvas.background, "#ffffff") || "#ffffff";
      const dibujables: unknown[] = [];

      // zIndex manda el orden de dibujo: design-studio pinta en el orden del arreglo.
      const ordenados = [...bloques].sort((a, b) => num(a.zIndex, 0) - num(b.zIndex, 0));

      for (const b of ordenados) {
        const cfg = obj(b.configJson);
        const geo = {
          id: b.id,
          x: mm(num(b.x, 0)),
          y: mm(num(b.y, 0)),
          width: mm(num(b.width, 0)),
          height: mm(num(b.height, 0)),
          rotation: num(b.rotation, 0) || undefined,
          opacity: b.opacity === 1 ? undefined : num(b.opacity, 1),
          hidden: b.visible === false ? true : undefined,
          layerName: b.name ?? undefined,
        };

        switch (b.type) {
          case "BACKGROUND": {
            // Un fondo de color es una propiedad de la cara, no un bloque: así no tapa nada
            // por un error de orden. Un fondo con imagen sí necesita dibujarse.
            const color = texto(cfg.backgroundColor);
            if (color) fondo = color;
            const src = texto(cfg.src);
            if (src) {
              dibujables.push({
                ...geo,
                x: 0,
                y: 0,
                width: anchoMm,
                height: altoMm,
                type: "image",
                resourceRef: src,
                fit: "cover",
              });
            }
            break;
          }

          case "TEXT": {
            dibujables.push({
              ...geo,
              type: "text",
              content: texto(cfg.content),
              fontId: fuenteDesde(texto(cfg.fontFamily, "Helvetica"), avisos),
              fontSize: pt(num(cfg.fontSize, 20)),
              fontWeight: num(cfg.fontWeight, 400) >= 600 ? "bold" : "normal",
              fontStyle: cfg.fontItalic === true ? "italic" : "normal",
              color: texto(cfg.color, "#111111"),
              align: alineacion(cfg.textAlign),
            });
            break;
          }

          case "VARIABLE_TEXT": {
            const clave = texto(cfg.variableKey);
            if (!clave) {
              avisos.push(`Un bloque de dato variable quedó sin variable elegida; no se imprimió.`);
              break;
            }
            dibujables.push({
              ...geo,
              type: "text",
              content: `{{${clave}}}`,
              fontId: fuenteDesde(texto(cfg.fontFamily, "Helvetica"), avisos),
              fontSize: pt(num(cfg.fontSize, 20)),
              fontWeight: num(cfg.fontWeight, 400) >= 600 ? "bold" : "normal",
              fontStyle: cfg.fontItalic === true ? "italic" : "normal",
              color: texto(cfg.color, "#111111"),
              align: alineacion(cfg.textAlign),
            });
            break;
          }

          case "PHOTO": {
            // El bloque de foto siempre es la foto del socio: es lo que lo distingue de una
            // imagen cualquiera.
            dibujables.push({ ...geo, type: "image", variableKey: "photo", fit: "cover" });
            break;
          }

          case "IMAGE": {
            /*
             * La clave puede estar en `source.variableKey` —que es donde la escribe el editor y
             * donde la busca el lienzo— o en la raíz. Leer solo la raíz hacía que una imagen
             * atada a un dato se viera bien mientras se diseñaba y saliera vacía al imprimir.
             */
            const clave = texto(obj(cfg.source).variableKey) || texto(cfg.variableKey);
            const src = texto(cfg.src) || texto(obj(cfg.source).src) || texto(obj(cfg.source).url);
            if (clave) {
              dibujables.push({ ...geo, type: "image", variableKey: clave, fit: "cover" });
            } else if (src) {
              dibujables.push({ ...geo, type: "image", resourceRef: src, fit: "cover" });
            } else {
              avisos.push("Una imagen quedó sin archivo ni variable; no se imprimió.");
            }
            break;
          }

          case "SHAPE": {
            const variante = texto(cfg.variant, "rectangle");
            // design-studio dibuja rectángulos, no elipses. Un círculo se consigue con el
            // radio de esquina al máximo; una elipse de lados distintos no tiene equivalente,
            // así que se avisa en vez de imprimir algo que no es lo que se diseñó.
            let radio = mm(num(cfg.radius, 0));
            if (variante === "circle" || variante === "ellipse") {
              radio = Math.min(geo.width, geo.height) / 2;
              if (variante === "ellipse" && Math.abs(geo.width - geo.height) > 0.5) {
                avisos.push(
                  "Una elipse se imprimió como rectángulo redondeado: la impresión no dibuja elipses.",
                );
              }
            }
            const trazo = num(cfg.strokeWidth, 0);
            dibujables.push({
              ...geo,
              type: "rect",
              fillColor: texto(cfg.fill, "#e5e7eb"),
              strokeColor: trazo > 0 ? texto(cfg.stroke, "#94a3b8") : undefined,
              strokeWidth: trazo > 0 ? mm(trazo) : undefined,
              cornerRadius: radio > 0 ? radio : undefined,
            });
            break;
          }

          case "QR": {
            const modo = texto(cfg.mode, "VARIABLE");
            const ec = texto(cfg.errorCorrection, "M");
            const base = {
              ...geo,
              type: "qrcode",
              errorCorrection: ["L", "M", "Q", "H"].includes(ec) ? ec : "M",
              quietZoneModules: num(cfg.quietZoneModules, 4),
              darkColor: texto(cfg.foreground, "#000000"),
              lightColor: texto(cfg.background, "#ffffff"),
            };

            if (modo === "FIXED") {
              const url = texto(cfg.value).trim();
              if (!url) {
                avisos.push("Un QR de dirección fija quedó sin dirección; no se imprimió.");
                break;
              }
              // Clave derivada del id del bloque: estable entre impresiones y sin choque
              // posible con las variables del socio.
              const clave = `qrFijo_${b.id.replace(/[^a-zA-Z0-9]/g, "")}`;
              variablesSinteticas.push({ key: clave, label: "QR de dirección fija", value: url });
              dibujables.push({ ...base, variableKey: clave });
              break;
            }

            const clave = texto(cfg.variableKey) || "verificationUrl";
            dibujables.push({ ...base, variableKey: clave });
            break;
          }

          default:
            avisos.push(`No se pudo imprimir un bloque de tipo "${b.type}".`);
        }
      }

      return {
        id: indice === 0 ? "frente" : indice === 1 ? "dorso" : `cara-${indice + 1}`,
        name: indice === 0 ? "Frente" : indice === 1 ? "Dorso" : `Cara ${indice + 1}`,
        background: fondo,
        blocks: dibujables,
      };
    });

  return {
    document: {
      schemaVersion: 1,
      metadata: { name: input.nombre ?? "Carnet de socio", description: "Diseñado en FotoOffice" },
      format: {
        medium: "PRINT",
        width: anchoMm,
        height: altoMm,
        dpi,
        bleedMm: num(input.canvas.bleedMm, 3),
        safeAreaMm: num(input.canvas.safeAreaMm, 3),
      },
      sides,
    },
    variablesSinteticas,
    avisos,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */

export type SemillaEditor = {
  canvas: Required<Pick<EditorCanvas, "width" | "height">> & EditorCanvas;
  blocks: Omit<EditorBlock, "id">[];
};

/**
 * Traduce el diseño de fábrica al modelo del editor, para que se pueda abrir y modificar.
 *
 * Es la dirección inversa de `editorADocumento`, y existe por una razón concreta: si la
 * plantilla de una institución se sembrara con el documento de impresión tal cual, el editor
 * la abriría vacía —no entiende ese formato— y quien fuera a retocar el carnet se encontraría
 * con un lienzo en blanco en lugar de su diseño.
 */
export function documentoAEditor(documento: unknown): SemillaEditor {
  const doc = obj(documento);
  const formato = obj(doc.format);
  const dpi = num(formato.dpi, DPI_POR_DEFECTO) || DPI_POR_DEFECTO;
  /** Milímetros de papel a píxeles del lienzo. */
  const px = (v: number) => (v * dpi) / 25.4;
  /** Puntos tipográficos a píxeles. */
  const pxDePt = (v: number) => (v * dpi) / 72;

  const sides = Array.isArray(doc.sides) ? doc.sides : [];
  const blocks: Omit<EditorBlock, "id">[] = [];

  sides.forEach((caraCruda, pageIndex) => {
    const cara = obj(caraCruda);
    const bloques = Array.isArray(cara.blocks) ? cara.blocks : [];

    bloques.forEach((crudo, orden) => {
      const b = obj(crudo);
      const base = {
        pageIndex,
        name: texto(b.layerName) || null,
        x: px(num(b.x, 0)),
        y: px(num(b.y, 0)),
        width: px(num(b.width, 0)),
        height: px(num(b.height, 0)),
        rotation: num(b.rotation, 0),
        zIndex: orden,
        opacity: num(b.opacity, 1),
        locked: b.locked === true,
        visible: b.hidden !== true,
      };

      const tipo = texto(b.type);

      if (tipo === "text") {
        const contenido = texto(b.content);
        // Un texto que es exactamente un marcador vuelve como bloque de dato variable: así se
        // puede cambiar la variable desde el inspector en vez de editar llaves a mano.
        const soloMarcador = contenido.match(/^\{\{\s*([\w.]+)\s*\}\}$/);
        const tipografia = {
          fontFamily: FONT_CATALOG[(texto(b.fontId, FUENTE_POR_DEFECTO) as FontId)]?.cssFamily
            ?? FONT_CATALOG[FUENTE_POR_DEFECTO].cssFamily,
          fontSize: pxDePt(num(b.fontSize, 10)),
          fontWeight: texto(b.fontWeight) === "bold" ? 700 : 400,
          fontItalic: texto(b.fontStyle) === "italic",
          color: texto(b.color, "#111111"),
          textAlign: texto(b.align, "left").toUpperCase(),
        };

        blocks.push(
          soloMarcador
            ? {
                ...base,
                type: "VARIABLE_TEXT",
                configJson: { ...tipografia, variableKey: soloMarcador[1], fallback: "" },
              }
            : { ...base, type: "TEXT", configJson: { ...tipografia, content: contenido } },
        );
        return;
      }

      if (tipo === "image") {
        const clave = texto(b.variableKey);
        blocks.push(
          clave === "photo"
            ? { ...base, type: "PHOTO", configJson: { variableKey: "photo", fit: "cover" } }
            : {
                ...base,
                type: "IMAGE",
                configJson: clave
                  ? { variableKey: clave, fit: "cover" }
                  : { src: texto(b.resourceRef), fit: "cover" },
              },
        );
        return;
      }

      if (tipo === "qrcode") {
        blocks.push({
          ...base,
          type: "QR",
          configJson: {
            mode: "VARIABLE",
            variableKey: texto(b.variableKey, "verificationUrl"),
            value: "",
            errorCorrection: texto(b.errorCorrection, "M"),
            quietZoneModules: num(b.quietZoneModules, 4),
            foreground: texto(b.darkColor, "#000000"),
            background: texto(b.lightColor, "#ffffff"),
          },
        });
        return;
      }

      if (tipo === "rect" || tipo === "line") {
        // Una línea es un rectángulo muy fino: el editor no tiene bloque de línea, y darle
        // altura al rectángulo conserva el aspecto sin inventar un tipo nuevo.
        const esLinea = tipo === "line";
        blocks.push({
          ...base,
          height: esLinea ? Math.max(base.height, px(num(b.strokeWidth, 0.3))) : base.height,
          type: "SHAPE",
          configJson: {
            variant: "rectangle",
            fill: esLinea ? texto(b.strokeColor, "#000000") : texto(b.fillColor, "#e5e7eb"),
            stroke: texto(b.strokeColor, "#94a3b8"),
            strokeWidth: esLinea ? 0 : px(num(b.strokeWidth, 0)),
            radius: px(num(b.cornerRadius, 0)),
          },
        });
      }
    });
  });

  const primera = obj(sides[0]);

  return {
    canvas: {
      width: px(num(formato.width, 85.6)),
      height: px(num(formato.height, 54)),
      background: texto(primera.background, "#ffffff") || "#ffffff",
      dpi,
      bleedMm: num(formato.bleedMm, 3),
      safeAreaMm: num(formato.safeAreaMm, 3),
    },
    blocks,
  };
}
