"use client";

import PresupuestoStatusBadge from "@/components/cuantocobro/presupuestos/PresupuestoBadges";
import PresupuestoQuoteActions from "@/components/cuantocobro/presupuestos/PresupuestoQuoteActions";
import PresupuestoSecondaryActions from "@/components/cuantocobro/presupuestos/PresupuestoSecondaryActions";
import PresupuestoSummaryGrid from "@/components/cuantocobro/presupuestos/PresupuestoSummaryGrid";
import PresupuestoVersionHistory from "@/components/cuantocobro/presupuestos/PresupuestoVersionHistory";
import QuotePreview from "@/components/cuantocobro/QuotePreview";
import { useCuantoCobroUiAccent } from "@/components/cuantocobro/hooks/useCuantoCobroUiAccent";
import AppModal from "@/components/ui/AppModal";
import { calculateCuantoCobro } from "@/lib/cuantocobro/calculate-cuanto-cobro";
import { fetchCuantoCobroProfile } from "@/lib/cuantocobro/api-stubs";
import {
  formatQuoteClientLine,
  formatQuoteDate,
  formatQuoteDateTime,
  formatQuoteJobType,
  formatQuoteMoney,
  formatQuoteVersionLabel,
} from "@/lib/cuantocobro/quote/quote-format";
import {
  archiveQuote,
  duplicateQuote,
  fetchQuoteById,
} from "@/lib/cuantocobro/quote/quote-api-client";
import { businessProfileForCommercialProposal } from "@/lib/cuantocobro/quote/quote-branding-snapshot";
import { parseFrozenCalculation } from "@/lib/cuantocobro/quote/quote-frozen";
import { getCuantoCobroCotizarUrl } from "@/lib/cuantocobro/constants";
import type { CuantoCobroQuoteDetailDto } from "@/lib/cuantocobro/quote/types";
import type { CuantoCobroProfileInput } from "@/lib/cuantocobro/types";
import { INITIAL_CUANTO_COBRO_PROFILE } from "@/lib/cuantocobro/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

type Props = {
  quoteId: number | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
};

