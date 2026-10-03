"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { createRoleAction, updateRoleAction, type CommissionActionState } from "../actions";
import { EstadoAccion, enviarSinBorrar } from "../estado-accion";

export type NivelGrilla = "NONE" | "VIEW" | "MANAGE";

export type FilaGrilla = {
  moduleKey: string;
  label: string;
  level: NivelGrilla;
  /** Acciones sensibles que ya tiene guardadas en este módulo. */
  actions: string[];
};

/** Una casilla extra que sólo aparece con "Gestionar" en un módulo (hoy: la plata de proyectos de Caja). */
export type AccionExtra = { moduleKey: string; action: string; label: string; helper: string };

const NIVELES: { value: NivelGrilla; label: string }[] = [
  { value: "NONE", label: "Sin acceso" },
  { value: "VIEW", label: "Ver" },
  { value: "MANAGE", label: "Gestionar" },
];

const ROLES_PATH = "/workspace/configuracion/comision/roles";

/**
 * Nombre, descripción y la grilla de permisos de un rol. Los campos van con los nombres que lee
 * `parseRoleForm` y `parsePermissionGrid`: `name`, `description`, `level:<módulo>` y
 * `action:<módulo>:<acción>`.
 *
 * Las acciones sensibles guardadas que esta pantalla no sabe dibujar viajan ocultas mientras el
 * módulo siga en "Gestionar": la acción reescribe la fila entera del módulo y, si no las
 * mandara, se perderían sin que nadie lo haya pedido.
 */
export function RolForm({
  roleId,
  name,
  description,
  filas,
  extras,
}: {
  roleId: string | null;
  name: string;
  description: string;
  filas: FilaGrilla[];
  extras: AccionExtra[];
}) {
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(
    roleId ? updateRoleAction : createRoleAction,
    undefined as CommissionActionState | undefined,
  );
  const [niveles, setNiveles] = useState<Record<string, NivelGrilla>>(() =>
    Object.fromEntries(filas.map((f) => [f.moduleKey, f.level])),
  );
  const [marcadas, setMarcadas] = useState<Set<string>>(
    () => new Set(filas.flatMap((f) => f.actions.map((a) => `${f.moduleKey}:${a}`))),
  );

  // Un rol nuevo no tiene página propia todavía: al crearlo se vuelve a la lista.
  useEffect(() => {
    if (!roleId && state?.ok) router.push(ROLES_PATH);
  }, [roleId, state, router]);

  const alternar = (clave: string, on: boolean) =>
    setMarcadas((prev) => {
      const next = new Set(prev);
      if (on) next.add(clave);
      else next.delete(clave);
      return next;
    });

  return (
    <form onSubmit={enviarSinBorrar(dispatch)} className="space-y-6">
      {roleId ? <input type="hidden" name="roleId" value={roleId} /> : null}

      <div className="fo-card space-y-4 p-4 sm:p-5">
        <label className="block space-y-1">
          <span className="fo-label">Nombre del rol</span>
          <input
            name="name"
            className="fo-input"
            defaultValue={name}
            maxLength={60}
            autoComplete="off"
            placeholder="Ej.: Tesorería"
          />
        </label>
        <label className="block space-y-1">
          <span className="fo-label">Descripción</span>
          <textarea
            name="description"
            className="fo-input"
            defaultValue={description}
            maxLength={200}
            rows={2}
            placeholder="Para qué es este rol, en una línea."
          />
        </label>
      </div>

      <fieldset className="fo-card space-y-1 p-4 sm:p-5">
        <legend className="px-1 text-sm font-semibold">Qué puede hacer en cada parte del panel</legend>
        <p className="fo-helper pb-2">
          “Ver” deja mirar sin cambiar nada. “Gestionar” deja cargar, editar y borrar.
        </p>
        {filas.length === 0 ? (
          <p className="fo-helper">No tenés módulos activos todavía.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)]">
            {filas.map((f) => {
              const nivel = niveles[f.moduleKey] ?? "NONE";
              const extrasFila = extras.filter((x) => x.moduleKey === f.moduleKey);
              const conocidas = new Set(extrasFila.map((x) => x.action));
              const ocultas = f.actions.filter((a) => !conocidas.has(a));
              return (
                <li key={f.moduleKey} className="space-y-2 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-medium">{f.label}</span>
                    <div role="radiogroup" aria-label={f.label} className="flex flex-wrap gap-x-4 gap-y-1">
                      {NIVELES.map((n) => (
                        <label key={n.value} className="flex min-h-11 items-center gap-1.5 text-sm">
                          <input
                            type="radio"
                            name={`level:${f.moduleKey}`}
                            value={n.value}
                            checked={nivel === n.value}
                            onChange={() => setNiveles((prev) => ({ ...prev, [f.moduleKey]: n.value }))}
                          />
                          {n.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  {nivel === "MANAGE"
                    ? extrasFila.map((x) => {
                        const clave = `${x.moduleKey}:${x.action}`;
                        return (
                          <label
                            key={clave}
                            className="flex items-start gap-2 rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-muted)] p-3 text-sm"
                          >
                            <input
                              type="checkbox"
                              name={`action:${x.moduleKey}:${x.action}`}
                              checked={marcadas.has(clave)}
                              onChange={(e) => alternar(clave, e.target.checked)}
                              className="mt-1"
                            />
                            <span>
                              {x.label}
                              <span className="block text-xs text-[var(--fo-muted)]">{x.helper}</span>
                            </span>
                          </label>
                        );
                      })
                    : null}
                  {nivel === "MANAGE"
                    ? ocultas.map((a) => (
                        <input key={a} type="hidden" name={`action:${f.moduleKey}:${a}`} value="on" />
                      ))
                    : null}
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <EstadoAccion state={state} okText={roleId ? "Guardado." : "Rol creado."} />

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="fo-btn fo-btn-primary min-h-11" disabled={pending}>
          {pending ? "Guardando…" : roleId ? "Guardar rol" : "Crear rol"}
        </button>
        <Link href={ROLES_PATH} className="fo-btn fo-btn-ghost min-h-11">
          Volver a los roles
        </Link>
      </div>
    </form>
  );
}
