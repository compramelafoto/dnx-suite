"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import AppModal from "@/components/ui/AppModal";
import { DsInfoPanel } from "@/components/ui/DsLayout";
import { DsField } from "@/components/ui/DsField";
import type { ExplorerFolderRow, FolderViewKey } from "@/lib/albums/album-folder-view-model";
import { folderDescendantIds, folderSubtreeStats } from "@/lib/albums/album-folder-view-model";

const MODAL_BODY_CLASS = "ds-modal-scroll--padded";

export type AlbumFolderActionsHandle = {
  openCreateFolder: (parentId?: number | null) => void;
  openRenameFolder: () => void;
  openMoveFolder: () => void;
  openDeleteFolder: () => void;
};

export type AlbumFolderActionsBarProps = {
  albumId: number;
  canManage: boolean;
  selection: FolderViewKey;
  folders: ExplorerFolderRow[];
  disabled?: boolean;
  onFoldersChanged: () => void;
  onError: (message: string) => void;
  onSelect: (key: FolderViewKey) => void;
};

function cmpFolder(a: ExplorerFolderRow, b: ExplorerFolderRow): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id - b.id;
}

function buildIndentedMoveOptions(
  folders: ExplorerFolderRow[],
  blocked: Set<number>
): Array<{ id: string; label: string }> {
  const opts: Array<{ id: string; label: string }> = [
    { id: "", label: "Raíz del álbum (sin carpeta padre)" },
  ];

  function walk(parentId: number | null, depth: number) {
    folders
      .filter((f) => f.parentId === parentId)
      .sort(cmpFolder)
      .forEach((f) => {
        if (blocked.has(f.id)) return;
        const prefix = depth > 0 ? `${"— ".repeat(depth)}` : "";
        opts.push({ id: String(f.id), label: `${prefix}${f.name}` });
        walk(f.id, depth + 1);
      });
  }

  walk(null, 0);
  return opts;
}