export default function PresupuestoQuickView({ quoteId, open, onClose, onChanged }: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState<CuantoCobroQuoteDetailDto | null>(null);
  const [profile, setProfile] = useState<CuantoCobroProfileInput>(INITIAL_CUANTO_COBRO_PROFILE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!quoteId) return;
    setLoading(true);
    setError(null);
    try {
      const [quote, remoteProfile] = await Promise.all([
        fetchQuoteById(quoteId),
        fetchCuantoCobroProfile(),
      ]);
      if (!quote) {
        setError("Presupuesto no encontrado");
        setDetail(null);
        return;
      }
      setDetail(quote);
      if (remoteProfile) setProfile(remoteProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    if (open && quoteId) void load();
    if (!open) {
      setDetail(null);
      setError(null);
    }
  }, [open, quoteId, load]);

  const calculation = useMemo(() => {
    if (!detail) return null;
    const frozen = parseFrozenCalculation(detail.calculationSnapshot);
    if (frozen) return frozen;
    return calculateCuantoCobro(profile, detail.quote);
  }, [detail, profile]);

  const currentVersion = useMemo(() => {
    if (!detail) return null;
    return detail.versions.find((version) => version.isCurrent) ?? null;
  }, [detail]);

  const businessProfile = useMemo(
    () =>
      detail?.businessProfileSnapshot
        ? businessProfileForCommercialProposal(detail.businessProfileSnapshot)
        : null,
    [detail?.businessProfileSnapshot],
  );

  const accentColor = useCuantoCobroUiAccent(detail?.businessProfileSnapshot);

  const panelStyle = useMemo(
    () => ({ "--cc-accent": accentColor } as CSSProperties),
    [accentColor],
  );

  async function handleArchive() {
    if (!detail || detail.archivedAt) return;
    if (!window.confirm(`¿Archivar el presupuesto ${detail.quoteNumber}?`)) return;
    setActing(true);
    setError(null);
    try {
      await archiveQuote(detail.id);
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo archivar");
    } finally {
      setActing(false);
    }
  }

  async function handleDuplicate() {
    if (!detail) return;
    setActing(true);
    setError(null);
    try {
      const copy = await duplicateQuote(detail.id);
      onChanged?.();
      router.push(getCuantoCobroCotizarUrl({ quoteId: copy.id }));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo duplicar");
    } finally {
      setActing(false);
    }
  }

  function handleCreateNewVersion() {
    if (!detail) return;
    router.push(getCuantoCobroCotizarUrl({ quoteId: detail.id }));
    onClose();
  }

  const archived = Boolean(detail?.archivedAt);
  const canDeliver = calculation?.status === "complete" && !archived;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="xl"
      maxWidthCapRem="80rem"
      title={detail ? detail.quoteNumber : "Presupuesto"}
      description={
        detail ? (
          <span className="flex flex-wrap items-center gap-2">
            <PresupuestoStatusBadge status={detail.status} archivedAt={detail.archivedAt} />
            <span className="cc-presupuestos-version">{formatQuoteVersionLabel(detail.currentVersionNumber)}</span>
            <span className="text-sm text-[var(--cc-color-muted)]">
              Actualizado {formatQuoteDateTime(detail.updatedAt)}
            </span>
            {currentVersion?.firstViewedAt ? (
              <span className="text-sm text-[var(--cc-color-muted)]">
                · Visto {formatQuoteDateTime(currentVersion.firstViewedAt)}
              </span>
            ) : null}
          </span>
        ) : null
      }
      contentClassName="ds-modal-scroll--padded"
      panelClassName="cc-presupuesto-quickview cc-page"
      zIndexClass="z-[80]"
    >
      {loading ? <p className="cc-presupuestos-muted m-0">Cargando presupuesto…</p> : null}
      {error ? <p className="cc-presupuestos-error-text m-0">{error}</p> : null}

      {detail ? (
        <div className="cc-presupuesto-quickview__stack" style={panelStyle}>
          <section className="cc-presupuesto-quickview__internal" aria-labelledby="cc-presupuesto-internal-title">
            <div className="cc-presupuesto-quickview__section-head">
              <h3 id="cc-presupuesto-internal-title" className="cc-presupuesto-quickview__section-title m-0">
                Resumen interno
              </h3>
              <span className="cc-presupuesto-quickview__internal-badge">Solo fotógrafo</span>
            </div>

            <PresupuestoSummaryGrid
              accentColor={accentColor}
              client={formatQuoteClientLine(detail.clientDisplayName, detail.clientCompany)}
              jobType={formatQuoteJobType(detail.jobType)}
              jobDate={formatQuoteDate(detail.jobDate)}
              price={formatQuoteMoney(detail.chosenPriceCents, detail.currency)}
            />

            {detail.consultaId && detail.consultaNumber ? (
              <p className="cc-presupuestos-muted m-0 mt-3 text-sm">
                Vinculado a{" "}
                <Link href={`/cuantocobro/app/consultas/${detail.consultaId}`} className="cc-presupuestos-link">
                  consulta {detail.consultaNumber}
                </Link>
              </p>
            ) : null}
          </section>

          <section
            className="cc-presupuesto-quickview__client-preview"
            aria-labelledby="cc-presupuesto-client-preview-title"
          >
            <h3 id="cc-presupuesto-client-preview-title" className="cc-presupuesto-quickview__section-title">
              Propuesta que verá el cliente
            </h3>
            <div className="cc-presupuesto-quickview__proposal-shell">
              {calculation?.status === "complete" ? (
                <QuotePreview
                  quote={detail.quote}
                  calculation={calculation}
                  paymentOptionsSnapshot={detail.paymentOptionsSnapshot}
                  businessProfileOverride={businessProfile}
                  accentColor={accentColor}
                  quoteNumber={detail.quoteNumber}
                  versionNumber={detail.currentVersionNumber}
                  showModeHint={false}
                />
              ) : (
                <p className="cc-presupuestos-muted m-0 text-sm">
                  Completá tu perfil financiero en el wizard para ver la propuesta comercial con todos los
                  conceptos.
                </p>
              )}
            </div>
          </section>

          <section className="cc-presupuesto-quickview__delivery" aria-labelledby="cc-presupuesto-actions-title">
            <h3 id="cc-presupuesto-actions-title" className="cc-presupuesto-quickview__section-title">
              Acciones principales
            </h3>
            {canDeliver ? (
              <PresupuestoQuoteActions
                quoteId={detail.id}
                quoteNumber={detail.quoteNumber}
                versionNumber={detail.currentVersionNumber}
                clientEmail={detail.quote.client.email}
                version={currentVersion}
                disabled={acting}
                accentColor={accentColor}
                onSent={() => void load()}
              />
            ) : (
              <p className="cc-presupuestos-muted m-0 text-sm">
                {archived
                  ? "Este presupuesto está archivado."
                  : "Completá tu perfil financiero para habilitar PDF y envío al cliente."}
              </p>
            )}
          </section>

          <PresupuestoSecondaryActions
            accentColor={accentColor}
            disabled={acting}
            archived={archived}
            onNewVersion={handleCreateNewVersion}
            onDuplicate={() => void handleDuplicate()}
            onArchive={() => void handleArchive()}
          />

          {detail.versions.length > 0 ? (
            <PresupuestoVersionHistory
              quoteId={detail.id}
              quoteNumber={detail.quoteNumber}
              versions={detail.versions}
              currentVersionNumber={detail.currentVersionNumber}
            />
          ) : null}
        </div>
      ) : null}
    </AppModal>
  );
}
