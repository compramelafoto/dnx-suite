"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { visibleDesignBlocks } from "@/lib/design-v2/render-inputs";
import { hojasAparte, isBookTemplate, paginasDelLibro } from "@/lib/design-v2/book-leaves";
import VistaPlanaDemo from "./VistaPlanaDemo";

/**
 * «Ver en 3D» del catálogo de plantillas: la plantilla terminada, como la recibiría una familia,
 * con fotos, nombres, curso, colegio, compañeros y logo de demo. Usa el mismo visor 3D que el
 * canje del librito (`Librito3DVisor`); acá sólo se arman los datos de demo y se suma el botón
 * para usar la plantilla. Lo que no se dobla (un diploma, un calendario) se ve plano.
 */

type Demo = {
  template: DesignTemplatePayload;
  values: Record<string, string>;
  /** Por blockId: la foto de demo, o la de muestra si todavía no está subida. */
  fotos: Record<string, { src: string }>;
};

const SIN_FOTOS: Record<string, { src: string }> = {};

function Cargando({ texto }: { texto: string }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50" role="status">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#f7f3ee] px-8 py-6 text-[14px] text-[#6b6f76] shadow-2xl">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e7e1da] border-t-[#c27b3d]" aria-hidden />
        {texto}
      </div>
    </div>
  );
}

/** El visor trae three.js: se carga recién cuando se abre. */
const Librito3DVisor = dynamic(() => import("@/components/canje-externo/librito-3d/Librito3DVisor"), {
  ssr: false,
  loading: () => <Cargando texto="Cargando la vista 3D…" />,
});

export default function VistaDemoPlantilla3D({
  templateId,
  nombre,
  onClose,
  onUsar,
  usando,
}: {
  templateId: string;
  nombre: string;
  onClose: () => void;
  /** Sin valor, no se muestra el botón de usar la plantilla. */
  onUsar?: () => void;
  usando?: boolean;
}) {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** El álbum de figuritas: la plancha para recortar se mira aparte, plana. */
  const [verPlancha, setVerPlancha] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/fotografo/diseno/plantillas/${encodeURIComponent(templateId)}/vista-demo`, {
      credentials: "include",
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!vivo) return;
        if (ok && d?.ok && d.template) setDemo({ template: d.template, values: d.values ?? {}, fotos: d.fotos ?? {} });
        else setError(d?.error || "No pudimos armar la vista de esta plantilla.");
      })
      .catch(() => vivo && setError("Error de red al abrir la vista 3D."));
    return () => {
      vivo = false;
    };
  }, [templateId]);

  useEffect(() => {
    if (!error) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [error, onClose]);

  const fotos = demo?.fotos ?? SIN_FOTOS;
  // Los huecos con foto de demo se ven siempre (también maestra, amigos y libre, que no son
  // huecos del cliente); el resto, como en el diseño real (sin logo, no hay recuadro de logo).
  const bloques = useMemo(() => {
    if (!demo) return [];
    const visibles = new Set(visibleDesignBlocks(demo.template.blocks, demo.values).map((b) => b.id));
    return demo.template.blocks.filter((b) => visibles.has(b.id) || demo.fotos[b.id]);
  }, [demo]);

  if (error) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
          <p className="text-sm text-[#374151]">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 min-h-11 rounded-full bg-[#1f2328] px-5 text-[15px] font-semibold text-white"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }
  if (!demo) return <Cargando texto="Preparando la plantilla…" />;

  const usar = onUsar ? (
    <button
      type="button"
      onClick={onUsar}
      disabled={usando}
      className="min-h-11 rounded-full bg-[#c27b3d] px-6 text-[15px] font-semibold text-white shadow-sm disabled:opacity-60"
    >
      {usando ? "Copiando a tus plantillas…" : "Usar y personalizar"}
    </button>
  ) : null;

  const aparte = hojasAparte(demo.template);
  if (verPlancha && aparte.length) {
    return (
      <VistaPlanaDemo
        titulo={`${nombre || demo.template.name || "Plantilla"} · Plancha de figuritas`}
        subtitulo="Se imprime aparte, en papel autoadhesivo, para recortar y pegar en el álbum"
        canvas={demo.template.canvas}
        blocks={bloques}
        values={demo.values}
        photoOverrides={fotos}
        pageCount={demo.template.pageCount}
        pageLabels={demo.template.pageLabels}
        soloPaginas={aparte}
        onClose={() => setVerPlancha(false)}
        acciones={
          <button
            type="button"
            onClick={() => setVerPlancha(false)}
            className="min-h-11 rounded-full bg-white px-5 text-[15px] font-semibold text-[#1f2328] shadow-sm"
          >
            Volver al álbum
          </button>
        }
      />
    );
  }

  if (!isBookTemplate(demo.template)) {
    return (
      <VistaPlanaDemo
        titulo={nombre || demo.template.name || "Plantilla"}
        subtitulo="Con fotos y datos de ejemplo"
        canvas={demo.template.canvas}
        blocks={bloques}
        values={demo.values}
        photoOverrides={fotos}
        pageCount={Math.max(1, demo.template.pageCount)}
        pageLabels={demo.template.pageLabels}
        onClose={onClose}
        acciones={usar}
      />
    );
  }

  return (
    <Librito3DVisor
      titulo={nombre || demo.template.name || "Plantilla"}
      subtitulo="Con fotos y datos de ejemplo · arrastrá para girarlo"
      canvas={demo.template.canvas}
      blocks={bloques}
      values={demo.values}
      photoOverrides={fotos}
      // El libro son la tapa y los interiores; la plancha de figuritas se mira con su botón.
      pageCount={Math.max(1, paginasDelLibro(demo.template))}
      giro={0}
      onClose={onClose}
      acciones={
        aparte.length ? (
          <>
            <button
              type="button"
              onClick={() => setVerPlancha(true)}
              className="min-h-11 rounded-full bg-white px-5 text-[15px] font-semibold text-[#1f2328] shadow-sm ring-1 ring-[#e7e1da]"
            >
              Ver la plancha de figuritas
            </button>
            {usar}
          </>
        ) : (
          usar
        )
      }
    />
  );
}
