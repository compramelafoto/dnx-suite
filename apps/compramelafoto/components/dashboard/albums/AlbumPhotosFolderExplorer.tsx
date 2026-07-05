"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, MoreVertical } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AppModal from "@/components/ui/AppModal";
import type { AlbumUploadSelection } from "@/components/dashboard/albums/AlbumUploadZone";
import AlbumUploadTrigger, {
  type AlbumUploadTriggerHandle,
} from "@/components/dashboard/albums/AlbumUploadTrigger";
import PhotoGrid from "@/components/photo/PhotoGrid";
import PhotoSlideViewer from "@/components/photo/PhotoSlideViewer";
import EventFolderAlbumTreePicker from "@/components/dashboard/EventFolderAlbumTreePicker";
import AlbumPhotoBulkUploadPanel from "@/components/dashboard/albums/AlbumPhotoBulkUploadPanel";
import AlbumFolderActionsBar, {
  type AlbumFolderActionsHandle,
} from "@/components/dashboard/albums/AlbumFolderActionsBar";
import AlbumFullFolderUploadConfirmModal from "@/components/dashboard/albums/AlbumFullFolderUploadConfirmModal";
import { AlbumFolderTreePanel } from "@/components/dashboard/albums/AlbumFolderTreePanel";
import {
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

  const itemClass =
    "w-full text-left px-3 py-2.5 text-sm text-[#374151] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="md"
        className="min-h-11 min-w-11 px-0 justify-center"
        disabled={disabled}
        aria-label="Más acciones de carpetas"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="w-5 h-5" aria-hidden />
      </Button>
      {open ? (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg"
          role="menu"
        >
          {folderActionsHint ? (
            <p className="px-3 py-2 text-xs text-[#6b7280] leading-snug m-0 border-b border-[#e5e7eb]">
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
            className={`${itemClass} text-red-700 hover:bg-red-50`}
            disabled={disabled || !hasFolderSelected}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Eliminar carpeta
          </button>
          <div className="my-1 border-t border-[#e5e7eb]" />
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
  const allSelectTargetsChosen =
    selectAllTargetIds.length > 0 &&
    selectAllTargetIds.every((id) => selectedPhotoIds.has(id));

  function toggleExpand(folderId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function selectFolder(key: FolderViewKey) {
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

  const folderTreePanel = (
    <AlbumFolderTreePanel
      folders={explorerFolders}
      selection={folderView}
      expanded={expanded}
      uncategorizedCount={uncategorizedCount}
      canManage={canManageFolders}
      disabled={foldersLoading}
      onSelect={selectFolder}
      onToggleExpand={toggleExpand}
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#111827]/10 bg-white/[0.98] backdrop-blur-md shadow-[0_-8px_32px_rgba(0,0,0,0.12)]"
        role="region"
        aria-label="Acciones sobre fotos seleccionadas"
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <div className="flex flex-col gap-4">
            <div className="min-w-[12rem] shrink-0">
              <p className="text-sm font-semibold text-[#1a1a1a] m-0 leading-snug">{selectionLabel}</p>
              <p className="text-xs text-[#6b7280] m-0 mt-0.5">
                {mode === "album" ? "Elegí una carpeta destino" : "Elegí una carpeta del evento"}
              </p>
              {bulkFolderBanner ? (
                <p
                  role="status"
                  className={`text-xs mt-1.5 font-medium m-0 leading-snug ${
                    bulkFolderBanner.kind === "success" ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {bulkFolderBanner.text}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
              <div className="w-full lg:flex-1 lg:min-w-[16rem]">
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
                  <label className="block w-full space-y-1.5">
                    <span className="block text-sm font-medium text-[#1a1a1a]">Carpeta destino</span>
                    <select
                      className="w-full min-h-11 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm text-[#1a1a1a] shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d]/40 disabled:opacity-60"
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
                  </label>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:shrink-0">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full sm:min-w-[10.5rem] min-h-11 justify-center whitespace-nowrap rounded-xl"
                  onClick={() => void onBulkApplyFolder()}
                  disabled={bulkFolderPick === "" || bulkFolderLoading}
                >
                  {bulkFolderLoading ? "Guardando…" : "Aplicar carpeta"}
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full sm:min-w-[10.5rem] min-h-11 justify-center whitespace-nowrap rounded-xl border-[#111827]/12"
                  onClick={() => void onBulkClearFolder()}
                  disabled={bulkFolderLoading}
                >
                  Quitar de carpeta
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const photosPanel = (
    <div className="min-w-0 flex-1 ds-stack-section gap-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold text-[#1a1a1a] m-0 truncate" title={currentFolderLabel}>
            {currentFolderLabel}
          </h3>
          <p className="text-sm text-[#6b7280] m-0">
            {folderViewPhotosLoading ? "Cargando…" : photoCountLabel}
            {folderView !== "all" && albumHasPhotos
              ? ` · ${albumPhotoTotal} en el álbum`
              : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            className="min-h-11"
            disabled={uploadDisabled}
            onClick={() => uploadTriggerRef.current?.pickFiles()}
          >
            Subir fotos aquí
          </Button>
          {mpConnected === false ? (
            <p className="text-xs text-amber-700 m-0">Conectá Mercado Pago para subir fotos.</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {photoSelectionEnabled && gridPhotos.length > 0 ? (
          <>
            {!allSelectTargetsChosen && selectAllTargetIds.length > 0 ? (
              <Button
                variant="secondary"
                size="md"
                className="min-h-11"
                onClick={selectAllVisible}
                disabled={deletingSelected || bulkFolderLoading}
              >
                Seleccionar visibles
              </Button>
            ) : null}
            {selectedPhotoIds.size > 0 ? (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  className="min-h-11"
                  onClick={onClearSelection}
                  disabled={deletingSelected || bulkFolderLoading}
                >
                  Deseleccionar
                </Button>
                {canDeleteAny ? (
                  <Button
                    variant="primary"
                    size="md"
                    className="min-h-11 bg-red-600 hover:bg-red-700"
                    onClick={onDeleteSelected}
                    disabled={deletingSelected}
                  >
                    {deletingSelected
                      ? "Eliminando..."
                      : `Eliminar (${selectedPhotoIds.size})`}
                  </Button>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </div>

      {folderViewPhotosLoading ? (
        <Card>
          <p className="text-center py-10 text-[#6b7280] m-0" role="status">
            Cargando fotos…
          </p>
        </Card>
      ) : gridPhotos.length > 0 ? (
        <div className="ds-gallery-inner w-full min-w-0 ds-stack-section gap-4">
          <PhotoGrid
            photos={gridPhotos}
            onPhotoSelect={photoSelectionEnabled ? handlePhotoSelectFromGrid : undefined}
            onPhotoRemove={onDeletePhoto}
            onPhotoSetCover={onSetCover ? handleSetCoverFromGrid : undefined}
            onPhotoSellOptionChange={showSellOptions ? handlePhotoSellOptionChange : undefined}
            onPhotoOpenSlide={(id) => {
              const idx = gridPhotos.findIndex((p) => p.id === id);
              if (idx >= 0) {
                setSlideViewerIndex(idx);
                setShowSlideViewer(true);
              }
            }}
          />
          {folderViewNextCursor ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="min-h-11 w-full sm:w-auto"
                disabled={isLoadingMore || folderViewPhotosLoading}
                onClick={() => loadMoreFolderPhotos()}
              >
                {isLoadingMore ? "Cargando…" : "Cargar más"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : !folderViewPhotosLoading && folderViewTotalCount === 0 && albumHasPhotos ? (
        <Card>
          <div className="text-center py-10 px-4 space-y-3">
            <p className="text-[#374151] font-medium m-0">Todavía no hay fotos en esta carpeta</p>
            <p className="text-sm text-[#6b7280] m-0">
              Subí archivos con el botón de arriba o mové fotos desde otra carpeta.
            </p>
            <Button
              type="button"
              variant="primary"
              size="md"
              className="min-h-11"
              disabled={uploadDisabled}
              onClick={() => uploadTriggerRef.current?.pickFiles()}
            >
              Subir fotos aquí
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="text-center py-10 px-4 space-y-3">
            <p className="text-[#374151] font-medium m-0">Tu álbum está vacío</p>
            <p className="text-sm text-[#6b7280] m-0">
              Empezá subiendo las primeras fotos. Podés organizarlas en carpetas después.
            </p>
            <Button
              type="button"
              variant="primary"
              size="md"
              className="min-h-11"
              disabled={uploadDisabled}
              onClick={() => uploadTriggerRef.current?.pickFiles()}
            >
              Subir fotos aquí
            </Button>
          </div>
        </Card>
      )}
    </div>
  );

  return (
    <div className="w-full min-w-0 ds-stack-section gap-5">
      <AlbumUploadTrigger
        ref={uploadTriggerRef}
        onFilesSelected={onFilesSelected}
        disabled={uploadDisabled}
      />

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

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-[#1a1a1a] m-0">Fotos</h2>
        <p className="text-sm text-[#6b7280] m-0">
          Organizá y subí el material de tu álbum por carpetas.
        </p>
      </div>

      {mode === "event" ? (
        <div className="rounded-xl border border-[#e5e7eb] bg-[#fafaf9] px-4 py-3">
          <p className="text-sm text-[#374151] m-0 leading-relaxed">
            Carpetas definidas por el organizador. Los fotógrafos solo pueden subir fotos en las
            carpetas existentes.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="md"
          className="min-h-11 hidden lg:inline-flex"
          disabled={uploadDisabled}
          onClick={() => uploadTriggerRef.current?.pickFiles()}
        >
          Subir fotos
        </Button>
        {canManageFolders ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="min-h-11"
              disabled={foldersLoading || uploading}
              onClick={() => folderActionsRef.current?.openCreateFolder(null)}
            >
              Nueva carpeta
            </Button>
            <FolderManageMenu
              disabled={foldersLoading || uploading}
              hasFolderSelected={hasFolderSelected}
              folderActionsHint={folderActionsHint}
              onNewSubfolder={() =>
                folderActionsRef.current?.openCreateFolder(
                  typeof folderView === "number" ? folderView : null
                )
              }
              onRename={() => folderActionsRef.current?.openRenameFolder()}
              onMove={() => folderActionsRef.current?.openMoveFolder()}
              onDelete={() => folderActionsRef.current?.openDeleteFolder()}
              onUploadFolder={requestFullFolderUpload}
            />
          </>
        ) : mode === "album" ? null : (
          <Button
            type="button"
            variant="outline"
            size="md"
            className="min-h-11"
            disabled={uploadDisabled}
            onClick={requestFullFolderUpload}
          >
            Subir carpeta completa
          </Button>
        )}
      </div>

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
        <>
          {/* Mobile: selector de carpeta + grilla */}
          <div className="lg:hidden space-y-3">
            {showExplorerChrome ? (
              <button
                type="button"
                className="w-full min-h-11 flex items-center justify-between gap-3 rounded-xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-left shadow-sm"
                onClick={() => setMobileFolderOpen(true)}
                disabled={foldersLoading}
              >
                <span className="text-sm text-[#6b7280]">Carpeta:</span>
                <span className="text-sm font-medium text-[#1a1a1a] truncate flex-1 text-right">
                  {currentFolderLabel}
                </span>
                <ChevronDown className="w-4 h-4 shrink-0 text-[#9ca3af]" aria-hidden />
              </button>
            ) : null}
            {photosPanel}
          </div>

          {/* Desktop: sidebar + grilla */}
          <div className="hidden lg:flex w-full min-w-0 gap-4">
            {showExplorerChrome ? (
              <Card className="w-full lg:w-60 xl:w-64 shrink-0 p-3 sm:p-4 min-w-0">
                <div className="ds-stack-section gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280] m-0">
                    Carpetas
                  </p>
                  {folderTreePanel}
                </div>
              </Card>
            ) : null}
            {photosPanel}
          </div>
        </>
      )}

      <AppModal
        open={mobileFolderOpen}
        onClose={() => setMobileFolderOpen(false)}
        title="Elegir carpeta"
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
