"use client";

/**
 * La foto del jurado, cargada por él mismo.
 *
 * Antes sólo podía subirla un organizador, y el archivo iba al disco del
 * servidor, que Vercel borra en cada despliegue.
 */
import { useRef, useState, useTransition } from "react";

import {
  judgeRemoveOwnAvatarAction,
  judgeUploadOwnAvatarAction,
} from "../../../actions/judgeProfessionalProfile";

const TOPE_MB = 2;
const FORMATOS = "image/jpeg,image/png,image/webp";

export function FotoDePerfil({
  srcInicial,
  iniciales,
}: {
  srcInicial: string | null;
  iniciales: string;
}) {
  const [src, setSrc] = useState(srcInicial);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const elegir = (archivo: File | undefined) => {
    setError(null);
    if (!archivo) return;
    if (archivo.size > TOPE_MB * 1024 * 1024) {
      setError(`La imagen supera los ${TOPE_MB} MB.`);
      return;
    }
    empezar(async () => {
      const fd = new FormData();
      fd.append("file", archivo);
      const r = await judgeUploadOwnAvatarAction(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSrc(r.data?.src || null);
      if (input.current) input.current.value = "";
    });
  };

  const quitar = () => {
    setError(null);
    empezar(async () => {
      const r = await judgeRemoveOwnAvatarAction();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSrc(null);
    });
  };

  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Tu foto de perfil"
          className="h-24 w-24 shrink-0 rounded-full border border-zinc-700 object-cover"
        />
      ) : (
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-600 text-xl font-semibold text-fr-muted">
          {iniciales}
        </div>
      )}

      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium text-fr-primary">Tu foto</p>
        <p className="text-xs text-fr-muted">
          JPEG, PNG o WebP, hasta {TOPE_MB} MB. Se ve en tu página pública y en los concursos donde
          seas jurado.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            accept={FORMATOS}
            disabled={pendiente}
            aria-label="Elegir una foto de perfil"
            onChange={(e) => elegir(e.target.files?.[0])}
            className="text-xs text-fr-muted file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-fr-primary"
          />
          {src ? (
            <button
              type="button"
              onClick={quitar}
              disabled={pendiente}
              className="text-xs text-fr-muted underline underline-offset-2 hover:text-fr-primary"
            >
              Quitar foto
            </button>
          ) : null}
        </div>

        {pendiente ? <p className="text-xs text-fr-muted">Guardando…</p> : null}
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
      </div>
    </section>
  );
}
