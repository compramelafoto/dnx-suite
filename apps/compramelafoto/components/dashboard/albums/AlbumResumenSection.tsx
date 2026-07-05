"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { DsInfoPanel } from "@/components/ui/DsLayout";
import AlbumNextSteps, {
  type AlbumModeControlProps,
  type AlbumNextStepsMode,
} from "@/components/dashboard/albums/AlbumNextSteps";
import { AlbumPublicationManageLink } from "@/components/dashboard/albums/AlbumPublicationSection";
import { AlbumTestModeDashboardAlert } from "@/components/album/AlbumTestModeNotice";
import { albumModeOptions } from "@/lib/albums/album-mode-options";
import { MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING } from "@/lib/events/collaborative-event-pricing-lock";
import AlbumSalesStatusBadge from "@/components/dashboard/albums/AlbumSalesStatusBadge";
import type { AlbumSalesReadinessInput } from "@/lib/albums/album-sales-readiness";

export type AlbumResumenSectionProps = {
  albumId: number;
  title: string;
  publicSlug: string;
  eventShareSlug?: string | null;
  photographerHandler?: string | null;
  eventId?: number | null;
  mode?: AlbumNextStepsMode;
  isTest?: boolean;
  photoCount: number;
  visibleUntil: Date;
  mpConnected: boolean | null;
  organizerLocksAlbumDigitalPricing: boolean;
  topError?: string | null;
  nextStepsMode: AlbumNextStepsMode;
  albumModeControl?: AlbumModeControlProps;
  videoMvpEnabled?: boolean;
  salesReadinessAlbum?: AlbumSalesReadinessInput;
  canShareWithClients?: boolean;
  shareBlockReasons?: string[];
};

function formatVisibleUntil(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AlbumResumenSection({
  albumId,
  title,
  publicSlug,
  eventShareSlug,
  photographerHandler,
  eventId,
  mode,
  isTest,
  photoCount,
  visibleUntil,
  mpConnected,
  organizerLocksAlbumDigitalPricing,
  topError,
  nextStepsMode,
  albumModeControl,
  videoMvpEnabled,
  salesReadinessAlbum,
  canShareWithClients = false,
  shareBlockReasons = [],
}: AlbumResumenSectionProps) {
  const modeLabel =
    albumModeOptions.find((o) => o.value === (mode ?? "SIMPLE"))?.label ?? "Álbum simple";

  const publishReady = canShareWithClients;

  return (
    <div className="ds-tab-panel ds-stack-section w-full min-w-0 gap-6">
      {isTest ? <AlbumTestModeDashboardAlert /> : null}

      <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6">
        <div className="ds-stack-section w-full gap-4">
          <div className="ds-content-container w-full space-y-1">
            <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">Estado del álbum</h2>
            <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#6b7280] m-0">
              Vista rápida de {title || "tu álbum"} antes de entrar a fotos, ventas u otras secciones.
            </p>
          </div>
          <dl className="m-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                Tipo
              </dt>
              <dd className="mt-1 text-sm font-medium text-[#1a1a1a]">{modeLabel}</dd>
            </div>
            <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                Fotos cargadas
              </dt>
              <dd className="mt-1 text-sm font-medium text-[#1a1a1a]">{photoCount}</dd>
            </div>
            <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                Visible hasta
              </dt>
              <dd className="mt-1 text-sm font-medium text-[#1a1a1a]">
                {formatVisibleUntil(visibleUntil)}
              </dd>
            </div>
            <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 sm:col-span-2 lg:col-span-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                Cobros
              </dt>
              <dd className="mt-1 text-sm font-medium text-[#1a1a1a]">
                {mpConnected === null
                  ? "Verificando Mercado Pago…"
                  : mpConnected
                    ? "Mercado Pago conectado"
                    : "Mercado Pago sin conectar"}
              </dd>
            </div>
            <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 sm:col-span-2 lg:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                Publicación
              </dt>
              <dd className="mt-1 text-sm font-medium text-[#1a1a1a]">
                {isTest
                  ? "Modo prueba — no visible para clientes"
                  : publishReady
                    ? "Listo para compartir con clientes"
                    : photoCount === 0
                      ? "Subí fotos para publicar"
                      : "Completá ventas y Mercado Pago para compartir"}
              </dd>
            </div>
            {salesReadinessAlbum ? (
              <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                  Estado de ventas
                </dt>
                <dd className="mt-2 flex flex-wrap items-center gap-2">
                  <AlbumSalesStatusBadge album={salesReadinessAlbum} />
                </dd>
              </div>
            ) : null}
          </dl>
          {!canShareWithClients && shareBlockReasons.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-amber-950 m-0">
                No podés compartir este álbum hasta resolver lo siguiente:
              </p>
              <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-amber-900">
                {shareBlockReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <Link
                href={`/dashboard/albums/${albumId}?tab=ventas`}
                prefetch={false}
                className="inline-block text-sm font-medium text-[#c27b3d] hover:underline"
              >
                Ir a configurar ventas →
              </Link>
            </div>
          ) : null}
        </div>
      </Card>

      <AlbumPublicationManageLink albumId={albumId} compact />

      <div className="flex flex-wrap gap-3">
        <Link href={`/dashboard/albums/${albumId}?tab=fotos`} prefetch={false}>
          <Button type="button" variant="secondary" size="md" className="whitespace-nowrap">
            Ir a subir fotos
          </Button>
        </Link>
      </div>

      <AlbumNextSteps
        mode={nextStepsMode}
        albumId={albumId}
        eventId={eventId ?? undefined}
        eventShareSlug={eventShareSlug ?? undefined}
        videoMvpEnabled={videoMvpEnabled}
        albumModeControl={albumModeControl}
      />

      {(topError || mpConnected === false || organizerLocksAlbumDigitalPricing) && (
        <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6 border-[#fecaca]/40">
          <div className="ds-stack-section w-full gap-3">
            <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">Alertas importantes</h2>
            {topError ? (
              <p className="text-sm text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2 m-0">
                {topError}
              </p>
            ) : null}
            {mpConnected === false ? (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 m-0">
                Conectá Mercado Pago en tu cuenta para habilitar la carga de fotos y cobrar ventas
                en este álbum.
              </p>
            ) : null}
            {organizerLocksAlbumDigitalPricing ? (
              <DsInfoPanel title="Precios digitales del evento">
                <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-800 m-0">
                  {MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING}
                </p>
              </DsInfoPanel>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  );
}
