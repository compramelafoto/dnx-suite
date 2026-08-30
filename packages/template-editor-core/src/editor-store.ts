import { getBlockDisplayName } from "./block-display-name";
import { clampBlockPosition } from "./clamp-block-position";
import type {
  TemplateV2Block,
  TemplateV2BlockLayout,
  TemplateV2Canvas,
} from "./render-core";

export type TemplateV2EditorLoadStatus = "idle" | "loading" | "ready" | "error";
export type TemplateV2EditorSaveStatus = "idle" | "saving" | "saved" | "error";

export type TemplateV2VariableBinding = {
  id?: string;
  blockId: string;
  targetPath: string;
  variableKey: string;
  formatter?: string;
  fallbackOverride?: string | null;
};

/** Snapshot interno para copiar/pegar bloques (mismo editor). */
export type TemplateV2ClipboardSnapshot = {
  block: TemplateV2Block;
  bindings: TemplateV2VariableBinding[];
};

export type TemplateV2EditorPan = {
  x: number;
  y: number;
};

/** Snapshot solo de datos persistibles (undo/redo); no incluye zoom/pan/selección. */
export type TemplateV2PersistSnapshot = {
  canvas: TemplateV2Canvas;
  blocks: TemplateV2Block[];
  variableBindings: TemplateV2VariableBinding[];
  /** Meta de versión (servidor) excepto `templatePageCount` que se fusiona al guardar. */
  versionMeta: Record<string, unknown>;
  activePageIndex: number;
  templatePageCount: number;
  isDirty: boolean;
  revision: number;
  lastSavedAt: string | null;
};

export type TemplateV2EditorState = {
  templateId: string | null;
  versionId: string | null;
  revision: number;
  canvas: TemplateV2Canvas;
  blocks: TemplateV2Block[];
  variableBindings: TemplateV2VariableBinding[];
  /** Orden: el último es el “primario” (inspector, handles en canvas). */
  selectedBlockIds: string[];
  hoveredBlockId: string | null;
  zoom: number;
  /** True si el usuario cambió el zoom (toolbar/atajos); evita autoajuste al redimensionar el panel. */
  zoomUserAdjusted: boolean;
  pan: TemplateV2EditorPan;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;
  loadStatus: TemplateV2EditorLoadStatus;
  saveStatus: TemplateV2EditorSaveStatus;
  /** Historial undo: estados persistibles anteriores (más reciente al final). */
  historyPast: TemplateV2PersistSnapshot[];
  /** Historial redo. */
  historyFuture: TemplateV2PersistSnapshot[];
  /** Meta cruda de la versión (GET save); al persistir se unifica con `templatePageCount`. */
  versionMeta: Record<string, unknown>;
  /** Hoja visible en el editor (0-based). */
  activePageIndex: number;
  /** Cantidad de hojas declarada (>= bloques en la última hoja usada). */
  templatePageCount: number;
};

export type InitializeEditorInput = {
  templateId: string;
  versionId: string;
  revision: number;
  canvas: TemplateV2Canvas;
  blocks: TemplateV2Block[];
  variableBindings?: TemplateV2VariableBinding[];
  lastSavedAt?: string | null;
  meta?: Record<string, unknown>;
};

export type UpdateBlockPatch = {
  type?: TemplateV2Block["type"];
  name?: string | null;
  layout?: Partial<TemplateV2BlockLayout>;
  configJson?: Record<string, unknown>;
};

