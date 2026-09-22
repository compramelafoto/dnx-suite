"use client";

import { useState, useTransition } from "react";

import { updateLocationConsentAction } from "@/lib/broadcast-consent/actions/update-location-consent";
import { Card } from "@/components/ui/Card";

import {
  LocationConsentCheckboxes,
  type LocationConsentValues,
} from "./LocationConsentCheckboxes";

interface LocationConsentPanelProps {
  registrationId: string;
  locationConsentAt: Date | null;
  locationPublicConsentAt: Date | null;
  interviewConsentAt: Date | null;
}

/**
 * Panel de Mi cuenta para dar o revocar los consentimientos de ubicación de
 * una inscripción ya existente. Recupera a quienes se inscribieron antes de
 * que estas casillas existieran.
 *
 * El texto legal y la regla de cascada ("desmarcar la primera apaga la
 * segunda") viven en `LocationConsentCheckboxes`, no acá: este panel sólo
 * aporta el estado, el botón de guardar y el mensaje de resultado.
 *
 * Después de guardar, las casillas se sincronizan con lo que la acción
 * dice que quedó en la base (`result.values`), no con lo que el
 * participante tildó: el dominio puede denegar en silencio (un menor nunca
 * queda con el mapa público activo, aunque lo haya pedido), y esta pantalla
 * no puede mostrar otorgado un permiso que en realidad no se otorgó.
 */
export function LocationConsentPanel({
  registrationId,
  locationConsentAt,
  locationPublicConsentAt,
  interviewConsentAt,
}: LocationConsentPanelProps) {
  const [values, setValues] = useState<LocationConsentValues>({
    personal: locationConsentAt !== null,
    publicMap: locationPublicConsentAt !== null,
    interview: interviewConsentAt !== null,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [pending, startTransition] = useTransition();

  function guardar() {
    const fd = new FormData();
    fd.set("registrationId", registrationId);
    if (values.personal) fd.set("locationConsent", "true");
    if (values.publicMap) {
      fd.set("locationPublicConsent", "true");
      // La casilla del mapa público incluye la declaración de mayoría de
      // edad en su propio texto: marcarla es declararla.
      fd.set("locationDeclaredAdult", "true");
    }
    if (values.interview) fd.set("interviewConsent", "true");

    startTransition(async () => {
      try {
        const result = await updateLocationConsentAction(fd);
        // La pantalla refleja lo que efectivamente quedó guardado, no lo
        // que se tildó: el dominio puede denegar en silencio (por ejemplo,
        // el mapa público si sos menor), y acá no se reimplementa esa regla.
        if (result.ok && result.values) setValues(result.values);
        setMessage(
          result.ok
            ? (result.message ?? "Guardado.")
            : (result.message ?? "No se pudo guardar."),
        );
        setMessageIsError(!result.ok);
      } catch {
        setMessage("No se pudo guardar. Probá de nuevo.");
        setMessageIsError(true);
      }
    });
  }

  return (
    <Card variant="outlined" className="space-y-4">
      <h2 className="font-semibold">Tu recorrido y la transmisión en vivo</h2>

      <LocationConsentCheckboxes values={values} onChange={setValues} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="rounded-md border border-ck-border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {message ? (
          <span
            role="status"
            aria-live="polite"
            className={`text-sm ${messageIsError ? "text-ck-danger" : "text-ck-success"}`}
          >
            {message}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
