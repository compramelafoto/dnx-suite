import type { PhotoOverride } from "@repo/template-editor-ui";
import { clientPhotoSlotNumber, huecosSinFondo, imageBlockVariableKey, type TemplateV2Block } from "@repo/template-editor-core";
import type { DesignV2Data } from "./design-data";

/**
 * Lo que se dibuja de un diseño en el navegador. Lo comparten el editor y el visor del librito
 * para que los dos muestren exactamente lo mismo que se imprime.
 */

/**
 * Una imagen atada a un dato que no llegó (el logo de la escuela, si la escuela no lo cargó) no
 * sale en el archivo final, así que tampoco se muestra como recuadro gris.
 */
export function visibleDesignBlocks(blocks: TemplateV2Block[], values: DesignV2Data["values"]): TemplateV2Block[] {
  return blocks.filter((b) => {
    if (b.type !== "IMAGE" && b.type !== "PHOTO") return true;
    if (clientPhotoSlotNumber(b) != null) return true;
    const key = imageBlockVariableKey(b.configJson);
    return !key || Boolean(values[key]?.trim());
  });
}

/** Cada hueco con foto, con su encuadre: lo que el renderer pone en lugar de la imagen de la plantilla. */
export function designPhotoOverrides(
  slots: DesignV2Data["slots"],
  photoUrlById: Map<number, string | null>,
  /** Los huecos «Quitar el fondo» y los recortes listos: ahí va el recorte, como al imprimir. */
  sinFondo?: { huecos: ReadonlySet<string>; recorteById: Map<number, string> },
): Record<string, PhotoOverride> {
  const result: Record<string, PhotoOverride> = {};
  for (const [blockId, s] of Object.entries(slots)) {
    const recorte = s.photoId != null && sinFondo?.huecos.has(blockId) ? sinFondo.recorteById.get(s.photoId) : undefined;
    const url = recorte ?? (s.photoId != null ? photoUrlById.get(s.photoId) : null);
    if (url) result[blockId] = { src: url, crop: s.crop };
  }
  return result;
}

/** Lo que necesita `designPhotoOverrides` para mostrar los recortes sin fondo. */
export function sinFondoDelDiseno(
  blocks: ReadonlyArray<{ id: string; type: string; configJson?: unknown }>,
  photos: ReadonlyArray<{ id: number; cutout?: { status: string; url: string | null } }>,
) {
  return {
    huecos: huecosSinFondo(blocks),
    recorteById: new Map(
      photos.flatMap((p) => (p.cutout?.status === "READY" && p.cutout.url ? [[p.id, p.cutout.url] as const] : [])),
    ),
  };
}