export type TemplateV2EditorAction =
  | { type: "initialize"; payload: InitializeEditorInput }
  | { type: "setSelectedBlockIds"; payload: { ids: string[] } }
  | { type: "toggleBlockInSelection"; payload: { blockId: string } }
  | { type: "hoverBlock"; payload: { blockId: string | null } }
  | { type: "setBlocks"; payload: { blocks: TemplateV2Block[] } }
  | { type: "updateBlock"; payload: { blockId: string; patch: UpdateBlockPatch; skipHistory?: boolean } }
  | { type: "addBlock"; payload: { block: TemplateV2Block } }
  | { type: "removeBlock"; payload: { blockId: string } }
  | { type: "removeBlocks"; payload: { blockIds: string[] } }
  | {
      type: "duplicateBlock";
      payload: {
        blockId: string;
        samePosition?: boolean;
        newBlockId?: string;
        skipHistory?: boolean;
      };
    }
  | { type: "pasteBlockFromClipboard"; payload: { snapshot: TemplateV2ClipboardSnapshot } }
  | { type: "setZoom"; payload: { zoom: number; source?: "user" | "auto" | "fit" } }
  | { type: "setPan"; payload: { pan: Partial<TemplateV2EditorPan> } }
  | { type: "setCanvas"; payload: { canvas: Partial<TemplateV2Canvas> } }
  | { type: "setVariableBindings"; payload: { variableBindings: TemplateV2VariableBinding[] } }
  | { type: "markDirty" }
  | { type: "markSaved"; payload?: { at?: string | null; revision?: number } }
  /** Sincroniza la revisión con el servidor (p. ej. tras 409) sin marcar cambios ni tocar el historial. */
  | { type: "syncRevisionFromServer"; payload: { revision: number } }
  | { type: "setSaving"; payload: { isSaving: boolean } }
  | { type: "setLoadStatus"; payload: { loadStatus: TemplateV2EditorLoadStatus } }
  | { type: "setSaveStatus"; payload: { saveStatus: TemplateV2EditorSaveStatus } }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "commitHistoryCheckpoint"; payload: { before: TemplateV2PersistSnapshot } }
  | { type: "setActivePageIndex"; payload: { pageIndex: number } }
  | { type: "addTemplatePage" }
  | { type: "removeTemplatePage" }
  | { type: "setPageLabel"; payload: { pageIndex: number; label: string } }
  | { type: "reorderTemplatePages"; payload: { fromIndex: number; toIndex: number } };

export type TemplateV2EditorDispatch = (action: TemplateV2EditorAction) => void;

const DEFAULT_CANVAS: TemplateV2Canvas = {
  width: 1200,
  height: 1800,
  background: "#ffffff",
  dpi: 300,
};

export const TEMPLATE_V2_EDITOR_INITIAL_STATE: TemplateV2EditorState = {
  templateId: null,
  versionId: null,
  revision: 0,
  canvas: DEFAULT_CANVAS,
  blocks: [],
  variableBindings: [],
  selectedBlockIds: [],
  hoveredBlockId: null,
  zoom: 1,
  zoomUserAdjusted: false,
  pan: { x: 0, y: 0 },
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  loadStatus: "idle",
  saveStatus: "idle",
  historyPast: [],
  historyFuture: [],
  versionMeta: {},
  activePageIndex: 0,
  templatePageCount: 1,
};

/** Clave en `versionMeta`: nombres de hoja para UI y export (ej. TAPA, CONTRATAPA). */
export const TEMPLATE_V2_PAGE_LABELS_META_KEY = "pageLabels";

function defaultPageLabelDisplay(i: number): string {
  return `Hoja ${i + 1}`;
}

/** Longitud = pageCount; entradas vacías → "Hoja n". */
export function normalizeTemplatePageLabels(raw: unknown, pageCount: number): string[] {
  const arr = Array.isArray(raw) ? raw.map((x) => (typeof x === "string" ? x.trim() : "")) : [];
  const out: string[] = [];
  for (let i = 0; i < pageCount; i++) {
    const t = arr[i] ?? "";
    out.push(t.length > 0 ? t : defaultPageLabelDisplay(i));
  }
  return out;
}

export function getTemplatePageDisplayLabels(state: TemplateV2EditorState): string[] {
  return normalizeTemplatePageLabels(state.versionMeta[TEMPLATE_V2_PAGE_LABELS_META_KEY], state.templatePageCount);
}

function sortBlocksByZIndex(blocks: TemplateV2Block[]): TemplateV2Block[] {
  return [...blocks].sort((a, b) => a.layout.zIndex - b.layout.zIndex);
}

function clampZoom(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(4, Math.max(0.1, v));
}

