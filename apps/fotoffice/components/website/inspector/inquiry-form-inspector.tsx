"use client";

import { useEffect, useState } from "react";
import { websiteInquiryCategoriesAction, type WebsiteInquiryCategoriesState } from "@/app/actions/website";
import type { InquiryFormBlockConfig } from "@/lib/website/blocks";
import { TextAreaField, TextField, ToggleField } from "./inspector-fields";

/**
 * Inspector del formulario de presupuesto. Las categorías se piden una vez al abrirlo (sólo
 * lectura): el constructor no tiene la base a mano. Ninguna marcada = se ofrecen todas, y las que
 * se agreguen después en Configuración aparecen solas.
 */
export function InquiryFormInspector({ config, onChange }: { config: InquiryFormBlockConfig; onChange: (c: InquiryFormBlockConfig) => void }) {
  const [opciones, setOpciones] = useState<WebsiteInquiryCategoriesState | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    websiteInquiryCategoriesAction()
      .then((r) => vivo && setOpciones(r))
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
    };
  }, []);

  const elegidas = new Set(config.categoryIds);
  const alternar = (id: string) => {
    const proximas = elegidas.has(id) ? config.categoryIds.filter((c) => c !== id) : [...config.categoryIds, id];
    onChange({ ...config, categoryIds: proximas });
  };

  return (
    <div className="space-y-4">
      {opciones && !opciones.consultasEncendido ? (
        <p className="text-xs text-red-600">Consultas está apagado: este formulario no se va a mostrar en el sitio hasta que lo enciendas.</p>
      ) : null}
      <TextField label="Título (opcional)" value={config.title ?? ""} onChange={(v) => onChange({ ...config, title: v })} />
      <TextAreaField label="Texto de presentación (opcional)" value={config.intro ?? ""} onChange={(v) => onChange({ ...config, intro: v })} rows={3} />

      <div className="space-y-2">
        <span className="fo-label">Categorías que se ofrecen</span>
        {fallo ? <p className="text-xs text-red-600">No se pudieron leer las categorías. Probá de nuevo más tarde.</p> : null}
        {!opciones && !fallo ? <p className="text-xs text-[var(--fo-muted)]">Cargando categorías…</p> : null}
        {opciones?.categorias.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={elegidas.has(c.id)} onChange={() => alternar(c.id)} />
            {c.nombre}
          </label>
        ))}
        <p className="text-xs text-[var(--fo-muted)]">Si no marcás ninguna, se ofrecen todas las categorías activas de Consultas.</p>
      </div>

      <ToggleField label="Preguntar «¿Cómo nos conociste?»" checked={config.askOrigin} onChange={(v) => onChange({ ...config, askOrigin: v })} />
      <ToggleField label="Preguntar la fecha del evento" checked={config.askEventDate} onChange={(v) => onChange({ ...config, askEventDate: v })} />
      <ToggleField label="Preguntar el lugar" checked={config.askEventLocation} onChange={(v) => onChange({ ...config, askEventLocation: v })} />
      <TextField label="Texto del botón" value={config.buttonLabel} onChange={(v) => onChange({ ...config, buttonLabel: v })} />
      <TextAreaField label="Mensaje de agradecimiento" value={config.thanksMessage} onChange={(v) => onChange({ ...config, thanksMessage: v })} rows={2} />
      <p className="text-xs text-[var(--fo-muted)]">Cada consulta entra sola a Consultas, con su categoría, y recibe la respuesta automática si la tenés configurada.</p>
    </div>
  );
}
