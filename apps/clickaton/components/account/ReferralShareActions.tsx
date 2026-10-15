"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  buildReferralShareMessage,
  buildReferralWhatsappUrl,
} from "@/lib/referrals/ui/referral-share";

type Props = { link: string };

export function ReferralShareActions({ link }: Props) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  async function copy(value: string, which: "link" | "message") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2500);
    } catch {
      // Sin permiso de portapapeles el link igual está a la vista para
      // seleccionarlo a mano: no se deja a nadie sin salida.
      setCopied(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="primary" onClick={() => copy(link, "link")}>
        {copied === "link" ? "¡Copiado!" : "Copiar mi link"}
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => copy(buildReferralShareMessage({ link }), "message")}
      >
        {copied === "message" ? "¡Copiado!" : "Copiar invitación armada"}
      </Button>

      <Button
        href={buildReferralWhatsappUrl({ link })}
        size="sm"
        variant="outline"
        target="_blank"
        rel="noopener noreferrer"
      >
        Compartir por WhatsApp
      </Button>
    </div>
  );
}
