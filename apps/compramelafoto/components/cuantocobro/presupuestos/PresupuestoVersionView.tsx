"use client";

import PresupuestoStatusBadge from "@/components/cuantocobro/presupuestos/PresupuestoBadges";
import PresupuestoQuoteActions from "@/components/cuantocobro/presupuestos/PresupuestoQuoteActions";
import PresupuestoSummaryGrid from "@/components/cuantocobro/presupuestos/PresupuestoSummaryGrid";
import QuotePreview from "@/components/cuantocobro/QuotePreview";
import { useCuantoCobroUiAccent } from "@/components/cuantocobro/hooks/useCuantoCobroUiAccent";
import AppModal from "@/components/ui/AppModal";
import {
  formatQuoteClientLine,
  formatQuoteDate,
  formatQuoteDateTime,
  formatQuoteJobType,
  formatQuoteMoney,
  formatQuoteVersionLabel,
} from "@/lib/cuantocobro/quote/quote-format";
import { fetchQuoteVersionByNumber } from "@/lib/cuantocobro/quote/quote-api-client";
import { businessProfileForCommercialProposal } from "@/lib/cuantocobro/quote/quote-branding-snapshot";
import { parseFrozenCalculation } from "@/lib/cuantocobro/quote/quote-frozen";
import type { CuantoCobroQuoteVersionDetailDto } from "@/lib/cuantocobro/quote/types";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

type Props = {
  quoteId: number;
  quoteNumber: string;
  versionNumber: number | null;
  open: boolean;
  onClose: () => void;
};

export default function PresupuestoVersionView({
  quoteId,
  quoteNumber,
  versionNumber,
  open,
  onClose,
}: Props) {
  const [detail, setDetail] = useState<CuantoCobroQuoteVersionDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!versionNumber) return;
    setLoading(true);
    setError(null);
    try {
      const version = await fetchQuoteVersionByNumber(quoteId, versionNumber);
      if (!version) {
        setError("Versión no encontrada");
        setDetail(null);
        return;
      }
      setDetail(version);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la versión");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [quoteId, versionNumber]);

  useEffect(() => {
    if (open && versionNumber) void load();
    if (!open) {
      setDetail(null);
      setError(null);
    }
  }, [open, versionNumber, load]);

  const calculation = useMemo(() => {
    if (!detail) return null;
    return parseFrozenCalculation(detail.calculationSnapshot);
  }, [detail]);

  const businessProfile = useMemo(
    () => (detail ? businessProfileForCommercialProposal(detail.businessProfileSnapshot) : null),
    [detail],
  );

  const accentColor = useCuantoCobroUiAccent(detail?.businessProfileSnapshot);

  const panelStyle = useMemo(
    () => ({ "--cc-accent": accentColor } as CSSProperties),
    [accentColor],
  );

  const jobDate = detail?.quote.client.jobDate?.trim() || null;
  const isImmutable = detail?.isImmutable ?? false;
  const canDeliver = calculation?.status === "complete";

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="xl"
      maxWidthCapRem="80rem"
      title={versionNumber ? `${quoteNumber} · ${formatQuoteVersionLabel(versionNumber)}` : "Versión del presupuesto"}
      description={
        detail ? (
          <span className="flex flex-wrap items-center gap-2">
            <PresupuestoStatusBadge status={detail.status} archivedAt={null} />
            <span className="text-sm text-[var(--cc-color-muted)]">
              Congelada el {formatQuoteDateTime(detail.createdAt)}
              {detail.createdByName ? ` · ${detail.createdByName}` : ""}
            </span>
            {detail.firstViewedAt ? (
              <span className="text-sm text-[var(--cc-color-muted)]">
                · Visto el {formatQuoteDateTime(detail.firstViewedAt)}
              </span>
            ) : null}
          </span>
        ) : null
      }
      contentClassName="ds-modal-scroll--padded"
      panelClassName="cc-presupuesto-version-view cc-page"
      zIndexClass="z-[80]"
    >
      {loading ? <p className="cc-presupuestos-muted m-0">Cargando versión…</p> : null}
      {error ? <p className="cc-presupuestos-error-text m-0">{error}</p> : null}

      {detail ? (
        <div className="cc-presupuesto-quickview__stack" style={panelStyle}>
          <section className="cc-presupuesto-quickview__internal" aria-labelledby="cc-version-internal-title">
            <div className="cc-presupuesto-quickview__section-head">
              <h3 id="cc-version-internal-title" className="cc-presupuesto-quickview__section-title m-0">
                Resumen interno
              </h3>
              <span className="cc-presupuesto-quickview__internal-badge">Solo fotógrafo</span>
            </div>

            <PresupuestoSummaryGrid
              accentColor={accentColor}
              client={formatQuoteClientLine(detail.quote.client.name, detail.quote.client.company)}
              jobType={formatQuoteJobType(detail.quote.client.jobType)}
              jobDate={formatQuoteDate(jobDate)}
              price={formatQuoteMoney(detail.chosenPriceCents, detail.currency)}
            />

            {isImmutable ? (
              <p className="cc-presupuestos-muted m-0 mt-3 text-sm">
                Esta versión ya fue vista por el cliente
                {detail.firstViewedAt ? ` el ${formatQuoteDateTime(detail.firstViewedAt)}` : ""}. Para
                cambiarla, creá una nueva versión desde el expediente.
              </p>
            ) : null}
          </section>

          <section
            className="cc-presupuesto-quickview__client-preview"
            aria-labelledby="cc-version-client-preview-title"
          >
            <h3 id="cc-version-client-preview-title" className="cc-presupuesto-quickview__section-title">
              Propuesta que verá el cliente
            </h3>
            <div className="cc-presupuesto-quickview__proposal-shell">
              {calculation ? (
                <QuotePreview
                  quote={detail.quote}
                  calculation={calculation}
                  paymentOptionsSnapshot={detail.paymentOptionsSnapshot}
                  businessProfileOverride={businessProfile}
                  accentColor={accentColor}
                  quoteNumber={quoteNumber}
                  versionNumber={detail.versionNumber}
                  showModeHint={false}
                />
              ) : (
                <p className="cc-presupuestos-muted m-0 text-sm">
                  Esta versión no incluye un cálculo completo congelado.
                </p>
              )}
            </div>
          </section>

          <section className="cc-presupuesto-quickview__delivery" aria-labelledby="cc-version-actions-title">
            <h3 id="cc-version-actions-title" className="cc-presupuesto-quickview__section-title">
              Acciones principales
            </h3>
            {canDeliver ? (
              <PresupuestoQuoteActions
                quoteId={quoteId}
                quoteNumber={quoteNumber}
                versionNumber={detail.versionNumber}
                clientEmail={detail.quote.client.email}
                version={detail}
                accentColor={accentColor}
              />
            ) : (
              <p className="cc-presupuestos-muted m-0 text-sm">
                Esta versión no incluye un cálculo completo para generar PDF o enviar al cliente.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </AppModal>
  );
}
