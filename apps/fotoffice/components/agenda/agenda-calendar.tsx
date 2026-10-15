"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { moverCitaAction } from "@/app/actions/agenda";
import { CalendarToolbar } from "@/components/bookings/calendar/calendar-toolbar";
import { MiniMonth } from "@/components/bookings/calendar/mini-month";
import { TimeGrid, minuteToPx } from "@/components/bookings/calendar/time-grid";
import { DialogoCita, type DatosDialogo } from "@/components/agenda/dialogo-cita";
import { COLOR_CAPA, ETIQUETA_CAPA, type ClaveCapa } from "@/lib/agenda/constantes";
import { diaArgentina, inicioDelDia, instanteArgentina, sumarDias } from "@/lib/agenda/fechas";
import {
  ETIQUETA_VISTA,
  VISTAS_PANTALLA,
  conservarDeLaDireccion,
  correrEvento,
  desplazamiento,
  diasDeTodoElDia,
  direccionAgenda,
  horaDeMinuto,
  leerCapasGuardadas,
  limitesDeHoras,
  minutosDesdeInicioDelDia,
  redondear,
  segmentosDelEvento,
  type Segmento,
  type VistaPantalla,
} from "@/lib/agenda/vista-cliente";
import type { DetalleCita, EventoVista } from "@/lib/agenda/vista-tipos";
import { dayNumberYmd, layoutOverlaps, sameMonthYmd, visibleDays, weekdayIndexYmd, type CalendarView } from "@/lib/bookings/calendar-view";

type EventoCal = Omit<EventoVista, "inicio" | "fin"> & { inicio: Date; fin: Date };

const DIA_CORTO = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const ALTO_HORA = 48;
const CLAVE_CAPAS = "fo-agenda-capas";
const NADA: Record<string, { inicio: Date; fin: Date }> = {};

const FECHA_LARGA = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

type Tipo = { id: string; name: string; color: string; isActive?: boolean };

// ── Capas encendidas ──
// Preferencia de quien mira, en su navegador. Si no deja guardar (ventana privada, datos bloqueados),
// vive en memoria mientras dure la visita.
const oyentes = new Set<() => void>();
let enMemoria = "";

function leerCapas(): string {
  try {
    return window.localStorage.getItem(CLAVE_CAPAS) ?? enMemoria;
  } catch {
    return enMemoria;
  }
}

function guardarCapas(claves: ClaveCapa[]) {
  enMemoria = JSON.stringify(claves);
  try {
    window.localStorage.setItem(CLAVE_CAPAS, enMemoria);
  } catch {
    // Queda en memoria.
  }
  for (const avisar of oyentes) avisar();
}

function suscribirCapas(avisar: () => void) {
  oyentes.add(avisar);
  window.addEventListener("storage", avisar);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener("storage", avisar);
  };
}

export type PropiedadesAgenda = {
  vista: VistaPantalla;
  vistaCalendario: CalendarView;
  ymd: string;
  todayYmd: string;
  nowMinute: number;
  eventos: EventoVista[];
  capasDisponibles: ClaveCapa[];
  capasIniciales: ClaveCapa[];
  truncadas: ClaveCapa[];
  citas: DetalleCita[];
  tipos: Tipo[];
  equipo: { id: number; nombre: string }[];
  roles: { id: string; nombre: string }[];
  puedeGestionar: boolean;
  puedeContactos: boolean;
  yoId: number;
  responsable: number | null;
  /** Dirección de esta vista sin `cita` ni `nueva`, para limpiar la barra al cerrar el diálogo. */
  direccionLimpia: string;
  dialogoInicial: DatosDialogo | null;
};

/**
 * La agenda del equipo con forma de Google Calendar, armada con las mismas piezas que la de Reservas
 * (mes en miniatura, barra de navegación y grilla por horas) pero con capas: las citas del equipo
 * (que se crean, se editan y se arrastran con "Gestionar") y, encima, lo que viene de los demás
 * módulos, que es de sólo lectura y lleva a su ficha al tocarlo.
 */
