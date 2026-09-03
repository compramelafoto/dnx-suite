"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { updateTimelineRangeAction } from "@/lib/timeline/admin-actions";

/**
 * Los horarios de la edición, como barras en una línea de tiempo.
 *
 * Cargar fechas sueltas en campos no deja ver si la entrega cierra antes de que
 * termine la toma. Acá se ve, y se corrige arrastrando.
 *
 * Solo edita cronogramas en borrador. Sobre uno activo la vista es de lectura,
 * igual que el resto del panel.
 */

export type TramoUI = {
  id: string;
  nombre: string;
  ayuda: string;
  desdeEventId: string | null;
  hastaEventId: string | null;
  desde: string | null;
  hasta: string | null;
  esHito: boolean;
  color: string;
  problema: string | null;
};

const DIA_MS = 86_400_000;
/** Los horarios de un evento se piensan en cuartos de hora. */
const PASO_MS = 15 * 60 * 1000;
const MINIMO_MS = PASO_MS;

type Modo = "mover" | "inicio" | "fin";

type Arrastre = {
  id: string;
  modo: Modo;
  x0: number;
  desde0: number;
  hasta0: number;
  msPorPx: number;
  vista: { inicio: number; fin: number };
};

function ms(v: string | null): number {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function medianoche(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function redondear(t: number): number {
  return Math.round(t / PASO_MS) * PASO_MS;
}

/** ISO local, sin pasar por UTC: si no, el horario se corre. */
function aIso(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fechaCorta(t: number): string {
  return new Date(t).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function hora(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function TimelineBars({
  editionId,
  tramos: tramosIniciales,
  editable,
  anclaDia,
}: {
  editionId: string;
  tramos: TramoUI[];
  editable: boolean;
  /** Fecha del día del evento, para la vista de un día. */
  anclaDia: string | null;
}) {
  const [tramos, setTramos] = useState(tramosIniciales);
  const [escala, setEscala] = useState<"todo" | "dia">("todo");
  const [diaFoco, setDiaFoco] = useState<number | null>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [guardando, startTransition] = useTransition();

  useEffect(() => setTramos(tramosIniciales), [tramosIniciales]);

  const calculada = useMemo(() => {
    if (escala === "dia") {
      const base = diaFoco ?? medianoche(ms(anclaDia));
      return { inicio: base, fin: base + DIA_MS };
    }
    const puntos = tramos.flatMap((t) => [ms(t.desde), ms(t.hasta)]).filter(Boolean);
    if (puntos.length === 0) {
      const hoy = medianoche(Date.now());
      return { inicio: hoy, fin: hoy + DIA_MS };
    }
    return {
      inicio: medianoche(Math.min(...puntos)),
      fin: medianoche(Math.max(...puntos)) + DIA_MS,
    };
  }, [tramos, escala, diaFoco, anclaDia]);

  // Durante el arrastre la escala queda congelada: si se recalculara, la barra
  // saltaría debajo del dedo al cruzar la medianoche.
  const inicio = arrastre?.vista.inicio ?? calculada.inicio;
  const fin = arrastre?.vista.fin ?? calculada.fin;
  const total = fin - inicio;

  const dias = useMemo(() => {
    const lista: number[] = [];
    for (let d = inicio; d < fin; d += DIA_MS) lista.push(d);
    return lista;
  }, [inicio, fin]);

  const pct = useCallback((t: number) => `${((t - inicio) / total) * 100}%`, [inicio, total]);

  const mover = useCallback(
    (id: string, modo: Modo, deltaMs: number, desde0: number, hasta0: number) => {
      setTramos((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          if (t.esHito || modo === "mover") {
            const d = redondear(desde0 + deltaMs);
            return {
              ...t,
              desde: aIso(d),
              hasta: t.esHito ? aIso(d) : aIso(redondear(hasta0 + deltaMs)),
            };
          }
          if (modo === "inicio") {
            return { ...t, desde: aIso(Math.min(redondear(desde0 + deltaMs), hasta0 - MINIMO_MS)) };
          }
          return { ...t, hasta: aIso(Math.max(redondear(hasta0 + deltaMs), desde0 + MINIMO_MS)) };
        }),
      );
    },
    [],
  );

  const guardar = useCallback(
    (tramo: TramoUI) => {
      if (!editable) return;
      const datos = new FormData();
      if (tramo.desdeEventId && tramo.desde) {
        datos.set(`evento:${tramo.desdeEventId}`, tramo.desde);
      }
      if (!tramo.esHito && tramo.hastaEventId && tramo.hasta) {
        datos.set(`evento:${tramo.hastaEventId}`, tramo.hasta);
      }
      if ([...datos.keys()].length === 0) return;
      startTransition(() => {
        void updateTimelineRangeAction(editionId, datos);
      });
    },
    [editable, editionId],
  );

  useEffect(() => {
    if (!arrastre) return;
    const onMove = (e: PointerEvent) => {
      mover(
        arrastre.id,
        arrastre.modo,
        (e.clientX - arrastre.x0) * arrastre.msPorPx,
        arrastre.desde0,
        arrastre.hasta0,
      );
    };
    const onUp = () => {
      setArrastre(null);
      setTramos((actuales) => {
        const tocado = actuales.find((t) => t.id === arrastre.id);
        if (tocado) guardar(tocado);
        return actuales;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [arrastre, guardar, mover]);

  function empezar(e: React.PointerEvent, t: TramoUI, modo: Modo) {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const track = e.currentTarget.closest("[data-track]") as HTMLElement | null;
    if (!track) return;
    setArrastre({
      id: t.id,
      modo,
      x0: e.clientX,
      desde0: ms(t.desde),
      hasta0: ms(t.hasta),
      msPorPx: total / (track.clientWidth || 1),
      vista: { inicio, fin },
    });
  }

  function teclado(e: React.KeyboardEvent, t: TramoUI) {
    if (!editable) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const paso = (e.shiftKey ? PASO_MS * 4 : PASO_MS) * (e.key === "ArrowLeft" ? -1 : 1);
    mover(t.id, e.altKey ? "fin" : "mover", paso, ms(t.desde), ms(t.hasta));
    setTramos((actuales) => {
      const tocado = actuales.find((x) => x.id === t.id);
      if (tocado) guardar(tocado);
      return actuales;
    });
  }

  const problemas = tramos.filter((t) => t.problema).length;

  return (
    <Card variant="outlined" className="min-w-0 space-y-4 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Línea de tiempo</h2>
          <p className="text-sm text-ck-text-secondary">
            {editable
              ? "Arrastrá una barra para mover el horario, o tomá un borde para cambiar solo el comienzo o el final."
              : "Vista del cronograma activo. Para editarlo, creá un borrador."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "todo", label: "Toda la edición" },
              { id: "dia", label: "Un día" },
            ] as const
          ).map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => {
                setEscala(op.id);
                if (op.id === "dia") setDiaFoco((d) => d ?? medianoche(ms(anclaDia)));
              }}
              className={`rounded-full border px-3 py-1 text-xs ${
                escala === op.id
                  ? "border-ck-yellow bg-ck-yellow text-ck-text-on-brand"
                  : "border-ck-border text-ck-text-secondary hover:border-ck-yellow/60"
              }`}
            >
              {op.label}
            </button>
          ))}
          {escala === "dia" ? (
            <span className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Día anterior"
                onClick={() => setDiaFoco((d) => (d ?? inicio) - DIA_MS)}
                className="rounded-full border border-ck-border px-2 py-1 text-xs text-ck-text-secondary hover:border-ck-yellow/60"
              >
                ‹
              </button>
              <span className="min-w-[7.5rem] text-center text-xs tabular-nums text-ck-text">
                {fechaCorta(inicio)}
              </span>
              <button
                type="button"
                aria-label="Día siguiente"
                onClick={() => setDiaFoco((d) => (d ?? inicio) + DIA_MS)}
                className="rounded-full border border-ck-border px-2 py-1 text-xs text-ck-text-secondary hover:border-ck-yellow/60"
              >
                ›
              </button>
            </span>
          ) : null}
        </div>
      </div>

      <div className={`space-y-3 ${arrastre ? "select-none" : ""}`}>
        <div className="grid grid-cols-[7.5rem_1fr] gap-3 sm:grid-cols-[11rem_1fr_8.5rem]">
          <span />
          <div className="relative h-6 border-b border-ck-border">
            {dias.map((d) => (
              <div
                key={d}
                className="absolute top-0 h-6 overflow-hidden border-l border-ck-border pl-1.5 text-[10px] uppercase tracking-[0.08em] text-ck-text-muted"
                style={{ left: pct(d), width: `${(DIA_MS / total) * 100}%` }}
              >
                {fechaCorta(d)}
              </div>
            ))}
          </div>
          <span className="hidden sm:block" />
        </div>

        {tramos.map((t) => {
          const desde = ms(t.desde);
          const hasta = t.esHito ? desde : ms(t.hasta);
          const sinFecha = !desde;
          const fuera = !sinFecha && (hasta < inicio || desde > fin);
          const empiezaAntes = desde < inicio;
          const terminaDespues = hasta > fin;
          const ancho = ((Math.min(hasta, fin) - Math.max(desde, inicio)) / total) * 100;
          const arrastrando = arrastre?.id === t.id;

          return (
            <div
              key={t.id}
              className="grid grid-cols-[7.5rem_1fr] items-center gap-3 sm:grid-cols-[11rem_1fr_8.5rem]"
            >
              <span className="truncate text-xs text-ck-text-secondary" title={t.ayuda}>
                {t.nombre}
              </span>

              <div data-track className="relative h-8 rounded bg-ck-surface-muted">
                {dias.map((d) => (
                  <span
                    key={d}
                    aria-hidden
                    className="absolute top-0 h-full border-l border-ck-border/60"
                    style={{ left: pct(d) }}
                  />
                ))}

                {sinFecha ? (
                  <span className="absolute inset-y-1 left-2 flex items-center text-[11px] text-ck-text-muted">
                    sin cargar
                  </span>
                ) : fuera ? (
                  <span className="absolute inset-y-1 left-2 flex items-center text-[11px] text-ck-text-muted">
                    fuera de esta vista
                  </span>
                ) : t.esHito ? (
                  <span
                    role="slider"
                    tabIndex={editable ? 0 : -1}
                    aria-label={`${t.nombre}: ${hora(t.desde)}`}
                    aria-valuetext={hora(t.desde)}
                    aria-valuenow={desde}
                    aria-valuemin={inicio}
                    aria-valuemax={fin}
                    onPointerDown={(e) => empezar(e, t, "mover")}
                    onKeyDown={(e) => teclado(e, t)}
                    style={{ left: pct(desde), background: t.color, touchAction: "none" }}
                    className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ck-yellow ${
                      editable ? "cursor-grab" : ""
                    } ${arrastrando ? "cursor-grabbing ring-2 ring-white/70" : ""}`}
                  />
                ) : (
                  <span
                    role="slider"
                    tabIndex={editable ? 0 : -1}
                    aria-label={`${t.nombre}: de ${hora(t.desde)} a ${hora(t.hasta)}`}
                    aria-valuetext={`${hora(t.desde)} a ${hora(t.hasta)}`}
                    aria-valuenow={desde}
                    aria-valuemin={inicio}
                    aria-valuemax={fin}
                    onPointerDown={(e) => empezar(e, t, "mover")}
                    onKeyDown={(e) => teclado(e, t)}
                    style={{
                      left: pct(Math.min(Math.max(desde, inicio), fin)),
                      width: `${Math.min(Math.max(ancho, 1.2), 100)}%`,
                      background: t.problema ? "var(--ck-danger)" : t.color,
                      touchAction: "none",
                    }}
                    className={`absolute inset-y-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ck-yellow ${
                      editable ? "cursor-grab" : ""
                    } ${arrastrando ? "cursor-grabbing ring-2 ring-white/70" : ""}`}
                  >
                    {/* El área de agarre es más ancha que la marca visible. */}
                    {!empiezaAntes && editable ? (
                      <span
                        aria-hidden
                        onPointerDown={(e) => empezar(e, t, "inicio")}
                        style={{ touchAction: "none" }}
                        className="absolute -left-3 top-1/2 flex h-10 w-6 -translate-y-1/2 cursor-ew-resize items-center justify-center"
                      >
                        <span className="h-4 w-1 rounded-full bg-black/55" />
                      </span>
                    ) : empiezaAntes ? (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 flex items-center pl-0.5 text-[10px] text-black/70"
                      >
                        ◀
                      </span>
                    ) : null}
                    {!terminaDespues && editable ? (
                      <span
                        aria-hidden
                        onPointerDown={(e) => empezar(e, t, "fin")}
                        style={{ touchAction: "none" }}
                        className="absolute -right-3 top-1/2 flex h-10 w-6 -translate-y-1/2 cursor-ew-resize items-center justify-center"
                      >
                        <span className="h-4 w-1 rounded-full bg-black/55" />
                      </span>
                    ) : terminaDespues ? (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 right-0 flex items-center pr-0.5 text-[10px] text-black/70"
                      >
                        ▶
                      </span>
                    ) : null}
                  </span>
                )}
              </div>

              <span
                className={`col-span-2 text-[11px] tabular-nums sm:col-span-1 sm:text-right ${
                  arrastrando
                    ? "text-ck-yellow"
                    : t.problema
                      ? "text-[var(--ck-danger)]"
                      : "text-ck-text-muted"
                }`}
              >
                {t.esHito ? hora(t.desde) : `${hora(t.desde)} → ${hora(t.hasta)}`}
              </span>
            </div>
          );
        })}
      </div>

      <p
        className={`text-xs ${problemas ? "text-[var(--ck-danger)]" : "text-ck-text-muted"}`}
        role="status"
      >
        {guardando
          ? "Guardando…"
          : problemas
            ? `${problemas} ${problemas === 1 ? "horario tiene" : "horarios tienen"} un problema. Revisá el detalle abajo.`
            : "Todos los horarios cierran bien."}
      </p>
      {editable ? (
        <p className="text-[11px] text-ck-text-muted">
          Se mueve de a 15 minutos. Con el teclado: Tab hasta la barra, flechas para moverla,
          Shift para ir de a una hora, Alt para correr solo el final.
        </p>
      ) : null}
    </Card>
  );
}
