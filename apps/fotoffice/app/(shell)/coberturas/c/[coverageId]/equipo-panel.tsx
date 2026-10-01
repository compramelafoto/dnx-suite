"use client";

import { useActionState, useId, useState } from "react";
import {
  invitarDirectoAction,
  seleccionarPostulacionAction,
  type EquipoState,
} from "./actions";

const inicial: EquipoState = { error: null, ok: null };

export type PostulacionProps = {
  id: string;
  nombre: string;
  mensaje: string | null;
  fecha: string;
  statusLabel: string;
  /** Si todavía espera una decisión. Una ya resuelta se sigue mostrando, sin botón. */
  pendiente: boolean;
};

export type AsignacionProps = {
  id: string;
  nombre: string;
  statusLabel: string;
  origenLabel: string;
};

export type RolProps = {
  id: string;
  nombre: string;
  vacancies: number;
  libres: number;
  asignaciones: AsignacionProps[];
  postulaciones: PostulacionProps[];
};

export type ColaboradorProps = { id: string; nombre: string };

/**
 * La pantalla donde la coordinación arma el equipo.
 *
 * Un bloque por rol: quién quedó, quién se anotó y con qué mensaje, y las dos formas de sumar
 * gente — seleccionar a alguien que se anotó, o invitar directo a un colaborador activo.
 *
 * `puedeCoordinar` esconde los botones para quien solo revisa, igual que en `ConvocatoriaPanel`,
 * y las dos acciones vuelven a pedir `requireCoveragesCoordinator()` en el servidor: esto es
 * cortesía, no el control. Lo mismo con los lugares libres: la pantalla deja de ofrecer el
 * botón cuando el rol se llenó, pero quien decide de verdad es el recuento que la acción hace
 * adentro de su transacción.
 *
 * **Cuánto falta se lee arriba, de una.** Con tres roles abiertos había que sumar tres renglones
 * mentalmente para saber si el equipo estaba completo, que es la única pregunta que se hace quien
 * entra a esta pantalla.
 */
export function EquipoPanel({
  roles,
  colaboradores,
  puedeCoordinar,
  lugaresTotales,
  lugaresCubiertos,
}: {
  roles: RolProps[];
  colaboradores: ColaboradorProps[];
  puedeCoordinar: boolean;
  lugaresTotales: number;
  lugaresCubiertos: number;
}) {
  const completo = lugaresTotales > 0 && lugaresCubiertos >= lugaresTotales;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">El equipo</h2>
        {lugaresTotales > 0 ? (
          <p className={`text-sm ${completo ? "text-[var(--fo-success)]" : "text-[var(--fo-muted)]"}`}>
            {completo
              ? "El equipo está completo."
              : `${lugaresCubiertos} de ${lugaresTotales} lugares cubiertos`}
          </p>
        ) : null}
      </div>

      {roles.length === 0 ? (
        <p className="fo-card p-5 text-sm text-[var(--fo-muted)]">
          Esta cobertura no tiene roles cargados, así que todavía no hay equipo que armar.
        </p>
      ) : (
        roles.map((rol) => (
          <RolCard
            key={rol.id}
            rol={rol}
            colaboradores={colaboradores}
            puedeCoordinar={puedeCoordinar}
          />
        ))
      )}
    </section>
  );
}

