"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { getBlockDisplayName, getBlockTypeLabelEs } from "@/lib/template-v2/block-display-name";
import {
  buildPasteStyleUpdate,
  canPasteStyle,
  extractBlockStyle,
  clearCopiedBlockStyle,
  getCopiedBlockStyleSnapshot,
  setCopiedBlockStyle,
  subscribeCopiedBlockStyle,
} from "@/lib/template-v2/block-style-clipboard";
import type { TemplateV2Block } from "@/lib/template-v2/render-core";
import type { TemplateV2EditorDispatch, TemplateV2EditorState } from "@/lib/template-v2/editor-store";
import {
  duplicateBlock,
  getPrimarySelectedBlockId,
  removeBlock,
  selectBlock,
  setBlocks,
  setSelectedBlockIds,
  toggleBlockInSelection,
  updateBlock,
} from "@/lib/template-v2/editor-store";
import { reorderLayersByPanelIndexForPage, sortBlocksByZIndexDesc } from "@/lib/template-v2/layer-order";
import { cn } from "@/lib/utils";

const layerActionBtnClass =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#94a3b8] transition-colors hover:bg-[#f3f4f6] hover:text-[#374151] disabled:pointer-events-none disabled:opacity-30";

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

function IconGrip({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden>
      <circle cx="3" cy="2.5" r="1.2" />
      <circle cx="9" cy="2.5" r="1.2" />
      <circle cx="3" cy="7" r="1.2" />
      <circle cx="9" cy="7" r="1.2" />
      <circle cx="3" cy="11.5" r="1.2" />
      <circle cx="9" cy="11.5" r="1.2" />
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
    <div className="mt-1 flex flex-col">
      <div className="shrink-0">
        {copiedStyle ? (
          <p
            className="mt-2 rounded-md border border-[#c27b3d]/45 bg-[#fdf6ef] px-2 py-1.5 text-[10px] leading-snug text-[#5c4a3a] shadow-sm"
            role="status"
            aria-live="polite"
          >
            <span className="font-semibold text-[#8b5a2b]">Estilo copiado.</span> Tocá otra capa compatible aquí abajo
            (texto↔texto, imagen↔imagen, forma↔forma) para aplicarlo. Volvé a pulsar el rodillo en la misma capa para
            cancelar.
          </p>
        ) : null}
        {styleFeedback ? (
          <p className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-950">
            {styleFeedback}
          </p>
        ) : null}
      </div>
      {ordered.length === 0 ? (
        <p className="mt-3 text-[11px] text-[#9ca3af]">No hay bloques en el lienzo.</p>
      ) : (
        <ul className="mt-2 space-y-1 pr-0.5">
          {ordered.map((block, index) => {
            const selected = state.selectedBlockIds.includes(block.id);
            const isPrimary = selected && primaryId === block.id;
            const isSecondary = selected && !isPrimary;
            const locked = block.layout.locked ?? false;
            const visible = block.layout.visible;
            const rowTitle = `${getBlockDisplayName(block)} · ${getBlockTypeLabelEs(block.type)} · ${block.id}`;
            const opacityPct = Math.round((block.layout.opacity ?? 1) * 100);
            return (
              <li
                key={block.id}
                title={rowTitle}
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
                  if (t.closest("[data-layer-opacity-row]")) return;
                  if (editingId === block.id) return;
                  tryPasteStyleThenSelect(block, e.shiftKey);
                }}
                className={cn(
                  "rounded-lg border py-1.5 pl-2 pr-2 transition-[background-color,border-color,box-shadow] duration-150 ease-out",
                  copiedStyle && styleSourceId === block.id && "ring-2 ring-[#c27b3d]/40 ring-offset-1",
                  dragOverIndex === index &&
                    dragSourceIndex !== null &&
                    dragSourceIndex !== index &&
                    "ring-2 ring-[#c27b3d]/35 ring-offset-1",
                  isPrimary &&
                    "border-[#bfdbfe] bg-[#eff6ff] shadow-[inset_3px_0_0_0_#2563eb,inset_0_0_0_1px_rgba(37,99,235,0.12)]",
                  isSecondary &&
                    "border-[#e2e8f0] bg-[#f8fafc] shadow-[inset_3px_0_0_0_#93c5fd,inset_0_0_0_1px_rgba(148,163,184,0.2)]",
                  !selected && "border-[#ebeef1] bg-white hover:border-[#d8dce2] hover:bg-[#fafbfc]"
                )}
              >
                <div className="flex items-center gap-1.5">
                  {editingId === block.id ? (
                    <span className="w-5 shrink-0" aria-hidden />
                  ) : (
                    <button
                      type="button"
                      draggable
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
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 cursor-grab rounded px-0.5 py-1 text-[#cbd5e1] transition-colors active:cursor-grabbing hover:bg-[#f1f5f9] hover:text-[#64748b]"
                      title="Arrastrar para reordenar capas"
                      aria-label="Arrastrar para reordenar capas"
                    >
                      <IconGrip className="block" />
                    </button>
                  )}
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    {editingId === block.id ? (
                      <input
                        type="text"
                        className="min-w-0 flex-1 rounded-md border border-[#c27b3d]/50 bg-white px-2 py-1 text-xs font-semibold text-[#111827] shadow-sm focus:border-[#c27b3d] focus:outline-none focus:ring-1 focus:ring-[#c27b3d]/35"
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
                      <>
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={(e) => tryPasteStyleThenSelect(block, e.shiftKey)}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            beginRename(block);
                          }}
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            {isPrimary ? (
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb] shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
                                aria-hidden
                                title="Bloque activo (primario)"
                              />
                            ) : null}
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight tracking-tight",
                                visible ? "text-[#111827]" : "text-[#9ca3af] line-through decoration-[#d1d5db]"
                              )}
                            >
                              {getBlockDisplayName(block)}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-[#9ca3af]">
                            {getBlockTypeLabelEs(block.type)}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={cn(layerActionBtnClass, "text-[#b0b8c4] hover:text-[#c27b3d]")}
                          title="Renombrar"
                          aria-label="Renombrar capa"
                          onClick={(e) => {
                            e.stopPropagation();
                            beginRename(block);
                          }}
                        >
                          <IconPencil className="block h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-px">
                    {editingId !== block.id ? (
                      <>
                        <button
                          type="button"
                          className={cn(layerActionBtnClass, "hover:text-[#2563eb]")}
                          title="Duplicar capa"
                          aria-label="Duplicar capa"
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch(duplicateBlock(block.id));
                          }}
                        >
                          <IconDuplicate className="block h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className={cn(
                            layerActionBtnClass,
                            "hover:text-[#c27b3d]",
                            copiedStyle && styleSourceId === block.id
                              ? "bg-[#c27b3d]/18 text-[#9a5f2e] ring-2 ring-[#c27b3d]/45"
                              : ""
                          )}
                          title={
                            copiedStyle && styleSourceId === block.id
                              ? "Cancelar copiar estilo"
                              : "Copiar estilo"
                          }
                          aria-label={
                            copiedStyle && styleSourceId === block.id
                              ? "Cancelar copiar estilo"
                              : "Copiar estilo"
                          }
                          disabled={extractBlockStyle(block) === null}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (copiedStyle && styleSourceId === block.id) {
                              clearCopiedBlockStyle();
                              return;
                            }
                            const st = extractBlockStyle(block);
                            if (st) setCopiedBlockStyle(st, block.id);
                          }}
                        >
                          <IconFormatPainter className="block h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className={cn(layerActionBtnClass, "hover:bg-red-50 hover:text-red-600")}
                          title="Eliminar capa"
                          aria-label="Eliminar capa"
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch(removeBlock(block.id));
                          }}
                        >
                          <IconTrash className="block h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className={cn(
                        layerActionBtnClass,
                        "text-[#6b7280]",
                        !visible && "bg-amber-50/80 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
                      )}
                      title={visible ? "Ocultar en el lienzo" : "Mostrar en el lienzo"}
                      aria-label={visible ? "Ocultar capa" : "Mostrar capa"}
                      aria-pressed={visible}
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = !visible;
                        dispatch(updateBlock(block.id, { layout: { visible: next } }));
                        if (!next && state.selectedBlockIds.includes(block.id)) {
                          dispatch(
                            setSelectedBlockIds(state.selectedBlockIds.filter((id) => id !== block.id))
                          );
                        }
                      }}
                    >
                      {visible ? (
                        <IconEye className="block h-3.5 w-3.5" />
                      ) : (
                        <IconEyeOff className="block h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      className={cn(
                        layerActionBtnClass,
                        "text-[#6b7280]",
                        locked && "bg-[#fffbeb] text-amber-900 hover:bg-amber-100"
                      )}
                      title={locked ? "Desbloquear edición" : "Bloquear edición"}
                      aria-label={locked ? "Desbloquear capa" : "Bloquear capa"}
                      aria-pressed={locked}
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch(updateBlock(block.id, { layout: { locked: !locked } }));
                      }}
                    >
                      {locked ? (
                        <IconLock className="block h-3.5 w-3.5" />
                      ) : (
                        <IconUnlock className="block h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div data-layer-opacity-row className="mt-2 flex min-w-0 items-center gap-2 pl-6">
                  <span className="shrink-0 text-[10px] font-medium text-[#64748b]">Opacidad</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[#2563eb]"
                    aria-label={`Opacidad de ${getBlockDisplayName(block)}`}
                    value={opacityPct}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      dispatch(updateBlock(block.id, { layout: { opacity: v / 100 } }));
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-[#64748b]" aria-hidden>
                    {opacityPct}%
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
