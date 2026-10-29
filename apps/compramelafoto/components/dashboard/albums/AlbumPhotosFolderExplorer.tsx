"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  CheckSquare,
  FolderPlus,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  PanelLeft,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Button from "@/components/ui/Button";
import AppModal from "@/components/ui/AppModal";
import { cn } from "@/lib/utils";
import type { AlbumUploadSelection } from "@/components/dashboard/albums/AlbumUploadZone";
import AlbumUploadTrigger, {
  type AlbumUploadTriggerHandle,
} from "@/components/dashboard/albums/AlbumUploadTrigger";
import AlbumExplorerPhotoTile from "@/components/dashboard/albums/AlbumExplorerPhotoTile";
import PhotoSlideViewer from "@/components/photo/PhotoSlideViewer";
import EventFolderAlbumTreePicker from "@/components/dashboard/EventFolderAlbumTreePicker";
import AlbumPhotoBulkUploadPanel from "@/components/dashboard/albums/AlbumPhotoBulkUploadPanel";
import AlbumFolderActionsBar, {
  type AlbumFolderActionsHandle,
} from "@/components/dashboard/albums/AlbumFolderActionsBar";
import AlbumFullFolderUploadConfirmModal from "@/components/dashboard/albums/AlbumFullFolderUploadConfirmModal";
import {
  AlbumFolderBreadcrumb,
  AlbumFolderTreePanel,
  FolderGlyph,
} from "@/components/dashboard/albums/AlbumFolderTreePanel";
import {
  buildFolderBreadcrumb,
  flatFolderSelectOptions,
  folderViewDisplayName,
  folderViewToPhotosQuery,
  mapAlbumFoldersToExplorer,
  mapEventFoldersToExplorer,
  type AlbumFolderApiRow,
  type EventFolderApiRow,
  type ExplorerFolderRow,
  type FolderViewKey,
} from "@/lib/albums/album-folder-view-model";
import type { AlbumPhotoStats } from "@/lib/albums/album-photo-stats";
import type { AlbumPhotoUploadPhase } from "@/lib/albums/run-album-photo-upload-queue";
import {
  buildExplorerPhotosListUrl,
  formatExplorerPhotoCountLabel,
  mapExplorerPhotoFromApi,
  mergeExplorerPhotoPages,
  type ExplorerPhotoListResponse,
} from "@/lib/albums/album-explorer-photos";

export type AlbumExplorerPhoto = {
  id: number;
  previewUrl: string;
  originalKey: string;
  userId?: number | null;
  canDelete?: boolean;
  sellDigital?: boolean;
  sellPrint?: boolean;
  folderId?: number | null;
  eventFolderId?: number | null;
};

export type AlbumCoverCropPhoto = {
  id: number;
  originalKey: string;
};

export type AlbumPhotoSelectItem = {
  id: string;
  canDelete?: boolean;
};

export type AlbumPhotosFolderExplorerProps = {
  albumId: number;
  albumTitle: string;
  eventId?: number | null;
  isOwner?: boolean;
  coverPhotoId: number | null;
  photoStats: AlbumPhotoStats;
  initialAlbumFolders?: AlbumFolderApiRow[];
  initialEventFolders?: EventFolderApiRow[];
  mpConnected: boolean | null;
  uploading: boolean;
  uploadTotal: number;
  uploadDone: number;
  uploadSucceeded: number;
  uploadFailedCount: number;
  uploadProgressRatio: number;
  uploadCurrentFile: string | null;
  uploadPhase: AlbumPhotoUploadPhase | null;
  uploadActiveCount: number;
  uploadStartedAt: number | null;
  selectedPhotoIds: Set<string>;
  deletingSelected: boolean;
  bulkFolderLoading: boolean;
  bulkFolderBanner: { kind: "success" | "error"; text: string } | null;
  bulkFolderPick: string;
  folderBulkEnabled: boolean;
  onFilesSelected: (selection: AlbumUploadSelection) => void;
  onPhotoSelect: (id: string, meta?: { canDelete?: boolean }) => void;
  onDeletePhoto: (id: string) => void;
  onSetCover?: (photo: AlbumCoverCropPhoto) => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  onSelectAll: (items: AlbumPhotoSelectItem[]) => void;
  onBulkFolderPickChange: (value: string) => void;
  onBulkApplyFolder: () => void;
  onBulkClearFolder: () => void;
  onError: (message: string) => void;
  uploadEventFolderId: string;
  onUploadEventFolderIdChange: (value: string) => void;
  uploadAlbumFolderId: string;
  onUploadAlbumFolderIdChange: (value: string) => void;
};

const TOOL_BTN =
  "inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-[#374151] hover:bg-black/[0.06] active:bg-black/[0.1] disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3d8ee0]/60";

const MENU_PANEL_CLASS =
  "z-50 rounded-lg border border-black/10 bg-white/95 backdrop-blur-md p-1 shadow-[0_10px_30px_rgba(0,0,0,0.16)]";

const MENU_ITEM_CLASS =
  "w-full text-left px-2.5 py-1.5 text-[13px] text-[#1f2937] rounded-[5px] hover:bg-[#3d8ee0] hover:text-white disabled:opacity-40 disabled:pointer-events-none";

const THUMB_SIZE_KEY = "clf.albumExplorer.thumbSize";
const THUMB_MIN = 96;
const THUMB_MAX = 280;
const THUMB_DEFAULT = 150;

type FolderMenuAction = "open" | "subfolder" | "rename" | "move" | "delete";

