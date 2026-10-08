"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Palette, Pencil, Trash2 } from "lucide-react";
import {
  createDiplomaTemplateAction,
  deleteDiplomaTemplateAction,
  duplicateDiplomaTemplateAction,
  updateDiplomaTemplateAction,
} from "../../../../../actions/diplomas";
import { readDiplomaDesignLink } from "../../../../../lib/fotorank/design/constants";
import { routes } from "../../../../../lib/routes";
import { DiplomaTemplatePreviewImage } from "../../../../../components/diplomas/DiplomaTemplatePreviewImage";

type TemplateRow = {
  id: string;
  name: string;
  status: string;
  layoutJson: unknown;
  updatedAt?: string | Date;
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

/** Abre el diseño en el diseñador compartido y vuelve a esta pantalla al cerrarlo. */
function editorHref(contestId: string, templateId: string): string {
  const vuelta = routes.dashboard.concursos.diplomas(contestId);
  return `/api/fotorank/design/open?diplomaTemplateId=${encodeURIComponent(templateId)}&return=${encodeURIComponent(vuelta)}`;
}

/**
 * Plantillas de diploma del concurso.
 *
 * El diseño se hace en el diseñador de FOTOFFICE (el mismo de las placas y el carnet): acá sólo
 * se ve cómo sale, se nombra, se publica y se abre el diseñador.
 */
export function DiplomaTemplatesTab({ contestId, templates }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setErr(r.error ?? "No se pudo completar la acción.");
        return;
      }
      router.refresh();
    });
  };

  const onRename = (t: TemplateRow) => {
    const nombre = window.prompt("Nombre de la plantilla", t.name);
    if (!nombre || nombre.trim() === t.name) return;
    run(() => updateDiplomaTemplateAction({ contestId, templateId: t.id, name: nombre }));
  };

  const onDelete = (t: TemplateRow) => {
    if (!window.confirm(`¿Eliminar la plantilla «${t.name}»?`)) return;
    run(() => deleteDiplomaTemplateAction(contestId, t.id));
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {err ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-2xl border border-fr-border/90 bg-fr-card px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-fr-primary">Plantillas de diploma</h2>
          <p className="text-xs text-fr-muted">
            Se diseñan en el diseñador: arrastrás textos, imágenes y el QR, y usás los datos del
            premiado (nombre, obra, premio, categoría). Sólo las plantillas publicadas emiten.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => createDiplomaTemplateAction(contestId))}
          className="fr-btn fr-btn-primary w-full shrink-0 text-sm sm:w-auto"
        >
          Nueva plantilla
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="py-10 text-center text-sm text-fr-muted">No hay plantillas todavía.</p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {templates.map((t) => {
            const conDisenador = readDiplomaDesignLink(t.layoutJson) !== null;
            const version = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
            return (
              <li key={t.id} className="overflow-hidden rounded-2xl border border-fr-border/90 bg-fr-card">
                <div className="aspect-[297/210] bg-fr-bg-elevated">
                  {conDisenador ? (
                    <DiplomaTemplatePreviewImage templateId={t.id} version={version} alt={t.name} />
                  ) : (
                    <div className="flex h-full items-center justify-center p-6 text-center text-xs text-fr-muted">
                      Hecha con el editor anterior: ya no se puede emitir. Eliminala y creá una nueva.
                    </div>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate font-medium text-fr-primary">{t.name}</p>
                    <span className="shrink-0 rounded-md bg-fr-bg-elevated px-1.5 py-0.5 text-[11px] text-fr-muted">
                      {conDisenador ? statusLabel(t.status) : "Editor anterior"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {conDisenador ? (
                      <>
                        <a href={editorHref(contestId, t.id)} className="fr-btn fr-btn-primary text-xs">
                          <Palette className="mr-1 h-3.5 w-3.5" aria-hidden /> Editar diseño
                        </a>
                        <button
                          type="button"
                          disabled={pending}
                          className="fr-btn fr-btn-secondary text-xs"
                          onClick={() =>
                            run(() =>
                              updateDiplomaTemplateAction({
                                contestId,
                                templateId: t.id,
                                status: t.status === "ACTIVE" ? "DRAFT" : "ACTIVE",
                              }),
                            )
                          }
                        >
                          {t.status === "ACTIVE" ? "Pasar a borrador" : "Publicar"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="fr-btn fr-btn-secondary text-xs"
                          onClick={() => onRename(t)}
                          title="Cambiar nombre"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          <span className="sr-only">Cambiar nombre</span>
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="fr-btn fr-btn-secondary text-xs"
                          onClick={() => run(() => duplicateDiplomaTemplateAction(contestId, t.id))}
                          title="Duplicar"
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                          <span className="sr-only">Duplicar</span>
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      disabled={pending}
                      className="fr-btn fr-btn-secondary text-xs text-red-300"
                      onClick={() => onDelete(t)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      <span className="sr-only">Eliminar</span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
