import { FONT_CATALOG, GOOGLE_FONT_PREFIX, fontDefinition, isFontId, normalizarEncuadre, type FontId, type ImageCrop } from "@repo/design-studio";
import { EDITOR_FONT_CATALOG } from "./editor-font-catalog";
import { readTextVerticalAlign } from "./render-core";
import {
  CLASS_LIST_SAMPLE_GROUPS,
  CLASS_LIST_SAMPLE_SCHOOL,
  CLASS_LIST_VARIABLE_KEY,
  SCHOOL_CLIENT_PHOTO_PLACEHOLDER,
  distributeCourseMosaic,
  isCourseMosaicConfig,
  layoutCourseMosaic,
  readCourseMosaicOptions,
  type CourseMosaicRect,
  type CourseMosaicStudent,
  layoutClassListBlock,
  readClassListOptions,
  type ClassListGroup,
  type ClassListStudent,
} from "@repo/template-engine";

/**
 * Puente entre el diseñador de plantillas y el módulo que imprime.
 *
 * Vive en el paquete y no en una aplicación porque lo usan dos cosas: la emisión del carnet de
 * FotoOffice y la vista previa de todas las plataformas. Mientras estuvo dentro de FotoOffice,
 * la vista previa tuvo que dibujarse con un navegador headless, que en el servidor de
 * producción no existe.
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
const FUENTE_POR_DEFECTO = "dmSans" as const;

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

/*
 * Las tipografías del sistema que ofrece el editor no existen en Google. Se imprimen con su
 * equivalente métrico libre: mismo ancho letra por letra, así el texto ocupa lo mismo que en
 * pantalla y se ve casi igual.
 */
const EQUIVALENTES_DE_SISTEMA: Record<string, string> = {
  helvetica: "Arimo",
  "helvetica neue": "Arimo",
  arial: "Arimo",
  "sans-serif": "Arimo",
  "times new roman": "Tinos",
  times: "Tinos",
  serif: "Tinos",
  georgia: "Gelasio",
};

const FAMILIAS_DEL_EDITOR = new Map(EDITOR_FONT_CATALOG.map((f) => [f.family.toLowerCase(), f.family]));

/**
 * Elige la tipografía de design-studio a partir de la familia CSS del editor.
 *
 * Las incrustadas se usan por su id; el resto de las familias del editor se bajan de Google al
 * imprimir (`google:Familia`). Sólo una familia que el editor no ofrece cae en DM Sans, y avisa:
 * es preferible a fallar la impresión, y preferible también a un cambio silencioso de familia
 * que nadie ve hasta que llegan las tarjetas de la imprenta.
 */
