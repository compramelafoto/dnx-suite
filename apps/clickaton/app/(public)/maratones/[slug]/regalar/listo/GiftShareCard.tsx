"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function GiftShareCard(props: {
  code: string;
  link: string;
  editionName: string;
  recipientEmailSent: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const whatsappText = `¡Te regalo tu lugar en ${props.editionName}! 🎉\n\nActivalo acá y cargá tus datos: ${props.link}\n\nCódigo: ${props.code}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(props.link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sin permiso de portapapeles: el link igual está visible para copiar a mano.
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--ck-radius-control)] border border-ck-yellow bg-ck-surface p-6 text-center">
        <p className="ck-label text-ck-text-secondary">Código del regalo</p>
        <p className="mt-2 font-mono text-2xl font-bold tracking-widest md:text-3xl">
          {props.code}
        </p>
      </div>

      <div>
        <label htmlFor="gift-link" className="ck-label text-ck-text">
          Link para activarlo
        </label>
        <input
          id="gift-link"
          readOnly
          value={props.link}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-sm"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button href={whatsappHref} target="_blank" rel="noopener noreferrer">
          Enviar por WhatsApp
        </Button>
        <Button type="button" variant="secondary" onClick={copyLink}>
          {copied ? "¡Link copiado!" : "Copiar link"}
        </Button>
      </div>

      <p className="text-sm text-ck-text-secondary" role="status">
        {props.recipientEmailSent
          ? "También se lo mandamos por email a tu amigo."
          : "Mandale vos el link: con eso alcanza para que active su lugar."}
      </p>
    </div>
  );
}
