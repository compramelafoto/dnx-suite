"use client";

import { useCallback, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export type AlbumInstructivosPanelProps = {
  albumId: number;
  publicSlug: string;
  /** Bloquea compartir cuando la venta todavía no está lista. */
  disabled?: boolean;
};

export default function AlbumInstructivosPanel({
  albumId,
  publicSlug,
  disabled = false,
}: AlbumInstructivosPanelProps) {
  const [copiado, setCopiado] = useState(false);

  const instructivoUrl = useMemo(() => {
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://compramelafoto.com";
    return `${base}/a/${publicSlug}/instructivo`;
  }, [publicSlug]);

  const pdfUrl = `/api/a/${publicSlug}/instructivo/pdf`;

  const copiar = useCallback(async () => {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(instructivoUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }, [disabled, instructivoUrl]);

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `Te paso el instructivo para encontrar y comprar tus fotos: ${instructivoUrl}`
  )}`;

  return (
    <div className="ds-stack-section w-full min-w-0 gap-5">
      <Card className="ds-fill-width w-full min-w-0 border border-[#e5e7eb] p-4 sm:p-5">
        <div className="space-y-1">
          <h3 className="m-0 text-base font-semibold text-[#1a1a1a]">
            Instructivo para tus clientes
          </h3>
          <p className="ds-readable-text ds-readable-text--fluid m-0 text-sm text-[#6b7280]">
            Se arma solo con la configuración de este álbum: el tipo de galería, cómo se
            buscan las fotos, si hay preventa y cómo se entregan. Lleva tu logo, tus datos y
            el QR del álbum. Si cambiás la configuración, el instructivo cambia solo.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            readOnly
            value={instructivoUrl}
            aria-label="Enlace del instructivo"
            className="min-w-0 flex-1"
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="secondary" size="md" onClick={copiar} disabled={disabled}>
              {copiado ? "Copiado" : "Copiar enlace"}
            </Button>
            <a
              href={disabled ? undefined : whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={disabled}
            >
              <Button type="button" variant="secondary" size="md" disabled={disabled}>
                WhatsApp
              </Button>
            </a>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <a href={instructivoUrl} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="primary" size="md">
              Ver instructivo
            </Button>
          </a>
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="secondary" size="md">
              Descargar PDF
            </Button>
          </a>
        </div>
      </Card>

      <Card className="ds-fill-width w-full min-w-0 border border-[#e5e7eb] p-4 sm:p-5">
        <div className="space-y-1">
          <h3 className="m-0 text-base font-semibold text-[#1a1a1a]">Para imprimir</h3>
          <p className="ds-readable-text ds-readable-text--fluid m-0 text-sm text-[#6b7280]">
            El cartel con el QR grande para colgar en el evento, y la hoja de tarjetas para
            repartir en mano.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`/api/dashboard/albums/${albumId}/instructivo/cartel?size=a4`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button type="button" variant="secondary" size="md">
              Cartel A4
            </Button>
          </a>
          <a
            href={`/api/dashboard/albums/${albumId}/instructivo/cartel?size=a5`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button type="button" variant="secondary" size="md">
              Cartel A5
            </Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
