"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  salesUrl: string;
  editionName: string;
};

export function ShareEditionSalesButton({ salesUrl, editionName }: Props) {
  const [message, setMessage] = useState<string | null>(null);

  async function share() {
    setMessage(null);
    const shareData: ShareData = {
      title: editionName,
      text: `Inscribite a ${editionName}`,
      url: salesUrl,
    };

    try {
      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data: ShareData) => boolean;
      };
      if (typeof nav.share === "function" && (!nav.canShare || nav.canShare(shareData))) {
        await nav.share(shareData);
        setMessage("Enlace compartido.");
        return;
      }
    } catch (err) {
      // Usuario canceló el sheet nativo — no mostrar error.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(salesUrl);
      setMessage("Enlace de venta copiado.");
    } catch {
      setMessage("No se pudo copiar. Abrí la página y copiá la URL a mano.");
    }
  }

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <Button type="button" variant="primary" onClick={() => void share()}>
        Compartir venta
      </Button>
      <Button href={salesUrl} variant="outline" target="_blank" rel="noopener noreferrer">
        Ver página
      </Button>
      {message ? (
        <span className="basis-full text-xs text-ck-text-secondary sm:basis-auto" role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}
