"use client";

import PresupuestoQuickView from "@/components/cuantocobro/presupuestos/PresupuestoQuickView";
import PresupuestoRowActions from "@/components/cuantocobro/presupuestos/PresupuestoRowActions";
import PresupuestoStatusBadge from "@/components/cuantocobro/presupuestos/PresupuestoBadges";
import { useCuantoCobroUiAccent } from "@/components/cuantocobro/hooks/useCuantoCobroUiAccent";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import CuantoCobroButtonLink from "@/components/cuantocobro/CuantoCobroButtonLink";
import CuantoCobroListSkeleton from "@/components/cuantocobro/CuantoCobroListSkeleton";
import Card from "@/components/ui/Card";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import Input from "@/components/ui/Input";
import {
  formatQuoteClientLine,
  formatQuoteDate,
  formatQuoteDateCompact,
  formatQuoteDateTime,
  formatQuoteJobType,
  formatQuoteMoney,
  formatQuoteRelativeTime,
  formatQuoteVersionLabel,
} from "@/lib/cuantocobro/quote/quote-format";
import { fetchQuotes } from "@/lib/cuantocobro/quote/quote-api-client";
import type { CuantoCobroQuoteListItemDto } from "@/lib/cuantocobro/quote/types";
import { CC_COTIZAR_PATH } from "@/lib/cuantocobro/constants";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";

