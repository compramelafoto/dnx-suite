"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import { DsInfoPanel } from "@/components/ui/DsLayout";
import type { OrganizerDiscoveryPhotographer } from "@/lib/organizer-community-discovery";

function DiscoveryCard({ p, showEvents }: { p: OrganizerDiscoveryPhotographer; showEvents?: boolean }) {
  return (
    <Card className="p-4 flex flex-col ds-card min-w-0 h-full">
      <div className="w-full h-20 bg-gray-50 rounded-xl flex items-center justify-center mb-3 overflow-hidden border border-gray-100">
        {p.logoUrl ? (
          <img src={p.logoUrl} alt="" className="max-h-16 max-w-full object-contain p-2" loading="lazy" />
        ) : (
          <span className="text-2xl text-gray-300" aria-hidden>
            📷
          </span>
        )}
      </div>
      <h3 className="font-semibold text-gray-900 m-0 text-sm line-clamp-2">{p.name}</h3>
      {p.city ? <p className="text-xs text-gray-500 m-0 mt-1 line-clamp-2">{p.city}</p> : null}
      {showEvents && p.eventsWithOrganizer > 0 ? (
        <p className="text-xs text-gray-600 m-0 mt-2 font-medium">
          {p.eventsWithOrganizer} {p.eventsWithOrganizer === 1 ? "evento contigo" : "eventos contigo"}
        </p>
      ) : null}
      {p.distanceKm != null ? (
        <p className="text-xs text-gray-500 m-0 mt-1">~{p.distanceKm} km</p>
      ) : null}
      {p.profileUrl ? (
        <Link
          href={p.profileUrl}
          className="mt-auto pt-3 text-sm font-medium text-[#c27b3d] hover:underline"
        >
          Ver perfil →
        </Link>
      ) : null}
    </Card>
  );
}

function DiscoveryGrid({
  title,
  description,
  items,
  showEvents,
  empty,
}: {
  title: string;
  description?: string;
  items: OrganizerDiscoveryPhotographer[];
  showEvents?: boolean;
  empty?: string;
}) {
  if (items.length === 0) {
    return empty ? <p className="text-sm text-gray-500 m-0">{empty}</p> : null;
  }
  return (
    <section className="space-y-4 min-w-0">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-gray-900 m-0">{title}</h2>
        {description ? (
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-600 m-0 mt-1">{description}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((p) => (
          <DiscoveryCard key={`${title}-${p.userId}`} p={p} showEvents={showEvents} />
        ))}
      </div>
    </section>
  );
}

export default function OrganizerCommunityDiscoveryPanel({
  data,
  loading,
  error,
}: {
  data: {
    workedWith: OrganizerDiscoveryPhotographer[];
    nearby: OrganizerDiscoveryPhotographer[];
    suggested: OrganizerDiscoveryPhotographer[];
    platformActive: OrganizerDiscoveryPhotographer[];
  } | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return <p className="text-gray-600 text-sm m-0">Cargando fotógrafos…</p>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const hasDiscovery =
    data.nearby.length > 0 || data.suggested.length > 0 || data.platformActive.length > 0;

  return (
    <div className="ds-stack-section min-w-0">
      <DsInfoPanel title="Uso privado">
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-700 m-0">
          Estas listas son para planificar convocatorias. No se muestran en tu página pública: allí solo
          aparecen fotógrafos que ya participaron en tus eventos.
        </p>
      </DsInfoPanel>

      <DiscoveryGrid
        title="Ya trabajaron en tus eventos"
        description="Referencia rápida de fotógrafos con participación confirmada."
        items={data.workedWith}
        showEvents
        empty="Todavía no hay fotógrafos vinculados a tus eventos."
      />

      {hasDiscovery ? (
        <>
          <DiscoveryGrid
            title="Fotógrafos cercanos"
            description="Disponibles en la plataforma, ordenados por proximidad a tu ubicación o últimos eventos."
            items={data.nearby}
          />
          <DiscoveryGrid
            title="Sugeridos en tu zona"
            description="Perfiles activos que coinciden con tu ciudad o provincia."
            items={data.suggested}
          />
          <DiscoveryGrid
            title="Fotógrafos activos en la plataforma"
            description="Otros profesionales publicados para futuras convocatorias."
            items={data.platformActive}
          />
        </>
      ) : (
        <p className="text-sm text-gray-500 m-0">
          No encontramos más fotógrafos para sugerir fuera de los que ya trabajaron contigo.
        </p>
      )}

      <p className="text-sm m-0">
        <Link href="/directorio/fotografos" className="text-[#c27b3d] font-medium hover:underline">
          Ver directorio completo de fotógrafos →
        </Link>
      </p>
    </div>
  );
}
