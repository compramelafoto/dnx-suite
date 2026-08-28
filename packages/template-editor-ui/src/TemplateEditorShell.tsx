"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SVGProps,
} from "react";
import { useRouter } from "next/navigation";
import Card from "./primitives/Card";
import Button from "./primitives/Button";
import { TemplateEditorCanvas } from "./TemplateEditorCanvas";
import { TemplateEditorInspector } from "./TemplateEditorInspector";
import { TemplateEditorLayers } from "./TemplateEditorLayers";
import {
  TEMPLATE_V2_EDITOR_INITIAL_STATE,
  addBlock,
  addTemplatePage,
  removeTemplatePage,
  getTemplatePageDisplayLabels,
  reorderTemplatePages,
  setPageLabel,
  initializeEditor,
  setActivePageIndex,
  updateBlock,
  redo,
  selectCanRedo,
  selectCanUndo,
  selectSerializableSavePayload,
  selectBlock,
  selectSelectedBlock,
  setCanvas,
  templateV2EditorReducer,
  setVariableBindings,
  setZoom,
  undo,
  type InitializeEditorInput,
  type TemplateV2VariableBinding,
} from "@repo/template-editor-core";
import { useTemplateEditorHotkeys } from "./useTemplateEditorHotkeys";
import {
  TEMPLATE_V2_AUTOSAVE_DEBOUNCE_MS,
  useTemplateEditorAutosave,
} from "./useTemplateEditorAutosave";
import {
  createDefaultBackgroundBlock,
  createDefaultImageBlock,
  createDefaultSchoolLogoImageBlock,
  createDefaultShapeBlock,
  createDefaultQrBlock,
  createDefaultVariableTextBlock,
} from "@repo/template-editor-core";
import { asObject } from "@repo/template-editor-core";
import { requestTemplateVersionImageUpload } from "@repo/template-editor-core";
import { TemplateBlockContextToolbar } from "./TemplateBlockContextToolbar";
import { GoogleFontsLoader } from "./GoogleFontsLoader";
import { TemplateTextFormatToolbar } from "./TemplateTextFormatToolbar";
import { TemplateDiagnosticsPanel } from "./TemplateDiagnosticsPanel";
import { TemplateVersionList } from "./TemplateVersionList";
import type { TemplateEditorCanvasTool } from "@repo/template-editor-core";
import { cn } from "./primitives/cn";
import { CanvasSizeModal } from "./CanvasSizeModal";
import { TemplateEditorExitModal } from "./TemplateEditorExitModal";
import { getCopiedBlockStyleSnapshot, subscribeCopiedBlockStyle } from "@repo/template-editor-core";
import {
  isRevisionConflictResponse,
  TEMPLATE_V2_REVISION_CONFLICT_MESSAGE,
} from "@repo/template-editor-core";

const TEMPLATE_V2_EDITOR_LIST_PATH = "/fotografo/diseno/plantillas/v2";

const toolbarIconOnlyClass =
  "!h-9 !w-9 !min-h-9 !min-w-9 !shrink-0 !rounded-full !px-0 !py-0 !inline-flex !items-center !justify-center [&>svg]:pointer-events-none";

const sheetToolbarIconClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-[#475569] transition-colors disabled:pointer-events-none disabled:opacity-40 [&>svg]:pointer-events-none";

function IconToolbarUndo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path d="M3 7v6h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconToolbarPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconToolbarTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconToolbarRedo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path d="M21 7v6h-6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconToolbarCanvasSize(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9h4M16 9h4M9 4v4M9 16v4" strokeLinecap="round" />
    </svg>
  );
}

