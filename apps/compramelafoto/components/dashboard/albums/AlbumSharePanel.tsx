"use client";

import { useCallback, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  buildAlbumQrImageUrl,
  buildAlbumShareLinks,
  resolveAlbumPrimaryShareUrl,
  type AlbumShareLinkItem,
} from "@/lib/albums/album-share-url";

export type AlbumSharePanelProps = {
  albumId: number;
  publicSlug: string;
  eventShareSlug?: string | null;
  photographerHandler?: string | null;
  mode?: "SIMPLE" | "EVENT" | "SCHOOL" | "COLLABORATIVE";
  primaryShareUrl?: string;
  title?: string;
  description?: string;
  variant?: "compact" | "full";
  includeExtraLinks?: boolean;
  embedded?: boolean;
  className?: string;
  /** Bloquea copiar enlace / QR cuando la venta no está lista. */
  disabled?: boolean;
};

function ShareLinkRow({ link }: { link: AlbumShareLinkItem }) {
  const qrUrl = buildAlbumQrImageUrl(link.url);

  return (
    <div className="w-full min-w-0 rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="mx-auto sm:mx-0 shrink-0 w-[9rem] h-[9rem] sm:w-36 sm:h-36 rounded-lg border border-[#e5e7eb] bg-white p-2 flex items-center justify-center">
        <img
          src={qrUrl}
          alt={`QR ${link.label}`}
          className="w-full h-full object-contain"
          width={144}
          height={144}
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#1a1a1a] m-0">{link.label}</p>
          {link.description ? (
            <p className="ds-readable-text ds-readable-text--sm text-[#6b7280] mt-0.5 m-0">
              {link.description}
            </p>
          ) : null}
          <p className="ds-readable-text text-xs text-[#6b7280] mt-1 m-0 font-mono break-all">
            {link.path}
          </p>
        </div>
        <div className="ds-empty-state__actions !mt-0 !max-w-none items-stretch sm:items-start sm:flex-row sm:flex-wrap">
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="ds-empty-state__cta">
            <Button type="button" variant="secondary" size="md" className="w-full sm:w-auto whitespace-nowrap">
              Abrir
            </Button>
          </a>
          <a href={qrUrl} download={`qr-${link.id}.png`} className="ds-empty-state__cta">
            <Button type="button" variant="secondary" size="md" className="w-full sm:w-auto whitespace-nowrap">
              Descargar QR
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AlbumSharePanel({
  albumId,
  publicSlug,
  eventShareSlug,
  photographerHandler,
  mode,
  primaryShareUrl: primaryShareUrlProp,
  title = "Compartir álbum",
  description,
  variant = "compact",
  includeExtraLinks = false,
  embedded = false,
  className = "",
  disabled = false,
}: AlbumSharePanelProps) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const primaryShareUrl = useMemo(() => {
    if (primaryShareUrlProp?.trim()) return primaryShareUrlProp.trim();
    return resolveAlbumPrimaryShareUrl({
      origin,
      publicSlug,
      eventShareSlug,
      photographerHandler,
      albumId,
      mode,
    });
  }, [
    primaryShareUrlProp,
    origin,
    publicSlug,
    eventShareSlug,
    photographerHandler,
    albumId,
    mode,
  ]);

  const links = useMemo(
    () =>
      buildAlbumShareLinks(
        { origin, publicSlug, eventShareSlug, photographerHandler, albumId, mode },
        { includePhotographer: includeExtraLinks, includeBuy: includeExtraLinks }
      ),
    [origin, publicSlug, eventShareSlug, photographerHandler, albumId, mode, includeExtraLinks]
  );

  const defaultDescription =
    eventShareSlug?.trim()
      ? "Copiá el enlace de la galería del evento o abrilo en una pestaña nueva."
      : "Copiá el enlace del álbum o abrilo en una pestaña nueva para ver la vista del cliente.";

  const copyPrimary = useCallback(async () => {
    if (disabled || !primaryShareUrl || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(primaryShareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [disabled, primaryShareUrl]);

  const primaryQrUrl = primaryShareUrl ? buildAlbumQrImageUrl(primaryShareUrl) : "";

  const body = (
    <div className="ds-stack-section w-full min-w-0 gap-4">
      {!embedded ? (
        <div className="ds-content-container w-full min-w-0 space-y-1">
          <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">{title}</h2>
          <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#6b7280] m-0">
            {description ?? defaultDescription}
          </p>
        </div>
      ) : description ? (
        <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#6b7280] m-0">
          {description}
        </p>
      ) : null}

      {primaryShareUrl ? (
        <div
          className={`w-full min-w-0 space-y-4 ${disabled ? "pointer-events-none opacity-50" : ""}`}
          aria-disabled={disabled || undefined}
        >
          <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:gap-5">
            <div className="mx-auto lg:mx-0 shrink-0 w-[min(100%,12rem)] aspect-square rounded-xl border border-[#e5e7eb] bg-white p-2 flex items-center justify-center">
              <img
                src={primaryQrUrl}
                alt="QR enlace principal"
                className="w-full h-full object-contain max-w-[180px] max-h-[180px]"
                width={180}
                height={180}
              />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  type="text"
                  value={primaryShareUrl}
                  readOnly
                  disabled={disabled}
                  className="w-full !min-w-0 flex-1 font-mono text-xs sm:text-sm"
                  aria-label="Enlace para compartir"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto shrink-0 whitespace-nowrap"
                  disabled={disabled}
                  onClick={() => void copyPrimary()}
                >
                  {copied ? "✓ Copiado" : "Copiar enlace"}
                </Button>
              </div>
              <div className="ds-empty-state__actions !mt-0 !max-w-none flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center">
                <a
                  href={disabled ? undefined : primaryShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ds-empty-state__cta"
                  aria-disabled={disabled || undefined}
                  tabIndex={disabled ? -1 : undefined}
                >
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="w-full sm:w-auto whitespace-nowrap"
                    disabled={disabled}
                  >
                    Ver galería pública
                  </Button>
                </a>
                <a
                  href={disabled ? undefined : primaryQrUrl}
                  download={disabled ? undefined : "qr-album.png"}
                  className="ds-empty-state__cta"
                  aria-disabled={disabled || undefined}
                  tabIndex={disabled ? -1 : undefined}
                >
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="w-full sm:w-auto whitespace-nowrap"
                    disabled={disabled}
                  >
                    Descargar QR
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="ds-readable-text ds-readable-text--sm text-[#6b7280] m-0">
          Todavía no hay un enlace público disponible para este álbum.
        </p>
      )}

      {variant === "full" && links.length > 0 ? (
        <div className="w-full min-w-0 space-y-3 pt-2 border-t border-[#e5e7eb]">
          <p className="text-sm font-medium text-[#1a1a1a] m-0">Otros enlaces y QR</p>
          <div className="grid w-full min-w-0 gap-4">
            {links
              .filter((l) => l.url !== primaryShareUrl)
              .map((link) => (
                <ShareLinkRow key={link.id} link={link} />
              ))}
          </div>
        </div>
      ) : null}

      {variant === "compact" && links.length > 0 ? (
        <ul className="m-0 flex w-full min-w-0 flex-col gap-2 p-0 list-none pt-1">
          {links
            .filter((l) => l.url !== primaryShareUrl)
            .map((link) => (
              <li
                key={link.id}
                className="flex w-full min-w-0 flex-col gap-2 rounded-lg border border-[#e5e7eb] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1a1a1a] m-0">{link.label}</p>
                  <p className="ds-readable-text text-xs text-[#6b7280] m-0 mt-0.5 font-mono truncate">
                    {link.path}
                  </p>
                </div>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="ds-empty-state__cta shrink-0">
                  <Button type="button" variant="secondary" size="md" className="w-full sm:w-auto whitespace-nowrap">
                    Abrir
                  </Button>
                </a>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );

  if (embedded) {
    return <div className={`w-full min-w-0 ${className}`}>{body}</div>;
  }

  return (
    <Card className={`ds-fill-width w-full min-w-0 p-5 sm:p-6 ${className}`}>{body}</Card>
  );
}
