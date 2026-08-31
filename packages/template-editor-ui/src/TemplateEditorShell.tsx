"use client";

import {
  DEFAULT_TEMPLATE_V2_BASE_PATH,
  templateV2EditorPath,
} from "./template-v2-base-path";
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
  createDefaultShapeBlock,
  createDefaultQrBlock,
  fitZoom,
  createDefaultVariableImageBlock,
  resolveTemplateProduct,
  getInsertableImageVariablesForProduct,
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
import { editorThemeStyle, type TemplateEditorTheme } from "./theme";
import { EditorThemeProvider } from "./theme-context";
import { ActionButton, ToolButton, ToolDivider, ToolGroup } from "./chrome/ToolControls";




const sheetToolbarIconClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-[color:var(--te-ink-muted)] transition-colors disabled:pointer-events-none disabled:opacity-40 [&>svg]:pointer-events-none";

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
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-transparent text-[color:var(--te-line-strong)] transition-colors",
        "hover:border-white/10 hover:bg-white/10 hover:text-white",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--te-accent)]",
        "disabled:pointer-events-none disabled:opacity-40",
        pressed ? "border-white/15 bg-white/10 text-white" : "text-[color:var(--te-ink-faint)]",
        className
      )}
      {...props}
    />
  );
}

function RightSidebarSectionChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4 shrink-0 text-[color:var(--te-ink-muted)] transition-transform duration-200", open ? "rotate-0" : "-rotate-90", className)}
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
        "border-b border-[color:var(--te-line)]",
        variant === "muted" ? "bg-[color:var(--te-chrome)]" : "bg-white"
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <h3
          id={`${sectionId}-heading`}
          className="text-xs font-semibold uppercase tracking-wide text-[color:var(--te-ink-muted)]"
        >
          {title}
        </h3>
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[color:var(--te-ink-muted)] transition-colors hover:bg-black/[0.04] hover:text-[color:var(--te-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--te-accent)]"
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
  /** Dónde vive el editor en esta app. Default: ComprameLaFoto. */
  basePath?: string;
  className?: string;
  /**
   * Paleta de la aplicación que hospeda el editor. Sin esto el editor se ve como otro
   * producto: hasta hace poco tenía los colores de Clickatón escritos a mano y FotoOffice
   * los heredaba sin quererlo.
   */
  theme?: TemplateEditorTheme;
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

/** Alto de la barra de estado del lienzo, en píxeles. Debe seguir a la clase `h-9` de abajo. */
const BARRA_ESTADO_PX = 36;

