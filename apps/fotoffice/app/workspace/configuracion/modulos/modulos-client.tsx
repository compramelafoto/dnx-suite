"use client";

import { useActionState, useState } from "react";
import {
  chooseOrganizationTypeAction,
  requestModuleAction,
  toggleModuleAction,
  type ModulosState,
} from "./actions";

export type ModuloVista = {
  key: string;
  label: string;
  porque: string;
  planned: boolean;
  platformFee: boolean;
  enabled: boolean;
};
export type FamiliaVista = { id: string; label: string; modulos: ModuloVista[] };
export type TipoVista = { id: string; label: string; resumen: string; paquete: string[] };

function Mensajes({ state }: { state: ModulosState | undefined }) {
  return (
    <>
      {state?.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-sm text-[var(--fo-success)]">{state.ok}</p> : null}
    </>
  );
}

function FilaModulo({ m, nombres }: { m: ModuloVista; nombres: Record<string, string> }) {
  const [toggleState, toggle, toggling] = useActionState(toggleModuleAction, undefined);
  const [requestState, request, requesting] = useActionState(requestModuleAction, undefined);
  const [oculta, setOculta] = useState<ModulosState | undefined>(undefined);
  const c = oculta === toggleState ? undefined : toggleState?.confirmar;
  const lista = (claves: string[]) => claves.map((k) => nombres[k] ?? k).join(", ");

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{m.label}</p>
          <p className="text-xs text-[var(--fo-muted)]">{m.porque}</p>
        </div>
        {m.planned ? (
          <span className="text-xs text-[var(--fo-muted)]">Próximamente</span>
        ) : m.platformFee ? (
          m.enabled ? (
            <span className="text-xs text-[var(--fo-success)]">Activado por FOTOFFICE</span>
          ) : (
            <form action={request}>
              <input type="hidden" name="moduleKey" value={m.key} />
              <button type="submit" className="fo-btn fo-btn-ghost" disabled={requesting}>
                Pedir activación
              </button>
            </form>
          )
        ) : (
          <form action={toggle}>
            <input type="hidden" name="moduleKey" value={m.key} />
            <input type="hidden" name="enabled" value={m.enabled ? "false" : "true"} />
            <button
              type="submit"
              role="switch"
              aria-checked={m.enabled}
              aria-label={m.label}
              className="fo-btn fo-btn-ghost"
              disabled={toggling}
            >
              {m.enabled ? "Encendido" : "Apagado"}
            </button>
          </form>
        )}
      </div>
      {c && !m.planned && !m.platformFee ? (
        <form action={toggle} className="fo-card space-y-2 p-3" role="alertdialog" aria-label="Confirmar">
          <input type="hidden" name="moduleKey" value={m.key} />
          <input type="hidden" name="enabled" value={c.tipo === "ENCENDER" ? "true" : "false"} />
          <p className="text-sm">
            {c.tipo === "ENCENDER"
              ? `Para usar ${m.label} también se van a encender: ${lista(c.faltan)}.`
              : `Si apagás ${m.label}, también se apagan: ${lista(c.afectados)}. Los datos quedan guardados.`}
          </p>
          <button type="submit" name="confirmado" value="1" className="fo-btn fo-btn-primary" disabled={toggling}>
            Sí, continuar
          </button>
          <button type="button" className="fo-btn fo-btn-ghost" onClick={() => setOculta(toggleState)}>
            Cancelar
          </button>
        </form>
      ) : null}
      <Mensajes state={toggleState} />
      <Mensajes state={requestState} />
    </li>
  );
}

function SelectorTipo({
  tipos,
  actual,
  puedeAplicar,
}: {
  tipos: TipoVista[];
  actual: string | null;
  puedeAplicar: boolean;
}) {
  const [state, action, pending] = useActionState(chooseOrganizationTypeAction, undefined);
  const [elegido, setElegido] = useState<string>(actual ?? "");
  const tipo = tipos.find((t) => t.id === elegido);

  return (
    <form action={action} className="fo-card space-y-4 p-5">
      <h2 className="text-sm font-semibold">¿Qué tipo de organización es?</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {tipos.map((t) => (
          <label key={t.id} className="flex cursor-pointer items-start gap-2 rounded border border-[var(--fo-border)] p-3">
            <input
              type="radio"
              name="tipo"
              value={t.id}
              checked={elegido === t.id}
              onChange={() => setElegido(t.id)}
              className="mt-1"
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block text-xs text-[var(--fo-muted)]">{t.resumen}</span>
            </span>
          </label>
        ))}
      </div>
      {tipo && puedeAplicar && tipo.paquete.length > 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">
          Módulos sugeridos: <strong className="font-medium text-[var(--fo-text)]">{tipo.paquete.join(", ")}</strong>.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {puedeAplicar ? (
          <button
            type="submit"
            name="aplicarPaquete"
            value="1"
            className="fo-btn fo-btn-primary"
            disabled={pending || !elegido}
          >
            Elegir y encender estos módulos
          </button>
        ) : null}
        <button type="submit" className="fo-btn fo-btn-ghost" disabled={pending || !elegido}>
          Sólo elegir el tipo
        </button>
      </div>
      <Mensajes state={state} />
    </form>
  );
}

export function ModulosClient({
  tipos,
  tipoActual,
  familias,
  nombres,
}: {
  tipos: TipoVista[];
  tipoActual: string | null;
  familias: FamiliaVista[];
  nombres: Record<string, string>;
}) {
  const [cambiando, setCambiando] = useState(false);
  const actual = tipos.find((t) => t.id === tipoActual);

  return (
    <div className="space-y-8">
      {!actual || cambiando ? (
        <SelectorTipo tipos={tipos} actual={tipoActual} puedeAplicar />
      ) : (
        <p className="text-sm">
          Tipo: <strong className="font-medium">{actual.label}</strong> ·{" "}
          <button type="button" className="text-[var(--fo-accent,#1d4ed8)]" onClick={() => setCambiando(true)}>
            Cambiar
          </button>
        </p>
      )}
      {familias.map((f) => (
        <section key={f.id} className="fo-card space-y-2 p-5">
          <h2 className="text-sm font-semibold">{f.label}</h2>
          <ul className="divide-y divide-[var(--fo-border)]">
            {f.modulos.map((m) => (
              <FilaModulo key={m.key} m={m} nombres={nombres} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
