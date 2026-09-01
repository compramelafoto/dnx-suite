import { fail, ok, type Result } from "../result";
import {
  BLOCK_TYPES,
  DESIGN_SCHEMA_VERSION,
  type BlockChrome,
  type BlockGeometry,
  type DesignBlock,
  type DesignDocument,
  type DesignFormat,
  type DesignSide,
} from "./schema";

/** Acumulador de errores: se informan todos juntos, no de a uno por intento. */
class Errores {
  readonly list: string[] = [];
  add(mensaje: string): void {
    this.list.push(mensaje);
  }
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function numeroFinito(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function color(v: unknown): string | null {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null;
}

function texto(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function leerGeometria(o: Record<string, unknown>, donde: string, e: Errores): BlockGeometry | null {
  const id = texto(o.id);
  if (!id) {
    e.add(`${donde}: falta el identificador del bloque.`);
    return null;
  }
  const x = numeroFinito(o.x);
  const y = numeroFinito(o.y);
  const width = numeroFinito(o.width);
  const height = numeroFinito(o.height);
  if (x === null || y === null || width === null || height === null) {
    e.add(`${donde} "${id}": la posición y el tamaño tienen que ser números.`);
    return null;
  }
  if (width <= 0 || height <= 0) {
    e.add(`${donde} "${id}": el ancho y el alto tienen que ser mayores que cero.`);
    return null;
  }
  const rotation = numeroFinito(o.rotation);
  const opacity = numeroFinito(o.opacity);
  return {
    id,
    x,
    y,
    width,
    height,
    ...(rotation !== null ? { rotation } : {}),
    ...(opacity !== null && opacity >= 0 && opacity <= 1 ? { opacity } : {}),
  };
}

function leerChrome(o: Record<string, unknown>): BlockChrome {
  const layerName = texto(o.layerName);
  return {
    ...(typeof o.locked === "boolean" ? { locked: o.locked } : {}),
    ...(typeof o.hidden === "boolean" ? { hidden: o.hidden } : {}),
    ...(layerName ? { layerName: layerName.slice(0, 120) } : {}),
  };
}

function leerBloque(raw: unknown, donde: string, e: Errores): DesignBlock | null {
  if (!esObjeto(raw)) {
    e.add(`${donde}: cada bloque tiene que ser un objeto.`);
    return null;
  }
  const tipo = texto(raw.type);
  if (!tipo || !(BLOCK_TYPES as readonly string[]).includes(tipo)) {
    e.add(
      `${donde}: tipo de bloque desconocido "${String(raw.type)}". Este documento fue creado con una versión más nueva del editor.`,
    );
    return null;
  }
  const geo = leerGeometria(raw, donde, e);
  if (!geo) return null;
  const chrome = leerChrome(raw);

  if (tipo === "text") {
    const fontId = texto(raw.fontId);
    const fontSize = numeroFinito(raw.fontSize);
    const contenido = texto(raw.content);
    const col = color(raw.color);
    if (!fontId) e.add(`Bloque de texto "${geo.id}": falta la tipografía.`);
    if (fontSize === null || fontSize < 4) {
      e.add(`Bloque de texto "${geo.id}": el cuerpo tiene que ser un número de 4 o más.`);
    }
    if (contenido === null) e.add(`Bloque de texto "${geo.id}": falta el contenido.`);
    if (!col) e.add(`Bloque de texto "${geo.id}": el color tiene que ser un hexadecimal como #112233.`);
    if (!fontId || fontSize === null || fontSize < 4 || contenido === null || !col) return null;
    const align = raw.align === "center" || raw.align === "right" ? raw.align : "left";
    const maxLines = numeroFinito(raw.maxLines);
    const transform =
      raw.textTransform === "uppercase" ||
      raw.textTransform === "lowercase" ||
      raw.textTransform === "capitalize"
        ? raw.textTransform
        : "none";
    return {
      ...geo,
      ...chrome,
      type: "text",
      fontId,
      fontSize,
      fontWeight: raw.fontWeight === "bold" ? "bold" : "normal",
      fontStyle: raw.fontStyle === "italic" ? "italic" : "normal",
      color: col,
      align,
      textTransform: transform,
      content: contenido,
      ...(maxLines !== null && maxLines > 0 ? { maxLines: Math.floor(maxLines) } : {}),
    };
  }

  if (tipo === "qrcode") {
    const variableKey = texto(raw.variableKey);
    const quiet = numeroFinito(raw.quietZoneModules);
    const ec = raw.errorCorrection;
    const ecOk = ec === "L" || ec === "M" || ec === "Q" || ec === "H";
    if (!variableKey) e.add(`Bloque QR "${geo.id}": falta la variable que trae el contenido.`);
    if (!ecOk) e.add(`Bloque QR "${geo.id}": el nivel de corrección tiene que ser L, M, Q o H.`);
    if (quiet === null || quiet < 0) {
      e.add(`Bloque QR "${geo.id}": la zona de silencio tiene que ser un número de 0 o más.`);
    }
    if (!variableKey || !ecOk || quiet === null || quiet < 0) return null;
    const dark = color(raw.darkColor);
    const light = color(raw.lightColor);
    return {
      ...geo,
      ...chrome,
      type: "qrcode",
      variableKey,
      errorCorrection: ec,
      quietZoneModules: Math.floor(quiet),
      ...(dark ? { darkColor: dark } : {}),
      ...(light ? { lightColor: light } : {}),
    };
  }

  if (tipo === "image") {
    const resourceRef = texto(raw.resourceRef);
    const variableKey = texto(raw.variableKey);
    if (!resourceRef === !variableKey) {
      e.add(
        `Bloque de imagen "${geo.id}": tiene que declarar un recurso o una variable, y solo una de las dos.`,
      );
      return null;
    }
    return {
      ...geo,
      ...chrome,
      type: "image",
      ...(resourceRef ? { resourceRef } : {}),
      ...(variableKey ? { variableKey } : {}),
      fit: raw.fit === "contain" ? "contain" : "cover",
      mask:
        raw.mask === "circle" || raw.mask === "ellipse" ? raw.mask : "rect",
      ...(numeroFinito(raw.cornerRadius) ? { cornerRadius: numeroFinito(raw.cornerRadius)! } : {}),
    };
  }

  if (tipo === "line") {
    const strokeColor = color(raw.strokeColor);
    const strokeWidth = numeroFinito(raw.strokeWidth);
    if (!strokeColor) e.add(`Bloque de línea "${geo.id}": el color tiene que ser un hexadecimal como #112233.`);
    if (strokeWidth === null || strokeWidth <= 0) {
      e.add(`Bloque de línea "${geo.id}": el grosor tiene que ser mayor que cero.`);
    }
    if (!strokeColor || strokeWidth === null || strokeWidth <= 0) return null;
    return { ...geo, ...chrome, type: "line", strokeColor, strokeWidth };
  }

  const fillColor = color(raw.fillColor);
  const strokeColor = color(raw.strokeColor);
  const strokeWidth = numeroFinito(raw.strokeWidth);
  const cornerRadius = numeroFinito(raw.cornerRadius);
  if (!fillColor && !strokeColor) {
    e.add(`Bloque de rectángulo "${geo.id}": tiene que declarar relleno o borde.`);
    return null;
  }
  return {
    ...geo,
    ...chrome,
    type: "rect",
    ...(fillColor ? { fillColor } : {}),
    ...(strokeColor ? { strokeColor } : {}),
    ...(strokeColor && strokeWidth !== null && strokeWidth > 0 ? { strokeWidth } : {}),
    ...(cornerRadius !== null && cornerRadius > 0 ? { cornerRadius } : {}),
  };
}

function leerFormato(raw: unknown, e: Errores): DesignFormat | null {
  if (!esObjeto(raw)) {
    e.add("El documento no declara un formato.");
    return null;
  }
  const medium = raw.medium === "PRINT" || raw.medium === "SCREEN" ? raw.medium : null;
  const width = numeroFinito(raw.width);
  const height = numeroFinito(raw.height);
  if (!medium) e.add("El formato tiene que declarar el medio: PRINT o SCREEN.");
  if (width === null || width <= 0) e.add("El formato tiene que declarar un ancho mayor que cero.");
  if (height === null || height <= 0) e.add("El formato tiene que declarar un alto mayor que cero.");
  if (!medium || width === null || height === null || width <= 0 || height <= 0) return null;

  if (medium === "SCREEN") {
    return { medium, width, height };
  }

  const dpi = numeroFinito(raw.dpi);
  if (dpi === null || dpi < 72) {
    e.add("Un formato de impresión tiene que declarar los puntos por pulgada (72 o más).");
    return null;
  }
  const bleedMm = numeroFinito(raw.bleedMm);
  const safeAreaMm = numeroFinito(raw.safeAreaMm);
  return {
    medium,
    width,
    height,
    dpi,
    ...(bleedMm !== null && bleedMm >= 0 ? { bleedMm } : {}),
    ...(safeAreaMm !== null && safeAreaMm >= 0 ? { safeAreaMm } : {}),
  };
}

function leerCara(raw: unknown, indice: number, e: Errores): DesignSide | null {
  if (!esObjeto(raw)) {
    e.add(`La cara ${indice + 1} no es un objeto.`);
    return null;
  }
  const id = texto(raw.id);
  const name = texto(raw.name);
  const background = color(raw.background);
  if (!id) e.add(`La cara ${indice + 1} no tiene identificador.`);
  if (!name) e.add(`La cara ${indice + 1} no tiene nombre.`);
  if (!background) e.add(`La cara ${indice + 1} tiene que declarar un fondo hexadecimal como #ffffff.`);
  if (!Array.isArray(raw.blocks)) {
    e.add(`La cara ${indice + 1} no tiene una lista de bloques.`);
    return null;
  }
  if (!id || !name || !background) return null;

  const blocks: DesignBlock[] = [];
  const vistos = new Set<string>();
  raw.blocks.forEach((b, i) => {
    const bloque = leerBloque(b, `Cara "${name}", bloque ${i + 1}`, e);
    if (!bloque) return;
    if (vistos.has(bloque.id)) {
      e.add(`Cara "${name}": el identificador de bloque "${bloque.id}" está repetido.`);
      return;
    }
    vistos.add(bloque.id);
    blocks.push(bloque);
  });

  return { id, name, background, blocks };
}

/**
 * Lee un documento y lo rechaza con motivo si no lo entiende. Nunca devuelve una plantilla
 * por defecto: emitir un diseño que no es el que la persona hizo es peor que no emitir.
 */
export function parseDesignDocument(raw: unknown): Result<DesignDocument> {
  if (!esObjeto(raw)) {
    return fail("Esto no es un documento de diseño.");
  }
  const e = new Errores();

  const schemaVersion = numeroFinito(raw.schemaVersion);
  if (schemaVersion === null) {
    return fail("El documento no declara su versión de esquema.");
  }
  if (schemaVersion !== DESIGN_SCHEMA_VERSION) {
    return fail(
      `El documento usa la versión de esquema ${schemaVersion} y este renderizador entiende la ${DESIGN_SCHEMA_VERSION}. Migralo antes de leerlo.`,
    );
  }

  const metadata = esObjeto(raw.metadata) ? raw.metadata : null;
  const nombre = metadata ? texto(metadata.name) : null;
  if (!nombre) e.add("El documento tiene que tener un nombre.");
  const descripcion = metadata ? texto(metadata.description) : null;

  const format = leerFormato(raw.format, e);

  if (!Array.isArray(raw.sides) || raw.sides.length === 0) {
    e.add("El documento tiene que tener al menos una cara.");
    return fail(...e.list);
  }

  const sides: DesignSide[] = [];
  const idsVistos = new Set<string>();
  raw.sides.forEach((s, i) => {
    const cara = leerCara(s, i, e);
    if (!cara) return;
    if (idsVistos.has(cara.id)) {
      e.add(`El identificador de cara "${cara.id}" está repetido.`);
      return;
    }
    idsVistos.add(cara.id);
    sides.push(cara);
  });

  if (e.list.length > 0 || !format || !nombre) {
    return fail(...(e.list.length > 0 ? e.list : ["El documento no se pudo leer."]));
  }

  return ok({
    schemaVersion: DESIGN_SCHEMA_VERSION,
    metadata: { name: nombre, ...(descripcion ? { description: descripcion } : {}) },
    format,
    sides,
  });
}