export function createEditorBlockId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `block-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }
}

/** Pasos máximos en undo (también acota redo implícito). */
const MAX_UNDO_STEPS = 40;

function cloneBlockForHistory(b: TemplateV2Block): TemplateV2Block {
  try {
    return structuredClone(b);
  } catch {
    return JSON.parse(JSON.stringify(b)) as TemplateV2Block;
  }
}

export function takePersistSnapshot(state: TemplateV2EditorState): TemplateV2PersistSnapshot {
  return {
    canvas: { ...state.canvas },
    blocks: state.blocks.map(cloneBlockForHistory),
    variableBindings: state.variableBindings.map((vb) => ({ ...vb })),
    versionMeta: { ...state.versionMeta },
    activePageIndex: state.activePageIndex,
    templatePageCount: state.templatePageCount,
    isDirty: state.isDirty,
    revision: state.revision,
    lastSavedAt: state.lastSavedAt,
  };
}

function persistSnapshotsEqual(a: TemplateV2PersistSnapshot, b: TemplateV2PersistSnapshot): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function restorePersistIntoState(base: TemplateV2EditorState, snap: TemplateV2PersistSnapshot): TemplateV2EditorState {
  const idSet = new Set(snap.blocks.map((b) => b.id));
  const activePage = snap.activePageIndex ?? 0;
  const onPageIds = new Set(
    snap.blocks.filter((b) => (b.pageIndex ?? 0) === activePage).map((b) => b.id)
  );
  const selectedBlockIds = base.selectedBlockIds.filter((id) => idSet.has(id) && onPageIds.has(id));
  return {
    ...base,
    canvas: { ...snap.canvas },
    blocks: sortBlocksByZIndex(snap.blocks.map(cloneBlockForHistory)),
    variableBindings: snap.variableBindings.map((vb) => ({ ...vb })),
    versionMeta: { ...(snap.versionMeta ?? {}) },
    activePageIndex: activePage,
    templatePageCount: snap.templatePageCount ?? 1,
    isDirty: snap.isDirty,
    revision: snap.revision,
    lastSavedAt: snap.lastSavedAt,
    saveStatus: "idle",
    isSaving: false,
    selectedBlockIds,
    hoveredBlockId:
      base.hoveredBlockId && idSet.has(base.hoveredBlockId) && onPageIds.has(base.hoveredBlockId)
        ? base.hoveredBlockId
        : null,
  };
}

function applyUndo(state: TemplateV2EditorState): TemplateV2EditorState {
  const past = state.historyPast;
  if (past.length === 0) return state;
  const toRestore = past[past.length - 1]!;
  const newPast = past.slice(0, -1);
  const currentSnap = takePersistSnapshot(state);
  const merged = restorePersistIntoState(state, toRestore);
  return {
    ...merged,
    historyPast: newPast,
    historyFuture: [currentSnap, ...state.historyFuture].slice(0, MAX_UNDO_STEPS),
  };
}

function applyRedo(state: TemplateV2EditorState): TemplateV2EditorState {
  const future = state.historyFuture;
  if (future.length === 0) return state;
  const [toRestore, ...restFuture] = future;
  const currentSnap = takePersistSnapshot(state);
  const merged = restorePersistIntoState(state, toRestore!);
  return {
    ...merged,
    historyPast: [...state.historyPast, currentSnap].slice(-MAX_UNDO_STEPS),
    historyFuture: restFuture,
  };
}

function applyCommitCheckpoint(
  state: TemplateV2EditorState,
  action: { type: "commitHistoryCheckpoint"; payload: { before: TemplateV2PersistSnapshot } }
): TemplateV2EditorState {
  const before = action.payload.before;
  const now = takePersistSnapshot(state);
  if (persistSnapshotsEqual(before, now)) return state;
  return {
    ...state,
    historyPast: [...state.historyPast, before].slice(-MAX_UNDO_STEPS),
    historyFuture: [],
  };
}

function shouldRecordHistory(action: TemplateV2EditorAction): boolean {
  switch (action.type) {
    case "setBlocks":
    case "addBlock":
    case "removeBlock":
    case "removeBlocks":
    case "duplicateBlock":
    case "pasteBlockFromClipboard":
    case "setCanvas":
    case "setVariableBindings":
    case "markDirty":
    case "updateBlock":
    case "addTemplatePage":
    case "removeTemplatePage":
    case "setPageLabel":
    case "reorderTemplatePages":
      return true;
    default:
      return false;
  }
}

function coreTemplateV2EditorReducer(
  state: TemplateV2EditorState,
  action: TemplateV2EditorAction
): TemplateV2EditorState {
  switch (action.type) {
    case "initialize": {
      const { templateId, versionId, revision, canvas, blocks, variableBindings, lastSavedAt, meta } = action.payload;
      const serverMeta =
        meta && typeof meta === "object" && !Array.isArray(meta) ? { ...(meta as Record<string, unknown>) } : {};
      const rawBlocks = blocks ?? [];
      const blocksNormalized: TemplateV2Block[] = rawBlocks.map((b) => ({
        ...b,
        pageIndex: b.pageIndex ?? 0,
      }));
      const maxPI = blocksNormalized.reduce((m, b) => Math.max(m, b.pageIndex ?? 0), -1);
      const metaTc = serverMeta.templatePageCount;
      const fromMeta =
        typeof metaTc === "number" && Number.isFinite(metaTc) ? Math.max(1, Math.floor(metaTc as number)) : 0;
      const templatePageCount = Math.max(fromMeta, maxPI + 1, 1);

      const blockIdSet = new Set(blocksNormalized.map((b) => b.id));
      const bindingsRaw = variableBindings ? [...variableBindings] : [];
      const variableBindingsSanitized = bindingsRaw.filter((vb) => blockIdSet.has(vb.blockId));
      const droppedOrphanBindings = bindingsRaw.length > variableBindingsSanitized.length;

      const pageLabels = normalizeTemplatePageLabels(serverMeta[TEMPLATE_V2_PAGE_LABELS_META_KEY], templatePageCount);

      return {
        ...state,
        templateId,
        versionId,
        revision,
        canvas: { ...DEFAULT_CANVAS, ...canvas },
        blocks: sortBlocksByZIndex(blocksNormalized),
        variableBindings: variableBindingsSanitized,
        versionMeta: { ...serverMeta, [TEMPLATE_V2_PAGE_LABELS_META_KEY]: pageLabels },
        activePageIndex: 0,
        templatePageCount,
        selectedBlockIds: [],
        hoveredBlockId: null,
        zoom: 1,
        zoomUserAdjusted: false,
        pan: { x: 0, y: 0 },
        isDirty: droppedOrphanBindings,
        isSaving: false,
        lastSavedAt: lastSavedAt ?? null,
        loadStatus: "ready",
        saveStatus: "idle",
      };
    }

    case "setActivePageIndex": {
      const idx = Math.max(0, Math.floor(action.payload.pageIndex));
      if (idx < 0 || idx >= state.templatePageCount) return state;
      const onPage = new Set(state.blocks.filter((b) => (b.pageIndex ?? 0) === idx).map((b) => b.id));
      const selectedBlockIds = state.selectedBlockIds.filter((id) => onPage.has(id));
      const hoveredBlockId =
        state.hoveredBlockId && onPage.has(state.hoveredBlockId) ? state.hoveredBlockId : null;
      return {
        ...state,
        activePageIndex: idx,
        selectedBlockIds,
        hoveredBlockId,
      };
    }

    case "addTemplatePage": {
      const nextCount = state.templatePageCount + 1;
      const pageLabels = normalizeTemplatePageLabels(
        state.versionMeta[TEMPLATE_V2_PAGE_LABELS_META_KEY],
        state.templatePageCount
      );
      pageLabels.push(defaultPageLabelDisplay(nextCount - 1));
      return {
        ...state,
        templatePageCount: nextCount,
        activePageIndex: nextCount - 1,
        selectedBlockIds: [],
        hoveredBlockId: null,
        versionMeta: { ...state.versionMeta, [TEMPLATE_V2_PAGE_LABELS_META_KEY]: pageLabels },
        isDirty: true,
        saveStatus: "idle",
      };
    }

    case "removeTemplatePage": {
      if (state.templatePageCount <= 1) return state;
      const p = state.activePageIndex ?? 0;
      const newCount = state.templatePageCount - 1;
      const blocks = state.blocks
        .filter((b) => (b.pageIndex ?? 0) !== p)
        .map((b) => {
          const pi = b.pageIndex ?? 0;
          if (pi > p) return { ...b, pageIndex: pi - 1 };
          return b;
        });
      const blockIds = new Set(blocks.map((b) => b.id));
      const variableBindings = state.variableBindings.filter((vb) => blockIds.has(vb.blockId));
      const newActive = Math.min(p, newCount - 1);
      const onPage = new Set(blocks.filter((b) => (b.pageIndex ?? 0) === newActive).map((b) => b.id));
      const selectedBlockIds = state.selectedBlockIds.filter((id) => onPage.has(id));
      const hoveredBlockId =
        state.hoveredBlockId && onPage.has(state.hoveredBlockId) ? state.hoveredBlockId : null;
      const pageLabels = normalizeTemplatePageLabels(
        state.versionMeta[TEMPLATE_V2_PAGE_LABELS_META_KEY],
        state.templatePageCount
      );
      pageLabels.splice(p, 1);
      return {
        ...state,
        templatePageCount: newCount,
        activePageIndex: newActive,
        blocks: sortBlocksByZIndex(blocks),
        variableBindings,
        selectedBlockIds,
        hoveredBlockId,
        versionMeta: { ...state.versionMeta, [TEMPLATE_V2_PAGE_LABELS_META_KEY]: pageLabels },
        isDirty: true,
        saveStatus: "idle",
      };
    }

    case "setPageLabel": {
      const idx = Math.max(0, Math.floor(action.payload.pageIndex));
      if (idx < 0 || idx >= state.templatePageCount) return state;
      const trimmed = typeof action.payload.label === "string" ? action.payload.label.trim() : "";
      const pageLabels = normalizeTemplatePageLabels(
        state.versionMeta[TEMPLATE_V2_PAGE_LABELS_META_KEY],
        state.templatePageCount
      );
      pageLabels[idx] = trimmed.length > 0 ? trimmed : defaultPageLabelDisplay(idx);
      return {
        ...state,
        versionMeta: { ...state.versionMeta, [TEMPLATE_V2_PAGE_LABELS_META_KEY]: pageLabels },
        isDirty: true,
        saveStatus: "idle",
      };
    }

    case "reorderTemplatePages": {
      const n = state.templatePageCount;
      const fromIndex = Math.max(0, Math.floor(action.payload.fromIndex));
      const toIndex = Math.max(0, Math.floor(action.payload.toIndex));
      if (n <= 1 || fromIndex === toIndex) return state;
      if (fromIndex >= n || toIndex >= n) return state;
      /** order[i] = índice de página *antes* del reorden, ahora visible en la ranura i. */
      const order = Array.from({ length: n }, (_, i) => i);
      const [moved] = order.splice(fromIndex, 1);
      if (moved === undefined) return state;
      order.splice(toIndex, 0, moved);

      const blocks = state.blocks.map((b) => {
        const pi = b.pageIndex ?? 0;
        const newPi = order.indexOf(pi);
        if (newPi === pi) return b;
        return { ...b, pageIndex: newPi };
      });

      const labels = normalizeTemplatePageLabels(
        state.versionMeta[TEMPLATE_V2_PAGE_LABELS_META_KEY],
        n
      );
      const newLabels = order.map((oldSlot) => labels[oldSlot]);

      const prevActive = state.activePageIndex ?? 0;
      const newActive = order.indexOf(prevActive);

      const onPage = new Set(blocks.filter((b) => (b.pageIndex ?? 0) === newActive).map((b) => b.id));
      const selectedBlockIds = state.selectedBlockIds.filter((id) => onPage.has(id));
      const hoveredBlockId =
        state.hoveredBlockId && onPage.has(state.hoveredBlockId) ? state.hoveredBlockId : null;

      return {
        ...state,
        blocks: sortBlocksByZIndex(blocks),
        versionMeta: { ...state.versionMeta, [TEMPLATE_V2_PAGE_LABELS_META_KEY]: newLabels },
        activePageIndex: newActive,
        selectedBlockIds,
        hoveredBlockId,
        isDirty: true,
        saveStatus: "idle",
      };
    }

    case "setSelectedBlockIds": {
      const ids = action.payload.ids.filter((id, i, a) => id && a.indexOf(id) === i);
      return { ...state, selectedBlockIds: ids };
    }

    case "toggleBlockInSelection": {
      const { blockId } = action.payload;
      const has = state.selectedBlockIds.includes(blockId);
      if (has) {
        return {
          ...state,
          selectedBlockIds: state.selectedBlockIds.filter((id) => id !== blockId),
        };
      }
      return { ...state, selectedBlockIds: [...state.selectedBlockIds, blockId] };
    }

    case "hoverBlock":
      return { ...state, hoveredBlockId: action.payload.blockId };

    case "setBlocks": {
      const blocks = sortBlocksByZIndex(action.payload.blocks);
      const idSet = new Set(blocks.map((b) => b.id));
      const selectedBlockIds = state.selectedBlockIds.filter((id) => idSet.has(id));
      const variableBindings = state.variableBindings.filter((vb) => idSet.has(vb.blockId));
      return {
        ...state,
        blocks,
        variableBindings,
        selectedBlockIds,
        isDirty: true,
        saveStatus: "idle",
      };
    }

    case "updateBlock": {
      const { blockId, patch } = action.payload;
      let changed = false;
      const blocks = state.blocks.map((b) => {
        if (b.id !== blockId) return b;
        changed = true;
        return {
          ...b,
          ...(patch.type ? { type: patch.type } : {}),
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.configJson ? { configJson: patch.configJson } : {}),
          ...(patch.layout ? { layout: { ...b.layout, ...patch.layout } } : {}),
        };
      });
      if (!changed) return state;
      return {
        ...state,
        blocks: sortBlocksByZIndex(blocks),
        isDirty: true,
        saveStatus: "idle",
      };
    }

    case "addBlock":
      return {
        ...state,
        blocks: sortBlocksByZIndex([...state.blocks, action.payload.block]),
        selectedBlockIds: [action.payload.block.id],
        isDirty: true,
        saveStatus: "idle",
      };

    case "removeBlock": {
      const blockId = action.payload.blockId;
      const blocks = state.blocks.filter((b) => b.id !== blockId);
      const variableBindings = state.variableBindings.filter((vb) => vb.blockId !== blockId);
      return {
        ...state,
        blocks,
        variableBindings,
        selectedBlockIds: state.selectedBlockIds.filter((id) => id !== blockId),
        hoveredBlockId: state.hoveredBlockId === blockId ? null : state.hoveredBlockId,
        isDirty: true,
        saveStatus: "idle",
      };
    }

    case "removeBlocks": {
      const idSet = new Set(action.payload.blockIds);
      if (idSet.size === 0) return state;
      const blocks = state.blocks.filter((b) => !idSet.has(b.id));
      const variableBindings = state.variableBindings.filter((vb) => !idSet.has(vb.blockId));
      return {
        ...state,
        blocks,
        variableBindings,
        selectedBlockIds: state.selectedBlockIds.filter((id) => !idSet.has(id)),
        hoveredBlockId: state.hoveredBlockId && idSet.has(state.hoveredBlockId) ? null : state.hoveredBlockId,
        isDirty: true,
        saveStatus: "idle",
      };
    }

    case "duplicateBlock": {
      const source = state.blocks.find((b) => b.id === action.payload.blockId);
      if (!source) return state;
      const payload = action.payload;
      const newId = payload.newBlockId ?? createEditorBlockId();
      const samePosition = payload.samePosition === true;
      const page = source.pageIndex ?? 0;
      const samePageBlocks = state.blocks.filter((b) => (b.pageIndex ?? 0) === page);
      const maxZ = samePageBlocks.reduce((acc, b) => Math.max(acc, b.layout.zIndex), 0);
      const duplicated: TemplateV2Block = {
        ...source,
        id: newId,
        pageIndex: page,
        name: source.name?.trim()
          ? `${source.name.trim()} copia`
          : `${getBlockDisplayName(source)} copia`,
        layout: {
          ...source.layout,
          x: samePosition ? source.layout.x : source.layout.x + 12,
          y: samePosition ? source.layout.y : source.layout.y + 12,
          zIndex: maxZ + 1,
        },
      };
      const duplicatedBindings = state.variableBindings
        .filter((vb) => vb.blockId === source.id)
        .map((vb) => ({
          ...vb,
          id: undefined,
          blockId: newId,
        }));
      return {
        ...state,
        blocks: sortBlocksByZIndex([...state.blocks, duplicated]),
        variableBindings: [...state.variableBindings, ...duplicatedBindings],
        selectedBlockIds: [newId],
        isDirty: true,
        saveStatus: "idle",
      };
    }

    case "pasteBlockFromClipboard": {
      const { snapshot } = action.payload;
      const source = snapshot.block;
      const page = state.activePageIndex ?? 0;
      const samePageBlocks = state.blocks.filter((b) => (b.pageIndex ?? 0) === page);
      const maxZ = samePageBlocks.reduce((acc, b) => Math.max(acc, b.layout.zIndex), 0);
      const newId = createEditorBlockId();
      const l = source.layout;
      const pos = clampBlockPosition(
        state.canvas.width,
        state.canvas.height,
        l.x + 20,
        l.y + 20,
        l.width,
        l.height
      );
      let configJson: Record<string, unknown>;
      try {
        configJson = structuredClone(source.configJson) as Record<string, unknown>;
      } catch {
        configJson = { ...source.configJson };
      }
      const pasted: TemplateV2Block = {
        ...source,
        id: newId,
        pageIndex: page,
        configJson,
        layout: {
          ...l,
          x: pos.x,
          y: pos.y,
          zIndex: maxZ + 1,
        },
      };
      const pastedBindings = snapshot.bindings.map((vb) => ({
        ...vb,
        id: undefined,
        blockId: newId,
      }));
      return {
        ...state,
        blocks: sortBlocksByZIndex([...state.blocks, pasted]),
        variableBindings: [...state.variableBindings, ...pastedBindings],
        selectedBlockIds: [newId],
        isDirty: true,
        saveStatus: "idle",
      };
    }

    case "setZoom": {
      const src = action.payload.source ?? "user";
      return {
        ...state,
        zoom: clampZoom(action.payload.zoom),
        // "fit" devuelve el lienzo al ajuste automático: vuelve a seguir el tamaño de la
        // ventana hasta que se elija un zoom a mano.
        zoomUserAdjusted: src === "user" ? true : src === "fit" ? false : state.zoomUserAdjusted,
      };
    }

    case "setPan":
      return { ...state, pan: { ...state.pan, ...action.payload.pan } };

    case "setCanvas": {
      const nextCanvas = { ...state.canvas, ...action.payload.canvas };
      const dimChanged = nextCanvas.width !== state.canvas.width || nextCanvas.height !== state.canvas.height;
      return {
        ...state,
        canvas: nextCanvas,
        ...(dimChanged ? { zoomUserAdjusted: false } : {}),
        isDirty: true,
        saveStatus: "idle",
      };
    }

    case "setVariableBindings":
      return {
        ...state,
        variableBindings: [...action.payload.variableBindings],
        isDirty: true,
        saveStatus: "idle",
      };

    case "markDirty":
      return { ...state, isDirty: true, saveStatus: "idle" };

    case "markSaved":
      return {
        ...state,
        isDirty: false,
        isSaving: false,
        saveStatus: "saved",
        revision: action.payload?.revision ?? state.revision,
        lastSavedAt: action.payload?.at ?? new Date().toISOString(),
      };

    case "syncRevisionFromServer": {
      const rev = action.payload.revision;
      if (!Number.isFinite(rev) || rev < 0 || rev === state.revision) return state;
      return {
        ...state,
        revision: rev,
      };
    }

    case "setSaving":
      return {
        ...state,
        isSaving: action.payload.isSaving,
        saveStatus: action.payload.isSaving ? "saving" : state.saveStatus,
      };

    case "setLoadStatus":
      return { ...state, loadStatus: action.payload.loadStatus };

    case "setSaveStatus":
      return { ...state, saveStatus: action.payload.saveStatus };

    default:
      return state;
  }
}

export function templateV2EditorReducer(
  state: TemplateV2EditorState,
  action: TemplateV2EditorAction
): TemplateV2EditorState {
  if (action.type === "undo") {
    return applyUndo(state);
  }
  if (action.type === "redo") {
    return applyRedo(state);
  }
  if (action.type === "commitHistoryCheckpoint") {
    return applyCommitCheckpoint(state, action);
  }

  const skipHistory =
    (action.type === "updateBlock" && Boolean(action.payload.skipHistory)) ||
    (action.type === "duplicateBlock" && Boolean(action.payload.skipHistory));

  if (action.type === "initialize") {
    const next = coreTemplateV2EditorReducer(state, action);
    return { ...next, historyPast: [], historyFuture: [] };
  }

  if (shouldRecordHistory(action) && !skipHistory) {
    const snap = takePersistSnapshot(state);
    const next = coreTemplateV2EditorReducer(state, action);
    if (next === state) return state;
    return {
      ...next,
      historyPast: [...state.historyPast, snap].slice(-MAX_UNDO_STEPS),
      historyFuture: [],
    };
  }

  return coreTemplateV2EditorReducer(state, action);
}

export function initializeEditor(payload: InitializeEditorInput): TemplateV2EditorAction {
  return { type: "initialize", payload };
}

export function setActivePageIndex(pageIndex: number): TemplateV2EditorAction {
  return { type: "setActivePageIndex", payload: { pageIndex } };
}

export function addTemplatePage(): TemplateV2EditorAction {
  return { type: "addTemplatePage" };
}

export function setPageLabel(pageIndex: number, label: string): TemplateV2EditorAction {
  return { type: "setPageLabel", payload: { pageIndex, label } };
}

/** Mueve la hoja `fromIndex` a la posición `toIndex` (0-based). Actualiza bloques, etiquetas y página activa. */
export function reorderTemplatePages(fromIndex: number, toIndex: number): TemplateV2EditorAction {
  return { type: "reorderTemplatePages", payload: { fromIndex, toIndex } };
}

export function removeTemplatePage(): TemplateV2EditorAction {
  return { type: "removeTemplatePage" };
}

export function setSelectedBlockIds(ids: string[]): TemplateV2EditorAction {
  return { type: "setSelectedBlockIds", payload: { ids } };
}

/** Reemplaza la selección por un solo bloque (o vacío). */
export function selectBlock(blockId: string | null): TemplateV2EditorAction {
  return setSelectedBlockIds(blockId ? [blockId] : []);
}

export function toggleBlockInSelection(blockId: string): TemplateV2EditorAction {
  return { type: "toggleBlockInSelection", payload: { blockId } };
}

export function setBlocks(blocks: TemplateV2Block[]): TemplateV2EditorAction {
  return { type: "setBlocks", payload: { blocks } };
}

export function updateBlock(
  blockId: string,
  patch: UpdateBlockPatch,
  options?: { skipHistory?: boolean }
): TemplateV2EditorAction {
  return {
    type: "updateBlock",
    payload: { blockId, patch, ...(options?.skipHistory ? { skipHistory: true } : {}) },
  };
}

export function undo(): TemplateV2EditorAction {
  return { type: "undo" };
}

export function redo(): TemplateV2EditorAction {
  return { type: "redo" };
}

export function commitHistoryCheckpoint(before: TemplateV2PersistSnapshot): TemplateV2EditorAction {
  return { type: "commitHistoryCheckpoint", payload: { before } };
}

export function selectCanUndo(state: TemplateV2EditorState): boolean {
  return state.historyPast.length > 0;
}

export function selectCanRedo(state: TemplateV2EditorState): boolean {
  return state.historyFuture.length > 0;
}

export function addBlock(block: TemplateV2Block): TemplateV2EditorAction {
  return { type: "addBlock", payload: { block } };
}

export function removeBlock(blockId: string): TemplateV2EditorAction {
  return { type: "removeBlock", payload: { blockId } };
}

export function removeBlocks(blockIds: string[]): TemplateV2EditorAction {
  return { type: "removeBlocks", payload: { blockIds } };
}

export function duplicateBlock(
  blockId: string,
  options?: { samePosition?: boolean; newBlockId?: string; skipHistory?: boolean }
): TemplateV2EditorAction {
  return {
    type: "duplicateBlock",
    payload: {
      blockId,
      samePosition: options?.samePosition,
      newBlockId: options?.newBlockId,
      skipHistory: options?.skipHistory,
    },
  };
}

export function pasteBlockFromClipboard(snapshot: TemplateV2ClipboardSnapshot): TemplateV2EditorAction {
  return { type: "pasteBlockFromClipboard", payload: { snapshot } };
}

export function setZoom(zoom: number, source: "user" | "auto" | "fit" = "user"): TemplateV2EditorAction {
  return { type: "setZoom", payload: { zoom, source } };
}

export function setPan(pan: Partial<TemplateV2EditorPan>): TemplateV2EditorAction {
  return { type: "setPan", payload: { pan } };
}

export function markDirty(): TemplateV2EditorAction {
  return { type: "markDirty" };
}

export function markSaved(at?: string | null, revision?: number): TemplateV2EditorAction {
  return { type: "markSaved", payload: { at, revision } };
}

export function syncRevisionFromServer(revision: number): TemplateV2EditorAction {
  return { type: "syncRevisionFromServer", payload: { revision } };
}

export function setCanvas(canvas: Partial<TemplateV2Canvas>): TemplateV2EditorAction {
  return { type: "setCanvas", payload: { canvas } };
}

export function setSaving(isSaving: boolean): TemplateV2EditorAction {
  return { type: "setSaving", payload: { isSaving } };
}

export function setVariableBindings(variableBindings: TemplateV2VariableBinding[]): TemplateV2EditorAction {
  return { type: "setVariableBindings", payload: { variableBindings } };
}

/** Último bloque seleccionado que sigue existiendo (inspector, handles, duplicar con un solo objetivo). */
export function getPrimarySelectedBlockId(state: TemplateV2EditorState): string | null {
  for (let i = state.selectedBlockIds.length - 1; i >= 0; i--) {
    const id = state.selectedBlockIds[i];
    if (id && state.blocks.some((b) => b.id === id)) return id;
  }
  return null;
}

export function selectSelectedBlock(state: TemplateV2EditorState): TemplateV2Block | null {
  const id = getPrimarySelectedBlockId(state);
  if (!id) return null;
  return state.blocks.find((b) => b.id === id) ?? null;
}

export function selectBlocksOrderedByZIndex(state: TemplateV2EditorState): TemplateV2Block[] {
  return sortBlocksByZIndex(state.blocks);
}

export function selectHasPendingChanges(state: TemplateV2EditorState): boolean {
  return state.isDirty;
}

export function selectSerializableSavePayload(state: TemplateV2EditorState) {
  return {
    revision: state.revision,
    canvas: state.canvas,
    blocks: state.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      name: b.name ?? undefined,
      pageIndex: b.pageIndex ?? 0,
      layout: {
        x: b.layout.x,
        y: b.layout.y,
        width: b.layout.width,
        height: b.layout.height,
        rotation: b.layout.rotation,
        zIndex: b.layout.zIndex,
        opacity: b.layout.opacity ?? 1,
        locked: b.layout.locked ?? false,
        visible: b.layout.visible,
      },
      configJson: b.configJson,
    })),
    variableBindings: state.variableBindings,
    meta: {
      ...state.versionMeta,
      templatePageCount: state.templatePageCount,
    },
  };
}
