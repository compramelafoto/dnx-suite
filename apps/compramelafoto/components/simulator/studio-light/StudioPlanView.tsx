"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { MODIFIERS, gelById } from "@/lib/simulator/studio-light/modifiers";
import { BACKDROP_Z, SUBJECT_HEAD, activeLights, aimPoint } from "@/lib/simulator/studio-light/metering";
import { SET_BOUNDS, useStudio } from "@/lib/simulator/studio-light/studio-store";
import type { StudioLight } from "@/lib/simulator/studio-light/types";

const VIEW = { x: -4.7, y: -3.0, w: 9.4, h: 8.9 };
const DEG = 180 / Math.PI;

/** Redondeo para el SVG: servidor y navegador deben escribir el mismo texto. */
const f = (n: number) => Math.round(n * 1000) / 1000;

type DragTarget = { kind: "light"; id: string } | { kind: "camera" } | null;

function LightGlyph({ light, selected, lit }: { light: StudioLight; selected: boolean; lit: boolean }) {
  const spec = MODIFIERS[light.modifier];
  const aim = aimPoint(light);
  const angle = Math.atan2(aim[2] - light.z, aim[0] - light.x) * DEG;
  const gel = spec.nature === "reflector" ? (spec.tint ?? "#fff") : gelById(light.gel).color;
  const w = Math.max(0.16, spec.width);
  const beam = (spec.beamDeg / 2 / DEG);
  const reach = 1.1;
  const stroke = selected ? "#ffb547" : "rgba(255,255,255,0.75)";
  return (
    <g transform={`translate(${f(light.x)} ${f(light.z)}) rotate(${f(angle)})`} opacity={light.on ? 1 : 0.35}>
      {lit ? (
        <path
          d={`M0 0 L${f(Math.cos(beam) * reach)} ${f(Math.sin(beam) * reach)} A${reach} ${reach} 0 0 0 ${f(Math.cos(beam) * reach)} ${f(-Math.sin(beam) * reach)} Z`}
          fill={gel}
          opacity={0.13}
        />
      ) : null}
      {spec.nature === "reflector" ? (
        <path
          d={`M0 ${-w / 2} Q0.12 0 0 ${w / 2}`}
          fill="none"
          stroke={gel}
          strokeWidth={0.07}
          strokeLinecap="round"
        />
      ) : spec.shape === "ring" ? (
        <circle r={w / 2} fill="none" stroke={gel} strokeWidth={0.06} />
      ) : (
        <>
          <rect x={-0.26} y={-0.07} width={0.2} height={0.14} rx={0.03} fill="#2b2d31" stroke={stroke} strokeWidth={0.02} />
          <path
            d={`M-0.06 -0.07 L0.08 ${-w / 2} L0.08 ${w / 2} L-0.06 0.07 Z`}
            fill="#16161a"
            stroke={stroke}
            strokeWidth={0.02}
          />
          <line x1={0.08} y1={-w / 2} x2={0.08} y2={w / 2} stroke={gel} strokeWidth={0.05} />
        </>
      )}
      {selected ? <circle r={0.34} fill="none" stroke="#ffb547" strokeWidth={0.025} strokeDasharray="0.06 0.05" /> : null}
    </g>
  );
}

