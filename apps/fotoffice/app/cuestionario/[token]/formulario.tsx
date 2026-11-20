"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LARGO_MAXIMO } from "@/lib/cuestionarios/respuestas";
import type { DefinicionCuestionario, Pregunta } from "@/lib/cuestionarios/tipos";
import { enviarRespuestasAction } from "./actions";

/**
 * El formulario del cliente: todas las secciones en una sola página, una debajo de otra, pensado
 * para el celular. Lo que se va escribiendo queda guardado en el navegador (por si se cierra la
 * pestaña sin querer) hasta que se envía.
 */

type Props = {
  token: string;
  definicion: DefinicionCuestionario;
  inicial: Record<string, string>;
  yaRespondido: boolean;
  nombreEstudio: string;
};

function claveBorrador(token: string) {
  return `fo-cuestionario-${token}`;
}

function leerBorrador(token: string): Record<string, string> | null {
  try {
    const crudo = window.localStorage.getItem(claveBorrador(token));
    if (!crudo) return null;
    const obj = JSON.parse(crudo) as unknown;
    if (!obj || typeof obj !== "object") return null;
    const salida: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) if (typeof v === "string") salida[k] = v;
    return salida;
  } catch {
    return null;
  }
}

function guardarBorrador(token: string, valores: Record<string, string>) {
  try {
    window.localStorage.setItem(claveBorrador(token), JSON.stringify(valores));
  } catch {
    // Sin almacenamiento (modo privado, por ejemplo): se sigue igual, sólo que sin borrador.
  }
}

function borrarBorrador(token: string) {
  try {
    window.localStorage.removeItem(claveBorrador(token));
  } catch {
    // Nada que hacer.
  }
}

export function FormularioCuestionario({ token, definicion, inicial, yaRespondido, nombreEstudio }: Props) {
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const [vista, setVista] = useState<"formulario" | "gracias">(yaRespondido ? "gracias" : "formulario");
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [pendiente, iniciar] = useTransition();
  const cargado = useRef(false);

  // El borrador del navegador sólo se recupera si todavía no se había respondido.
  useEffect(() => {
    if (cargado.current) return;
    cargado.current = true;
    if (yaRespondido) return;
    const borrador = leerBorrador(token);
    if (borrador) setValores((v) => ({ ...v, ...borrador }));
  }, [token, yaRespondido]);

  function cambiar(id: string, valor: string) {
    setValores((v) => {
      const nuevo = { ...v, [id]: valor };
      guardarBorrador(token, nuevo);
      return nuevo;
    });
    if (errores[id]) setErrores(({ [id]: _quitado, ...resto }) => resto);
  }

  function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await enviarRespuestasAction(token, valores);
      if (r.ok) {
        borrarBorrador(token);
        setErrores({});
        setVista("gracias");
        setCorrigiendo(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setError(r.error);
      setErrores(Object.fromEntries((r.errores ?? []).map((e) => [e.preguntaId, e.mensaje])));
    });
  }

  if (vista === "gracias") {
    return (
      <section className="fo-card space-y-3 p-6 text-center">
        <p className="text-lg font-semibold">¡Gracias! Ya recibimos tus respuestas.</p>
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
          {corrigiendo
            ? `Las guardamos y ${nombreEstudio ? `${nombreEstudio} ya las puede ver` : "el estudio ya las puede ver"}.`
            : "Este cuestionario ya fue enviado. Si te olvidaste de algo o querés cambiar una respuesta, podés corregirlo."}
        </p>
        <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setVista("formulario")}>
          Corregir mis respuestas
        </button>
      </section>
    );
  }

  return (
    <form className="space-y-6" onSubmit={enviar} noValidate>
      {definicion.secciones.map((s) => (
        <fieldset key={s.id} className="fo-card space-y-5 p-5 sm:p-6">
          <legend className="sr-only">{s.titulo}</legend>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">{s.titulo}</h2>
            {s.descripcion ? <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{s.descripcion}</p> : null}
          </div>
          {s.preguntas.map((p) => (
            <Campo key={p.id} pregunta={p} valor={valores[p.id] ?? ""} error={errores[p.id]} onChange={(v) => cambiar(p.id, v)} />
          ))}
        </fieldset>
      ))}

      {error ? (
        <p role="alert" className="text-sm font-medium text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button type="submit" className="fo-btn fo-btn-primary w-full text-base sm:w-auto" disabled={pendiente}>
          {pendiente ? "Enviando…" : "Enviar respuestas"}
        </button>
      </div>
    </form>
  );
}

function Campo({ pregunta, valor, error, onChange }: { pregunta: Pregunta; valor: string; error?: string; onChange: (v: string) => void }) {
  const id = `p-${pregunta.id}`;
  const comun = {
    id,
    name: pregunta.id,
    value: valor,
    maxLength: LARGO_MAXIMO[pregunta.tipo],
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
    className: "fo-input w-full text-base",
  } as const;
  return (
    <div className="fo-field-stack">
      <label htmlFor={id} className="text-sm font-medium leading-snug">
        {pregunta.etiqueta}
      </label>
      {pregunta.descripcion ? <p className="text-xs text-[var(--fo-muted)]">{pregunta.descripcion}</p> : null}
      {pregunta.tipo === "largo" ? (
        <textarea {...comun} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : pregunta.tipo === "fecha" ? (
        <input {...comun} type="date" onChange={(e) => onChange(e.target.value)} />
      ) : pregunta.tipo === "telefono" ? (
        <input {...comun} type="tel" inputMode="tel" autoComplete="off" onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...comun} type="text" onChange={(e) => onChange(e.target.value)} />
      )}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
