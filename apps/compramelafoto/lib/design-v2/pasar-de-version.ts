import { DEFAULT_PHOTO_CROP, type ClientPhotoSlot } from "@repo/template-editor-core";
import type { DesignV2Data } from "./design-data";

/**
 * Pasa un diseño armado a otra versión de su plantilla conservando lo que eligió el cliente: la
 * foto y el encuadre de cada hueco, los textos y el banco de fotos.
 *
 * Los huecos de la versión nueva tienen otros ids (en la base el id de un bloque es único entre
 * todas las versiones); `blockIdMap` dice qué id nuevo le tocó a cada uno. Sale de la meta de la
 * versión nueva (ver `template-v2-version-lineage.ts` en el editor).
 *
 * Si un hueco que tenía foto ya no existe en la versión nueva, el diseño no se pasa: perdería
 * una foto que eligió la familia y eso lo tiene que decidir una persona. Un hueco vacío que
 * desapareció no se pierde nada. Los huecos nuevos quedan vacíos para que el fotógrafo los
 * complete en la revisión.
 *
 * Puro: lo usan el servidor y los tests.
 */

export type PasarDeVersionResultado =
  | { ok: true; data: DesignV2Data; huecosNuevos: string[] }
  | { ok: false; motivo: string; huecosPerdidos: string[] };

export function pasarDisenoDeVersion(
  data: DesignV2Data,
  destino: {
    versionId: string;
    /** id del hueco en la versión del diseño → id en la de destino. */
    blockIdMap: Readonly<Record<string, string>>;
    /** Los huecos de foto del cliente en la versión de destino. */
    slots: readonly ClientPhotoSlot[];
  },
): PasarDeVersionResultado {
  const destinoIds = new Set(destino.slots.map((s) => s.blockId));
  const slots: DesignV2Data["slots"] = {};
  const perdidos: string[] = [];

  for (const [blockId, assignment] of Object.entries(data.slots)) {
    const nuevoId = destino.blockIdMap[blockId];
    if (nuevoId && destinoIds.has(nuevoId)) {
      slots[nuevoId] = { photoId: assignment.photoId, crop: { ...assignment.crop } };
    } else if (assignment.photoId != null) {
      perdidos.push(blockId);
    }
  }

  if (perdidos.length > 0) {
    return {
      ok: false,
      motivo:
        perdidos.length === 1
          ? "La versión nueva no tiene uno de los huecos con foto de este diseño."
          : `La versión nueva no tiene ${perdidos.length} de los huecos con foto de este diseño.`,
      huecosPerdidos: perdidos,
    };
  }

  const huecosNuevos: string[] = [];
  for (const slot of destino.slots) {
    if (!slots[slot.blockId]) {
      slots[slot.blockId] = { photoId: null, crop: { ...DEFAULT_PHOTO_CROP } };
      huecosNuevos.push(slot.blockId);
    }
  }

  return {
    ok: true,
    huecosNuevos,
    data: {
      ...data,
      templateV2VersionId: destino.versionId,
      slots,
      values: { ...data.values },
      photoIds: [...data.photoIds],
      // El archivo generado era de la versión vieja: se vuelve a generar al aprobar.
      export: null,
      exportError: null,
    },
  };
}
