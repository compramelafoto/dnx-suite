"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  agregarParticipanteCitaAction,
  anularCitaAction,
  buscarContactosAgendaAction,
  crearCitaAction,
  editarCitaAction,
  quitarParticipanteCitaAction,
} from "@/app/actions/agenda";
import { SelectorContacto, type ContactoElegido } from "@/components/consultas/selector-contacto";
import { ESTADOS_CITA, ETIQUETA_ESTADO_CITA, type EstadoCita } from "@/lib/agenda/constantes";
import type { DetalleCita, OrigenDeCita } from "@/lib/agenda/vista-tipos";
import { instanteDeFormulario, partesDeInstante, rangoTodoElDia, ultimoDiaTodoElDia } from "@/lib/agenda/vista-cliente";

export type DatosDialogo =
  | {
      modo: "crear";
      inicio: string;
      fin: string;
      todoElDia: boolean;
      /** Ligar la cita nueva a un registro (desde su ficha). */
      origen?: { proyectoId: string | null; pedidoId: string | null; consultaLeadId: string | null };
    }
  | { modo: "editar"; cita: DetalleCita };

type Tipo = { id: string; name: string; color: string; isActive?: boolean };
type Persona = { id: number; nombre: string };
type Rol = { id: string; nombre: string };

type Participante = {
  /** Id de la fila si ya existe en la base. */
  id: string | null;
  userId: number | null;
  clientId: string | null;
  nombre: string;
  roleId: string | null;
  roleName: string | null;
};

const MENSAJE_FALLA = "No se pudo guardar el cambio. Probá de nuevo.";

/**
 * Diálogo para crear y editar una cita. Los horarios se escriben en hora de Argentina y viajan como
 * instantes; una cita de todo el día ocupa los días elegidos (el fin es inclusivo en la pantalla).
 * Sin "Gestionar" se abre en modo lectura. Las citas creadas desde un pedido, proyecto o consulta
 * muestran su origen con enlace (sólo lectura).
 */
