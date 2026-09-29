"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Download, Paperclip, RotateCcw, Trash2, Upload } from "lucide-react";
import { borrarAdjuntoAction, enlaceDeDescargaAction, restaurarAdjuntoAction } from "@/app/actions/ficha";
import { TIPOS_PERMITIDOS } from "@/lib/ficha/adjuntos-reglas";
import { fechaBA, fechaHoraBA, tamanoLegible } from "@/lib/ficha/formato";
import { subirAdjunto } from "./subir-adjunto";
import type { AdjuntoVista, PersonaFicha, Resultado } from "./tipos";

type Subida = { clave: string; nombre: string; progreso: number; error: string | null };

/**
 * Adjuntos privados de la persona. Los archivos van directo del navegador al almacenamiento
 * con un enlace firmado; acá sólo se manejan ids de adjunto y enlaces que vencen.
 */
export function Adjuntos({
  persona,
  adjuntos,
  habilitados,
  esConfigurador,
}: {
  persona: PersonaFicha;
  adjuntos: AdjuntoVista[];
  habilitados: boolean;
  esConfigurador: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const listos = adjuntos.filter((a) => a.estado === "LISTO");
  const borrados = adjuntos.filter((a) => a.estado === "BORRADO");
  const total = listos.reduce((s, a) => s + a.tamano, 0);
  const subiendo = subidas.some((s) => s.error === null && s.progreso < 100);

  async function subir(archivos: File[]) {
    if (archivos.length === 0) return;
    const nuevas = archivos.map((f, i) => ({ clave: `${Date.now()}-${i}-${f.name}`, nombre: f.name, progreso: 0, error: null }));
    setSubidas((antes) => [...antes.filter((s) => s.error === null && s.progreso < 100), ...nuevas]);
    // De a uno: el progreso se entiende mejor y no se saturan las conexiones.
    for (const [i, archivo] of archivos.entries()) {
      const clave = nuevas[i]!.clave;
      const actualizar = (cambio: Partial<Subida>) =>
        setSubidas((antes) => antes.map((s) => (s.clave === clave ? { ...s, ...cambio } : s)));
      const r = await subirAdjunto(persona, archivo, (progreso) => actualizar({ progreso: Math.min(progreso, 99) }));
      if (r.ok) setSubidas((antes) => antes.filter((s) => s.clave !== clave));
      else actualizar({ error: r.error });
    }
  }

  function correr(accion: () => Promise<Resultado>) {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      if (!r.ok) setError(r.error);
      setConfirmando(null);
    });
  }

  function descargar(adjuntoId: string) {
    setError(null);
    iniciar(async () => {
      const r = await enlaceDeDescargaAction(persona, adjuntoId);
      if (r.ok) window.location.assign(r.url);
      else setError(r.error);
    });
  }

  return (
    <section className="fo-card space-y-3 p-4" aria-labelledby={`${id}-titulo`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={`${id}-titulo`} className="text-sm font-semibold">
          Adjuntos
        </h2>
        {listos.length > 0 ? <span className="text-xs text-[var(--fo-muted)]">{tamanoLegible(total)} en total</span> : null}
      </div>

      {!habilitados ? (
        <p className="text-sm text-[var(--fo-muted)]">Los adjuntos todavía no están habilitados.</p>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            void subir([...e.dataTransfer.files]);
          }}
          className={`rounded-xl border border-dashed p-3 text-center text-sm ${arrastrando ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)]" : "border-[var(--fo-border-strong)]"}`}
        >
          <input
            ref={input}
            id={`${id}-archivos`}
            type="file"
            multiple
            accept={TIPOS_PERMITIDOS.join(",")}
            className="sr-only"
            onChange={(e) => {
              void subir([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => input.current?.click()} disabled={subiendo}>
            <Upload className="size-4" aria-hidden />
            Elegir archivos
          </button>
          <p className="mt-1 text-xs text-[var(--fo-muted)]">o arrastralos acá · PDF, imágenes, Word o Excel · hasta 10 MB</p>
        </div>
      )}

      {subidas.length > 0 ? (
        <ul className="space-y-2" aria-label="Subidas en curso" aria-live="polite">
          {subidas.map((s) => (
            <li key={s.clave} className="text-xs">
              <div className="flex justify-between gap-2">
                <span className="truncate">{s.nombre}</span>
                <span className={s.error ? "text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"}>
                  {s.error ?? `${s.progreso}%`}
                </span>
              </div>
              {s.error ? null : (
                <progress className="mt-1 h-1.5 w-full" max={100} value={s.progreso} aria-label={`Subiendo ${s.nombre}`} />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {listos.length === 0 && subidas.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Sin archivos adjuntos.</p>
      ) : null}

      <ul className="divide-y divide-[var(--fo-border)]">
        {listos.map((a) => (
          <li key={a.id} className="py-2 text-sm">
            <div className="flex items-start gap-2">
              <Paperclip className="mt-0.5 size-4 shrink-0 text-[var(--fo-muted)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">{a.nombre}</p>
                <p className="text-xs text-[var(--fo-muted)]">
                  {tamanoLegible(a.tamano)} · {a.subidoPor} · <time dateTime={a.fecha}>{fechaHoraBA(a.fecha)}</time>
                </p>
              </div>
              <button
                type="button"
                className="fo-icon-btn"
                onClick={() => descargar(a.id)}
                disabled={pendiente || !habilitados}
                aria-label={`Descargar ${a.nombre}`}
                title="Descargar"
              >
                <Download className="size-4" />
              </button>
              <button
                type="button"
                className="fo-icon-btn fo-icon-btn-danger"
                onClick={() => setConfirmando(a.id)}
                disabled={pendiente || !habilitados}
                aria-label={`Borrar ${a.nombre}`}
                title="Borrar"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            {confirmando === a.id ? (
              <div className="mt-2 space-y-2 rounded-lg bg-[var(--fo-danger-soft)] p-2 text-xs" role="group" aria-label="Confirmar borrado">
                <p>
                  ¿Borrar «{a.nombre}»? Un administrador puede restaurarlo durante 30 días; después se elimina para siempre.
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setConfirmando(null)} disabled={pendiente}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="fo-btn fo-btn-danger text-xs"
                    onClick={() => correr(() => borrarAdjuntoAction(persona, a.id))}
                    disabled={pendiente}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {esConfigurador && borrados.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-[var(--fo-muted)]">Borrados que se pueden restaurar ({borrados.length})</summary>
          <ul className="mt-2 space-y-2">
            {borrados.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 break-words">
                  {a.nombre}
                  {a.restaurableHasta ? <span className="text-[var(--fo-muted)]"> · hasta el {fechaBA(a.restaurableHasta)}</span> : null}
                </span>
                <button
                  type="button"
                  className="fo-btn fo-btn-ghost text-xs"
                  onClick={() => correr(() => restaurarAdjuntoAction(persona, a.id))}
                  disabled={pendiente || !habilitados}
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
