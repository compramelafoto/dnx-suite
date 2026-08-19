"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { saveWebsiteBlocksAction, type WebsiteDraftSaveState } from "@/app/actions/website";
import {
  createEmptyBlock,
  getBlockPreviewLabel,
  WEBSITE_BLOCK_DEFINITIONS,
  type WebsiteBlock,
  type WebsiteBlockType,
} from "@/lib/website/blocks";
import { AddBlockPicker } from "./add-block-picker";
import { BlockEditDialog } from "./block-edit-dialog";

function normalize(blocks: WebsiteBlock[]): string {
  return JSON.stringify(blocks);
}

export function WebsiteEditor({
  initialBlocks,
  canEdit,
  draftUpdatedAt,
}: {
  initialBlocks: WebsiteBlock[];
  canEdit: boolean;
  draftUpdatedAt: string;
}) {
  const [blocks, setBlocks] = useState<WebsiteBlock[]>(initialBlocks);
  const [savedSnapshot, setSavedSnapshot] = useState(() => normalize(initialBlocks));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<WebsiteBlock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = normalize(blocks) !== savedSnapshot;

  function reorder(blocksList: WebsiteBlock[]): WebsiteBlock[] {
    return blocksList.map((b, i) => ({ ...b, order: i }) as WebsiteBlock);
  }

  function handleAddBlock(type: WebsiteBlockType) {
    setBlocks((prev) => {
      const next = reorder([...prev, createEmptyBlock(type, prev.length)]);
      setEditingBlock(next[next.length - 1]);
      return next;
    });
    setPickerOpen(false);
  }

  function handleMove(id: string, direction: "up" | "down") {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return reorder(next);
    });
  }

  function handleDelete(id: string) {
    setBlocks((prev) => reorder(prev.filter((b) => b.id !== id)));
  }

  function handleSaveBlock(updated: WebsiteBlock) {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setEditingBlock(null);
  }

  function handleSaveDraft() {
    setError(null);
    setSavedFlash(false);
    const fd = new FormData();
    fd.set("blocksJson", JSON.stringify(blocks));
    fd.set("draftUpdatedAt", draftUpdatedAt);
    startTransition(async () => {
      const res: WebsiteDraftSaveState = await saveWebsiteBlocksAction(undefined, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSavedSnapshot(normalize(blocks));
      setSavedFlash(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--fo-text)]">Home</h2>
        {canEdit ? (
          <div className="flex items-center gap-3">
            {dirty ? <span className="text-xs text-[var(--fo-warning)]">Cambios sin guardar</span> : null}
            {savedFlash && !dirty ? <span className="text-xs text-[var(--fo-success)]">Guardado</span> : null}
            <button
              type="button"
              className="fo-btn fo-btn-primary text-sm"
              disabled={!dirty || pending}
              onClick={handleSaveDraft}
            >
              {pending ? "Guardando…" : "Guardar borrador"}
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {blocks.length === 0 ? (
        <div className="fo-card text-center py-12 space-y-2">
          <p className="text-sm text-[var(--fo-muted)]">Todavía no agregaste ninguna sección a la Home.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {blocks.map((block, i) => (
            <li key={block.id}>
              <BlockCard
                block={block}
                canEdit={canEdit}
                isFirst={i === 0}
                isLast={i === blocks.length - 1}
                onEdit={() => setEditingBlock(block)}
                onMoveUp={() => handleMove(block.id, "up")}
                onMoveDown={() => handleMove(block.id, "down")}
                onDelete={() => handleDelete(block.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <button
          type="button"
          className="fo-btn fo-btn-secondary w-full justify-center gap-2 text-sm"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="h-4 w-4" /> Agregar sección
        </button>
      ) : null}

      {pickerOpen ? <AddBlockPicker onSelect={handleAddBlock} onClose={() => setPickerOpen(false)} /> : null}
      {editingBlock ? (
        <BlockEditDialog block={editingBlock} onSave={handleSaveBlock} onClose={() => setEditingBlock(null)} />
      ) : null}
    </div>
  );
}

function BlockCard({
  block,
  canEdit,
  isFirst,
  isLast,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  block: WebsiteBlock;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const def = WEBSITE_BLOCK_DEFINITIONS[block.type];

  return (
    <div className="fo-card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-accent)]">{def.label}</p>
          <p className="text-sm text-[var(--fo-text)] truncate mt-1">{getBlockPreviewLabel(block)}</p>
        </div>
        {!block.visible ? (
          <span className="shrink-0 text-xs text-[var(--fo-muted)] bg-[var(--fo-border-muted)] rounded-full px-2 py-1">
            Oculto
          </span>
        ) : null}
      </div>

      {canEdit ? (
        confirmingDelete ? (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--fo-border)]">
            <p className="text-sm text-[var(--fo-danger)]">¿Eliminar esta sección?</p>
            <div className="flex gap-2">
              <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setConfirmingDelete(false)}>
                Cancelar
              </button>
              <button type="button" className="fo-btn fo-btn-danger text-xs" onClick={onDelete}>
                Eliminar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--fo-border)]">
            <button type="button" className="fo-btn fo-btn-ghost text-xs gap-1" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Mover arriba"
                className="fo-btn fo-btn-ghost text-xs px-2"
                disabled={isFirst}
                onClick={onMoveUp}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Mover abajo"
                className="fo-btn fo-btn-ghost text-xs px-2"
                disabled={isLast}
                onClick={onMoveDown}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              className="fo-btn fo-btn-ghost text-xs gap-1 text-[var(--fo-danger)]"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
