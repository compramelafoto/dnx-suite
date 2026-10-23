"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import SimulatorShell from "@/components/simulator/SimulatorShell";
import { formatShutter, meter } from "@/lib/simulator/studio-light/metering";
import { deserializeStudio, serializeStudio } from "@/lib/simulator/studio-light/share";
import { StudioProvider, useStudio } from "@/lib/simulator/studio-light/studio-store";
import type { StudioState } from "@/lib/simulator/studio-light/types";
import type { Histogram, StudioViewMode } from "./StudioCanvas";
import StudioMeter from "./StudioMeter";
import { CameraPanel, LightsPanel, PresetsPanel, ScenePanel } from "./StudioPanels";
import StudioPlanView from "./StudioPlanView";

const StudioCanvas = dynamic(() => import("./StudioCanvas"), {
  ssr: false,
  loading: () => <div className="cod-studio__loading">Armando el estudio…</div>,
});

type Tab = "lights" | "camera" | "scene" | "presets";

const TABS: { id: Tab; label: string }[] = [
  { id: "lights", label: "Luces" },
  { id: "camera", label: "Cámara" },
  { id: "scene", label: "Escena" },
  { id: "presets", label: "Esquemas" },
];

const SLOT_COUNT = 6;
const STORAGE_KEY = "cod-estudio-luz:capturas";

interface CaptureSlot {
  state: string;
  image: string;
  label: string;
}

function loadSlots(): (CaptureSlot | null)[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as (CaptureSlot | null)[]) : [];
    return Array.from({ length: SLOT_COUNT }, (_, i) => parsed[i] ?? null);
  } catch {
    return Array.from({ length: SLOT_COUNT }, () => null);
  }
}

function saveSlots(slots: (CaptureSlot | null)[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  } catch {
    // Sin espacio o almacenamiento bloqueado: las capturas siguen en memoria.
  }
}

/** Miniatura liviana para guardar en el navegador. */
function shrink(dataUrl: string, width = 480): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = Math.round((img.height / img.width) * width);
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

type PlanTheme = "dark" | "light";
type PlanFormat = "png" | "svg";

const PLAN_THEMES: Record<PlanTheme, { bg: string; text: string; readout: string; ink: string; muted: string }> = {
  dark: { bg: "#0d0d12", text: "#e5e7eb", readout: "#ffd400", ink: "255,255,255", muted: "110,200,255" },
  light: { bg: "#ffffff", text: "#1f2937", readout: "#a16207", ink: "17,24,39", muted: "37,99,235" },
};

/** Copia la planta con colores fijos (el SVG de pantalla depende de las clases CSS). */
function themedPlan(theme: PlanTheme): { markup: string; width: number; height: number } | null {
  const svg = document.querySelector<SVGSVGElement>(".cod-studio-plan__svg");
  if (!svg) return null;
  const t = PLAN_THEMES[theme];
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (theme === "light") {
    // Trazos claros pensados para fondo negro: se pasan a tinta oscura.
    clone.querySelectorAll<SVGElement>("*").forEach((el) => {
      for (const attr of ["stroke", "fill"]) {
        const v = el.getAttribute(attr);
        if (!v) continue;
        if (v.startsWith("rgba(255,255,255")) el.setAttribute(attr, v.replace("255,255,255", t.ink));
        else if (v.startsWith("rgba(110,200,255")) el.setAttribute(attr, v.replace("110,200,255", t.muted));
        else if (v === "#16161a" || v === "#2b2d31") el.setAttribute(attr, "#e5e7eb");
        else if (v === "#ffd400") el.setAttribute(attr, t.readout);
      }
    });
  }
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `text{font-family:Arial,sans-serif;fill:${t.text};font-size:0.16px}.cod-studio-plan__readout{font-size:0.18px;fill:${t.readout}}`;
  clone.insertBefore(style, clone.firstChild);
  const vb = svg.viewBox.baseVal;
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", String(vb.x));
  bg.setAttribute("y", String(vb.y));
  bg.setAttribute("width", String(vb.width));
  bg.setAttribute("height", String(vb.height));
  bg.setAttribute("fill", t.bg);
  clone.insertBefore(bg, style.nextSibling);
  const width = 1800;
  const height = Math.round((width * vb.height) / vb.width);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  return { markup: new XMLSerializer().serializeToString(clone), width, height };
}