export function TemplateEditorShell({
  templateId,
  versionId,
  className,
  theme,
  basePath = DEFAULT_TEMPLATE_V2_BASE_PATH,
}: TemplateEditorShellProps) {
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
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [imagenMenuOpen, setImagenMenuOpen] = useState(false);
  /** El área donde se dibuja. De ahí sale la medida para ajustar el zoom. */
  const areaLienzoRef = useRef<HTMLDivElement | null>(null);
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
              canvas: data.canvas ?? { width: 1200, height: 1800, background: "var(--te-surface)" },
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

  /** El producto de esta plantilla. Gobierna qué variables e imágenes ofrece el editor. */
  const producto = resolveTemplateProduct(state.versionMeta);

  /** Las imágenes que este producto sabe atar a un dato: la foto del socio, un logo. */
  const imagenesDeVariable = getInsertableImageVariablesForProduct(producto);

  /**
   * Lleva el zoom al punto donde la pieza entra completa.
   *
   * La medida sale del elemento real y no de un cálculo aparte: el panel lateral se abre y se
   * cierra, y la ventana cambia de tamaño. Un número guardado quedaría viejo enseguida.
   */
  function ajustarALaVentana() {
    const caja = areaLienzoRef.current?.getBoundingClientRect();
    if (!caja) return;
    const s = stateRef.current;
    dispatch(
      setZoom(
        fitZoom({
          canvasWidth: s.canvas.width,
          canvasHeight: s.canvas.height,
          viewportWidth: caja.width,
          // La barra de estado no es lienzo: descontarla evita que la pieza quede tapada abajo.
          viewportHeight: caja.height - BARRA_ESTADO_PX,
        }),
      ),
    );
  }

  function handleAddVariableImage(variableKey: string, name: string) {
    setCanvasTool("select");
    const s = stateRef.current;
    const ap = s.activePageIndex ?? 0;
    const onPage = s.blocks.filter((b) => (b.pageIndex ?? 0) === ap);
    const block = createDefaultVariableImageBlock(s.canvas, onPage, ap, { variableKey, name });

    /*
     * El vínculo se registra además del `source.variableKey` del bloque. Son dos cosas: uno es
     * lo que el lienzo lee para dibujar, el otro se guarda como fila propia y lleva el formato
     * y el valor de reemplazo. Un bloque sin vínculo se ve mientras se diseña y no deja
     * registro de a qué dato responde.
     */
    const binding: TemplateV2VariableBinding = { blockId: block.id, variableKey, targetPath: "src" };
    dispatch(addBlock(block));
    dispatch(
      setVariableBindings([
        ...s.variableBindings.filter((vb) => vb.blockId !== block.id),
        binding,
      ]),
    );
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
    setPreviewSvg(null);
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
      /*
       * El dibujo llega como SVG y se inserta tal cual en la ventana. No va dentro de una
       * etiqueta `img`: un SVG usado como imagen no puede pedir archivos de afuera, y las
       * fotos y los logos del diseño viven en el almacenamiento — se verían como huecos.
       */
      if (contentType.includes("application/json")) {
        const data = (await res.json()) as { ok?: boolean; svg?: string };
        if (data.ok !== true || typeof data.svg !== "string" || !data.svg.includes("<svg")) {
          throw new Error("La respuesta de la vista previa no trae un dibujo.");
        }
        setPreviewSvg(data.svg);
      } else if (contentType.includes("image/svg")) {
        const texto = await res.text();
        if (!texto.includes("<svg")) throw new Error("La vista previa llegó vacía.");
        setPreviewSvg(texto);
      } else {
        throw new Error("La vista previa respondió en un formato que no se puede mostrar.");
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Error al generar la vista previa.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewSvg(null);
    setPreviewOpen(false);
    setPreviewError(null);
    setPreviewLoading(false);
  }

  const navigateToTemplateList = useCallback(() => {
    router.push(basePath);
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
        templateV2EditorPath(basePath, templateId, newVid)
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
    <EditorThemeProvider theme={theme}>
    <div
      className={cn("flex h-full min-h-0 flex-col", className)}
      style={editorThemeStyle(theme)}
      data-testid="template-v2-editor"
    >
      <div className="flex min-h-0 w-full flex-1 flex-col bg-[color:var(--te-void)]">
        <header className="sticky top-0 z-30 shrink-0 border-b border-[color:var(--te-line-strong)] bg-[color:var(--te-chrome)] shadow-[0_1px_0_rgba(0,0,0,0.06)]">
          <div className="flex justify-end border-b border-[color:var(--te-line)] bg-[color:var(--te-line)] px-3 py-1.5 md:px-4">
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
              {/*
                La barra agrupa por asunto en vez de alinear todo en una hilera. Antes eran once
                controles idénticos, todos del mismo tamaño y con la misma forma: nada indicaba
                cuáles hacían cosas parecidas ni cuál era la acción importante.
              */}
              <div className="min-w-0 flex-1 basis-[12rem]">
                <h1
                  className="truncate text-sm font-semibold tracking-[-0.01em] text-[color:var(--te-ink)]"
                  title={`${templateName}\nTemplate ID: ${templateId}\nVersión ID: ${versionId}`}
                >
                  {templateName}
                </h1>
                <p className="mt-px flex items-center gap-1.5 text-[11px] text-[color:var(--te-ink-faint)]">
                  {versionNumber != null ? (
                    <>
                      <span className="tabular-nums">Versión {versionNumber}</span>
                      <span aria-hidden>·</span>
                      <span data-testid="template-v2-save-status">{saveBadge}</span>
                    </>
                  ) : (
                    <span>Cargando versión…</span>
                  )}
                </p>
              </div>

              <ToolGroup aria-label="Historia">
                <ToolButton
                  label="Deshacer"
                  shortcut="⌘Z"
                  onClick={() => dispatch(undo())}
                  disabled={!editorReady || !selectCanUndo(state)}
                >
                  <IconToolbarUndo />
                </ToolButton>
                <ToolButton
                  label="Rehacer"
                  shortcut="⌘⇧Z"
                  onClick={() => dispatch(redo())}
                  disabled={!editorReady || !selectCanRedo(state)}
                >
                  <IconToolbarRedo />
                </ToolButton>
              </ToolGroup>

              <ToolGroup aria-label="Documento">
                <ToolButton
                  label="Tamaño del lienzo"
                  onClick={() => setCanvasSizeModalOpen(true)}
                  disabled={!editorReady}
                >
                  <IconToolbarCanvasSize />
                </ToolButton>
                <ToolButton
                  label="Vista previa"
                  data-testid="template-v2-preview-button"
                  onClick={handlePreview}
                  disabled={!editorReady || previewLoading}
                >
                  {previewLoading ? <IconToolbarSpinner /> : <IconToolbarPreview />}
                </ToolButton>
                <ToolButton
                  label="Guardar como versión nueva"
                  onClick={() => void handleSaveAsNewVersion()}
                  disabled={!editorReady || state.isSaving || savingAsNew}
                >
                  {savingAsNew ? <IconToolbarSpinner /> : <IconToolbarNewVersion />}
                </ToolButton>
                <ToolButton
                  label="Versiones"
                  active={versionsPanelOpen}
                  aria-expanded={versionsPanelOpen}
                  onClick={() => setVersionsPanelOpen((open) => !open)}
                  disabled={!editorReady}
                >
                  <IconToolbarVersions />
                </ToolButton>
              </ToolGroup>

              {/* Guías: no cambian el diseño, cambian lo que se ve mientras se diseña. */}
              <ToolGroup aria-label="Guías">
                <ToolButton
                  label="Zona segura"
                  active={showSafeArea}
                  onClick={() => setShowSafeArea((v) => !v)}
                  disabled={!editorReady}
                >
                  <IconToolbarSafeZone />
                </ToolButton>
                <ToolButton
                  label="Ejes del centro"
                  active={showCenterAxes}
                  onClick={() => setShowCenterAxes((v) => !v)}
                  disabled={!editorReady}
                >
                  <IconToolbarAxes />
                </ToolButton>
              </ToolGroup>

              <div className="ml-auto flex items-center gap-2">
                {editorReady && hasCopiedBlockStyle ? (
                  <span
                    className="hidden max-w-[14rem] truncate rounded-[var(--te-radius)] border border-[color:var(--te-accent-wash)] bg-[color:var(--te-accent-wash)] px-2 py-1 text-[10px] font-medium text-[color:var(--te-accent)] lg:inline"
                    title="Elegí una capa compatible en el panel de capas para aplicar el estilo copiado."
                    role="status"
                  >
                    Estilo copiado — elegí una capa
                  </span>
                ) : null}

                <ToolGroup aria-label="Paneles">
                  <ToolButton
                    label="Panel lateral"
                    active={rightPanelOpen}
                    aria-expanded={rightPanelOpen}
                    onClick={() => setRightPanelOpen((open) => !open)}
                    disabled={!editorReady}
                  >
                    <IconToolbarPanel />
                  </ToolButton>
                  <ToolButton
                    label="Atajos de teclado"
                    active={shortcutsHelpOpen}
                    aria-expanded={shortcutsHelpOpen}
                    onClick={() => setShortcutsHelpOpen((open) => !open)}
                    disabled={!editorReady}
                  >
                    <IconToolbarShortcuts />
                  </ToolButton>
                </ToolGroup>

                <ToolDivider />

                {/*
                  Guardar lleva su nombre. Era un ícono más en la hilera: la acción que la
                  persona viene a hacer no puede ser un dibujo que hay que descifrar.
                */}
                <ActionButton
                  tone="primary"
                  onClick={() => void handleSave()}
                  disabled={state.isSaving || savingAsNew || !state.isDirty || revisionConflictLocked}
                  data-testid="template-v2-save-button"
                  title={
                    state.isSaving
                      ? "Guardando cambios…"
                      : !state.isDirty
                        ? "No hay cambios sin guardar"
                        : "Guardar cambios (⌘S)"
                  }
                >
                  {state.isSaving ? <IconToolbarSpinner /> : <IconToolbarSave />}
                  {state.isSaving ? "Guardando…" : "Guardar"}
                </ActionButton>
              </div>
            </div>

            {editorReady ? (
              <div
                className="flex flex-wrap items-center gap-1.5 border-t border-[color:var(--te-line)] bg-[color:var(--te-chrome)] px-3 py-2 md:px-4"
                onDragOver={(e) => {
                  if (sheetDragFrom == null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
              >
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--te-ink-muted)]">
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
                          "min-w-[4.5rem] max-w-[160px] rounded-md border px-2 py-1 text-[11px] font-medium text-[color:var(--te-ink)] shadow-sm outline-none focus:ring-2 focus:ring-[color:var(--te-accent-wash)]",
                          active
                            ? "border-[color:var(--te-accent)] bg-white"
                            : "border-[color:var(--te-ink-faint)] bg-white"
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
                          ? "border-[color:var(--te-accent)] bg-white text-[color:var(--te-accent)] shadow-sm"
                          : "border-transparent bg-white/60 text-[color:var(--te-ink-muted)] hover:bg-white hover:text-[color:var(--te-ink)]",
                        canReorder && "cursor-grab active:cursor-grabbing",
                        sheetDragFrom === i && "opacity-60",
                        sheetDragOver === i && sheetDragFrom !== i && "ring-2 ring-[color:var(--te-accent-wash)] ring-offset-1"
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
                    "border-dashed border-[color:var(--te-ink-faint)] bg-white/50 hover:border-[color:var(--te-accent)] hover:bg-[color:var(--te-accent-wash)] hover:text-[color:var(--te-accent)]"
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
                    "border-[color:var(--te-line)] bg-white/60 hover:border-[color:var(--te-danger-wash)] hover:bg-[#fff1f2] hover:text-[color:var(--te-danger)]"
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
                className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--te-danger-wash)] bg-red-50/90 px-3 py-1.5"
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
              <p className="border-t border-[color:var(--te-danger-wash)] bg-red-50/90 px-3 py-1.5 text-xs text-red-700">{backgroundUploadError}</p>
            ) : null}
            {saveAsNewError ? <p className="border-t border-[color:var(--te-danger-wash)] bg-red-50/90 px-3 py-1.5 text-xs text-red-700">{saveAsNewError}</p> : null}
            </>
          ) : null}
        </header>

        {shortcutsHelpOpen ? (
          <Card className="mx-3 mb-3 mt-0 border border-[color:var(--te-line)] bg-[color:var(--te-chrome)] p-4 md:p-5">
            <h2 className="text-sm font-semibold text-[color:var(--te-ink)]">Atajos de teclado</h2>
            <p className="mt-1 text-[11px] text-[color:var(--te-ink-muted)]">
              En el lienzo (sin foco en un campo de texto). El guardado automático corre cada{" "}
              {TEMPLATE_V2_AUTOSAVE_DEBOUNCE_MS / 1000}s tras dejar de editar.
            </p>
            <ul className="mt-3 max-h-[min(50vh,420px)] space-y-2.5 overflow-y-auto text-xs text-[color:var(--te-ink)]">
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--te-line)] pb-2">
                <span className="text-[color:var(--te-ink-muted)]">Guardar</span>
                <kbd className="shrink-0 rounded border border-[color:var(--te-line-strong)] bg-white px-2 py-0.5 font-mono text-[11px] text-[color:var(--te-ink)] shadow-sm">
                  ⌘/Ctrl + S
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--te-line)] pb-2">
                <span className="text-[color:var(--te-ink-muted)]">Herramienta texto / selección / mano</span>
                <kbd className="shrink-0 rounded border border-[color:var(--te-line-strong)] bg-white px-2 py-0.5 font-mono text-[11px] text-[color:var(--te-ink)] shadow-sm">
                  T · V · H
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--te-line)] pb-2">
                <span className="text-[color:var(--te-ink-muted)]">Mover vista del lienzo (arrastrar el área gris)</span>
                <kbd className="shrink-0 rounded border border-[color:var(--te-line-strong)] bg-white px-2 py-0.5 font-mono text-[11px] text-[color:var(--te-ink)] shadow-sm">
                  Barra espaciadora + arrastrar
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--te-line)] pb-2">
                <span className="text-[color:var(--te-ink-muted)]">Duplicar bloque (selección primaria)</span>
                <kbd className="shrink-0 rounded border border-[color:var(--te-line-strong)] bg-white px-2 py-0.5 font-mono text-[11px] text-[color:var(--te-ink)] shadow-sm">
                  ⌘/Ctrl + D
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--te-line)] pb-2">
                <span className="text-[color:var(--te-ink-muted)]">Eliminar selección</span>
                <kbd className="shrink-0 rounded border border-[color:var(--te-line-strong)] bg-white px-2 py-0.5 font-mono text-[11px] text-[color:var(--te-ink)] shadow-sm">
                  Supr / Retroceso
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--te-line)] pb-2">
                <span className="text-[color:var(--te-ink-muted)]">Mover bloque · paso fino / grueso</span>
                <kbd className="shrink-0 rounded border border-[color:var(--te-line-strong)] bg-white px-2 py-0.5 font-mono text-[11px] text-[color:var(--te-ink)] shadow-sm">
                  Flechas · Mayús + Flechas
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--te-line)] pb-2">
                <span className="text-[color:var(--te-ink-muted)]">Deshacer</span>
                <kbd className="shrink-0 rounded border border-[color:var(--te-line-strong)] bg-white px-2 py-0.5 font-mono text-[11px] text-[color:var(--te-ink)] shadow-sm">
                  ⌘/Ctrl + Z
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--te-line)] pb-2">
                <span className="text-[color:var(--te-ink-muted)]">Rehacer</span>
                <kbd className="shrink-0 rounded border border-[color:var(--te-line-strong)] bg-white px-2 py-0.5 font-mono text-[11px] text-[color:var(--te-ink)] shadow-sm">
                  ⌘/Ctrl + Mayús + Z · Ctrl + Y
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--te-line)] pb-2">
                <span className="text-[color:var(--te-ink-muted)]">Copiar / pegar bloque (primario)</span>
                <kbd className="shrink-0 rounded border border-[color:var(--te-line-strong)] bg-white px-2 py-0.5 font-mono text-[11px] text-[color:var(--te-ink)] shadow-sm">
                  ⌘/Ctrl + C · ⌘/Ctrl + V
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--te-line)] pb-2">
                <span className="text-[color:var(--te-ink-muted)]">Vista previa</span>
                <kbd className="shrink-0 rounded border border-[color:var(--te-line-strong)] bg-white px-2 py-0.5 font-mono text-[11px] text-[color:var(--te-ink)] shadow-sm">
                  ⌘/Ctrl + Mayús + P
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--te-line)] pb-2">
                <span className="text-[color:var(--te-ink-muted)]">Quitar selección · cerrar preview</span>
                <kbd className="shrink-0 rounded border border-[color:var(--te-line-strong)] bg-white px-2 py-0.5 font-mono text-[11px] text-[color:var(--te-ink)] shadow-sm">
                  Escape
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--te-line)] pb-2">
                <span className="text-[color:var(--te-ink-muted)]">Zoom · vista 100% y centrar</span>
                <kbd className="shrink-0 rounded border border-[color:var(--te-line-strong)] bg-white px-2 py-0.5 font-mono text-[11px] text-[color:var(--te-ink)] shadow-sm">
                  ⌘/Ctrl + ± · ⌘/Ctrl + 0
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--te-line)] pb-2">
                <span className="text-[color:var(--te-ink-muted)]">Duplicar y arrastrar copia (el original no se mueve)</span>
                <kbd className="shrink-0 rounded border border-[color:var(--te-line-strong)] bg-white px-2 py-0.5 font-mono text-[11px] text-[color:var(--te-ink)] shadow-sm">
                  Alt + arrastrar
                </kbd>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[color:var(--te-ink-muted)]">Capa adelante / atrás (primario)</span>
                <kbd className="shrink-0 rounded border border-[color:var(--te-line-strong)] bg-white px-2 py-0.5 font-mono text-[11px] text-[color:var(--te-ink)] shadow-sm">
                  ⌘/Ctrl + ] · ⌘/Ctrl + [
                </kbd>
              </li>
            </ul>
          </Card>
        ) : null}

        {versionsPanelOpen ? (
          <div className="border-b border-[color:var(--te-line-strong)] bg-[color:var(--te-chrome)] px-3 py-2">
            <TemplateVersionList templateId={templateId} activeVersionId={versionId} />
          </div>
        ) : null}

        {loadError ? (
          <Card className="m-4 p-6">
            <p className="text-sm text-red-600">Error al cargar versión de plantilla.</p>
            <p className="mt-2 break-all text-xs text-[color:var(--te-ink-muted)]">{loadError}</p>
          </Card>
        ) : !editorReady ? (
          <div className="flex flex-1 items-center justify-center py-20 text-sm text-[color:var(--te-ink-muted)]">Cargando editor…</div>
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
              {/*
                Imágenes atadas a un dato del destinatario. Antes había un solo botón fijo,
                "Logo escuela", con la variable de otro producto escrita adentro: en FotoOffice
                ofrecía el logo de un colegio que ahí no existe, y no había ninguna forma de
                poner la foto del socio. La lista sale del catálogo de variables del producto,
                así que cada plataforma ofrece lo suyo sin una lista aparte que mantener.
              */}
              {imagenesDeVariable.length > 0 ? (
                <div className="relative">
                  <EditorToolButton
                    label="Foto o logo del destinatario"
                    pressed={imagenMenuOpen}
                    onClick={() => setImagenMenuOpen((v) => !v)}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <rect x="3.5" y="5" width="17" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3.25" />
                    </svg>
                  </EditorToolButton>
                  {imagenMenuOpen ? (
                    <div
                      role="menu"
                      className="absolute left-full top-0 z-50 ml-1 min-w-[13rem] overflow-hidden rounded-[var(--te-radius)] border border-[color:var(--te-line)] bg-[color:var(--te-surface)] py-1 shadow-lg"
                    >
                      {imagenesDeVariable.map((v) => (
                        <button
                          key={v.key}
                          role="menuitem"
                          type="button"
                          className="block w-full px-3 py-1.5 text-left text-[12px] text-[color:var(--te-ink)] hover:bg-[color:var(--te-chrome-sunken)]"
                          title={v.description}
                          onClick={() => {
                            handleAddVariableImage(v.key, v.label);
                            setImagenMenuOpen(false);
                          }}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
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

            </aside>

            <div ref={areaLienzoRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
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
              {/*
                Estado del lienzo. El zoom vivía al pie del riel de herramientas y las hojas
                arriba, en la barra del documento: dos cosas que contestan "qué parte estoy
                mirando", separadas por toda la pantalla. Van juntas, en el borde de lo que
                describen.
              */}
              <div className="flex h-9 shrink-0 items-center gap-0.5 border-t border-[color:var(--te-line)] bg-[color:var(--te-chrome)] px-2">
                <div className="ml-auto flex items-center gap-0.5">
                  <ToolButton
                    label="Alejar"
                    shortcut="⌘−"
                    className="!h-7 !w-7"
                    onClick={() => dispatch(setZoom(state.zoom / 1.15))}
                    disabled={!editorReady}
                  >
                    <span className="text-base leading-none">−</span>
                  </ToolButton>
                  <span
                    className="min-w-[3.25rem] text-center text-[11.5px] tabular-nums text-[color:var(--te-ink-muted)]"
                    title="Nivel de zoom"
                  >
                    {Math.round(state.zoom * 100)} %
                  </span>
                  <ToolButton
                    label="Acercar"
                    shortcut="⌘+"
                    className="!h-7 !w-7"
                    onClick={() => dispatch(setZoom(state.zoom * 1.15))}
                    disabled={!editorReady}
                  >
                    <span className="text-base leading-none">+</span>
                  </ToolButton>
                  <ToolButton
                    label="Ajustar a la ventana"
                    shortcut="⇧⌘0"
                    className="!h-7 !w-7"
                    onClick={ajustarALaVentana}
                    disabled={!editorReady}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" />
                    </svg>
                  </ToolButton>
                  <ToolButton
                    label="Tamaño real"
                    shortcut="⌘0"
                    className="!h-7 !w-9 !text-[10px] !font-semibold"
                    onClick={() => dispatch(setZoom(1))}
                    disabled={!editorReady}
                  >
                    1:1
                  </ToolButton>
                </div>
              </div>
            </div>

            {rightPanelOpen ? (
              <aside className="flex min-h-0 w-[min(100%,320px)] max-w-full shrink-0 flex-col overflow-y-auto overflow-x-hidden border-l border-[color:var(--te-line-strong)] bg-[color:var(--te-chrome)]">
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
                    /*
                      Antes: `=== "clickaton" ? "clickaton" : "school"`. Una plantilla de
                      FotoOffice, cuyo producto es "fotoffice", caía en la rama de escuela y el
                      editor le ofrecía las variables de un colegio. Todo el catálogo del socio
                      existía y no había forma de llegar a él.
                    */
                    product={producto}
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
            className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[color:var(--te-line)] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--te-line)] bg-[color:var(--te-chrome)] px-4 py-3">
              <h2 id="template-v2-preview-title" className="text-sm font-semibold text-[color:var(--te-ink)]">
                Vista previa
              </h2>
              <Button type="button" variant="secondary" size="sm" onClick={closePreview}>
                Cerrar
              </Button>
            </div>
            <div className="min-h-[200px] flex-1 overflow-auto bg-[color:var(--te-chrome-sunken)] p-4 sm:p-6">
              {previewLoading ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-sm text-[color:var(--te-ink-muted)]">
                  <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--te-accent)] border-t-transparent" />
                  <span>Generando preview…</span>
                </div>
              ) : previewError ? (
                <p
                  className="text-center text-sm text-red-600"
                  data-testid="template-v2-preview-error"
                >
                  {previewError}
                </p>
              ) : previewSvg ? (
                <div className="flex justify-center">
                  <div
                    data-testid="template-v2-preview-image"
                    role="img"
                    aria-label="Vista previa de la plantilla"
                    className="max-h-[min(78vh,1200px)] max-w-full overflow-hidden rounded-lg border border-[color:var(--te-line)] bg-white shadow-sm [&>svg]:h-auto [&>svg]:max-h-[min(78vh,1200px)] [&>svg]:w-auto [&>svg]:max-w-full"
                    // El dibujo lo produce el módulo de impresión de este mismo monorepo, no
                    // el navegador ni contenido de terceros: los textos van escapados y las
                    // imágenes se limitan a direcciones http(s) y a mapas de bits.
                    dangerouslySetInnerHTML={{ __html: previewSvg }}
                  />
                </div>
              ) : null}
            </div>
            <p className="border-t border-[color:var(--te-line)] px-4 py-2 text-center text-[11px] text-[color:var(--te-ink-faint)]">
              Se dibuja con el mismo motor que produce el archivo para imprenta, con datos
              reales de tu institución. Guardá los cambios cuando quieras conservarlos.
            </p>
          </div>
        </div>
      ) : null}
    </div>
    </EditorThemeProvider>
  );
}