export default function PresupuestosListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<CuantoCobroQuoteListItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [hasConsultaFilter, setHasConsultaFilter] = useState("");
  const [jobDateFrom, setJobDateFrom] = useState("");
  const [jobDateTo, setJobDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [quickViewId, setQuickViewId] = useState<number | null>(null);
  const accentColor = useCuantoCobroUiAccent();

  useEffect(() => {
    const raw = searchParams.get("quoteId");
    const id = raw ? Number(raw) : NaN;
    if (Number.isFinite(id) && id > 0) {
      setQuickViewId(id);
    }
  }, [searchParams]);

  function handleCloseQuickView() {
    setQuickViewId(null);
    if (searchParams.get("quoteId")) {
      router.replace("/cuantocobro/app/presupuestos");
    }
  }

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
        const result = await fetchQuotes({
          cursor: cursor ?? undefined,
          search: searchDebounced || undefined,
          status: statusFilter || undefined,
          hasConsulta: hasConsultaFilter || undefined,
          jobDateFrom: jobDateFrom || undefined,
          jobDateTo: jobDateTo || undefined,
          amountMin: amountMin || undefined,
          amountMax: amountMax || undefined,
          includeArchived,
        });

        setItems((prev) => (append ? [...prev, ...result.items] : result.items));
        setNextCursor(result.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar presupuestos");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      searchDebounced,
      statusFilter,
      hasConsultaFilter,
      jobDateFrom,
      jobDateTo,
      amountMin,
      amountMax,
      includeArchived,
    ],
  );

  useEffect(() => {
    void loadPage(null, false);
  }, [loadPage]);

  const hasActiveFilters = Boolean(
    searchDebounced ||
      statusFilter ||
      hasConsultaFilter ||
      jobDateFrom ||
      jobDateTo ||
      amountMin ||
      amountMax ||
      includeArchived,
  );

  function openQuickView(id: number) {
    setQuickViewId(id);
  }

  return (
    <DsPageShell className="cc-page cc-presupuestos-page py-6 md:py-8">
      <DsDashboardInner className="w-full min-w-0">
        <div className="cc-presupuestos-page__inner" style={{ "--cc-accent": accentColor } as CSSProperties}>
        <header className="cc-presupuestos-header">
          <div className="min-w-0">
            <h1 className="cc-presupuestos-header__title m-0">Presupuestos</h1>
            <p className="cc-presupuestos-header__subtitle m-0">
              Historial de cotizaciones guardadas con versiones. Retomá, duplicá o revisá lo que le mostraste al cliente.
            </p>
          </div>
          <CuantoCobroButtonLink href={CC_COTIZAR_PATH} variant="primary" className="w-full sm:w-auto shrink-0">
            Nueva cotización
          </CuantoCobroButtonLink>
        </header>

        <Card className="cc-presupuestos-toolbar !p-4 md:!p-5">
          <div className="cc-presupuestos-toolbar__row">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número, cliente, email, teléfono, trabajo, lugar…"
              aria-label="Buscar presupuestos"
              className="min-h-[44px] cc-presupuestos-toolbar__search"
            />
            <select
              className="cc-presupuesto-select min-h-[44px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="">Todos los estados</option>
              <option value="DRAFT">Borrador</option>
              <option value="SENT">Enviado</option>
              <option value="ACCEPTED">Aceptado</option>
              <option value="REJECTED">Rechazado</option>
            </select>
            <select
              className="cc-presupuesto-select min-h-[44px]"
              value={hasConsultaFilter}
              onChange={(e) => setHasConsultaFilter(e.target.value)}
              aria-label="Filtrar por consulta vinculada"
            >
              <option value="">Con o sin consulta</option>
              <option value="1">Con consulta</option>
              <option value="0">Sin consulta</option>
            </select>
          </div>
          <div className="cc-presupuestos-toolbar__row cc-presupuestos-toolbar__row--secondary">
            <Input
              type="date"
              value={jobDateFrom}
              onChange={(e) => setJobDateFrom(e.target.value)}
              aria-label="Fecha de trabajo desde"
              className="min-h-[44px]"
            />
            <Input
              type="date"
              value={jobDateTo}
              onChange={(e) => setJobDateTo(e.target.value)}
              aria-label="Fecha de trabajo hasta"
              className="min-h-[44px]"
            />
            <Input
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value.replace(/\D/g, ""))}
              placeholder="Monto mín."
              aria-label="Monto mínimo"
              className="min-h-[44px]"
              inputMode="numeric"
            />
            <Input
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value.replace(/\D/g, ""))}
              placeholder="Monto máx."
              aria-label="Monto máximo"
              className="min-h-[44px]"
              inputMode="numeric"
            />
            <label className="cc-presupuestos-check min-h-[44px]">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              <span>Incluir archivados</span>
            </label>
          </div>
        </Card>

        {error ? (
          <Card className="cc-presupuestos-error !p-4">
            <p className="m-0 text-sm">{error}</p>
          </Card>
        ) : null}

        {loading ? (
          <CuantoCobroListSkeleton rows={5} />
        ) : items.length === 0 ? (
          <Card className="cc-presupuestos-empty !p-4 md:!p-6">
            <DsEmptyState title={hasActiveFilters ? "Sin resultados" : "Sin presupuestos guardados"}>
              <p className="m-0 text-sm text-[var(--cc-color-muted)]">
                {hasActiveFilters
                  ? "Ajustá los filtros o la búsqueda para encontrar un presupuesto."
                  : "Cotizá un trabajo y guardalo desde el resultado para verlo acá con su historial de versiones."}
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
                      setHasConsultaFilter("");
                      setJobDateFrom("");
                      setJobDateTo("");
                      setAmountMin("");
                      setAmountMax("");
                      setIncludeArchived(false);
                    }}
                  >
                    Limpiar filtros
                  </CuantoCobroButton>
                ) : (
                  <CuantoCobroButtonLink href={CC_COTIZAR_PATH} variant="primary" className="min-h-[44px] w-full sm:w-auto">
                    Ir a cotizar
                  </CuantoCobroButtonLink>
                )}
              </div>
            </DsEmptyState>
          </Card>
        ) : (
          <>
            <div className="cc-presupuestos-table-view cc-presupuestos-table-wrap">
              <table className="cc-presupuestos-table">
                <thead>
                  <tr>
                    <th className="cc-presupuestos-table__col-number">Número</th>
                    <th className="cc-presupuestos-table__col-client">Cliente</th>
                    <th className="cc-presupuestos-table__col-job">Trabajo</th>
                    <th className="cc-presupuestos-table__col-date">Fecha</th>
                    <th className="cc-presupuestos-table__col-status">Estado</th>
                    <th className="cc-presupuestos-table__col-money">Elegido</th>
                    <th className="cc-presupuestos-table__col-money cc-presupuestos-table__col--recommended">
                      Recomendado
                    </th>
                    <th className="cc-presupuestos-table__col-consulta cc-presupuestos-table__col--consulta">
                      Consulta
                    </th>
                    <th className="cc-presupuestos-table__col-modified cc-presupuestos-table__col--modified">
                      Modificación
                    </th>
                    <th className="cc-presupuestos-table__actions-col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="cc-presupuestos-table__col-number">
                        <div className="cc-presupuestos-table__number-cell">
                          <button
                            type="button"
                            className="cc-presupuestos-link cc-presupuestos-link--button"
                            onClick={() => openQuickView(item.id)}
                          >
                            {item.quoteNumber}
                          </button>
                          <span className="cc-presupuestos-version">
                            {formatQuoteVersionLabel(item.currentVersionNumber)}
                          </span>
                        </div>
                      </td>
                      <td className="cc-presupuestos-table__col-client">
                        <span className="cc-presupuestos-table__ellipsis" title={formatQuoteClientLine(item.clientDisplayName, item.clientCompany)}>
                          {formatQuoteClientLine(item.clientDisplayName, item.clientCompany)}
                        </span>
                      </td>
                      <td className="cc-presupuestos-table__col-job">
                        <span className="cc-presupuestos-table__ellipsis" title={formatQuoteJobType(item.jobType)}>
                          {formatQuoteJobType(item.jobType)}
                        </span>
                      </td>
                      <td className="cc-presupuestos-table__col-date" title={formatQuoteDate(item.jobDate)}>
                        {formatQuoteDateCompact(item.jobDate)}
                      </td>
                      <td className="cc-presupuestos-table__col-status">
                        <PresupuestoStatusBadge status={item.status} archivedAt={item.archivedAt} />
                      </td>
                      <td className="cc-presupuestos-table__col-money">
                        {formatQuoteMoney(item.chosenPriceCents, item.currency)}
                      </td>
                      <td className="cc-presupuestos-table__col-money cc-presupuestos-table__col--recommended">
                        {formatQuoteMoney(item.recommendedPriceCents, item.currency)}
                      </td>
                      <td className="cc-presupuestos-table__col-consulta cc-presupuestos-table__col--consulta">
                        {item.consultaId && item.consultaNumber ? (
                          <Link
                            href={`/cuantocobro/app/consultas/${item.consultaId}`}
                            className="cc-presupuestos-link"
                          >
                            {item.consultaNumber}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td
                        className="cc-presupuestos-table__col-modified cc-presupuestos-table__col--modified"
                        title={formatQuoteDateTime(item.updatedAt)}
                      >
                        {formatQuoteRelativeTime(item.updatedAt)}
                      </td>
                      <td className="cc-presupuestos-table__actions-col">
                        <PresupuestoRowActions
                          item={item}
                          accentColor={accentColor}
                          layout="table"
                          onView={() => openQuickView(item.id)}
                          onChanged={() => void loadPage(null, false)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="cc-presupuestos-mobile-view cc-presupuestos-cards">
              {items.map((item) => (
                <Card key={item.id} className="cc-presupuestos-card !p-4">
                  <div className="cc-presupuestos-card__head">
                    <button
                      type="button"
                      className="cc-presupuestos-card__number"
                      onClick={() => openQuickView(item.id)}
                    >
                      {item.quoteNumber}
                    </button>
                    <span className="cc-presupuestos-version">
                      {formatQuoteVersionLabel(item.currentVersionNumber)}
                    </span>
                    <PresupuestoStatusBadge status={item.status} archivedAt={item.archivedAt} />
                  </div>
                  <p className="cc-presupuestos-card__meta m-0">
                    {formatQuoteClientLine(item.clientDisplayName, item.clientCompany)}
                  </p>
                  <p className="cc-presupuestos-card__meta m-0">
                    {formatQuoteJobType(item.jobType)} · {formatQuoteDate(item.jobDate)}
                  </p>
                  <p className="cc-presupuestos-card__amount m-0">
                    {formatQuoteMoney(item.chosenPriceCents, item.currency)}
                    <span className="cc-presupuestos-card__amount-hint">
                      {" "}
                      · rec. {formatQuoteMoney(item.recommendedPriceCents, item.currency)}
                    </span>
                  </p>
                  {item.consultaNumber ? (
                    <p className="cc-presupuestos-card__meta m-0">
                      Consulta:{" "}
                      <Link href={`/cuantocobro/app/consultas/${item.consultaId}`} className="cc-presupuestos-link">
                        {item.consultaNumber}
                      </Link>
                    </p>
                  ) : null}
                  <p className="cc-presupuestos-card__meta m-0">
                    Modificado {formatQuoteRelativeTime(item.updatedAt)}
                  </p>
                  <div className="cc-presupuestos-card__actions">
                    <PresupuestoRowActions
                      item={item}
                      accentColor={accentColor}
                      layout="card"
                      onView={() => openQuickView(item.id)}
                      onChanged={() => void loadPage(null, false)}
                    />
                  </div>
                </Card>
              ))}
            </div>

            {nextCursor ? (
              <div className="cc-presupuestos-more">
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

        <PresupuestoQuickView
          quoteId={quickViewId}
          open={quickViewId != null}
          onClose={handleCloseQuickView}
          onChanged={() => void loadPage(null, false)}
        />
        </div>
      </DsDashboardInner>
    </DsPageShell>
  );
}
