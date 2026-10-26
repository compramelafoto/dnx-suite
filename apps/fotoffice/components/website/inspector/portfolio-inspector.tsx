"use client";

import { useEffect, useState } from "react";
import { websiteTrabajoCategoriasAction } from "@/app/actions/website";
import type { PortfolioBlockConfig } from "@/lib/website/blocks";
import { SelectField, TextField, ToggleField } from "./inspector-fields";

/**
 * Inspector del bloque "Trabajos". Las categorías se piden una vez al abrirlo (sólo lectura): el
 * constructor no tiene la base a mano. Sin categoría elegida se muestran trabajos de todas.
 */
export function PortfolioInspector({ config, onChange }: { config: PortfolioBlockConfig; onChange: (c: PortfolioBlockConfig) => void }) {
  const [categorias, setCategorias] = useState<Array<{ id: string; nombre: string }> | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    websiteTrabajoCategoriasAction()
      .then((r) => vivo && setCategorias(r))
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
    };
  }, []);

  // Una categoría elegida que después se ocultó o se borró sigue en la lista, para que se vea.
  const opciones = [
    { value: "", label: "Todas las categorías" },
    ...(categorias ?? []).map((c) => ({ value: c.id, label: c.nombre })),
    ...(config.categoriaId && categorias && !categorias.some((c) => c.id === config.categoriaId)
      ? [{ value: config.categoriaId, label: "Categoría oculta o borrada" }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <TextField label="Título" value={config.title ?? ""} onChange={(v) => onChange({ ...config, title: v })} />
      <SelectField
        label="Categoría"
        value={config.categoriaId ?? ""}
        onChange={(v) => onChange({ ...config, categoriaId: v || undefined })}
        options={opciones}
      />
      {fallo ? <p className="text-xs text-red-600">No se pudieron leer las categorías. Probá de nuevo más tarde.</p> : null}
      <SelectField
        label="Cuántos trabajos"
        value={String(config.count)}
        onChange={(v) => onChange({ ...config, count: v === "3" ? 3 : v === "9" ? 9 : v === "12" ? 12 : 6 })}
        options={[
          { value: "3", label: "3 trabajos" },
          { value: "6", label: "6 trabajos" },
          { value: "9", label: "9 trabajos" },
          { value: "12", label: "12 trabajos" },
        ]}
      />
      <SelectField
        label="Disposición"
        value={config.layout}
        onChange={(v) => onChange({ ...config, layout: v === "masonry" ? "masonry" : "grid" })}
        options={[
          { value: "grid", label: "Grilla (todas del mismo tamaño)" },
          { value: "masonry", label: "Mosaico (respeta la forma de cada portada)" },
        ]}
      />
      <ToggleField label="Mostrar «Ver todos los trabajos»" checked={config.showViewAll} onChange={(v) => onChange({ ...config, showViewAll: v })} />
      <p className="text-xs text-[var(--fo-muted)]">
        Se muestran solos los últimos trabajos publicados. Si todavía no hay ninguno, la sección no aparece en el sitio.
      </p>
    </div>
  );
}
