import {
  PartnerAdCreative,
  PartnerLogoMarquee,
  PartnerWelcomeInterstitial,
} from "@repo/design-system/components/partners";
import type { CSSProperties } from "react";
import { BRANDS, brandBySlug } from "./brands";

type Platform = "clickaton" | "fotorank" | "infospot" | "clf";
type Piece = "welcome" | "banner" | "marquee";

const params = new URLSearchParams(window.location.search);
const platform = (params.get("platform") || "clickaton") as Platform;
const piece = (params.get("piece") || "welcome") as Piece;
const brand = brandBySlug(params.get("brand"));
const animation = (params.get("animation") || "fade") as
  | "fade"
  | "slide-left"
  | "slide-right"
  | "slide-up";
const showBadge = params.get("badge") !== "0";
const density = (params.get("density") || "featured") as "featured" | "default";

const BACKGROUNDS: Record<
  Platform,
  { label: string; file: string; tint: string; surface: "dark" | "light" }
> = {
  clickaton: {
    label: "Clickatón · landing de evento",
    file: "/backgrounds/bg-clickaton.jpg",
    tint: "linear-gradient(180deg,#050505ee,#111827cc)",
    surface: "dark",
  },
  fotorank: {
    label: "FotoRank · concurso público",
    file: "/backgrounds/bg-fotorank.jpg",
    tint: "linear-gradient(180deg,#050505f0,#141414cc)",
    surface: "dark",
  },
  infospot: {
    label: "InfoSpot · portada",
    file: "/backgrounds/bg-infospot.jpg",
    tint: "linear-gradient(180deg,#0b1220ee,#1e293bcc)",
    surface: "dark",
  },
  clf: {
    label: "ComprameLaFoto · álbum público",
    file: "/backgrounds/bg-clf.jpg",
    tint: "linear-gradient(180deg,#f7f5f2ee,#e7e2dccc)",
    surface: "light",
  },
};

const bg = BACKGROUNDS[platform];

const shell: CSSProperties = {
  minHeight: "100dvh",
  margin: 0,
  backgroundImage: `${bg.tint}, url(${bg.file})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  fontFamily: "DM Sans, system-ui, sans-serif",
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

/** Franja anclada abajo, como la monta cada app sobre su superficie. */
function stripShell(surface: "dark" | "light"): CSSProperties {
  return {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
    padding: "26px 0 30px",
    background: surface === "dark" ? "rgba(10,12,13,0.92)" : "rgba(250,250,248,0.95)",
    borderTop: `1px solid ${surface === "dark" ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)"}`,
    backdropFilter: "blur(6px)",
  };
}

function stripLabel(surface: "dark" | "light"): CSSProperties {
  return {
    display: "block",
    textAlign: "center",
    fontSize: 11,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    marginBottom: 18,
    color: surface === "dark" ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)",
  };
}

/** Contenedor del banner, centrado sobre la superficie. */
function bannerShell(surface: "dark" | "light"): CSSProperties {
  return {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%,-50%)",
    zIndex: 60,
    width: "min(920px, calc(100vw - 48px))",
    background: surface === "dark" ? "rgba(16,19,20,0.96)" : "rgba(255,255,255,0.97)",
    color: surface === "dark" ? "#e9ecec" : "#14181a",
    border: `1px solid ${surface === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.09)"}`,
    borderRadius: 14,
    padding: "20px 24px 24px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
  };
}

/**
 * Harness local. Renderiza el componente REAL de cada pieza sobre un fondo
 * capturado de la página pública. Tracking apagado: sin href ni creativeId,
 * así no se generan impresiones ni clics.
 */
export function App() {
  return (
    <div style={shell} data-visual-harness="partners" data-platform={platform} data-piece={piece}>
      {showBadge ? (
        <div style={badge} data-harness-badge="true">
          FIXTURE LOCAL · {bg.label} · {piece} · tracking OFF
        </div>
      ) : null}

      {piece === "welcome" ? (
        <PartnerWelcomeInterstitial
          campaignId={`demo-${platform}-${brand.slug}`}
          partnerName={brand.name}
          // Con gráfica completa el mensaje ya está en la imagen: no se repite
          // en título ni cuerpo, como haría una creatividad entregada por el
          // anunciante. Sin gráfica, se cae al logo + texto.
          imageUrl={brand.creative ?? brand.logo}
          title={brand.creative ? null : brand.title}
          body={brand.creative ? null : brand.body}
          ctaText={brand.ctaText}
          sponsoredLabel="Contenido patrocinado"
          placementKey={`DEMO_${platform.toUpperCase()}_WELCOME`}
          appearDelayMs={0}
          animationVariant={animation}
          disableFrequencyCap
        />
      ) : null}

      {piece === "banner" ? (
        <div style={bannerShell(bg.surface)}>
          <span style={{ ...stripLabel(bg.surface), textAlign: "left", marginBottom: 14 }}>
            Publicidad
          </span>
          <PartnerAdCreative
            partnerName={brand.name}
            imageUrl={brand.banner}
            title={brand.title}
            body={brand.body}
            ctaText={brand.ctaText}
            variant="banner"
          />
        </div>
      ) : null}

      {piece === "marquee" ? (
        <div style={stripShell(bg.surface)}>
          <span style={stripLabel(bg.surface)}>Nos acompañan</span>
          <PartnerLogoMarquee
            aria-label="Marcas que acompañan"
            durationSeconds={38}
            density={density}
            trackingEnabled={false}
            items={BRANDS.map((b) => ({
              id: b.slug,
              name: b.name,
              logoUrl: b.logo,
              size: "lg" as const,
            }))}
          />
        </div>
      ) : null}
    </div>
  );
}
