"use client";

import { locationConsentCopy } from "@/lib/broadcast-consent/content/location-consent-copy";

/**
 * Los tres consentimientos de ubicación, como los guarda el dominio:
 * `personal` habilita el recorrido privado, `publicMap` expone la posición
 * en el mapa público y en vivo (incluye la declaración de mayoría de edad,
 * ya redactada dentro de su propio texto), e `interview` habilita el
 * contacto del equipo de transmisión.
 */
export interface LocationConsentValues {
  personal: boolean;
  publicMap: boolean;
  interview: boolean;
}

interface LocationConsentCheckboxesProps {
  /** Estado actual de las tres casillas. El componente no guarda estado propio. */
  values: LocationConsentValues;
  /**
   * Se llama con el próximo estado completo cada vez que el participante
   * toca una casilla. Ya viene con la regla aplicada: si `personal` pasa a
   * false, `publicMap` viene en false también.
   */
  onChange: (next: LocationConsentValues) => void;
}

/**
 * Las tres casillas de consentimiento de ubicación, con el texto legal y la
 * regla de pantalla ("desmarcar la primera apaga la segunda") en un único
 * lugar. La usan tanto el formulario público de inscripción como el panel
 * de Mi cuenta, para que el texto y la regla nunca diverjan entre los dos.
 *
 * No sabe nada de formularios, acciones de servidor ni guardado: sólo
 * dibuja el estado que recibe y avisa los cambios.
 */
export function LocationConsentCheckboxes({ values, onChange }: LocationConsentCheckboxesProps) {
  return (
    <div className="space-y-3 text-sm" data-legal-review="location-consent-checkboxes">
      <label className="flex gap-3">
        <input
          type="checkbox"
          checked={values.personal}
          onChange={(e) => {
            const personal = e.target.checked;
            onChange({
              personal,
              // Desmarcar la primera apaga la segunda: sin recorrido personal
              // no hay mapa público, igual que lo exige el dominio del lado del servidor.
              publicMap: personal ? values.publicMap : false,
              interview: values.interview,
            });
          }}
          className="mt-1 size-5 shrink-0"
        />
        <span>{locationConsentCopy.personal}</span>
      </label>

      <label className="flex gap-3">
        <input
          type="checkbox"
          checked={values.publicMap}
          disabled={!values.personal}
          onChange={(e) => onChange({ ...values, publicMap: e.target.checked })}
          className="mt-1 size-5 shrink-0"
        />
        <span className="flex flex-col gap-1">
          <span className={values.personal ? undefined : "opacity-50"}>
            {locationConsentCopy.publicMap}
          </span>
          {!values.personal ? (
            <span className="text-xs text-ck-text-muted">
              {locationConsentCopy.publicMapDisabledHint}
            </span>
          ) : null}
        </span>
      </label>

      <label className="flex gap-3">
        <input
          type="checkbox"
          checked={values.interview}
          onChange={(e) => onChange({ ...values, interview: e.target.checked })}
          className="mt-1 size-5 shrink-0"
        />
        <span>{locationConsentCopy.interview}</span>
      </label>

      <p className="text-sm text-ck-text-muted">{locationConsentCopy.revokeNote}</p>
    </div>
  );
}
