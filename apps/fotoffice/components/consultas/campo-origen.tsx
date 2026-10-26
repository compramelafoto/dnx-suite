import type { CSSProperties } from "react";

/** Un origen de consulta tal como llega al navegador: sólo id y nombre. */
export type OrigenDelFormulario = { id: string; nombre: string };

/**
 * «¿Cómo nos conociste?»: los orígenes activos del workspace (Configuración → Consultas). Es
 * opcional y manda `origenId`; el servidor sólo lo acepta si es un origen activo del workspace
 * (`origenDelFormulario`). Sin orígenes cargados no se dibuja. Lo usan los tres formularios
 * públicos: el general, el de XV/boda y el del sitio.
 */
export function CampoOrigen({
  id,
  origenes,
  disabled = false,
  labelClassName = "fo-label",
  labelStyle,
}: {
  id: string;
  origenes: readonly OrigenDelFormulario[];
  disabled?: boolean;
  /** El formulario del sitio usa la tipografía del sitio en lugar de la de FOTOFFICE. */
  labelClassName?: string;
  labelStyle?: CSSProperties;
}) {
  if (origenes.length === 0) return null;
  return (
    <div className="fo-field-stack">
      <label className={labelClassName || undefined} style={labelStyle} htmlFor={id}>
        ¿Cómo nos conociste?
      </label>
      <select id={id} name="origenId" className="fo-input" defaultValue="" disabled={disabled}>
        <option value="">Elegí una opción (opcional)</option>
        {origenes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
