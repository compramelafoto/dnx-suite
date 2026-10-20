"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { getBlockDisplayName, getBlockTypeLabelEs } from "@repo/template-editor-core";
import {
  buildPasteStyleUpdate,
  canPasteStyle,
  extractBlockStyle,
  clearCopiedBlockStyle,
  getCopiedBlockStyleSnapshot,
  setCopiedBlockStyle,
  subscribeCopiedBlockStyle,
} from "@repo/template-editor-core";
import type { TemplateV2Block } from "@repo/template-editor-core";
import type { TemplateV2EditorDispatch, TemplateV2EditorState } from "@repo/template-editor-core";
import {
  duplicateBlock,
  getPrimarySelectedBlockId,
  removeBlock,
  selectBlock,
  setBlocks,
  setSelectedBlockIds,
  toggleBlockInSelection,
  updateBlock,
} from "@repo/template-editor-core";
import { reorderLayersByPanelIndexForPage, sortBlocksByZIndexDesc } from "@repo/template-editor-core";
import { cn } from "./primitives/cn";

const layerActionBtnClass =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--te-radius)] text-[color:var(--te-ink-faint)] transition-colors hover:bg-white/[0.08] hover:text-[color:var(--te-ink)] disabled:pointer-events-none disabled:opacity-30";

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M7 11V7a5 5 0 0 1 10 0v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUnlock({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M7 11V7a5 5 0 0 1 9.9-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDuplicate({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M4 16V6a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Rodillo / pincel = copiar estilo (format painter). */
function IconFormatPainter({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 21h8M6 21v-4M4 17a2 2 0 0 1 2-2h2l9-9a2 2 0 0 1 2.83 0l1.17 1.17a2 2 0 0 1 0 2.83L10 17H6a2 2 0 0 1-2 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 6l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  state: TemplateV2EditorState;
  dispatch: TemplateV2EditorDispatch;
};

export function TemplateEditorLayers({ state, dispatch }: Props) {
  const activePage = state.activePageIndex ?? 0;
  const ordered = useMemo(
    () => sortBlocksByZIndexDesc(state.blocks.filter((b) => (b.pageIndex ?? 0) === activePage)),
    [state.blocks, activePage]
  );
  const primaryId = useMemo(
    () => getPrimarySelectedBlockId(state),
    [state]
  );

  const clipSnap = useSyncExternalStore(
    subscribeCopiedBlockStyle,
    getCopiedBlockStyleSnapshot,
    getCopiedBlockStyleSnapshot
  );
  const copiedStyle = clipSnap.data;
  const styleSourceId = clipSnap.sourceBlockId;

  const [styleFeedback, setStyleFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStyleFeedback = useCallback((msg: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setStyleFeedback(msg);
    feedbackTimerRef.current = setTimeout(() => {
      setStyleFeedback(null);
      feedbackTimerRef.current = null;
    }, 2600);
  }, []);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const draftNameRef = useRef("");
  const skipBlurCommitRef = useRef(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const dragFromIndexRef = useRef<number | null>(null);

  const commitRename = useCallback(
    (blockId: string, value: string) => {
      const trimmed = value.trim();
      dispatch(updateBlock(blockId, { name: trimmed === "" ? null : trimmed }));
      setEditingId(null);
      setDraftName("");
      draftNameRef.current = "";
    },
    [dispatch]
  );

  const cancelRename = useCallback(() => {
    skipBlurCommitRef.current = true;
    setEditingId(null);
    setDraftName("");
    draftNameRef.current = "";
    window.setTimeout(() => {
      skipBlurCommitRef.current = false;
    }, 0);
  }, []);

  const beginRename = useCallback(
    (block: TemplateV2Block) => {
      if (editingId === block.id) return;
      if (editingId && editingId !== block.id) {
        commitRename(editingId, draftNameRef.current);
      }
      setEditingId(block.id);
      const initial = block.name ?? "";
      setDraftName(initial);
      draftNameRef.current = initial;
    },
    [editingId, commitRename]
  );

  useEffect(() => {
    if (!editingId) return;
    if (!state.blocks.some((b) => b.id === editingId)) {
      setEditingId(null);
      setDraftName("");
      draftNameRef.current = "";
    }
  }, [state.blocks, editingId]);

  /** Selección / Mayús+selección; si hay estilo copiado y la capa es destino distinta, aplica pegado. */
  const tryPasteStyleThenSelect = useCallback(
    (block: TemplateV2Block, shiftKey: boolean) => {
      if (shiftKey) {
        dispatch(toggleBlockInSelection(block.id));
        return;
      }
      const clip = copiedStyle;
      const src = styleSourceId;
      if (clip && src && block.id !== src) {
        if (block.layout.locked) {
          showStyleFeedback("Desbloqueá la capa para aplicar el estilo.");
        } else if (!canPasteStyle(clip, block.type)) {
          showStyleFeedback("Este tipo de bloque no admite el estilo copiado.");
        } else {
          const patch = buildPasteStyleUpdate(clip, block);
          if (patch) {
            dispatch(
              updateBlock(block.id, {
                configJson: patch.configJson,
                ...(patch.layout ? { layout: patch.layout } : {}),
              })
            );
            showStyleFeedback("Estilo aplicado.");
          }
        }
      }
      dispatch(selectBlock(block.id));
    },
    [copiedStyle, styleSourceId, dispatch, showStyleFeedback]
  );

  return (
    <div className="flex flex-col">
      {copiedStyle ? (
        <p
          className="border-b border-[color:var(--te-line)] bg-[color:var(--te-accent-wash)] px-2 py-1 text-[10px] leading-snug text-[color:var(--te-ink)]"
          role="status"
          aria-live="polite"
        >
          <span className="font-semibold text-[color:var(--te-accent)]">Estilo copiado.</span> Tocá otra capa compatible
          para aplicarlo. Volvé a pulsar el rodillo para cancelar.
        </p>
      ) : null}
      {styleFeedback ? (
        <p className="border-b border-[color:var(--te-line)] bg-amber-400/10 px-2 py-1 text-[10px] text-amber-200">
          {styleFeedback}
        </p>
      ) : null}
      {ordered.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-[color:var(--te-ink-faint)]">No hay bloques en el lienzo.</p>
      ) : (
        /*
         * Filas al estilo de los paneles de capas de los editores de imagen: el ojo en su propia
         * columna a la izquierda, un ícono del tipo de capa, el nombre en una línea y el candado a
         * la derecha. Las acciones (renombrar, duplicar, copiar estilo, eliminar) aparecen al pasar
         * el mouse: con seis capas, verlas siempre era una grilla de íconos que tapaba los nombres.
         * Se reordena arrastrando la fila entera.
         */
        <ul role="list">
          {ordered.map((block, index) => {
            const selected = state.selectedBlockIds.includes(block.id);
            const isPrimary = selected && primaryId === block.id;
            const isSecondary = selected && !isPrimary;
            const locked = block.layout.locked ?? false;
            const visible = block.layout.visible;
            const editing = editingId === block.id;
            const styleSource = Boolean(copiedStyle && styleSourceId === block.id);
            const rowTitle = `${getBlockDisplayName(block)} · ${getBlockTypeLabelEs(block.type)}`;
            /*
             * La opacidad se editaba acá, con un deslizador visible en cada fila. Con seis
             * capas eso era media pantalla de deslizadores y la lista dejaba de servir para lo
             * único que tiene que hacer: mostrar qué hay y en qué orden. Vive en el inspector,
             * junto al resto de las propiedades del bloque.
             */
            return (
              <li
                key={block.id}
                title={rowTitle}
                draggable={!editing}
                onDragStart={(e) => {
                  dragFromIndexRef.current = index;
                  setDragSourceIndex(index);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", block.id);
                }}
                onDragEnd={() => {
                  dragFromIndexRef.current = null;
                  setDragSourceIndex(null);
                  setDragOverIndex(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverIndex(index);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragFromIndexRef.current;
                  setDragOverIndex(null);
                  setDragSourceIndex(null);
                  dragFromIndexRef.current = null;
                  if (from === null || from === index) return;
                  dispatch(
                    setBlocks(reorderLayersByPanelIndexForPage(state.blocks, activePage, from, index))
                  );
                }}
                onClick={(e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest("button") || t.closest("input")) return;
                  if (editing) return;
                  tryPasteStyleThenSelect(block, e.shiftKey);
                }}
                onDoubleClick={(e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest("button") || t.closest("input")) return;
                  e.preventDefault();
                  beginRename(block);
                }}
                className={cn(
                  "group relative flex h-8 cursor-default select-none items-center border-b border-[color:var(--te-chrome-sunken)] text-[12px] transition-colors",
                  isPrimary && "bg-[color:var(--te-accent-wash)]",
                  isSecondary && "bg-white/[0.05]",
                  !selected && "hover:bg-white/[0.04]",
                  styleSource && "outline outline-1 -outline-offset-1 outline-[color:var(--te-accent)]",
                  dragOverIndex === index &&
                    dragSourceIndex !== null &&
                    dragSourceIndex !== index &&
                    "shadow-[inset_0_2px_0_0_var(--te-accent)]",
                  dragSourceIndex === index && "opacity-50"
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "flex h-full w-7 shrink-0 items-center justify-center border-r border-[color:var(--te-chrome-sunken)] transition-colors hover:text-[color:var(--te-ink)]",
                    visible ? "text-[color:var(--te-ink-muted)]" : "text-[color:var(--te-ink-faint)] opacity-60"
                  )}
                  title={visible ? "Ocultar en el lienzo" : "Mostrar en el lienzo"}
                  aria-label={visible ? "Ocultar capa" : "Mostrar capa"}
                  aria-pressed={visible}
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !visible;
                    dispatch(updateBlock(block.id, { layout: { visible: next } }));
                    if (!next && state.selectedBlockIds.includes(block.id)) {
                      dispatch(setSelectedBlockIds(state.selectedBlockIds.filter((id) => id !== block.id)));
                    }
                  }}
                >
                  {visible ? <IconEye className="block h-3.5 w-3.5" /> : <IconEyeOff className="block h-3.5 w-3.5" />}
                </button>

                <LayerTypeThumb type={block.type} />

                <div className="flex min-w-0 flex-1 items-center pr-1">
                  {editing ? (
                    <input
                      type="text"
                      className="h-6 min-w-0 flex-1 rounded-[var(--te-radius)] border border-[color:var(--te-accent)] bg-[color:var(--te-chrome-sunken)] px-1.5 text-[12px] text-[color:var(--te-ink)] focus:outline-none"
                      value={draftName}
                      autoFocus
                      aria-label="Nombre del bloque"
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraftName(v);
                        draftNameRef.current = v;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          skipBlurCommitRef.current = true;
                          commitRename(block.id, (e.target as HTMLInputElement).value);
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelRename();
                        }
                      }}
                      onBlur={(e) => {
                        if (skipBlurCommitRef.current) {
                          skipBlurCommitRef.current = false;
                          return;
                        }
                        commitRename(block.id, e.currentTarget.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        visible ? "text-[color:var(--te-ink)]" : "text-[color:var(--te-ink-faint)]",
                        isPrimary && "font-medium"
                      )}
                    >
                      {getBlockDisplayName(block)}
                    </span>
                  )}
                </div>

                {!editing ? (
                  <div
                    className={cn(
                      "flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
                      styleSource && "opacity-100"
                    )}
                  >
                    <button
                      type="button"
                      className={layerActionBtnClass}
                      title="Renombrar (doble clic en la fila)"
                      aria-label="Renombrar capa"
                      onClick={(e) => {
                        e.stopPropagation();
                        beginRename(block);
                      }}
                    >
                      <IconPencil className="block h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className={layerActionBtnClass}
                      title="Duplicar capa"
                      aria-label="Duplicar capa"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch(duplicateBlock(block.id));
                      }}
                    >
                      <IconDuplicate className="block h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className={cn(layerActionBtnClass, styleSource && "bg-[color:var(--te-accent-wash)] text-[color:var(--te-accent)]")}
                      title={styleSource ? "Cancelar copiar estilo" : "Copiar estilo"}
                      aria-label={styleSource ? "Cancelar copiar estilo" : "Copiar estilo"}
                      disabled={extractBlockStyle(block) === null}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (styleSource) {
                          clearCopiedBlockStyle();
                          return;
                        }
                        const st = extractBlockStyle(block);
                        if (st) setCopiedBlockStyle(st, block.id);
                      }}
                    >
                      <IconFormatPainter className="block h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className={cn(layerActionBtnClass, "hover:bg-[color:var(--te-danger-wash)] hover:text-[color:var(--te-danger)]")}
                      title="Eliminar capa"
                      aria-label="Eliminar capa"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch(removeBlock(block.id));
                      }}
                    >
                      <IconTrash className="block h-3 w-3" />
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  className={cn(
                    layerActionBtnClass,
                    "mr-1",
                    locked ? "text-[color:var(--te-ink-muted)]" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  )}
                  title={locked ? "Desbloquear edición" : "Bloquear edición"}
                  aria-label={locked ? "Desbloquear capa" : "Bloquear capa"}
                  aria-pressed={locked}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch(updateBlock(block.id, { layout: { locked: !locked } }));
                  }}
                >
                  {locked ? <IconLock className="block h-3 w-3" /> : <IconUnlock className="block h-3 w-3" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Miniatura del tipo de capa, como la que muestran los paneles de capas de los editores de imagen. */
function LayerTypeThumb({ type }: { type: TemplateV2Block["type"] }) {
  const glyph: Record<string, string> = {
    TEXT: "T",
    VARIABLE_TEXT: "{ }",
    SHAPE: "■",
    QR: "▦",
  };
  const isImage = type === "IMAGE" || type === "PHOTO" || type === "BACKGROUND";
  return (
    <span
      className={cn(
        "mx-1.5 flex h-5 w-7 shrink-0 items-center justify-center rounded-[2px] border border-[color:var(--te-line)] text-[9px] font-semibold text-[color:var(--te-ink-muted)]",
        type === "BACKGROUND" ? "bg-[color:var(--te-ink-faint)]" : "bg-[color:var(--te-chrome-sunken)]"
      )}
      aria-hidden
    >
      {isImage ? (
        <svg viewBox="0 0 16 12" className="h-2.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="1" y="1" width="14" height="10" rx="1" />
          <path d="M1 9l4-3.5 3 2.5 2.5-2 4.5 3.5" strokeLinejoin="round" />
        </svg>
      ) : (
        glyph[type] ?? "·"
      )}
    </span>
  );
}
