"use client";

import { useActionState } from "react";
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
 */
export function EquipoPanel({
  roles,
  colaboradores,
  puedeCoordinar,
}: {
  roles: RolProps[];
  colaboradores: ColaboradorProps[];
  puedeCoordinar: boolean;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">El equipo</h2>
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

  return (
    <article className="fo-card space-y-4 p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">{rol.nombre}</h3>
        <span className="text-sm text-[var(--fo-muted)]">
          {rol.asignaciones.length} de {rol.vacancies} ·{" "}
          {rol.libres === 1 ? "1 lugar libre" : `${rol.libres} lugares libres`}
        </span>
      </header>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Quién quedó</h4>
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
        <h4 className="text-sm font-medium">Quién se anotó</h4>
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
          <h4 className="text-sm font-medium">Invitar a alguien directamente</h4>
          {/* `colaboradores` llega ya sin quienes están en el equipo de ESTA cobertura: la
              exclusión es por cobertura y no por rol (`@@unique([coverageId, memberId])` en el
              modelo), así que la resuelve la página una vez y no cada tarjeta por su cuenta. */}
          {colaboradores.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">
              No queda ningún colaborador activo libre: o ya están todos en esta cobertura, o
              todavía no se marcó a nadie como colaborador.
            </p>
          ) : (
            <form action={invitar} className="space-y-3">
              <input type="hidden" name="roleId" value={rol.id} />
              <label className="fo-field-stack">
                <span className="fo-label">A quién</span>
                <select name="memberId" defaultValue="" className="fo-input" disabled={invitando}>
                  <option value="">Elegí a alguien…</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fo-field-stack">
                <span className="fo-label">Por qué la elegimos (opcional, queda en el historial)</span>
                <textarea name="criteria" rows={2} className="fo-input" disabled={invitando} />
              </label>
              {state.error ? (
                <p role="alert" className="text-sm text-[var(--fo-danger)]">
                  {state.error}
                </p>
              ) : null}
              {state.ok ? <p className="text-sm text-[var(--fo-muted)]">{state.ok}</p> : null}
              <button
                type="submit"
                className="fo-btn fo-btn-secondary min-h-11"
                disabled={invitando || rol.libres === 0}
              >
                {invitando ? "Invitando…" : "Te invitamos a participar"}
              </button>
              {rol.libres === 0 ? (
                <p className="text-sm text-[var(--fo-muted)]">
                  Este rol ya tiene a toda su gente. Para sumar a alguien más, primero agregale
                  una vacante.
                </p>
              ) : null}
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
    <li className="space-y-2 rounded-md border border-[var(--fo-border)] p-3">
      <p className="text-sm">
        <span className="font-medium">{postulacion.nombre}</span>{" "}
        <span className="text-[var(--fo-muted)]">
          — se anotó el {postulacion.fecha} · {postulacion.statusLabel}
        </span>
      </p>
      {postulacion.mensaje ? (
        <p className="text-sm text-[var(--fo-muted)]">«{postulacion.mensaje}»</p>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="text-sm text-[var(--fo-muted)]">{state.ok}</p> : null}

      {puedeCoordinar && postulacion.pendiente && !state.ok ? (
        <form action={seleccionar}>
          <input type="hidden" name="applicationId" value={postulacion.id} />
          <button
            type="submit"
            className="fo-btn min-h-11 text-sm"
            disabled={seleccionando || !hayLugar}
          >
            {seleccionando ? "Invitando…" : "Sumar al equipo"}
          </button>
        </form>
      ) : null}
    </li>
  );
}
