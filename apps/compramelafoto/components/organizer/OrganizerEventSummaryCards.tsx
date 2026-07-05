"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { publicEventGalleryPath, publicEventJoinPath } from "@/lib/public-site-url";

export type ConfirmedPhotographerRow = {
  id: number;
  userId: number;
  name: string | null;
  email: string;
  phone?: string | null;
  whatsapp?: string | null;
  status: string;
  createdAt: string;
  termsAcceptedAt?: string | null;
};

type OrganizerEventSummaryCardsProps = {
  origin: string;
  shareSlug: string | null;
  albumsCount: number;
  membersCount: number;
  inviting: boolean;
  generatingShare: boolean;
  confirmedPhotographers: ConfirmedPhotographerRow[];
  onInvite: () => void;
  onGenerateShareLink: () => void;
};

function CopyableLinkRow({
  url,
  copyLabel = "Copiar link",
}: {
  url: string;
  copyLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full min-w-0">
      <code
        className="flex-1 min-w-0 w-full max-w-full text-sm bg-gray-100 px-3 py-2 rounded-lg break-words whitespace-normal overflow-wrap-break-word"
        style={{ overflowWrap: "break-word", wordBreak: "normal" }}
      >
        {url}
      </code>
      <Button
        variant="secondary"
        size="sm"
        className="shrink-0 self-start sm:self-auto whitespace-normal"
        onClick={() => {
          navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
      >
        {copied ? "Copiado" : copyLabel}
      </Button>
    </div>
  );
}

function QrBlock({
  url,
  alt,
  downloadFilename,
}: {
  url: string;
  alt: string;
  downloadFilename: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { width: 180, margin: 2 })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [url]);

  async function handleDownload() {
    try {
      const dataUrl = qrDataUrl ?? (await QRCode.toDataURL(url, { width: 256, margin: 2 }));
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = downloadFilename;
      a.click();
    } catch (err) {
      console.error("Error generando QR:", err);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-start gap-4 w-full min-w-0">
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt={alt}
          className="w-[160px] h-[160px] rounded-lg border border-gray-200 bg-white shrink-0"
        />
      ) : (
        <div className="w-[160px] h-[160px] rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-500 shrink-0">
          Generando QR…
        </div>
      )}
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-500 m-0">
          Escaneá o descargá el código para compartir por WhatsApp o redes.
        </p>
        <Button variant="secondary" size="sm" className="self-start whitespace-normal" onClick={() => void handleDownload()}>
          Descargar QR
        </Button>
      </div>
    </div>
  );
}

