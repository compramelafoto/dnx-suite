"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AlbumSharePanel from "@/components/dashboard/albums/AlbumSharePanel";
import { AlbumTestModeDashboardAlert } from "@/components/album/AlbumTestModeNotice";
import type { AlbumNextStepsMode } from "@/components/dashboard/albums/AlbumNextSteps";
import type { AlbumPublicationPanelId } from "@/lib/albums/album-dashboard-nav";

export type AlbumPublicationSectionProps = {
  albumId: number;
  publicSlug: string;
  eventShareSlug?: string | null;
  photographerHandler?: string | null;
  mode?: AlbumNextStepsMode;
  activePanel?: AlbumPublicationPanelId;
  isTest?: boolean;
  isPublic?: boolean;
  isHidden?: boolean;
  hiddenPhotosEnabled?: boolean;
  photoCount: number;
  visibleUntil: Date;
  expirationExtensionDays?: number | null;
  coverPhotoId?: number | null;
  coverPreviewUrl?: string | null;
  onEditVisibility?: () => void;
  canShareWithClients?: boolean;
  shareBlockReasons?: string[];
  shareWarnings?: string[];
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysUntil(date: Date): number {
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function resolvePublicationVisibilityLabel(props: {
  isTest?: boolean;
  isHidden?: boolean;
  isPublic?: boolean;
}): { label: string; detail: string } {
  if (props.isTest) {
    return {
      label: "Modo prueba",
      detail:
        "Solo vos podés previsualizar este álbum. Los clientes no lo ven en tu landing ni en enlaces públicos.",
    };
  }
  if (props.isHidden) {
    return {
      label: "Oculto",
      detail: "El álbum no está disponible para clientes.",
    };
  }
  if (props.isPublic === false) {
    return {
      label: "Privado",
      detail: "No está publicado para venta pública. Solo accesible con link directo.",
    };
  }
  return {
    label: "Público",
    detail: "Los clientes pueden acceder con el enlace del álbum o de la galería del evento.",
  };
}

/** Enlace compacto hacia Publicación (sin duplicar QR/enlaces). */
export function AlbumPublicationManageLink({
  albumId,
  className = "",
  compact = false,
}: {
  albumId: number;
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <Link
        href={`/dashboard/albums/${albumId}?tab=publicacion`}
        prefetch={false}
        className={`text-sm font-medium text-[#c27b3d] hover:underline ${className}`}
      >
        Gestionar publicación →
      </Link>
    );
  }

  return (
    <Card className={`ds-fill-width w-full min-w-0 p-4 sm:p-5 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-[#1a1a1a] m-0">Publicación</h2>
          <p className="text-sm text-[#6b7280] m-0">
            Compartir, visibilidad, protección y portada en un solo lugar.
          </p>
        </div>
        <Link href={`/dashboard/albums/${albumId}?tab=publicacion`} prefetch={false}>
          <Button type="button" variant="primary" size="md" className="whitespace-nowrap">
            Abrir publicación
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export default function AlbumPublicationSection({
  albumId,
  publicSlug,
  eventShareSlug,
  photographerHandler,
  mode,
  activePanel = "compartir",
  isTest,
  isPublic,
  isHidden,
  hiddenPhotosEnabled,
  photoCount,
  visibleUntil,
  expirationExtensionDays,
  coverPhotoId,
  coverPreviewUrl,
  onEditVisibility,
  canShareWithClients = true,
  shareBlockReasons = [],
  shareWarnings = [],
}: AlbumPublicationSectionProps) {
  const visibility = resolvePublicationVisibilityLabel({ isTest, isHidden, isPublic });
  const daysLeft = daysUntil(visibleUntil);
  const extensionDays =
    typeof expirationExtensionDays === "number" && Number.isFinite(expirationExtensionDays)
      ? expirationExtensionDays
      : 0;

  return (
    <div className="ds-tab-panel ds-stack-section w-full min-w-0 gap-5">
      {isTest ? <AlbumTestModeDashboardAlert /> : null}

      <Card className="ds-fill-width w-full min-w-0 border border-[#e5e7eb] bg-[#f9fafb] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-[#1a1a1a] m-0">Solo publicación</p>
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#6b7280] m-0">
              Acá configurás visibilidad, enlaces, QR, portada y modo prueba. Precios, packs y cobros
              están en la pestaña Ventas.
            </p>
          </div>
          <Link
            href={`/dashboard/albums/${albumId}?tab=ventas`}
            prefetch={false}
            className="w-full shrink-0 sm:w-auto"
          >
            <Button type="button" variant="secondary" size="md" className="w-full whitespace-nowrap sm:w-auto">
              Ir a Ventas
            </Button>
          </Link>
        </div>
      </Card>

      <div className="ds-content-container w-full space-y-1">
        <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">Publicación</h2>
        <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#6b7280] m-0">
          Enlaces, visibilidad, protección visual y portada del álbum.
        </p>
      </div>

      {activePanel === "compartir" ? (
        <>
          {!canShareWithClients && shareBlockReasons.length > 0 ? (
            <Card className="ds-fill-width w-full min-w-0 border border-amber-200 bg-amber-50 p-4 sm:p-5">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-amber-950 m-0">
                  Compartir deshabilitado
                </p>
                <p className="text-sm text-amber-900 m-0">
                  Configurá al menos un método de venta y conectá Mercado Pago antes de enviar el
                  enlace a tus clientes.
                </p>
                <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {shareBlockReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <Link href={`/dashboard/albums/${albumId}?tab=ventas`} prefetch={false}>
                  <Button type="button" variant="primary" size="sm" className="mt-2">
                    Configurar ventas
                  </Button>
                </Link>
              </div>
            </Card>
          ) : null}
          {canShareWithClients && shareWarnings.length > 0 ? (
            <Card className="ds-fill-width w-full min-w-0 border border-sky-200 bg-sky-50 p-4 sm:p-5">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-sky-950 m-0">Podés compartir el enlace</p>
                <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-sky-900">
                  {shareWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            </Card>
          ) : null}
          <AlbumSharePanel
            albumId={albumId}
            publicSlug={publicSlug}
            eventShareSlug={eventShareSlug}
            photographerHandler={photographerHandler}
            mode={mode}
            variant="full"
            includeExtraLinks
            title="Compartir álbum"
            description="Copiá el enlace principal, descargá el QR o abrí la galería pública."
            disabled={!canShareWithClients}
          />
        </>
      ) : null}

      {activePanel === "visibilidad" ? (
        <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6">
          <div className="ds-stack-section w-full gap-4">
            <div className="ds-content-container w-full space-y-1">
              <h3 className="text-base font-semibold text-[#1a1a1a] m-0">Visibilidad y expiración</h3>
              <p className="ds-readable-text ds-readable-text--sm text-[#6b7280] m-0">
                Estado actual del álbum y ventana de disponibilidad para clientes.
              </p>
            </div>
            <dl className="m-0 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">Estado</dt>
                <dd className="mt-1 text-sm font-medium text-[#1a1a1a]">{visibility.label}</dd>
              </div>
              <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                  Fotos publicadas
                </dt>
                <dd className="mt-1 text-sm font-medium text-[#1a1a1a]">{photoCount}</dd>
              </div>
              <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                  Visible hasta
                </dt>
                <dd className="mt-1 text-sm font-medium text-[#1a1a1a]">{formatDate(visibleUntil)}</dd>
              </div>
              <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                  Tiempo restante
                </dt>
                <dd className="mt-1 text-sm font-medium text-[#1a1a1a]">
                  {daysLeft > 0
                    ? `${daysLeft} día${daysLeft !== 1 ? "s" : ""}`
                    : daysLeft === 0
                      ? "Vence hoy"
                      : "Vencido — reactivación disponible"}
                </dd>
              </div>
            </dl>
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-[#6b7280] m-0">
              {visibility.detail}
              {extensionDays > 0
                ? ` Incluye ${extensionDays} día${extensionDays !== 1 ? "s" : ""} de extensión aplicados.`
                : ""}
            </p>
            {hiddenPhotosEnabled ? (
              <p className="ds-readable-text text-sm text-[#6b7280] m-0">
                Fotos ocultas con acceso por selfie activo.
              </p>
            ) : null}
            {onEditVisibility ? (
              <Button type="button" variant="secondary" size="md" onClick={onEditVisibility}>
                Editar privacidad y acceso
              </Button>
            ) : (
              <Link href={`/dashboard/albums/${albumId}?tab=configuracion`} prefetch={false}>
                <Button type="button" variant="secondary" size="md">
                  Editar en Configuración
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ) : null}

      {activePanel === "proteccion" ? (
        <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6">
          <div className="ds-stack-section w-full gap-4">
            <div className="ds-content-container w-full space-y-1">
              <h3 className="text-base font-semibold text-[#1a1a1a] m-0">Protección visual</h3>
              <p className="ds-readable-text ds-readable-text--sm text-[#6b7280] m-0">
                Marcas de agua y previews protegidas aplicadas automáticamente.
              </p>
            </div>
            <ul className="m-0 list-disc space-y-2 pl-5 ds-readable-text text-sm text-[#6b7280]">
              <li>Miniaturas de grilla sin marca de agua para navegación clara.</li>
              <li>Vista ampliada y lightbox con marcas de agua dinámicas.</li>
              <li>Videos públicos listos usan previews protegidas según el flujo actual.</li>
            </ul>
            {hiddenPhotosEnabled ? (
              <p className="text-sm text-[#6b7280] m-0">
                Modo fotos ocultas: cada cliente solo ve sus previews autorizadas.
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {activePanel === "portada" ? (
        <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6">
          <div className="ds-stack-section w-full gap-4">
            <div className="ds-content-container w-full space-y-1">
              <h3 className="text-base font-semibold text-[#1a1a1a] m-0">Portada social</h3>
              <p className="ds-readable-text ds-readable-text--sm text-[#6b7280] m-0">
                Imagen del álbum en listados y al compartir.
              </p>
            </div>
            {coverPreviewUrl ? (
              <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                <div className="mx-auto sm:mx-0 shrink-0 w-[min(100%,12rem)] aspect-square rounded-xl border border-[#e5e7eb] bg-[#fafafa] overflow-hidden">
                  <img
                    src={coverPreviewUrl}
                    alt="Portada del álbum"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="ds-readable-text text-sm text-[#1a1a1a] m-0">
                    {coverPhotoId
                      ? `Foto #${coverPhotoId} configurada como portada.`
                      : "Primera foto disponible como referencia."}
                  </p>
                  <Link href={`/dashboard/albums/${albumId}?tab=fotos`} prefetch={false}>
                    <Button type="button" variant="secondary" size="md" className="whitespace-nowrap">
                      Elegir portada en Fotos
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="ds-readable-text text-sm text-[#6b7280] m-0">
                  Subí fotos y elegí una portada desde Contenido → Fotos.
                </p>
                <Link href={`/dashboard/albums/${albumId}?tab=fotos`} prefetch={false}>
                  <Button type="button" variant="secondary" size="md">
                    Ir a Fotos
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
