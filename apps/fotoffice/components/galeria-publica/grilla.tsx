"use client";

import { memo } from "react";
import type { FotoPublica } from "@/lib/galerias/publico-tipos";
import { IconoCheck, IconoComentario } from "./iconos";

const sinMenu = (e: React.SyntheticEvent) => e.preventDefault();

type CeldaProps = {
  foto: FotoPublica;
  numero: number;
  seleccionada: boolean;
  comentarios: number;
  editable: boolean;
  onAbrir: (id: string) => void;
  onAlternar: (id: string) => void;
};

/** Una miniatura: se abre al tocarla y se elige con el círculo de arriba. Memoizada: elegir una no redibuja las demás. */
const Celda = memo(function Celda({ foto, numero, seleccionada, comentarios, editable, onAbrir, onAlternar }: CeldaProps) {
  return (
    <li
      className={`relative aspect-square overflow-hidden rounded-md bg-neutral-200 [contain-intrinsic-size:160px] [content-visibility:auto] ${
        seleccionada ? "ring-4 ring-inset ring-[var(--fo-accent)]" : ""
      }`}
      data-seleccionada={seleccionada ? "true" : undefined}
    >
      <button
        type="button"
        onClick={() => onAbrir(foto.id)}
        aria-label={`Ver la foto ${numero}${seleccionada ? " (elegida)" : ""}`}
        className="absolute inset-0 block h-full w-full"
        onContextMenu={sinMenu}
      >
        {foto.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto.thumbUrl}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onContextMenu={sinMenu}
            onDragStart={sinMenu}
            referrerPolicy="no-referrer"
            width={foto.width ?? undefined}
            height={foto.height ?? undefined}
            className="h-full w-full select-none object-contain [-webkit-touch-callout:none]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs opacity-60">Sin vista previa</span>
        )}
      </button>
      {editable || seleccionada ? (
        <button
          type="button"
          onClick={() => onAlternar(foto.id)}
          disabled={!editable}
          aria-pressed={seleccionada}
          aria-label={seleccionada ? `Quitar la foto ${numero} de mi selección` : `Elegir la foto ${numero}`}
          className={`absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full border-2 shadow ${
            seleccionada ? "border-white bg-[var(--fo-accent)] text-white" : "border-white/90 bg-black/35 text-transparent hover:text-white/80"
          } disabled:cursor-default`}
        >
          <IconoCheck />
        </button>
      ) : null}
      {comentarios > 0 ? (
        <span className="pointer-events-none absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
          <IconoComentario width={12} height={12} />
          {comentarios}
        </span>
      ) : null}
    </li>
  );
});

export function Grilla({
  fotos,
  indices,
  seleccionadas,
  comentariosPorFoto,
  editable,
  onAbrir,
  onAlternar,
}: {
  fotos: FotoPublica[];
  /** Posición de cada foto en la galería completa (el número que ve el cliente). */
  indices: ReadonlyMap<string, number>;
  seleccionadas: ReadonlySet<string>;
  comentariosPorFoto: ReadonlyMap<string, number>;
  editable: boolean;
  onAbrir: (id: string) => void;
  onAlternar: (id: string) => void;
}) {
  return (
    <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-2 md:grid-cols-5 lg:grid-cols-6" onContextMenu={sinMenu}>
      {fotos.map((f) => (
        <Celda
          key={f.id}
          foto={f}
          numero={(indices.get(f.id) ?? 0) + 1}
          seleccionada={seleccionadas.has(f.id)}
          comentarios={comentariosPorFoto.get(f.id) ?? 0}
          editable={editable}
          onAbrir={onAbrir}
          onAlternar={onAlternar}
        />
      ))}
    </ul>
  );
}
