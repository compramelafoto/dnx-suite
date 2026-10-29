/**
 * Convierte un producto (diploma, calendario…) en las filas que guarda el diseñador, con ids
 * fijos (`sys_<tipo>_<slug>`) para que el SQL se pueda correr más de una vez. Es la versión
 * plana de `definirPlantilla` (la de los libritos): sin doblez, con el tamaño de su formato.
 */
import { caja, vinculosYFotos, type FilaAsset, type FilaBloque, type PlantillaSistema } from "../definiciones";
import { Armador, CARPETA_R2, VARIABLE_LOGO } from "../lienzo";
import { CATEGORIAS } from "../modelos/tipo";
import { Hoja } from "./hoja";
import { PREFIJO, type ModeloProducto } from "./tipo";

export const idsDeProducto = (m: Pick<ModeloProducto, "tipo" | "slug">) => {
  const templateId = `sys_${PREFIJO[m.tipo]}_${m.slug.replace(/-/g, "_")}`;
  return { templateId, versionId: `${templateId}_v1`, publicationId: `${templateId}_pub` };
};

export const archivoDeHoja = (m: Pick<ModeloProducto, "tipo" | "slug">, i: number) =>
  `${PREFIJO[m.tipo]}-${m.slug}-hoja-${i + 1}.jpg`;

/** Los datos de la plantilla que no pueden faltar según el producto. */
const DATOS_OBLIGATORIOS: Partial<Record<ModeloProducto["tipo"], string[]>> = {
  Diploma: ["diploma.title", "diploma.reason", "diploma.date", "student.fullName"],
  Calendario: ["calendar.grid"],
};

export function definirProducto(modelo: ModeloProducto): PlantillaSistema {
  const { templateId, versionId, publicationId } = idsDeProducto(modelo);
  const h = new Hoja(modelo.formato);
  const a = new Armador();
  modelo.hojas.forEach((hoja, i) => a.fondo(i, archivoDeHoja(modelo, i), { w: h.w, h: h.h, nombre: `Fondo · ${hoja.nombre}` }));
  modelo.armar(a, h);

  const bloques: FilaBloque[] = a.bloques.map((b) => ({
    id: `${versionId}_${b.clave}`,
    pageIndex: b.pagina,
    type: b.tipo,
    name: b.nombre,
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    rotation: b.rotation,
    zIndex: b.zIndex,
    opacity: b.opacity,
    locked: b.locked,
    visible: true,
    configJson: b.configJson,
  }));
  const { bindings, fotos, photoInputs } = vinculosYFotos(versionId, bloques, modelo.etiquetasDeFotos);
  revisar(modelo, h, bloques, fotos);

  const assets: FilaAsset[] = modelo.hojas.map((_, i) => ({
    id: `${templateId}_fondo_${i + 1}`,
    storageKey: `${CARPETA_R2}/${archivoDeHoja(modelo, i)}`,
    mimeType: "image/jpeg",
    metaJson: { originalName: archivoDeHoja(modelo, i) },
  }));
  const claves = (k: string) => bloques.some((b) => (b.configJson as { variableKey?: string }).variableKey === k);

  return {
    modelo: { slug: `${PREFIJO[modelo.tipo]}-${modelo.slug}`, serie: modelo.serie, filtros: { orientacion: h.apaisada ? "horizontal" : "vertical" } },
    templateId,
    versionId,
    publicationId,
    nombre: modelo.nombre,
    descripcion: modelo.descripcion,
    canvasJson: { dpi: modelo.formato.dpi, width: h.w, height: h.h, background: "#ffffff", safeAreaMm: 5 },
    metaJson: {
      seedId: `plantillas-sistema/${PREFIJO[modelo.tipo]}/${modelo.slug}/v1`,
      system: true,
      version: "v2",
      legacyStyleFlags: { system: true, version: "v2" },
      product: "school",
      tipoProducto: modelo.tipo,
      // No se dobla: el catálogo y el canje lo muestran plano, sin el visor 3D del librito.
      plegado: false,
      categoria: modelo.categoria,
      estilo: modelo.estilo,
      orientacion: h.apaisada ? "horizontal" : "vertical",
      cantidadFotos: fotos.length,
      conListado: claves("course.studentList"),
      conMosaico: claves("course.mosaic"),
      conLogo: bindings.some((b) => b.variableKey === VARIABLE_LOGO),
      ...(modelo.evento ? { evento: modelo.evento } : {}),
      etiquetas: modelo.etiquetas,
      templatePageCount: modelo.hojas.length,
      pageLabels: modelo.hojas.map((x) => x.nombre),
      guides: { h: [], v: [] },
      physicalTrimMm: { width: modelo.formato.anchoMm, height: modelo.formato.altoMm },
      safeMarginMm: 5,
      photoInputs,
    },
    bloques,
    bindings,
    assets,
    fondos: modelo.hojas.map((hoja, i) => ({ archivo: archivoDeHoja(modelo, i), pagina: hoja.nombre, svg: () => hoja.fondo(h) })),
    notaDeRevision: `Plantilla de sistema: ${modelo.tipo.toLowerCase()} ${modelo.formato.nombre}.`,
    tamFondo: { w: h.w, h: h.h },
  };
}

/**
 * Las reglas de impresión: textos y fotos dentro de la hoja, textos a más de 5 mm del corte, sin
 * huecos de foto sin pedir y con los datos que el producto necesita.
 */
function revisar(modelo: ModeloProducto, h: Hoja, bloques: FilaBloque[], fotos: string[]) {
  const errores: string[] = [];
  if (!(CATEGORIAS as readonly string[]).includes(modelo.categoria)) errores.push(`categoría «${modelo.categoria}» desconocida`);
  const seg = h.seguridad;
  for (const b of bloques) {
    if (b.locked) continue;
    if (b.pageIndex < 0 || b.pageIndex >= modelo.hojas.length) errores.push(`${b.name}: en una hoja que no existe (${b.pageIndex})`);
    const k = caja(b);
    const esTexto = b.type === "TEXT" || b.type === "VARIABLE_TEXT";
    if (esTexto && (k.x0 < seg - 1 || k.y0 < seg - 1 || k.x1 > h.w - seg + 1 || k.y1 > h.h - seg + 1)) {
      errores.push(`${b.name}: a menos de 5 mm del corte`);
    }
    if (b.type === "IMAGE" && (k.x0 < -2 || k.y0 < -2 || k.x1 > h.w + 2 || k.y1 > h.h + 2)) errores.push(`${b.name}: se sale de la hoja`);
  }
  for (const k of DATOS_OBLIGATORIOS[modelo.tipo] ?? []) {
    if (!bloques.some((b) => (b.configJson as { variableKey?: string }).variableKey === k)) errores.push(`le falta el dato ${k}`);
  }
  if (modelo.tipo === "Diploma") {
    for (const b of bloques) {
      const c = b.configJson as { variableKey?: string; fallback?: string };
      if (c.variableKey?.startsWith("diploma.") && !c.fallback?.trim()) errores.push(`${b.name}: sin texto de fábrica`);
    }
  }
  // Un diploma o un calendario pueden ir sin foto; los demás productos son para mostrar fotos.
  if (modelo.tipo !== "Calendario" && modelo.tipo !== "Diploma" && fotos.length === 0 && !bloques.some((b) => (b.configJson as { variableKey?: string }).variableKey === "course.mosaic")) {
    errores.push("no tiene huecos de foto");
  }
  if (errores.length) throw new Error(`${modelo.tipo} ${modelo.slug}:\n  - ${errores.join("\n  - ")}`);
}
