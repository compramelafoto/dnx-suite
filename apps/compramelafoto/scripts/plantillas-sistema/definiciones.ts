/**
 * Convierte cada modelo en las filas que guarda el diseñador (TemplateV2 y compañía), con ids
 * fijos para que el SQL se pueda correr más de una vez.
 */
import { ALTO, ANCHO, Armador, CARPETA_R2, DPI, FOTOS, PLIEGUE, SEGURIDAD, TUBO_PLIEGUE, VARIABLE_LOGO, type RolFoto } from "./lienzo";
import { archivoFondo, CATEGORIAS, type Modelo } from "./modelos/tipo";
import { MODELOS } from "./modelos";

export type FilaBloque = {
  id: string;
  pageIndex: number;
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  configJson: Record<string, unknown>;
};

export type FilaBinding = {
  id: string;
  blockId: string;
  targetPath: string;
  variableKey: string;
};

export type FilaAsset = {
  id: string;
  storageKey: string;
  mimeType: string;
  metaJson: Record<string, unknown>;
};

export type PlantillaSistema = {
  modelo: Modelo;
  templateId: string;
  versionId: string;
  publicationId: string;
  nombre: string;
  descripcion: string;
  canvasJson: Record<string, unknown>;
  metaJson: Record<string, unknown>;
  bloques: FilaBloque[];
  bindings: FilaBinding[];
  assets: FilaAsset[];
  fondos: Array<{ archivo: string; pagina: "exterior" | "interior"; svg: () => string }>;
};

export const ids = (slug: string) => {
  const templateId = `sys_librito_${slug.replace(/-/g, "_")}`;
  return { templateId, versionId: `${templateId}_v1`, publicationId: `${templateId}_pub` };
};

/**
 * Los campos de filtro del catálogo (`estilo`, `orientacion`, `cantidadFotos`, `conListado`, `conMosaico`,
 * `conLogo`, `evento`, `etiquetas`). Sólo para los modelos que declaran `filtros`: los ya
 * cargados quedan con el mismo metaJson.
 */
function filtrosDelCatalogo(modelo: Modelo, bloques: FilaBloque[], bindings: FilaBinding[]): Record<string, unknown> {
  if (!modelo.filtros) return {};
  const fotos = new Set(bindings.filter((b) => b.variableKey.startsWith("photo_")).map((b) => b.variableKey));
  return {
    estilo: modelo.filtros.estilo,
    // El lienzo abierto siempre es apaisado: lo que importa es cómo se lee el librito cerrado.
    orientacion: modelo.filtros.orientacion ?? "vertical",
    cantidadFotos: fotos.size,
    conListado: bloques.some((b) => (b.configJson as { variableKey?: string }).variableKey === "course.studentList"),
    conMosaico: bloques.some((b) => (b.configJson as { variableKey?: string }).variableKey === "course.mosaic"),
    conLogo: bindings.some((b) => b.variableKey === VARIABLE_LOGO),
    ...(modelo.filtros.evento ? { evento: modelo.filtros.evento } : {}),
    etiquetas: modelo.filtros.etiquetas,
  };
}

