"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** ≥50% visible */
const VIEWABILITY_RATIO = 0.5;
/** ≥1s continuo */
const VIEWABILITY_MS = 1000;

const firedLogicalKeys = new Set<string>();

function logicalViewKey(input: {
  campaignId: string;
  creativeId: string;
  placementKey: string;
}): string {
  return `${input.campaignId}:${input.creativeId}:${input.placementKey}`;
}

function extractTrackingKeyFromHref(href: string | null | undefined): string | null {
  if (!href?.trim()) return null;
  try {
    const path = href.startsWith("http") ? new URL(href).pathname : href;
    const m = path.match(/\/r\/([^/?#]+)/);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function sessionDedupeKey(logicalKey: string): string {
  return `dnx-partner-imp:${logicalKey}`;
}

function alreadyFired(logicalKey: string): boolean {
  if (firedLogicalKeys.has(logicalKey)) return true;
  try {
    if (typeof sessionStorage !== "undefined") {
      if (sessionStorage.getItem(sessionDedupeKey(logicalKey))) {
        firedLogicalKeys.add(logicalKey);
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

function markFired(logicalKey: string) {
  firedLogicalKeys.add(logicalKey);
  try {
    sessionStorage?.setItem(sessionDedupeKey(logicalKey), "1");
  } catch {
    // ignore
  }
}

export type PartnerViewableImpressionProps = {
  campaignId: string;
  creativeId: string;
  placementKey: string;
  /**
   * Si apunta a `/r/[trackingKey]`, se envía trackingKey (asocia outbound).
   * No es requisito para registrar impresión.
   */
  href?: string | null;
  /** Endpoint first-party, default /api/public/partners/impression */
  endpoint?: string;
  children: ReactNode;
  className?: string;
  /**
   * Solo observar nodos canónicos (marquee loop copy 0).
   * Preview / fixtures: `enabled={false}` → cero métricas.
   */
  enabled?: boolean;
};

/**
 * Cuenta una impresión cuando el creative está ≥50% visible ≥1s.
 * Dedup por campaign+creative+placement en la sesión de página.
 * Soft-fail: nunca rompe el render.
 * Independiente del clic / outbound (href opcional).
 * Sin dependencia de @repo/partners (constantes alineadas con dominio).
 */
export function PartnerViewableImpression({
  campaignId,
  creativeId,
  placementKey,
  href,
  endpoint = "/api/public/partners/impression",
  children,
  className,
  enabled = true,
}: PartnerViewableImpressionProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      return;
    }
    const el = ref.current;
    if (!el) return;

    const logicalKey = logicalViewKey({
      campaignId,
      creativeId,
      placementKey,
    });
    if (alreadyFired(logicalKey)) return;

    const trackingKey = extractTrackingKeyFromHref(href);

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const fire = () => {
      if (alreadyFired(logicalKey)) return;
      markFired(logicalKey);
      const payload: Record<string, string> = {
        creativeId,
        campaignId,
        placementKey,
        viewSessionKey: logicalKey.slice(0, 64),
      };
      if (trackingKey) payload.trackingKey = trackingKey;
      const body = JSON.stringify(payload);
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: "application/json" });
          navigator.sendBeacon(endpoint, blob);
        } else {
          void fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            keepalive: true,
          }).catch(() => undefined);
        }
      } catch {
        // soft-fail
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= VIEWABILITY_RATIO) {
          if (!timerRef.current) {
            timerRef.current = setTimeout(() => {
              timerRef.current = null;
              fire();
              observer.disconnect();
            }, VIEWABILITY_MS);
          }
        } else {
          clearTimer();
        }
      },
      { threshold: [0, VIEWABILITY_RATIO, 1] },
    );

    observer.observe(el);
    return () => {
      clearTimer();
      observer.disconnect();
    };
  }, [campaignId, creativeId, placementKey, href, endpoint, enabled]);

  return (
    <div ref={ref} className={className} data-partner-impression-root="1">
      {children}
    </div>
  );
}
