import {
  autoAssignClientPhotos,
  normalizePhotoCrop,
  type ClientPhotoSlot,
  type PhotoCrop,
  type SlotAssignment,
} from "@repo/template-editor-core";

/**
 * Lo que guarda un diseño armado con el diseñador nuevo (`DesignRevision.dataJson`).
 *
 * `schemaVersion: 4` lo distingue de los diseños del motor viejo (versión 3, con huecos
 * numéricos de `TemplateSlot`). Puro: lo usan la pantalla, las rutas y los tests.
 */
export const DESIGN_V2_SCHEMA_VERSION = 4;

export type DesignV2Export = {
  pdfUrl: string | null;
  jpgUrls: string[];
  generatedAt: string;
};

export type DesignV2Data = {
  schemaVersion: typeof DESIGN_V2_SCHEMA_VERSION;
  engine: "TEMPLATE_V2";
  templateV2Id: string;
  templateV2VersionId: string;
  /** Las fotos que eligió el cliente, en el orden en que las eligió: el banco para corregir. */
  photoIds: number[];
  slots: Record<string, SlotAssignment>;
  /** Textos que reemplazan variables de la plantilla (alumno, escuela, comprador…). */
  values: Record<string, string>;
  export: DesignV2Export | null;
  exportError: string | null;
};

export function buildInitialDesignData(input: {
  templateV2Id: string;
  templateV2VersionId: string;
  slots: ClientPhotoSlot[];
  photoIds: number[];
  values?: Record<string, string>;
}): DesignV2Data {
  return {
    schemaVersion: DESIGN_V2_SCHEMA_VERSION,
    engine: "TEMPLATE_V2",
    templateV2Id: input.templateV2Id,
    templateV2VersionId: input.templateV2VersionId,
    photoIds: [...input.photoIds],
    slots: autoAssignClientPhotos(input.slots, input.photoIds),
    values: { ...(input.values ?? {}) },
    export: null,
    exportError: null,
  };
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function isDesignV2Data(raw: unknown): boolean {
  const r = asRecord(raw);
  return r.schemaVersion === DESIGN_V2_SCHEMA_VERSION && r.engine === "TEMPLATE_V2";
}

/** Lee el JSON guardado tolerando campos faltantes o rotos. Null si no es un diseño V2. */
export function parseDesignV2Data(raw: unknown): DesignV2Data | null {
  if (!isDesignV2Data(raw)) return null;
  const r = asRecord(raw);
  const photoIds = Array.isArray(r.photoIds)
    ? r.photoIds.filter((n): n is number => typeof n === "number" && Number.isInteger(n))
    : [];
  const slots: Record<string, SlotAssignment> = {};
  for (const [blockId, value] of Object.entries(asRecord(r.slots))) {
    const v = asRecord(value);
    slots[blockId] = {
      photoId: typeof v.photoId === "number" && Number.isInteger(v.photoId) ? v.photoId : null,
      crop: normalizePhotoCrop(v.crop),
    };
  }
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(asRecord(r.values))) {
    if (typeof v === "string") values[k] = v;
  }
  const exp = asRecord(r.export);
  return {
    schemaVersion: DESIGN_V2_SCHEMA_VERSION,
    engine: "TEMPLATE_V2",
    templateV2Id: typeof r.templateV2Id === "string" ? r.templateV2Id : "",
    templateV2VersionId: typeof r.templateV2VersionId === "string" ? r.templateV2VersionId : "",
    photoIds,
    slots,
    values,
    export:
      typeof exp.generatedAt === "string"
        ? {
            pdfUrl: typeof exp.pdfUrl === "string" ? exp.pdfUrl : null,
            jpgUrls: Array.isArray(exp.jpgUrls)
              ? exp.jpgUrls.filter((u): u is string => typeof u === "string")
              : [],
            generatedAt: exp.generatedAt,
          }
        : null,
    exportError: typeof r.exportError === "string" ? r.exportError : null,
  };
}

/**
 * Cambios que el fotógrafo hace en la revisión. Se validan contra el banco de fotos del cliente:
 * no se puede poner en el diseño una foto que el cliente no eligió.
 */
export type DesignV2Edit =
  | { kind: "set-photo"; blockId: string; photoId: number | null }
  | { kind: "swap"; blockIdA: string; blockIdB: string }
  | { kind: "set-crop"; blockId: string; crop: PhotoCrop }
  | { kind: "set-value"; key: string; value: string | null }
  | { kind: "reset"; slots: ClientPhotoSlot[] };

export type ApplyEditResult = { ok: true; data: DesignV2Data } | { ok: false; error: string };

export function applyDesignV2Edit(data: DesignV2Data, edit: DesignV2Edit): ApplyEditResult {
  const next: DesignV2Data = {
    ...data,
    slots: { ...data.slots },
    values: { ...data.values },
    // Cualquier cambio deja vieja la exportación: hay que volver a aprobar.
    export: null,
    exportError: null,
  };

  switch (edit.kind) {
    case "set-photo": {
      if (!next.slots[edit.blockId]) return { ok: false, error: "Ese hueco no existe en el diseño." };
      if (edit.photoId != null && !data.photoIds.includes(edit.photoId)) {
        return { ok: false, error: "Esa foto no está entre las que eligió el cliente." };
      }
      next.slots[edit.blockId] = { photoId: edit.photoId, crop: { zoom: 1, x: 0, y: 0 } };
      return { ok: true, data: next };
    }
    case "swap": {
      const a = next.slots[edit.blockIdA];
      const b = next.slots[edit.blockIdB];
      if (!a || !b) return { ok: false, error: "Ese hueco no existe en el diseño." };
      next.slots[edit.blockIdA] = { photoId: b.photoId, crop: { zoom: 1, x: 0, y: 0 } };
      next.slots[edit.blockIdB] = { photoId: a.photoId, crop: { zoom: 1, x: 0, y: 0 } };
      return { ok: true, data: next };
    }
    case "set-crop": {
      const slot = next.slots[edit.blockId];
      if (!slot) return { ok: false, error: "Ese hueco no existe en el diseño." };
      next.slots[edit.blockId] = { ...slot, crop: normalizePhotoCrop(edit.crop) };
      return { ok: true, data: next };
    }
    case "set-value": {
      const key = edit.key.trim();
      if (!key) return { ok: false, error: "Falta el nombre del dato." };
      if (edit.value == null || edit.value.trim() === "") delete next.values[key];
      else next.values[key] = edit.value.slice(0, 500);
      return { ok: true, data: next };
    }
    case "reset": {
      next.slots = autoAssignClientPhotos(edit.slots, data.photoIds);
      return { ok: true, data: next };
    }
  }
}

/** Huecos que quedaron sin foto: no impiden aprobar, pero se avisan. */
export function emptySlotIds(data: DesignV2Data): string[] {
  return Object.entries(data.slots)
    .filter(([, s]) => s.photoId == null)
    .map(([id]) => id);
}
