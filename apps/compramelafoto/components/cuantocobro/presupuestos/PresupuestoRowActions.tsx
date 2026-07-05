"use client";

import CuantoCobroIconButton from "@/components/cuantocobro/CuantoCobroIconButton";
import PresupuestoMoreMenu, { type PresupuestoMoreMenuItem } from "@/components/cuantocobro/presupuestos/PresupuestoMoreMenu";
import PresupuestoSendModal from "@/components/cuantocobro/presupuestos/PresupuestoSendModal";
import {
  archiveQuote,
  downloadQuotePdf,
  duplicateQuote,
  sendQuoteToClient,
} from "@/lib/cuantocobro/quote/quote-api-client";
import { getCuantoCobroCotizarUrl } from "@/lib/cuantocobro/constants";
import type { CuantoCobroQuoteListItemDto } from "@/lib/cuantocobro/quote/types";
import { Archive, Copy, Download, Eye, FilePlus2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = {
  item: CuantoCobroQuoteListItemDto;
  accentColor: string;
  clientEmail?: string;
  layout?: "table" | "card";
  onView: () => void;
  onChanged?: () => void;
};

export default function PresupuestoRowActions({
  item,
  accentColor,
  clientEmail = "",
  layout = "table",
  onView,
  onChanged,
}: Props) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const archived = Boolean(item.archivedAt);
  const canDeliver = !archived;

  const downloadTitle = archived
    ? "No disponible en presupuestos archivados"
    : downloading
      ? "Generando PDF…"
      : "Descargar PDF";

  const sendTitle = archived ? "No disponible en presupuestos archivados" : "Enviar al cliente";

  async function handleDownload() {
    if (!canDeliver || downloading) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadQuotePdf(item.id, item.currentVersionNumber, item.quoteNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar el PDF");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDuplicate() {
    if (acting) return;
    setActing(true);
    setError(null);
    try {
      const copy = await duplicateQuote(item.id);
      onChanged?.();
      router.push(getCuantoCobroCotizarUrl({ quoteId: copy.id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo duplicar");
    } finally {
      setActing(false);
    }
  }

  async function handleArchive() {
    if (archived || acting) return;
    if (!window.confirm(`¿Archivar el presupuesto ${item.quoteNumber}?`)) return;
    setActing(true);
    setError(null);
    try {
      await archiveQuote(item.id);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo archivar");
    } finally {
      setActing(false);
    }
  }

  function handleNewVersion() {
    router.push(getCuantoCobroCotizarUrl({ quoteId: item.id }));
  }

  const moreItems = useMemo((): PresupuestoMoreMenuItem[] => {
    const items: PresupuestoMoreMenuItem[] = [
      {
        id: "new-version",
        label: "Nueva versión",
        icon: FilePlus2,
        onClick: handleNewVersion,
        disabled: archived || acting,
      },
      {
        id: "duplicate",
        label: "Duplicar presupuesto",
        icon: Copy,
        onClick: () => void handleDuplicate(),
        disabled: acting,
      },
    ];

    if (!archived) {
      items.push({
        id: "archive",
        label: "Archivar",
        icon: Archive,
        onClick: () => void handleArchive(),
        disabled: acting,
      });
    }

    return items;
  }, [acting, archived]);

  return (
    <div className={`cc-presupuesto-row-actions cc-presupuesto-row-actions--${layout}`}>
      <CuantoCobroIconButton
        icon={Eye}
        label="Ver propuesta"
        title="Ver propuesta"
        variant="ghost"
        accentColor={accentColor}
        onClick={onView}
      />
      <CuantoCobroIconButton
        icon={Download}
        label="Descargar PDF"
        title={downloadTitle}
        variant="ghost"
        accentColor={accentColor}
        disabled={!canDeliver}
        loading={downloading}
        onClick={() => void handleDownload()}
      />
      <CuantoCobroIconButton
        icon={Send}
        label="Enviar al cliente"
        title={sendTitle}
        variant="primary"
        accentColor={accentColor}
        disabled={!canDeliver}
        onClick={() => setSendOpen(true)}
      />
      <PresupuestoMoreMenu items={moreItems} accentColor={accentColor} disabled={acting} />

      {error ? <span className="sr-only">{error}</span> : null}

      <PresupuestoSendModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        quoteNumber={item.quoteNumber}
        versionNumber={item.currentVersionNumber}
        defaultEmail={clientEmail}
        onSend={async (input) => {
          await sendQuoteToClient(item.id, item.currentVersionNumber, input);
          onChanged?.();
        }}
      />
    </div>
  );
}
