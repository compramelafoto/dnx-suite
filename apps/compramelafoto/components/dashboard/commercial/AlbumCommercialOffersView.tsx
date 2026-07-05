"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Check, ImageIcon, Minus } from "lucide-react";
import { formatARS } from "@/lib/lab/helpers";
import {
  commercialOfferSourceKindLabel,
  type AlbumCommercialOffer,
  type CommercialOfferSourceKind,
} from "@/lib/commercial/album-commercial-offer";

function formatAvailabilityPhase(phase: string | null | undefined): string | null {
  if (!phase) return null;
  switch (phase) {
    case "PRE_UPLOAD":
      return "Antes de subir fotos";
    case "POST_UPLOAD":
      return "Después de subir fotos";
    case "ALWAYS":
      return "Siempre disponible";
    default:
      return phase;
  }
}

function SourceKindBadge({ kind }: { kind: CommercialOfferSourceKind }) {
  const styles: Record<CommercialOfferSourceKind, string> = {
    catalog: "bg-[#eef6ff] text-[#1d4ed8] ring-[#bfdbfe]",
    system_template: "bg-[#f3e8ff] text-[#7c3aed] ring-[#ddd6fe]",
    manual: "bg-[#f3f4f6] text-[#374151] ring-[#e5e7eb]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[kind]}`}
    >
      {commercialOfferSourceKindLabel(kind)}
    </span>
  );
}

function ChannelBlock({
  label,
  channel,
}: {
  label: string;
  channel?: AlbumCommercialOffer["preventa"] | AlbumCommercialOffer["galeria"];
}) {
  if (!channel) {
    return (
      <div className="rounded-lg border border-dashed border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af] m-0">{label}</p>
        <p className="mt-2 text-sm text-[#6b7280] m-0 flex items-center gap-1.5">
          <Minus className="h-4 w-4 shrink-0" aria-hidden />
          No configurado
        </p>
      </div>
    );
  }

  const phaseLabel = formatAvailabilityPhase(channel.availabilityPhase);

  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280] m-0">{label}</p>
      <div className="flex items-center gap-2">
        {channel.enabled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf5] px-2 py-0.5 text-xs font-semibold text-[#047857] ring-1 ring-inset ring-[#a7f3d0]">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Activo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fef2f2] px-2 py-0.5 text-xs font-semibold text-[#b91c1c] ring-1 ring-inset ring-[#fecaca]">
            Inactivo
          </span>
        )}
      </div>
      <p className="text-lg font-semibold text-[#1a1a1a] m-0 tabular-nums">
        {formatARS(channel.pricePhotographerArs)}
      </p>
      <p className="text-xs text-[#6b7280] m-0">Precio base fotógrafo (sin fee de plataforma)</p>
      {phaseLabel ? (
        <p className="text-xs text-[#6b7280] m-0">Disponibilidad: {phaseLabel}</p>
      ) : null}
    </div>
  );
}

function OfferCard({ offer }: { offer: AlbumCommercialOffer }) {
  const hasBoth = Boolean(offer.preventa && offer.galeria);
  const hasPreventaOnly = Boolean(offer.preventa && !offer.galeria);
  const hasGaleriaOnly = Boolean(!offer.preventa && offer.galeria);

  return (
    <article className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 p-4 sm:p-5">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
          {offer.imageUrl ? (
            <Image
              src={offer.imageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="80px"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#9ca3af]">
              <ImageIcon className="h-8 w-8" aria-hidden />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-[#1a1a1a] m-0">{offer.title}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <SourceKindBadge kind={offer.sourceKind} />
              {offer.catalogProductId ? (
                <span className="text-xs text-[#6b7280]">Catálogo #{offer.catalogProductId}</span>
              ) : null}
              {hasBoth ? (
                <span className="inline-flex items-center rounded-full bg-[#fdf8f3] px-2 py-0.5 text-xs font-medium text-[#c27b3d] ring-1 ring-inset ring-[#e8dcc8]">
                  Preventa + galería
                </span>
              ) : null}
              {hasPreventaOnly ? (
                <span className="inline-flex items-center rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-medium text-[#2563eb] ring-1 ring-inset ring-[#bfdbfe]">
                  Solo preventa
                </span>
              ) : null}
              {hasGaleriaOnly ? (
                <span className="inline-flex items-center rounded-full bg-[#f0fdf4] px-2 py-0.5 text-xs font-medium text-[#15803d] ring-1 ring-inset ring-[#bbf7d0]">
                  Solo galería
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ChannelBlock label="Preventa" channel={offer.preventa} />
            <ChannelBlock label="Venta en galería" channel={offer.galeria} />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function AlbumCommercialOffersView({
  albumId,
  active,
}: {
  albumId: number;
  active: boolean;
}) {
  const [offers, setOffers] = useState<AlbumCommercialOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/commercial-offers`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar las ofertas comerciales");
      }
      setOffers(Array.isArray(data?.offers) ? (data.offers as AlbumCommercialOffer[]) : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando ofertas");
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    if (!active || !albumId) return;
    void loadOffers();
  }, [active, albumId, loadOffers]);

  return (
    <div className="w-full min-w-0 space-y-6 ds-content-container max-w-3xl">
      <div className="rounded-xl border border-[#e8dcc8] bg-gradient-to-br from-[#fdf8f3] to-white px-5 py-4 space-y-2">
        <p className="text-base font-semibold text-[#1a1a1a] m-0">
          Mismo producto. Dos momentos de venta. Dos precios opcionales.
        </p>
        <p className="text-sm text-[#6b7280] m-0">
          Esta vista unifica lo que vendés en <strong>preventa</strong> y en{" "}
          <strong>galería</strong> para que veas el mismo producto comercial en ambos contextos.
          Es solo lectura: no edita ni sincroniza precios todavía.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[#6b7280]">Cargando ofertas comerciales…</p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
          {error}
        </div>
      ) : null}

      {!loading && !error && offers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e5e7eb] bg-[#fafafa] px-5 py-8 text-center space-y-2">
          <p className="text-sm font-medium text-[#374151] m-0">Todavía no hay productos comerciales</p>
          <p className="text-sm text-[#6b7280] m-0">
            Creá packs en las pestañas Preventa o Venta en galería. Acá verás cómo se relacionan.
          </p>
        </div>
      ) : null}

      {!loading && !error && offers.length > 0 ? (
        <div className="space-y-4">
          {offers.map((offer) => (
            <OfferCard
              key={`${offer.catalogProductId ?? "manual"}-${offer.preventa?.packDefinitionId ?? ""}-${offer.galeria?.albumPackId ?? ""}-${offer.title}`}
              offer={offer}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
