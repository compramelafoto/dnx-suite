"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ESTADOS_ASISTENCIA, ESTADO_ETIQUETA, ESTADO_LETRA, horaArgentina, type EstadoAsistencia } from "@/lib/registro-docente/asistencia";
import {
  alConfirmarEnvio,
  cambiarHora,
  claveDePlanilla,
  completarPresentes,
  cuerpoDeEnvio,
  fusionarPlanilla,
  guardarPlanillaLocal,
  leerPlanillasLocales,
  marcar,
  marcarHoraDocente,
  marcarSinClase,
  planillaVacia,
  resumen,
  type Planilla,
} from "@/lib/registro-docente/cola-asistencia";
import { esFalloDeConexion } from "@/lib/eventos/acreditacion/ui/offline-queue";
import type { DatosPasarLista } from "@/lib/registro-docente/servidor";

/** Cada cuánto reintenta solo mientras quede algo sin mandar (ms). */
const REINTENTO_MS = 30_000;

const COLOR: Record<EstadoAsistencia, string> = {
  PRESENTE: "bg-[var(--fo-success)] text-white border-[var(--fo-success)]",
  AUSENTE: "bg-[var(--fo-danger)] text-white border-[var(--fo-danger)]",
  TARDE: "bg-[var(--fo-warning)] text-white border-[var(--fo-warning)]",
  RETIRO: "bg-[var(--fo-accent)] text-white border-[var(--fo-accent)]",
  JUSTIFICADA: "bg-[var(--fo-text-secondary)] text-white border-[var(--fo-text-secondary)]",
};

function sumarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fechaLarga(iso: string): string {
  const t = new Date(`${iso}T12:00:00.000Z`).toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Planillas que vinieron del servidor, por clave. */
function planillasDelServidor(cursos: DatosPasarLista): Map<string, Planilla> {
  const m = new Map<string, Planilla>();
  for (const c of cursos) {
    for (const k of c.clases) {
      m.set(claveDePlanilla(c.id, k.fecha), {
        cursoId: c.id,
        fecha: k.fecha,
        sinClase: k.sinClase,
        motivo: k.motivo,
        horaDocente: k.horaDocente,
        registros: Object.fromEntries(k.registros.map((r) => [r.estudianteId, { estado: r.estado, horaLlegada: r.horaLlegada, anotadaAt: r.anotadaAt }])),
        pendiente: false,
        error: null,
      });
    }
  }
  return m;
}

export function PasarLista({ cursos, hoy }: { cursos: DatosPasarLista; hoy: string }) {
  const [cursoId, setCursoId] = useState(cursos[0]?.id ?? "");
  const [fecha, setFecha] = useState(hoy);
  const [planillas, setPlanillas] = useState<Map<string, Planilla>>(() => planillasDelServidor(cursos));
  const [listo, setListo] = useState(false);
  const [enLinea, setEnLinea] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const planillasRef = useRef(planillas);
  const enviandoRef = useRef(false);

  // Al abrir: junta lo del servidor con lo que quedó guardado en el celular sin mandar.
  useEffect(() => {
    const locales = leerPlanillasLocales();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el almacenamiento del celular sólo existe al montar
    setPlanillas((prev) => {
      const m = new Map(prev);
      for (const l of locales) {
        const k = claveDePlanilla(l.cursoId, l.fecha);
        const f = fusionarPlanilla(m.get(k), l);
        if (f) m.set(k, f);
      }
      return m;
    });
    setEnLinea(navigator.onLine);
    setListo(true);
  }, []);

  useEffect(() => {
    planillasRef.current = planillas;
    if (!listo) return;
    for (const p of planillas.values()) guardarPlanillaLocal(p);
  }, [planillas, listo]);

  const enviar = useCallback(async () => {
    if (enviandoRef.current) return;
    const pendientes = [...planillasRef.current.values()].filter((p) => p.pendiente && !p.error);
    if (!pendientes.length) return;
    enviandoRef.current = true;
    setEnviando(true);
    let sinConexion = false;
    for (const p of pendientes) {
      try {
        const res = await fetch("/api/registro-docente/asistencia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cuerpoDeEnvio(p)),
        });
        if (res.ok) {
          setPlanillas((prev) => {
            const m = new Map(prev);
            const k = claveDePlanilla(p.cursoId, p.fecha);
            const actual = m.get(k);
            if (actual) m.set(k, alConfirmarEnvio(actual, p));
            return m;
          });
        } else {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          setPlanillas((prev) => {
            const m = new Map(prev);
            const k = claveDePlanilla(p.cursoId, p.fecha);
            const actual = m.get(k);
            if (actual) m.set(k, { ...actual, error: json.error ?? `Error ${res.status}` });
            return m;
          });
        }
      } catch (e) {
        if (esFalloDeConexion(e)) {
          sinConexion = true;
          break;
        }
        throw e;
      }
    }
    setMensaje(sinConexion ? "Sin señal: la lista queda guardada en este celular y se manda sola cuando vuelva." : null);
    if (sinConexion) setEnLinea(false);
    enviandoRef.current = false;
    setEnviando(false);
  }, []);

  useEffect(() => {
    const alVolver = () => {
      setEnLinea(true);
      void enviar();
    };
    const alCaer = () => setEnLinea(false);
    window.addEventListener("online", alVolver);
    window.addEventListener("offline", alCaer);
    return () => {
      window.removeEventListener("online", alVolver);
      window.removeEventListener("offline", alCaer);
    };
  }, [enviar]);

  const pendientes = [...planillas.values()].filter((p) => p.pendiente);
  const conError = pendientes.filter((p) => p.error);
  const hayPendientes = pendientes.some((p) => !p.error);

  // Manda apenas hay algo nuevo, y reintenta cada 30 s: el wifi de la escuela a veces «está» pero
  // no sale a internet, y ahí el aviso de «volvió la conexión» nunca llega.
  useEffect(() => {
    if (!listo || !hayPendientes) return;
    const primero = setTimeout(() => void enviar(), 800);
    const id = setInterval(() => void enviar(), REINTENTO_MS);
    return () => {
      clearTimeout(primero);
      clearInterval(id);
    };
  }, [listo, hayPendientes, planillas, enviar]);

  const curso = cursos.find((c) => c.id === cursoId);
  const estudiantes = useMemo(
    () => (curso ? curso.estudiantes.filter((e) => !e.baja || e.baja > fecha) : []),
    [curso, fecha],
  );
  const ids = useMemo(() => estudiantes.map((e) => e.id), [estudiantes]);
  const clave = claveDePlanilla(cursoId, fecha);
  const planilla = planillas.get(clave) ?? planillaVacia(cursoId, fecha);
  const cuenta = resumen(planillas.get(clave), ids);

  const actualizar = (f: (p: Planilla) => Planilla) =>
    setPlanillas((prev) => {
      const m = new Map(prev);
      m.set(clave, f(m.get(clave) ?? planillaVacia(cursoId, fecha)));
      return m;
    });

  if (!cursos.length) {
    return <div className="fo-card p-6 text-sm text-[var(--fo-muted)]">Primero cargá una escuela y sus cursos en «Escuelas y cursos».</div>;
  }

  return (
    <div className="space-y-4">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm ${enLinea ? "border-[var(--fo-border)]" : "border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)]"}`}
        role="status"
      >
        <span>
          {enLinea ? "● Con conexión" : "○ Sin señal"}
          {pendientes.length ? ` · ${pendientes.length} ${pendientes.length === 1 ? "lista sin mandar" : "listas sin mandar"}` : listo ? " · Todo guardado" : ""}
          {enviando ? " · Mandando…" : ""}
        </span>
        {hayPendientes ? (
          <button type="button" onClick={() => void enviar()} className="fo-btn fo-btn-secondary text-sm min-h-9">
            Mandar ahora
          </button>
        ) : null}
      </div>
      {mensaje ? <p className="fo-alert-warning text-sm">{mensaje}</p> : null}
      {conError.map((p) => (
        <div key={claveDePlanilla(p.cursoId, p.fecha)} className="fo-alert-error flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            {cursos.find((c) => c.id === p.cursoId)?.nombre ?? "Curso"} ({p.fecha.split("-").reverse().join("/")}): {p.error}
          </span>
          <button
            type="button"
            className="fo-btn fo-btn-secondary text-sm min-h-9"
            onClick={() =>
              setPlanillas((prev) => {
                const m = new Map(prev);
                m.set(claveDePlanilla(p.cursoId, p.fecha), { ...p, error: null });
                return m;
              })
            }
          >
            Reintentar
          </button>
        </div>
      ))}

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Curso">
        {cursos.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === cursoId}
            onClick={() => setCursoId(c.id)}
            className={`shrink-0 rounded-full border px-3 py-2 text-sm ${c.id === cursoId ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)] font-medium" : "border-[var(--fo-border)]"}`}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setFecha(sumarDias(fecha, -1))} className="fo-btn fo-btn-secondary min-h-10 px-3" aria-label="Día anterior">
          ‹
        </button>
        <input type="date" value={fecha} max={hoy} onChange={(e) => e.target.value && setFecha(e.target.value)} className="fo-input flex-1" aria-label="Fecha de la clase" />
        <button type="button" onClick={() => setFecha(sumarDias(fecha, 1))} disabled={fecha >= hoy} className="fo-btn fo-btn-secondary min-h-10 px-3" aria-label="Día siguiente">
          ›
        </button>
      </div>
      <p className="text-sm text-[var(--fo-muted)]">
        {fechaLarga(fecha)}
        {curso ? ` · ${curso.escuela}` : ""}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="hora-docente">Llegué a las</label>
        <input
          id="hora-docente"
          type="time"
          value={planilla.horaDocente ?? ""}
          onChange={(e) => actualizar((p) => marcarHoraDocente(p, e.target.value || null, new Date()))}
          className="fo-input w-28 py-1"
        />
        {!planilla.horaDocente ? (
          <button type="button" onClick={() => actualizar((p) => marcarHoraDocente(p, horaArgentina(), new Date()))} className="fo-btn fo-btn-secondary text-sm min-h-9">
            Ahora
          </button>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={planilla.sinClase} onChange={(e) => actualizar((p) => marcarSinClase(p, e.target.checked, p.motivo, new Date()))} />
        No hubo clase (paro, jornada, feriado, licencia)
      </label>
      {planilla.sinClase ? (
        <input
          value={planilla.motivo ?? ""}
          maxLength={120}
          onChange={(e) => actualizar((p) => marcarSinClase(p, true, e.target.value, new Date()))}
          placeholder="Motivo"
          className="fo-input w-full"
        />
      ) : (
        <>
          <p className="text-sm">
            <strong>{cuenta.PRESENTE + cuenta.sinMarcar}</strong> presentes · <strong>{cuenta.AUSENTE}</strong> ausentes · <strong>{cuenta.TARDE}</strong> tarde
            {cuenta.RETIRO ? ` · ${cuenta.RETIRO} se retiraron` : ""}
            {cuenta.JUSTIFICADA ? ` · ${cuenta.JUSTIFICADA} justificadas` : ""}
          </p>
          {estudiantes.length === 0 ? (
            <p className="fo-card p-4 text-sm text-[var(--fo-muted)]">Este curso todavía no tiene padrón.</p>
          ) : (
            <ul className="divide-y rounded border border-[var(--fo-border)]">
              {estudiantes.map((e, i) => {
                const r = planilla.registros[e.id];
                const estado: EstadoAsistencia = r?.estado ?? "PRESENTE";
                return (
                  <li key={e.id} className="space-y-2 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm">
                        <span className="text-[var(--fo-muted)]">{i + 1}.</span> {e.nombre}
                      </span>
                      {estado === "TARDE" ? (
                        <input
                          type="time"
                          value={r?.horaLlegada ?? ""}
                          onChange={(ev) => ev.target.value && actualizar((p) => cambiarHora(p, e.id, ev.target.value, new Date()))}
                          className="fo-input w-28 py-1 text-sm"
                          aria-label={`Hora de llegada de ${e.nombre}`}
                        />
                      ) : null}
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {ESTADOS_ASISTENCIA.map((s) => (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={estado === s}
                          title={ESTADO_ETIQUETA[s]}
                          onClick={() => actualizar((p) => marcar(p, ids, e.id, s, new Date(), s === "TARDE" ? horaArgentina() : null))}
                          className={`min-h-10 rounded border text-sm font-semibold ${estado === s ? COLOR[s] : "border-[var(--fo-border)] text-[var(--fo-muted)]"}`}
                        >
                          <span aria-hidden>{ESTADO_LETRA[s]}</span>
                          <span className="sr-only">{ESTADO_ETIQUETA[s]}</span>
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {estudiantes.length && Object.keys(planilla.registros).length === 0 ? (
            <button type="button" onClick={() => actualizar((p) => completarPresentes(p, ids, new Date()))} className="fo-btn fo-btn-primary w-full">
              Guardar: vinieron todos
            </button>
          ) : null}
          <p className="text-xs text-[var(--fo-muted)]">P presente · A ausente · T tarde (anota la hora) · R se retiró · J justificada</p>
        </>
      )}
    </div>
  );
}
