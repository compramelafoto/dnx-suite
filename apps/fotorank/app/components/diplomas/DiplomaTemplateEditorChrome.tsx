"use client";

import type { RefObject } from "react";
import {
  BookOpen,
  Copy,
  Eye,
  FileCheck,
  Loader2,
  Redo2,
  Save,
  Undo2,
  X,
} from "lucide-react";
import type { DiplomaVisualEditorHandle } from "./DiplomaVisualEditor";

type TemplateOption = { id: string; name: string; status: string };

type Props = {
  templateOptions: TemplateOption[];
  currentTemplateId: string;
  onSwitchTemplate: (templateId: string) => void;
  templateName: string;
  onTemplateNameChange: (name: string) => void;
  statusLabel: string;
  isDirty: boolean;
  pending: boolean;
  canUndo: boolean;
  canRedo: boolean;
  editorRef: RefObject<DiplomaVisualEditorHandle | null>;
  onOpenLibrary: () => void;
  onDuplicate: () => void;
  onSaveDraft: () => void;
  onSavePublish: () => void;
  onClose: () => void;
};

export function DiplomaTemplateEditorChrome({
  templateOptions,
  currentTemplateId,
  onSwitchTemplate,
  templateName,
  onTemplateNameChange,
  statusLabel,
  isDirty,
  pending,
  canUndo,
  canRedo,
  editorRef,
  onOpenLibrary,
  onDuplicate,
  onSaveDraft,
  onSavePublish,
  onClose,
}: Props) {
  return (
    <div className="shrink-0 border-b border-fr-border bg-gradient-to-b from-fr-bg-elevated to-fr-bg">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
          <label className="sr-only" htmlFor="diploma-template-select">
            Plantilla activa
          </label>
          <select
            id="diploma-template-select"
            className="max-w-[min(100%,220px)] rounded-lg border border-fr-border bg-fr-bg px-2.5 py-2 text-sm text-fr-primary"
            value={currentTemplateId}
            onChange={(e) => onSwitchTemplate(e.target.value)}
            disabled={pending}
          >
            {templateOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onOpenLibrary}
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-fr-border bg-fr-bg px-2.5 py-2 text-xs font-medium text-fr-muted transition hover:border-gold/45 hover:text-gold disabled:opacity-40"
          >
            <BookOpen className="size-3.5" strokeWidth={1.75} aria-hidden />
            Biblioteca
          </button>

          <input
            className="min-w-[140px] flex-1 rounded-lg border border-fr-border bg-fr-bg px-3 py-2 text-sm text-fr-primary outline-none placeholder:text-fr-muted focus:border-gold/50 sm:min-w-[200px]"
            value={templateName}
            onChange={(e) => onTemplateNameChange(e.target.value)}
            placeholder="Nombre de la plantilla"
            aria-label="Nombre de la plantilla"
            disabled={pending}
          />

          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              isDirty
                ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                : "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {isDirty ? "Cambios sin guardar" : "Guardado"}
          </span>
          <span className="hidden text-[10px] uppercase tracking-wide text-fr-muted sm:inline">{statusLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-fr-border bg-fr-bg text-fr-muted transition hover:border-gold/40 hover:text-gold disabled:opacity-40"
            title="Deshacer"
            aria-label="Deshacer"
            disabled={pending || !canUndo}
            onClick={() => editorRef.current?.undo()}
          >
            <Undo2 className="size-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-fr-border bg-fr-bg text-fr-muted transition hover:border-gold/40 hover:text-gold disabled:opacity-40"
            title="Rehacer"
            aria-label="Rehacer"
            disabled={pending || !canRedo}
            onClick={() => editorRef.current?.redo()}
          >
            <Redo2 className="size-4" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={onDuplicate}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-fr-border bg-fr-bg px-2.5 py-2 text-xs text-fr-muted transition hover:border-gold/40 hover:text-gold disabled:opacity-40"
            title="Duplicar plantilla"
          >
            <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />
            <span className="hidden sm:inline">Duplicar</span>
          </button>

          <button
            type="button"
            onClick={onSaveDraft}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-fr-border bg-fr-bg px-2.5 py-2 text-xs text-fr-muted transition hover:border-gold/40 hover:text-gold disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" strokeWidth={1.75} />}
            <span className="hidden sm:inline">Guardar</span>
          </button>

          <button
            type="button"
            onClick={onSavePublish}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gold/50 bg-gold/15 px-3 py-2 text-xs font-medium text-gold transition hover:bg-gold/25 disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <FileCheck className="size-3.5" strokeWidth={1.75} />}
            Publicar
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-fr-border text-fr-muted transition hover:border-red-500/40 hover:text-red-300"
            aria-label="Cerrar editor"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <p className="border-t border-fr-border/60 px-4 py-2 text-[11px] text-fr-muted">
        <Eye className="mr-1 inline size-3.5 align-text-bottom text-gold/80" aria-hidden />
        Vista previa con datos de ejemplo: activala en el lienzo con el botón «Vista previa».
      </p>
    </div>
  );
}
