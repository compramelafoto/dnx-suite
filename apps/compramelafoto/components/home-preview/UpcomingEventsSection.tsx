"use client";

import { useState } from "react";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewProse from "@/components/home-preview/PreviewProse";
import PreviewReveal from "@/components/home-preview/PreviewReveal";
import { PreviewButton } from "@/components/home-preview/PreviewButton";
import {
  EventCard,
  LIST_LIMIT,
  useFilteredDiscovery,
} from "@/components/home-preview/discovery-shared";
import { usePreviewSearch } from "@/components/home-preview/PreviewSearchContext";

export default function UpcomingEventsSection() {
  const { query } = usePreviewSearch();
  const { upcomingEvents, eventsLoading, error } = useFilteredDiscovery(query);
  const [expanded, setExpanded] = useState(false);

  const visible = upcomingEvents.slice(0, expanded ? 12 : LIST_LIMIT);

  return (
    <PreviewSection id="proximos-eventos" variant="default">
      <PreviewReveal>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 min-w-0">
          <PreviewProse align="start" className="mx-0 max-w-[min(100%,40rem)]">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#9a6b47] m-0 mb-2">Eventos</p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 tracking-tight">
              Próximos eventos
            </h2>
            <p className="text-[#6b7280] text-base mt-2 mb-0 leading-relaxed">
              Descubrí eventos publicados en la plataforma.
            </p>
          </PreviewProse>
        </div>
      </PreviewReveal>

      {error ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 m-0">{error}</p>
      ) : null}

      {eventsLoading ? (
        <p className="text-center text-[#6b7280] py-10 m-0">Cargando eventos…</p>
      ) : visible.length === 0 ? (
        <p className="text-center text-[#6b7280] py-10 m-0">No hay eventos próximos por ahora.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 m-0 p-0 list-none w-full min-w-0">
          {visible.map((ev) => (
            <li key={ev.id} className="min-w-0 flex">
              <EventCard ev={ev} mode="upcoming" />
            </li>
          ))}
        </ul>
      )}

      {upcomingEvents.length > LIST_LIMIT ? (
        <div className="flex justify-center mt-8">
          <PreviewButton type="button" variant="ghost" size="md" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Ver menos" : "Ver todos los eventos"}
          </PreviewButton>
        </div>
      ) : null}
    </PreviewSection>
  );
}