function exportPlan(theme: PlanTheme, format: PlanFormat) {
  const plan = themedPlan(theme);
  if (!plan) return;
  const svgUrl = URL.createObjectURL(new Blob([plan.markup], { type: "image/svg+xml" }));
  const name = `esquema-de-luces-${theme === "dark" ? "oscuro" : "claro"}`;
  if (format === "svg") {
    download(svgUrl, `${name}.svg`);
    setTimeout(() => URL.revokeObjectURL(svgUrl), 2000);
    return;
  }
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    URL.revokeObjectURL(svgUrl);
    download(canvas.toDataURL("image/png"), `${name}.png`);
  };
  img.src = svgUrl;
}

function ExportDialog({ onClose }: { onClose: () => void }) {
  const [theme, setTheme] = useState<PlanTheme>("dark");
  const [format, setFormat] = useState<PlanFormat>("png");
  return (
    <div className="cod-studio-help" role="dialog" aria-modal="true" aria-label="Descargar esquema" onClick={onClose}>
      <div className="cod-studio-help__box cod-studio-export" onClick={(e) => e.stopPropagation()}>
        <h2>Descargar esquema de luces</h2>
        <span className="cod-studio-field__label">Fondo</span>
        <div className="cod-studio-export__themes">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={theme === t}
              className={`cod-studio-export__theme cod-studio-export__theme--${t}${theme === t ? " cod-studio-export__theme--on" : ""}`}
              onClick={() => setTheme(t)}
            >
              <span className="cod-studio-export__swatch" />
              {t === "dark" ? "Oscuro" : "Claro (para imprimir)"}
            </button>
          ))}
        </div>
        <span className="cod-studio-field__label">Formato</span>
        <div className="cod-studio-segment" role="group" aria-label="Formato">
          {(["png", "svg"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`cod-studio-segment__btn${format === f ? " cod-studio-segment__btn--on" : ""}`}
              onClick={() => setFormat(f)}
            >
              {f === "png" ? "Imagen PNG" : "Vector SVG"}
            </button>
          ))}
        </div>
        <div className="cod-studio-editor__actions">
          <button
            type="button"
            className="cod-btn cod-btn--primary cod-btn--sm"
            onClick={() => {
              exportPlan(theme, format);
              onClose();
            }}
          >
            Descargar
          </button>
          <button type="button" className="cod-btn cod-btn--ghost cod-btn--sm" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="cod-studio-help" role="dialog" aria-modal="true" aria-label="Cómo usar el estudio" onClick={onClose}>
      <div className="cod-studio-help__box" onClick={(e) => e.stopPropagation()}>
        <h2>Cómo usar el Estudio de luz</h2>
        <ul>
          <li><b>Arrastrá una luz</b> en la vista 3D o en la planta para moverla por el piso.</li>
          <li><b>Shift + arrastrar</b> sube o baja la luz.</li>
          <li><b>Rueda del mouse sobre una luz</b> cambia su potencia en tercios de paso.</li>
          <li><b>Arrastrá el fondo</b> para girar alrededor del set; rueda para acercarte.</li>
          <li>La miniatura muestra la otra vista; tocála para intercambiarlas.</li>
          <li><b>S</b> pone en solo la luz elegida · <b>Espacio</b> captura · <b>V</b> cambia de vista · <b>1–6</b> elige luz · <b>Supr</b> la quita · <b>⌘Z / Ctrl+Z</b> deshace.</li>
          <li>El fotómetro mide como uno de mano: apuntando a la cámara desde la cara del sujeto. 0 EV es la exposición correcta.</li>
        </ul>
        <p className="cod-studio-hint">
          Inspirado en Virtual Lighting Studio (zvork) y Set a Light 3D. Escaneo de cabeza: Lee Perry-Smith (Infinite-Realities), licencia CC BY 3.0.
        </p>
        <button type="button" className="cod-btn cod-btn--primary cod-btn--sm" onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>
  );
}

