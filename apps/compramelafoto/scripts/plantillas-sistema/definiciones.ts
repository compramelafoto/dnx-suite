/**
 * Convierte cada modelo en las filas que guarda el diseñador (TemplateV2 y compañía), con ids
 * fijos para que el SQL se pueda correr más de una vez.
 */
import { ALTO, ANCHO, Armador, CARPETA_R2, DPI, PLIEGUE } from "./lienzo";
import { archivoFondo, type Modelo } from "./modelos/tipo";
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
  const bindings: FilaBinding[] = bloques
    .filter((b) => b.type === "IMAGE")
    .map((b) => ({ b, key: String((b.configJson.source as { variableKey?: string })?.variableKey ?? "") }))
    .filter(({ key }) => key === "photo_individual" || key === "photo_group")
    .map(({ b, key }, i) => ({ id: `vb-${versionId}-${i + 1}`, blockId: b.id, targetPath: "src", variableKey: key }));

  const fotos = new Set(bindings.map((b) => b.variableKey));
  if (!fotos.has("photo_individual") || !fotos.has("photo_group")) {
    throw new Error(`${modelo.slug}: faltan los huecos de foto individual y grupal.`);
  }

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
      templatePageCount: 2,
      pageLabels: ["Exterior (contratapa + tapa)", "Interior"],
      guides: { h: [], v: [PLIEGUE] },
      physicalTrimMm: { width: 300, height: 200 },
      safeMarginMm: 5,
      foldGuideMmFromLeft: 150,
      foldNoTextHalfWidthMm: 10,
      photoInputs: [
        { slotKey: "photo_individual", label: "Foto individual", pageIndex: 1, role: "single" },
        { slotKey: "photo_group", label: "Foto grupal", pageIndex: 1, role: "group" },
      ],
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

export function todasLasPlantillas(): PlantillaSistema[] {
  const slugs = new Set<string>();
  return MODELOS.map((m) => {
    if (slugs.has(m.slug)) throw new Error(`Slug repetido: ${m.slug}`);
    slugs.add(m.slug);
    return definirPlantilla(m);
  });
}