export function AgendaCalendar(p: PropiedadesAgenda) {
  const router = useRouter();
  const { vista, vistaCalendario, ymd, todayYmd, puedeGestionar } = p;

  const guardadas = useSyncExternalStore(suscribirCapas, leerCapas, () => "");
  const activas = useMemo(() => {
    const l = leerCapasGuardadas(guardadas) ?? p.capasIniciales;
    return l.filter((c) => p.capasDisponibles.includes(c));
  }, [guardadas, p.capasIniciales, p.capasDisponibles]);
  const alternarCapa = (c: ClaveCapa) => guardarCapas(activas.includes(c) ? activas.filter((x) => x !== c) : [...activas, c]);

  const [dialogo, setDialogo] = useState<DatosDialogo | null>(p.dialogoInicial);
  // Posiciones provisorias de las citas recién movidas, válidas mientras no lleguen datos nuevos del servidor.
  const [provisorias, setProvisorias] = useState<{ para: EventoVista[]; mapa: Record<string, { inicio: Date; fin: Date }> }>({ para: p.eventos, mapa: {} });
  const movidas = provisorias.para === p.eventos ? provisorias.mapa : NADA;
  const [arrastre, setArrastre] = useState<{ id: string; deltaMs: number } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const citasPorId = useMemo(() => new Map(p.citas.map((c) => [c.id, c])), [p.citas]);
  const eventos = useMemo<EventoCal[]>(
    () =>
      p.eventos
        .filter((e) => activas.includes(e.capa))
        .map((e) => {
          const base = { ...e, inicio: new Date(e.inicio), fin: new Date(e.fin) };
          const mov = movidas[e.id];
          if (mov) return { ...base, ...mov };
          if (arrastre && arrastre.id === e.id) return { ...base, ...correrEvento(base.inicio, base.fin, arrastre.deltaMs) };
          return base;
        }),
    [p.eventos, activas, movidas, arrastre],
  );
  const porId = useMemo(() => new Map(eventos.map((e) => [e.id, e])), [eventos]);

  const dias = useMemo(() => visibleDays(vistaCalendario, ymd), [vistaCalendario, ymd]);
  const conservar = conservarDeLaDireccion(vista, p.responsable);

  function abrir(e: EventoCal) {
    if (e.capa === "CITAS") {
      const cita = citasPorId.get(e.id.slice("cita:".length));
      if (cita) {
        setDialogo({ modo: "editar", cita });
        return;
      }
    }
    router.push(e.href);
  }

  function abrirCrear(dia: string, minuto: number | null) {
    if (!puedeGestionar) return;
    if (minuto === null) {
      setDialogo({ modo: "crear", inicio: inicioDelDia(dia).toISOString(), fin: inicioDelDia(sumarDias(dia, 1)).toISOString(), todoElDia: true });
      return;
    }
    const inicio = instanteArgentina(dia, minuto);
    setDialogo({ modo: "crear", inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + 60 * 60_000).toISOString(), todoElDia: false });
  }

  function cerrarDialogo(refrescar: boolean) {
    setDialogo(null);
    if (p.dialogoInicial) router.replace(p.direccionLimpia);
    if (refrescar) router.refresh();
  }

  /** Mueve una cita `deltaMs` (conserva su duración); la posición nueva se ve de inmediato. */
  function mover(e: EventoCal, deltaMs: number) {
    if (!puedeGestionar || !e.editable || deltaMs === 0) return;
    const original = p.eventos.find((x) => x.id === e.id);
    const base = original ? { inicio: new Date(original.inicio), fin: new Date(original.fin) } : { inicio: e.inicio, fin: e.fin };
    const nuevo = correrEvento(base.inicio, base.fin, deltaMs);
    const delServidor = p.eventos;
    const actualizar = (cambio: (mapa: Record<string, { inicio: Date; fin: Date }>) => Record<string, { inicio: Date; fin: Date }>) =>
      setProvisorias((prev) => ({ para: delServidor, mapa: cambio(prev.para === delServidor ? prev.mapa : {}) }));
    actualizar((mapa) => ({ ...mapa, [e.id]: nuevo }));
    setAviso(null);
    const deshacer = (mensaje: string) => {
      actualizar((mapa) => {
        const resto = { ...mapa };
        delete resto[e.id];
        return resto;
      });
      setAviso(mensaje);
    };
    moverCitaAction(e.id.slice("cita:".length), { startAt: nuevo.inicio.toISOString(), endAt: nuevo.fin.toISOString(), allDay: e.todoElDia })
      .then((r) => (r.ok ? router.refresh() : deshacer(r.error)))
      .catch(() => deshacer("No se pudo mover la cita. Probá de nuevo."));
  }

  // ── Arrastre con el mouse en la grilla por horas ──
  const { startHour, endHour } = useMemo(() => {
    const segs = eventos.filter((e) => !e.todoElDia).flatMap((e) => segmentosDelEvento(e.inicio, e.fin, dias));
    return limitesDeHoras(segs);
  }, [eventos, dias]);

  function empezarArrastre(ev: React.PointerEvent, e: EventoCal, seg: Segmento) {
    if (!puedeGestionar || !e.editable || ev.button !== 0 || ev.pointerType === "touch") return;
    const columnas = () => Array.from(gridRef.current?.querySelectorAll<HTMLElement>("[data-col]") ?? []);
    const inicial = columnas().find((c) => c.dataset.col === seg.ymd);
    if (!inicial) return;
    const minutoDe = (y: number, rect: DOMRect) => startHour * 60 + ((y - rect.top) / ALTO_HORA) * 60;
    const agarre = minutoDe(ev.clientY, inicial.getBoundingClientRect()) - seg.desde;
    const x0 = ev.clientX;
    const y0 = ev.clientY;
    let movido = false;
    let delta = 0;
    let actual = inicial;

    const alMover = (m: PointerEvent) => {
      if (!movido && Math.hypot(m.clientX - x0, m.clientY - y0) < 5) return;
      movido = true;
      actual =
        columnas().find((c) => {
          const r = c.getBoundingClientRect();
          return m.clientX >= r.left && m.clientX < r.right;
        }) ?? actual;
      const minuto = Math.min(1440 - 15, Math.max(0, redondear(minutoDe(m.clientY, actual.getBoundingClientRect()) - agarre, 15)));
      delta = desplazamiento({ ymd: seg.ymd, minuto: seg.desde }, { ymd: actual.dataset.col!, minuto });
      setArrastre({ id: e.id, deltaMs: delta });
    };
    const terminar = () => {
      window.removeEventListener("pointermove", alMover);
      window.removeEventListener("pointerup", alSoltar);
      window.removeEventListener("pointercancel", terminar);
      setArrastre(null);
    };
    const alSoltar = () => {
      terminar();
      if (!movido) abrir(e);
      else mover(e, delta);
    };
    window.addEventListener("pointermove", alMover);
    window.addEventListener("pointerup", alSoltar);
    window.addEventListener("pointercancel", terminar);
  }

  // ── Eventos por día ──
  const delDia = useMemo(() => {
    const conHora = new Map<string, { e: EventoCal; seg: Segmento }[]>();
    const todoElDia = new Map<string, EventoCal[]>();
    for (const e of eventos) {
      if (e.todoElDia) {
        for (const d of diasDeTodoElDia(e.inicio, e.fin, dias)) todoElDia.set(d, [...(todoElDia.get(d) ?? []), e]);
      } else {
        for (const seg of segmentosDelEvento(e.inicio, e.fin, dias)) conHora.set(seg.ymd, [...(conHora.get(seg.ymd) ?? []), { e, seg }]);
      }
    }
    return { conHora, todoElDia };
  }, [eventos, dias]);

  const copiaPorDia = (d: string) => delDia.todoElDia.get(d) ?? [];

  function soltarEn(destino: string, ev: React.DragEvent) {
    ev.preventDefault();
    const [id, origen] = ev.dataTransfer.getData("text/plain").split("|");
    const e = porId.get(id ?? "");
    if (!e || !origen) return;
    mover(e, instanteArgentina(destino, 0).getTime() - instanteArgentina(origen, 0).getTime());
  }

  const panelCapas = (
    <ul className="space-y-0.5">
      {p.capasDisponibles.map((c) => {
        const visible = activas.includes(c);
        return (
          <li key={c}>
            <button
              type="button"
              onClick={() => alternarCapa(c)}
              aria-pressed={visible}
              className="flex w-full items-center gap-2.5 rounded-[var(--fo-radius-sm)] px-2 py-1.5 text-left text-sm text-[var(--fo-text-secondary)] transition-colors hover:bg-[var(--fo-surface-hover)]"
            >
              <span
                className="flex size-4 flex-none items-center justify-center rounded border-2 text-white"
                style={{ borderColor: COLOR_CAPA[c], background: visible ? COLOR_CAPA[c] : "transparent" }}
              >
                {visible ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
              <span className="truncate">{ETIQUETA_CAPA[c]}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const filtroResponsable = (
    <label className="block space-y-1">
      <span className="px-2 text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">Responsable</span>
      <select
        className="fo-input w-full text-sm"
        value={p.responsable ?? ""}
        onChange={(e) => router.push(direccionAgenda(vista, ymd, e.target.value === "" ? null : Number(e.target.value)))}
      >
        <option value="">Todo el equipo</option>
        {p.equipo.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nombre}
          </option>
        ))}
      </select>
    </label>
  );

  const chip = (e: EventoCal, dia: string, contexto: "mes" | "tira") => {
    const lleno = e.capa === "CITAS" || e.todoElDia;
    const inicioDelEvento = diaArgentina(e.inicio) === dia && !e.todoElDia;
    const arrastrable = puedeGestionar && e.editable;
    return (
      <button
        key={`${e.id}-${dia}`}
        type="button"
        draggable={arrastrable}
        onDragStart={(ev) => {
          ev.dataTransfer.setData("text/plain", `${e.id}|${dia}`);
          ev.dataTransfer.effectAllowed = "move";
        }}
        onClick={(ev) => {
          ev.stopPropagation();
          abrir(e);
        }}
        title={e.titulo}
        className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight hover:brightness-95 ${contexto === "tira" ? "min-h-5" : ""}`}
        style={lleno ? { background: e.color, color: "#fff" } : { color: "var(--fo-text-secondary)" }}
      >
        {!lleno ? <span className="size-2 flex-none rounded-full" style={{ background: e.color }} /> : null}
        <span className="truncate">
          {inicioDelEvento ? <span className="tabular-nums">{horaDeMinuto(minutosDesdeInicioDelDia(e.inicio, dia))} </span> : null}
          <span className="font-semibold">{e.titulo}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] shadow-[var(--fo-shadow-sm)] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden space-y-6 border-r border-[var(--fo-border)] p-4 lg:block">
        {puedeGestionar ? (
          <button
            type="button"
            onClick={() => abrirCrear(vista === "dia" ? ymd : todayYmd, 9 * 60)}
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--fo-border)] bg-[var(--fo-surface)] px-4 py-3 text-sm font-semibold text-[var(--fo-text)] shadow-[var(--fo-shadow-md)] transition-colors hover:bg-[var(--fo-surface-hover)]"
          >
            <Plus className="size-5 text-[var(--fo-accent)]" />
            Nueva cita
          </button>
        ) : null}
        <MiniMonth selectedYmd={ymd} todayYmd={todayYmd} view={vistaCalendario} basePath="/agenda" keep={conservar} />
        <div className="space-y-1.5">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">Capas</p>
          {panelCapas}
        </div>
        {filtroResponsable}
      </aside>

      <section className="min-w-0">
        <CalendarToolbar
          view={vistaCalendario}
          ymd={ymd}
          todayYmd={todayYmd}
          basePath="/agenda"
          keep={{ ...conservar, vista: vistaCalendario }}
          views={[vistaCalendario]}
        >
          <nav aria-label="Vista" className="flex overflow-hidden rounded-full border border-[var(--fo-border-strong)]">
            {VISTAS_PANTALLA.map((v) => (
              <Link
                key={v}
                href={direccionAgenda(v, ymd, p.responsable)}
                aria-current={v === vista ? "page" : undefined}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  v === vista ? "bg-[var(--fo-accent-soft)] text-[var(--fo-accent-hover)]" : "text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)]"
                }`}
              >
                {ETIQUETA_VISTA[v]}
              </Link>
            ))}
          </nav>
        </CalendarToolbar>

        {/* En pantallas chicas el panel izquierdo no entra: capas y responsable van arriba. */}
        <div className="space-y-2 border-b border-[var(--fo-border)] px-3 py-2 lg:hidden">
          <div className="flex flex-wrap items-center gap-2">
            {p.capasDisponibles.map((c) => {
              const visible = activas.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => alternarCapa(c)}
                  aria-pressed={visible}
                  className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                  style={{ borderColor: COLOR_CAPA[c], background: visible ? COLOR_CAPA[c] : "transparent", color: visible ? "#fff" : COLOR_CAPA[c] }}
                >
                  {ETIQUETA_CAPA[c]}
                </button>
              );
            })}
            {puedeGestionar ? (
              <button type="button" className="fo-btn fo-btn-primary ml-auto min-h-8 px-3 text-xs" onClick={() => abrirCrear(vista === "dia" ? ymd : todayYmd, 9 * 60)}>
                <Plus className="size-4" />
                Nueva
              </button>
            ) : null}
          </div>
          {filtroResponsable}
        </div>

        {aviso ? (
          <p className="fo-alert-error m-3 rounded-[var(--fo-radius-sm)] p-3 text-sm text-[var(--fo-danger)]" role="alert">
            {aviso}
          </p>
        ) : null}
        {p.truncadas.length > 0 ? (
          <p className="m-3 rounded-[var(--fo-radius-sm)] bg-[var(--fo-warning-soft)] p-3 text-sm text-[var(--fo-warning)]" role="status">
            Hay demasiados eventos en {p.truncadas.map((c) => ETIQUETA_CAPA[c].toLowerCase()).join(", ")} para mostrarlos todos: acotá el período o filtrá por responsable.
          </p>
        ) : null}

        {vista === "lista" ? (
          <VistaLista eventos={eventos} ymd={ymd} onAbrir={abrir} />
        ) : vista === "mes" ? (
          <VistaMes
            key={ymd}
            ymd={ymd}
            todayYmd={todayYmd}
            eventos={eventos}
            chip={(e, d) => chip(e, d, "mes")}
            puedeGestionar={puedeGestionar}
            onCrear={(d) => abrirCrear(d, 9 * 60)}
            onSoltar={soltarEn}
            vista={vista}
            responsable={p.responsable}
          />
        ) : (
          <div ref={gridRef}>
            {/* Los eventos de todo el día, arriba de la grilla horaria. */}
            <TiraTodoElDia dias={dias} copiaPorDia={copiaPorDia} chip={(e, d) => chip(e, d, "tira")} puedeGestionar={puedeGestionar} onCrear={(d) => abrirCrear(d, null)} onSoltar={soltarEn} />
            <TimeGrid
              key={`${vista}-${dias[0]}`}
              days={dias}
              todayYmd={todayYmd}
              nowMinute={p.nowMinute}
              startHour={startHour}
              endHour={endHour}
              hourHeight={ALTO_HORA}
              initialMobileDay={dias.includes(todayYmd) ? todayYmd : ymd}
              dayHref={vista === "semana" ? (d) => direccionAgenda("dia", d, p.responsable) : undefined}
              isDimmed={(d) => d < todayYmd}
              renderColumn={(d) => (
                <div
                  data-col={d}
                  className="absolute inset-0"
                  onClick={(ev) => {
                    if (ev.target !== ev.currentTarget || !puedeGestionar) return;
                    const minuto = startHour * 60 + (ev.nativeEvent.offsetY / ALTO_HORA) * 60;
                    abrirCrear(d, Math.min(1440 - 60, Math.max(0, Math.floor(minuto / 30) * 30)));
                  }}
                >
                  {layoutOverlaps(
                    (delDia.conHora.get(d) ?? []).map(({ e, seg }) => ({ e, seg, startMinute: seg.desde, endMinute: seg.hasta })),
                  ).map(({ e, seg, column, columns }) => {
                    const top = minuteToPx(seg.desde, startHour, ALTO_HORA);
                    const alto = Math.max(20, minuteToPx(seg.hasta, startHour, ALTO_HORA) - top - 2);
                    const corto = alto < 40;
                    const arrastrando = arrastre?.id === e.id;
                    const hecha = e.capa === "CITAS" && p.citas.find((c) => `cita:${c.id}` === e.id)?.status === "REALIZADA";
                    return (
                      <button
                        key={`${e.id}-${d}`}
                        type="button"
                        onPointerDown={(ev) => empezarArrastre(ev, e, seg)}
                        onClick={(ev) => {
                          // El mouse resuelve el clic en `pointerup` (arrastre); acá quedan teclado y toque.
                          if (puedeGestionar && e.editable && ev.detail !== 0 && (ev.nativeEvent as PointerEvent).pointerType === "mouse") return;
                          abrir(e);
                        }}
                        title={e.titulo}
                        className={`absolute z-10 overflow-hidden rounded-md px-1.5 py-1 text-left text-xs leading-tight text-white transition-shadow hover:z-30 hover:shadow-[var(--fo-shadow-md)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--fo-accent)] ${
                          puedeGestionar && e.editable ? "cursor-grab" : "cursor-pointer"
                        } ${arrastrando ? "z-40 opacity-80 shadow-[var(--fo-shadow-md)]" : d < todayYmd ? "opacity-70" : ""} ${hecha ? "line-through" : ""}`}
                        style={{
                          top: top + 1,
                          height: alto,
                          left: `calc(${(column / columns) * 100}% + 2px)`,
                          width: `calc(${100 / columns}% - 5px)`,
                          background: e.color,
                          border: "1px solid var(--fo-surface)",
                        }}
                      >
                        <span className="block truncate font-semibold">
                          {e.titulo}
                          {corto ? `, ${horaDeMinuto(seg.desde)}` : ""}
                        </span>
                        {!corto ? (
                          <span className="block truncate opacity-90">
                            {horaDeMinuto(seg.desde)} – {seg.hasta >= 1440 ? "24:00" : horaDeMinuto(seg.hasta)}
                          </span>
                        ) : null}
                        {alto >= 64 ? <span className="block truncate opacity-90">{ETIQUETA_CAPA[e.capa]}</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>
        )}
      </section>

      {dialogo ? (
        <DialogoCita
          key={dialogo.modo === "editar" ? dialogo.cita.id : `nueva-${dialogo.inicio}`}
          datos={dialogo}
          tipos={p.tipos}
          equipo={p.equipo}
          roles={p.roles}
          puedeGestionar={puedeGestionar}
          puedeContactos={p.puedeContactos}
          yoId={p.yoId}
          onCerrar={() => cerrarDialogo(false)}
          onGuardado={() => cerrarDialogo(true)}
        />
      ) : null}
    </div>
  );
}

function TiraTodoElDia({
  dias,
  copiaPorDia,
  chip,
  puedeGestionar,
  onCrear,
  onSoltar,
}: {
  dias: string[];
  copiaPorDia: (d: string) => EventoCal[];
  chip: (e: EventoCal, d: string) => React.ReactNode;
  puedeGestionar: boolean;
  onCrear: (d: string) => void;
  onSoltar: (d: string, ev: React.DragEvent) => void;
}) {
  const hay = dias.some((d) => copiaPorDia(d).length > 0);
  if (!hay && !puedeGestionar) return null;
  return (
    <>
      {/* Pantalla ancha: una celda por día, alineada con la grilla. */}
      <div
        style={{ "--fo-cal-cols": dias.length } as React.CSSProperties}
        className="hidden grid-cols-[3.25rem_repeat(var(--fo-cal-cols),minmax(0,1fr))] border-b border-[var(--fo-border)] md:grid"
      >
        <div className="py-1 pr-2 text-right text-[10px] text-[var(--fo-muted-soft)]">todo el día</div>
        {dias.map((d) => (
          <div
            key={d}
            data-tira={d}
            className="min-h-7 space-y-0.5 border-l border-[var(--fo-border)] p-0.5"
            onClick={(ev) => ev.target === ev.currentTarget && puedeGestionar && onCrear(d)}
            onDragOver={(ev) => ev.preventDefault()}
            onDrop={(ev) => onSoltar(d, ev)}
          >
            {copiaPorDia(d).map((e) => chip(e, d))}
          </div>
        ))}
      </div>
      {/* Teléfono: la grilla muestra un día por vez, así que los de todo el día van en una lista. */}
      {hay ? (
        <ul className="space-y-0.5 border-b border-[var(--fo-border)] p-2 md:hidden">
          {dias.flatMap((d) =>
            copiaPorDia(d).map((e) => (
              <li key={`${e.id}-${d}`} className="flex items-center gap-2">
                <span className="w-14 flex-none text-[11px] tabular-nums text-[var(--fo-muted)]">
                  {DIA_CORTO[weekdayIndexYmd(d)]} {dayNumberYmd(d)}
                </span>
                <span className="min-w-0 flex-1">{chip(e, d)}</span>
              </li>
            )),
          )}
        </ul>
      ) : null}
    </>
  );
}

function VistaMes({
  ymd,
  todayYmd,
  eventos,
  chip,
  puedeGestionar,
  onCrear,
  onSoltar,
  vista,
  responsable,
}: {
  ymd: string;
  todayYmd: string;
  eventos: EventoCal[];
  chip: (e: EventoCal, d: string) => React.ReactNode;
  puedeGestionar: boolean;
  onCrear: (d: string) => void;
  onSoltar: (d: string, ev: React.DragEvent) => void;
  vista: VistaPantalla;
  responsable: number | null;
}) {
  const dias = visibleDays("mes", ymd);
  const MAX = 3;
  const porDia = useMemo(() => {
    const m = new Map<string, EventoCal[]>();
    for (const e of eventos) {
      const ocupados = e.todoElDia ? diasDeTodoElDia(e.inicio, e.fin, dias) : [...new Set(segmentosDelEvento(e.inicio, e.fin, dias).map((s) => s.ymd))];
      for (const d of ocupados) m.set(d, [...(m.get(d) ?? []), e]);
    }
    for (const [d, l] of m) m.set(d, l.sort((a, b) => Number(b.todoElDia) - Number(a.todoElDia) || a.inicio.getTime() - b.inicio.getTime()));
    return m;
  }, [eventos, dias]);

  return (
    <div className="fo-cal-fade">
      <div className="grid grid-cols-7 border-b border-[var(--fo-border)]">
        {DIA_CORTO.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold tracking-wider text-[var(--fo-muted)]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d) => {
          const delDia = porDia.get(d) ?? [];
          const hoy = d === todayYmd;
          const fuera = !sameMonthYmd(d, ymd);
          return (
            <div
              key={d}
              className={`min-h-24 border-b border-[var(--fo-border)] p-1 sm:min-h-28 ${weekdayIndexYmd(d) > 0 ? "border-l" : ""} ${fuera ? "bg-[var(--fo-bg)]" : ""}`}
              onClick={(ev) => ev.target === ev.currentTarget && puedeGestionar && onCrear(d)}
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={(ev) => onSoltar(d, ev)}
            >
              <div className="mb-1 text-center">
                <Link
                  href={direccionAgenda("dia", d, responsable)}
                  className={`inline-flex size-7 items-center justify-center rounded-full text-xs tabular-nums transition-colors ${
                    hoy
                      ? "bg-[var(--fo-accent)] font-semibold text-white"
                      : fuera
                        ? "text-[var(--fo-muted-soft)] hover:bg-[var(--fo-surface-hover)]"
                        : "font-medium text-[var(--fo-text)] hover:bg-[var(--fo-surface-hover)]"
                  }`}
                >
                  {dayNumberYmd(d)}
                </Link>
              </div>
              <div className="space-y-0.5">
                {delDia.slice(0, MAX).map((e) => chip(e, d))}
                {delDia.length > MAX ? (
                  <Link
                    href={direccionAgenda("dia", d, responsable)}
                    className="block rounded px-1.5 py-0.5 text-[11px] font-semibold text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)]"
                  >
                    {delDia.length - MAX} más
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VistaLista({
  eventos,
  ymd,
  onAbrir,
}: {
  eventos: EventoCal[];
  ymd: string;
  onAbrir: (e: EventoCal) => void;
}) {
  const grupos = useMemo(() => {
    const m = new Map<string, EventoCal[]>();
    for (const e of eventos) {
      const d = diaArgentina(e.inicio);
      // Un evento que viene de antes del mes se lista en su primer día del mes; los de los días de
      // relleno del almanaque quedan afuera: la lista es del mes que se mira.
      const dia = sameMonthYmd(d, ymd) ? d : d < ymd ? `${ymd.slice(0, 8)}01` : null;
      if (dia === null) continue;
      m.set(dia, [...(m.get(dia) ?? []), e]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, l]) => [dia, l.sort((a, b) => Number(b.todoElDia) - Number(a.todoElDia) || a.inicio.getTime() - b.inicio.getTime())] as const);
  }, [eventos, ymd]);

  if (grupos.length === 0) {
    return <p className="p-6 text-center text-sm text-[var(--fo-muted)]">No hay nada agendado este mes con las capas encendidas.</p>;
  }
  return (
    <div className="fo-cal-fade divide-y divide-[var(--fo-border)]">
      {grupos.map(([dia, lista]) => (
        <section key={dia} className="p-3 sm:px-4">
          <h3 className="mb-1.5 text-sm font-semibold text-[var(--fo-text)] first-letter:uppercase">{FECHA_LARGA.format(new Date(`${dia}T12:00:00Z`))}</h3>
          <ul className="space-y-1">
            {lista.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onAbrir(e)} className="flex w-full items-center gap-3 rounded-[var(--fo-radius-sm)] px-2 py-1.5 text-left text-sm hover:bg-[var(--fo-surface-hover)]">
                  <span className="size-3 flex-none rounded-sm" style={{ background: e.color }} />
                  <span className="w-24 flex-none text-xs tabular-nums text-[var(--fo-muted)]">
                    {e.todoElDia ? "Todo el día" : `${horaDeMinuto(minutosDesdeInicioDelDia(e.inicio, diaArgentina(e.inicio)))} – ${horaDeMinuto(minutosDesdeInicioDelDia(e.fin, diaArgentina(e.inicio)))}`}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--fo-text)]">{e.titulo}</span>
                  <span className="hidden flex-none text-xs text-[var(--fo-muted)] sm:inline">{ETIQUETA_CAPA[e.capa]}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
