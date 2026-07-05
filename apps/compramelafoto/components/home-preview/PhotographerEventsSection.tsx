"use client";

import { useState } from "react";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewProse from "@/components/home-preview/PreviewProse";
import PreviewReveal from "@/components/home-preview/PreviewReveal";
import { PreviewButtonLink, PreviewButton } from "@/components/home-preview/PreviewButton";
import {
  EventCard,
  LIST_LIMIT,
  useFilteredDiscovery,
} from "@/components/home-preview/discovery-shared";
import { usePreviewSearch } from "@/components/home-preview/PreviewSearchContext";

export default function PhotographerEventsSection() {
  const { query } = usePreviewSearch();
  const { photographerEvents, eventsLoading, error } = useFilteredDiscovery(query);
  const [expanded, setExpanded] = useState(false);

  const visible = photographerEvents.slice(0, expanded ? 12 : LIST_LIMIT);

  return (
    <PreviewSection id="eventos-fotografos" variant="default">
      <PreviewReveal>
        <PreviewProse align="start" className="mx-0 max-w-[min(100%,40rem)] mb-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#6b7280] m-0 mb-2">
            Para fotógrafos profesionales
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 tracking-tight">
            Eventos que buscan fotógrafos
          </h2>
          <p className="text-[#6b7280] text-base mt-2 mb-0 leading-relaxed">
            Coberturas abiertas o colaborativas. Separado de las galerías para compradores.
          </p>
        </PreviewProse>
      </PreviewReveal>

      {error ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-6 m-0">{error}</p>
      ) : null}

      {eventsLoading ? (
        <p className="text-center text-[#6b7280] py-10 m-0">Cargando convocatorias…</p>
      ) : visible.length === 0 ? (
        <p className="text-center text-[#6b7280] py-10 m-0">No hay convocatorias por ahora.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 m-0 p-0 list-none w-full min-w-0 mt-6">
          {visible.map((ev) => (
            <li key={`ph-${ev.id}`} className="min-w-0 flex">
              <EventCard ev={ev} mode="photographers" />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 mt-8">
        {photographerEvents.length > LIST_LIMIT ? (
          <PreviewButton type="button" variant="ghost" size="md" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Ver menos" : "Ver más convocatorias"}
          </PreviewButton>
        ) : null}
        <PreviewButtonLink href="/fotografo/registro" variant="secondary" size="md">
          Sumarme como fotógrafo
        </PreviewButtonLink>
      </div>
    </PreviewSection>
  );
}
