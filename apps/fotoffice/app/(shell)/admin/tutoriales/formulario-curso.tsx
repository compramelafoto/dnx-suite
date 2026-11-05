"use client";

import { useActionState } from "react";
import type { BloqueTutorial, VideosDelCurso } from "@/lib/tutoriales/curso";
import { guardarLinksDelCurso, type EstadoGuardado } from "./actions";

type Props = {
  slug: string;
  titulo: string;
  ruta: string;
  bloques: BloqueTutorial[];
  videos: VideosDelCurso;
};

export function FormularioCurso({ slug, titulo, ruta, bloques, videos }: Props) {
  const [estado, accion, guardando] = useActionState<EstadoGuardado, FormData>(guardarLinksDelCurso, null);

  return (
    <form action={accion} className="fo-card space-y-5">
      <input type="hidden" name="curso" value={slug} />
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">{titulo}</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Pegá el link de YouTube de cada clase. Las clases sin link se muestran como «Próximamente». El video tiene
          que estar público o no listado.
        </p>
      </div>

      {estado ? (
        <div className={estado.ok ? "fo-alert-success" : "fo-alert-error"} role="status">
          {estado.mensaje}
        </div>
      ) : null}

      {bloques.map((bloque) => (
        <fieldset key={bloque.titulo} className="space-y-3">
          <legend className="text-sm font-medium text-[var(--fo-text)]">{bloque.titulo}</legend>
          {bloque.clases.map((clase) => (
            <label key={clase.clave} className="block space-y-1">
              <span className="fo-label">
                Clase {clase.etiqueta} · {clase.titulo}
              </span>
              <input
                name={`clase-${clase.clave}`}
                defaultValue={videos[clase.clave] ?? ""}
                placeholder="https://youtu.be/..."
                className="fo-input w-full"
              />
            </label>
          ))}
        </fieldset>
      ))}

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar curso"}
        </button>
        <a href={ruta} target="_blank" rel="noopener noreferrer" className="fo-btn fo-btn-secondary">
          Ver curso
        </a>
      </div>
    </form>
  );
}
