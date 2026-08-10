"use client";

import { useEffect, useState } from "react";
import { PartnerAdCreative } from "./PartnerAdCreative";

const STORAGE_PREFIX = "dnx_partner_welcome_";

export type PartnerWelcomeInterstitialProps = {
  campaignId: string;
  partnerName: string;
  imageUrl?: string | null;
  href?: string | null;
  title?: string | null;
  body?: string | null;
  ctaText?: string | null;
  /** Horas entre impresiones locales (default 24). */
  frequencyHours?: number;
};

function storageKey(campaignId: string) {
  return `${STORAGE_PREFIX}${campaignId}`;
}

/**
 * Welcome controlado: cerrar explícito, frequency cap first-party (localStorage),
 * no fingerprint. No bloquea navegación si storage falla.
 */
export function PartnerWelcomeInterstitial({
  campaignId,
  partnerName,
  imageUrl,
  href,
  title,
  body,
  ctaText,
  frequencyHours = 24,
}: PartnerWelcomeInterstitialProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(campaignId));
      if (raw) {
        const ts = Number(raw);
        if (Number.isFinite(ts)) {
          const elapsedH = (Date.now() - ts) / (1000 * 60 * 60);
          if (elapsedH < frequencyHours) return;
        }
      }
      setOpen(true);
    } catch {
      // session-only fallback
      setOpen(true);
    }
  }, [campaignId, frequencyHours]);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(storageKey(campaignId), String(Date.now()));
    } catch {
      // ignore
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || `Mensaje de ${partnerName}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: "rgba(0,0,0,0.55)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(100%, 28rem)",
          maxHeight: "90dvh",
          overflow: "auto",
          background: "#fff",
          color: "#111",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar"
          style={{
            position: "absolute",
            top: "0.75rem",
            right: "0.75rem",
            width: "2.75rem",
            height: "2.75rem",
            border: "1px solid #ddd",
            borderRadius: "999px",
            background: "#fff",
            cursor: "pointer",
            fontSize: "1.25rem",
            lineHeight: 1,
          }}
        >
          ×
        </button>
        <div style={{ paddingTop: "1.5rem" }}>
          <PartnerAdCreative
            variant="welcome"
            partnerName={partnerName}
            imageUrl={imageUrl}
            href={href}
            title={title}
            body={body}
            ctaText={ctaText}
          />
        </div>
      </div>
    </div>
  );
}
