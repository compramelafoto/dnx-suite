"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  createDiplomaTemplateAction,
  deleteDiplomaTemplateAction,
  duplicateDiplomaTemplateAction,
  updateDiplomaTemplateAction,
  uploadDiplomaTemplateBackgroundAction,
  uploadDiplomaTemplateOverlayAction,
  getDiplomaPreviewSampleVariablesAction,
} from "../../../../../actions/diplomas";
import { DiplomaVisualEditor, type DiplomaVisualEditorHandle } from "../../../../../components/diplomas/DiplomaVisualEditor";
import { DiplomaTemplateEditorChrome } from "../../../../../components/diplomas/DiplomaTemplateEditorChrome";
import { PublicTemplateGallery } from "../../../../../components/diplomas/PublicTemplateGallery";
import {
  defaultDiplomaLayoutJson,
  newBlockId,
  parseDiplomaLayoutJson,
  type DiplomaLayoutJson,
} from "../../../../../lib/fotorank/diplomas/layoutSchema";
import type { DiplomaMergeVariables } from "../../../../../lib/fotorank/diplomas/mergeFields";
import { Modal } from "../../../../../components/ui/Modal";

/** Formato horizontal fijo para diplomas (A4 apaisado, pt). */
const DIPLOMA_LANDSCAPE_W = 842;
const DIPLOMA_LANDSCAPE_H = 595;

type TemplateRow = {
  id: string;
  name: string;
  status: string;
  layoutJson: unknown;
  widthPt: number;
  heightPt: number;
  backgroundColor: string;
  backgroundImageUrl: string | null;
};

type Props = {
  contestId: string;
  templates: TemplateRow[];
};

function statusLabel(s: string): string {
  switch (s) {
    case "ACTIVE":
      return "Publicada";
    case "DRAFT":
      return "Borrador";
    case "READY":
      return "Lista";
    case "ARCHIVED":
      return "Archivada";
    default:
      return s;
  }
}

