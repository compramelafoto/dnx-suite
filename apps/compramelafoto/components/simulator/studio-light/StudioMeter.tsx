"use client";

import { MODIFIERS } from "@/lib/simulator/studio-light/modifiers";
import {
  formatEv,
  formatFNumber,
  formatShutter,
  meter,
  type MeterReport,
  type PatternId,
} from "@/lib/simulator/studio-light/metering";
import { useStudio } from "@/lib/simulator/studio-light/studio-store";
import type { Histogram } from "./StudioCanvas";

const PATTERNS: Record<PatternId, { name: string; text: string }> = {
  none: { name: "Sin luz principal", text: "Encendé una luz que apunte al sujeto para empezar." },
  butterfly: {
    name: "Mariposa (Paramount)",
    text: "Luz frontal y alta: sombra simétrica bajo la nariz. Marca pómulos y favorece rostros ovalados.",
  },
  loop: {
    name: "Loop",
    text: "La sombra de la nariz baja en diagonal sin unirse a la de la mejilla. El esquema más versátil.",
  },
  rembrandt: {
    name: "Rembrandt",
    text: "Se forma un triángulo de luz bajo el ojo en sombra. Si el triángulo se corta, acercá la luz al eje.",
  },
  split: {
    name: "Split (dividida)",
    text: "La luz a 90°: media cara iluminada y media en sombra. Dramático y con carácter.",
  },
  rim: {
    name: "Contraluz",
    text: "La luz más fuerte viene desde atrás: dibuja el contorno. Sumá un relleno si querés ver la cara.",
  },
  underlight: {
    name: "Luz desde abajo",
    text: "Las sombras suben por la cara: efecto de terror. Útil como relleno muy suave, no como principal.",
  },
  top: {
    name: "Cenital",
    text: "La luz cae desde arriba: los ojos quedan en sombra y se marcan pómulos y nariz. Para recuperar la mirada, rebotá luz desde abajo o inclinala hacia la cara.",
  },
  flat: {
    name: "Luz plana",
    text: "De frente y a la altura de los ojos: casi sin sombras ni volumen. Subí la luz para modelar.",
  },
};

function ratioAdvice(ratio: number | null): string {
  if (ratio === null) return "Sin relleno: las sombras quedan negras.";
  if (ratio < 2) return "Muy plano: casi no hay diferencia entre luz y sombra.";
  if (ratio < 3) return "Suave: retrato amable, sombras abiertas.";
  if (ratio < 5) return "Clásico de retrato: buen volumen sin perder la sombra.";
  if (ratio < 8) return "Dramático: sombras profundas.";
  return "Muy dramático: la sombra casi no tiene detalle.";
}

function exposureAdvice(report: MeterReport): string | null {
  if (!Number.isFinite(report.totalEv)) return "No llega luz a la cara.";
  // Con luz lateral la cúpula hacia cámara lee de menos: se juzga por el lado iluminado.
  const ev = Math.max(report.totalEv, report.keyEv);
  if (ev > 1.2) return "Muy sobreexpuesta: cerrá el diafragma o bajá la potencia.";
  if (ev > 0.4) return "Algo sobreexpuesta.";
  if (ev < -1.2) return "Muy subexpuesta: abrí el diafragma, subí ISO o la potencia.";
  if (ev < -0.4) return "Algo subexpuesta.";
  return null;
}

function Needle({ ev }: { ev: number }) {
  const clamped = Number.isFinite(ev) ? Math.max(-3, Math.min(3, ev)) : -3;
  return (
    <div className="cod-studio-needle" aria-hidden="true">
      {[-3, -2, -1, 0, 1, 2, 3].map((t) => (
        <span key={t} className={`cod-studio-needle__tick${t === 0 ? " cod-studio-needle__tick--zero" : ""}`} style={{ left: `${((t + 3) / 6) * 100}%` }}>
          {t > 0 ? `+${t}` : t}
        </span>
      ))}
      <span className="cod-studio-needle__mark" style={{ left: `${((clamped + 3) / 6) * 100}%` }} />
    </div>
  );
}

export default function StudioMeter({ histogram }: { histogram: Histogram | null }) {
  const { state } = useStudio();
  const report = meter(state);
  const pattern = PATTERNS[report.pattern];
  const advice = exposureAdvice(report);
  const key = state.lights.find((l) => l.id === report.keyId);
  const continuous = state.lights.some((l) => l.on && MODIFIERS[l.modifier].nature === "continuous");
  const ratioText = report.ratio === null ? "—" : `${(Math.round(report.ratio * 10) / 10).toString().replace(".", ",")}:1`;

  return (
    <section className="cod-studio-card cod-studio-meter" aria-label="Fotómetro">
      <header className="cod-studio-card__head">
        <h2 className="cod-studio-card__title">Fotómetro</h2>
        <span className="cod-studio-meter__settings">
          f/{state.camera.aperture} · {formatShutter(state.camera.shutter)} · ISO {state.camera.iso}
        </span>
      </header>

      <div className="cod-studio-meter__main">
        <div>
          <p className="cod-studio-meter__reading">{formatFNumber(report.totalFNumber)}</p>
          <p className="cod-studio-meter__caption">lectura incidente en la cara</p>
        </div>
        <div className={`cod-studio-meter__ev${advice ? " cod-studio-meter__ev--warn" : ""}`}>{formatEv(report.totalEv)}</div>
      </div>
      <Needle ev={report.totalEv} />

      <dl className="cod-studio-meter__stats">
        <div>
          <dt>Relación</dt>
          <dd>{ratioText}</dd>
        </div>
        <div>
          <dt>Fondo</dt>
          <dd>{formatEv(report.backgroundEv)}</dd>
        </div>
        <div title="Fotómetro apuntando a la luz principal">
          <dt>Lado con luz</dt>
          <dd>{key ? formatEv(report.keyEv) : "—"}</dd>
        </div>
      </dl>

      {histogram ? (
        <div className="cod-studio-histo" aria-label="Histograma de la foto">
          {histogram.bins.map((b, i) => (
            <span key={i} style={{ height: `${Math.max(2, b * 100)}%` }} />
          ))}
          {histogram.clipHigh > 0.02 ? <em className="cod-studio-histo__clip cod-studio-histo__clip--high">quemado {Math.round(histogram.clipHigh * 100)}%</em> : null}
          {histogram.clipLow > 0.35 ? <em className="cod-studio-histo__clip cod-studio-histo__clip--low">sombras empastadas</em> : null}
        </div>
      ) : null}

      <div className="cod-studio-coach">
        <p className="cod-studio-coach__pattern">
          {pattern.name}
          {report.side ? <span> · {report.side === "short" ? "iluminación corta" : "iluminación ancha"}</span> : null}
        </p>
        <p className="cod-studio-coach__text">{pattern.text}</p>
        <p className="cod-studio-coach__text">{ratioAdvice(report.ratio)}</p>
        {advice ? <p className="cod-studio-coach__warn">{advice}</p> : null}
        {report.overSync ? (
          <p className="cod-studio-coach__warn">
            {formatShutter(state.camera.shutter)} supera la sincronización del flash (1/250): la cortina tapa parte del cuadro.
          </p>
        ) : null}
        {continuous && state.camera.shutter < 1 / 250 ? (
          <p className="cod-studio-coach__text">Con luz continua, el obturador sí cambia la exposición: probá 1/60 o 1/125.</p>
        ) : null}
      </div>
    </section>
  );
}