function RolCard({
  rol,
  colaboradores,
  puedeCoordinar,
}: {
  rol: RolProps;
  colaboradores: ColaboradorProps[];
  puedeCoordinar: boolean;
}) {
  const [state, invitar, invitando] = useActionState(invitarDirectoAction, inicial);
  const [abriendoInvitacion, setAbriendoInvitacion] = useState(false);
  const idBase = useId();

  const lleno = rol.libres === 0;
  const pendientes = rol.postulaciones.filter((p) => p.pendiente).length;

  return (
    <article className="fo-card space-y-4 p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">{rol.nombre}</h3>
        <span className={`text-sm ${lleno ? "text-[var(--fo-success)]" : "text-[var(--fo-muted)]"}`}>
          {lleno
            ? `Completo: ${rol.vacancies} de ${rol.vacancies}`
            : `${rol.asignaciones.length} de ${rol.vacancies} · ${
                rol.libres === 1 ? "queda 1 lugar" : `quedan ${rol.libres} lugares`
              }`}
        </span>
      </header>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Quién quedó</h4>
        {rol.asignaciones.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía nadie.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {rol.asignaciones.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.nombre}</span>{" "}
                <span className="text-[var(--fo-muted)]">
                  — {a.statusLabel} · {a.origenLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-[var(--fo-border)] pt-4">
        <h4 className="text-sm font-semibold">
          Quién se anotó
          {pendientes > 0 ? (
            <span className="ml-2 font-normal text-[var(--fo-muted)]">
              {pendientes === 1 ? "1 esperando respuesta" : `${pendientes} esperando respuesta`}
            </span>
          ) : null}
        </h4>
        {rol.postulaciones.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no se anotó nadie a este rol.</p>
        ) : (
          <ul className="space-y-3">
            {rol.postulaciones.map((p) => (
              <PostulacionItem
                key={p.id}
                postulacion={p}
                hayLugar={rol.libres > 0}
                puedeCoordinar={puedeCoordinar}
              />
            ))}
          </ul>
        )}
      </div>

      {puedeCoordinar ? (
        <div className="space-y-2 border-t border-[var(--fo-border)] pt-4">
          <Aviso state={state} />
          {/* `colaboradores` llega ya sin quienes están en el equipo de ESTA cobertura: la
              exclusión es por cobertura y no por rol (`@@unique([coverageId, memberId])` en el
              modelo), así que la resuelve la página una vez y no cada tarjeta por su cuenta. */}
          {colaboradores.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">
              No queda ningún colaborador activo libre: o ya están todos en esta cobertura, o
              todavía no se marcó a nadie como colaborador.
            </p>
          ) : lleno ? (
            <p className="text-sm text-[var(--fo-muted)]">
              Este rol ya tiene a toda su gente. Para sumar a alguien más, primero agregale una
              vacante.
            </p>
          ) : !abriendoInvitacion ? (
            // Detrás de un botón y no siempre abierto: con tres roles, tres formularios de
            // invitación desplegados eran la mitad de la pantalla, y lo habitual es que la gente
            // salga de la convocatoria, no de una invitación a dedo.
            <button
              type="button"
              onClick={() => setAbriendoInvitacion(true)}
              className="fo-btn fo-btn-secondary min-h-11 text-sm"
            >
              Invitar a alguien directamente
            </button>
          ) : (
            <form action={invitar} className="space-y-3">
              <input type="hidden" name="roleId" value={rol.id} />
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor={`${idBase}-quien`}>
                  A quién
                </label>
                <select
                  id={`${idBase}-quien`}
                  name="memberId"
                  defaultValue=""
                  className="fo-input"
                  disabled={invitando}
                >
                  <option value="">Elegí a alguien…</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor={`${idBase}-criterio`}>
                  Por qué la elegimos
                </label>
                <p className="fo-helper">Opcional. Queda en el historial, no se la mandamos.</p>
                <textarea
                  id={`${idBase}-criterio`}
                  name="criteria"
                  rows={2}
                  className="fo-input"
                  disabled={invitando}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="fo-btn fo-btn-primary min-h-11 text-sm"
                  disabled={invitando}
                >
                  {invitando ? "Invitando…" : "Mandar la invitación"}
                </button>
                <button
                  type="button"
                  onClick={() => setAbriendoInvitacion(false)}
                  className="fo-btn fo-btn-ghost min-h-11 text-sm"
                >
                  Mejor no
                </button>
              </div>
              <p className="fo-helper">
                Le llega un aviso y decide si puede. Hasta que conteste, el lugar sigue reservado
                para esa persona.
              </p>
            </form>
          )}
        </div>
      ) : null}
    </article>
  );
}

/**
 * Una postulación, con su mensaje y el botón de seleccionar.
 *
 * Cada postulación lleva su propio `useActionState`: seleccionar a una persona no deshabilita
 * el botón de la de al lado ni le pega su mensaje de error.
 *
 * Quien no queda seleccionada no "perdió" nada y la pantalla no la marca de ninguna manera: se
 * anotó, y hoy no hizo falta.
 */
function PostulacionItem({
  postulacion,
  hayLugar,
  puedeCoordinar,
}: {
  postulacion: PostulacionProps;
  hayLugar: boolean;
  puedeCoordinar: boolean;
}) {
  const [state, seleccionar, seleccionando] = useActionState(seleccionarPostulacionAction, inicial);

  return (
    <li className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
      <p className="text-sm">
        <span className="font-medium">{postulacion.nombre}</span>{" "}
        <span className="text-[var(--fo-muted)]">
          — se anotó el {postulacion.fecha} · {postulacion.statusLabel}
        </span>
      </p>
      {postulacion.mensaje ? (
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">«{postulacion.mensaje}»</p>
      ) : null}

      <Aviso state={state} />

      {puedeCoordinar && postulacion.pendiente && !state.ok ? (
        <form action={seleccionar} className="space-y-1">
          <input type="hidden" name="applicationId" value={postulacion.id} />
          <button
            type="submit"
            className="fo-btn fo-btn-primary min-h-11 text-sm"
            disabled={seleccionando || !hayLugar}
          >
            {seleccionando ? "Sumando…" : "Sumar al equipo"}
          </button>
          <p className="fo-helper">
            {hayLugar
              ? "Le avisamos que quedó y ocupa uno de los lugares del rol."
              : "Este rol ya está completo."}
          </p>
        </form>
      ) : null}
    </li>
  );
}

/**
 * El aviso de una acción, en el orden en que importa: el error primero, después lo que salió a
 * medias, y al final lo que salió bien.
 *
 * El del medio es el caso real de esta tanda: la invitación quedó hecha pero el correo no salió
 * (o esa persona no tiene correo cargado). Pintarlo de verde haría que la coordinación se quede
 * esperando una respuesta que nadie pidió; pintarlo de rojo haría pensar que no se invitó a
 * nadie. Es el mismo criterio que ya usa el panel de solicitudes.
 */
function Aviso({ state }: { state: EquipoState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed text-[var(--fo-danger)]"
      >
        {state.error}
      </p>
    );
  }
  if (state.warn) {
    return (
      <p
        role="alert"
        className="fo-alert-warning rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed"
      >
        {state.warn}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p
        role="status"
        className="fo-alert-success rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed"
      >
        {state.ok}
      </p>
    );
  }
  return null;
}
