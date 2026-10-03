"use client";

import { useActionState, useMemo, useState } from "react";
import {
  addCommissionMemberAction,
  removeCommissionMemberAction,
  updateCommissionMemberAction,
  type CommissionActionState,
} from "./actions";
import { EstadoAccion, enviarSinBorrar, useAlCambiar } from "./estado-accion";

type Opcion = { id: string; name: string; description?: string | null };

const MAX_RESULTADOS = 50;

/** Quita tildes y mayúsculas para buscar "perez" y encontrar "Pérez". */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Alta en la comisión. La persona es un {socio} activo (se busca por nombre o número) o, si no
 * es {socio}, alguien con cuenta en FOTOFFICE que se busca por correo. Cargo opcional, roles con
 * casillas y el período del mandato.
 */
export function SumarIntegrante({
  socioWord,
  socios,
  offices,
  roles,
}: {
  socioWord: string;
  socios: { id: string; label: string }[];
  offices: Opcion[];
  roles: Opcion[];
}) {
  const [state, dispatch, pending] = useActionState(
    addCommissionMemberAction,
    undefined as CommissionActionState | undefined,
  );
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<"socio" | "correo">("socio");
  const [busqueda, setBusqueda] = useState("");
  const [memberId, setMemberId] = useState("");
  const [vuelta, setVuelta] = useState(0);

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    const lista = q ? socios.filter((s) => normalizar(s.label).includes(q)) : socios;
    return lista.slice(0, MAX_RESULTADOS);
  }, [busqueda, socios]);

  // Al sumar bien, el formulario queda limpio para la próxima persona.
  useAlCambiar(state, (s) => {
    if (s?.ok) {
      setVuelta((v) => v + 1);
      setBusqueda("");
      setMemberId("");
    }
  });

  if (!abierto) {
    return (
      <div className="space-y-2">
        <button type="button" className="fo-btn fo-btn-primary min-h-11" onClick={() => setAbierto(true)}>
          Sumar integrante
        </button>
        <EstadoAccion state={state} okText="Listo, ya es parte de la comisión." />
      </div>
    );
  }

  const elegido = socios.find((s) => s.id === memberId);

  return (
    <form key={vuelta} onSubmit={enviarSinBorrar(dispatch)} className="fo-card space-y-5 p-4 sm:p-5">
      <h2 className="text-base font-semibold">Sumar integrante</h2>

      <fieldset className="space-y-3">
        <legend className="fo-label mb-2">¿Quién?</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" checked={modo === "socio"} onChange={() => setModo("socio")} />
            Es {socioWord}
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" checked={modo === "correo"} onChange={() => setModo("correo")} />
            No es {socioWord}
          </label>
        </div>

        {modo === "socio" ? (
          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="fo-helper">Buscá por nombre, apellido o número</span>
              <input
                type="search"
                className="fo-input"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej.: Pérez o 124"
                autoComplete="off"
              />
            </label>
            <select
              name="memberId"
              className="fo-input"
              size={Math.min(6, Math.max(2, filtrados.length))}
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              aria-label={`Elegí al ${socioWord}`}
            >
              {filtrados.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="fo-helper">
              {filtrados.length === 0
                ? "No hay coincidencias. Probá con otra parte del nombre o con el número."
                : elegido
                  ? `Elegiste: ${elegido.label}`
                  : `Tocá un nombre para elegirlo.${filtrados.length === MAX_RESULTADOS ? " Se muestran los primeros 50: escribí más para achicar la lista." : ""}`}
            </p>
          </div>
        ) : (
          <label className="block space-y-1">
            <span className="fo-helper">
              Correo con el que tiene cuenta en FOTOFFICE (por ejemplo, personal administrativo)
            </span>
            <input name="email" type="email" className="fo-input" autoComplete="off" placeholder="nombre@correo.com" />
          </label>
        )}
      </fieldset>

      <label className="block space-y-1">
        <span className="fo-label">Cargo</span>
        <select name="officeId" className="fo-input" defaultValue="">
          <option value="">Sin cargo (sólo roles)</option>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>

      <RolesCasillas roles={roles} />
      <Fechas />

      <EstadoAccion state={state} okText="Listo, ya es parte de la comisión." />

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="fo-btn fo-btn-primary min-h-11" disabled={pending}>
          {pending ? "Sumando…" : "Sumar a la comisión"}
        </button>
        <button type="button" className="fo-btn fo-btn-ghost min-h-11" onClick={() => setAbierto(false)}>
          Cerrar
        </button>
      </div>
    </form>
  );
}

