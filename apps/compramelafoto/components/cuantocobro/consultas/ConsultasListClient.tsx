"use client";

import {
  ConsultaStageBadge,
  ConsultaStatusBadge,
} from "@/components/cuantocobro/consultas/ConsultaBadges";
import CuantoCobroButtonLink from "@/components/cuantocobro/CuantoCobroButtonLink";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import CuantoCobroListSkeleton from "@/components/cuantocobro/CuantoCobroListSkeleton";
import Card from "@/components/ui/Card";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import Input from "@/components/ui/Input";
import {
  formatClientLine,
  formatConsultaDate,
  formatConsultaJobType,
  formatConsultaMoney,
  formatConsultaRelativeTime,
} from "@/lib/cuantocobro/consulta/consulta-format";
import { fetchConsultas } from "@/lib/cuantocobro/consulta/consulta-api-client";
import type { CuantoCobroConsultaListItemDto } from "@/lib/cuantocobro/consulta/types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function ConsultasListClient() {
  const [items, setItems] = useState<CuantoCobroConsultaListItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadPage = useCallback(
    async (cursor?: string | null, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const result = await fetchConsultas({
          cursor: cursor ?? undefined,
          search: searchDebounced || undefined,
          status: statusFilter || undefined,
          pipelineStage: stageFilter || undefined,
        });

        setItems((prev) => (append ? [...prev, ...result.items] : result.items));
        setNextCursor(result.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar consultas");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [searchDebounced, statusFilter, stageFilter],
  );

  useEffect(() => {
    void loadPage(null, false);
  }, [loadPage]);

  const hasActiveFilters = Boolean(searchDebounced || statusFilter || stageFilter);

  return (
    <DsPageShell className="cc-page cc-consultas-page py-6 md:py-8">
      <DsDashboardInner className="w-full min-w-0">
        <header className="cc-consultas-header">
          <div className="min-w-0">
            <h1 className="cc-consultas-header__title m-0">Consultas</h1>
            <p className="cc-consultas-header__subtitle m-0">
              Registrá clientes y trabajos antes de cotizar. Cada consulta es tu expediente comercial.
            </p>
          </div>
          <CuantoCobroButtonLink
            href="/cuantocobro/app/consultas/nueva"
            variant="primary"
            className="w-full sm:w-auto shrink-0"
          >
            Nueva consulta
          </CuantoCobroButtonLink>
        </header>

        <Card className="cc-consultas-toolbar !p-4 md:!p-5">
          <div className="cc-consultas-toolbar__row">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, número, lugar, notas…"
              aria-label="Buscar consultas"
              className="min-h-[44px]"
            />
            <select
              className="cc-consulta-select min-h-[44px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="">Todos los estados</option>
              <option value="OPEN">Abierta</option>
              <option value="WON">Ganada</option>
              <option value="LOST">Perdida</option>
              <option value="ARCHIVED">Archivada</option>
            </select>
            <select
              className="cc-consulta-select min-h-[44px]"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              aria-label="Filtrar por etapa"
            >
              <option value="">Todas las etapas</option>
              <option value="NEW">Nueva</option>
              <option value="CONTACTED">Contactada</option>
              <option value="QUALIFIED">Calificada</option>
              <option value="PROPOSAL_SENT">Propuesta enviada</option>
              <option value="NEGOTIATION">Negociación</option>
            </select>
          </div>
        </Card>

        {error ? (
          <Card className="cc-consultas-error !p-4">
            <p className="m-0 text-sm">{error}</p>
          </Card>
        ) : null}

        {loading ? (
          <CuantoCobroListSkeleton rows={5} />
        ) : items.length === 0 ? (
          <Card className="cc-consultas-empty !p-4 md:!p-6">
            <DsEmptyState title={hasActiveFilters ? "Sin resultados" : "Sin consultas todavía"}>
              <p className="m-0 text-sm text-[var(--cc-color-muted)]">
                {hasActiveFilters
                  ? "Probá con otros filtros o limpiá la búsqueda para ver todas tus consultas."
                  : "Creá la primera para registrar un cliente y el tipo de trabajo antes de armar el presupuesto."}
              </p>
              <div className="ds-empty-state__actions mt-4 flex flex-wrap gap-3">
                {hasActiveFilters ? (
                  <CuantoCobroButton
                    type="button"
                    variant="outline"
                    className="min-h-[44px] w-full sm:w-auto"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("");
                      setStageFilter("");
                    }}
                  >
                    Limpiar filtros
                  </CuantoCobroButton>
                ) : (
                  <CuantoCobroButtonLink href="/cuantocobro/app/consultas/nueva" variant="primary" className="min-h-[44px] w-full sm:w-auto">
                    Nueva consulta
                  </CuantoCobroButtonLink>
                )}
              </div>
            </DsEmptyState>
          </Card>
        ) : (
          <>
            <div className="cc-consultas-table-wrap hidden md:block">
              <table className="cc-consultas-table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Cliente</th>
                    <th>Evento</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Etapa</th>
                    <th>Valor est.</th>
                    <th>Actualización</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link href={`/cuantocobro/app/consultas/${item.id}`} className="cc-consultas-link">
                          {item.consultaNumber}
                        </Link>
                      </td>
                      <td>
                        <div className="cc-consultas-cell-stack">
                          <span>{formatClientLine(item.clientDisplayName, item.clientCompany)}</span>
                          {item.nextActionTitle ? (
                            <span className="cc-consultas-cell-meta">→ {item.nextActionTitle}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>{formatConsultaJobType(item.jobType)}</td>
                      <td>{formatConsultaDate(item.eventDate)}</td>
                      <td>
                        <ConsultaStatusBadge status={item.status} />
                      </td>
                      <td>
                        <ConsultaStageBadge stage={item.pipelineStage} />
                      </td>
                      <td>{formatConsultaMoney(item.estimatedValueCents, item.currency)}</td>
                      <td title={item.lastActivityAt}>{formatConsultaRelativeTime(item.lastActivityAt)}</td>
                      <td>
                        <Link href={`/cuantocobro/app/consultas/${item.id}`} className="cc-consultas-link">
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="cc-consultas-cards md:hidden">
              {items.map((item) => (
                <Card key={item.id} className="cc-consultas-card !p-4">
                  <div className="cc-consultas-card__head">
                    <Link href={`/cuantocobro/app/consultas/${item.id}`} className="cc-consultas-card__number">
                      {item.consultaNumber}
                    </Link>
                    <ConsultaStatusBadge status={item.status} />
                  </div>
                  <p className="cc-consultas-card__title m-0">{item.title}</p>
                  <p className="cc-consultas-card__meta m-0">
                    {formatClientLine(item.clientDisplayName, item.clientCompany)}
                  </p>
                  <p className="cc-consultas-card__meta m-0">
                    {formatConsultaJobType(item.jobType)} · {formatConsultaDate(item.eventDate)}
                  </p>
                  <p className="cc-consultas-card__amount m-0">
                    {formatConsultaMoney(item.estimatedValueCents, item.currency)}
                  </p>
                  <div className="cc-consultas-card__actions">
                    <CuantoCobroButtonLink
                      href={`/cuantocobro/app/consultas/${item.id}`}
                      variant="outline"
                      className="w-full"
                    >
                      Ver expediente
                    </CuantoCobroButtonLink>
                  </div>
                </Card>
              ))}
            </div>

            {nextCursor ? (
              <div className="cc-consultas-more">
                <CuantoCobroButton
                  type="button"
                  variant="secondary"

                  className="min-h-[44px] w-full sm:w-auto"
                  disabled={loadingMore}
                  onClick={() => void loadPage(nextCursor, true)}
                >
                  {loadingMore ? "Cargando…" : "Cargar más"}
                </CuantoCobroButton>
              </div>
            ) : null}
          </>
        )}
      </DsDashboardInner>
    </DsPageShell>
  );
}
