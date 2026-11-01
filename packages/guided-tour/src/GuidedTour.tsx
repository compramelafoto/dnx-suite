"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";

import { isDesktopViewport, onGuidedTourStart } from "./events";
import {
  computeBubblePosition,
  isFullyVisible,
  sameBox,
  spotlightBox,
  type Box,
  type BubblePosition,
} from "./placement";
import { readTourRecord, safeLocalStorage, shouldOfferTour, writeTourRecord } from "./storage";
import type { TourDefinition, TourOutcome } from "./types";

type Mode = "idle" | "invite" | "running" | "tips";

export type GuidedTourProps = {
  tour: TourDefinition;
  /** Color de los botones principales y del borde de la sección iluminada. */
  accentColor?: string;
  /** Ofrecer el recorrido solo la primera vez (en computadora). Por defecto, sí. */
  autoOffer?: boolean;
  /** Espera antes de ofrecerlo, para que la pantalla termine de cargar. */
  offerDelayMs?: number;
};

const Z = 2147483000;
const BUBBLE_WIDTH = 340;
const WAIT_TARGET_MS = 2500;
const DIM = "rgba(15, 23, 42, 0.62)";

const STYLE_ID = "dnx-guided-tour-style";
const CSS = `
@keyframes dnxTourIn { from { opacity: 0; transform: translateY(6px) scale(.98) } to { opacity: 1; transform: none } }
@keyframes dnxTourFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes dnxTourPulse { 0%,100% { box-shadow: 0 0 0 0 var(--dnx-tour-accent-soft) } 50% { box-shadow: 0 0 0 6px var(--dnx-tour-accent-soft) } }
.dnx-tour-bubble { animation: dnxTourIn .28s cubic-bezier(.2,.8,.2,1) both }
.dnx-tour-fade { animation: dnxTourFade .25s ease both }
.dnx-tour-spot { transition: top .38s cubic-bezier(.2,.8,.2,1), left .38s cubic-bezier(.2,.8,.2,1), width .38s cubic-bezier(.2,.8,.2,1), height .38s cubic-bezier(.2,.8,.2,1) }
.dnx-tour-pos { transition: top .38s cubic-bezier(.2,.8,.2,1), left .38s cubic-bezier(.2,.8,.2,1) }
.dnx-tour-btn { cursor: pointer; font: inherit; font-size: 14px; white-space: nowrap; line-height: 1.2; font-weight: 600; border-radius: 10px; padding: 9px 16px; border: 1px solid transparent; transition: filter .15s, background .15s }
.dnx-tour-btn:hover { filter: brightness(.95) }
.dnx-tour-btn:focus-visible { outline: 2px solid var(--dnx-tour-accent); outline-offset: 2px }
.dnx-tour-ghost { background: transparent; color: #475569; border-color: #e2e8f0 }
.dnx-tour-ghost:hover { background: #f8fafc; filter: none }
.dnx-tour-link { background: none; border: none; color: #64748b; font-weight: 500; padding: 9px 6px }
.dnx-tour-link:hover { color: #0f172a; filter: none }
.dnx-tour-x { cursor: pointer; background: none; border: none; color: #94a3b8; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center }
.dnx-tour-x:hover { background: #f1f5f9; color: #334155 }
@media (prefers-reduced-motion: reduce) {
  .dnx-tour-bubble, .dnx-tour-fade { animation: none }
  .dnx-tour-spot, .dnx-tour-pos { transition: none }
}
`;

function ensureStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

function viewportSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function readBox(el: Element): Box | null {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function findVisible(selector: string): Element | null {
  let nodes: NodeListOf<Element>;
  try {
    nodes = document.querySelectorAll(selector);
  } catch {
    return null;
  }
  for (const node of Array.from(nodes)) {
    if (readBox(node)) return node;
  }
  return null;
}

async function waitFor(selector: string, timeoutMs: number): Promise<Element | null> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const el = findVisible(selector);
    if (el) return el;
    await new Promise((r) => setTimeout(r, 80));
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hexToSoft(color: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return "rgba(255,255,255,.35)";
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, .35)`;
}

const SYSTEM_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * Los globos van en un portal sobre `body`: usan la tipografía del body si la app la puso ahí,
 * y si el body quedó con la letra por defecto del navegador (con serifa), la del sistema.
 */
function tourFontFamily(): string {
  if (typeof document === "undefined") return SYSTEM_FONT;
  const body = getComputedStyle(document.body).fontFamily;
  if (!body || /^"?times/i.test(body) || body.trim() === "serif") return SYSTEM_FONT;
  return body;
}

/** Texto legible sobre el color de acento: oscuro sobre colores claros (ámbar), blanco sobre el resto. */
export function textOnAccent(color: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return "#fff";
  const n = parseInt(m[1]!, 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Texto en negrita de botón: blanco mientras alcance contraste 3:1; si no (ámbar, amarillo), oscuro.
  return 1.05 / (l + 0.05) >= 3 ? "#fff" : "#0f172a";
}

export function GuidedTour({ tour, accentColor = "#c2410c", autoOffer = true, offerDelayMs = 1200 }: GuidedTourProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [index, setIndex] = useState(0);
  const [shownIndex, setShownIndex] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [bubbleH, setBubbleH] = useState(220);
  const [toast, setToast] = useState<string | null>(null);
  const targetRef = useRef<Element | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const directionRef = useRef<1 | -1>(1);
  const runRef = useRef(0);
  const titleId = useId();
  const steps = tour.steps;

  useEffect(() => {
    setMounted(true);
    ensureStyles();
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 4500);
  }, []);

  const close = useCallback(
    (outcome: TourOutcome) => {
      runRef.current += 1;
      writeTourRecord(safeLocalStorage(), tour.id, tour.version, outcome);
      setMode("idle");
      setShownIndex(null);
      setBox(null);
      targetRef.current = null;
      tour.onClose?.();
      if (outcome === "done") showToast("¡Listo! Podés repetir el recorrido cuando quieras con el botón Ayuda.");
      else showToast("Cuando quieras verlo, tocá el botón Ayuda.");
    },
    [tour, showToast],
  );

  const start = useCallback(() => {
    directionRef.current = 1;
    setIndex(0);
    setShownIndex(null);
    setMode(isDesktopViewport() ? "running" : "tips");
  }, []);

  // Primera visita: se ofrece con una tarjeta discreta, sin tapar la pantalla.
  useEffect(() => {
    if (!autoOffer) return;
    if (!isDesktopViewport()) return;
    if (!shouldOfferTour(readTourRecord(safeLocalStorage(), tour.id), tour.version)) return;
    const timer = window.setTimeout(() => setMode((m) => (m === "idle" ? "invite" : m)), offerDelayMs);
    return () => window.clearTimeout(timer);
  }, [autoOffer, offerDelayMs, tour.id, tour.version]);

  useEffect(
    () =>
      onGuidedTourStart((id) => {
        if (id === tour.id) start();
      }),
    [tour.id, start],
  );

  // Preparar cada paso: activar la pestaña si hace falta, buscar la sección y llevarla a la vista.
  useEffect(() => {
    if (mode !== "running") return;
    const run = ++runRef.current;
    const step = steps[index];
    if (!step) {
      close("done");
      return;
    }
    void (async () => {
      try {
        if (step.activate) {
          const trigger = findVisible(step.activate) as HTMLElement | null;
          trigger?.click();
          await sleep(120);
        }
        await step.before?.();
      } catch {
        // Un paso que no se puede preparar no debe trabar el recorrido.
      }
      if (run !== runRef.current) return;

      let el: Element | null = null;
      if (step.target) {
        el = await waitFor(step.target, WAIT_TARGET_MS);
        if (run !== runRef.current) return;
        if (!el) {
          // La sección no está en esta pantalla (un panel cerrado, un permiso): se saltea.
          const next = index + directionRef.current;
          if (next < 0) setIndex(0);
          else if (next >= steps.length) close("done");
          else setIndex(next);
          return;
        }
        const b = readBox(el);
        if (b && !isFullyVisible(b, viewportSize())) {
          el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
          await sleep(420);
          if (run !== runRef.current) return;
        }
      }
      targetRef.current = el;
      setBox(el ? readBox(el) : null);
      setShownIndex(index);
    })();
  }, [mode, index, steps, close]);

  // Seguir a la sección si la pantalla se mueve o cambia de tamaño mientras el globo está abierto.
  useEffect(() => {
    if (mode !== "running") return;
    let frame = 0;
    let last: Box | null = null;
    const tick = () => {
      const el = targetRef.current;
      const next = el && el.isConnected ? readBox(el) : null;
      if (!sameBox(next, last)) {
        last = next;
        setBox(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, shownIndex]);

  useLayoutEffect(() => {
    if (bubbleRef.current) setBubbleH(bubbleRef.current.offsetHeight);
  });

  useEffect(() => {
    if (mode === "running" && shownIndex !== null) nextBtnRef.current?.focus({ preventScroll: true });
  }, [mode, shownIndex]);

  const go = useCallback(
    (delta: 1 | -1) => {
      directionRef.current = delta;
      const next = index + delta;
      if (next < 0) return;
      if (next >= steps.length) {
        close("done");
        return;
      }
      setIndex(next);
    },
    [index, steps.length, close],
  );

  useEffect(() => {
    if (mode !== "running" && mode !== "tips") return;
    const onKey = (e: KeyboardEvent) => {
      // Durante el recorrido la pantalla de atrás no recibe teclas (ni atajos del editor ni el
      // WASD del simulador). Tab queda libre para moverse entre los botones del globo; el resto
      // conserva su acción por defecto (Espacio sigue apretando el botón con foco).
      if (mode === "running" && e.key !== "Tab") e.stopImmediatePropagation();
      if (e.key === "Escape") {
        if (mode === "tips") e.stopImmediatePropagation();
        e.preventDefault();
        if (mode === "tips") setMode("idle");
        else close("skipped");
      } else if (mode === "running" && (e.key === "ArrowRight" || e.key === "Enter")) {
        e.preventDefault();
        go(1);
      } else if (mode === "running" && e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mode, go, close]);

  if (!mounted) return null;

  const cssVars = {
    "--dnx-tour-accent": accentColor,
    "--dnx-tour-accent-soft": hexToSoft(accentColor),
  } as CSSProperties;
  const font: CSSProperties = {
    fontFamily: tourFontFamily(),
    color: "#0f172a",
    WebkitFontSmoothing: "antialiased",
  };
  const primary: CSSProperties = { background: accentColor, color: textOnAccent(accentColor) };

  let content: ReactNode = null;

  if (mode === "invite") {
    content = (
      <div
        role="dialog"
        aria-labelledby={titleId}
        className="dnx-tour-bubble"
        style={{
          ...font,
          ...cssVars,
          position: "fixed",
          right: 24,
          bottom: 24,
          width: 380,
          maxWidth: "calc(100vw - 48px)",
          zIndex: Z,
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 24px 60px -12px rgba(15,23,42,.35), 0 0 0 1px rgba(15,23,42,.06)",
          padding: 20,
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div
            aria-hidden
            style={{
              flex: "none",
              width: 40,
              height: 40,
              borderRadius: 12,
              background: hexToSoft(accentColor),
              color: accentColor,
              display: "grid",
              placeItems: "center",
            }}
          >
            <CompassIcon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id={titleId} style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>
              ¿Primera vez en {tour.screenName}?
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55, color: "#475569" }}>{tour.intro}</p>
          </div>
          <button type="button" className="dnx-tour-x" aria-label="Cerrar" onClick={() => close("dismissed")}>
            <XIcon />
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="dnx-tour-btn dnx-tour-ghost" onClick={() => close("dismissed")}>
            Ahora no
          </button>
          <button type="button" className="dnx-tour-btn" style={primary} onClick={start}>
            Hacer el recorrido · {steps.length} pasos
          </button>
        </div>
      </div>
    );
  } else if (mode === "running") {
    const step = shownIndex !== null ? steps[shownIndex] : null;
    const vp = viewportSize();
    const spot = box ? spotlightBox(box, step?.padding ?? 8, vp) : null;
    const pos: BubblePosition = computeBubblePosition({
      target: spot,
      bubble: { width: BUBBLE_WIDTH, height: bubbleH },
      viewport: vp,
      preferred: step?.placement,
    });
    const isLast = shownIndex === steps.length - 1;
    const progress = shownIndex !== null ? ((shownIndex + 1) / steps.length) * 100 : 0;

    content = (
      <div style={{ ...font, ...cssVars }}>
        {/* Captura los clics: durante el recorrido la pantalla no se toca, solo se mira. */}
        <div
          aria-hidden
          className="dnx-tour-fade"
          style={{ position: "fixed", inset: 0, zIndex: Z, background: spot ? "transparent" : DIM }}
        />
        {spot && (
          <div
            aria-hidden
            className="dnx-tour-spot"
            style={{
              position: "fixed",
              zIndex: Z + 1,
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              borderRadius: 12,
              boxShadow: `0 0 0 9999px ${DIM}`,
              pointerEvents: "none",
            }}
          >
            {/* El pulso va en un anillo aparte: si animara la sombra de arriba, se perdería el oscurecido. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 12,
                border: `2px solid ${accentColor}`,
                animation: "dnxTourPulse 2.4s ease-in-out infinite",
              }}
            />
          </div>
        )}
        {step && (
          <div
            key={shownIndex}
            ref={bubbleRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="dnx-tour-pos"
            style={{
              position: "fixed",
              zIndex: Z + 2,
              top: pos.top,
              left: pos.left,
              width: BUBBLE_WIDTH,
            }}
          >
            <div
              className="dnx-tour-bubble"
              style={{
                position: "relative",
                background: "#fff",
                borderRadius: 16,
                boxShadow: "0 24px 60px -12px rgba(15,23,42,.45), 0 0 0 1px rgba(15,23,42,.06)",
                padding: "18px 20px 16px",
              }}
            >
              <Arrow side={pos.side} offset={pos.arrowOffset} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: accentColor, letterSpacing: ".02em" }}>
                  Paso {(shownIndex ?? 0) + 1} de {steps.length}
                </span>
                <button type="button" className="dnx-tour-x" aria-label="Cerrar el recorrido" onClick={() => close("skipped")}>
                  <XIcon />
                </button>
              </div>
              <div id={titleId} style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3, marginTop: 4 }}>
                {step.title}
              </div>
              <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6, color: "#475569" }}>{step.body}</div>
              <div
                aria-hidden
                style={{ height: 4, borderRadius: 4, background: "#f1f5f9", marginTop: 16, overflow: "hidden" }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: accentColor,
                    borderRadius: 4,
                    transition: "width .3s ease",
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                {!isLast && (
                  <button type="button" className="dnx-tour-btn dnx-tour-link" onClick={() => close("skipped")}>
                    Omitir
                  </button>
                )}
                <span style={{ flex: 1 }} />
                {shownIndex !== 0 && (
                  <button type="button" className="dnx-tour-btn dnx-tour-ghost" onClick={() => go(-1)}>
                    Anterior
                  </button>
                )}
                <button ref={nextBtnRef} type="button" className="dnx-tour-btn" style={primary} onClick={() => go(1)}>
                  {isLast ? "Terminar" : "Siguiente"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  } else if (mode === "tips") {
    content = (
      <div
        className="dnx-tour-fade"
        onClick={() => setMode("idle")}
        style={{
          ...font,
          ...cssVars,
          position: "fixed",
          inset: 0,
          zIndex: Z,
          background: DIM,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="dnx-tour-bubble"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 560,
            maxHeight: "85vh",
            overflowY: "auto",
            background: "#fff",
            borderRadius: "20px 20px 0 0",
            padding: "20px 20px calc(20px + env(safe-area-inset-bottom))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div id={titleId} style={{ fontSize: 18, fontWeight: 700 }}>
              Cómo usar {tour.screenName}
            </div>
            <button type="button" className="dnx-tour-x" aria-label="Cerrar" onClick={() => setMode("idle")}>
              <XIcon />
            </button>
          </div>
          <ol style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "grid", gap: 14 }}>
            {steps.map((s, i) => (
              <li key={i} style={{ display: "flex", gap: 12 }}>
                <span
                  aria-hidden
                  style={{
                    flex: "none",
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    background: hexToSoft(accentColor),
                    color: accentColor,
                    fontSize: 12,
                    fontWeight: 700,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {i + 1}
                </span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{s.title}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: "#475569", marginTop: 2 }}>{s.body}</div>
                </div>
              </li>
            ))}
          </ol>
          <p style={{ fontSize: 13, color: "#64748b", margin: "16px 0 0" }}>
            En una computadora, el botón Ayuda te muestra este recorrido sobre la pantalla, paso a paso.
          </p>
        </div>
      </div>
    );
  }

  const toastNode = toast ? (
    <div
      role="status"
      className="dnx-tour-bubble"
      style={{
        ...font,
        position: "fixed",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        zIndex: Z,
        background: "#0f172a",
        color: "#fff",
        fontSize: 14,
        padding: "10px 16px",
        borderRadius: 12,
        boxShadow: "0 12px 30px -8px rgba(15,23,42,.45)",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      {toast}
    </div>
  ) : null;

  if (!content && !toastNode) return null;
  return createPortal(
    <>
      {content}
      {mode === "idle" && toastNode}
    </>,
    document.body,
  );
}

function Arrow({ side, offset }: { side: BubblePosition["side"]; offset: number }) {
  if (side === "center") return null;
  const size = 12;
  const base: CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    background: "#fff",
    transform: "rotate(45deg)",
    boxShadow: "0 0 0 1px rgba(15,23,42,.04)",
  };
  // El globo está del lado `side` de la sección: la flecha apunta hacia el lado contrario.
  if (side === "right") return <span aria-hidden style={{ ...base, left: -size / 2, top: offset - size / 2 }} />;
  if (side === "left") return <span aria-hidden style={{ ...base, right: -size / 2, top: offset - size / 2 }} />;
  if (side === "bottom") return <span aria-hidden style={{ ...base, top: -size / 2, left: offset - size / 2 }} />;
  return <span aria-hidden style={{ ...base, bottom: -size / 2, left: offset - size / 2 }} />;
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </svg>
  );
}
