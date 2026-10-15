"use client";

/**
 * El portfolio del jurado: hasta doce fotos que se ven en su página pública y
 * en el directorio.
 *
 * Se reordena con dos flechas, no arrastrando: en un teléfono arrastrar es
 * incómodo y con teclado es inaccesible.
 */
import { useRef, useState, useTransition } from "react";

import {
  borrarImagenDePortfolioAction,
  moverImagenDePortfolioAction,
  ponerTituloAImagenAction,
  subirImagenDePortfolioAction,
} from "../../../actions/judgePortfolio";
import { PORTFOLIO_MAX_IMAGENES } from "../../../lib/fotorank/judges/portfolioKeys";
import { achicarImagen } from "../../../lib/fotorank/judges/ui/achicarImagen";

export type ImagenDePortfolio = {
  id: string;
  src: string;
  title: string | null;
};

const FORMATOS = "image/jpeg,image/png,image/webp";

export function PortfolioDelJurado({ iniciales }: { iniciales: ImagenDePortfolio[] }) {
  const [imagenes, setImagenes] = useState(iniciales);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const completo = imagenes.length >= PORTFOLIO_MAX_IMAGENES;
  const quedan = PORTFOLIO_MAX_IMAGENES - imagenes.length;

  const subir = async (archivos: FileList | null) => {
    setError(null);
    if (!archivos || archivos.length === 0) return;

    // De a una, mostrando cuál va: subir seis de golpe sin decir nada parece
    // que se colgó.
    const elegidas = Array.from(archivos).slice(0, quedan);
    if (archivos.length > quedan) {
      setError(
        `Sólo entran ${quedan} ${quedan === 1 ? "imagen más" : "imágenes más"}. Subimos las primeras.`,
      );
    }

    for (const [i, original] of elegidas.entries()) {
      setSubiendo(`Subiendo ${i + 1} de ${elegidas.length}…`);
      const achicada = await achicarImagen(original);

      const fd = new FormData();
      fd.append("file", achicada.archivo);
      if (achicada.ancho) fd.append("width", String(achicada.ancho));
      if (achicada.alto) fd.append("height", String(achicada.alto));

      const r = await subirImagenDePortfolioAction(fd);
      if (!r.ok) {
        setError(r.error);
        break;
      }
      if (r.data) {
        setImagenes((actuales) => [...actuales, { id: r.data!.id, src: r.data!.src, title: null }]);
      }
    }

    setSubiendo(null);
    if (input.current) input.current.value = "";
  };

  const mover = (id: string, hacia: "arriba" | "abajo") => {
    setError(null);
    const i = imagenes.findIndex((img) => img.id === id);
    const destino = hacia === "arriba" ? i - 1 : i + 1;
    if (i === -1 || destino < 0 || destino >= imagenes.length) return;

    // Se mueve en la pantalla primero para que no se sienta lento; si el
    // servidor falla, se avisa y se recarga.
    const copia = [...imagenes];
    [copia[i], copia[destino]] = [copia[destino]!, copia[i]!];
    setImagenes(copia);

    empezar(async () => {
      const r = await moverImagenDePortfolioAction(id, hacia);
      if (!r.ok) {
        setError(`${r.error} Recargá la página.`);
        setImagenes(imagenes);
      }
    });
  };

  const borrar = (id: string) => {
    setError(null);
    empezar(async () => {
      const r = await borrarImagenDePortfolioAction(id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setImagenes((actuales) => actuales.filter((img) => img.id !== id));
    });
  };

  const titular = (id: string, titulo: string) => {
    setImagenes((actuales) =>
      actuales.map((img) => (img.id === id ? { ...img, title: titulo } : img)),
    );
    empezar(async () => {
      const r = await ponerTituloAImagenAction(id, titulo);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-sans text-lg font-semibold text-fr-primary">Tu portfolio</h2>
        <p className="mt-1 text-sm text-fr-muted">
          {imagenes.length === 0
            ? `Hasta ${PORTFOLIO_MAX_IMAGENES} fotos de tu trabajo.`
            : `${imagenes.length} de ${PORTFOLIO_MAX_IMAGENES} imágenes.`}{" "}
          Se ven en tu página pública y ayudan a que te convoquen.
        </p>
      </div>

      <div className="space-y-2">
        <input
          ref={input}
          type="file"
          multiple
          accept={FORMATOS}
          disabled={completo || !!subiendo || pendiente}
          aria-label="Elegir fotos para tu portfolio"
          onChange={(e) => void subir(e.target.files)}
          className="block text-xs text-fr-muted file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-fr-primary disabled:opacity-50"
        />
        {completo ? (
          <p className="text-xs text-fr-muted">
            Llegaste al máximo. Borrá alguna para subir otra.
          </p>
        ) : (
          <p className="text-xs text-fr-muted">
            JPEG, PNG o WebP. Las achicamos solas antes de subirlas, así que no importa que
            sean pesadas.
          </p>
        )}
        {subiendo ? (
          <p className="text-xs text-fr-primary" role="status">
            {subiendo}
          </p>
        ) : null}
        {error ? (
          <p className="text-xs text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {imagenes.length === 0 ? (
        <p className="rounded border border-dashed border-fr-border px-4 py-6 text-center text-sm text-fr-muted">
          Todavía no subiste ninguna foto.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {imagenes.map((img, i) => (
            <li key={img.id} className="space-y-2 rounded border border-fr-border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt={img.title ?? ""}
                className="aspect-[4/3] w-full rounded object-cover"
              />

              <input
                type="text"
                defaultValue={img.title ?? ""}
                maxLength={120}
                placeholder="Título (opcional)"
                aria-label={`Título de la imagen ${i + 1}`}
                onBlur={(e) => titular(img.id, e.target.value)}
                className="w-full rounded border border-fr-border bg-fr-bg px-2 py-1 text-xs text-fr-primary"
              />

              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={i === 0 || pendiente}
                    onClick={() => mover(img.id, "arriba")}
                    aria-label={`Mover la imagen ${i + 1} hacia adelante`}
                    className="rounded border border-fr-border px-2 py-1 text-xs text-fr-muted hover:text-fr-primary disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={i === imagenes.length - 1 || pendiente}
                    onClick={() => mover(img.id, "abajo")}
                    aria-label={`Mover la imagen ${i + 1} hacia atrás`}
                    className="rounded border border-fr-border px-2 py-1 text-xs text-fr-muted hover:text-fr-primary disabled:opacity-30"
                  >
                    →
                  </button>
                </div>

                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => borrar(img.id)}
                  className="text-xs text-red-300 underline underline-offset-2 disabled:opacity-50"
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