export function DiplomaTemplatesTab({ contestId, templates: initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formBg, setFormBg] = useState("#0f0f0f");
  const [layout, setLayout] = useState<DiplomaLayoutJson>(defaultDiplomaLayoutJson());
  const [layoutBaseline, setLayoutBaseline] = useState<string>("");
  const [previewVars, setPreviewVars] = useState<DiplomaMergeVariables | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [historyUi, setHistoryUi] = useState({ canUndo: false, canRedo: false });

  const editorRef = useRef<DiplomaVisualEditorHandle>(null);

  const isLayoutDirty = useMemo(() => JSON.stringify(layout) !== layoutBaseline, [layout, layoutBaseline]);

  const openEdit = useCallback((t: TemplateRow) => {
    const parsed = parseDiplomaLayoutJson(t.layoutJson);
    setEditing(t);
    setFormName(t.name);
    setFormBg(t.backgroundColor);
    setLayout(parsed);
    setLayoutBaseline(JSON.stringify(parsed));
    setErr(null);
  }, []);

  const closeEdit = useCallback(() => {
    setEditing(null);
    setErr(null);
    setGalleryOpen(false);
  }, []);

  const savePublish = useCallback(() => {
    if (!editing) return;
    setErr(null);
    start(async () => {
      const r = await updateDiplomaTemplateAction({
        contestId,
        templateId: editing.id,
        name: formName.trim() || "Plantilla sin nombre",
        status: "ACTIVE",
        widthPt: DIPLOMA_LANDSCAPE_W,
        heightPt: DIPLOMA_LANDSCAPE_H,
        backgroundColor: formBg,
        layoutJsonText: JSON.stringify(layout),
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setLayoutBaseline(JSON.stringify(layout));
      closeEdit();
      router.refresh();
    });
  }, [editing, contestId, formName, formBg, layout, closeEdit, router]);

  const saveDraft = useCallback(() => {
    if (!editing) return;
    setErr(null);
    start(async () => {
      const r = await updateDiplomaTemplateAction({
        contestId,
        templateId: editing.id,
        name: formName.trim() || "Plantilla sin nombre",
        status: "DRAFT",
        widthPt: DIPLOMA_LANDSCAPE_W,
        heightPt: DIPLOMA_LANDSCAPE_H,
        backgroundColor: formBg,
        layoutJsonText: JSON.stringify(layout),
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setLayoutBaseline(JSON.stringify(layout));
      setEditing((e) => (e ? { ...e, status: "DRAFT", name: formName.trim() || e.name } : null));
      router.refresh();
    });
  }, [editing, contestId, formName, formBg, layout, router]);

  const switchTemplate = useCallback(
    (templateId: string) => {
      if (!editing || templateId === editing.id) return;
      if (isLayoutDirty) {
        const ok = window.confirm("Tenés cambios sin guardar. ¿Cambiar de plantilla y descartarlos?");
        if (!ok) return;
      }
      const t = initial.find((x) => x.id === templateId);
      if (t) openEdit(t);
    },
    [editing, isLayoutDirty, initial, openEdit]
  );

  const applyPublicBundle = useCallback(
    (p: { backgroundColor: string; layout: DiplomaLayoutJson }) => {
      if (isLayoutDirty) {
        const ok = window.confirm("Reemplazar el diseño actual por la plantilla pública. ¿Continuar?");
        if (!ok) return;
      }
      setLayout(p.layout);
      setFormBg(p.backgroundColor);
    },
    [isLayoutDirty]
  );

  const createFromPublicBundle = useCallback(
    (p: { backgroundColor: string; layout: DiplomaLayoutJson }) => {
      setErr(null);
      start(async () => {
        const cr = await createDiplomaTemplateAction(contestId, "Desde biblioteca");
        if (!cr.ok) {
          setErr(cr.error);
          return;
        }
        const up = await updateDiplomaTemplateAction({
          contestId,
          templateId: cr.id,
          name: "Desde biblioteca",
          status: "DRAFT",
          widthPt: DIPLOMA_LANDSCAPE_W,
          heightPt: DIPLOMA_LANDSCAPE_H,
          backgroundColor: p.backgroundColor,
          layoutJsonText: JSON.stringify(p.layout),
        });
        if (!up.ok) {
          setErr(up.error);
          return;
        }
        router.refresh();
        const next: TemplateRow = {
          id: cr.id,
          name: "Desde biblioteca",
          status: "DRAFT",
          layoutJson: p.layout,
          widthPt: DIPLOMA_LANDSCAPE_W,
          heightPt: DIPLOMA_LANDSCAPE_H,
          backgroundColor: p.backgroundColor,
          backgroundImageUrl: null,
        };
        openEdit(next);
        setGalleryOpen(false);
      });
    },
    [contestId, router, openEdit]
  );

  const duplicateCurrent = useCallback(() => {
    if (!editing) return;
    setErr(null);
    start(async () => {
      const r = await duplicateDiplomaTemplateAction(contestId, editing.id);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      router.refresh();
      const next: TemplateRow = {
        id: r.id,
        name: `${editing.name.slice(0, 80)} (copia)`,
        status: "DRAFT",
        layoutJson: layout,
        widthPt: editing.widthPt,
        heightPt: editing.heightPt,
        backgroundColor: formBg,
        backgroundImageUrl: editing.backgroundImageUrl,
      };
      openEdit(next);
    });
  }, [editing, contestId, layout, formBg, router, openEdit]);

  const uploadBackgroundFile = async (file: File) => {
    if (!editing) return;
    setErr(null);
    const fd = new FormData();
    fd.set("contestId", contestId);
    fd.set("templateId", editing.id);
    fd.set("file", file);
    const r = await uploadDiplomaTemplateBackgroundAction(fd);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setEditing((e) => (e ? { ...e, backgroundImageUrl: r.backgroundImageUrl } : null));
    router.refresh();
  };

  const onCreate = () => {
    setErr(null);
    start(async () => {
      const r = await createDiplomaTemplateAction(contestId);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      router.refresh();
    });
  };

  const onDeleteTemplate = useCallback(
    (t: TemplateRow) => {
      const ok = window.confirm(
        `¿Eliminar la plantilla «${t.name}»? Esta acción no se puede deshacer.`
      );
      if (!ok) return;
      setErr(null);
      start(async () => {
        const r = await deleteDiplomaTemplateAction(contestId, t.id);
        if (!r.ok) {
          setErr(r.error);
          return;
        }
        if (editing?.id === t.id) closeEdit();
        router.refresh();
      });
    },
    [contestId, editing?.id, closeEdit, router]
  );

  const loadPreviewVars = useCallback(() => {
    start(async () => {
      const r = await getDiplomaPreviewSampleVariablesAction(contestId);
      if (r.ok) setPreviewVars(r.variables);
    });
  }, [contestId]);

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      {err ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      <div className="rounded-2xl border border-fr-border/90 bg-fr-card px-6 py-6 shadow-sm sm:px-8 sm:py-7">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
          <div className="min-w-0 space-y-1">
            <h2 className="font-sans text-base font-semibold tracking-tight text-fr-primary">Plantillas</h2>
            <p className="text-xs text-fr-muted/90">Editor visual · PDF/PNG</p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={onCreate}
            className="fr-btn fr-btn-primary w-full shrink-0 text-sm sm:w-auto sm:self-start"
          >
            Nueva plantilla
          </button>
        </div>

        <ul className="mt-8 space-y-0 border-t border-fr-border/80 pt-2">
          {initial.length === 0 ? (
            <li className="py-10 text-center text-sm text-fr-muted">No hay plantillas todavía.</li>
          ) : (
            initial.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-8 border-b border-fr-border/60 py-4 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="truncate font-medium text-fr-primary">{t.name}</p>
                  <p className="mt-1.5 text-[11px] text-fr-muted/80">
                    <span className="rounded-md bg-fr-bg-elevated px-1.5 py-0.5 font-medium text-fr-muted">
                      {statusLabel(t.status)}
                    </span>
                    {t.backgroundImageUrl ? (
                      <span className="ml-2 text-fr-muted/60" title="Tiene imagen de fondo">
                        · Imagen
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    disabled={pending}
                    title="Editar diseño"
                    aria-label={`Editar diseño: ${t.name}`}
                    className="inline-flex size-10 items-center justify-center rounded-lg border border-fr-border bg-fr-bg-elevated text-fr-primary transition hover:border-gold/50 hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50"
                  >
                    <Pencil className="size-[17px]" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate(t)}
                    disabled={pending}
                    title="Eliminar plantilla"
                    aria-label={`Eliminar plantilla: ${t.name}`}
                    className="inline-flex size-10 items-center justify-center rounded-lg border border-fr-border bg-fr-bg-elevated text-fr-muted transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:opacity-50"
                  >
                    <Trash2 className="size-[17px]" aria-hidden />
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="rounded-xl border border-dashed border-fr-border/70 bg-fr-bg-elevated/40 px-5 py-4 text-center sm:px-6">
        <p className="text-xs leading-relaxed text-fr-muted">
          Verificación pública:{" "}
          <code className="rounded bg-fr-bg px-1.5 py-0.5 text-[11px] text-gold/90">/diplomas/verificar/…</code>
        </p>
      </div>

      {editing ? (
        <>
          <Modal
            isOpen={!!editing}
            onClose={() => {
              if (isLayoutDirty) {
                const ok = window.confirm("¿Cerrar sin guardar los cambios del diseño?");
                if (!ok) return;
              }
              closeEdit();
            }}
            header="none"
            showTopLogo={false}
            maxWidth="full"
            contentPadding="flush"
          >
            <div className="flex max-h-[min(96vh,100dvh-1rem)] flex-col bg-[#050608]">
              <DiplomaTemplateEditorChrome
                templateOptions={initial.map((t) => ({ id: t.id, name: t.name, status: t.status }))}
                currentTemplateId={editing.id}
                onSwitchTemplate={switchTemplate}
                templateName={formName}
                onTemplateNameChange={setFormName}
                statusLabel={statusLabel(editing.status)}
                isDirty={isLayoutDirty}
                pending={pending}
                canUndo={historyUi.canUndo}
                canRedo={historyUi.canRedo}
                editorRef={editorRef}
                onOpenLibrary={() => {
                  if (!previewVars) loadPreviewVars();
                  setGalleryOpen(true);
                }}
                onDuplicate={duplicateCurrent}
                onSaveDraft={saveDraft}
                onSavePublish={savePublish}
                onClose={() => {
                  if (isLayoutDirty) {
                    const ok = window.confirm("¿Cerrar sin guardar los cambios del diseño?");
                    if (!ok) return;
                  }
                  closeEdit();
                }}
              />

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
                <div className="mx-auto max-w-[1600px] rounded-2xl border border-fr-border/80 bg-[#0a0b10] p-3 shadow-[0_0_0_1px_rgba(212,175,55,0.06)] sm:p-4">
                  <DiplomaVisualEditor
                    ref={editorRef}
                    key={editing.id}
                    layout={layout}
                    onChange={setLayout}
                    widthPt={DIPLOMA_LANDSCAPE_W}
                    heightPt={DIPLOMA_LANDSCAPE_H}
                    backgroundColor={formBg}
                    backgroundImageUrl={editing.backgroundImageUrl}
                    onPageBackgroundColorChange={setFormBg}
                    onUploadBackground={uploadBackgroundFile}
                    onRemoveBackgroundImage={() => {
                      if (!editing) return;
                      start(async () => {
                        const r = await updateDiplomaTemplateAction({
                          contestId,
                          templateId: editing.id,
                          backgroundImageUrl: null,
                        });
                        if (!r.ok) setErr(r.error);
                        else {
                          setEditing({ ...editing, backgroundImageUrl: null });
                          router.refresh();
                        }
                      });
                    }}
                    previewVariables={previewVars}
                    onLoadPreviewVariables={loadPreviewVars}
                    pending={pending}
                    hideInlineUndoRedo
                    onHistoryChange={setHistoryUi}
                    onUploadOverlay={async (file) => {
                      if (!editing) return;
                      setErr(null);
                      const fd = new FormData();
                      fd.set("contestId", contestId);
                      fd.set("templateId", editing.id);
                      fd.set("file", file);
                      const r = await uploadDiplomaTemplateOverlayAction(fd);
                      if (!r.ok) {
                        setErr(r.error);
                        return;
                      }
                      setLayout((prev) => ({
                        ...prev,
                        blocks: [
                          ...prev.blocks,
                          {
                            id: newBlockId(),
                            type: "image" as const,
                            x: 80,
                            y: 120,
                            width: 220,
                            height: 120,
                            imageUrl: r.imageUrl,
                            layerName: "Imagen",
                          },
                        ],
                      }));
                      router.refresh();
                    }}
                  />
                </div>
              </div>

              <div className="shrink-0 border-t border-fr-border px-4 py-3 sm:px-6">
                <p className="text-center text-[11px] text-fr-muted">
                  {DIPLOMA_LANDSCAPE_W}×{DIPLOMA_LANDSCAPE_H} pt horizontal · PDF/PNG comparten este layout
                </p>
              </div>
            </div>
          </Modal>

          <PublicTemplateGallery
            isOpen={galleryOpen}
            onClose={() => setGalleryOpen(false)}
            onApply={applyPublicBundle}
            onApplyAsNew={createFromPublicBundle}
          />
        </>
      ) : null}
    </div>
  );
}