function fuenteDesde(familia: string, avisos: string[]): FontId {
  // El editor guarda a veces la pila CSS entera ("Lato, sans-serif"): manda la primera.
  const normal = (familia.split(",")[0] ?? "").trim().toLowerCase().replace(/['"]/g, "");
  if (!normal) return FUENTE_POR_DEFECTO;

  const equivalente = EQUIVALENTES_DE_SISTEMA[normal];
  if (equivalente) return `${GOOGLE_FONT_PREFIX}${equivalente}` as FontId;

  /*
   * Una familia que el editor carga de Google se imprime con la de Google aunque haya una
   * incrustada del mismo nombre: la incrustada puede ser una versión anterior (Merriweather
   * cambió de dibujo) y el PDF salía con otras proporciones que la pantalla. Si no se puede
   * bajar, el cargador usa la incrustada.
   */
  const delEditor = FAMILIAS_DEL_EDITOR.get(normal);
  if (delEditor) {
    const id = `${GOOGLE_FONT_PREFIX}${delEditor}`;
    if (isFontId(id)) return id;
  }

  for (const [id, def] of Object.entries(FONT_CATALOG)) {
    if (id.toLowerCase() === normal || def.label.toLowerCase() === normal || def.cssFamily.toLowerCase() === normal) {
      return id as FontId;
    }
  }

  // Variantes con apellido de una incrustada ("DM Sans Medium"): la familia base.
  for (const [id, def] of Object.entries(FONT_CATALOG)) {
    if (normal.startsWith(def.cssFamily.toLowerCase())) return id as FontId;
  }

  avisos.push(
    `La tipografía "${familia}" no está en el catálogo de impresión; se usó ${FONT_CATALOG[FUENTE_POR_DEFECTO].label}.`,
  );
  return FUENTE_POR_DEFECTO;
}

/** La conversión de mayúsculas elegida en el editor, o ninguna si viene algo desconocido. */
function conversionDeLetras(v: unknown): "none" | "uppercase" | "lowercase" | "capitalize" {
  return v === "uppercase" || v === "lowercase" || v === "capitalize" ? v : "none";
}

/**
 * La alineación vertical para design-studio. Arriba no se escribe: el documento queda igual al
 * de antes de que existiera la opción.
 */
function alineacionVertical(cfg: Record<string, unknown>): { verticalAlign?: "middle" | "bottom" } {
  const v = readTextVerticalAlign(cfg);
  return v === "MIDDLE" ? { verticalAlign: "middle" } : v === "BOTTOM" ? { verticalAlign: "bottom" } : {};
}

function alineacion(v: unknown): "left" | "center" | "right" {
  const a = texto(v, "CENTER").toLowerCase();
  return a === "left" || a === "right" ? a : "center";
}

/**
 * Traduce un diseño del editor al documento que imprime design-studio.
 */
/**
 * Pasa `{clave}` a `{{clave}}` para las variables que el producto conoce.
 *
 * Conviven dos escrituras: el panel del editor inserta `{clave}` y el módulo de impresión lee
 * `{{clave}}`. Sin esto, quien agregaba "Nombre y apellido" desde el panel veía impreso el texto
 * `{fullName}` en vez del nombre — el marcador salía literal, sin ningún error que lo avisara.
 *
 * Solo se convierten las claves que el producto declara. Una llave suelta en el medio de una
 * frase sigue siendo una llave: alguien puede querer escribirla.
 */
function normalizarMarcadores(texto: string, conocidas?: ReadonlySet<string>): string {
  if (!conocidas || conocidas.size === 0) return texto;
  return texto.replace(/(?<!\{)\{\s*([A-Za-z_][\w.]*)\s*\}(?!\})/g, (todo, clave: string) =>
    conocidas.has(clave) ? `{{${clave}}}` : todo,
  );
}

export function editorADocumento(input: {
  canvas: EditorCanvas;
  blocks: readonly EditorBlock[];
  nombre?: string;
  /**
   * Las variables que este producto declara. Sin esto los marcadores se dejan como están, que
   * es lo correcto cuando no se sabe cuáles son válidos.
   */
  variablesConocidas?: ReadonlySet<string>;
  /**
   * Los alumnos del curso para el bloque «Listado del curso». Sin esto se dibuja el curso de
   * muestra (la vista previa del editor); una lista vacía no dibuja nada.
   */
  listaDelCurso?: readonly ClassListStudent[];
  /**
   * Los cursos del listado, cada uno con su título (manda sobre `listaDelCurso`). Se leen del
   * valor guardado con `parseClassListGroups`.
   */
  cursosDelListado?: readonly ClassListGroup[];
  /**
   * El colegio del diseño (`school.name`), para la línea de arriba del listado cuando el bloque
   * la pide. Sin esto, con el curso de muestra va el colegio de muestra; con cursos reales, no va.
   */
  colegioDelListado?: string | null;
  /**
   * Los compañeros del bloque «Mosaico del curso», ya sin el dueño del diseño. Sin esto no se
   * dibuja ninguno: una carpeta real nunca lleva compañeros inventados. Quien quiera la muestra
   * (una vista de ejemplo) pasa `COURSE_MOSAIC_SAMPLE`.
   */
  mosaicoDelCurso?: readonly CourseMosaicStudent[];
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

  // Los bloques del mosaico se reparten los chicos entre todos, en todas las caras: una cadena
  // puede empezar en una página y seguir en la otra.
  const chicosPorMosaico = distributeCourseMosaic(
    input.blocks.filter((b) => b.type === "VARIABLE_TEXT"),
    [...(input.mosaicoDelCurso ?? [])],
  );
  let avisoElipse = false;
  let avisoSombra = false;

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
              content: normalizarMarcadores(texto(cfg.content), input.variablesConocidas),
              fontId: fuenteDesde(texto(cfg.fontFamily, "Helvetica"), avisos),
              fontSize: pt(num(cfg.fontSize, 20)),
              fontWeight: num(cfg.fontWeight, 400) >= 600 ? "bold" : "normal",
              fontStyle: cfg.fontItalic === true ? "italic" : "normal",
              color: texto(cfg.color, "#111111"),
              align: alineacion(cfg.textAlign),
              ...alineacionVertical(cfg),
              textTransform: conversionDeLetras(cfg.textTransform),
              lineHeight: num(cfg.lineHeight, 1.2),
            });
            break;
          }

          case "VARIABLE_TEXT": {
            const clave = texto(cfg.variableKey);
            if (!clave) {
              avisos.push(`Un bloque de dato variable quedó sin variable elegida; no se imprimió.`);
              break;
            }
            if (isCourseMosaicConfig(cfg)) {
              const dibujado = dibujarMosaico({
                bloque: b,
                cfg,
                geo,
                chicos: chicosPorMosaico.get(b.id) ?? [],
                mm,
                pt,
                fuente: fuenteDesde(texto(cfg.fontFamily, "Helvetica"), avisos),
              });
              dibujables.push(...dibujado.partes);
              if (dibujado.bordeDeElipse && !avisoElipse) {
                avisoElipse = true;
                avisos.push("El mosaico va sin borde de elipse: la impresión no dibuja elipses con borde.");
              }
              if (dibujado.sombraDeElipse && !avisoSombra) {
                avisoSombra = true;
                avisos.push("El mosaico en óvalo va sin sombra: la impresión no dibuja óvalos de color.");
              }
              break;
            }
            if (clave === CLASS_LIST_VARIABLE_KEY) {
              /*
               * design-studio no mezcla negrita y normal dentro de un mismo texto, así que el
               * listado se imprime como un texto por alumno, cada uno con su peso. La cuenta de
               * columnas y filas es la misma que usa el lienzo del editor.
               */
              const opciones = readClassListOptions(cfg);
              const pesoBase = num(cfg.fontWeight, 400) >= 600 ? "bold" : "normal";
              const cursos: readonly ClassListGroup[] =
                input.cursosDelListado ??
                (input.listaDelCurso ? [{ title: "", students: [...input.listaDelCurso] }] : CLASS_LIST_SAMPLE_GROUPS);
              const reparto = layoutClassListBlock({
                groups: cursos,
                options: opciones,
                width: num(b.width, 0),
                height: num(b.height, 0),
                fontSize: num(cfg.fontSize, 20),
                lineHeight: num(cfg.lineHeight, 1.2),
                // El listado se alinea como un todo: cada alumno sale con su celda ya corrida,
                // y su texto va arriba de la celda, igual que en el lienzo.
                verticalAlign: readTextVerticalAlign(cfg).toLowerCase() as "top" | "middle" | "bottom",
                schoolName:
                  input.colegioDelListado ??
                  (input.cursosDelListado || input.listaDelCurso ? null : CLASS_LIST_SAMPLE_SCHOOL),
              });
              const comun = {
                type: "text" as const,
                fontId: fuenteDesde(texto(cfg.fontFamily, "Helvetica"), avisos),
                fontStyle: cfg.fontItalic === true ? "italic" : "normal",
                color: texto(cfg.color, "#111111"),
                align: alineacion(cfg.textAlign),
                textTransform: conversionDeLetras(cfg.textTransform),
                lineHeight: num(cfg.lineHeight, 1.2),
              };
              /*
               * Un listado girado (la carpeta de San Patricio lo lleva a 90°) se arma derecho y
               * después cada alumno se lleva a su lugar girando alrededor del centro del bloque,
               * con el mismo giro. Antes cada celda salía sin giro y en su posición derecha: el
               * PDF mostraba el listado acostado y encimado con lo que lo rodeaba.
               */
              const giro = num(b.rotation, 0);
              const rad = (giro * Math.PI) / 180;
              const bx = num(b.x, 0);
              const by = num(b.y, 0);
              const centroX = bx + num(b.width, 0) / 2;
              const centroY = by + num(b.height, 0) / 2;
              reparto.cells.forEach((celda, i) => {
                const dx = bx + celda.x + celda.width / 2 - centroX;
                const dy = by + celda.y + celda.height / 2 - centroY;
                const cx = centroX + dx * Math.cos(rad) - dy * Math.sin(rad);
                const cy = centroY + dx * Math.sin(rad) + dy * Math.cos(rad);
                dibujables.push({
                  ...geo,
                  ...comun,
                  id: `${b.id}__${i}`,
                  x: mm(cx - celda.width / 2),
                  y: mm(cy - celda.height / 2),
                  width: mm(celda.width),
                  height: mm(celda.height),
                  rotation: giro || undefined,
                  content: celda.text,
                  fontSize: pt(celda.fontSize),
                  fontWeight: celda.bold ? "bold" : pesoBase,
                });
              });
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
              ...alineacionVertical(cfg),
              textTransform: conversionDeLetras(cfg.textTransform),
              lineHeight: num(cfg.lineHeight, 1.2),
            });
            break;
          }

          case "PHOTO": {
            /*
             * El bloque de foto es la foto de la persona: eso lo distingue de una imagen
             * cualquiera. Cómo se llama esa variable depende del producto —en FotoOffice es
             * `photo`, en Clickatón `participant.photoUrl`—, así que se respeta la que declare
             * el diseño y `photo` queda como valor por defecto para quien no declara ninguna.
             */
            const clavePhoto =
              texto(obj(cfg.source).variableKey) || texto(cfg.variableKey) || "photo";
            const recortePhoto = texto(cfg.maskShape, "rect");
            dibujables.push({
              ...geo,
              type: "image",
              variableKey: clavePhoto,
              fit: "cover",
              mask:
                recortePhoto === "circle" || recortePhoto === "ellipse" ? recortePhoto : "rect",
            });
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
            /*
             * La forma del recorte se elige en el inspector y hasta ahora no llegaba hasta acá:
             * se marcaba "Circular", el editor lo guardaba y la credencial salía cuadrada igual.
             */
            const recorte = texto(cfg.maskShape, "rect");
            const forma = {
              mask: recorte === "circle" || recorte === "ellipse" ? recorte : "rect",
              ...(num(cfg.borderRadius, 0) > 0
                ? { cornerRadius: mm(num(cfg.borderRadius, 0)) }
                : {}),
            };
            /*
             * Un logo tiene que entrar entero en su recuadro; una foto tiene que llenarlo. Antes
             * todas las imágenes se recortaban como una foto, así que un logo con "contain"
             * salía recortado sin que nada lo avisara. `cover` sigue siendo el valor por defecto.
             */
            const encaje = texto(cfg.fit) === "contain" ? "contain" : "cover";
            /*
             * El reencuadre de la foto dentro del marco (zoom y corrimiento). Viaja con la
             * proporción de la foto original, que la vista previa necesita para ubicarla.
             */
            const encuadre = encaje === "cover" ? encuadreDeImagen(cfg) : {};
            if (clave) {
              dibujables.push({ ...geo, type: "image", variableKey: clave, fit: encaje, ...forma, ...encuadre });
            } else if (src) {
              dibujables.push({ ...geo, type: "image", resourceRef: src, fit: encaje, ...forma, ...encuadre });
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

/** Color de las iniciales sobre la silueta de un chico sin foto. */
const SILUETA_LETRAS = "#78716c";

function iniciales(s: CourseMosaicStudent): string {
  return [s.firstName, s.lastName]
    .map((p) => p.trim().charAt(0).toUpperCase())
    .filter(Boolean)
    .join("");
}

/**
 * Un bloque «Mosaico del curso» convertido en bloques comunes: por cada chico, la sombra, el
 * papel de la polaroid, la foto (o la silueta), el borde, el marco, la cinta y el nombre, en ese
 * orden de dibujo. La cuenta del reparto es la del lienzo (`layoutCourseMosaic`).
 *
 * Cada parte gira dos veces: con el giro propio de la celda (el «pegado a mano»), alrededor del
 * centro de la celda, y con el giro del bloque, alrededor del centro del bloque, igual que el
 * listado.
 */
function dibujarMosaico(input: {
  bloque: EditorBlock;
  cfg: Record<string, unknown>;
  geo: Record<string, unknown>;
  chicos: CourseMosaicStudent[];
  mm: (px: number) => number;
  pt: (px: number) => number;
  fuente: FontId;
}): { partes: Record<string, unknown>[]; bordeDeElipse: boolean; sombraDeElipse: boolean } {
  const { bloque: b, cfg, geo, chicos, mm, pt, fuente } = input;
  const o = readCourseMosaicOptions(cfg);
  // Los mismos valores por defecto que el lienzo (`getTextVisualConfig`): si no, las filas se
  // corren entre la pantalla y el PDF.
  const fontSize = num(cfg.fontSize, 20);
  const lineHeight = num(cfg.lineHeight, 1.2);
  const reparto = layoutCourseMosaic({
    students: chicos,
    options: o,
    width: num(b.width, 0),
    height: num(b.height, 0),
    fontSize,
    lineHeight,
  });

  const bx = num(b.x, 0);
  const by = num(b.y, 0);
  const giroBloque = num(b.rotation, 0);
  const centroX = bx + num(b.width, 0) / 2;
  const centroY = by + num(b.height, 0) / 2;
  const girar = (x: number, y: number, cx: number, cy: number, grados: number) => {
    if (!grados) return { x, y };
    const rad = (grados * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    return { x: cx + dx * Math.cos(rad) - dy * Math.sin(rad), y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) };
  };

  const color = texto(cfg.color, "#111111");
  const peso = num(cfg.fontWeight, 400) >= 600 ? "bold" : "normal";
  const radioDeForma = (r: CourseMosaicRect) =>
    o.frame === "circle" || o.frame === "ellipse"
      ? Math.min(r.width, r.height) / 2
      : o.frame === "rounded"
        ? o.cornerRadius
        : 0;

  const partes: Record<string, unknown>[] = [];
  let bordeDeElipse = false;
  const sombraDeElipse = o.frame === "ellipse" && o.shadow != null;

  reparto.cells.forEach((celda, i) => {
    const cx = bx + celda.box.x + celda.box.width / 2;
    const cy = by + celda.box.y + celda.box.height / 2;
    const giro = giroBloque + celda.rotation;
    /** Un rectángulo de la celda (relativo al bloque) en milímetros, ya ubicado y girado. */
    const ubicar = (r: CourseMosaicRect) => {
      const enCelda = girar(bx + r.x + r.width / 2, by + r.y + r.height / 2, cx, cy, celda.rotation);
      const c = girar(enCelda.x, enCelda.y, centroX, centroY, giroBloque);
      return {
        x: mm(c.x - r.width / 2),
        y: mm(c.y - r.height / 2),
        width: mm(r.width),
        height: mm(r.height),
        rotation: giro || undefined,
      };
    };
    const parte = (nombre: string, r: CourseMosaicRect, resto: Record<string, unknown>) =>
      partes.push({ ...geo, ...ubicar(r), ...resto, id: `${b.id}__m${i}_${nombre}` });

    const papel = o.frame === "polaroid" ? celda.box : celda.photo;
    const radio = radioDeForma(celda.photo);
    const redondeo = (px: number) => (px > 0 ? { cornerRadius: mm(px) } : {});

    if (o.shadow && o.frame !== "ellipse") {
      parte(
        "sombra",
        { ...papel, x: papel.x + o.shadow.dx, y: papel.y + o.shadow.dy },
        { type: "rect", fillColor: o.shadow.color, ...redondeo(o.frame === "polaroid" ? 0 : radio) },
      );
    }
    if (o.frame === "polaroid") parte("papel", celda.box, { type: "rect", fillColor: "#ffffff" });

    const chico = celda.student;
    // Con prefijo propio, así quien imprime sabe que es un compañero y, si la foto no aparece,
    // pone la silueta en vez de frenar toda la carpeta.
    const ref =
      chico.photoId != null
        ? `mosaic-photo:${chico.photoId}`
        : chico.photoUrl
          ? `mosaic-url:${chico.photoUrl}`
          : null;
    if (ref) {
      parte("foto", celda.photo, {
        type: "image",
        resourceRef: ref,
        fit: "cover",
        mask: o.frame === "circle" || o.frame === "ellipse" ? o.frame : "rect",
        ...(o.frame === "rounded" ? redondeo(o.cornerRadius) : {}),
        ...(chico.crop ? { crop: chico.crop } : {}),
        ...(chico.sourceAspect ? { sourceAspect: chico.sourceAspect } : {}),
      });
    } else {
      // La silueta es la imagen gris con la misma forma que la foto: así un óvalo es un óvalo
      // también en el papel (la impresión no dibuja óvalos de color).
      parte("silueta", celda.photo, {
        type: "image",
        resourceRef: SCHOOL_CLIENT_PHOTO_PLACEHOLDER,
        fit: "cover",
        mask: o.frame === "circle" || o.frame === "ellipse" ? o.frame : "rect",
        ...(o.frame === "rounded" ? redondeo(o.cornerRadius) : {}),
      });
      parte("iniciales", celda.photo, {
        type: "text",
        content: iniciales(chico),
        fontId: fuente,
        fontSize: pt(celda.photo.width * 0.3),
        fontWeight: "bold",
        color: SILUETA_LETRAS,
        align: "center",
        verticalAlign: "middle",
      });
    }

    if (o.borderWidth > 0) {
      if (o.frame === "ellipse") bordeDeElipse = true;
      else {
        parte("borde", celda.photo, {
          type: "rect",
          strokeColor: o.borderColor,
          strokeWidth: mm(o.borderWidth),
          ...redondeo(radio),
        });
      }
    }
    if (o.frameSrc) parte("marco", celda.photo, { type: "image", resourceRef: o.frameSrc, fit: "cover" });

    if (celda.name) {
      if (o.nameBackground) {
        const margen = celda.name.fontSize * 0.15;
        parte(
          "cinta",
          { x: celda.name.x, y: celda.name.y - margen, width: celda.name.width, height: celda.name.height + 2 * margen },
          { type: "rect", fillColor: o.nameBackground },
        );
      }
      parte("nombre", celda.name, {
        type: "text",
        content: celda.name.lines.join("\n"),
        fontId: fuente,
        fontSize: pt(celda.name.fontSize),
        fontWeight: peso,
        fontStyle: cfg.fontItalic === true ? "italic" : "normal",
        color,
        align: "center",
        textTransform: conversionDeLetras(cfg.textTransform),
        lineHeight,
      });
    }
  });

  return { partes, bordeDeElipse, sombraDeElipse };
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
/** `crop` y `sourceAspect` del bloque imagen, si los tiene. Ver `@repo/design-studio` → encuadre. */
function encuadreDeImagen(cfg: Record<string, unknown>): { crop?: ImageCrop; sourceAspect?: number } {
  const crop = normalizarEncuadre(cfg.crop);
  if (!crop) return {};
  const w = num(cfg.srcWidth, 0);
  const h = num(cfg.srcHeight, 0);
  return { crop, ...(w > 0 && h > 0 ? { sourceAspect: w / h } : {}) };
}

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
          fontFamily: isFontId(b.fontId)
            ? fontDefinition(b.fontId).cssFamily
            : FONT_CATALOG[FUENTE_POR_DEFECTO].cssFamily,
          fontSize: pxDePt(num(b.fontSize, 10)),
          fontWeight: texto(b.fontWeight) === "bold" ? 700 : 400,
          fontItalic: texto(b.fontStyle) === "italic",
          color: texto(b.color, "#111111"),
          textAlign: texto(b.align, "left").toUpperCase(),
          ...(b.verticalAlign === "middle" || b.verticalAlign === "bottom"
            ? { verticalAlign: texto(b.verticalAlign).toUpperCase() }
            : {}),
          // Las mayúsculas del diseño base se conservaban al imprimir pero no al pasar al editor.
          ...(conversionDeLetras(b.textTransform) !== "none"
            ? { textTransform: conversionDeLetras(b.textTransform) }
            : {}),
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
        /*
         * La variable va en `source.variableKey`, que es donde la buscan el lienzo y el
         * inspector; en la raíz sólo la leía la impresión, así que una imagen sembrada se veía
         * como "Imagen libre" mientras se diseñaba. Se conserva también el encaje ("contain" en
         * un logo) y el recorte, que antes se perdían al pasar al editor.
         */
        const encaje = texto(b.fit) === "contain" ? "contain" : "cover";
        const recorte = texto(b.mask);
        const forma = {
          ...(recorte === "circle" || recorte === "ellipse" ? { maskShape: recorte } : {}),
          ...(num(b.cornerRadius, 0) > 0 ? { borderRadius: px(num(b.cornerRadius, 0)) } : {}),
        };
        const encuadre = normalizarEncuadre(b.crop);
        const aspecto = num(b.sourceAspect, 0);
        if (encuadre) {
          // Sólo la proporción importa: se guarda como medidas relativas.
          Object.assign(forma, {
            crop: encuadre,
            ...(aspecto > 0 ? { srcWidth: Math.round(aspecto * 1000), srcHeight: 1000 } : {}),
          });
        }
        blocks.push(
          clave === "photo"
            ? {
                ...base,
                type: "PHOTO",
                configJson: { variableKey: "photo", source: { variableKey: "photo" }, fit: encaje, ...forma },
              }
            : {
                ...base,
                type: "IMAGE",
                configJson: clave
                  ? { variableKey: clave, source: { variableKey: clave }, fit: encaje, ...forma }
                  : { src: texto(b.resourceRef), fit: encaje, ...forma },
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
