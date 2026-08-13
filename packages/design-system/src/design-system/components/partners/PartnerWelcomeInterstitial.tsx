"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { PartnerAdCreative } from "./PartnerAdCreative";
import { PartnerViewableImpression } from "./PartnerViewableImpression";
import type { PartnerWelcomeResponsiveMediaInput } from "./PartnerWelcomeResponsiveMedia";
import {
  markPartnerWelcomeShown,
  readPartnerWelcomeFrequency,
  type PartnerWelcomeFrequencyStore,
} from "./welcome-frequency";

export type PartnerWelcomeAnimationVariant =
  | "fade"
  | "slide-left"
  | "slide-right"
  | "slide-up";

export type PartnerWelcomeAnimationChoice = PartnerWelcomeAnimationVariant | "random";

export type PartnerWelcomeDismissReason = "close_button" | "escape" | "programmatic";

export type PartnerWelcomeDismissEvent = {
  type: "PARTNER_WELCOME_DISMISS";
  campaignId: string;
  placementKey: string;
  creativeId?: string | null;
  reason: PartnerWelcomeDismissReason;
  occurredAt: string;
};

const ANIMATION_VARIANTS: readonly PartnerWelcomeAnimationVariant[] = [
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
];

function pickAnimation(
  choice: PartnerWelcomeAnimationChoice,
): PartnerWelcomeAnimationVariant {
  if (choice !== "random") return choice;
  const idx = Math.floor(Math.random() * ANIMATION_VARIANTS.length);
  return ANIMATION_VARIANTS[idx] ?? "fade";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export type PartnerWelcomeInterstitialProps = {
  campaignId: string;
  partnerName: string;
  imageUrl?: string | null;
  /** Snapshot responsivo desktop/mobile (prioridad sobre imageUrl). */
  media?: PartnerWelcomeResponsiveMediaInput | null;
  /** Preferir URL de tracking `/r/...` cuando exista. */
  href?: string | null;
  title?: string | null;
  body?: string | null;
  ctaText?: string | null;
  /** Horas entre apariciones locales (default 24). */
  frequencyHours?: number;
  creativeId?: string | null;
  /** Requerido para frequency key + impressions. */
  placementKey?: string | null;
  /** Espera antes de abrir (ms). Default 0. */
  appearDelayMs?: number;
  /** fade | slide-* | random. Default fade. */
  animationVariant?: PartnerWelcomeAnimationChoice;
  /** Etiqueta visible (default «Contenido patrocinado»). */
  sponsoredLabel?: string;
  /** Desactivar cap (tests). */
  disableFrequencyCap?: boolean;
  /** Store inyectable (tests). */
  frequencyStore?: PartnerWelcomeFrequencyStore | null;
  /** Callback local de cierre — sin persistencia central. */
  onDismiss?: (event: PartnerWelcomeDismissEvent) => void;
  /**
   * Preview / fixtures: `false` → cero impresiones (no depende de que falte href).
   * Default `true`.
   */
  trackingEnabled?: boolean;
  /** Preview: forzar viewport desktop|mobile. */
  previewViewport?: "desktop" | "mobile" | null;
  /** Preview: simular error de asset. */
  previewSimulateError?: "desktop" | "mobile" | "both" | null;
  /** Preview: forzar reduced motion visual. */
  previewReducedMotion?: boolean | null;
};

/**
 * Activación destacada reutilizable (Clickatón, FotoRank, InfoSpot, CLF).
 * Frequency first-party; cierre tipado; sin acoplar a InfoSpot.
 */
export function PartnerWelcomeInterstitial({
  campaignId,
  partnerName,
  imageUrl,
  media,
  href,
  title,
  body,
  ctaText,
  frequencyHours = 24,
  creativeId,
  placementKey,
  appearDelayMs = 0,
  animationVariant = "fade",
  sponsoredLabel = "Contenido patrocinado",
  disableFrequencyCap = false,
  frequencyStore,
  onDismiss,
  trackingEnabled = true,
  previewViewport = null,
  previewSimulateError = null,
  previewReducedMotion = null,
}: PartnerWelcomeInterstitialProps) {
  const titleId = useId();
  const labelId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const markedShownRef = useRef(false);

  // Variante estable por apertura (evita cambio en re-render).
  const [resolvedAnimation] = useState(() => pickAnimation(animationVariant));
  const [open, setOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const effectivePlacement = (placementKey ?? "").trim() || "UNKNOWN_PLACEMENT";

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const decision = readPartnerWelcomeFrequency({
      campaignId,
      placementKey: effectivePlacement,
      frequencyHours,
      disableFrequencyCap,
      store: frequencyStore,
    });

    if (!decision.allowed) return;

    const openNow = () => {
      if (cancelled) return;
      if (typeof document !== "undefined") {
        previousFocusRef.current =
          (document.activeElement as HTMLElement | null) ?? null;
      }
      setOpen(true);
    };

    if (appearDelayMs > 0) {
      timer = setTimeout(openNow, appearDelayMs);
    } else {
      openNow();
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    campaignId,
    effectivePlacement,
    frequencyHours,
    appearDelayMs,
    disableFrequencyCap,
    frequencyStore,
  ]);

  // Marcar vista al abrir de verdad (no al dismiss).
  useEffect(() => {
    if (!open || markedShownRef.current) return;
    markedShownRef.current = true;
    markPartnerWelcomeShown({
      campaignId,
      placementKey: effectivePlacement,
      disableFrequencyCap,
      store: frequencyStore,
    });
  }, [open, campaignId, effectivePlacement, disableFrequencyCap, frequencyStore]);

  useLayoutEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const emitDismiss = useCallback(
    (reason: PartnerWelcomeDismissReason) => {
      onDismiss?.({
        type: "PARTNER_WELCOME_DISMISS",
        campaignId,
        placementKey: effectivePlacement,
        creativeId,
        reason,
        occurredAt: new Date().toISOString(),
      });
    },
    [onDismiss, campaignId, effectivePlacement, creativeId],
  );

  const close = useCallback(
    (reason: PartnerWelcomeDismissReason) => {
      setOpen(false);
      emitDismiss(reason);
      queueMicrotask(() => {
        previousFocusRef.current?.focus?.();
      });
    },
    [emitDismiss],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close("escape");
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const list = Array.from(focusables).filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
      );
      if (list.length === 0) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  if (!open) return null;

  const motionName =
    reducedMotion || resolvedAnimation === "fade"
      ? "dnx-partner-welcome-fade"
      : resolvedAnimation === "slide-left"
        ? "dnx-partner-welcome-slide-left"
        : resolvedAnimation === "slide-right"
          ? "dnx-partner-welcome-slide-right"
          : "dnx-partner-welcome-slide-up";

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding:
      "max(1.25rem, env(safe-area-inset-top)) max(1.25rem, env(safe-area-inset-right)) max(1.25rem, env(safe-area-inset-bottom)) max(1.25rem, env(safe-area-inset-left))",
    background: "rgba(0,0,0,0.55)",
    boxSizing: "border-box",
  };

  const panelStyle: CSSProperties = {
    position: "relative",
    width: "min(100%, 28rem)",
    maxHeight: "min(85dvh, 40rem)",
    overflow: "auto",
    background: "#fff",
    color: "#111",
    borderRadius: "0.75rem",
    padding: "1.5rem",
    boxSizing: "border-box",
    animation: `${motionName} ${reducedMotion ? "1ms" : "220ms"} ease-out`,
  };

  const closeButtonStyle: CSSProperties = {
    position: "absolute",
    top: "0.75rem",
    right: "0.75rem",
    width: "2.75rem",
    height: "2.75rem",
    minWidth: "44px",
    minHeight: "44px",
    border: "1px solid #ddd",
    borderRadius: "999px",
    background: "#fff",
    cursor: "pointer",
    fontSize: "1.25rem",
    lineHeight: 1,
    zIndex: 2,
    color: "#111",
  };

  const onCloseClick = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    close("close_button");
  };

  const onCloseKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      close("close_button");
    }
  };

  const creative = (
    <PartnerAdCreative
      variant="welcome"
      partnerName={partnerName}
      imageUrl={imageUrl}
      media={media}
      href={href}
      title={title}
      body={body}
      ctaText={ctaText}
      openInNewTab
      reducedMotion={previewReducedMotion ?? reducedMotion}
      forceViewport={previewViewport}
      simulateMediaError={previewSimulateError}
    />
  );

  const bodyContent = (
    <>
      <p
        id={labelId}
        style={{
          margin: 0,
          marginBottom: "0.75rem",
          fontSize: "0.75rem",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "#666",
          textAlign: "center",
        }}
      >
        {sponsoredLabel}
      </p>
      {title ? (
        <h2
          id={titleId}
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {title}
        </h2>
      ) : (
        <h2
          id={titleId}
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {`Mensaje de ${partnerName}`}
        </h2>
      )}
      <div style={{ paddingTop: "0.5rem" }}>
        {trackingEnabled && creativeId && placementKey ? (
          <PartnerViewableImpression
            campaignId={campaignId}
            creativeId={creativeId}
            placementKey={placementKey}
            href={href ?? null}
            enabled={trackingEnabled}
          >
            {creative}
          </PartnerViewableImpression>
        ) : (
          creative
        )}
      </div>
    </>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={labelId}
      style={overlayStyle}
    >
      <div ref={panelRef} style={panelStyle}>
        <button
          ref={closeRef}
          type="button"
          onClick={onCloseClick}
          onKeyDown={onCloseKeyDown}
          aria-label="Cerrar"
          style={closeButtonStyle}
        >
          ×
        </button>
        {bodyContent}
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes dnx-partner-welcome-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes dnx-partner-welcome-slide-left {
  from { opacity: 0; transform: translateX(1.25rem); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes dnx-partner-welcome-slide-right {
  from { opacity: 0; transform: translateX(-1.25rem); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes dnx-partner-welcome-slide-up {
  from { opacity: 0; transform: translateY(1.25rem); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  [style*="dnx-partner-welcome-"] {
    animation-duration: 1ms !important;
  }
}
`,
        }}
      />
    </div>
  );
}
