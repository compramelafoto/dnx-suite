import { PartnerWelcomeInterstitial } from "@repo/design-system/components/partners";
import type { CSSProperties } from "react";

type Platform = "clickaton" | "fotorank" | "infospot" | "clf";

const params = new URLSearchParams(window.location.search);
const platform = (params.get("platform") || "clickaton") as Platform;
const animation = (params.get("animation") || "fade") as
  | "fade"
  | "slide-left"
  | "slide-right"
  | "slide-up";

const BACKGROUNDS: Record<Platform, { label: string; file: string; tint: string }> = {
  clickaton: {
    label: "Clickatón · landing de evento",
    file: "/backgrounds/bg-clickaton.jpg",
    tint: "linear-gradient(180deg,#050505ee,#111827cc)",
  },
  fotorank: {
    label: "FotoRank · concurso public-ui",
    file: "/backgrounds/bg-fotorank.jpg",
    tint: "linear-gradient(180deg,#050505f0,#141414cc)",
  },
  infospot: {
    label: "InfoSpot · portada",
    file: "/backgrounds/bg-infospot.jpg",
    tint: "linear-gradient(180deg,#0b1220ee,#1e293bcc)",
  },
  clf: {
    label: "ComprameLaFoto · álbum público",
    file: "/backgrounds/bg-clf.jpg",
    tint: "linear-gradient(180deg,#f7f5f2ee,#e7e2dccc)",
  },
};

const shell: CSSProperties = {
  minHeight: "100dvh",
  margin: 0,
  backgroundImage: `${BACKGROUNDS[platform].tint}, url(${BACKGROUNDS[platform].file})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  fontFamily: 'DM Sans, system-ui, sans-serif',
};

const badge: CSSProperties = {
  position: "fixed",
  left: 16,
  bottom: 16,
  zIndex: 90,
  background: "rgba(0,0,0,0.7)",
  color: "#fff",
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 12,
  letterSpacing: "0.02em",
};

/**
 * Harness local-only: componente real, tracking OFF (sin href/creativeId),
 * frequency cap deshabilitado, delay 0 para captura estable.
 */
export function App() {
  const bg = BACKGROUNDS[platform];
  return (
    <div style={shell} data-visual-harness="sponsor-welcome" data-platform={platform}>
      <div style={badge} data-harness-badge="true">
        FIXTURE LOCAL · {bg.label} · tracking OFF · no campaña real
      </div>
      <PartnerWelcomeInterstitial
        campaignId={`synthetic-visual-${platform}`}
        partnerName="Sponsor de ejemplo"
        imageUrl="/sponsor-ejemplo.svg"
        title="Sponsor de ejemplo"
        body="Acompañando la fotografía y la cultura."
        ctaText="Conocer la marca"
        sponsoredLabel="Contenido patrocinado"
        placementKey={`VISUAL_${platform.toUpperCase()}_WELCOME`}
        appearDelayMs={0}
        animationVariant={animation}
        disableFrequencyCap
        // Sin href / creativeId ⇒ no PartnerViewableImpression ni navegación real
      />
    </div>
  );
}
