"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

function buildQrUrl(url: string) {
  const encoded = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encoded}`;
}

export default function GalleryShareCard({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
      <h3 className="text-base font-semibold text-gray-900">Link público de la galería</h3>
      <p className="text-sm text-gray-500">
        Este es el link único para compartir la galería del evento.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 min-w-0 text-xs bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 truncate">
          {shareUrl}
        </code>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(shareUrl).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? "Copiado" : "Copiar link"}
        </Button>
      </div>
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <img
          src={buildQrUrl(shareUrl)}
          alt="QR de la galería"
          className="w-[180px] h-[180px] rounded-lg border border-gray-200 bg-white"
        />
        <div className="text-sm text-gray-500">
          <p className="mb-2">Escaneá o descargá este QR para compartir la galería.</p>
          <a
            href={buildQrUrl(shareUrl)}
            className="text-blue-600 hover:text-blue-700 text-xs"
            target="_blank"
            rel="noreferrer"
          >
            Descargar QR
          </a>
        </div>
      </div>
    </div>
  );
}
