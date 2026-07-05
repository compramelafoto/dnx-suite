"use client";

import {
  ConsultaStageBadge,
  ConsultaStatusBadge,
} from "@/components/cuantocobro/consultas/ConsultaBadges";
import ConsultaFormFields from "@/components/cuantocobro/consultas/ConsultaFormFields";
import CuantoCobroButtonLink from "@/components/cuantocobro/CuantoCobroButtonLink";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import CuantoCobroListSkeleton from "@/components/cuantocobro/CuantoCobroListSkeleton";
import Card from "@/components/ui/Card";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import Input from "@/components/ui/Input";
import {
  formatConsultaDateTime,
  formatConsultaRelativeTime,
} from "@/lib/cuantocobro/consulta/consulta-format";
import {
  addConsultaNote,
  deleteConsulta,
  fetchConsultaById,
  updateConsulta,
} from "@/lib/cuantocobro/consulta/consulta-api-client";
import type { CuantoCobroConsultaDetailDto, CuantoCobroConsultaInput } from "@/lib/cuantocobro/consulta/types";
import { getCuantoCobroCotizarUrl, getCuantoCobroPresupuestoUrl } from "@/lib/cuantocobro/constants";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function detailToInput(detail: CuantoCobroConsultaDetailDto): CuantoCobroConsultaInput {
  return {
    title: detail.title,
    pipelineStage: detail.pipelineStage,
    status: detail.status,
    priority: detail.priority,
    probability: detail.probability,
    jobType: detail.jobType,
    eventDate: detail.eventDate ?? "",
    eventEndDate: detail.eventEndDate ?? "",
    eventLocation: detail.eventLocation,
    eventCity: detail.eventCity,
    eventProvince: detail.eventProvince,
    eventCountry: detail.eventCountry,
    eventLatitude: detail.eventLatitude,
    eventLongitude: detail.eventLongitude,
    brief: detail.brief,
    currency: detail.currency,
    estimatedValue: detail.estimatedValueCents != null ? String(detail.estimatedValueCents) : "",
    clfClientKey: detail.clfClientKey ?? "",
    clientDisplayName: detail.clientDisplayName,
    clientCompany: detail.clientCompany,
    clientEmail: detail.clientEmail,
    clientPhone: detail.clientPhone,
    sourceChannel: detail.sourceChannel,
    sourceDetail: detail.sourceDetail,
    nextActionTitle: detail.nextActionTitle,
    nextActionDueAt: detail.nextActionDueAt ?? "",
    tags: detail.tags,
    lostReason: detail.lostReason,
  };
}

type Props = {
  consultaId: number;
};

