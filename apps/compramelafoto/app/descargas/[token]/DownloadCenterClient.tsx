"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  Images,
  Package,
  UserRound,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { DownloadCenterData } from "@/lib/digital-download/load-download-center";
import type { DownloadAvailabilityStatus } from "@/lib/digital-download/download-link-policy";

type Props = {
  data: DownloadCenterData;
};

function AvailabilityBadge({ status }: { status: DownloadAvailabilityStatus }) {
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-900">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Vencido
      </span>
    );
  }

  if (status === "expiring_soon") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Próximo a vencer
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Disponible
    </span>
  );
}

function DownloadCenterHeader({ data }: { data: DownloadCenterData }) {
  const albumName = data.albumTitle?.trim() || "Tu álbum";
  const photographer = data.photographerName?.trim() || data.photographerEmail?.trim() || null;
  const photoLabel =
    data.photoCount === 1
      ? "1 fotografía digital comprada"
      : `${data.photoCount} fotografías digitales compradas`;

  return (
    <header className="space-y-6">
      <div className="flex justify-center sm:justify-start">
        <Image
          src="/watermark.png"
          alt="ComprameLaFoto"
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-full opacity-90 ring-1 ring-black/8"
          priority
        />
      </div>

      <div className="space-y-4 text-center sm:text-left">
        <div className="space-y-2">
          <p className="inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#111827]/45 sm:justify-start">
            <Camera className="h-4 w-4 shrink-0" aria-hidden />
            Tus fotografías ya están listas
          </p>
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-[#111827] md:text-[2.125rem]">
            {albumName}
          </h1>
        </div>

        <div className="flex flex-col items-center gap-3 sm:items-start">
          <p className="inline-flex items-center gap-2 text-sm text-[#111827]/70">
            <Images className="h-4 w-4 shrink-0 text-[#111827]/45" aria-hidden />
            {photoLabel}
          </p>

          <p className="inline-flex items-center gap-2 text-sm text-[#111827]/70">
            <CalendarDays className="h-4 w-4 shrink-0 text-[#111827]/45" aria-hidden />
            Comprada el{" "}
            <span className="font-medium text-[#111827]">{data.purchasedAtLabel}</span>
          </p>

          {photographer ? (
            <p className="text-sm leading-relaxed text-[#111827]/70">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4 shrink-0 text-[#111827]/45" aria-hidden />
                Fotografías realizadas por:
              </span>{" "}
              <span className="font-semibold text-[#111827]">{photographer}</span>
            </p>
          ) : null}

          <AvailabilityBadge status={data.availability.status} />
        </div>
      </div>
    </header>
  );
}

function StatusBanner({ data }: { data: DownloadCenterData }) {
  const { status, daysRemaining, expiresAtLabel } = data.availability;

  if (status === "expired") {
    return (
      <Card className="border-red-200/80 bg-red-50/90 !p-5 shadow-none md:!p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span className="mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-200 bg-white text-red-700 sm:mx-0">
            <AlertCircle className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-2 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <AvailabilityBadge status="expired" />
              <p className="text-sm font-semibold text-red-950">Período de descarga finalizado</p>
            </div>
            <p className="text-sm leading-relaxed text-red-900/90">
              El acceso online finalizó. Si necesitás ayuda, contactá al fotógrafo
              {data.photographerName || data.photographerEmail
                ? ` (${data.photographerName ?? data.photographerEmail})`
                : ""}{" "}
              o al{" "}
              <Link
                href={data.supportUrl}
                className="rounded-sm font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
              >
                soporte de ComprameLaFoto
              </Link>
              .
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const cardTone =
    status === "expiring_soon"
      ? "border-amber-200/80 bg-amber-50/50"
      : "border-emerald-200/70 bg-emerald-50/40";

  const daysLabel =
    daysRemaining === 1 ? "Queda 1 día" : `Quedan ${daysRemaining} días`;

  return (
    <Card className={cn("!p-5 shadow-none md:!p-6", cardTone)}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <AvailabilityBadge status={status} />
        </div>

        <dl className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-[#111827]/6 bg-white/70 px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#111827]/45">
              Disponible hasta
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-[#111827]">
              {expiresAtLabel}
            </dd>
          </div>
          <div className="min-w-0 rounded-2xl border border-[#111827]/6 bg-white/70 px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#111827]/45">
              Tiempo restante
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-[#111827]">{daysLabel}</dd>
          </div>
        </dl>

        <p className="text-sm leading-relaxed text-[#111827]/70">
          Las fotografías son tuyas para siempre. La descarga online estará disponible hasta la
          fecha indicada.
        </p>
      </div>
    </Card>
  );
}

function ZipSection({
  data,
  zipState,
}: {
  data: DownloadCenterData;
  zipState: DownloadCenterData["zip"];
}) {
  if (data.availability.status === "expired" || data.photoCount <= 1) {
    return null;
  }

  if (zipState.status === "ready") {
    return (
      <Card className="!p-4 shadow-[0_4px_14px_rgba(17,24,39,0.04)] md:!p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#111827]/8 bg-[#fafafa] text-[#111827]/50">
              <Package className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-sm text-[#111827]/70">
              Descargar todas las fotografías juntas{" "}
              <span className="text-[#111827]/45">(ZIP)</span>
            </p>
          </div>
          <Button
            variant="outline"
            size="md"
            className="w-full shrink-0 whitespace-nowrap sm:w-auto"
            onClick={() => window.location.assign(zipState.downloadUrl)}
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            Descargar ZIP
          </Button>
        </div>
      </Card>
    );
  }

  if (zipState.status === "preparing") {
    return (
      <Card className="!p-4 shadow-[0_4px_14px_rgba(17,24,39,0.04)] md:!p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#111827]/8 bg-[#fafafa] text-[#111827]/50">
            <Package className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#111827]/80">ZIP en preparación</p>
            <p className="mt-1 text-xs leading-relaxed text-[#111827]/55">
              Mientras tanto podés descargar cada foto por separado. El botón ZIP aparecerá cuando
              esté listo.
            </p>
            {typeof zipState.progressPercent === "number" ? (
              <p className="mt-2 text-xs text-[#111827]/45">
                Progreso: {zipState.progressPercent}%
              </p>
            ) : null}
          </div>
        </div>
      </Card>
    );
  }

  if (zipState.status === "error") {
    return (
      <Card className="border-amber-200/80 bg-amber-50/80 !p-4 text-sm text-amber-950 shadow-none md:!p-5">
        No pudimos preparar el ZIP automáticamente. Podés descargar las fotos una por una.
      </Card>
    );
  }

  return null;
}

function PhotoCard({
  photo,
  index,
}: {
  photo: DownloadCenterData["photos"][number];
  index: number;
}) {
  const label = `Foto ${index + 1}`;

  return (
    <li className="min-w-0">
      <Card className="!rounded-2xl !p-0 overflow-hidden">
        <div className="relative aspect-[3/4] w-full bg-[#eceff3]">
          <Image
            src={photo.previewUrl}
            alt={label}
            fill
            className="object-cover"
            sizes="(max-width: 399px) 100vw, (max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
            unoptimized
          />
        </div>
        <div className="p-2.5 sm:p-3">
          <p className="sr-only">{photo.filename}</p>
          <Button
            variant="primary"
            size="md"
            className="w-full whitespace-nowrap"
            onClick={() => window.location.assign(photo.downloadUrl)}
          >
            <Download className="hidden h-4 w-4 shrink-0 min-[400px]:inline" aria-hidden />
            <span className="min-[400px]:hidden">Descargar</span>
            <span className="hidden min-[400px]:inline">Descargar foto</span>
          </Button>
        </div>
      </Card>
    </li>
  );
}

export default function DownloadCenterClient({ data }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [zipState, setZipState] = useState(data.zip);
  const isExpired = data.availability.status === "expired";

  useEffect(() => {
    setZipState(data.zip);
  }, [data.zip]);

  useEffect(() => {
    if (isExpired || data.photoCount <= 1 || zipState.status !== "preparing") {
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${data.orderId}/zip-status`);
        const json = await res.json();
        if (!res.ok || !json?.zip) return;
        if (json.zip.status === "completed" && json.zip.downloadUrl) {
          setZipState({ status: "ready", downloadUrl: json.zip.downloadUrl });
        } else if (json.zip.status === "error") {
          setZipState({ status: "error" });
        } else {
          setZipState({
            status: "preparing",
            progressPercent:
              typeof json.zip.progressPercent === "number" ? json.zip.progressPercent : null,
            currentStep: json.zip.currentStep ?? null,
          });
        }
      } catch {
        // noop
      }
    };

    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [data.orderId, data.photoCount, isExpired, zipState.status]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <main className="ds-page-shell min-h-screen overflow-x-hidden bg-[#fafafa]">
      <div className="container-custom py-8 md:py-12">
        <div className="ds-gallery-inner ds-stack-section">
          <DownloadCenterHeader data={data} />

          <StatusBanner data={data} />

          {!isExpired ? (
            <section aria-label="Galería de fotos compradas" className="min-w-0">
              <ul className="ds-gallery-grid">
                {data.photos.map((photo, index) => (
                  <PhotoCard key={photo.photoId} photo={photo} index={index} />
                ))}
              </ul>
            </section>
          ) : null}

          {!isExpired && isMobile ? (
            <p className="text-center text-xs leading-relaxed text-[#111827]/50">
              En el celular, descargá cada foto por separado para guardarlas más fácil en tu
              galería.
            </p>
          ) : null}

          {!isExpired ? <ZipSection data={data} zipState={zipState} /> : null}
        </div>
      </div>
    </main>
  );
}