function FolderModalFooter({
  busy,
  confirmDisabled,
  onCancel,
  onConfirm,
  confirmLabel,
  destructive = false,
}: {
  busy: boolean;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  destructive?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-[#ebe8e4]">
      <Button
        variant="secondary"
        size="md"
        className="min-h-11 w-full sm:w-auto sm:min-w-[7.5rem]"
        disabled={busy}
        onClick={onCancel}
      >
        Cancelar
      </Button>
      <Button
        variant="primary"
        size="md"
        className={`min-h-11 w-full sm:w-auto sm:min-w-[7.5rem] ${
          destructive ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/30" : ""
        }`}
        disabled={busy || confirmDisabled}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </div>
  );
}

function FolderModalBody({ children }: { children: ReactNode }) {
  return <div className="ds-form-stack gap-5">{children}</div>;
}

const AlbumFolderActionsBar = forwardRef<AlbumFolderActionsHandle, AlbumFolderActionsBarProps>(
  function AlbumFolderActionsBar(
    {
      albumId,
      canManage,
      selection,
      folders,
      disabled,
      onFoldersChanged,
      onError,
      onSelect,
    },
    ref
  ) {
    const [busy, setBusy] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [createParentId, setCreateParentId] = useState<number | null>(null);
    const [createName, setCreateName] = useState("");
    const [renameOpen, setRenameOpen] = useState(false);
    const [renameName, setRenameName] = useState("");
    const [moveOpen, setMoveOpen] = useState(false);
    const [moveParentId, setMoveParentId] = useState<string>("");
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteCascadeAck, setDeleteCascadeAck] = useState(false);

    const selectedFolder =
      typeof selection === "number" ? folders.find((f) => f.id === selection) : null;

    const deleteSubtreeStats = useMemo(() => {
      if (!selectedFolder) return null;
      return folderSubtreeStats(folders, selectedFolder.id);
    }, [folders, selectedFolder]);

    const deleteHasContent =
      deleteSubtreeStats != null &&
      (deleteSubtreeStats.photoCount > 0 || deleteSubtreeStats.subfolderCount > 0);

    const createParentFolder =
      createParentId != null ? folders.find((f) => f.id === createParentId) : null;

    const moveParentOptions = useMemo(() => {
      if (!selectedFolder) return [];
      const blocked = folderDescendantIds(folders, selectedFolder.id);
      return buildIndentedMoveOptions(folders, blocked);
    }, [folders, selectedFolder]);

    useImperativeHandle(
      ref,
      () => ({
        openCreateFolder: (parentId?: number | null) => {
          setCreateParentId(parentId ?? null);
          setCreateName("");
          setCreateOpen(true);
        },
        openRenameFolder: () => {
          if (!selectedFolder) return;
          setRenameName(selectedFolder.name);
          setRenameOpen(true);
        },
        openMoveFolder: () => {
          if (!selectedFolder) return;
          setMoveParentId(
            selectedFolder.parentId != null ? String(selectedFolder.parentId) : ""
          );
          setMoveOpen(true);
        },
        openDeleteFolder: () => {
          if (!selectedFolder) return;
          setDeleteCascadeAck(false);
          setDeleteOpen(true);
        },
      }),
      [selectedFolder]
    );

    async function createFolder() {
      const name = createName.trim();
      if (!name) {
        onError("Ingresá un nombre para la carpeta.");
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(`/api/dashboard/albums/${albumId}/folders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            ...(createParentId != null ? { parentId: createParentId } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data?.error === "string" ? data.error : "No se pudo crear la carpeta."
          );
        }
        setCreateOpen(false);
        setCreateName("");
        setCreateParentId(null);
        onFoldersChanged();
        if (typeof data?.id === "number") onSelect(data.id);
      } catch (e: unknown) {
        onError(e instanceof Error ? e.message : "Error creando carpeta");
      } finally {
        setBusy(false);
      }
    }

    async function renameFolder() {
      if (!selectedFolder) return;
      const name = renameName.trim();
      if (!name) {
        onError("Ingresá un nombre para la carpeta.");
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(
          `/api/dashboard/albums/${albumId}/folders/${selectedFolder.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "No se pudo renombrar.");
        }
        setRenameOpen(false);
        onFoldersChanged();
      } catch (e: unknown) {
        onError(e instanceof Error ? e.message : "Error renombrando carpeta");
      } finally {
        setBusy(false);
      }
    }

    async function moveFolder() {
      if (!selectedFolder) return;
      setBusy(true);
      try {
        const parentId =
          moveParentId === ""
            ? null
            : (() => {
                const n = parseInt(moveParentId, 10);
                return Number.isFinite(n) && n > 0 ? n : null;
              })();
        const res = await fetch(
          `/api/dashboard/albums/${albumId}/folders/${selectedFolder.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parentId }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "No se pudo mover.");
        }
        setMoveOpen(false);
        onFoldersChanged();
      } catch (e: unknown) {
        onError(e instanceof Error ? e.message : "Error moviendo carpeta");
      } finally {
        setBusy(false);
      }
    }

    async function deleteFolder() {
      if (!selectedFolder) return;
      setBusy(true);
      try {
        const url = deleteHasContent
          ? `/api/dashboard/albums/${albumId}/folders/${selectedFolder.id}?cascade=true`
          : `/api/dashboard/albums/${albumId}/folders/${selectedFolder.id}`;
        const res = await fetch(url, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "No se pudo eliminar.");
        }
        setDeleteOpen(false);
        setDeleteCascadeAck(false);
        onSelect("all");
        onFoldersChanged();
      } catch (e: unknown) {
        onError(e instanceof Error ? e.message : "Error eliminando carpeta");
      } finally {
        setBusy(false);
      }
    }

    function formatDeleteImpact(): string {
      if (!deleteSubtreeStats || !selectedFolder) return "";
      const parts: string[] = [];
      if (deleteSubtreeStats.photoCount > 0) {
        parts.push(
          `${deleteSubtreeStats.photoCount} foto${deleteSubtreeStats.photoCount !== 1 ? "s" : ""}`
        );
      }
      if (deleteSubtreeStats.subfolderCount > 0) {
        parts.push(
          `${deleteSubtreeStats.subfolderCount} subcarpeta${deleteSubtreeStats.subfolderCount !== 1 ? "s" : ""}`
        );
      }
      return parts.join(" y ");
    }

    if (!canManage) return null;

    return (
      <>
        <AppModal
          open={createOpen}
          onClose={() => !busy && setCreateOpen(false)}
          title={createParentId != null ? "Nueva subcarpeta" : "Nueva carpeta"}
          description={
            createParentFolder
              ? `Se creará dentro de «${createParentFolder.name}».`
              : "Organizá tus fotos en carpetas dentro del álbum."
          }
          size="lg"
          contentClassName={MODAL_BODY_CLASS}
        >
          <FolderModalBody>
            <DsField label="Nombre de la carpeta" hint="Ej.: Ceremonia, Grupo A, Entrega">
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                disabled={busy || disabled}
                autoFocus
                placeholder="Escribí un nombre claro"
                className="w-full min-h-11"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createFolder();
                }}
              />
            </DsField>
            <FolderModalFooter
              busy={busy}
              onCancel={() => setCreateOpen(false)}
              onConfirm={() => void createFolder()}
              confirmLabel={busy ? "Creando…" : "Crear carpeta"}
            />
          </FolderModalBody>
        </AppModal>

        <AppModal
          open={renameOpen}
          onClose={() => !busy && setRenameOpen(false)}
          title="Renombrar carpeta"
          description={
            selectedFolder
              ? `Cambiá el nombre visible de «${selectedFolder.name}».`
              : undefined
          }
          size="lg"
          contentClassName={MODAL_BODY_CLASS}
        >
          <FolderModalBody>
            <DsField label="Nuevo nombre">
              <Input
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                disabled={busy || disabled}
                autoFocus
                className="w-full min-h-11"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void renameFolder();
                }}
              />
            </DsField>
            <FolderModalFooter
              busy={busy}
              onCancel={() => setRenameOpen(false)}
              onConfirm={() => void renameFolder()}
              confirmLabel={busy ? "Guardando…" : "Guardar"}
            />
          </FolderModalBody>
        </AppModal>

        <AppModal
          open={moveOpen}
          onClose={() => !busy && setMoveOpen(false)}
          title="Mover carpeta"
          description={
            selectedFolder
              ? `Elegí dónde ubicar «${selectedFolder.name}» dentro del álbum.`
              : undefined
          }
          size="lg"
          contentClassName={MODAL_BODY_CLASS}
        >
          <FolderModalBody>
            <DsField
              label="Ubicación destino"
              hint="No podés mover una carpeta dentro de sí misma ni de sus subcarpetas."
            >
              <select
                className="ds-form-control w-full min-h-11 rounded-xl border border-[#e5e7eb] px-3 py-2.5 text-sm bg-white"
                value={moveParentId}
                disabled={busy || disabled}
                onChange={(e) => setMoveParentId(e.target.value)}
              >
                {moveParentOptions.map((o) => (
                  <option key={o.id || "root"} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </DsField>
            <FolderModalFooter
              busy={busy}
              onCancel={() => setMoveOpen(false)}
              onConfirm={() => void moveFolder()}
              confirmLabel={busy ? "Moviendo…" : "Mover carpeta"}
            />
          </FolderModalBody>
        </AppModal>

        <AppModal
          open={deleteOpen}
          onClose={() => {
            if (busy) return;
            setDeleteOpen(false);
            setDeleteCascadeAck(false);
          }}
          title={deleteHasContent ? "Eliminar carpeta y contenido" : "Eliminar carpeta"}
          description={
            deleteHasContent
              ? "Se borrarán permanentemente las fotos y subcarpetas dentro de esta carpeta."
              : "Esta acción no se puede deshacer."
          }
          size="lg"
          contentClassName={MODAL_BODY_CLASS}
        >
          <FolderModalBody>
            {deleteHasContent ? (
              <>
                <DsInfoPanel title="Vas a eliminar">
                  <p className="ds-readable-text text-sm text-[#374151] m-0">
                    La carpeta{" "}
                    <span className="font-semibold text-[#1a1a1a]">
                      &quot;{selectedFolder?.name}&quot;
                    </span>{" "}
                    y todo su contenido:{" "}
                    <span className="font-medium text-[#1a1a1a]">{formatDeleteImpact()}</span>.
                    Las fotos se quitarán del álbum y no podrás recuperarlas.
                  </p>
                </DsInfoPanel>
                <label className="flex items-start gap-3 rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 rounded border-[#d1d5db] text-[#c27b3d] focus-visible:ring-2 focus-visible:ring-[#c27b3d]/30"
                    checked={deleteCascadeAck}
                    disabled={busy || disabled}
                    onChange={(e) => setDeleteCascadeAck(e.target.checked)}
                  />
                  <span className="ds-readable-text text-sm text-[#374151]">
                    Entiendo que se eliminarán permanentemente todas las fotos y subcarpetas de
                    esta carpeta.
                  </span>
                </label>
              </>
            ) : (
              <div className="rounded-xl border border-red-100 bg-red-50/80 px-4 py-3">
                <p className="ds-readable-text text-sm text-[#374151] m-0">
                  ¿Eliminar la carpeta{" "}
                  <span className="font-semibold text-[#1a1a1a]">
                    &quot;{selectedFolder?.name}&quot;
                  </span>
                  ? Está vacía y no tiene subcarpetas.
                </p>
              </div>
            )}
            <FolderModalFooter
              busy={busy}
              confirmDisabled={deleteHasContent && !deleteCascadeAck}
              onCancel={() => {
                setDeleteOpen(false);
                setDeleteCascadeAck(false);
              }}
              onConfirm={() => void deleteFolder()}
              confirmLabel={
                busy
                  ? "Eliminando…"
                  : deleteHasContent
                    ? "Eliminar carpeta y contenido"
                    : "Eliminar carpeta"
              }
              destructive
            />
          </FolderModalBody>
        </AppModal>
      </>
    );
  }
);

export default AlbumFolderActionsBar;