function StudioWorkspace() {
  const { state, dispatch, canUndo, canRedo } = useStudio();
  const [tab, setTab] = useState<Tab>("lights");
  const [mode, setMode] = useState<StudioViewMode>("set");
  const [histogram, setHistogram] = useState<Histogram | null>(null);
  const [slots, setSlots] = useState<(CaptureSlot | null)[]>(() => Array.from({ length: SLOT_COUNT }, () => null));
  const [fullImages, setFullImages] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const captureRef = useRef<((dataUrl: string | null) => void) | null>(null);
  const report = meter(state);

  // Al montar se leen las capturas guardadas y un enlace compartido (#s=...).
  // Va en un cuadro aparte porque el servidor no ve ni el almacenamiento ni el hash.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setSlots(loadSlots());
      const match = window.location.hash.match(/s=([A-Za-z0-9_-]+)/);
      const shared = match ? deserializeStudio(match[1]) : null;
      if (shared) {
        dispatch({ type: "replace", state: shared });
        setToast("Se cargó el set compartido.");
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [dispatch]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const captureTo = useCallback(
    (index: number) => {
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
      const snapshot = serializeStudio(state);
      const label = `f/${state.camera.aperture} · ${formatShutter(state.camera.shutter)} · ISO ${state.camera.iso}`;
      captureRef.current = async (dataUrl) => {
        if (!dataUrl) {
          setToast("No se pudo capturar la foto.");
          return;
        }
        const thumb = await shrink(dataUrl);
        setFullImages((prev) => ({ ...prev, [index]: dataUrl }));
        setSlots((prev) => {
          const next = [...prev];
          next[index] = { state: snapshot, image: thumb, label };
          saveSlots(next);
          return next;
        });
      };
    },
    [state],
  );

  const captureNext = useCallback(() => {
    const free = slots.findIndex((s) => s === null);
    captureTo(free === -1 ? SLOT_COUNT - 1 : free);
  }, [slots, captureTo]);

  const share = useCallback(async () => {
    const url = `${window.location.origin}${window.location.pathname}#s=${serializeStudio(state)}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast("Enlace copiado: quien lo abra ve este mismo set.");
    } catch {
      window.history.replaceState(null, "", url);
      setToast("El enlace quedó en la barra de direcciones.");
    }
  }, [state]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " ") {
        e.preventDefault();
        captureNext();
      } else if (e.key.toLowerCase() === "v") {
        setMode((m) => (m === "set" ? "camera" : "set"));
      } else if (e.key.toLowerCase() === "s" && state.selectedId) {
        dispatch({ type: "toggle-solo", id: state.selectedId });
      } else if ((e.key === "Delete" || e.key === "Backspace") && state.selectedId) {
        dispatch({ type: "remove-light", id: state.selectedId });
      } else if (/^[1-6]$/.test(e.key)) {
        const l = state.lights[Number(e.key) - 1];
        if (l) {
          dispatch({ type: "select", id: l.id });
          setTab("lights");
        }
      } else if (e.key === "?") {
        setHelpOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, captureNext, state.selectedId, state.lights]);

  const applySlot = (slot: CaptureSlot) => {
    const restored: StudioState | null = deserializeStudio(slot.state);
    if (restored) dispatch({ type: "replace", state: restored });
  };

  const clearSlot = (index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      saveSlots(next);
      return next;
    });
  };

  return (
    <main className="cod-studio">
      <section className="cod-studio__stage">
        <div className="cod-studio__toolbar">
          <div className="cod-studio-segment" role="group" aria-label="Vista principal">
            <button type="button" className={`cod-studio-segment__btn${mode === "set" ? " cod-studio-segment__btn--on" : ""}`} onClick={() => setMode("set")}>
              Vista del set
            </button>
            <button type="button" className={`cod-studio-segment__btn${mode === "camera" ? " cod-studio-segment__btn--on" : ""}`} onClick={() => setMode("camera")}>
              Vista de cámara
            </button>
          </div>
          <div className="cod-studio__actions">
            <button type="button" className="cod-btn cod-btn--ghost cod-btn--sm" disabled={!canUndo} onClick={() => dispatch({ type: "undo" })} title="Deshacer (⌘Z)">
              Deshacer
            </button>
            <button type="button" className="cod-btn cod-btn--ghost cod-btn--sm" disabled={!canRedo} onClick={() => dispatch({ type: "redo" })} title="Rehacer (⇧⌘Z)">
              Rehacer
            </button>
            <button type="button" className="cod-btn cod-btn--ghost cod-btn--sm" onClick={() => setExportOpen(true)}>
              Descargar esquema
            </button>
            <button type="button" className="cod-btn cod-btn--secondary cod-btn--sm" onClick={share}>
              Compartir set
            </button>
            <button type="button" className="cod-btn cod-btn--ghost cod-btn--sm" onClick={() => setHelpOpen(true)} aria-label="Ayuda">
              ?
            </button>
          </div>
        </div>

        <div className="cod-studio__viewport">
          <StudioCanvas mode={mode} captureRef={captureRef} onHistogram={setHistogram} showPip />
          <button
            type="button"
            className="cod-studio__pip"
            onClick={() => setMode((m) => (m === "set" ? "camera" : "set"))}
            aria-label={mode === "set" ? "Ver por la cámara" : "Ver el set"}
          >
            <span>{mode === "set" ? "Foto" : "Set"}</span>
          </button>
          {mode === "camera" && report.syncBand > 0 ? (
            <div className="cod-studio__syncband" style={{ height: `${report.syncBand * 100}%` }} aria-hidden="true" />
          ) : null}
          {mode === "set" ? (
            <p className="cod-studio__tip">Arrastrá las luces · Shift para subir/bajar · rueda sobre una luz = potencia</p>
          ) : null}
          {flash ? <div className="cod-studio__flash" aria-hidden="true" /> : null}
          <button type="button" className="cod-studio__shutter" onClick={captureNext} aria-label="Capturar foto (Espacio)">
            <span />
          </button>
        </div>

        <ol className="cod-studio-slots" aria-label="Capturas">
          {slots.map((slot, i) => (
            <li key={i} className="cod-studio-slot">
              {slot ? (
                <>
                  <button type="button" className="cod-studio-slot__img" onClick={() => applySlot(slot)} title="Volver a este set">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={slot.image} alt={`Captura ${i + 1}`} />
                  </button>
                  <span className="cod-studio-slot__label">{slot.label}</span>
                  <span className="cod-studio-slot__tools">
                    <button type="button" onClick={() => download(fullImages[i] ?? slot.image, `estudio-de-luz-${i + 1}.jpg`)}>
                      Descargar
                    </button>
                    <button type="button" onClick={() => clearSlot(i)}>
                      Borrar
                    </button>
                  </span>
                </>
              ) : (
                <button type="button" className="cod-studio-slot__empty" onClick={() => captureTo(i)}>
                  Capturar {i + 1}
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>

      <aside className="cod-studio__side" aria-label="Controles del estudio">
        <StudioMeter histogram={histogram} />
        <section className="cod-studio-card">
          <header className="cod-studio-card__head">
            <h2 className="cod-studio-card__title">Planta</h2>
            <span className="cod-studio-hint">vista desde arriba</span>
          </header>
          <StudioPlanView />
        </section>
        <section className="cod-studio-card">
          <div className="cod-side-tabs" role="tablist" aria-label="Panel del estudio">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`cod-side-tabs__btn${tab === t.id ? " cod-side-tabs__btn--active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "lights" ? <LightsPanel /> : null}
          {tab === "camera" ? <CameraPanel /> : null}
          {tab === "scene" ? <ScenePanel /> : null}
          {tab === "presets" ? <PresetsPanel onApplied={() => setTab("lights")} /> : null}
        </section>
      </aside>

      {toast ? <div className="cod-studio-toast" role="status">{toast}</div> : null}
      {helpOpen ? <HelpDialog onClose={() => setHelpOpen(false)} /> : null}
      {exportOpen ? <ExportDialog onClose={() => setExportOpen(false)} /> : null}
    </main>
  );
}

export default function StudioLightClient() {
  return (
    <StudioProvider>
      <SimulatorShell variant="simulator">
        <StudioWorkspace />
      </SimulatorShell>
    </StudioProvider>
  );
}
