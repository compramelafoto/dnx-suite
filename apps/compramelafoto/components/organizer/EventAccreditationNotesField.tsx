"use client";

import { cn } from "@/lib/utils";
import { DsInfoPanel } from "@/components/ui/DsLayout";
import Textarea from "@/components/ui/Textarea";

/** Placeholder multilinea; se muestra con saltos para guiar formato realista. */
const EVENT_ACCREDITATION_NOTES_PLACEHOLDER = [
  "Ej:",
  "- Retirar acreditación en el acceso de prensa.",
  "- Presentar DNI.",
  "- Completar formulario previo.",
  "- Ingreso permitido desde las 16:00 hs.",
  "- Se requiere chaleco de prensa y seguro personal.",
].join("\n");

export type EventAccreditationNotesFieldProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  fieldIdPrefix?: string;
  /** Filas del textarea (default 6). */
  rows?: number;
};

export default function EventAccreditationNotesField({
  value,
  onChange,
  disabled = false,
  fieldIdPrefix = "event-accreditation-notes",
  rows = 6,
}: EventAccreditationNotesFieldProps) {
  const headingId = `${fieldIdPrefix}-guidance-heading`;
  const textareaId = `${fieldIdPrefix}-textarea`;

  return (
    <section className="w-full min-w-0 ds-content-container space-y-4" aria-labelledby={headingId}>
      <DsInfoPanel
        className={cn(
          "rounded-2xl !border-amber-300/85 !bg-gradient-to-b from-amber-50 via-amber-50/95 to-amber-50/70 shadow-sm shadow-amber-900/5",
          "border-solid"
        )}
      >
        <div className="space-y-3 max-w-none">
          <h3 id={headingId} className="ds-readable-text ds-readable-text--fluid text-base font-bold text-amber-950 tracking-tight m-0 leading-snug max-w-none">
            Información importante para los fotógrafos
          </h3>
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-amber-950/95 font-medium leading-relaxed max-w-none m-0">
            El organizador debe asegurarse de que los fotógrafos acreditados puedan ingresar y trabajar correctamente
            dentro del evento.
          </p>
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-amber-950/92 leading-relaxed max-w-none m-0">
            Si el evento requiere acreditación previa, formularios, seguros, credenciales, pulseras, permisos especiales o
            cualquier requisito adicional, debe informarse claramente aquí.
          </p>
          <ul className="ds-readable-text ds-readable-text--fluid text-sm text-amber-950/95 space-y-2 m-0 pl-5 sm:pl-6 max-w-none list-[square] [word-break:normal] [&>li]:pl-0.5">
            <li>Explicá cómo se realiza el ingreso.</li>
            <li>Indicá si deben completar formularios previos.</li>
            <li>Aclarar si necesitan seguro, chaleco, pulsera o acreditación física.</li>
            <li>Informá horarios límite o accesos habilitados.</li>
            <li>Evitá que los fotógrafos lleguen al evento y no puedan trabajar.</li>
          </ul>
        </div>
      </DsInfoPanel>

      <div className="w-full min-w-0 space-y-2">
        <label htmlFor={textareaId} className="block text-sm font-semibold text-gray-800 mb-1">
          Instrucciones para acreditarse
        </label>
        <Textarea
          id={textareaId}
          className={cn(
            "rounded-xl border-gray-300/90 px-3 py-3 sm:py-3",
            "text-sm leading-relaxed",
            "placeholder:text-gray-500 placeholder:leading-relaxed",
            "focus:ring-amber-500/40 focus:border-amber-400/70",
            "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed min-h-[8.5rem]"
          )}
          rows={rows}
          value={value}
          disabled={disabled}
          placeholder={EVENT_ACCREDITATION_NOTES_PLACEHOLDER}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </section>
  );
}
