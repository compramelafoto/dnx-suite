"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

function buildQrUrl(url: string) {
  const encoded = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encoded}`;
}

export default function EventAlbumShareBlock({
  shareUrl,
  title,
  description,
  qrLabel,
}: {
  shareUrl: string;
  title: string;
  description: string;
  qrLabel: string;
}) {
  const [copiedAlbumId, setCopiedAlbumId] = useState<number | null>(null);

  return (
    <div className="rounded-lg bg-white border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 min-w-0 text-xs bg-white px-3 py-2 rounded-lg border border-gray-200 truncate">
          {shareUrl}
        </code>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(shareUrl).then(() => {
              setCopiedAlbumId(0);
              setTimeout(() => setCopiedAlbumId(null), 2000);
            });
          }}
        >
          {copiedAlbumId === 0 ? "Copiado" : "Copiar link"}
        </Button>
      </div>
      <div className="flex flex-col sm:flex-row items-start gap-4 mt-4">
        <img
          src={buildQrUrl(shareUrl)}
          alt="QR del evento"
          className="w-[200px] h-[200px] rounded-lg border border-gray-200 bg-white"
        />
        <div className="text-sm text-gray-500">
          <p className="mb-2">{qrLabel}</p>
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
