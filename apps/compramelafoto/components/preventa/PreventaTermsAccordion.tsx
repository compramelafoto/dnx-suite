"use client";

import { useState } from "react";
import type { PreventaTermsSectionDoc } from "@/lib/preventa-canjeable/preventa-terms-types";
import { TermsBlockView } from "./PreventaTermsModal";

/**
 * Términos colapsables en la página pública (evita muro de texto).
 * Carga el detalle solo al abrir. Retirar o simplificar cuando el producto lo defina.
 */
export default function PreventaTermsAccordion({ albumSlug }: { albumSlug: string }) {
  const [wasExpanded, setWasExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<PreventaTermsSectionDoc[] | null>(null);

  async function loadIfNeeded() {
    if (sections != null || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/album/${encodeURIComponent(albumSlug)}/preventa-terms`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudieron cargar las condiciones");
      const raw = data?.sections;
      setSections(Array.isArray(raw) ? (raw as PreventaTermsSectionDoc[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <details
      className="w-full rounded-2xl border border-[#e5e7eb] bg-white shadow-md overflow-hidden"
      onToggle={(e) => {
        const el = e.currentTarget;
        if (el.open) {
          setWasExpanded(true);
          void loadIfNeeded();
        }
      }}
    >
      <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 sm:py-4 font-semibold text-[#1a1a1a] flex items-center justify-between gap-3 hover:bg-[#fafafa] [&::-webkit-details-marker]:hidden">
        <span>Términos y condiciones</span>
        <span className="text-[#c27b3d] text-sm font-medium shrink-0">▼</span>
      </summary>
      <div className="w-full min-w-0 px-5 sm:px-6 pb-5 sm:pb-6 pt-0 border-t border-[#f3f4f6]">
        <ul className="text-sm text-[#4b5563] space-y-2 py-4 list-disc pl-5 marker:text-[#c27b3d]">
          <li>Lo que pagás ahora asegura el precio del pack de preventa.</li>
          <li>Elegís las fotos cuando el álbum esté listo para vos.</li>
          <li>Las fotos digitales se envían por email salvo que se indique otra forma.</li>
          <li>Los extras se abonan aparte si los pedís.</li>
        </ul>
        {wasExpanded && (
          <div className="rounded-xl bg-[#fafafa] border border-[#e5e7eb] p-4 max-h-[min(70vh,28rem)] overflow-y-auto">
            {loading && <p className="text-sm text-[#6b7280] py-4 text-center">Cargando detalle…</p>}
            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}
            {!loading && !error && sections && (
              <div className="space-y-8">
                {sections.map((sec) => (
                  <section key={sec.id}>
                    <h3 className="text-sm font-semibold text-[#111827] pb-2 mb-3 border-b border-gray-200">
                      {sec.title}
                    </h3>
                    <div className="space-y-4">
                      {sec.blocks.map((block, bi) => (
                        <TermsBlockView key={bi} block={block} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