/** Menú contextual (click derecho) sobre una carpeta. */
function FolderContextMenu({
  x,
  y,
  canManage,
  onAction,
  onClose,
}: {
  x: number;
  y: number;
  canManage: boolean;
  onAction: (action: FolderMenuAction) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const left = typeof window !== "undefined" ? Math.min(x, window.innerWidth - 220) : x;
  const top = typeof window !== "undefined" ? Math.min(y, window.innerHeight - 200) : y;

  const item = (action: FolderMenuAction, label: string, danger?: boolean) => (
    <button
      type="button"
      role="menuitem"
      className={cn(MENU_ITEM_CLASS, danger && "text-red-600 hover:bg-red-600")}
      onClick={() => {
        onClose();
        onAction(action);
      }}
    >
      {label}
    </button>
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <div ref={ref} role="menu" className={cn(MENU_PANEL_CLASS, "fixed w-52")} style={{ left, top }}>
      {item("open", "Abrir")}
      {canManage ? (
        <>
          <div className="my-1 border-t border-black/10" />
          {item("subfolder", "Nueva subcarpeta")}
          {item("rename", "Renombrar…")}
          {item("move", "Mover a…")}
          <div className="my-1 border-t border-black/10" />
          {item("delete", "Eliminar carpeta…", true)}
        </>
      ) : null}
    </div>,
    document.body
  );
}

function FolderManageMenu({
  disabled,
  hasFolderSelected,
  folderActionsHint,
  onNewSubfolder,
  onRename,
  onMove,
  onDelete,
  onUploadFolder,
}: {
  disabled?: boolean;
  hasFolderSelected: boolean;
  folderActionsHint: string | null;
  onNewSubfolder: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onUploadFolder: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const itemClass = MENU_ITEM_CLASS;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={TOOL_BTN}
        disabled={disabled}
        aria-label="Más acciones de carpetas"
        title="Más acciones"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="w-4 h-4" aria-hidden />
      </button>
      {open ? (
        <div className={cn(MENU_PANEL_CLASS, "absolute right-0 top-full mt-1 w-60")} role="menu">
          {folderActionsHint ? (
            <p className="px-2.5 py-1.5 mb-1 text-[11px] text-[#6b7280] leading-snug m-0 border-b border-[#e5e7eb]">
              {folderActionsHint}
            </p>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={disabled || !hasFolderSelected}
            onClick={() => {
              setOpen(false);
              onNewSubfolder();
            }}
          >
            Nueva subcarpeta
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={disabled || !hasFolderSelected}
            onClick={() => {
              setOpen(false);
              onRename();
            }}
          >
            Renombrar carpeta
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={disabled || !hasFolderSelected}
            onClick={() => {
              setOpen(false);
              onMove();
            }}
          >
            Mover carpeta
          </button>
          <button
            type="button"
            role="menuitem"
            className={cn(itemClass, "text-red-600 hover:bg-red-600")}
            disabled={disabled || !hasFolderSelected}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Eliminar carpeta
          </button>
          <div className="my-1 border-t border-black/10" />
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              onUploadFolder();
            }}
          >
            Subir carpeta completa
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function AlbumPhotosFolderExplorer({
  albumId,
  eventId,
  isOwner,
  coverPhotoId,
  photoStats,
  initialAlbumFolders = [],
  initialEventFolders = [],
  mpConnected,
  uploading,
  uploadTotal,
  uploadDone,
  uploadSucceeded,
  uploadFailedCount,
  uploadProgressRatio,
  uploadCurrentFile,
  uploadPhase,
  uploadActiveCount,
  uploadStartedAt,
  selectedPhotoIds,
  deletingSelected,
  bulkFolderLoading,
  bulkFolderBanner,
  bulkFolderPick,
  folderBulkEnabled,
  onFilesSelected,
  onPhotoSelect,
  onDeletePhoto,
  onSetCover,
  onDeleteSelected,
  onClearSelection,
  onSelectAll,
  onBulkFolderPickChange,
  onBulkApplyFolder,
  onBulkClearFolder,
  onError,
  onUploadEventFolderIdChange,
  onUploadAlbumFolderIdChange,
}: AlbumPhotosFolderExplorerProps) {
  const mode: "album" | "event" =
    typeof eventId === "number" && Number.isFinite(eventId) && eventId > 0 ? "event" : "album";

  const [folderView, setFolderView] = useState<FolderViewKey>("all");
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [albumFolderRows, setAlbumFolderRows] = useState<AlbumFolderApiRow[]>(initialAlbumFolders);
  const [canManageFolders, setCanManageFolders] = useState(Boolean(isOwner && mode === "album"));
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [showSlideViewer, setShowSlideViewer] = useState(false);
  const [slideViewerIndex, setSlideViewerIndex] = useState(0);
  const [folderViewPhotos, setFolderViewPhotos] = useState<AlbumExplorerPhoto[]>([]);
  const [folderViewPhotosLoading, setFolderViewPhotosLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [folderViewTotalCount, setFolderViewTotalCount] = useState<number | null>(null);
  const [folderViewNextCursor, setFolderViewNextCursor] = useState<string | null>(null);
  const [mobileFolderOpen, setMobileFolderOpen] = useState(false);
  const [fullFolderUploadConfirmOpen, setFullFolderUploadConfirmOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ folderId: number; x: number; y: number } | null>(
    null
  );
  const [pendingFolderAction, setPendingFolderAction] = useState<FolderMenuAction | null>(null);
  const [thumbSize, setThumbSize] = useState(THUMB_DEFAULT);
  const lastClickedIndexRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(THUMB_SIZE_KEY));
      if (Number.isFinite(saved) && saved >= THUMB_MIN && saved <= THUMB_MAX) setThumbSize(saved);
    } catch {
      // Sin almacenamiento local: queda el tamaño por defecto.
    }
  }, []);

  function changeThumbSize(value: number) {
    setThumbSize(value);
    try {
      window.localStorage.setItem(THUMB_SIZE_KEY, String(value));
    } catch {
      // Sin almacenamiento local: el tamaño vale solo para esta visita.
    }
  }

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const uploadTriggerRef = useRef<AlbumUploadTriggerHandle>(null);
  const folderActionsRef = useRef<AlbumFolderActionsHandle>(null);
  const folderPhotosFetchGenRef = useRef(0);
  const skipStatsRefreshRef = useRef(true);
  const prevDeletingSelectedRef = useRef(deletingSelected);
  const prevBulkFolderLoadingRef = useRef(bulkFolderLoading);
  const prevUploadingRef = useRef(uploading);

  const uploadDisabled = uploading || mpConnected === false;

  const loadFolderPhotosPage = useCallback(
    async (opts: { append?: boolean; cursor?: string | null } = {}) => {
      const append = Boolean(opts.append);
      const fetchGen = ++folderPhotosFetchGenRef.current;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setFolderViewPhotos([]);
        setFolderViewNextCursor(null);
        setFolderViewTotalCount(null);
        setFolderViewPhotosLoading(true);
      }

      try {
        const folderQuery = folderViewToPhotosQuery(folderView, mode);
        const url = buildExplorerPhotosListUrl(albumId, folderQuery, {
          cursor: append ? opts.cursor ?? null : null,
        });
        const res = await fetch(url, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as ExplorerPhotoListResponse & {
          error?: string;
        };
        if (fetchGen !== folderPhotosFetchGenRef.current) return;

        if (!res.ok) {
          throw new Error(
            typeof data?.error === "string" ? data.error : "No se pudieron cargar las fotos."
          );
        }

        const rows = Array.isArray(data.photos) ? data.photos : [];
        const mapped = rows.map(mapExplorerPhotoFromApi);
        const total =
          typeof data.totalCount === "number" && Number.isFinite(data.totalCount)
            ? data.totalCount
            : mapped.length;
        const next =
          typeof data.nextCursor === "string" && data.nextCursor.trim() !== ""
            ? data.nextCursor
            : null;

        setFolderViewTotalCount(total);
        setFolderViewNextCursor(next);
        setFolderViewPhotos((prev) =>
          append ? mergeExplorerPhotoPages(prev, mapped) : mapped
        );
      } catch (e: unknown) {
        if (fetchGen !== folderPhotosFetchGenRef.current) return;
        onError(e instanceof Error ? e.message : "Error cargando fotos");
        if (!append) {
          setFolderViewPhotos([]);
          setFolderViewTotalCount(0);
          setFolderViewNextCursor(null);
        }
      } finally {
        if (fetchGen !== folderPhotosFetchGenRef.current) return;
        if (append) setIsLoadingMore(false);
        else setFolderViewPhotosLoading(false);
      }
    },
    [albumId, folderView, mode, onError]
  );

  const refreshFolderPhotosFirstPage = useCallback(() => {
    void loadFolderPhotosPage({ append: false });
  }, [loadFolderPhotosPage]);

  const loadMoreFolderPhotos = useCallback(() => {
    if (!folderViewNextCursor || isLoadingMore || folderViewPhotosLoading) return;
    void loadFolderPhotosPage({ append: true, cursor: folderViewNextCursor });
  }, [
    folderViewNextCursor,
    isLoadingMore,
    folderViewPhotosLoading,
    loadFolderPhotosPage,
  ]);

  const refreshAlbumFolders = useCallback(async () => {
    if (mode !== "album") return;
    setFoldersLoading(true);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/folders`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudieron cargar las carpetas.");
      }
      setAlbumFolderRows(Array.isArray(data.folders) ? data.folders : []);
      setCanManageFolders(Boolean(data.canManage));
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Error cargando carpetas");
    } finally {
      setFoldersLoading(false);
    }
  }, [albumId, mode, onError]);

  useEffect(() => {
    setAlbumFolderRows(initialAlbumFolders);
  }, [initialAlbumFolders]);

  useEffect(() => {
    if (mode === "album" && isOwner) {
      void refreshAlbumFolders();
    }
  }, [mode, isOwner, refreshAlbumFolders]);

  const explorerFolders: ExplorerFolderRow[] = useMemo(() => {
    if (mode === "album") {
      return mapAlbumFoldersToExplorer(albumFolderRows);
    }
    return mapEventFoldersToExplorer(initialEventFolders);
  }, [mode, albumFolderRows, initialEventFolders]);

  const uncategorizedCount = photoStats.uncategorized;
  const albumPhotoTotal = photoStats.total;

  const currentFolderLabel = useMemo(
    () => folderViewDisplayName(folderView, explorerFolders),
    [folderView, explorerFolders]
  );

  const hasFolderSelected = typeof folderView === "number";

  const folderActionsHint = !hasFolderSelected
    ? folderView === "all"
      ? "Elegí una carpeta concreta del árbol para renombrar, mover o eliminar. En «Todas las fotos» solo podés crear carpetas nuevas."
      : "Elegí una carpeta concreta del árbol para renombrar, mover o eliminar."
    : null;

  function requestFullFolderUpload() {
    if (uploadDisabled) return;
    setFullFolderUploadConfirmOpen(true);
  }

  function confirmFullFolderUpload() {
    uploadTriggerRef.current?.pickFolder();
  }

  useEffect(() => {
    if (mode !== "album") return;
    if (folderView === "all" || folderView === "none") {
      onUploadAlbumFolderIdChange("");
      return;
    }
    onUploadAlbumFolderIdChange(String(folderView));
  }, [folderView, mode, onUploadAlbumFolderIdChange]);

  useEffect(() => {
    if (mode !== "event") return;
    if (folderView === "all" || folderView === "none") {
      onUploadEventFolderIdChange("");
      return;
    }
    onUploadEventFolderIdChange(String(folderView));
  }, [folderView, mode, onUploadEventFolderIdChange]);

  useEffect(() => {
    void loadFolderPhotosPage({ append: false });
  }, [albumId, folderView, mode, loadFolderPhotosPage]);

  useEffect(() => {
    if (skipStatsRefreshRef.current) {
      skipStatsRefreshRef.current = false;
      return;
    }
    refreshFolderPhotosFirstPage();
  }, [photoStats.total, photoStats.uncategorized, refreshFolderPhotosFirstPage]);

  useEffect(() => {
    if (prevUploadingRef.current && !uploading) {
      refreshFolderPhotosFirstPage();
    }
    prevUploadingRef.current = uploading;
  }, [uploading, refreshFolderPhotosFirstPage]);

  useEffect(() => {
    if (prevDeletingSelectedRef.current && !deletingSelected) {
      refreshFolderPhotosFirstPage();
    }
    prevDeletingSelectedRef.current = deletingSelected;
  }, [deletingSelected, refreshFolderPhotosFirstPage]);

  useEffect(() => {
    if (
      prevBulkFolderLoadingRef.current &&
      !bulkFolderLoading &&
      bulkFolderBanner?.kind === "success"
    ) {
      refreshFolderPhotosFirstPage();
      if (mode === "album") void refreshAlbumFolders();
    }
    prevBulkFolderLoadingRef.current = bulkFolderLoading;
  }, [
    bulkFolderLoading,
    bulkFolderBanner,
    mode,
    refreshFolderPhotosFirstPage,
    refreshAlbumFolders,
  ]);

  const gridPhotos = folderViewPhotos
    .map((p) => ({
      id: String(p.id),
      src: `/api/photos/${p.id}/view?albumId=${albumId}&mode=preview`,
      alt: `Foto #${p.id}`,
      canDelete: p.canDelete,
      sellDigital: p.sellDigital ?? true,
      sellPrint: p.sellPrint ?? true,
      selected: selectedPhotoIds.has(String(p.id)),
      isCover: coverPhotoId === p.id,
    }))
    .filter((p) => p.src);

  const photoCountLabel = formatExplorerPhotoCountLabel(
    folderViewPhotos.length,
    folderViewTotalCount,
    folderViewPhotosLoading
  );

  const albumHasPhotos = albumPhotoTotal > 0;

  const canDeleteAny = folderViewPhotos.some((p) => p.canDelete !== false);
  const photoSelectionEnabled = canDeleteAny || folderBulkEnabled;
  const deletablePhotoIds = folderViewPhotos
    .filter((p) => p.canDelete !== false)
    .map((p) => String(p.id));
  const selectAllTargetIds =
    folderBulkEnabled && isOwner ? gridPhotos.map((p) => p.id) : deletablePhotoIds;
  // Con más páginas por cargar, "todas" son las del servidor, no las que están en pantalla.
  const hasUnloadedPhotos = folderViewNextCursor != null;
  const allSelectTargetsChosen = hasUnloadedPhotos
    ? folderViewTotalCount != null && selectedPhotoIds.size >= folderViewTotalCount
    : selectAllTargetIds.length > 0 &&
      selectAllTargetIds.every((id) => selectedPhotoIds.has(id));
  const [selectingAll, setSelectingAll] = useState(false);

  function toggleExpand(folderId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function selectFolder(key: FolderViewKey) {
    lastClickedIndexRef.current = null;
    onClearSelection();
    setFolderView(key);
    setMobileFolderOpen(false);
  }

  function selectAllVisible() {
    const items: AlbumPhotoSelectItem[] = selectAllTargetIds.map((id) => {
      const p = folderViewPhotos.find((ph) => String(ph.id) === id);
      return { id, canDelete: p?.canDelete };
    });
    onSelectAll(items);
  }

  /** Selecciona todas las fotos de la carpeta abierta, también las que no se cargaron. */
  async function selectAllInView() {
    if (!hasUnloadedPhotos) {
      selectAllVisible();
      return;
    }
    setSelectingAll(true);
    try {
      const folderQuery = folderViewToPhotosQuery(folderView, mode);
      const url = `${buildExplorerPhotosListUrl(albumId, folderQuery)}&idsOnly=1`;
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        photos?: Array<{ id: number; canDelete?: boolean }>;
        error?: string;
      };
      if (!res.ok || !Array.isArray(data.photos)) {
        throw new Error(data.error || "No se pudieron seleccionar todas las fotos.");
      }
      const selectAnyPhoto = folderBulkEnabled && isOwner;
      onSelectAll(
        data.photos
          .filter((p) => selectAnyPhoto || p.canDelete !== false)
          .map((p) => ({ id: String(p.id), canDelete: p.canDelete }))
      );
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "No se pudieron seleccionar todas las fotos.");
    } finally {
      setSelectingAll(false);
    }
  }

  function handlePhotoSelectFromGrid(id: string) {
    const p = folderViewPhotos.find((ph) => String(ph.id) === id);
    onPhotoSelect(id, { canDelete: p?.canDelete });
  }

  function handleSetCoverFromGrid(id: string) {
    if (!onSetCover) return;
    const p = folderViewPhotos.find((ph) => String(ph.id) === id);
    if (!p?.originalKey) return;
    onSetCover({ id: p.id, originalKey: p.originalKey });
  }

  async function handlePhotoSellOptionChange(
    photoId: string,
    field: "sellDigital" | "sellPrint",
    value: boolean
  ) {
    if (!isOwner) return;
    const id = parseInt(photoId, 10);
    if (!Number.isFinite(id)) return;

    const prev = folderViewPhotos.find((p) => p.id === id);
    if (!prev) return;

    const newDigital = field === "sellDigital" ? value : (prev.sellDigital ?? true);
    const newPrint = field === "sellPrint" ? value : (prev.sellPrint ?? true);
    if (!newDigital && !newPrint) {
      onError(
        "Al menos una opción (Digital o Impresa) debe estar habilitada para cada foto. Si no deseás vender esta fotografía en ningún formato, por favor eliminála del álbum."
      );
      return;
    }

    setFolderViewPhotos((rows) =>
      rows.map((p) =>
        p.id === id ? { ...p, sellDigital: newDigital, sellPrint: newPrint } : p
      )
    );

    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellDigital: newDigital, sellPrint: newPrint }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data?.error === "string" ? data.error : "Error al actualizar"
        );
      }
    } catch (e: unknown) {
      setFolderViewPhotos((rows) =>
        rows.map((p) =>
          p.id === id
            ? {
                ...p,
                sellDigital: prev.sellDigital ?? true,
                sellPrint: prev.sellPrint ?? true,
              }
            : p
        )
      );
      onError(e instanceof Error ? e.message : "Error al guardar opción de venta");
    }
  }

  const showSellOptions = Boolean(isOwner);

  const showExplorerChrome = mode === "album" || explorerFolders.length > 0;

  const crumbs = useMemo(
    () => buildFolderBreadcrumb(explorerFolders, folderView),
    [explorerFolders, folderView]
  );

  /** Subcarpetas de la ubicación actual, que se muestran como íconos arriba de las fotos. */
  const childFolders = useMemo(() => {
    if (folderView === "none") return [];
    const parentId = folderView === "all" ? null : folderView;
    return explorerFolders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.id - b.id));
  }, [explorerFolders, folderView]);

  const parentView: FolderViewKey | null = useMemo(() => {
    if (folderView === "all") return null;
    if (folderView === "none") return "all";
    const current = explorerFolders.find((f) => f.id === folderView);
    return current?.parentId ?? "all";
  }, [folderView, explorerFolders]);

  /** Abre una carpeta desde el contenido o el menú: también despliega sus ancestros en el árbol. */
  function openFolder(folderId: number) {
    const byId = new Map(explorerFolders.map((f) => [f.id, f]));
    setExpanded((prev) => {
      const next = new Set(prev);
      if (explorerFolders.some((f) => f.parentId === folderId)) next.add(folderId);
      let cur = byId.get(folderId);
      while (cur?.parentId != null) {
        next.add(cur.parentId);
        cur = byId.get(cur.parentId);
      }
      return next;
    });
    selectFolder(folderId);
  }

  function handleFolderContextMenu(folderId: number, e: { clientX: number; clientY: number }) {
    setContextMenu({ folderId, x: e.clientX, y: e.clientY });
  }

  function handleFolderMenuAction(folderId: number, action: FolderMenuAction) {
    if (action === "open") {
      openFolder(folderId);
      return;
    }
    if (action === "subfolder") {
      folderActionsRef.current?.openCreateFolder(folderId);
      return;
    }
    // Renombrar/mover/eliminar actúan sobre la carpeta abierta: primero la abrimos.
    if (folderView !== folderId) openFolder(folderId);
    setPendingFolderAction(action);
  }

  useEffect(() => {
    if (!pendingFolderAction) return;
    if (pendingFolderAction === "rename") folderActionsRef.current?.openRenameFolder();
    else if (pendingFolderAction === "move") folderActionsRef.current?.openMoveFolder();
    else if (pendingFolderAction === "delete") folderActionsRef.current?.openDeleteFolder();
    setPendingFolderAction(null);
  }, [pendingFolderAction, folderView]);

  function handleTileClick(index: number, e: { shiftKey: boolean }) {
    const photo = gridPhotos[index];
    if (!photo) return;
    if (e.shiftKey && lastClickedIndexRef.current != null) {
      const from = Math.min(lastClickedIndexRef.current, index);
      const to = Math.max(lastClickedIndexRef.current, index);
      for (let i = from; i <= to; i++) {
        const p = gridPhotos[i];
        if (p && !p.selected) handlePhotoSelectFromGrid(p.id);
      }
    } else {
      handlePhotoSelectFromGrid(photo.id);
    }
    lastClickedIndexRef.current = index;
  }

  function onWindowKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, select, [role=menu]")) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a" && photoSelectionEnabled) {
      e.preventDefault();
      void selectAllInView();
    } else if (e.key === "Escape" && selectedPhotoIds.size > 0) {
      onClearSelection();
    } else if (e.key === "Backspace" && parentView != null && !(e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      selectFolder(parentView);
    }
  }

  // Carga automática de la página siguiente al llegar al final del contenido.
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el || !folderViewNextCursor) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) loadMoreFolderPhotos();
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [folderViewNextCursor, loadMoreFolderPhotos]);

  const folderTreePanel = (
    <AlbumFolderTreePanel
      folders={explorerFolders}
      selection={folderView}
      expanded={expanded}
      uncategorizedCount={uncategorizedCount}
      allCount={albumPhotoTotal}
      canManage={canManageFolders}
      disabled={foldersLoading}
      onSelect={selectFolder}
      onToggleExpand={toggleExpand}
      onFolderContextMenu={handleFolderContextMenu}
    />
  );

  let bulkBar: ReactNode = null;
  if (folderBulkEnabled && selectedPhotoIds.size > 0) {
    const selectionLabel =
      selectedPhotoIds.size === 1
        ? "1 foto seleccionada"
        : `${selectedPhotoIds.size} fotos seleccionadas`;

    bulkBar = (
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/[0.97] backdrop-blur-md shadow-[0_-8px_28px_rgba(0,0,0,0.10)]"
        role="region"
        aria-label="Acciones sobre fotos seleccionadas"
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="shrink-0 lg:w-56">
              <p className="text-sm font-semibold text-[#111827] m-0 leading-snug">{selectionLabel}</p>
              {bulkFolderBanner ? (
                <p
                  role="status"
                  className={cn(
                    "text-xs mt-0.5 font-medium m-0 leading-snug",
                    bulkFolderBanner.kind === "success" ? "text-green-700" : "text-red-600"
                  )}
                >
                  {bulkFolderBanner.text}
                </p>
              ) : (
                <p className="text-xs text-[#6b7280] m-0 mt-0.5">
                  {mode === "album" ? "Mover a otra carpeta" : "Mover a una carpeta del evento"}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-1">
              <div className="w-full sm:flex-1 min-w-0">
                {mode === "event" && typeof eventId === "number" ? (
                  <EventFolderAlbumTreePicker
                    layout="compact"
                    mode="bulk"
                    eventId={eventId}
                    value={bulkFolderPick}
                    onChange={onBulkFolderPickChange}
                    disabled={bulkFolderLoading}
                  />
                ) : (
                  <select
                    aria-label="Carpeta destino"
                    className="w-full h-9 rounded-md border border-black/15 bg-white px-2.5 text-[13px] text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3d8ee0]/50 disabled:opacity-60"
                    value={bulkFolderPick}
                    disabled={bulkFolderLoading}
                    onChange={(e) => onBulkFolderPickChange(e.target.value)}
                  >
                    {flatFolderSelectOptions(explorerFolders).map((o) => (
                      <option key={o.value || "pick"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-2 shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  className="h-9 flex-1 sm:flex-none justify-center whitespace-nowrap rounded-md"
                  onClick={() => void onBulkApplyFolder()}
                  disabled={bulkFolderPick === "" || bulkFolderLoading}
                >
                  {bulkFolderLoading ? "Guardando…" : "Mover aquí"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 flex-1 sm:flex-none justify-center whitespace-nowrap rounded-md"
                  onClick={() => void onBulkClearFolder()}
                  disabled={bulkFolderLoading}
                >
                  Quitar de carpeta
                </Button>
                <button
                  type="button"
                  className={TOOL_BTN}
                  onClick={onClearSelection}
                  disabled={bulkFolderLoading}
                  aria-label="Cerrar selección"
                  title="Deseleccionar"
                >
                  <X className="w-4 h-4" aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectionCount = selectedPhotoIds.size;
  const canSelectAll =
    photoSelectionEnabled && gridPhotos.length > 0 && !allSelectTargetsChosen && selectAllTargetIds.length > 0;

  const toolbar = (
    <div className="flex items-center gap-1 min-h-11 px-2 py-1.5 border-b border-black/[0.08] bg-[#f5f5f4]">
      <button
        type="button"
        className={TOOL_BTN}
        disabled={parentView == null || foldersLoading}
        onClick={() => parentView != null && selectFolder(parentView)}
        aria-label="Subir un nivel"
        title="Volver a la carpeta anterior"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
      </button>
      {showExplorerChrome ? (
        <button
          type="button"
          className={cn(TOOL_BTN, "lg:hidden")}
          onClick={() => setMobileFolderOpen(true)}
          disabled={foldersLoading}
          aria-label="Ver carpetas"
          title="Carpetas"
        >
          <PanelLeft className="w-4 h-4" aria-hidden />
        </button>
      ) : null}

      <div className="min-w-0 flex-1 overflow-hidden px-1">
        <AlbumFolderBreadcrumb crumbs={crumbs} onNavigate={selectFolder} disabled={foldersLoading} />
      </div>

      {selectionCount > 0 ? (
        <div className="flex items-center gap-1 shrink-0">
          <span className="hidden sm:inline text-[12px] font-medium text-[#6b7280] tabular-nums px-1">
            {selectionCount === 1 ? "1 seleccionada" : `${selectionCount} seleccionadas`}
          </span>
          {canSelectAll ? (
            <button
              type="button"
              className={TOOL_BTN}
              onClick={() => void selectAllInView()}
              disabled={deletingSelected || bulkFolderLoading || selectingAll}
              title="Seleccionar todas (⌘A)"
            >
              {selectingAll ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <CheckSquare className="w-4 h-4" aria-hidden />}
              <span className="hidden md:inline">Todas</span>
            </button>
          ) : null}
          {canDeleteAny ? (
            <button
              type="button"
              className={cn(TOOL_BTN, "text-red-600 hover:bg-red-50")}
              onClick={onDeleteSelected}
              disabled={deletingSelected}
              title="Eliminar seleccionadas"
            >
              {deletingSelected ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Trash2 className="w-4 h-4" aria-hidden />}
              <span className="hidden md:inline">Eliminar</span>
            </button>
          ) : null}
          <button
            type="button"
            className={TOOL_BTN}
            onClick={onClearSelection}
            disabled={deletingSelected || bulkFolderLoading}
            aria-label="Deseleccionar"
            title="Deseleccionar (Esc)"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
          <span className="mx-1 h-5 w-px bg-black/10" aria-hidden />
        </div>
      ) : canSelectAll ? (
        <button
          type="button"
          className={cn(TOOL_BTN, "shrink-0")}
          onClick={() => void selectAllInView()}
          disabled={deletingSelected || bulkFolderLoading || selectingAll}
          title="Seleccionar todas (⌘A)"
        >
          {selectingAll ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <CheckSquare className="w-4 h-4" aria-hidden />}
          <span className="hidden md:inline">Seleccionar</span>
        </button>
      ) : null}

      <div className="flex items-center gap-1 shrink-0">
        {canManageFolders ? (
          <button
            type="button"
            className={TOOL_BTN}
            disabled={foldersLoading || uploading}
            onClick={() =>
              folderActionsRef.current?.openCreateFolder(typeof folderView === "number" ? folderView : null)
            }
            aria-label="Nueva carpeta"
            title={typeof folderView === "number" ? "Nueva carpeta dentro de esta" : "Nueva carpeta"}
          >
            <FolderPlus className="w-4 h-4" aria-hidden />
          </button>
        ) : null}
        {canManageFolders ? (
          <FolderManageMenu
            disabled={foldersLoading || uploading}
            hasFolderSelected={hasFolderSelected}
            folderActionsHint={folderActionsHint}
            onNewSubfolder={() =>
              folderActionsRef.current?.openCreateFolder(typeof folderView === "number" ? folderView : null)
            }
            onRename={() => folderActionsRef.current?.openRenameFolder()}
            onMove={() => folderActionsRef.current?.openMoveFolder()}
            onDelete={() => folderActionsRef.current?.openDeleteFolder()}
            onUploadFolder={requestFullFolderUpload}
          />
        ) : mode === "event" ? (
          <button
            type="button"
            className={TOOL_BTN}
            disabled={uploadDisabled}
            onClick={requestFullFolderUpload}
            title="Subir una carpeta completa"
          >
            <FolderPlus className="w-4 h-4" aria-hidden />
            <span className="hidden md:inline">Subir carpeta</span>
          </button>
        ) : null}
        <button
          type="button"
          className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-[#c27b3d] px-2 sm:px-3 text-[13px] font-semibold text-white shadow-sm hover:bg-[#b06d32] disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d]/50"
          disabled={uploadDisabled}
          onClick={() => uploadTriggerRef.current?.pickFiles()}
          title={
            typeof folderView === "number"
              ? `Subir fotos a «${currentFolderLabel}»`
              : "Subir fotos al álbum"
          }
        >
          <Upload className="w-4 h-4" aria-hidden />
          <span className="hidden sm:inline">Subir</span>
        </button>
      </div>
    </div>
  );

  const emptyState = (title: string, text: string) => (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-16 px-4">
      <ImageIcon className="w-10 h-10 text-[#d1d5db]" strokeWidth={1.5} aria-hidden />
      <p className="text-sm font-semibold text-[#374151] m-0">{title}</p>
      <p className="text-xs text-[#6b7280] m-0 max-w-xs">{text}</p>
      <button
        type="button"
        className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md border border-black/15 bg-white px-3 text-[13px] font-medium text-[#374151] shadow-sm hover:bg-[#fafafa] disabled:opacity-50"
        disabled={uploadDisabled}
        onClick={() => uploadTriggerRef.current?.pickFiles()}
      >
        <Upload className="w-4 h-4" aria-hidden />
        Subir fotos aquí
      </button>
    </div>
  );

  // Con pantalla angosta siempre entran al menos 2 fotos (y 3 carpetas) por fila.
  const gridStyle = {
    gridTemplateColumns: `repeat(auto-fill, minmax(min(${thumbSize}px, calc((100% - 8px) / 2)), 1fr))`,
  };
  // Las carpetas ocupan menos que una foto, como en un explorador de archivos.
  const folderTile = Math.max(88, Math.round(thumbSize * 0.72));
  const folderGridStyle = {
    gridTemplateColumns: `repeat(auto-fill, minmax(min(${folderTile}px, calc((100% - 16px) / 3)), 1fr))`,
  };

  const content = (
    <div className="p-3 sm:p-4">
      {childFolders.length > 0 ? (
        <div className="mb-4">
          <div className="grid gap-x-2 gap-y-3" style={folderGridStyle}>
            {childFolders.map((folder) => (
              <div
                key={folder.id}
                role="button"
                tabIndex={0}
                className="group/folder flex flex-col items-center gap-1 rounded-lg p-2 cursor-default hover:bg-black/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3d8ee0]/60"
                title={`${folder.name} · ${folder.photoCount} foto${folder.photoCount !== 1 ? "s" : ""}`}
                onClick={() => openFolder(folder.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openFolder(folder.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleFolderContextMenu(folder.id, e);
                }}
              >
                <FolderGlyph
                  className="w-[72%] h-auto transition-transform group-hover/folder:-translate-y-0.5"
                  open={false}
                />
                <span className="max-w-full truncate text-[12px] font-medium text-[#111827] leading-4">
                  {folder.name}
                </span>
                <span className="text-[11px] text-[#9ca3af] leading-3 tabular-nums">
                  {folder.photoCount.toLocaleString("es-AR")} foto{folder.photoCount !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
          {gridPhotos.length > 0 || folderViewPhotosLoading ? (
            <div className="mt-4 border-t border-black/[0.06]" aria-hidden />
          ) : null}
        </div>
      ) : null}

      {folderViewPhotosLoading ? (
        <div className="grid gap-x-2 gap-y-3" style={gridStyle} role="status" aria-label="Cargando fotos">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 p-1.5">
              <div className="w-full aspect-square rounded-md bg-black/[0.05] animate-pulse" />
              <div className="h-3 w-12 rounded bg-black/[0.05] animate-pulse" />
            </div>
          ))}
        </div>
      ) : gridPhotos.length > 0 ? (
        <>
          <div
            className="grid gap-x-2 gap-y-3 select-none album-photo-container"
            style={gridStyle}
            data-protected="true"
          >
            {gridPhotos.map((photo, index) => (
              <AlbumExplorerPhotoTile
                key={photo.id}
                photo={photo}
                onClick={photoSelectionEnabled ? (e) => handleTileClick(index, e) : undefined}
                onOpen={() => {
                  setSlideViewerIndex(index);
                  setShowSlideViewer(true);
                }}
                onRemove={() => onDeletePhoto(photo.id)}
                onSetCover={onSetCover ? () => handleSetCoverFromGrid(photo.id) : undefined}
                onSellOptionChange={
                  showSellOptions
                    ? (field, value) => void handlePhotoSellOptionChange(photo.id, field, value)
                    : undefined
                }
              />
            ))}
          </div>
          {folderViewNextCursor ? (
            <div ref={loadMoreSentinelRef} className="flex justify-center pt-4">
              <button
                type="button"
                className={cn(TOOL_BTN, "border border-black/10 bg-white px-3")}
                disabled={isLoadingMore || folderViewPhotosLoading}
                onClick={() => loadMoreFolderPhotos()}
              >
                {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
                {isLoadingMore ? "Cargando…" : "Cargar más"}
              </button>
            </div>
          ) : null}
        </>
      ) : childFolders.length > 0 ? null : folderViewTotalCount === 0 && albumHasPhotos ? (
        emptyState(
          "Esta carpeta está vacía",
          "Subí fotos acá o seleccioná fotos de otra carpeta y movelas."
        )
      ) : (
        emptyState(
          "Tu álbum está vacío",
          "Empezá subiendo las primeras fotos. Podés organizarlas en carpetas después."
        )
      )}
    </div>
  );

  const statusParts: string[] = [];
  if (childFolders.length > 0) {
    statusParts.push(childFolders.length === 1 ? "1 carpeta" : `${childFolders.length} carpetas`);
  }
  statusParts.push(folderViewPhotosLoading ? "Cargando…" : photoCountLabel);
  if (selectionCount > 0) {
    statusParts.push(selectionCount === 1 ? "1 seleccionada" : `${selectionCount} seleccionadas`);
  }

  const statusBar = (
    <div className="flex items-center gap-3 h-8 px-3 border-t border-black/[0.08] bg-[#f5f5f4] text-[11px] text-[#6b7280]">
      <span className="min-w-0 truncate tabular-nums">{statusParts.join(" · ")}</span>
      {mpConnected === false ? (
        <span className="text-amber-700 font-medium truncate">Conectá Mercado Pago para subir fotos</span>
      ) : null}
      <label className="ml-auto hidden sm:flex items-center gap-2 shrink-0" title="Tamaño de las miniaturas">
        <span className="sr-only">Tamaño de las miniaturas</span>
        <ImageIcon className="w-3 h-3" aria-hidden />
        <input
          type="range"
          min={THUMB_MIN}
          max={THUMB_MAX}
          step={4}
          value={thumbSize}
          onChange={(e) => changeThumbSize(Number(e.target.value))}
          className="w-24 accent-[#6b7280] cursor-pointer"
        />
        <ImageIcon className="w-4 h-4" aria-hidden />
      </label>
    </div>
  );

  return (
    <div className="w-full min-w-0 ds-stack-section gap-4">
      <AlbumUploadTrigger
        ref={uploadTriggerRef}
        onFilesSelected={onFilesSelected}
        disabled={uploadDisabled}
      />

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-[#1a1a1a] m-0">Fotos</h2>
          <p className="text-[13px] text-[#6b7280] m-0">
            {mode === "event"
              ? "Carpetas definidas por el organizador: solo podés subir fotos en las carpetas existentes."
              : (
                <>
                  Organizá el material del álbum en carpetas.
                  <span className="hidden lg:inline"> Click derecho sobre una carpeta para ver sus opciones.</span>
                </>
              )}
          </p>
        </div>
      </div>

      {uploading && uploadTotal > 0 ? (
        <AlbumPhotoBulkUploadPanel
          uploadTotal={uploadTotal}
          uploadProcessed={uploadDone}
          uploadSucceeded={uploadSucceeded}
          uploadFailed={uploadFailedCount}
          progressRatio={uploadProgressRatio}
          uploadCurrentFile={uploadCurrentFile}
          uploadPhase={uploadPhase}
          activeUploads={uploadActiveCount}
          startedAt={uploadStartedAt}
        />
      ) : null}

      {canManageFolders ? (
        <AlbumFolderActionsBar
          ref={folderActionsRef}
          albumId={albumId}
          canManage={canManageFolders}
          selection={folderView}
          folders={explorerFolders}
          disabled={foldersLoading || uploading}
          onFoldersChanged={() => {
            void refreshAlbumFolders();
            refreshFolderPhotosFirstPage();
          }}
          onError={onError}
          onSelect={setFolderView}
        />
      ) : null}

      {uploading && uploadTotal > 0 ? null : (
        <div
          className="w-full min-w-0 overflow-hidden rounded-xl border border-black/[0.12] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] flex flex-col lg:h-[min(78vh,880px)]"
          onKeyDown={onWindowKeyDown}
        >
          {toolbar}
          <div className="flex min-h-0 flex-1">
            {showExplorerChrome ? (
              <aside
                className="hidden lg:block w-60 xl:w-64 shrink-0 overflow-y-auto border-r border-black/[0.08] bg-[#fafaf9] px-2 py-3"
                aria-label="Carpetas del álbum"
              >
                {folderTreePanel}
              </aside>
            ) : null}
            <div className="min-w-0 flex-1 lg:overflow-y-auto">{content}</div>
          </div>
          {statusBar}
        </div>
      )}

      {contextMenu ? (
        <FolderContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          canManage={canManageFolders}
          onClose={closeContextMenu}
          onAction={(action) => handleFolderMenuAction(contextMenu.folderId, action)}
        />
      ) : null}

      <AppModal
        open={mobileFolderOpen}
        onClose={() => setMobileFolderOpen(false)}
        title="Carpetas"
        description="La carpeta elegida será la que ves y el destino de la próxima subida de archivos sueltos."
        size="md"
      >
        <div className="ds-modal-scroll--padded max-h-[min(70vh,520px)] overflow-y-auto">
          {folderTreePanel}
        </div>
      </AppModal>

      <AlbumFullFolderUploadConfirmModal
        open={fullFolderUploadConfirmOpen}
        mode={mode}
        onClose={() => setFullFolderUploadConfirmOpen(false)}
        onConfirmPickFolder={confirmFullFolderUpload}
      />

      {showSlideViewer && gridPhotos.length > 0 ? (
        <PhotoSlideViewer
          photos={gridPhotos.map((p) => ({
            ...p,
            selected: selectedPhotoIds.has(p.id),
          }))}
          initialIndex={slideViewerIndex}
          onClose={() => setShowSlideViewer(false)}
          onPhotoSelect={
            photoSelectionEnabled ? handlePhotoSelectFromGrid : undefined
          }
          onDelete={onDeletePhoto}
          enableZoom
        />
      ) : null}

      {bulkBar}
    </div>
  );
}
