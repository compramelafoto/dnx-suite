"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  buildSurveyShareMessage,
  buildWhatsappShareUrl,
} from "@/lib/testimonials/public/survey-share";

type Props = {
  editionName: string;
  url: string;
};

export function SurveyShareLinks({ editionName, url }: Props) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  async function copy(value: string, which: "link" | "message") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2500);
    } catch {
      // Sin permiso de portapapeles el enlace igual está a la vista para
      // seleccionarlo a mano: no se deja al admin sin salida.
      setCopied(null);
    }
  }

  const whatsapp = buildWhatsappShareUrl({ editionName, url });

  return (
    <div className="space-y-2 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-3">
      <p className="text-xs uppercase tracking-[0.08em] text-ck-text-muted">
        Compartir la encuesta
      </p>

      <p className="break-all font-mono text-xs text-ck-text-secondary">{url}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => copy(url, "link")}
        >
          {copied === "link" ? "¡Copiado!" : "Copiar enlace"}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            copy(buildSurveyShareMessage({ editionName, url }), "message")
          }
        >
          {copied === "message" ? "¡Copiado!" : "Copiar mensaje armado"}
        </Button>

        <Button
          href={whatsapp}
          size="sm"
          variant="secondary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Compartir por WhatsApp
        </Button>
      </div>

      <p className="text-xs text-ck-text-muted">
        Quien lo abra sin haber participado va a ver que la encuesta es sólo
        para quienes estuvieron. Se puede pegar tranquilo en la comunidad.
      </p>
    </div>
  );
}