export default function StudioPlanView() {
  const { state, dispatch, checkpoint } = useStudio();
  const svgRef = useRef<SVGSVGElement>(null);
  // Ref y no estado: en un clic rápido el "soltar" llega antes del re-render.
  const drag = useRef<DragTarget>(null);
  const lit = new Set(activeLights(state).map((l) => l.id));

  function toWorld(e: ReactPointerEvent): { x: number; z: number } | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, z: p.y };
  }

  function start(target: DragTarget, e: ReactPointerEvent) {
    e.stopPropagation();
    if (target?.kind === "light") dispatch({ type: "select", id: target.id });
    checkpoint();
    drag.current = target;
    svgRef.current?.setPointerCapture(e.pointerId);
  }

  function move(e: ReactPointerEvent) {
    const current = drag.current;
    if (!current) return;
    const p = toWorld(e);
    if (!p) return;
    if (current.kind === "light") {
      dispatch({ type: "move-light", id: current.id, x: p.x, z: p.z });
    } else {
      // La cámara no puede quedar detrás del sujeto ni pegada a él.
      const z = Math.min(SET_BOUNDS.maxZ, Math.max(0.6, p.z));
      const x = Math.min(SET_BOUNDS.maxX, Math.max(SET_BOUNDS.minX, p.x));
      dispatch({ type: "camera", patch: { x, z } });
    }
  }

  function end(e: ReactPointerEvent) {
    if (!drag.current) return;
    drag.current = null;
    svgRef.current?.releasePointerCapture(e.pointerId);
  }

  const cam = state.camera;
  const camAngle = Math.atan2(SUBJECT_HEAD[2] - cam.z, SUBJECT_HEAD[0] - cam.x);
  const halfH = Math.atan(18 / cam.focalMm);
  const camReach = Math.hypot(cam.x, cam.z) + 0.8;
  const yawRad = (state.subjectYaw * Math.PI) / 180;
  const selected = state.lights.find((l) => l.id === state.selectedId);

  return (
    <div className="cod-studio-plan">
      <svg
        ref={svgRef}
        className="cod-studio-plan__svg"
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        role="img"
        aria-label="Planta del estudio: arrastrá las luces y la cámara"
      >
        <defs>
          <pattern id="cod-plan-grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
            <path d="M0.5 0 L0 0 0 0.5" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.012" />
          </pattern>
        </defs>
        <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill="url(#cod-plan-grid)" />
        {[1, 2, 3].map((r) => (
          <circle key={r} r={r} fill="none" stroke="rgba(110,200,255,0.12)" strokeWidth={0.015} strokeDasharray="0.08 0.08" />
        ))}
        <rect x={-2.7} y={BACKDROP_Z - 0.08} width={5.4} height={0.08} fill="#9a9a9a" />
        <text x={0} y={BACKDROP_Z - 0.16} className="cod-studio-plan__label" textAnchor="middle">
          fondo
        </text>

        {/* Campo de visión de la cámara */}
        <path
          d={`M${f(cam.x)} ${f(cam.z)} L${f(cam.x + Math.cos(camAngle - halfH) * camReach)} ${f(cam.z + Math.sin(camAngle - halfH) * camReach)} L${f(cam.x + Math.cos(camAngle + halfH) * camReach)} ${f(cam.z + Math.sin(camAngle + halfH) * camReach)} Z`}
          fill="rgba(225,29,46,0.08)"
          stroke="rgba(225,29,46,0.4)"
          strokeWidth={0.015}
        />

        {/* Sujeto */}
        <g>
          <ellipse cx={0} cy={0} rx={0.22} ry={0.14} fill="#3a3a40" transform={`rotate(${(-yawRad * DEG).toFixed(2)})`} />
          <circle r={0.11} fill="#c79a7e" />
          <path
            d={`M${f(Math.sin(yawRad) * 0.11)} ${f(Math.cos(yawRad) * 0.11)} L${f(Math.sin(yawRad) * 0.2)} ${f(Math.cos(yawRad) * 0.2)}`}
            stroke="#c79a7e"
            strokeWidth={0.05}
            strokeLinecap="round"
          />
        </g>

        {state.lights.map((l) => (
          <g key={l.id} onPointerDown={(e) => start({ kind: "light", id: l.id }, e)} style={{ cursor: "grab" }}>
            <circle cx={f(l.x)} cy={f(l.z)} r={0.3} fill="transparent" />
            <LightGlyph light={l} selected={l.id === state.selectedId} lit={lit.has(l.id)} />
            <text x={f(l.x)} y={f(l.z + 0.44)} className="cod-studio-plan__label" textAnchor="middle">
              {l.name}
            </text>
          </g>
        ))}

        <g
          transform={`translate(${f(cam.x)} ${f(cam.z)}) rotate(${f(camAngle * DEG)})`}
          onPointerDown={(e) => start({ kind: "camera" }, e)}
          style={{ cursor: "grab" }}
        >
          <circle r={0.3} fill="transparent" />
          <rect x={-0.12} y={-0.13} width={0.18} height={0.26} rx={0.03} fill="#e11d2e" />
          <rect x={0.06} y={-0.06} width={0.1} height={0.12} fill="#7a0d16" />
        </g>
        <text x={f(cam.x)} y={f(cam.z + 0.45)} className="cod-studio-plan__label" textAnchor="middle">
          cámara · {cam.focalMm} mm
        </text>

        {selected ? (
          <text x={VIEW.x + 0.15} y={VIEW.y + VIEW.h - 0.15} className="cod-studio-plan__readout">
            {selected.name}: {Math.hypot(selected.x, selected.z).toFixed(1).replace(".", ",")} m del sujeto ·{" "}
            {Math.round(Math.atan2(selected.x, selected.z) * DEG)}° · altura {selected.y.toFixed(1).replace(".", ",")} m
          </text>
        ) : null}
      </svg>
    </div>
  );
}
