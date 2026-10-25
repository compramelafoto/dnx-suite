"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DEFAULT_WALL_HEIGHT_CM, HANGING_LIMITS, formatCm, hangingLayout, newWallId, unassignedWorks,
  type HangingPlan, type HangingWall,
} from "@repo/muestras";
import { guardarMontaje } from "@/lib/montaje/acciones";
import { boton, botonChico, campo, enlace } from "./estilos";

/** `marco`: la medida con marco que cargó quien expone (etapa 6, D38); se propone al colgarla. */
type Obra = { id: string; title: string; authorName: string; marco?: { widthCm: number; heightCm: number } | null };

/** Lo que escribió la persona, aceptando coma decimal. Si no es un número queda NaN y el servidor avisa. */
const numero = (v: string): number => Number(v.trim().replace(",", "."));
/** Para mostrar en un campo: vacío si todavía no es un número. */
const valorDeCampo = (n: number | null): string => (n == null || !Number.isFinite(n) ? "" : formatCm(n));

/**
 * Editor del plano de montaje: paredes, obras en orden con la medida del marco y una vista previa
 * a escala calculada igual que el PDF. Se guarda todo junto con "Guardar plano".
 */
export function EditorMontaje({ id, obras, planInicial }: { id: string; obras: Obra[]; planInicial: HangingPlan }) {
  const [plan, setPlan] = useState<HangingPlan>(planInicial);
  const [mensajes, setMensajes] = useState<{ tipo: "error" | "aviso" | "ok"; textos: string[] } | null>(null);
  const [pendiente, start] = useTransition();
  const sinPared = useMemo(() => unassignedWorks(plan, obras), [plan, obras]);
  const porId = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);
  // Lo último guardado, para saber si hay cambios sin guardar (el PDF sale de lo guardado).
  const [guardado, setGuardado] = useState(() => JSON.stringify(planInicial));
  const sinGuardar = JSON.stringify(plan) !== guardado;

  useEffect(() => {
    if (!sinGuardar) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sinGuardar]);

  const cambiarPared = (wid: string, cambio: (w: HangingWall) => HangingWall) =>
    setPlan((p) => ({ ...p, walls: p.walls.map((w) => (w.id === wid ? cambio(w) : w)) }));
  const agregarPared = () =>
    setPlan((p) => ({ ...p, walls: [...p.walls, { id: newWallId(), name: `Pared ${p.walls.length + 1}`, widthCm: 400, heightCm: null, items: [] }] }));
  const quitarPared = (w: HangingWall) => {
    const cuantas = w.items.length;
    if (cuantas > 0 && !window.confirm(`La pared "${w.name || "sin nombre"}" tiene ${cuantas === 1 ? "1 obra" : `${cuantas} obras`}. ¿La quitás igual? Las obras vuelven a quedar sin pared.`)) return;
    setPlan((p) => ({ ...p, walls: p.walls.filter((x) => x.id !== w.id) }));
  };
  const agregarObra = (wid: string, workId: string) => cambiarPared(wid, (w) => {
    const ultima = w.items.at(-1);
    // La medida que cargó quien expone, si la hay; si no, la de la obra anterior. Se puede cambiar.
    const marco = porId.get(workId)?.marco;
    return {
      ...w,
      items: [...w.items, { workId, frameWidthCm: marco?.widthCm ?? ultima?.frameWidthCm ?? 40, frameHeightCm: marco?.heightCm ?? ultima?.frameHeightCm ?? 50 }],
    };
  });
  const sacarObra = (wid: string, workId: string) => cambiarPared(wid, (w) => ({ ...w, items: w.items.filter((i) => i.workId !== workId) }));
  const cambiarMarco = (wid: string, workId: string, lado: "frameWidthCm" | "frameHeightCm", v: string) =>
    cambiarPared(wid, (w) => ({ ...w, items: w.items.map((i) => (i.workId === workId ? { ...i, [lado]: numero(v) } : i)) }));
  const mover = (wid: string, i: number, d: -1 | 1) => cambiarPared(wid, (w) => {
    const items = [...w.items];
    const j = i + d;
    if (j < 0 || j >= items.length) return w;
    [items[i], items[j]] = [items[j]!, items[i]!];
    return { ...w, items };
  });

  const guardar = () => start(async () => {
    const enviado = JSON.stringify(plan);
    const r = await guardarMontaje(id, enviado);
    if (!r.ok) {
      setMensajes({ tipo: "error", textos: r.errores });
      return;
    }
    setGuardado(enviado);
    setMensajes(r.avisos.length ? { tipo: "aviso", textos: ["Guardamos el plano.", ...r.avisos] } : { tipo: "ok", textos: ["Guardamos el plano."] });
  });

  return (
    <div className="space-y-10">
      <section aria-labelledby="t-centro" className="max-w-sm space-y-2">
        <label htmlFor="centro" id="t-centro" className="block text-[15px]">Línea de centro (cm desde el piso)</label>
        <input
          id="centro" inputMode="decimal" className={campo} defaultValue={valorDeCampo(plan.centerHeightCm)}
          onChange={(e) => { const v = numero(e.target.value); setPlan((p) => ({ ...p, centerHeightCm: v })); }}
        />
        <p className="text-sm text-[var(--mf-muted)]">
          La altura del centro de cada obra. 150 cm es lo más usado en museos. Entre {HANGING_LIMITS.center[0]} y {HANGING_LIMITS.center[1]} cm.
        </p>
      </section>

      {plan.walls.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-[15px] text-[var(--mf-muted)]">
          Todavía no cargaste paredes. Agregá una por cada pared de la sala y sumale las obras en el orden en que van a colgar, de izquierda a derecha.
        </p>
      ) : (
        <ol className="border-t border-[var(--mf-line)]">
          {plan.walls.map((w, iw) => {
            const l = hangingLayout(w, plan.centerHeightCm);
            return (
              <li key={w.id} className="space-y-5 border-b border-[var(--mf-line)] py-8">
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                  <label className="space-y-1 text-sm">
                    <span className="block text-[var(--mf-muted)]">Nombre de la pared</span>
                    <input className={campo} value={w.name} maxLength={HANGING_LIMITS.wallName} onChange={(e) => { const v = e.target.value; cambiarPared(w.id, (x) => ({ ...x, name: v })); }} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="block text-[var(--mf-muted)]">Ancho (cm)</span>
                    <input className={campo} inputMode="decimal" defaultValue={valorDeCampo(w.widthCm)} onChange={(e) => { const v = numero(e.target.value); cambiarPared(w.id, (x) => ({ ...x, widthCm: v })); }} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="block text-[var(--mf-muted)]">Alto (cm, optativo)</span>
                    <input
                      className={campo} inputMode="decimal" defaultValue={valorDeCampo(w.heightCm)}
                      onChange={(e) => { const t = e.target.value.trim(); cambiarPared(w.id, (x) => ({ ...x, heightCm: t === "" ? null : numero(t) })); }}
                    />
                  </label>
                </div>

                {w.items.length === 0 ? (
                  <p className="text-[15px] text-[var(--mf-muted)]">Esta pared todavía no tiene obras.</p>
                ) : (
                  <ol className="space-y-3">
                    {w.items.map((it, i) => (
                      <li key={it.workId} className="grid items-end gap-2 border-t border-[var(--mf-line)] pt-3 sm:grid-cols-[2rem_1fr_6rem_6rem_auto]">
                        <span className="text-sm text-[var(--mf-muted)]">{i + 1}.</span>
                        <span className="text-[15px]">{porId.get(it.workId)?.title ?? "Obra quitada"}</span>
                        <label className="space-y-1 text-sm">
                          <span className="block text-[var(--mf-muted)]">Marco ancho</span>
                          <input className={campo} inputMode="decimal" defaultValue={valorDeCampo(it.frameWidthCm)} onChange={(e) => cambiarMarco(w.id, it.workId, "frameWidthCm", e.target.value)} />
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="block text-[var(--mf-muted)]">Marco alto</span>
                          <input className={campo} inputMode="decimal" defaultValue={valorDeCampo(it.frameHeightCm)} onChange={(e) => cambiarMarco(w.id, it.workId, "frameHeightCm", e.target.value)} />
                        </label>
                        <div className="flex gap-2">
                          <button type="button" className={botonChico} disabled={i === 0} onClick={() => mover(w.id, i, -1)} aria-label={`Subir ${porId.get(it.workId)?.title ?? "obra"}`}>↑</button>
                          <button type="button" className={botonChico} disabled={i === w.items.length - 1} onClick={() => mover(w.id, i, 1)} aria-label={`Bajar ${porId.get(it.workId)?.title ?? "obra"}`}>↓</button>
                          <button type="button" className={botonChico} onClick={() => sacarObra(w.id, it.workId)}>Sacar</button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {sinPared.length > 0 && (
                  <label className="block max-w-sm space-y-1 text-sm">
                    <span className="block text-[var(--mf-muted)]">Sumar una obra</span>
                    <select className={campo} value="" onChange={(e) => { if (e.target.value) agregarObra(w.id, e.target.value); }}>
                      <option value="">Elegí una obra…</option>
                      {sinPared.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                    </select>
                  </label>
                )}

                <Alzado pared={w} centro={plan.centerHeightCm} />
                <p className="text-sm text-[var(--mf-muted)]">
                  {w.items.length > 0 && l.fits ? `Espacio entre obras: ${formatCm(l.gapCm)} cm` : null}
                </p>
                {l.warnings.length > 0 && (
                  <ul className="space-y-1 text-sm text-[var(--mf-alerta)]">
                    {l.warnings.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                )}
                <button type="button" className={botonChico} onClick={() => quitarPared(w)}>
                  Quitar pared {w.name ? `“${w.name}”` : iw + 1}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className={boton} onClick={agregarPared} disabled={plan.walls.length >= HANGING_LIMITS.walls}>Agregar pared</button>
        <button type="button" className={boton} onClick={guardar} disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar plano"}</button>
        {sinGuardar ? (
          <span aria-disabled="true" aria-describedby="aviso-sin-guardar" className={`${enlace} cursor-not-allowed opacity-50`}>
            Bajar el plano y la lista de montaje (PDF)
          </span>
        ) : (
          <a href={`/api/piezas/${encodeURIComponent(id)}/montaje`} className={enlace}>Bajar el plano y la lista de montaje (PDF)</a>
        )}
      </div>
      {sinGuardar ? (
        <p id="aviso-sin-guardar" role="status" className="text-sm text-[var(--mf-alerta)]">Guardá los cambios antes de bajar el plano.</p>
      ) : (
        <p className="text-sm text-[var(--mf-muted)]">El PDF sale del último plano guardado.</p>
      )}

      {mensajes && (
        <div
          role={mensajes.tipo === "error" ? "alert" : "status"}
          className={`space-y-1 border-t pt-4 text-[15px] ${mensajes.tipo === "error" ? "border-[var(--mf-alerta)] text-[var(--mf-alerta)]" : "border-[var(--mf-line)]"}`}
        >
          {mensajes.textos.map((t, i) => <p key={i} className={mensajes.tipo === "aviso" && i > 0 ? "text-[var(--mf-alerta)]" : undefined}>{t}</p>)}
        </div>
      )}
    </div>
  );
}

/** Vista previa de una pared, en centímetros: el mismo cálculo que el PDF. */
function Alzado({ pared, centro }: { pared: HangingWall; centro: number }) {
  const l = hangingLayout(pared, centro);
  const ancho = Math.max(Number.isFinite(pared.widthCm) ? pared.widthCm : 0, Number.isFinite(l.framesCm) ? l.framesCm : 0, 1);
  const altoPared = pared.heightCm != null && Number.isFinite(pared.heightCm) && pared.heightCm > 0 ? pared.heightCm : null;
  const tops = l.positions.map((p) => p.topCm + 20).filter(Number.isFinite);
  const alto = altoPared ?? Math.max(DEFAULT_WALL_HEIGHT_CM, ...tops);
  const ok = (n: number) => (Number.isFinite(n) ? n : 0);
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`Pared ${pared.name}: ${l.positions.length} obras`} className="h-auto w-full border-b-2 border-[var(--mf-ink)]">
      <rect x={0} y={0} width={Math.max(0, ok(pared.widthCm))} height={alto} fill="none" stroke="var(--mf-line)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <line x1={0} x2={ok(pared.widthCm)} y1={alto - ok(centro)} y2={alto - ok(centro)} stroke="var(--mf-muted)" strokeDasharray="6 3" vectorEffect="non-scaling-stroke" />
      {l.positions.map((p) => {
        if (![p.leftCm, p.topCm, p.widthCm, p.heightCm].every(Number.isFinite) || p.widthCm <= 0 || p.heightCm <= 0) return null;
        return (
          <g key={p.workId}>
            <rect x={p.leftCm} y={alto - p.topCm} width={p.widthCm} height={p.heightCm} fill="white" stroke="var(--mf-ink)" vectorEffect="non-scaling-stroke" />
            <text x={p.leftCm + p.widthCm / 2} y={alto - ok(centro)} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(p.widthCm, p.heightCm) * 0.4}>{p.number}</text>
          </g>
        );
      })}
    </svg>
  );
}