function formatDt(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default function OrganizerEventSummaryCards({
  origin,
  shareSlug,
  albumsCount,
  membersCount,
  inviting,
  generatingShare,
  confirmedPhotographers,
  onInvite,
  onGenerateShareLink,
}: OrganizerEventSummaryCardsProps) {
  const galleryUrl = shareSlug ? `${origin}${publicEventGalleryPath(shareSlug)}` : null;
  const joinUrl = shareSlug ? `${origin}${publicEventJoinPath(shareSlug)}` : null;

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 w-full min-w-0">
        <div className="min-w-0 flex-1">
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-500 m-0">
            Compartí la galería con clientes e invitá fotógrafos cercanos. Las invitaciones por cercanía respetan el radio configurado en el perfil de cada fotógrafo.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={onInvite}
          disabled={inviting}
          className="whitespace-normal shrink-0 self-start sm:self-auto max-w-full"
        >
          {inviting ? "Enviando…" : "Invitar fotógrafos cercanos"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700 w-full min-w-0">
        <Card className="p-4 min-w-0 w-full max-w-full">
          <p className="m-0 font-semibold text-[#64748b] text-xs uppercase">Álbumes</p>
          <p className="m-0 mt-1 text-2xl font-bold text-[#111827] tabular-nums">{albumsCount}</p>
        </Card>
        <Card className="p-4 min-w-0 w-full max-w-full">
          <p className="m-0 font-semibold text-[#64748b] text-xs uppercase">Fotógrafos vinculados</p>
          <p className="m-0 mt-1 text-2xl font-bold text-[#111827] tabular-nums">{membersCount}</p>
        </Card>
      </div>

      <Card className="p-6 w-full min-w-0 max-w-full">
        <h2 className="text-lg font-semibold text-gray-900 mb-1 m-0">Galería pública</h2>
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-500 mb-4 m-0">
          Link para clientes: abre la galería colaborativa del evento para ver y comprar fotos.
        </p>
        {galleryUrl ? (
          <div className="flex flex-col gap-4 w-full min-w-0">
            <CopyableLinkRow url={galleryUrl} />
            <QrBlock
              url={galleryUrl}
              alt="QR de la galería para clientes"
              downloadFilename={`compramelafoto-galeria-${shareSlug}.png`}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-500 m-0">
              Todavía no hay link público. Generalo para compartir la galería.
            </p>
            <Button type="button" variant="secondary" disabled={generatingShare} onClick={onGenerateShareLink}>
              {generatingShare ? "Generando…" : "Generar link público"}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-6 w-full min-w-0 max-w-full">
        <h2 className="text-lg font-semibold text-gray-900 mb-1 m-0">Invitación a fotógrafos</h2>
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-500 mb-4 m-0">
          Compartí este link para que los fotógrafos se inscriban al evento. También podés usar el botón de arriba para enviar un email automático a quienes estén dentro de su radio de cobertura.
        </p>
        {joinUrl ? (
          <CopyableLinkRow url={joinUrl} copyLabel="Copiar link de invitación" />
        ) : (
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-500 m-0">
            Generá el link público del evento para obtener el enlace de invitación a fotógrafos.
          </p>
        )}
      </Card>

      {joinUrl ? (
        <Card className="p-6 w-full min-w-0 max-w-full">
          <h2 className="text-lg font-semibold text-gray-900 mb-1 m-0">QR para fotógrafos</h2>
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-500 mb-4 m-0">
            Código QR del link de inscripción para fotógrafos.
          </p>
          <QrBlock
            url={joinUrl}
            alt="QR de invitación para fotógrafos"
            downloadFilename={`compramelafoto-invitacion-fotografos-${shareSlug}.png`}
          />
        </Card>
      ) : null}

      <Card className="p-6 w-full min-w-0 max-w-full">
        <h2 className="text-lg font-semibold text-gray-900 mb-1 m-0">Fotógrafos confirmados</h2>
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-500 mb-4 m-0">
          Fotógrafos con participación activa en el evento.
        </p>
        {confirmedPhotographers.length === 0 ? (
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-500 m-0">
            Todavía no hay fotógrafos confirmados.
          </p>
        ) : (
          <ul className="space-y-3 w-full min-w-0">
            {confirmedPhotographers.map((m) => {
              const contactPhone = m.whatsapp || m.phone;
              return (
                <li
                  key={m.id}
                  className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4 border border-gray-100 w-full min-w-0 max-w-full"
                >
                  <div className="min-w-0 w-full">
                    <p className="font-medium text-gray-900 m-0 break-words whitespace-normal" style={{ overflowWrap: "break-word" }}>
                      {m.name || m.email}
                    </p>
                    <p className="text-sm text-gray-600 m-0 mt-1 break-words whitespace-normal" style={{ overflowWrap: "break-word" }}>
                      {m.email}
                    </p>
                    {contactPhone ? (
                      <p className="text-sm text-gray-600 m-0 mt-1 break-words whitespace-normal">
                        {m.whatsapp ? `WhatsApp: ${m.whatsapp}` : `Teléfono: ${m.phone}`}
                      </p>
                    ) : null}
                    <p className="text-xs text-gray-500 m-0 mt-2">
                      Estado: Confirmado
                      {m.termsAcceptedAt || m.createdAt
                        ? ` · ${formatDt(m.termsAcceptedAt ?? m.createdAt)}`
                        : ""}
                    </p>
                  </div>
                  {contactPhone ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="whitespace-normal"
                        onClick={() => {
                          const digits = contactPhone.replace(/\D/g, "");
                          const wa = m.whatsapp ? digits : digits;
                          if (wa) window.open(`https://wa.me/${wa}`, "_blank", "noopener,noreferrer");
                        }}
                      >
                        Contactar
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
