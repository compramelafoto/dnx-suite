"use client";

import { useEffect, useId, useState } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type CameraGpsSystem = "iphone" | "android";

const SYSTEM_LABEL: Record<CameraGpsSystem, string> = {
  iphone: "iPhone",
  android: "Android",
};

const SYSTEM_ORDER: CameraGpsSystem[] = ["iphone", "android"];

const SYSTEM_STEPS: Record<CameraGpsSystem, string[]> = {
  iphone: [
    "Entrá a Ajustes → Privacidad y seguridad → Localización.",
    'Buscá Cámara en la lista de apps y elegí "Al usar la app".',
    "Después, en Ajustes → Cámara, revisá Formatos: que no esté puesto en un modo que descarte la ubicación de la foto.",
  ],
  android: [
    "Entrá a los ajustes de la app Cámara (mantené el dedo sobre su ícono y elegí Información de la app, o andá a Ajustes → Apps → Cámara).",
    "Buscá Ubicación o Etiquetas de ubicación, dentro de esos ajustes, y activala.",
    "Revisá también que la Cámara tenga permiso de Ubicación en los ajustes generales del teléfono.",
  ],
};

/**
 * Sólo para preseleccionar una pestaña: la detección falla seguido (por
 * ejemplo, alguien mirando desde la computadora para ayudar a otra persona
 * por teléfono), así que las dos pestañas quedan accesibles siempre.
 */
function detectSystem(): CameraGpsSystem {
  if (typeof navigator === "undefined") return "iphone";
  return /android/i.test(navigator.userAgent) ? "android" : "iphone";
}

export function CameraGpsInstructions({ className }: { className?: string }) {
  const baseId = useId();
  const [system, setSystem] = useState<CameraGpsSystem>("iphone");

  useEffect(() => {
    setSystem(detectSystem());
  }, []);

  return (
    <Card variant="outlined" className={cn("space-y-4", className)}>
      <p className="ck-label text-ck-text">Activar la ubicación de la cámara</p>

      <div role="tablist" aria-label="Sistema del teléfono" className="flex gap-2">
        {SYSTEM_ORDER.map((option) => {
          const isSelected = option === system;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              id={`${baseId}-tab-${option}`}
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${option}`}
              onClick={() => setSystem(option)}
              className={cn(
                "ck-button-label rounded-[var(--ck-radius-control)] border-2 px-4 py-2 transition-colors",
                isSelected
                  ? "border-ck-yellow bg-ck-yellow text-[var(--ck-text-on-brand)]"
                  : "border-ck-border bg-transparent text-ck-text-secondary hover:border-ck-yellow/60 hover:text-ck-yellow",
              )}
            >
              {SYSTEM_LABEL[option]}
            </button>
          );
        })}
      </div>

      {SYSTEM_ORDER.map((option) => (
        <div
          key={option}
          role="tabpanel"
          id={`${baseId}-panel-${option}`}
          aria-labelledby={`${baseId}-tab-${option}`}
          hidden={option !== system}
        >
          <ol className="ck-body-sm list-decimal space-y-2 pl-5">
            {SYSTEM_STEPS[option].map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      ))}

      <p className="ck-caption text-ck-text-muted">
        Los nombres exactos cambian según la marca, el modelo y la versión de tu teléfono. Lo
        que importa es una sola cosa: que la Cámara tenga permiso para usar tu ubicación.
      </p>
    </Card>
  );
}