export function DialogoCita({
  datos,
  tipos,
  equipo,
  roles,
  puedeGestionar,
  puedeContactos,
  yoId,
  onCerrar,
  onGuardado,
}: {
  datos: DatosDialogo;
  tipos: Tipo[];
  equipo: Persona[];
  roles: Rol[];
  puedeGestionar: boolean;
  puedeContactos: boolean;
  yoId: number;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const cita = datos.modo === "editar" ? datos.cita : null;
  const editando = cita !== null;
  const lectura = !puedeGestionar;

  const inicioIso = cita ? cita.startAt : datos.modo === "crear" ? datos.inicio : "";
  const finIso = cita ? cita.endAt : datos.modo === "crear" ? datos.fin : "";
  const todoElDiaInicial = cita ? cita.allDay : datos.modo === "crear" ? datos.todoElDia : false;
  const ini = partesDeInstante(inicioIso);
  const fin = partesDeInstante(finIso);

  const [titulo, setTitulo] = useState(cita?.title ?? "");
  const [tipoId, setTipoId] = useState(cita?.typeId ?? "");
  const [estado, setEstado] = useState<string>(cita?.status ?? "AGENDADA");
  const [todoElDia, setTodoElDia] = useState(todoElDiaInicial);
  const [diaInicio, setDiaInicio] = useState(ini.dia);
  const [horaInicio, setHoraInicio] = useState(todoElDiaInicial ? "09:00" : ini.hora);
  const [diaFin, setDiaFin] = useState(todoElDiaInicial ? ultimoDiaTodoElDia(inicioIso, finIso) : fin.dia);
  const [horaFin, setHoraFin] = useState(todoElDiaInicial ? "10:00" : fin.hora);
  const [lugar, setLugar] = useState(cita?.location ?? "");
  const [notas, setNotas] = useState(cita?.notes ?? "");
  const [responsable, setResponsable] = useState<string>(cita ? (cita.ownerUserId !== null ? String(cita.ownerUserId) : "") : String(yoId));
  const [contacto, setContacto] = useState<ContactoElegido | null>(
    cita?.clientId ? { id: cita.clientId, nombre: cita.clientNombre ?? "Contacto", email: null, telefono: null } : null,
  );
  const [participantes, setParticipantes] = useState<Participante[]>(
    (cita?.participantes ?? []).map((p) => ({
      id: p.id,
      userId: p.userId,
      clientId: p.clientId,
      nombre: p.userId !== null ? (equipo.find((m) => m.id === p.userId)?.nombre ?? "Integrante del equipo") : (p.nombre ?? "Contacto"),
      roleId: p.roleId,
      roleName: p.roleName,
    })),
  );
  const [quitados, setQuitados] = useState<string[]>([]);
  const [agregando, setAgregando] = useState(false);
  const [nuevoOrigen, setNuevoOrigen] = useState<"EQUIPO" | "CONTACTO">("EQUIPO");
  const [nuevoUsuario, setNuevoUsuario] = useState("");
  const [nuevoContacto, setNuevoContacto] = useState<ContactoElegido | null>(null);
  const [nuevoRol, setNuevoRol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    const alApretar = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alApretar);
    return () => window.removeEventListener("keydown", alApretar);
  }, [onCerrar]);

  const tiposElegibles = tipos.filter((t) => t.isActive !== false || t.id === cita?.typeId);
  const origenDeAlta = datos.modo === "crear" ? datos.origen : undefined;
  const origenes: OrigenDeCita[] = cita
    ? cita.origen
    : [
        ...(origenDeAlta?.pedidoId ? [{ tipo: "pedido" as const, id: origenDeAlta.pedidoId, etiqueta: "Se liga a un pedido", href: `/pedidos/${origenDeAlta.pedidoId}` }] : []),
        ...(origenDeAlta?.proyectoId ? [{ tipo: "proyecto" as const, id: origenDeAlta.proyectoId, etiqueta: "Se liga a un proyecto", href: `/proyectos/${origenDeAlta.proyectoId}` }] : []),
        ...(origenDeAlta?.consultaLeadId ? [{ tipo: "consulta" as const, id: origenDeAlta.consultaLeadId, etiqueta: "Se liga a una consulta", href: `/consultas/${origenDeAlta.consultaLeadId}` }] : []),
      ];

  function leerFechas(): { startAt: string; endAt: string } | { error: string } {
    if (todoElDia) {
      const r = rangoTodoElDia(diaInicio, diaFin);
      return r ?? { error: "Elegí un día de inicio y uno de fin válidos (el fin no puede ser anterior)." };
    }
    const startAt = instanteDeFormulario(diaInicio, horaInicio);
    const endAt = instanteDeFormulario(diaFin, horaFin);
    if (!startAt || !endAt) return { error: "Elegí un inicio y un fin válidos." };
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) return { error: "El fin tiene que ser posterior al inicio." };
    return { startAt, endAt };
  }

  function guardar() {
    setError(null);
    if (titulo.trim() === "") {
      setError("Escribí el título de la cita.");
      return;
    }
    const fechas = leerFechas();
    if ("error" in fechas) {
      setError(fechas.error);
      return;
    }
    const comunes = {
      title: titulo.trim(),
      typeId: tipoId === "" ? null : tipoId,
      status: estado,
      startAt: fechas.startAt,
      endAt: fechas.endAt,
      allDay: todoElDia,
      location: lugar.trim() === "" ? null : lugar.trim(),
      notes: notas.trim() === "" ? null : notas.trim(),
      ownerUserId: responsable === "" ? null : Number(responsable),
      clientId: contacto ? contacto.id : null,
    };
    iniciar(async () => {
      try {
        if (!cita) {
          const r = await crearCitaAction({
            ...comunes,
            ...(origenDeAlta ? { proyectoId: origenDeAlta.proyectoId, pedidoId: origenDeAlta.pedidoId, consultaLeadId: origenDeAlta.consultaLeadId } : {}),
            participantes: participantes.map((p) => ({ userId: p.userId, clientId: p.clientId, roleId: p.roleId })),
          });
          if (!r.ok) return setError(r.error);
        } else {
          const r = await editarCitaAction(cita.id, comunes);
          if (!r.ok) return setError(r.error);
          for (const id of quitados) {
            const q = await quitarParticipanteCitaAction(id);
            if (!q.ok) return setError(q.error);
          }
          for (const p of participantes.filter((x) => x.id === null)) {
            const a = await agregarParticipanteCitaAction(cita.id, { userId: p.userId, clientId: p.clientId, roleId: p.roleId });
            if (!a.ok) return setError(a.error);
          }
        }
        onGuardado();
      } catch {
        setError(MENSAJE_FALLA);
      }
    });
  }

  function anular() {
    if (!cita) return;
    setError(null);
    iniciar(async () => {
      try {
        const r = await anularCitaAction(cita.id);
        if (!r.ok) return setError(r.error);
        onGuardado();
      } catch {
        setError(MENSAJE_FALLA);
      }
    });
  }

  function sumarParticipante() {
    setError(null);
    const rol = nuevoRol === "" ? null : nuevoRol;
    const roleName = rol ? (roles.find((r) => r.id === rol)?.nombre ?? null) : null;
    if (nuevoOrigen === "EQUIPO") {
      if (nuevoUsuario === "") return setError("Elegí un integrante del equipo.");
      const userId = Number(nuevoUsuario);
      if (participantes.some((p) => p.userId === userId && p.roleId === rol)) return setError("Esa persona ya participa con ese rol.");
      setParticipantes((l) => [...l, { id: null, userId, clientId: null, nombre: equipo.find((m) => m.id === userId)?.nombre ?? "Integrante", roleId: rol, roleName }]);
    } else {
      if (!nuevoContacto) return setError("Elegí un contacto.");
      const clientId = nuevoContacto.id;
      if (participantes.some((p) => p.clientId === clientId && p.roleId === rol)) return setError("Esa persona ya participa con ese rol.");
      setParticipantes((l) => [...l, { id: null, userId: null, clientId, nombre: nuevoContacto.nombre, roleId: rol, roleName }]);
    }
    setAgregando(false);
    setNuevoUsuario("");
    setNuevoContacto(null);
    setNuevoRol("");
  }

  function quitarParticipante(p: Participante) {
    setParticipantes((l) => l.filter((x) => x !== p));
    if (p.id) setQuitados((q) => [...q, p.id!]);
  }

  const titulo_dialogo = editando ? (lectura ? "Cita" : "Editar cita") : "Nueva cita";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-0 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo_dialogo}
        className="fo-cal-fade max-h-[92vh] w-full overflow-y-auto rounded-t-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] p-5 shadow-[var(--fo-shadow-md)] sm:max-w-xl sm:rounded-[var(--fo-radius)]"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-[var(--fo-text)]">{titulo_dialogo}</h3>
          <button type="button" className="fo-icon-btn" aria-label="Cerrar" onClick={onCerrar}>
            <X className="size-5" />
          </button>
        </div>

        <form
          className="mt-4 space-y-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!lectura) guardar();
          }}
        >
          <fieldset className="space-y-3" disabled={pendiente || lectura}>
            <label className="fo-field-stack block">
              <span className="fo-label">Título</span>
              <input className="fo-input w-full" value={titulo} maxLength={200} onChange={(e) => setTitulo(e.target.value)} autoFocus={!editando} />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="fo-field-stack block">
                <span className="fo-label">Tipo</span>
                <select className="fo-input w-full" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
                  <option value="">Sin tipo</option>
                  {tiposElegibles.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fo-field-stack block">
                <span className="fo-label">Estado</span>
                <select className="fo-input w-full" value={estado} onChange={(e) => setEstado(e.target.value)}>
                  {ESTADOS_CITA.filter((s) => s !== "ANULADA" || estado === "ANULADA").map((s) => (
                    <option key={s} value={s}>
                      {ETIQUETA_ESTADO_CITA[s as EstadoCita]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2">
              <input type="checkbox" checked={todoElDia} onChange={(e) => setTodoElDia(e.target.checked)} />
              Todo el día
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="fo-field-stack">
                <span className="fo-label">Desde</span>
                <div className="flex gap-2">
                  <input type="date" aria-label="Día de inicio" className="fo-input min-w-0 flex-1" value={diaInicio} onChange={(e) => {
                    const nuevo = e.target.value;
                    // El fin acompaña al inicio si todavía era el mismo día.
                    if (diaFin === diaInicio || diaFin < nuevo) setDiaFin(nuevo);
                    setDiaInicio(nuevo);
                  }} />
                  {!todoElDia ? <input type="time" aria-label="Hora de inicio" className="fo-input w-28" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} /> : null}
                </div>
              </div>
              <div className="fo-field-stack">
                <span className="fo-label">Hasta</span>
                <div className="flex gap-2">
                  <input type="date" aria-label="Día de fin" className="fo-input min-w-0 flex-1" value={diaFin} min={diaInicio} onChange={(e) => setDiaFin(e.target.value)} />
                  {!todoElDia ? <input type="time" aria-label="Hora de fin" className="fo-input w-28" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} /> : null}
                </div>
              </div>
            </div>
            <p className="-mt-1 text-xs text-[var(--fo-muted)]">Hora de Buenos Aires.</p>

            <label className="fo-field-stack block">
              <span className="fo-label">Lugar</span>
              <input className="fo-input w-full" value={lugar} maxLength={300} onChange={(e) => setLugar(e.target.value)} />
            </label>

            <label className="fo-field-stack block">
              <span className="fo-label">Responsable</span>
              <select className="fo-input w-full" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
                <option value="">Sin responsable</option>
                {equipo.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>

            {puedeContactos ? (
              <SelectorContacto etiqueta="Contacto" elegido={contacto} onElegir={setContacto} buscar={buscarContactosAgendaAction} deshabilitado={pendiente || lectura} />
            ) : contacto ? (
              <p className="text-[var(--fo-muted)]">Contacto vinculado a la cita.</p>
            ) : null}

            <label className="fo-field-stack block">
              <span className="fo-label">Notas</span>
              <textarea className="fo-input w-full" rows={3} value={notas} maxLength={5000} onChange={(e) => setNotas(e.target.value)} />
            </label>

            <section aria-label="Participantes" className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="fo-label">Participantes</span>
                {!lectura && !agregando ? (
                  <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setAgregando(true)}>
                    Agregar
                  </button>
                ) : null}
              </div>
              {participantes.length === 0 ? (
                <p className="text-xs text-[var(--fo-muted)]">Sin participantes.</p>
              ) : (
                <ul className="space-y-1">
                  {participantes.map((p, i) => (
                    <li key={p.id ?? `nuevo-${i}`} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-[var(--fo-text)]">{p.nombre}</span>
                        <span className="text-xs text-[var(--fo-muted)]">
                          {" · "}
                          {p.userId !== null ? "Equipo" : "Contacto"}
                          {p.roleName ? ` · ${p.roleName}` : ""}
                        </span>
                      </span>
                      {!lectura ? (
                        <button type="button" className="fo-icon-btn" aria-label={`Quitar a ${p.nombre}`} onClick={() => quitarParticipante(p)}>
                          <X className="size-4" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {agregando ? (
                <div className="space-y-2 rounded-lg border border-[var(--fo-border)] p-3">
                  {puedeContactos ? (
                    <div className="flex gap-4" role="radiogroup" aria-label="Quién participa">
                      <label className="flex items-center gap-2">
                        <input type="radio" name="origen-participante" checked={nuevoOrigen === "EQUIPO"} onChange={() => setNuevoOrigen("EQUIPO")} />
                        Del equipo
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="origen-participante" checked={nuevoOrigen === "CONTACTO"} onChange={() => setNuevoOrigen("CONTACTO")} />
                        Un contacto
                      </label>
                    </div>
                  ) : null}
                  {nuevoOrigen === "EQUIPO" ? (
                    <select className="fo-input w-full" aria-label="Integrante del equipo" value={nuevoUsuario} onChange={(e) => setNuevoUsuario(e.target.value)}>
                      <option value="">Elegí una persona</option>
                      {equipo.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <SelectorContacto etiqueta="Contacto participante" elegido={nuevoContacto} onElegir={setNuevoContacto} buscar={buscarContactosAgendaAction} />
                  )}
                  <select className="fo-input w-full" aria-label="Rol" value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value)}>
                    <option value="">Sin rol</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={sumarParticipante}>
                      Sumar
                    </button>
                    <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setAgregando(false)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </fieldset>

          {origenes.length > 0 ? (
            <div className="space-y-1 rounded-lg bg-[var(--fo-surface-muted)] p-3 text-xs text-[var(--fo-muted)]">
              <p className="font-medium">Origen</p>
              <ul className="space-y-0.5">
                {origenes.map((o) => (
                  <li key={`${o.tipo}-${o.id}`}>
                    {o.href ? (
                      <Link href={o.href} className="text-[var(--fo-accent)] hover:underline">
                        {o.etiqueta}
                      </Link>
                    ) : (
                      o.etiqueta
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {error ? (
            <p className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm text-[var(--fo-danger)]" role="alert">
              {error}
            </p>
          ) : null}

          {!lectura ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--fo-border)] pt-3">
              {editando && cita.status !== "ANULADA" ? (
                <button type="button" className="fo-btn fo-btn-danger-outline text-sm" disabled={pendiente} onClick={anular}>
                  Anular cita
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={onCerrar}>
                  Cancelar
                </button>
                <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
                  {pendiente ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
