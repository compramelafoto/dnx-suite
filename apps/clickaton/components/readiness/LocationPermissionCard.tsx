"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { routes } from "@/config/navigation";
import { readinessCopy } from "@/lib/readiness/content/readiness-copy";

type PermisoEstado = "sin-pedir" | "pidiendo" | "concedido" | "rechazado";

type Props = {
  registrationId: string;
  /** Consentimiento personal de ubicación de la etapa 0. Sin esto, no se pide nada. */
  locationConsentAt: Date | null;
};

/**
 * El permiso del navegador se pide una sola vez, acá, para que el navegador
 * lo recuerde para este sitio en este teléfono: si no se pide ahora, el día
 * del evento hay que interrumpir a cada participante en plena maratón.
 */
export function LocationPermissionCard({ registrationId, locationConsentAt }: Props) {
  const [estado, setEstado] = useState<PermisoEstado>("sin-pedir");
  const consentimientoDado = locationConsentAt !== null;

  useEffect(() => {
    if (!consentimientoDado) return;
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    let cancelado = false;

    // No todos los navegadores soportan `permissions.query`, y en algunos
    // lanza directamente: sin el try/catch, esta pantalla se rompería en
    // esos teléfonos.
    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (cancelado) return;
        if (status.state === "granted") setEstado("concedido");
        else if (status.state === "denied") setEstado("rechazado");
      })
      .catch(() => {
        // Sin soporte: se sigue el flujo normal de pedir el permiso.
      });

    return () => {
      cancelado = true;
    };
  }, [consentimientoDado]);

  function pedirPermiso() {
    setEstado("pidiendo");
    navigator.geolocation.getCurrentPosition(
      () => {
        // La posición obtenida se descarta a propósito: no se manda a
        // ningún lado ni se guarda. Lo único que hace falta es que quede
        // concedido el permiso del navegador para este sitio en este
        // teléfono; nada de esto es un dato de ubicación real todavía.
        setEstado("concedido");
      },
      () => {
        setEstado("rechazado");
      },
    );
  }

  const cuentaHref = `${routes.account}/inscripciones/${registrationId}`;

  return (
    <Card variant="outlined" className="space-y-3">
      <p className="ck-label text-ck-text">{readinessCopy.locationPermission.title}</p>

      {!consentimientoDado ? (
        <p className="text-sm text-ck-text-secondary">
          {readinessCopy.locationPermission.needsConsentFirst}{" "}
          <a
            href={cuentaHref}
            className="text-ck-yellow underline-offset-4 hover:underline"
          >
            {readinessCopy.locationPermission.goToAccountLabel}
          </a>
        </p>
      ) : (
        <>
          {estado === "sin-pedir" ? (
            <Button type="button" variant="secondary" onClick={pedirPermiso}>
              {readinessCopy.locationPermission.askButtonLabel}
            </Button>
          ) : null}

          {estado === "pidiendo" ? (
            <p role="status" aria-live="polite" className="text-sm text-ck-text-secondary">
              {readinessCopy.locationPermission.asking}
            </p>
          ) : null}

          {estado === "concedido" ? (
            <p role="status" aria-live="polite" className="text-sm text-ck-success">
              {readinessCopy.locationPermission.granted}
            </p>
          ) : null}

          {estado === "rechazado" ? (
            <p role="status" aria-live="polite" className="text-sm text-ck-text-secondary">
              {readinessCopy.locationPermission.denied}
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}
