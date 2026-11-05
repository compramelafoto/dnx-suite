"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  formatearDuracion,
  idDeYoutube,
  type BloqueTutorial,
  type DetalleClase,
  type VideosDelCurso,
} from "@/lib/tutoriales/curso";

type Props = {
  bloques: BloqueTutorial[];
  detalles: Record<string, DetalleClase>;
  videos: VideosDelCurso;
};

function suscribirAncla(aviso: () => void) {
  window.addEventListener("hashchange", aviso);
  return () => window.removeEventListener("hashchange", aviso);
}

/**
 * El video de la clase elegida, su descripción con capítulos y la lista de clases del curso.
 * La clase abierta queda en el ancla (#clase-3) para poder compartir el link.
 */
export function ReproductorCurso({ bloques, detalles, videos }: Props) {
  const clases = useMemo(
    () => bloques.flatMap((b, indiceBloque) => b.clases.map((c) => ({ ...c, indiceBloque }))),
    [bloques],
  );
  const primera = (clases.find((c) => videos[c.clave]) ?? clases[0]).clave;
  // Un link compartido abre la clase de su ancla; después manda la que elige la persona.
  const ancla = useSyncExternalStore(suscribirAncla, () => window.location.hash, () => "");
  const delAncla = ancla.match(/^#clase-([a-z0-9]+)$/)?.[1];
  const [elegida, setActual] = useState<string | null>(null);
  const actual = elegida ?? (delAncla && clases.some((c) => c.clave === delAncla) ? delAncla : primera);
  const [inicio, setInicio] = useState({ en: 0, reproducir: false });
  const reproductorRef = useRef<HTMLDivElement>(null);

  const abrir = useCallback((clave: string, en = 0) => {
    setActual(clave);
    setInicio({ en, reproducir: true });
    window.history.replaceState(null, "", `#clase-${clave}`);
    const arriba = reproductorRef.current?.getBoundingClientRect().top ?? 0;
    if (arriba < 0 || arriba > window.innerHeight * 0.5) {
      reproductorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const indice = Math.max(0, clases.findIndex((c) => c.clave === actual));
  const clase = clases[indice];
  const anterior = clases[indice - 1];
  const siguiente = clases[indice + 1];
  const detalle = detalles[clase.clave];
  const idVideo = videos[clase.clave] ? idDeYoutube(videos[clase.clave]) : null;
  const src = idVideo
    ? `https://www.youtube-nocookie.com/embed/${idVideo}?rel=0&modestbranding=1&playsinline=1&start=${inicio.en}${
        inicio.reproducir ? "&autoplay=1" : ""
      }`
    : null;
  const publicadas = clases.filter((c) => videos[c.clave]);
  const minutos = Math.round(
    publicadas.reduce((total, c) => total + (detalles[c.clave]?.duracionSegundos ?? 0), 0) / 60,
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div ref={reproductorRef} className="scroll-mt-6">
        <div className="aspect-video w-full overflow-hidden rounded-[var(--fo-radius)] bg-[#0f172a] shadow-[var(--fo-shadow-md)]">
          {src ? (
            <iframe
              key={src}
              src={src}
              title={clase.titulo}
              className="h-full w-full"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-white/70">
              Esta clase todavía no está publicada.
            </div>
          )}
        </div>

        <div className="mt-6 max-w-[68ch]">
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-[var(--fo-muted)]">
            <span className="font-semibold text-[var(--fo-accent-hover)]">Clase {clase.etiqueta}</span>
            {detalle ? <span className="tabular-nums">{formatearDuracion(detalle.duracionSegundos)}</span> : null}
          </p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-[var(--fo-text)] md:text-[1.75rem]">
            {clase.titulo}
          </h2>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-[var(--fo-text-secondary)]">
            {detalle?.descripcion ?? clase.resumen}
          </p>

          {detalle && detalle.capitulos.length > 0 && idVideo ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-[var(--fo-text)]">Saltá a una parte</h3>
              <ol className="mt-2 divide-y divide-[var(--fo-border)] border-y border-[var(--fo-border)]">
                {detalle.capitulos.map((cap) => (
                  <li key={cap.en}>
                    <button
                      type="button"
                      onClick={() => abrir(clase.clave, cap.en)}
                      className="flex w-full items-baseline gap-4 py-2.5 text-left text-[0.95rem] text-[var(--fo-text-secondary)] hover:text-[var(--fo-accent-hover)]"
                    >
                      <span className="w-10 shrink-0 tabular-nums text-[var(--fo-accent-hover)]">
                        {formatearDuracion(cap.en)}
                      </span>
                      <span>{cap.texto}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            {anterior ? (
              <button type="button" onClick={() => abrir(anterior.clave)} className="fo-btn fo-btn-secondary">
                Clase anterior
              </button>
            ) : null}
            {siguiente ? (
              <button
                type="button"
                onClick={() => abrir(siguiente.clave)}
                className="fo-btn fo-btn-primary h-auto max-w-full whitespace-normal py-2.5 text-left leading-snug"
              >
                Siguiente: {siguiente.titulo}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <nav aria-label="Clases del curso" className="lg:sticky lg:top-6">
        <div className="rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)]">
          <p className="border-b border-[var(--fo-border)] px-5 py-4 text-sm text-[var(--fo-muted)]">
            <span className="font-semibold text-[var(--fo-text)]">{clases.length} clases</span>
            {publicadas.length === clases.length
              ? `, unos ${minutos} minutos en total`
              : publicadas.length > 0
                ? `, ${publicadas.length} ya publicadas`
                : ""}
          </p>
          <div className="lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
            {bloques.map((bloque, indiceBloque) => (
              <section key={bloque.titulo} className="border-b border-[var(--fo-border)] last:border-b-0">
                <h3 className="px-5 pb-1 pt-4 text-[0.8rem] font-semibold text-[var(--fo-muted)]">
                  Bloque {indiceBloque + 1}: {bloque.titulo}
                </h3>
                <ol className="pb-2">
                  {clases
                    .filter((c) => c.indiceBloque === indiceBloque)
                    .map((c) => {
                      const activa = c.clave === clase.clave;
                      const d = detalles[c.clave];
                      return (
                        <li key={c.clave}>
                          <button
                            type="button"
                            onClick={() => abrir(c.clave)}
                            aria-current={activa ? "true" : undefined}
                            className={`flex w-full items-start gap-3 border-l-[3px] px-5 py-2.5 text-left transition-colors ${
                              activa
                                ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)]"
                                : "border-transparent hover:bg-[var(--fo-surface-hover)]"
                            }`}
                          >
                            <span
                              className={`mt-0.5 w-8 shrink-0 text-right text-sm tabular-nums ${
                                activa ? "font-semibold text-[var(--fo-accent-hover)]" : "text-[var(--fo-muted-soft)]"
                              }`}
                            >
                              {c.etiqueta}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={`block text-[0.95rem] leading-snug ${
                                  activa ? "font-semibold text-[var(--fo-text)]" : "text-[var(--fo-text-secondary)]"
                                }`}
                              >
                                {c.titulo}
                              </span>
                              <span className="mt-0.5 block text-xs text-[var(--fo-muted-soft)]">
                                {videos[c.clave] && d ? formatearDuracion(d.duracionSegundos) : "Próximamente"}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ol>
              </section>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