export default function ConsultaDetailClient({ consultaId }: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState<CuantoCobroConsultaDetailDto | null>(null);
  const [form, setForm] = useState<CuantoCobroConsultaInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConsultaById(consultaId);
      if (!data) {
        setError("Consulta no encontrada");
        setDetail(null);
        setForm(null);
        return;
      }
      setDetail(data);
      setForm(detailToInput(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [consultaId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateConsulta(consultaId, form);
      setDetail(updated);
      setForm(detailToInput(updated));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("¿Eliminar esta consulta? Solo está permitido en borradores abiertos.")) return;
    try {
      await deleteConsulta(consultaId);
      router.push("/cuantocobro/app/consultas");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = noteBody.trim();
    if (!trimmed) return;
    setAddingNote(true);
    setError(null);
    try {
      await addConsultaNote(consultaId, trimmed);
      setNoteBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar la nota");
    } finally {
      setAddingNote(false);
    }
  }

  if (loading) {
    return (
      <DsPageShell className="cc-page cc-consultas-page py-6 md:py-8">
        <DsDashboardInner className="w-full min-w-0">
          <CuantoCobroListSkeleton rows={4} variant="cards" />
        </DsDashboardInner>
      </DsPageShell>
    );
  }

  if (!detail || !form) {
    return (
      <DsPageShell className="cc-page cc-consultas-page py-6 md:py-8">
        <DsDashboardInner>
          <Card className="!p-6">
            <p className="m-0">{error || "Consulta no encontrada"}</p>
            <CuantoCobroButtonLink href="/cuantocobro/app/consultas" variant="outline" className="mt-4">
              Volver al listado
            </CuantoCobroButtonLink>
          </Card>
        </DsDashboardInner>
      </DsPageShell>
    );
  }

  return (
    <DsPageShell className="cc-page cc-consultas-page py-6 md:py-8">
      <DsDashboardInner className="w-full min-w-0">
        <nav className="cc-consultas-breadcrumb">
          <Link href="/cuantocobro/app/consultas">Consultas</Link>
          <span aria-hidden>/</span>
          <span>{detail.consultaNumber}</span>
        </nav>

        <header className="cc-consultas-detail-header">
          <div className="min-w-0">
            <p className="cc-consultas-detail-header__number m-0">{detail.consultaNumber}</p>
            <h1 className="cc-consultas-detail-header__title m-0">{detail.title}</h1>
            <p className="cc-consultas-detail-header__subtitle m-0 mt-1 text-sm text-[var(--cc-color-muted)]">
              Expediente comercial · actualizado {formatConsultaRelativeTime(detail.updatedAt)}
            </p>
            <div className="cc-consultas-detail-header__badges mt-2">
              <ConsultaStatusBadge status={detail.status} />
              <ConsultaStageBadge stage={detail.pipelineStage} />
            </div>
          </div>
          <div className="cc-consultas-detail-header__actions">
            <CuantoCobroButtonLink
              href={getCuantoCobroCotizarUrl({ consultaId })}
              variant="primary"
              className="w-full sm:w-auto"
            >
              Cotizar
            </CuantoCobroButtonLink>
            <CuantoCobroButton
              type="button"
              variant="outline"
              className="min-h-[44px] w-full sm:w-auto"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </CuantoCobroButton>
          </div>
        </header>

        {error ? (
          <Card className="cc-consultas-error !p-4 mb-4">
            <p className="m-0 text-sm">{error}</p>
          </Card>
        ) : null}

        <div className="cc-consultas-detail-layout">
          <div className="cc-consultas-detail-main">
            <Card className="!p-4 md:!p-6">
              <ConsultaFormFields value={form} onChange={setForm} idPrefix={`consulta-${detail.id}`} />
            </Card>

            <Card className="!p-4 md:!p-6">
              <h2 className="cc-consulta-form__section-title mt-0">Notas</h2>
              <form className="cc-consultas-note-form" onSubmit={(e) => void handleAddNote(e)}>
                <textarea
                  className="cc-consulta-textarea"
                  rows={3}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Agregar una nota interna…"
                />
                <CuantoCobroButton
                  type="submit"
                  variant="secondary"

                  className="min-h-[44px] w-full sm:w-auto"
                  disabled={addingNote || !noteBody.trim()}
                >
                  {addingNote ? "Guardando…" : "Agregar nota"}
                </CuantoCobroButton>
              </form>
              <ul className="cc-consultas-notes-list">
                {detail.notes.length === 0 ? (
                  <li className="cc-consultas-muted">Sin notas todavía.</li>
                ) : (
                  detail.notes.map((note) => (
                    <li key={note.id} className="cc-consultas-note-item">
                      <p className="cc-consultas-note-item__body m-0">{note.body}</p>
                      <p className="cc-consultas-note-item__meta m-0">
                        {formatConsultaDateTime(note.createdAt)}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </Card>
          </div>

          <aside className="cc-consultas-detail-aside">
            <Card className="!p-4 md:!p-5">
              <h2 className="cc-consulta-form__section-title mt-0">Actividad</h2>
              {detail.activities.length === 0 ? (
                <DsEmptyState title="Sin actividad registrada" variant="tight">
                  <p className="m-0 text-sm text-[var(--cc-color-muted)]">
                    Los cambios de estado y notas aparecerán acá a medida que avances la consulta.
                  </p>
                </DsEmptyState>
              ) : (
              <ul className="cc-consultas-activity-list">
                {detail.activities.map((activity) => (
                  <li key={activity.id} className="cc-consultas-activity-item">
                    <p className="cc-consultas-activity-item__title m-0">{activity.title}</p>
                    {activity.body ? (
                      <p className="cc-consultas-activity-item__body m-0">{activity.body}</p>
                    ) : null}
                    <p className="cc-consultas-activity-item__meta m-0">
                      {formatConsultaRelativeTime(activity.occurredAt)}
                    </p>
                  </li>
                ))}
              </ul>
              )}
            </Card>

            <Card className="!p-4 md:!p-5">
              <h2 className="cc-consulta-form__section-title mt-0">Vínculos</h2>
              <p className="cc-consultas-muted m-0 mb-3 text-sm">
                Presupuestos y seguimiento comercial vinculados a esta consulta.
              </p>
              <dl className="cc-consultas-links-dl">
                <div>
                  <dt>Presupuesto</dt>
                  <dd>
                    {detail.primaryQuoteId && detail.primaryQuoteNumber ? (
                      <Link
                        href={getCuantoCobroPresupuestoUrl(detail.primaryQuoteId)}
                        className="cc-presupuestos-link"
                      >
                        {detail.primaryQuoteNumber}
                        {detail.primaryQuoteStatus ? ` (${detail.primaryQuoteStatus})` : ""}
                      </Link>
                    ) : (
                      "Sin presupuesto vinculado"
                    )}
                  </dd>
                </div>
              </dl>
            </Card>

            {detail.status === "OPEN" ? (
              <CuantoCobroButton
                type="button"
                variant="outline"

                className="min-h-[44px] w-full text-red-700 border-red-200"
                onClick={() => void handleDelete()}
              >
                Eliminar consulta
              </CuantoCobroButton>
            ) : null}
          </aside>
        </div>
      </DsDashboardInner>
    </DsPageShell>
  );
}
