"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { visibleDesignBlocks } from "@/lib/design-v2/render-inputs";
import { paginasDelLibro } from "@/lib/design-v2/book-leaves";
import { modeloDelLibrito, pasosDelLibrito } from "@/components/canje-externo/librito-3d/modelo-librito";

type Demo = {
  template: DesignTemplatePayload;
  values: Record<string, string>;
  fotos: Record<string, { src: string }>;
};

function Esperando({ texto }: { texto: string }) {
  return (
    <div className="grid h-full place-items-center" role="status">
      <div className="flex flex-col items-center gap-3 text-[15px] text-slate-500">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#e7e1da] border-t-[#c27b3d]" aria-hidden />
        {texto}
      </div>
    </div>
  );
}

/** El visor trae three.js: se carga recién cuando aparece la placa. */
const Librito3DVisor = dynamic(() => import("@/components/canje-externo/librito-3d/Librito3DVisor"), {
  ssr: false,
  loading: () => <Esperando texto="Cargando la vista 3D…" />,
});

/**
 * El librito real en 3D, el mismo visor que ve la familia en el canje, con una plantilla del
 * sistema y los datos de demo del catálogo («Ver en 3D»). La presentación decide qué cara se ve
 * (`paso`) y se entera de cuántas hay (`onPasos`).
 */
export default function Librito3DEnVivo({
  templateId,
  paso,
  onPasos,
}: {
  templateId: string;
  paso: number;
  onPasos: (pasos: string[]) => void;
}) {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/fotografo/diseno/plantillas/${encodeURIComponent(templateId)}/vista-demo`, { credentials: "include" })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!vivo) return;
        if (ok && d?.ok && d.template) setDemo({ template: d.template, values: d.values ?? {}, fotos: d.fotos ?? {} });
        else setError(d?.error || "No pudimos armar el librito.");
      })
      .catch(() => vivo && setError("Error de red al abrir el librito."));
    return () => {
      vivo = false;
    };
  }, [templateId]);

  const paginas = demo ? Math.max(1, paginasDelLibro(demo.template)) : 1;
  const pasos = useMemo(() => {
    if (!demo) return null;
    const c = demo.template.canvas;
    return pasosDelLibrito(modeloDelLibrito(Number(c.width) || 1, Number(c.height) || 1, paginas));
  }, [demo, paginas]);
  useEffect(() => {
    if (pasos) onPasos(pasos);
  }, [pasos, onPasos]);

  const bloques = useMemo(() => {
    if (!demo) return [];
    const visibles = new Set(visibleDesignBlocks(demo.template.blocks, demo.values).map((b) => b.id));
    return demo.template.blocks.filter((b) => visibles.has(b.id) || demo.fotos[b.id]);
  }, [demo]);

  if (error) return <p className="grid h-full place-items-center text-center text-slate-500">{error}</p>;
  if (!demo) return <Esperando texto="Preparando el librito…" />;

  return (
    <Librito3DVisor
      titulo={demo.template.name || "Librito"}
      canvas={demo.template.canvas}
      blocks={bloques}
      values={demo.values}
      photoOverrides={demo.fotos}
      pageCount={paginas}
      giro={0}
      onClose={() => {}}
      incrustado
      pasoExterno={paso}
    />
  );
}
