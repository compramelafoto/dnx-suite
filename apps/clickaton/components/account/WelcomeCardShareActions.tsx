"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  downloadUrl: string;
  previewUrl: string;
  filenameHint: string;
};

function sanitizeFilename(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function WelcomeCardShareActions({
  downloadUrl,
  previewUrl,
  filenameHint,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(previewUrl, { credentials: "same-origin" });
      if (!res.ok) throw new Error("fetch_failed");
      const blob = await res.blob();
      const filename = `clickaton-bienvenida-${sanitizeFilename(filenameHint)}.png`;
      const file = new File([blob], filename, { type: blob.type || "image/png" });

      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data: ShareData) => boolean;
      };

      if (typeof nav.share === "function") {
        const data: ShareData = {
          title: "Mi placa Clickatón",
          text: "Compartí tu placa de bienvenida Clickatón",
          files: [file],
        };
        if (!nav.canShare || nav.canShare(data)) {
          await nav.share(data);
          setMessage("Listo — compartiste tu placa.");
          return;
        }
      }

      // Fallback desktop / unsupported share: trigger download
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage("Tu navegador no soporta compartir archivos. Descargamos la placa para que la subas vos.");
    } catch {
      setMessage("No se pudo compartir. Probá Descargar y subila a tus historias.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button href={downloadUrl} variant="primary" className="min-h-11 w-full sm:w-auto">
          Descargar mi placa
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 w-full sm:w-auto"
          disabled={busy}
          onClick={() => void share()}
        >
          {busy ? "Compartiendo…" : "Compartir"}
        </Button>
      </div>
      {message ? (
        <p className="text-xs text-ck-text-secondary" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