export function definirPlantilla(modelo: Modelo): PlantillaSistema {
  const { templateId, versionId, publicationId } = ids(modelo.slug);
  const exterior = archivoFondo(modelo.slug, "exterior");
  const interior = archivoFondo(modelo.slug, "interior");

  const a = new Armador();
  a.fondo(0, exterior);
  a.fondo(1, interior);
  modelo.armar(a);

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

  // Los huecos de foto llevan su vínculo `src` → variable, igual que los guarda el editor.
  const claveDeFoto = new Map<string, (typeof FOTOS)[keyof typeof FOTOS]>(Object.values(FOTOS).map((f) => [f.variableKey, f]));
  const bindings: FilaBinding[] = bloques
    .filter((b) => b.type === "IMAGE")
    .map((b) => ({ b, key: String((b.configJson.source as { variableKey?: string })?.variableKey ?? "") }))
    .filter(({ key }) => claveDeFoto.has(key))
    .map(({ b, key }, i) => ({ id: `vb-${versionId}-${i + 1}`, blockId: b.id, targetPath: "src", variableKey: key }));

  // El logo del colegio lleva el mismo vínculo `src` que le pone el editor al elegir «Logo escuela».
  for (const b of bloques) {
    const key = String((b.configJson.source as { variableKey?: string })?.variableKey ?? "");
    if (b.type === "IMAGE" && key === VARIABLE_LOGO) {
      bindings.push({ id: `vb-${versionId}-${b.id.slice(versionId.length + 1)}`, blockId: b.id, targetPath: "src", variableKey: key });
    }
  }

  // Lo que se le pide a la familia: una entrada por foto distinta, en el orden en que la elige.
  const orden = Object.values(FOTOS).map((f) => f.variableKey as string);
  const fotos = [...new Set(bindings.map((b) => b.variableKey).filter((k) => claveDeFoto.has(k)))].sort((x, y) => orden.indexOf(x) - orden.indexOf(y));
  const photoInputs = fotos.map((key) => {
    const f = claveDeFoto.get(key)!;
    const primera = bloques.find((b) => bindings.some((v) => v.blockId === b.id && v.variableKey === key))!;
    // El modelo puede nombrar la foto a su manera («Foto con la catequista» en vez de «con la maestra»).
    const rol = (Object.keys(FOTOS) as RolFoto[]).find((r) => FOTOS[r].variableKey === key)!;
    return { slotKey: key, label: modelo.etiquetasDeFotos?.[rol] ?? f.nombre, pageIndex: primera.pageIndex, role: f.rolMeta };
  });
  if (!modelo.filtros && (!fotos.includes("photo_individual") || !fotos.includes("photo_group"))) {
    throw new Error(`${modelo.slug}: faltan los huecos de foto individual y grupal.`);
  }
  if (fotos.length === 0) throw new Error(`${modelo.slug}: no tiene huecos de foto.`);
  if (modelo.filtros) revisarReglas(modelo, bloques);


  const assets: FilaAsset[] = [
    { id: `${templateId}_fondo_exterior`, storageKey: `${CARPETA_R2}/${exterior}`, mimeType: "image/jpeg", metaJson: { originalName: exterior } },
    { id: `${templateId}_fondo_interior`, storageKey: `${CARPETA_R2}/${interior}`, mimeType: "image/jpeg", metaJson: { originalName: interior } },
  ];

  return {
    modelo,
    templateId,
    versionId,
    publicationId,
    nombre: modelo.nombre,
    descripcion: modelo.descripcion,
    canvasJson: { dpi: DPI, width: ANCHO, height: ALTO, background: "#ffffff", safeAreaMm: 5 },
    metaJson: {
      seedId: `plantillas-sistema/librito/${modelo.slug}/v1`,
      system: true,
      version: "v2",
      legacyStyleFlags: { system: true, version: "v2" },
      product: "school",
      categoria: modelo.categoria,
      ...filtrosDelCatalogo(modelo, bloques, bindings),
      templatePageCount: 2,
      pageLabels: ["Exterior (contratapa + tapa)", "Interior"],
      guides: { h: [], v: [PLIEGUE] },
      physicalTrimMm: { width: 300, height: 200 },
      safeMarginMm: 5,
      foldGuideMmFromLeft: 150,
      foldNoTextHalfWidthMm: 10,
      photoInputs,
    },
    bloques,
    bindings,
    assets,
    fondos: [
      { archivo: exterior, pagina: "exterior", svg: modelo.fondoExterior },
      { archivo: interior, pagina: "interior", svg: modelo.fondoInterior },
    ],
  };
}

/** La caja que ocupa un bloque girado sobre su centro. */
function caja(b: FilaBloque) {
  const a = (b.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const w = b.width * c + b.height * s;
  const h = b.width * s + b.height * c;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 };
}

