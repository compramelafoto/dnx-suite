"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

type Props = {
  url: string;
  accentColor?: string;
};

export default function LabPublicShare({ url, accentColor }: Props) {
  const [copied, setCopied] = useState(false);

  const qrUrl = useMemo(() => {
    const encoded = encodeURIComponent(url);
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encoded}`;
  }, [url]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error copiando URL:", err);
    }
  }

  return (
    <Card className="p-6 md:p-8 border-2" style={{ borderColor: accentColor ? `${accentColor}4D` : undefined }}>
      <div className="flex flex-col md:flex-row gap-6 items-center">
        <div className="flex-1 space-y-3">
          <h3 className="text-lg font-semibold text-[#1a1a1a]">Compartí esta página</h3>
          <p className="text-sm text-[#6b7280]">
            Copiá el enlace o descargá el QR para compartirlo en cualquier diseño.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="secondary"
              onClick={handleCopy}
              className="text-sm"
            >
              {copied ? "✅ URL copiada" : "Copiar URL"}
            </Button>
            <a href={qrUrl} download="qr-laboratorio.png">
              <Button
                variant="primary"
                className="text-sm"
                accentColor={accentColor}
                style={accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
              >
                Descargar QR
              </Button>
            </a>
          </div>
          <p className="text-xs text-[#9ca3af] break-all">{url}</p>
        </div>
        <div className="w-[200px] h-[200px] shrink-0 rounded-lg border border-[#e5e7eb] bg-white flex items-center justify-center">
          <img src={qrUrl} alt="QR para compartir" className="w-[180px] h-[180px]" />
        </div>
      </div>
    </Card>
  );
}
