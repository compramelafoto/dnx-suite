"use client";

import { useMemo, useState } from "react";
import {
  PartnerWelcomeInterstitial,
  type PartnerWelcomeAnimationChoice,
  type PartnerWelcomeFrequencyStore,
  type PartnerWelcomeResponsiveMediaInput,
} from "@repo/design-system/components/partners";

export type WelcomeInterstitialAdminPreviewProps = {
  partnerName: string;
  imageUrl: string | null;
  media?: PartnerWelcomeResponsiveMediaInput | null;
  title?: string | null;
  body?: string | null;
  ctaText?: string | null;
  campaignId?: string;
};

/**
 * Preview administrativa: mismo componente de runtime, sin tracking ni frequency persistente.
 * Controles: Desktop / Mobile 390×844 / motion / reduced / error / logo fallback vía media.
 */
export function WelcomeInterstitialAdminPreview({
  partnerName,
  imageUrl,
  media = null,
  title,
  body,
  ctaText,
  campaignId = "admin-preview",
}: WelcomeInterstitialAdminPreviewProps) {
  const [open, setOpen] = useState(false);
  const [animation, setAnimation] = useState<PartnerWelcomeAnimationChoice>("fade");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [simulateError, setSimulateError] = useState<"none" | "desktop" | "mobile" | "both">(
    "none",
  );
  const [useLogoOnly, setUseLogoOnly] = useState(false);

  const memoryStore = useMemo<PartnerWelcomeFrequencyStore>(
    () => ({
      getItem: () => null,
      setItem: () => undefined,
    }),
    [],
  );

  const effectiveMedia = useMemo(() => {
    if (!media) return null;
    if (!useLogoOnly) return media;
    return {
      ...media,
      desktop: media.logoFallback,
      mobile: media.logoFallback,
      imageUrl: media.logoFallback?.imageUrl ?? media.imageUrl,
    };
  }, [media, useLogoOnly]);

  if (!imageUrl && !media?.imageUrl && !media?.desktop && !media?.mobile) {
    return (
      <p className="text-sm text-ck-text-secondary">
        Agregá un creative con asset aprobado para previsualizar la activación destacada.
      </p>
    );
  }

  const thumb =
    (viewport === "mobile"
      ? media?.mobile?.imageUrl
      : media?.desktop?.imageUrl) ||
    imageUrl ||
    media?.imageUrl ||
    media?.logoFallback?.imageUrl ||
    null;

  return (
    <div className="space-y-4 rounded-xl border border-ck-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
          Vista previa · tracking OFF · impresión 0 · frecuencia 0
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-ck-border bg-ck-surface px-2 py-1 text-sm"
            value={viewport}
            onChange={(e) => setViewport(e.target.value as "desktop" | "mobile")}
            aria-label="Viewport preview"
          >
            <option value="desktop">Escritorio</option>
            <option value="mobile">Celular 390×844</option>
          </select>
          <select
            className="rounded-md border border-ck-border bg-ck-surface px-2 py-1 text-sm"
            value={animation}
            onChange={(e) => setAnimation(e.target.value as PartnerWelcomeAnimationChoice)}
            aria-label="Animación preview"
          >
            <option value="fade">fade</option>
            <option value="slide-left">slide-left</option>
            <option value="slide-right">slide-right</option>
            <option value="slide-up">slide-up</option>
            <option value="random">random</option>
          </select>
          <select
            className="rounded-md border border-ck-border bg-ck-surface px-2 py-1 text-sm"
            value={simulateError}
            onChange={(e) =>
              setSimulateError(e.target.value as "none" | "desktop" | "mobile" | "both")
            }
            aria-label="Simular error de asset"
          >
            <option value="none">Sin error</option>
            <option value="desktop">Error desktop</option>
            <option value="mobile">Error mobile</option>
            <option value="both">Error ambos</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-ck-text-secondary">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
            />
            Reduced motion
          </label>
          <label className="flex items-center gap-2 text-xs text-ck-text-secondary">
            <input
              type="checkbox"
              checked={useLogoOnly}
              onChange={(e) => setUseLogoOnly(e.target.checked)}
            />
            Usar logo
          </label>
          <button
            type="button"
            className="rounded-md bg-[#D4AF37] px-3 py-1.5 text-sm font-semibold text-[#111]"
            onClick={() => setOpen(true)}
          >
            Abrir preview
          </button>
        </div>
      </div>

      <div
        className={
          viewport === "mobile"
            ? "mx-auto w-full max-w-[390px] rounded-xl border border-dashed border-ck-border p-2"
            : "w-full rounded-xl border border-dashed border-ck-border p-2"
        }
        style={viewport === "mobile" ? { minHeight: "12rem" } : undefined}
      >
        <p className="mb-2 text-center text-xs text-ck-text-secondary">
          Marco {viewport}
          {viewport === "mobile" ? " · 390×844" : ""}. Abrí el modal real con «Abrir preview».
        </p>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={title || `Preview ${partnerName}`}
            className="mx-auto max-h-48 object-contain"
          />
        ) : null}
      </div>

      {open ? (
        <PartnerWelcomeInterstitial
          key={`${campaignId}-${animation}-${reducedMotion}-${viewport}-${simulateError}-${useLogoOnly}`}
          campaignId={campaignId}
          partnerName={partnerName}
          imageUrl={imageUrl}
          media={effectiveMedia}
          href={null}
          title={title}
          body={body}
          ctaText={ctaText}
          creativeId="admin-preview-creative"
          placementKey="INFOSPOT_HOME_WELCOME"
          appearDelayMs={0}
          animationVariant={reducedMotion ? "fade" : animation}
          frequencyHours={24}
          disableFrequencyCap
          frequencyStore={memoryStore}
          trackingEnabled={false}
          previewViewport={viewport}
          previewReducedMotion={reducedMotion}
          previewSimulateError={simulateError === "none" ? null : simulateError}
          sponsoredLabel="Vista previa · Contenido patrocinado"
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