function IconToolbarSave(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path
        d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconToolbarNewVersion(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6M12 18v-6M9 15h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconToolbarPreview(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconToolbarPanel(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 3v18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconToolbarVersions(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="M22 17.65 12.97 21.8a2 2 0 0 1-1.94 0L2 17.65" />
      <path d="M22 12.65 12.97 16.8a2 2 0 0 1-1.94 0L2 12.65" />
    </svg>
  );
}

function IconToolbarShortcuts(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10h.01M10 10h.01M14 10h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconToolbarSafeZone(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" aria-hidden {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconToolbarAxes(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3v18M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconToolbarSpinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-[18px] w-[18px] animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function EditorToolButton({
  label,
  pressed,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed ?? false}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-transparent text-[#d1d5db] transition-colors",
        "hover:border-white/10 hover:bg-white/10 hover:text-white",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#c27b3d]",
        "disabled:pointer-events-none disabled:opacity-40",
        pressed ? "border-white/15 bg-white/10 text-white" : "text-[#9ca3af]",
        className
      )}
      {...props}
    />
  );
}

function RightSidebarSectionChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4 shrink-0 text-[#64748b] transition-transform duration-200", open ? "rotate-0" : "-rotate-90", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Encabezado + botón para plegar/desplegar; el panel lateral hace scroll único. */
function RightSidebarSection({
  sectionId,
  title,
  open,
  onToggle,
  children,
  variant = "muted",
}: {
  sectionId: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  variant?: "muted" | "white";
}) {
  return (
    <section
      className={cn(
        "border-b border-[#d8dee6]",
        variant === "muted" ? "bg-[#f7f8fa]" : "bg-white"
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <h3
          id={`${sectionId}-heading`}
          className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]"
        >
          {title}
        </h3>
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#64748b] transition-colors hover:bg-black/[0.04] hover:text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#c27b3d]"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${sectionId}-content`}
          title={open ? "Minimizar bloque" : "Desplegar bloque"}
        >
          <RightSidebarSectionChevron open={open} />
        </button>
      </div>
      {open ? (
        <div
          id={`${sectionId}-content`}
          role="region"
          aria-labelledby={`${sectionId}-heading`}
          className="px-3 pb-3 pt-0"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

type TemplateEditorShellProps = {
  templateId: string;
  versionId: string;
  className?: string;
};

type LoadResponse = {
  ok: boolean;
  template?: { id: string; name: string; status: string };
  revision?: number;
  canvas?: InitializeEditorInput["canvas"];
  blocks?: InitializeEditorInput["blocks"];
  variableBindings?: InitializeEditorInput["variableBindings"];
  meta?: Record<string, unknown>;
  updatedAt?: string;
  versionNumber?: number;
  error?: string;
  code?: string;
  details?: string;
};

export function TemplateEditorShell({ templateId, versionId, className }: TemplateEditorShellProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(templateV2EditorReducer, TEMPLATE_V2_EDITOR_INITIAL_STATE);
  const [templateName, setTemplateName] = useState<string>("Plantilla");
  const [versionNumber, setVersionNumber] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  /** Tras 409: bloquear nuevos saves hasta recargar (evita sobrescribir con revisión sincronizada). */
  const [revisionConflictLocked, setRevisionConflictLocked] = useState(false);
  const [saveAsNewError, setSaveAsNewError] = useState<string | null>(null);
  const [savingAsNew, setSavingAsNew] = useState(false);
  const [versionsPanelOpen, setVersionsPanelOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [showCenterAxes, setShowCenterAxes] = useState(true);
  const [canvasSizeModalOpen, setCanvasSizeModalOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  /** Capas + inspector a la derecha: oculto por defecto para ganar espacio en el lienzo. */
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [backgroundUploadError, setBackgroundUploadError] = useState<string | null>(null);
  const backgroundFileRef = useRef<HTMLInputElement>(null);
  /** Para abrir el panel lateral al seleccionar un bloque si antes no había selección. */
  const hadBlockSelectionRef = useRef(false);
  /** Renombrar hoja (doble clic); Escape evita guardar en blur. */
  const skipPageLabelBlurCommitRef = useRef(false);
  /** Herramienta del lienzo: T texto, V selección, H mano (atajos alineados con Photoshop). */
  const [canvasTool, setCanvasTool] = useState<TemplateEditorCanvasTool>("select");
  /** Panel derecho: bloques apilados con un solo scroll; cada sección se puede plegar. */
  const [rightPanelLayersOpen, setRightPanelLayersOpen] = useState(true);
  const [rightPanelInspectorOpen, setRightPanelInspectorOpen] = useState(true);
  const [rightPanelReviewOpen, setRightPanelReviewOpen] = useState(false);
  const [pageLabelEdit, setPageLabelEdit] = useState<{ index: number; value: string } | null>(null);
  const [sheetDragFrom, setSheetDragFrom] = useState<number | null>(null);
  const [sheetDragOver, setSheetDragOver] = useState<number | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const cancelAutosaveRef = useRef<() => void>(() => {});
  const conflictBannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (saveErrorMessage === TEMPLATE_V2_REVISION_CONFLICT_MESSAGE) {
      conflictBannerRef.current?.focus();
    }
  }, [saveErrorMessage]);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "setLoadStatus", payload: { loadStatus: "loading" } });
    setLoadError(null);
    setSaveAsNewError(null);

    fetch(`/api/template-v2/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/save`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as LoadResponse;
        if (!r.ok || !data.ok) {
          const messageParts = [
            data.error || "No se pudo cargar la versión.",
            `status=${r.status}`,
            data.code ? `code=${data.code}` : null,
            data.details ? `details=${data.details}` : null,
          ].filter(Boolean);
          throw new Error(messageParts.join(" · "));
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        try {
          setTemplateName(data.template?.name || "Plantilla");
          setVersionNumber(typeof data.versionNumber === "number" ? data.versionNumber : 1);
          dispatch(
            initializeEditor({
              templateId,
              versionId,
              revision: Number(data.revision ?? 0),
              canvas: data.canvas ?? { width: 1200, height: 1800, background: "#ffffff" },
              blocks: data.blocks ?? [],
              variableBindings: data.variableBindings ?? [],
              lastSavedAt: data.updatedAt ?? null,
              meta: data.meta && typeof data.meta === "object" && !Array.isArray(data.meta) ? data.meta : {},
            })
          );
        } catch (err) {
          setLoadError(err instanceof Error ? err.message : "Error inicializando editor.");
          dispatch({ type: "setLoadStatus", payload: { loadStatus: "error" } });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Error cargando editor.");
        dispatch({ type: "setLoadStatus", payload: { loadStatus: "error" } });
      });

    return () => {
      cancelled = true;
    };
  }, [templateId, versionId]);

  const selectedBlock = useMemo(() => selectSelectedBlock(state), [state]);

  const pageDisplayLabels = useMemo(
    () => getTemplatePageDisplayLabels(state),
    [state.templatePageCount, state.versionMeta]
  );

  const styleClipboardSnap = useSyncExternalStore(
    subscribeCopiedBlockStyle,
    getCopiedBlockStyleSnapshot,
    getCopiedBlockStyleSnapshot
  );
  const hasCopiedBlockStyle = styleClipboardSnap.data !== null;
  const saveBadge =
    state.saveStatus === "saving"
      ? "Guardando..."
      : state.saveStatus === "error"
        ? "Error al guardar"
        : state.isDirty
          ? "Cambios sin guardar"
          : state.lastSavedAt
            ? "Guardado"
            : "Sin cambios";

  function handleAddText() {
    setCanvasTool((t) => (t === "text" ? "select" : "text"));
  }
  function handleAddVariable() {
    setCanvasTool("select");
    const ap = state.activePageIndex ?? 0;
    const onPage = state.blocks.filter((b) => (b.pageIndex ?? 0) === ap);
    dispatch(addBlock(createDefaultVariableTextBlock(state.canvas, onPage, ap)));
  }
  function handleAddShape() {
    setCanvasTool("select");
    const ap = state.activePageIndex ?? 0;
    const onPage = state.blocks.filter((b) => (b.pageIndex ?? 0) === ap);
    dispatch(addBlock(createDefaultShapeBlock(state.canvas, onPage, ap)));
  }
  function handleAddQr() {
    setCanvasTool("select");
    const ap = state.activePageIndex ?? 0;
    const onPage = state.blocks.filter((b) => (b.pageIndex ?? 0) === ap);
    dispatch(addBlock(createDefaultQrBlock(state.canvas, onPage, ap)));
  }
  function handleAddImage() {
    setCanvasTool("select");
    const ap = state.activePageIndex ?? 0;
    const onPage = state.blocks.filter((b) => (b.pageIndex ?? 0) === ap);
    dispatch(addBlock(createDefaultImageBlock(state.canvas, onPage, ap)));
  }

  function handleAddSchoolLogoImage() {
    setCanvasTool("select");
    const s = stateRef.current;
    const ap = s.activePageIndex ?? 0;
    const onPage = s.blocks.filter((b) => (b.pageIndex ?? 0) === ap);
    const block = createDefaultSchoolLogoImageBlock(s.canvas, onPage, ap);
    const binding: TemplateV2VariableBinding = {
      blockId: block.id,
      variableKey: "branding.schoolLogoUrl",
      targetPath: "src",
    };
    const nextBindings: TemplateV2VariableBinding[] = [
      ...s.variableBindings.filter((vb) => vb.blockId !== block.id),
      binding,
    ];
    dispatch(addBlock(block));
    dispatch(setVariableBindings(nextBindings));
  }

  async function handleBackgroundFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || state.loadStatus !== "ready") return;
    setBackgroundUploadError(null);
    setBackgroundUploading(true);
    try {
      const url = await requestTemplateVersionImageUpload(templateId, versionId, file);
      const ap = state.activePageIndex ?? 0;
      const existing = state.blocks.find((b) => b.type === "BACKGROUND" && (b.pageIndex ?? 0) === ap);
      if (existing) {
        const cfg = asObject(existing.configJson);
        dispatch(
          updateBlock(existing.id, {
            configJson: { ...cfg, src: url, fit: "cover" },
          })
        );
        dispatch(selectBlock(existing.id));
      } else {
        const block = createDefaultBackgroundBlock(state.canvas, ap);
        dispatch(
          addBlock({
            ...block,
            configJson: { ...asObject(block.configJson), src: url, fit: "cover" },
          })
        );
      }
    } catch (err) {
      setBackgroundUploadError(err instanceof Error ? err.message : "No se pudo subir el fondo");
    } finally {
      setBackgroundUploading(false);
    }
  }

  async function handlePreview() {
    if (state.loadStatus !== "ready") return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewSrc((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    try {
      const res = await fetch("/api/template-v2/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "image/png",
        },
        credentials: "include",
        body: JSON.stringify({
          templateId,
          versionId,
          mockData: {},
          previewPageIndex: state.activePageIndex ?? 0,
          draft: {
            canvas: state.canvas,
            blocks: state.blocks,
            variableBindings: state.variableBindings,
            meta: state.versionMeta ?? {},
          },
          output: { format: "png" },
        }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "No se pudo generar la vista previa."
        );
      }
      if (contentType.includes("application/json")) {
        const data = (await res.json()) as {
          ok?: boolean;
          imageBase64?: string;
          mimeType?: string;
        };
        if (data.ok !== true || typeof data.imageBase64 !== "string") {
          throw new Error("Respuesta de preview inválida.");
        }
        const mime =
          typeof data.mimeType === "string" && data.mimeType
            ? data.mimeType
            : "image/png";
        const bin = Uint8Array.from(atob(data.imageBase64), (c) => c.charCodeAt(0));
        setPreviewSrc(URL.createObjectURL(new Blob([bin], { type: mime })));
      } else if (contentType.includes("image/png")) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength < 8) {
          throw new Error("Preview vacío.");
        }
        setPreviewSrc(
          URL.createObjectURL(new Blob([buf], { type: "image/png" }))
        );
      } else {
        throw new Error("Respuesta de preview inválida (se esperaba PNG).");
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Error al generar la vista previa.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewSrc((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setPreviewOpen(false);
    setPreviewError(null);
    setPreviewLoading(false);
  }

  const navigateToTemplateList = useCallback(() => {
    router.push(TEMPLATE_V2_EDITOR_LIST_PATH);
  }, [router]);

  const handleRequestCloseEditor = useCallback(() => {
    if (loadError) {
      navigateToTemplateList();
      return;
    }
    if (!state.isDirty) {
      navigateToTemplateList();
      return;
    }
    setExitConfirmOpen(true);
  }, [loadError, state.isDirty, navigateToTemplateList]);

  const handleExitModalCancel = useCallback(() => setExitConfirmOpen(false), []);

  const handleExitWithoutSave = useCallback(() => {
    setExitConfirmOpen(false);
    navigateToTemplateList();
  }, [navigateToTemplateList]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    cancelAutosaveRef.current();
    const s0 = stateRef.current;
    if (revisionConflictLocked) return false;
    if (s0.isSaving || !s0.isDirty) return true;
    setSaveErrorMessage(null);
    dispatch({ type: "setSaving", payload: { isSaving: true } });
    dispatch({ type: "setSaveStatus", payload: { saveStatus: "saving" } });

    type SaveJson = {
      ok?: boolean;
      error?: string;
      revision?: number;
      currentRevision?: number;
      updatedAt?: string;
    };

    try {
      const s = stateRef.current;
      const payload = selectSerializableSavePayload(s);
      const res = await fetch(
        `/api/template-v2/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/save`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );
      const data = (await res.json().catch(() => ({}))) as SaveJson;

      // No reintentar ni sincronizar revision para reintentar: sobrescribiría cambios ajenos.
      if (isRevisionConflictResponse(res.status, data?.error)) {
        setRevisionConflictLocked(true);
        setSaveErrorMessage(TEMPLATE_V2_REVISION_CONFLICT_MESSAGE);
        dispatch({ type: "setSaving", payload: { isSaving: false } });
        dispatch({ type: "setSaveStatus", payload: { saveStatus: "error" } });
        return false;
      }

      if (!res.ok || data?.ok !== true) {
        const raw = typeof data?.error === "string" ? data.error : "No se pudo guardar";
        const msg =
          raw === "template_publicado_bloqueado"
            ? "Esta plantilla está publicada y aprobada en el catálogo: no se pueden guardar cambios sobre esta versión. Duplicá la plantilla o usá una copia propia para editar."
            : raw;
        throw new Error(msg);
      }

      dispatch({
        type: "markSaved",
        payload: {
          at: typeof data?.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
          revision: typeof data?.revision === "number" ? data.revision : s.revision + 1,
        },
      });
      dispatch({ type: "setSaveStatus", payload: { saveStatus: "saved" } });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al guardar";
      setSaveErrorMessage(message);
      dispatch({ type: "setSaving", payload: { isSaving: false } });
      dispatch({ type: "setSaveStatus", payload: { saveStatus: "error" } });
      return false;
    }
  }, [templateId, versionId, dispatch, revisionConflictLocked]);

  const handleSaveAndExit = useCallback(async () => {
    const ok = await handleSave();
    if (ok) {
      setExitConfirmOpen(false);
      navigateToTemplateList();
    }
  }, [handleSave, navigateToTemplateList]);

  const handleSaveAsNewVersion = useCallback(async () => {
    if (state.loadStatus !== "ready" || savingAsNew || state.isSaving) return;
    cancelAutosaveRef.current();
    setSaveAsNewError(null);
    setSavingAsNew(true);
    try {
      const s0 = stateRef.current;
      if (s0.isDirty) {
        const ok = await handleSave();
        if (!ok) {
          setSaveAsNewError("No se pudo guardar los cambios pendientes. Revisá el error de guardado e intentá de nuevo.");
          return;
        }
      }
      const s = stateRef.current;
      const body = {
        ...selectSerializableSavePayload(s),
        branchFromVersionId: versionId,
      };
      const res = await fetch(`/api/template-v2/templates/${encodeURIComponent(templateId)}/save-as-new-version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        versionId?: string;
      };
      if (!res.ok || data?.ok !== true) {
        const msg = typeof data?.error === "string" ? data.error : "No se pudo crear la nueva versión";
        if (msg === "template_publicado_bloqueado") {
          throw new Error("No se puede crear una versión: el template está publicado.");
        }
        throw new Error(msg);
      }
      const newVid = typeof data.versionId === "string" ? data.versionId : "";
      if (!newVid) {
        throw new Error("Respuesta inválida del servidor");
      }
      router.push(
        `/fotografo/diseno/plantillas/v2/${encodeURIComponent(templateId)}/${encodeURIComponent(newVid)}`
      );
    } catch (err) {
      setSaveAsNewError(err instanceof Error ? err.message : "Error al crear la nueva versión");
    } finally {
      setSavingAsNew(false);
    }
  }, [state.loadStatus, savingAsNew, state.isSaving, handleSave, templateId, versionId, router]);

  const runSaveForAutosave = useCallback(async () => {
    await handleSave();
  }, [handleSave]);

  const { cancelPendingAutosave } = useTemplateEditorAutosave({
    debounceMs: TEMPLATE_V2_AUTOSAVE_DEBOUNCE_MS,
    state,
    loadReady: state.loadStatus === "ready",
    templateId,
    versionId,
    performSave: runSaveForAutosave,
  });

  cancelAutosaveRef.current = cancelPendingAutosave;

  const runSaveForHotkey = useCallback(async () => {
    await handleSave();
  }, [handleSave]);

  useTemplateEditorHotkeys({
    enabled: state.loadStatus === "ready",
    state,
    dispatch,
    previewOpen,
    onClosePreview: closePreview,
    onSave: runSaveForHotkey,
    onOpenPreview: handlePreview,
    onCanvasToolChange: setCanvasTool,
  });

  const editorReady = state.loadStatus === "ready";

  /** Si el panel lateral (Capas + Propiedades) estaba cerrado, abrirlo al cambiar selección ↔ lienzo vacío (bloques o fondo). */
  useEffect(() => {
    if (!editorReady) return;
    const hasSelection = state.selectedBlockIds.length > 0;
    const hadSelection = hadBlockSelectionRef.current;
    hadBlockSelectionRef.current = hasSelection;
    if ((!hadSelection && hasSelection) || (hadSelection && !hasSelection)) {
      setRightPanelOpen(true);
    }
  }, [editorReady, state.selectedBlockIds.join("|")]);

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col", className)}
      data-testid="template-v2-editor"
    >
      <div className="flex min-h-0 w-full flex-1 flex-col bg-[#dfe3e8]">
        <header className="sticky top-0 z-30 shrink-0 border-b border-[#b8c2cf] bg-[#eceff4] shadow-[0_1px_0_rgba(0,0,0,0.06)]">
          <div className="flex justify-end border-b border-[#d8dee6] bg-[#e8ebf0]/95 px-3 py-1.5 md:px-4">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="inline-flex items-center gap-1.5 !px-2.5 !py-1 !text-xs font-medium"
              onClick={() => void handleRequestCloseEditor()}
              aria-label="Cerrar editor"
              title="Volver al listado de plantillas"
            >
              <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cerrar
            </Button>
          </div>
          {!loadError ? (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 md:px-4">
              <div className="min-w-0 flex-1 basis-[12rem]">
                <h1
                  className="truncate text-sm font-semibold text-[#111827] md:text-base"
                  title={`${templateName}\nTemplate ID: ${templateId}\nVersión ID: ${versionId}`}
                >
                  {templateName}
                </h1>
                <p className="mt-0.5 text-[11px] text-[#6b7280]">
                  {versionNumber != null ? (
                    <>
                      v{versionNumber}
                      {state.lastSavedAt ? (
                        <>
                          {" "}
                          ·{" "}
                          {(() => {
                            try {
                              return new Date(state.lastSavedAt).toLocaleString();
                            } catch {
                              return state.lastSavedAt;
                            }
                          })()}
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-[#9ca3af]">Cargando versión…</span>
                  )}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex rounded border border-[#d8dee6] bg-white px-2 py-0.5 text-[10px] font-medium text-[#374151]"
                    data-testid="template-v2-save-status"
                  >
                    {saveBadge}
                  </span>
                  {editorReady ? (
                    <span
                      className="text-[10px] text-[#9ca3af]"
                      title={`Guardado automático ${TEMPLATE_V2_AUTOSAVE_DEBOUNCE_MS / 1000}s tras dejar de editar`}
                    >
                      Autosave
                    </span>
                  ) : null}
                </div>
              </div>

              <span className="hidden h-8 w-px shrink-0 bg-[#c5ccd6] md:inline" aria-hidden />

              <div className="flex flex-wrap items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  className={toolbarIconOnlyClass}
                  onClick={() => dispatch(undo())}
                  disabled={!editorReady || !selectCanUndo(state)}
                  title="Deshacer el último cambio (⌘/Ctrl+Z)"
                  aria-label="Deshacer"
                >
                  <IconToolbarUndo />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  className={toolbarIconOnlyClass}
                  onClick={() => dispatch(redo())}
                  disabled={!editorReady || !selectCanRedo(state)}
                  title="Rehacer (⌘/Ctrl+Mayús+Z o Ctrl+Y)"
                  aria-label="Rehacer"
                >
                  <IconToolbarRedo />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  className={toolbarIconOnlyClass}
                  onClick={() => setCanvasSizeModalOpen(true)}
                  disabled={!editorReady}
                  title="Tamaño del lienzo: ancho, alto y márgenes de zona segura"
                  aria-label="Tamaño del lienzo"
                >
                  <IconToolbarCanvasSize />
                </Button>
                <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-[#c5ccd6] sm:inline" aria-hidden />
                <Button
                  size="sm"
                  variant="primary"
                  className={cn(toolbarIconOnlyClass, "shadow-sm")}
                  onClick={() => void handleSave()}
                  disabled={
                    state.isSaving ||
                    savingAsNew ||
                    !state.isDirty ||
                    revisionConflictLocked
                  }
                  data-testid="template-v2-save-button"
                  title={
                    state.isSaving
                      ? "Guardando cambios en el servidor…"
                      : !state.isDirty
                        ? "No hay cambios sin guardar"
                        : "Guardar cambios en esta versión (⌘/Ctrl+S)"
                  }
                  aria-label={state.isSaving ? "Guardando" : "Guardar"}
                >
                  {state.isSaving ? <IconToolbarSpinner /> : <IconToolbarSave />}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  className={toolbarIconOnlyClass}
                  onClick={() => void handleSaveAsNewVersion()}
                  disabled={!editorReady || state.isSaving || savingAsNew}
                  title="Crear una nueva versión del template con el estado actual del editor"
                  aria-label="Nueva versión"
                >
                  {savingAsNew ? <IconToolbarSpinner /> : <IconToolbarNewVersion />}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  className={toolbarIconOnlyClass}
                  data-testid="template-v2-preview-button"
                  onClick={handlePreview}
                  disabled={!editorReady || previewLoading}
                  title="Vista previa en imagen del lienzo actual (incluye cambios sin guardar)"
                  aria-label="Vista previa"
                >
                  {previewLoading ? <IconToolbarSpinner /> : <IconToolbarPreview />}
                </Button>
              </div>

              <span className="hidden h-8 w-px shrink-0 bg-[#c5ccd6] lg:inline" aria-hidden />

              <div className="flex flex-wrap items-center justify-end gap-1.5 lg:ml-auto">
                {editorReady && hasCopiedBlockStyle ? (
                  <span
                    className="hidden max-w-[min(100%,14rem)] truncate rounded border border-[#c27b3d]/40 bg-[#fdf6ef] px-2 py-0.5 text-[10px] font-medium text-[#8b5a2b] sm:inline"
                    title="Hay un estilo copiado. Elegí una capa compatible en la lista de capas (panel derecho) para aplicarlo."
                    role="status"
                  >
                    Estilo copiado — aplicá en capas
                  </span>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  aria-expanded={rightPanelOpen}
                  className={cn(
                    toolbarIconOnlyClass,
                    "font-medium",
                    rightPanelOpen ? "ring-2 ring-[#c27b3d]/35" : "",
                    hasCopiedBlockStyle ? "ring-1 ring-[#c27b3d]/30" : ""
                  )}
                  onClick={() => setRightPanelOpen((open) => !open)}
                  disabled={!editorReady}
                  title={
                    hasCopiedBlockStyle
                      ? "Panel lateral: capas, propiedades y diagnóstico. Hay un estilo copiado listo para pegar en una capa compatible."
                      : "Abrir u ocultar el panel lateral: capas, propiedades del bloque y revisión rápida"
                  }
                  aria-label="Panel lateral"
                >
                  <IconToolbarPanel />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  aria-expanded={versionsPanelOpen}
                  className={cn(toolbarIconOnlyClass, "font-medium", versionsPanelOpen ? "ring-2 ring-[#c27b3d]/35" : "")}
                  onClick={() => setVersionsPanelOpen((open) => !open)}
                  disabled={!editorReady}
                  title="Listado de versiones de esta plantilla y cambio entre ellas"
                  aria-label="Versiones del template"
                >
                  <IconToolbarVersions />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  aria-expanded={shortcutsHelpOpen}
                  className={cn(toolbarIconOnlyClass, "font-medium", shortcutsHelpOpen ? "ring-2 ring-[#c27b3d]/35" : "")}
                  onClick={() => setShortcutsHelpOpen((open) => !open)}
                  disabled={!editorReady}
                  title="Ver atajos de teclado del editor (guardar, deshacer, vista previa, etc.)"
                  aria-label="Atajos de teclado"
                >
                  <IconToolbarShortcuts />
                </Button>
                <label
                  className={cn(
                    "inline-flex cursor-pointer items-center justify-center rounded-full border border-transparent p-1 text-[#4b5563] transition-colors hover:bg-[#e8ebf0]",
                    !editorReady && "pointer-events-none opacity-40"
                  )}
                  title="Mostrar u ocultar la guía de márgenes seguros en el lienzo (solo referencia; no se imprime tal cual en la vista previa)"
                >
                  <input
                    type="checkbox"
                    className="peer sr-only accent-[#c27b3d]"
                    checked={showSafeArea}
                    onChange={(e) => setShowSafeArea(e.target.checked)}
                    disabled={!editorReady}
                    aria-label="Zona segura"
                  />
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e7eb] bg-white shadow-sm peer-checked:border-[#c27b3d]/50 peer-checked:bg-[#fffaf6] peer-checked:text-[#9a5f2e]">
                    <IconToolbarSafeZone />
                  </span>
                </label>
                <label
                  className={cn(
                    "inline-flex cursor-pointer items-center justify-center rounded-full border border-transparent p-1 text-[#4b5563] transition-colors hover:bg-[#e8ebf0]",
                    !editorReady && "pointer-events-none opacity-40"
                  )}
                  title="Mostrar u ocultar los ejes vertical y horizontal del centro del lienzo (solo guía visual)"
                >
                  <input
                    type="checkbox"
                    className="peer sr-only accent-[#c27b3d]"
                    checked={showCenterAxes}
                    onChange={(e) => setShowCenterAxes(e.target.checked)}
                    disabled={!editorReady}
                    aria-label="Ejes del centro"
                  />
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e7eb] bg-white shadow-sm peer-checked:border-[#c27b3d]/50 peer-checked:bg-[#fffaf6] peer-checked:text-[#9a5f2e]">
                    <IconToolbarAxes />
                  </span>
                </label>
              </div>
            </div>

            {editorReady ? (
              <div
                className="flex flex-wrap items-center gap-1.5 border-t border-[#d8dee6] bg-[#eef1f5] px-3 py-2 md:px-4"
                onDragOver={(e) => {
                  if (sheetDragFrom == null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
              >
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">
                  Hojas
                </span>
                {Array.from({ length: state.templatePageCount }, (_, i) => {
                  const active = (state.activePageIndex ?? 0) === i;
                  const labelText = pageDisplayLabels[i] ?? `Hoja ${i + 1}`;
                  if (pageLabelEdit?.index === i) {
                    return (
                      <input
                        key={i}
                        type="text"
                        draggable={false}
                        autoFocus
                        className={cn(
                          "min-w-[4.5rem] max-w-[160px] rounded-md border px-2 py-1 text-[11px] font-medium text-[#111827] shadow-sm outline-none focus:ring-2 focus:ring-[#c27b3d]/35",
                          active
                            ? "border-[#c27b3d] bg-white"
                            : "border-[#94a3b8] bg-white"
                        )}
                        value={pageLabelEdit.value}
                        onChange={(e) => setPageLabelEdit({ index: i, value: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        maxLength={80}
                        aria-label={`Nombre de la hoja (exportación)`}
                        title="Enter: guardar · Escape: cancelar"
                        onBlur={() => {
                          if (skipPageLabelBlurCommitRef.current) {
                            skipPageLabelBlurCommitRef.current = false;
                            setPageLabelEdit(null);
                            return;
                          }
                          dispatch(setPageLabel(i, pageLabelEdit.value));
                          setPageLabelEdit(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            skipPageLabelBlurCommitRef.current = true;
                            setPageLabelEdit(null);
                          }
                        }}
                      />
                    );
                  }
                  const canReorder = state.templatePageCount > 1 && pageLabelEdit === null;
                  return (
                    <button
                      key={i}
                      type="button"
                      draggable={canReorder}
                      className={cn(
                        "max-w-[160px] truncate rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                        active
                          ? "border-[#c27b3d] bg-white text-[#8b4513] shadow-sm"
                          : "border-transparent bg-white/60 text-[#475569] hover:bg-white hover:text-[#111827]",
                        canReorder && "cursor-grab active:cursor-grabbing",
                        sheetDragFrom === i && "opacity-60",
                        sheetDragOver === i && sheetDragFrom !== i && "ring-2 ring-[#2563eb]/50 ring-offset-1"
                      )}
                      onClick={() => dispatch(setActivePageIndex(i))}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dispatch(setActivePageIndex(i));
                        setPageLabelEdit({ index: i, value: labelText });
                      }}
                      onDragStart={(e) => {
                        if (!canReorder) return;
                        setPageLabelEdit(null);
                        e.dataTransfer.setData("text/plain", String(i));
                        e.dataTransfer.effectAllowed = "move";
                        setSheetDragFrom(i);
                        setSheetDragOver(null);
                      }}
                      onDragEnd={() => {
                        setSheetDragFrom(null);
                        setSheetDragOver(null);
                      }}
                      onDragOver={(e) => {
                        if (sheetDragFrom == null) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setSheetDragOver(i);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const raw = e.dataTransfer.getData("text/plain");
                        const from = parseInt(raw, 10);
                        if (!Number.isFinite(from) || from < 0 || from >= state.templatePageCount) return;
                        if (from === i) return;
                        dispatch(reorderTemplatePages(from, i));
                        setSheetDragFrom(null);
                        setSheetDragOver(null);
                      }}
                      title={
                        canReorder
                          ? "Clic: cambiar de hoja · doble clic: renombrar · arrastrá para reordenar"
                          : "Clic: cambiar de hoja · doble clic: renombrar (se usa al exportar)"
                      }
                      aria-current={active ? "page" : undefined}
                      aria-label={`${labelText}. Doble clic para renombrar.`}
                    >
                      {labelText}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={cn(
                    sheetToolbarIconClass,
                    "border-dashed border-[#94a3b8] bg-white/50 hover:border-[#c27b3d] hover:bg-[#fff8f3] hover:text-[#8b4513]"
                  )}
                  onClick={() => dispatch(addTemplatePage())}
                  title="Añadir una hoja vacía (carpetas escolares, tapa/contraportada, etc.)"
                  aria-label="Añadir hoja"
                >
                  <IconToolbarPlus />
                </button>
                <button
                  type="button"
                  className={cn(
                    sheetToolbarIconClass,
                    "border-[#e5e7eb] bg-white/60 hover:border-[#fca5a5]/80 hover:bg-[#fff1f2] hover:text-[#b91c1c]"
                  )}
                  onClick={() => dispatch(removeTemplatePage())}
                  disabled={state.templatePageCount <= 1}
                  title={
                    state.templatePageCount <= 1
                      ? "Debe quedar al menos una hoja"
                      : "Eliminar la hoja activa y su contenido"
                  }
                  aria-label="Eliminar hoja"
                >
                  <IconToolbarTrash />
                </button>
              </div>
            ) : null}

            {editorReady ? <GoogleFontsLoader /> : null}
            {editorReady && state.selectedBlockIds.length > 0 ? (
              selectedBlock?.type === "TEXT" || selectedBlock?.type === "VARIABLE_TEXT" ? (
                <TemplateTextFormatToolbar state={state} dispatch={dispatch} />
              ) : (
                <TemplateBlockContextToolbar
                  state={state}
                  dispatch={dispatch}
                  templateId={templateId}
                  versionId={versionId}
                />
              )
            ) : null}

            {saveErrorMessage ? (
              <div
                ref={conflictBannerRef}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-[#fecaca] bg-red-50/90 px-3 py-1.5"
                data-testid="template-v2-error-banner"
                role="alert"
                tabIndex={-1}
              >
                <p className="text-xs text-red-700">{saveErrorMessage}</p>
                {saveErrorMessage === TEMPLATE_V2_REVISION_CONFLICT_MESSAGE ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="!px-2.5 !py-1 !text-xs"
                    onClick={() => window.location.reload()}
                    data-testid="template-v2-conflict-reload"
                  >
                    Recargar versión reciente
                  </Button>
                ) : null}
              </div>
            ) : null}
            {backgroundUploadError ? (
              <p className="border-t border-[#fecaca] bg-red-50/90 px-3 py-1.5 text-xs text-red-700">{backgroundUploadError}</p>
            ) : null}
            {saveAsNewError ? <p className="border-t border-[#fecaca] bg-red-50/90 px-3 py-1.5 text-xs text-red-700">{saveAsNewError}</p> : null}
            </>
          ) : null}
        </header>

        {shortcutsHelpOpen ? (
          <Card className="mx-3 mb-3 mt-0 border border-[#e5e7eb] bg-[#fafafa] p-4 md:p-5">
            <h2 className="text-sm font-semibold text-[#111827]">Atajos de teclado</h2>
            <p className="mt-1 text-[11px] text-[#6b7280]">
              En el lienzo (sin foco en un campo de texto). El guardado automático corre cada{" "}
              {TEMPLATE_V2_AUTOSAVE_DEBOUNCE_MS / 1000}s tras dejar de editar.
            </p>
            <ul className="mt-3 max-h-[min(50vh,420px)] space-y-2.5 overflow-y-auto text-xs text-[#374151]">
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e5e7eb]/80 pb-2">
                <span className="text-[#6b7280]">Guardar</span>
                <kbd className="shrink-0 rounded border border-[#d1d5db] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111827] shadow-sm">
                  ⌘/Ctrl + S
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e5e7eb]/80 pb-2">
                <span className="text-[#6b7280]">Herramienta texto / selección / mano</span>
                <kbd className="shrink-0 rounded border border-[#d1d5db] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111827] shadow-sm">
                  T · V · H
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e5e7eb]/80 pb-2">
                <span className="text-[#6b7280]">Mover vista del lienzo (arrastrar el área gris)</span>
                <kbd className="shrink-0 rounded border border-[#d1d5db] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111827] shadow-sm">
                  Barra espaciadora + arrastrar
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e5e7eb]/80 pb-2">
                <span className="text-[#6b7280]">Duplicar bloque (selección primaria)</span>
                <kbd className="shrink-0 rounded border border-[#d1d5db] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111827] shadow-sm">
                  ⌘/Ctrl + D
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e5e7eb]/80 pb-2">
                <span className="text-[#6b7280]">Eliminar selección</span>
                <kbd className="shrink-0 rounded border border-[#d1d5db] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111827] shadow-sm">
                  Supr / Retroceso
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e5e7eb]/80 pb-2">
                <span className="text-[#6b7280]">Mover bloque · paso fino / grueso</span>
                <kbd className="shrink-0 rounded border border-[#d1d5db] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111827] shadow-sm">
                  Flechas · Mayús + Flechas
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e5e7eb]/80 pb-2">
                <span className="text-[#6b7280]">Deshacer</span>
                <kbd className="shrink-0 rounded border border-[#d1d5db] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111827] shadow-sm">
                  ⌘/Ctrl + Z
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e5e7eb]/80 pb-2">
                <span className="text-[#6b7280]">Rehacer</span>
                <kbd className="shrink-0 rounded border border-[#d1d5db] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111827] shadow-sm">
                  ⌘/Ctrl + Mayús + Z · Ctrl + Y
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e5e7eb]/80 pb-2">
                <span className="text-[#6b7280]">Copiar / pegar bloque (primario)</span>
                <kbd className="shrink-0 rounded border border-[#d1d5db] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111827] shadow-sm">
                  ⌘/Ctrl + C · ⌘/Ctrl + V
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e5e7eb]/80 pb-2">
                <span className="text-[#6b7280]">Vista previa</span>
                <kbd className="shrink-0 rounded border border-[#d1d5db] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111827] shadow-sm">
                  ⌘/Ctrl + Mayús + P
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e5e7eb]/80 pb-2">
                <span className="text-[#6b7280]">Quitar selección · cerrar preview</span>
                <kbd className="shrink-0 rounded border border-[#d1d5db] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111827] shadow-sm">
                  Escape
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e5e7eb]/80 pb-2">
                <span className="text-[#6b7280]">Zoom · vista 100% y centrar</span>
                <kbd className="shrink-0 rounded border border-[#d1d5db] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111827] shadow-sm">
                  ⌘/Ctrl + ± · ⌘/Ctrl + 0
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#e5e7eb]/80 pb-2">
                <span className="text-[#6b7280]">Duplicar y arrastrar copia (el original no se mueve)</span>
                <kbd className="shrink-0 rounded border border-[#d1d5db] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111827] shadow-sm">
                  Alt + arrastrar
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[#6b7280]">Capa adelante / atrás (primario)</span>
                <kbd className="shrink-0 rounded border border-[#d1d5db] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111827] shadow-sm">
                  ⌘/Ctrl + ] · ⌘/Ctrl + [
                </kbd>
              </li>
            </ul>
          </Card>
        ) : null}

        {versionsPanelOpen ? (
          <div className="border-b border-[#cfd6df] bg-[#eef1f5] px-3 py-2">
            <TemplateVersionList templateId={templateId} activeVersionId={versionId} />
          </div>
        ) : null}

        {loadError ? (
          <Card className="m-4 p-6">
            <p className="text-sm text-red-600">Error al cargar versión de plantilla.</p>
            <p className="mt-2 break-all text-xs text-[#6b7280]">{loadError}</p>
          </Card>
        ) : !editorReady ? (
          <div className="flex flex-1 items-center justify-center py-20 text-sm text-[#6b7280]">Cargando editor…</div>
        ) : (
          <div className="flex min-h-[min(88vh,calc(100vh-8rem))] w-full min-w-0 flex-1">
            <aside
              className="flex w-[52px] shrink-0 flex-col items-center gap-0.5 border-r border-[#1a1d24] bg-[#2b3038] py-2"
              aria-label="Herramientas"
            >
              <EditorToolButton
                label="Selección(V)"
                pressed={canvasTool === "select"}
                onClick={() => setCanvasTool("select")}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </EditorToolButton>
              <EditorToolButton
                label="Texto(T)"
                pressed={canvasTool === "text"}
                onClick={handleAddText}
              >
                <span className="text-lg font-bold leading-none">T</span>
              </EditorToolButton>
              <EditorToolButton
                label="Mano(H)"
                pressed={canvasTool === "hand"}
                onClick={() => setCanvasTool((t) => (t === "hand" ? "select" : "hand"))}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path
                    d="M18 11v-1a2 2 0 0 0-2-2h-1V6a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-4 0v1H7a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </EditorToolButton>
              <EditorToolButton label="Variable" onClick={handleAddVariable}>
                <span className="font-mono text-sm font-semibold leading-none">{"{}"}</span>
              </EditorToolButton>
              <EditorToolButton label="Forma" onClick={handleAddShape}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </EditorToolButton>
              <EditorToolButton label="Código QR" onClick={handleAddQr}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <path d="M14 14h3v3h-3zM19 14h2M14 19h3M19 19h2" strokeLinecap="round" />
                </svg>
              </EditorToolButton>
              <EditorToolButton label="Imagen" onClick={handleAddImage}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 17l5-5 4 4 5-6 6 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </EditorToolButton>
              <EditorToolButton label="Logo escuela" onClick={handleAddSchoolLogoImage}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="3.5" y="5" width="17" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="10" cy="11.5" r="2.25" />
                  <path d="M14.5 10h5.5M14.5 13h4" strokeLinecap="round" />
                </svg>
              </EditorToolButton>
              <input
                ref={backgroundFileRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => void handleBackgroundFileChange(e)}
              />
              <EditorToolButton
                label={backgroundUploading ? "Subiendo fondo…" : "Fondo"}
                disabled={!editorReady || backgroundUploading}
                onClick={() => backgroundFileRef.current?.click()}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 15h5l2.5-3 3 4 3.5-5H21" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
                </svg>
              </EditorToolButton>

              <div className="my-2 h-px w-8 bg-white/10" aria-hidden />

              <EditorToolButton
                label="Alejar(Cmd/Ctrl+-)"
                className="!h-9 !w-9 !text-lg"
                onClick={() => dispatch(setZoom(state.zoom / 1.15))}
              >
                −
              </EditorToolButton>
              <span
                className="px-0.5 text-center font-mono text-[9px] leading-tight text-[#8b95a5]"
                title="Zoom"
              >
                {Math.round(state.zoom * 100)}%
              </span>
              <EditorToolButton
                label="Acercar(Cmd/Ctrl+=)"
                className="!h-9 !w-9 !text-lg"
                onClick={() => dispatch(setZoom(state.zoom * 1.15))}
              >
                +
              </EditorToolButton>
              <EditorToolButton
                label="Zoom 100%(Cmd/Ctrl+0)"
                className="!h-8 !w-9 !text-[10px] !font-semibold"
                onClick={() => dispatch(setZoom(1))}
              >
                1:1
              </EditorToolButton>
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <TemplateEditorCanvas
                state={state}
                dispatch={dispatch}
                className="min-h-0 flex-1"
                showSafeArea={showSafeArea}
                showCenterAxes={showCenterAxes}
                onCanvasBackgroundClick={() => setRightPanelOpen(true)}
                canvasTool={canvasTool}
                onExitTextPlacementMode={() => setCanvasTool("select")}
              />
            </div>

            {rightPanelOpen ? (
              <aside className="flex min-h-0 w-[min(100%,320px)] max-w-full shrink-0 flex-col overflow-y-auto overflow-x-hidden border-l border-[#c5ccd6] bg-[#f7f8fa]">
                <RightSidebarSection
                  sectionId="template-v2-panel-layers"
                  title="Capas"
                  open={rightPanelLayersOpen}
                  onToggle={() => setRightPanelLayersOpen((v) => !v)}
                  variant="muted"
                >
                  <TemplateEditorLayers state={state} dispatch={dispatch} />
                </RightSidebarSection>

                <RightSidebarSection
                  sectionId="template-v2-panel-inspector"
                  title="Propiedades"
                  open={rightPanelInspectorOpen}
                  onToggle={() => setRightPanelInspectorOpen((v) => !v)}
                  variant="white"
                >
                  <TemplateEditorInspector
                    selectedBlock={selectedBlock}
                    selectedBlockCount={state.selectedBlockIds.length}
                    selectedBlockIds={state.selectedBlockIds}
                    blocks={state.blocks}
                    canvas={state.canvas}
                    templateId={templateId}
                    versionId={versionId}
                    variableBindings={state.variableBindings}
                    dispatch={dispatch}
                    product={
                      state.versionMeta?.product === "clickaton" ? "clickaton" : "school"
                    }
                  />
                </RightSidebarSection>

                <RightSidebarSection
                  sectionId="template-v2-panel-review"
                  title="Revisión rápida"
                  open={rightPanelReviewOpen}
                  onToggle={() => setRightPanelReviewOpen((v) => !v)}
                  variant="white"
                >
                  <TemplateDiagnosticsPanel
                    blocks={state.blocks}
                    canvas={state.canvas}
                    dispatch={dispatch}
                    embedded
                  />
                </RightSidebarSection>
              </aside>
            ) : null}
          </div>
        )}
      </div>

      {canvasSizeModalOpen ? (
        <CanvasSizeModal
          open={canvasSizeModalOpen}
          onClose={() => setCanvasSizeModalOpen(false)}
          canvas={state.canvas}
          onApply={(next) => {
            dispatch(setCanvas(next));
            setCanvasSizeModalOpen(false);
          }}
        />
      ) : null}

      <TemplateEditorExitModal
        open={exitConfirmOpen}
        saving={state.isSaving}
        onCancel={handleExitModalCancel}
        onExitWithoutSave={handleExitWithoutSave}
        onSaveAndExit={handleSaveAndExit}
      />

      {previewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-v2-preview-title"
          data-testid="template-v2-preview-dialog"
          onClick={closePreview}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
              <h2 id="template-v2-preview-title" className="text-sm font-semibold text-[#111827]">
                Vista previa
              </h2>
              <Button type="button" variant="secondary" size="sm" onClick={closePreview}>
                Cerrar
              </Button>
            </div>
            <div className="min-h-[200px] flex-1 overflow-auto bg-[#f3f4f6] p-4 sm:p-6">
              {previewLoading ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-sm text-[#6b7280]">
                  <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#c27b3d] border-t-transparent" />
                  <span>Generando preview…</span>
                </div>
              ) : previewError ? (
                <p
                  className="text-center text-sm text-red-600"
                  data-testid="template-v2-preview-error"
                >
                  {previewError}
                </p>
              ) : previewSrc ? (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    data-testid="template-v2-preview-image"
                    src={previewSrc}
                    alt="Vista previa de la plantilla"
                    className="max-h-[min(78vh,1200px)] w-auto max-w-full rounded-lg border border-[#e5e7eb] bg-white object-contain shadow-sm"
                  />
                </div>
              ) : null}
            </div>
            <p className="border-t border-[#e5e7eb] px-4 py-2 text-center text-[11px] text-[#9ca3af]">
              Variables de texto usan datos mock o el fallback del bloque. Guardá los cambios cuando quieras persistirlos.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