/** Cambia roles y fechas de alguien que ya está. El cargo no se cambia acá: se quita y se vuelve a sumar. */
export function EditarIntegrante({
  memberId,
  userId,
  nombre,
  roles,
  rolesActuales,
  startsAt,
  endsAt,
}: {
  memberId: string | null;
  userId: number | null;
  nombre: string;
  roles: Opcion[];
  rolesActuales: string[];
  startsAt: string;
  endsAt: string;
}) {
  const [state, dispatch, pending] = useActionState(
    updateCommissionMemberAction,
    undefined as CommissionActionState | undefined,
  );
  const [abierto, setAbierto] = useState(false);

  useAlCambiar(state, (s) => {
    if (s?.ok) setAbierto(false);
  });

  if (!abierto) {
    return (
      <>
        <button type="button" className="fo-btn fo-btn-secondary min-h-11" onClick={() => setAbierto(true)}>
          Editar
        </button>
        {state?.ok ? <EstadoAccion state={state} /> : null}
      </>
    );
  }

  return (
    <form onSubmit={enviarSinBorrar(dispatch)} className="w-full space-y-4 border-t border-[var(--fo-border)] pt-4">
      <p className="text-sm font-semibold">Editar a {nombre}</p>
      <IdentidadOculta memberId={memberId} userId={userId} />
      <RolesCasillas roles={roles} marcados={rolesActuales} />
      <Fechas startsAt={startsAt} endsAt={endsAt} />
      <p className="fo-helper">
        Para cambiarle el cargo, quitalo de la comisión y volvé a sumarlo con el cargo nuevo.
      </p>
      <EstadoAccion state={state} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="fo-btn fo-btn-primary min-h-11" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        <button type="button" className="fo-btn fo-btn-ghost min-h-11" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Quitar pide una segunda confirmación: termina el cargo y saca todos los roles. */
export function QuitarIntegrante({
  memberId,
  userId,
  nombre,
}: {
  memberId: string | null;
  userId: number | null;
  nombre: string;
}) {
  const [state, dispatch, pending] = useActionState(
    removeCommissionMemberAction,
    undefined as CommissionActionState | undefined,
  );
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <>
        <button type="button" className="fo-btn fo-btn-danger-outline min-h-11" onClick={() => setConfirmando(true)}>
          Quitar
        </button>
        <EstadoAccion state={state?.error ? state : undefined} />
      </>
    );
  }

  return (
    <form
      onSubmit={enviarSinBorrar(dispatch)}
      className="fo-alert-error w-full space-y-3 rounded-[var(--fo-radius-sm)] p-3"
    >
      <IdentidadOculta memberId={memberId} userId={userId} />
      <p className="text-sm">
        ¿Quitar a <strong>{nombre}</strong> de la comisión? Se le termina hoy el cargo y pierde todos sus
        roles. Queda en el historial.
      </p>
      <EstadoAccion state={state} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="fo-btn fo-btn-danger min-h-11" disabled={pending}>
          {pending ? "Quitando…" : "Sí, quitar"}
        </button>
        <button type="button" className="fo-btn fo-btn-ghost min-h-11" onClick={() => setConfirmando(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function IdentidadOculta({ memberId, userId }: { memberId: string | null; userId: number | null }) {
  return memberId ? (
    <input type="hidden" name="memberId" value={memberId} />
  ) : (
    <input type="hidden" name="userId" value={userId ?? ""} />
  );
}

function RolesCasillas({ roles, marcados = [] }: { roles: Opcion[]; marcados?: string[] }) {
  return (
    <fieldset className="space-y-2">
      <legend className="fo-label mb-1">Roles</legend>
      <p className="fo-helper">Qué puede ver y hacer en el panel. Podés no elegir ninguno.</p>
      {roles.length === 0 ? (
        <p className="fo-helper">No hay roles creados. Armalos en la pestaña Roles.</p>
      ) : (
        <div className="grid gap-1 sm:grid-cols-2">
          {roles.map((r) => (
            <label key={r.id} className="flex min-h-11 items-start gap-2 py-1 text-sm">
              <input
                type="checkbox"
                name="roleIds"
                value={r.id}
                defaultChecked={marcados.includes(r.id)}
                className="mt-1"
              />
              <span>
                {r.name}
                {r.description ? <span className="block text-xs text-[var(--fo-muted)]">{r.description}</span> : null}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function Fechas({ startsAt = "", endsAt = "" }: { startsAt?: string; endsAt?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1">
        <span className="fo-label">Desde</span>
        <input type="date" name="startsAt" className="fo-input" defaultValue={startsAt} />
        <span className="fo-helper">Vacío: desde hoy.</span>
      </label>
      <label className="block space-y-1">
        <span className="fo-label">Hasta</span>
        <input type="date" name="endsAt" className="fo-input" defaultValue={endsAt} />
        <span className="fo-helper">Vacío: sin vencimiento.</span>
      </label>
    </div>
  );
}