/** Lleva un ángulo a (-180, 180]. */
const normalizar = (g: number) => {
  const r = ((g % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
};

/**
 * Las reglas de impresión de los libritos, para los modelos con filtros:
 * - Los textos quedan a más de 5 mm del corte y a más de 10 mm del doblez.
 * - Ninguna foto cruza el doblez (cada una es de una mitad).
 * - Todos los textos de una cara miran para el mismo lado: 0° en los verticales; en los
 *   apaisados -90° la tapa y el interior y +90° la contratapa. Así el visor 3D la endereza.
 */
function revisarReglas(modelo: Modelo, bloques: FilaBloque[]) {
  const errores: string[] = [];
  const apaisado = modelo.filtros!.orientacion === "horizontal";
  if (!(CATEGORIAS as readonly string[]).includes(modelo.categoria)) errores.push(`categoría «${modelo.categoria}» desconocida`);
  for (const b of bloques) {
    if (b.locked) continue;
    const k = caja(b);
    const esTexto = b.type === "TEXT" || b.type === "VARIABLE_TEXT";
    const esFoto = b.type === "IMAGE";
    if (esTexto) {
      if (k.x0 < SEGURIDAD - 1 || k.y0 < SEGURIDAD - 1 || k.x1 > ANCHO - SEGURIDAD + 1 || k.y1 > ALTO - SEGURIDAD + 1) {
        errores.push(`${b.name}: a menos de 5 mm del corte`);
      }
      if (k.x1 > PLIEGUE - TUBO_PLIEGUE && k.x0 < PLIEGUE + TUBO_PLIEGUE) errores.push(`${b.name}: a menos de 10 mm del doblez`);
      const cx = (k.x0 + k.x1) / 2;
      const esperado = !apaisado ? 0 : b.pageIndex === 1 ? -90 : cx < PLIEGUE ? 90 : -90;
      const giro = normalizar(Math.round(b.rotation / 90) * 90);
      if (giro !== esperado) errores.push(`${b.name}: mira a ${giro}° y su cara a ${esperado}°`);
    }
    if (esFoto && k.x0 < PLIEGUE - 2 && k.x1 > PLIEGUE + 2) errores.push(`${b.name}: cruza el doblez`);
  }
  // El visor 3D endereza cada cara mirando sus textos: en un apaisado, cada cara necesita alguno.
  if (apaisado) {
    const textos = bloques.filter((b) => b.type === "TEXT" || b.type === "VARIABLE_TEXT").map((b) => ({ b, k: caja(b) }));
    if (!textos.some(({ b, k }) => b.pageIndex === 0 && k.x0 >= PLIEGUE)) errores.push("la tapa no tiene textos");
    if (!textos.some(({ b, k }) => b.pageIndex === 0 && k.x1 <= PLIEGUE)) errores.push("la contratapa no tiene textos");
    if (!textos.some(({ b }) => b.pageIndex === 1)) errores.push("el interior no tiene textos");
  }
  if (errores.length) throw new Error(`${modelo.slug}:\n  - ${errores.join("\n  - ")}`);
}

/**
 * Todas las plantillas, o las de los modelos `desde`–`hasta` (números de la lista, desde 1: los
 * 10 primeros ya están cargados; `--desde=11 --hasta=20` son los formales). Los slugs se
 * controlan sobre la lista completa.
 */
export function todasLasPlantillas(rango?: { desde?: number; hasta?: number }): PlantillaSistema[] {
  const slugs = new Set<string>();
  for (const m of MODELOS) {
    if (slugs.has(m.slug)) throw new Error(`Slug repetido: ${m.slug}`);
    slugs.add(m.slug);
  }
  const desde = rango?.desde ?? 1;
  const hasta = rango?.hasta ?? MODELOS.length;
  return MODELOS.slice(desde - 1, hasta).map(definirPlantilla);
}
