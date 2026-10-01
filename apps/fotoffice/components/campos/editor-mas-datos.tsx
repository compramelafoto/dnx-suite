"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { guardarValoresAction } from "@/app/actions/campos";
import { MAX_ENLACE, MAX_TEXTO, MAX_TEXTO_LARGO } from "@/lib/campos/constantes";
import { valoresCambiados, type CampoVista } from "@/lib/campos/vista";

type Resultado = Awaited<ReturnType<typeof guardarValoresAction>>;

const CONFIGURACION_CAMBIO = "La configuración de los campos cambió; recargá la página.";

/**
 * La parte interactiva de "Más datos": el botón "Editar" (sólo si `puedeEditar`) y el
 * formulario con un control por tipo. Recibe objetos planos: nada de la base viaja acá.
 * La vista de lectura llega armada desde el servidor como `children`.
 */
export function EditorMasDatos({
  entityType,
  entityId,
  campos,
  puedeEditar,
  children,
}: {
  entityType: "CLIENTE" | "SOCIO" | "CONSULTA";
  entityId: string;
  campos: CampoVista[];
  puedeEditar: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function abrir() {
    setValores(Object.fromEntries(campos.map((c) => [c.id, c.crudo])));
    setErrores({});
    setError(null);
    setEditando(true);
  }

  function cancelar() {
    setEditando(false);
    setErrores({});
    setError(null);
  }

  function cambiar(id: string, v: string) {
    setValores((prev) => ({ ...prev, [id]: v }));
    if (errores[id]) setErrores(({ [id]: _quitado, ...resto }) => resto);
  }

  function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Sólo lo que cambió: lo demás queda como está guardado.
    const datos = valoresCambiados(campos, valores);
    if (Object.keys(datos).length === 0) {
      cancelar();
      return;
    }
    iniciar(async () => {
      let r: Resultado;
      try {
        r = await guardarValoresAction({ entityType, entityId, valores: datos });
      } catch {
        setError("No se pudo guardar. Probá de nuevo.");
        return;
      }
      if (r.ok) {
        setEditando(false);
        router.refresh();
        return;
      }
      const errores = r.errores ?? {};
      const ids = new Set(campos.map((c) => c.id));
      if (Object.keys(errores).some((id) => !ids.has(id))) {
        // Un campo que el formulario no tiene (alguien cambió la configuración mientras tanto).
        setError(CONFIGURACION_CAMBIO);
        setErrores(Object.fromEntries(Object.entries(errores).filter(([id]) => ids.has(id))));
        router.refresh();
        return;
      }
      setError(r.error);
      setErrores(errores);
    });
  }

  if (!editando) {
    return (
      <>
        {puedeEditar ? (
          <div className="flex justify-end">
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={abrir}>
              Editar
            </button>
          </div>
        ) : null}
        {children}
      </>
    );
  }

  return (
    <form onSubmit={guardar} className="space-y-3" noValidate>
      {campos.map((c) => (
        <Control key={c.id} campo={c} valor={valores[c.id] ?? ""} error={errores[c.id]} onCambio={(v) => cambiar(c.id, v)} />
      ))}
      {error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={cancelar} disabled={pendiente}>
          Cancelar
        </button>
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function Control({
  campo,
  valor,
  error,
  onCambio,
}: {
  campo: CampoVista;
  valor: string;
  error: string | undefined;
  onCambio: (v: string) => void;
}) {
  const id = `campo-${campo.id}`;
  const idError = `${id}-error`;
  const comunes = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? idError : undefined,
    "aria-required": campo.obligatorio || undefined,
  };
  const etiqueta = (
    <label className="fo-label" htmlFor={id}>
      {campo.nombre}
      {campo.obligatorio ? <span className="text-[var(--fo-danger)]"> *</span> : null}
    </label>
  );

  let control: ReactNode;
  switch (campo.tipo) {
    case "TEXTO_LARGO":
      control = (
        <textarea {...comunes} className="fo-input" rows={4} maxLength={MAX_TEXTO_LARGO} value={valor} onChange={(e) => onCambio(e.target.value)} />
      );
      break;
    case "NUMERO":
      control = (
        <input {...comunes} type="text" inputMode="decimal" className="fo-input" value={valor} onChange={(e) => onCambio(e.target.value)} />
      );
      break;
    case "FECHA":
      control = <input {...comunes} type="date" className="fo-input" value={valor} onChange={(e) => onCambio(e.target.value)} />;
      break;
    case "SI_NO":
      control = (
        <select {...comunes} className="fo-input" value={valor} onChange={(e) => onCambio(e.target.value)}>
          <option value="">Sin dato</option>
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
      );
      break;
    case "LISTA":
      control = (
        <select {...comunes} className="fo-input" value={valor} onChange={(e) => onCambio(e.target.value)}>
          <option value="">Sin dato</option>
          {campo.opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case "ENLACE":
      control = (
        <input
          {...comunes}
          type="url"
          inputMode="url"
          placeholder="https://"
          className="fo-input"
          maxLength={MAX_ENLACE}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
        />
      );
      break;
    default:
      control = (
        <input {...comunes} type="text" className="fo-input" maxLength={MAX_TEXTO} value={valor} onChange={(e) => onCambio(e.target.value)} />
      );
  }

  return (
    <div className="fo-field-stack">
      {etiqueta}
      {control}
      {error ? (
        <p id={idError} className="text-xs text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
