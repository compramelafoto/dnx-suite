"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";

function buildQrUrl(url: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(url)}`;
}

type Props = {
  url: string;
  primaryColor?: string | null;
};

export default function OrganizerPublicLandingShare({ url, primaryColor }: Props) {
  const [copied, setCopied] = useState(false);
  const qrUrl = useMemo(() => buildQrUrl(url), [url]);
  const accent = primaryColor?.trim() || "#c27b3d";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-4 sm:p-5 w-full min-w-0">
      <h3 className="text-sm font-semibold text-gray-900 m-0 mb-1">Compartir tu página</h3>
      <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-600 m-0 mb-4">
        Copiá el enlace o descargá el QR para redes, WhatsApp o material impreso.
      </p>

      <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">
        <div className="flex-1 min-w-0 w-full space-y-3">
          <code className="block w-full min-w-0 text-xs sm:text-sm bg-white px-3 py-2.5 rounded-lg border border-gray-200 break-all text-gray-800">
            {url}
          </code>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void handleCopy()}
              className="whitespace-nowrap"
            >
              {copied ? "Link copiado" : "Copiar link"}
            </Button>
            <a href={qrUrl} download="qr-pagina-organizador.png" className="inline-flex">
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="whitespace-nowrap w-full sm:w-auto"
                style={{ backgroundColor: accent, borderColor: accent }}
              >
                Descargar QR
              </Button>
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex sm:ml-auto"
            >
              <Button type="button" variant="outline" size="sm" className="whitespace-nowrap w-full sm:w-auto">
                Ver página
              </Button>
            </a>
          </div>
        </div>

        <div className="shrink-0 mx-auto lg:mx-0 rounded-lg border border-gray-200 bg-white p-2">
          <img
            src={qrUrl}
            alt="QR de tu página pública"
            className="block w-[160px] h-[160px] sm:w-[180px] sm:h-[180px]"
            width={180}
            height={180}
          />
        </div>
      </div>
    </div>
  );
}
