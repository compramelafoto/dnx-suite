"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  borrarTrabajoAction,
  guardarTrabajoAction,
  publicarTrabajoAction,
  type FormularioTrabajo,
} from "@/app/actions/trabajos";
import { RichTextField } from "@/components/website/inspector/rich-text-field";
import { TRABAJOS_ADMIN_BASE } from "@/lib/trabajos/reglas";

type Categoria = { id: string; nombre: string; visible: boolean };

/**
 * Los datos de un trabajo: título, categoría, lugar, fecha, descripción y SEO. Las fotos van en
 * su propia tarjeta (`TrabajoFotos`) y se guardan solas; esto se guarda con «Guardar».
 *
 * «Publicar» guarda primero: publicar y que salga la versión de antes de los últimos cambios es
 * justo lo que nadie espera.
 */
export function TrabajoEditor({
  id,
  publicado,
  categorias,
  inicial,
}: {
  id: string;
  publicado: boolean;
  categorias: Categoria[];
  inicial: FormularioTrabajo;
}) {
  const [form, setForm] = useState<FormularioTrabajo>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();

  const cambiar = <K extends keyof FormularioTrabajo>(k: K, v: FormularioTrabajo[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setAviso(null);
  };

  function guardar(despues?: () => Promise<{ ok: boolean; error?: string }>, mensaje = "Cambios guardados.") {
    setError(null);
    setAviso(null);
    empezar(async () => {
      const r = await guardarTrabajoAction(id, form);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (despues) {
        const r2 = await despues();
        if (!r2.ok) {
          setError(r2.error ?? "No pudimos completar la acción.");
          return;
        }
      }
      setAviso(mensaje);
      router.refresh();
    });
  }

  function borrar() {
    setError(null);
    empezar(async () => {
      const r = await borrarTrabajoAction(id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      // El trabajo ya no existe (esta pantalla daría 404): el aviso de archivos sueltos va en la lista.
      router.push(r.valor.huerfanas > 0 ? `${TRABAJOS_ADMIN_BASE}?huerfanas=${r.valor.huerfanas}` : TRABAJOS_ADMIN_BASE);
    });
  }

  const categoriaElegida = categorias.find((c) => c.id === form.categoriaId);

  return (
    <section className="fo-card space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="fo-label">Título</span>
          <input value={form.titulo} onChange={(e) => cambiar("titulo", e.target.value)} maxLength={200} className="fo-input" />
        </label>
        <label className="block">
          <span className="fo-label">Categoría</span>
          <select value={form.categoriaId} onChange={(e) => cambiar("categoriaId", e.target.value)} className="fo-input">
            <option value="">Sin categoría (no se ve en el sitio)</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.visible ? "" : " (oculta)"}
              </option>
            ))}
          </select>
          {categoriaElegida && !categoriaElegida.visible ? (
            <span className="mt-1 block text-xs text-[var(--fo-warning)]">
              Esa categoría está oculta: sus trabajos no se muestran en el sitio.
            </span>
          ) : null}
        </label>
        <label className="block">
          <span className="fo-label">Dirección</span>
          <input
            value={form.slug}
            onChange={(e) => cambiar("slug", e.target.value.toLowerCase())}
            maxLength={80}
            className="fo-input font-mono text-sm"
          />
          <span className="mt-1 block text-xs text-[var(--fo-muted)]">Letras minúsculas, números y guiones.</span>
        </label>
        <label className="block">
          <span className="fo-label">Lugar</span>
          <input
            value={form.lugar}
            onChange={(e) => cambiar("lugar", e.target.value)}
            placeholder="Rosario"
            maxLength={200}
            className="fo-input"
          />
        </label>
        <label className="block">
          <span className="fo-label">Fecha</span>
          <input type="date" value={form.fecha} onChange={(e) => cambiar("fecha", e.target.value)} className="fo-input" />
        </label>
      </div>

      <div className="space-y-1.5">
        <span className="fo-label">Descripción</span>
        <div className="rounded-[var(--fo-radius)] border border-[var(--fo-border)] p-2">
          <RichTextField html={inicial.descripcionHtml} onChange={(html) => cambiar("descripcionHtml", html)} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.destacado} onChange={(e) => cambiar("destacado", e.target.checked)} />
        Destacado (aparece primero donde se muestran los destacados)
      </label>

      <details className="rounded-[var(--fo-radius)] border border-[var(--fo-border)] px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">Google (opcional)</summary>
        <div className="mt-3 grid gap-4">
          <label className="block">
            <span className="fo-label">Título para Google</span>
            <input
              value={form.seoTitle}
              onChange={(e) => cambiar("seoTitle", e.target.value)}
              maxLength={120}
              placeholder={form.titulo}
              className="fo-input"
            />
          </label>
          <label className="block">
            <span className="fo-label">Descripción para Google</span>
            <textarea
              value={form.seoDescription}
              onChange={(e) => cambiar("seoDescription", e.target.value)}
              maxLength={320}
              rows={2}
              className="fo-input"
            />
          </label>
        </div>
      </details>

      {error ? <p className="fo-alert-error text-sm">{error}</p> : null}
      {aviso ? <p className="fo-alert-success text-sm">{aviso}</p> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--fo-border)] pt-4">
        <button type="button" className="fo-btn fo-btn-primary" disabled={pendiente} onClick={() => guardar()}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {publicado ? (
          <button
            type="button"
            className="fo-btn fo-btn-secondary"
            disabled={pendiente}
            onClick={() => guardar(() => publicarTrabajoAction(id, false), "Guardado y pasado a borrador: ya no se ve en el sitio.")}
          >
            Despublicar
          </button>
        ) : (
          <button
            type="button"
            className="fo-btn fo-btn-secondary"
            disabled={pendiente}
            onClick={() => guardar(() => publicarTrabajoAction(id, true), "Guardado y publicado.")}
          >
            Guardar y publicar
          </button>
        )}
        <span className="flex-1" />
        {confirmandoBorrar ? (
          <span className="fo-alert-warning flex flex-wrap items-center gap-2 text-sm">
            ¿Borrar el trabajo con todas sus fotos? No se puede deshacer.
            <button type="button" className="fo-btn fo-btn-danger text-sm" disabled={pendiente} onClick={borrar}>
              Sí, borrar
            </button>
            <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setConfirmandoBorrar(false)}>
              No
            </button>
          </span>
        ) : (
          <button type="button" className="fo-btn fo-btn-danger-outline" onClick={() => setConfirmandoBorrar(true)}>
            Borrar trabajo
          </button>
        )}
      </div>
    </section>
  );
}
