"use client";

import PresupuestoActionCard from "@/components/cuantocobro/presupuestos/PresupuestoActionCard";
import PresupuestoSendModal from "@/components/cuantocobro/presupuestos/PresupuestoSendModal";
import { downloadQuotePdf, sendQuoteToClient } from "@/lib/cuantocobro/quote/quote-api-client";
import { formatQuoteDateTime } from "@/lib/cuantocobro/quote/quote-format";
import type { CuantoCobroQuoteVersionSummaryDto } from "@/lib/cuantocobro/quote/types";
import { Download, Send } from "lucide-react";
import { useState } from "react";

type Props = {
  quoteId: number;
  quoteNumber: string;
  versionNumber: number;
  clientEmail: string;
  version?: CuantoCobroQuoteVersionSummaryDto | null;
  disabled?: boolean;
  accentColor?: string;
  className?: string;
  onSent?: () => void;
};

export default function PresupuestoQuoteActions({
  quoteId,
  quoteNumber,
  versionNumber,
  clientEmail,
  version,
  disabled = false,
  accentColor,
  className = "",
  onSent,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImmutable = version?.isImmutable ?? false;

  async function handleDownloadPdf() {
    setDownloading(true);
    setError(null);
    try {
      await downloadQuotePdf(quoteId, versionNumber, quoteNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar el PDF");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={`cc-presupuesto-quote-actions ${className}`.trim()}>
      {isImmutable ? (
        <p className="cc-presupuestos-muted m-0 text-sm">
          Esta versión ya fue vista por el cliente
          {version?.firstViewedAt ? ` el ${formatQuoteDateTime(version.firstViewedAt)}` : ""}. Para cambiarla,
          creá una nueva versión.
        </p>
      ) : null}

      <div className="cc-presupuesto-quote-actions__cards">
        <PresupuestoActionCard
          icon={Download}
          title="Descargar PDF"
          description="Generar propuesta en PDF"
          variant="secondary"
          accentColor={accentColor}
          disabled={disabled}
          loading={downloading}
          onClick={() => void handleDownloadPdf()}
        />
        <PresupuestoActionCard
          icon={Send}
          title="Enviar"
          description="Compartir por email"
          variant="primary"
          accentColor={accentColor}
          disabled={disabled}
          onClick={() => setSendOpen(true)}
        />
      </div>

      {error ? <p className="cc-presupuestos-error-text m-0 text-sm">{error}</p> : null}

      <PresupuestoSendModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        quoteNumber={quoteNumber}
        versionNumber={versionNumber}
        defaultEmail={clientEmail}
        onSend={async (input) => {
          await sendQuoteToClient(quoteId, versionNumber, input);
          onSent?.();
        }}
      />
    </div>
  );
}
