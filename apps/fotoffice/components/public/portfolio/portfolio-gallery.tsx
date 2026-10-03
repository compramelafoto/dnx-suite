"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import type { PublicPortfolioPhoto } from "@/lib/portfolio/public-queries";

/**
 * La galería de una ficha: mampostería ordenada, con las fotos apareciendo al entrar en pantalla.
 *
 * ── Por qué no son columnas CSS ──
 *
 * `column-count` da mampostería gratis pero reordena: con tres columnas, la foto 8 queda arriba de
 * todo en la segunda. El socio eligió un orden y la primera foto es la que lo representa, así que
 * el orden visual tiene que ser el suyo, de izquierda a derecha.
 *
 * Por eso la grilla usa filas de 8 px y cada foto ocupa las que su alto necesita, medido después
 * de montar. Es la única forma de tener mampostería sin romper el orden.
 *
 * ── Las animaciones se apagan solas ──
 *
 * Todo lo que se mueve respeta `prefers-reduced-motion`: quien pidió menos movimiento ve las fotos
 * aparecer de una, sin transiciones. No es un detalle de cortesía — para algunas personas el
 * movimiento produce mareo real.
 */

/** Alto de la fila base de la grilla. Más chico = mampostería más fina y más cálculo. */
const FILA_PX = 8;
const HUECO_PX = 16;

export function PortfolioGallery({
  photos,
  authorName,
}: {
  photos: PublicPortfolioPhoto[];
  authorName: string;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const grilla = useRef<HTMLUListElement>(null);

  /**
   * Cada foto ocupa las filas que su alto real necesita.
   *
   * Se mide en vez de calcularse a partir de la proporción porque el ancho de columna cambia con el
   * tamaño de la ventana, y con él el alto. Se recalcula al cambiar el tamaño y cuando una foto
   * termina de cargar.
   */
  const acomodar = useCallback(() => {
    const cont = grilla.current;
    if (!cont) return;
    for (const item of Array.from(cont.children) as HTMLElement[]) {
      const contenido = item.firstElementChild as HTMLElement | null;
      if (!contenido) continue;
      const alto = contenido.getBoundingClientRect().height;
      /*
       * `rowGap` es 0 y la separación la pone el `marginBottom` de cada item, así que la cuenta es
       * sobre el alto de la fila pelado. Dividir por `FILA_PX + HUECO_PX` —el error que tenía—
       * daba un tercio de las filas necesarias y las fotos altas se desbordaban sobre lo de abajo.
       */
      const filas = Math.ceil((alto + HUECO_PX) / FILA_PX);
      item.style.gridRowEnd = `span ${Math.max(filas, 1)}`;
    }
  }, []);

  useLayoutEffect(() => {
    acomodar();
    const cont = grilla.current;
    if (!cont || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(acomodar);
    observador.observe(cont);
    return () => observador.disconnect();
  }, [acomodar, photos.length]);

  /**
   * Aparición al entrar en pantalla.
   *
   * Se esconden desde acá y no desde el CSS, y antes de pintar (`useLayoutEffect`) para que no
   * haya parpadeo. Quien no tenga JavaScript ve las fotos de una, que es lo que corresponde: la
   * animación adorna la obra, no es condición para verla.
   */
  useLayoutEffect(() => {
    const cont = grilla.current;
    if (!cont) return;

    const menosMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = Array.from(cont.children) as HTMLElement[];

    if (menosMovimiento || typeof IntersectionObserver === "undefined") return;

    for (const i of items) i.dataset.visible = "no";

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          const item = e.target as HTMLElement;
          // Escalonado corto: da sensación de cascada sin que la última tarde una eternidad.
          const posicion = items.indexOf(item) % 3;
          item.style.transitionDelay = `${posicion * 70}ms`;
          item.dataset.visible = "si";
          observador.unobserve(item);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    for (const i of items) observador.observe(i);
    return () => observador.disconnect();
  }, [photos.length]);

  const mover = useCallback(
    (paso: number) => {
      setAbierta((actual) => (actual === null ? actual : (actual + paso + photos.length) % photos.length));
    },
    [photos.length],
  );

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierta !== null && !d.open) d.showModal();
    if (abierta === null && d.open) d.close();
  }, [abierta]);

  useEffect(() => {
    if (abierta === null) return;
    function alTeclado(e: KeyboardEvent) {
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
    }
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [abierta, mover]);

  if (photos.length === 0) return null;

  const foto = abierta === null ? null : photos[abierta];

  return (
    <>
      <style>{`
        /*
          El estado escondido lo pone JavaScript, no el CSS. Si estuviera acá, una foto sin
          JavaScript —o si el efecto no corre— se quedaría invisible para siempre. Sin el atributo,
          la foto se ve: la animación es un agregado, nunca un requisito para ver la obra.
        */
        .fo-pf-item {
          transition: opacity .7s cubic-bezier(.22,.61,.36,1), transform .7s cubic-bezier(.22,.61,.36,1);
        }
        .fo-pf-item[data-visible="no"] { opacity: 0; transform: translateY(18px); }
        .fo-pf-figura img { transition: transform .6s cubic-bezier(.22,.61,.36,1); }
        .fo-pf-figura:hover img,
        .fo-pf-figura:focus-visible img { transform: scale(1.04); }
        .fo-pf-velo {
          opacity: 0;
          transition: opacity .35s ease;
        }
        .fo-pf-figura:hover .fo-pf-velo,
        .fo-pf-figura:focus-visible .fo-pf-velo { opacity: 1; }
        @media (prefers-reduced-motion: reduce) {
          .fo-pf-item { opacity: 1; transform: none; transition: none; }
          .fo-pf-figura img { transition: none; }
          .fo-pf-figura:hover img, .fo-pf-figura:focus-visible img { transform: none; }
          .fo-pf-velo { transition: none; }
        }
      `}</style>

      <ul
        ref={grilla}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        style={{ gridAutoRows: `${FILA_PX}px`, columnGap: HUECO_PX, rowGap: 0 }}
      >
        {photos.map((f, indice) => (
          <li key={f.id} className="fo-pf-item" style={{ marginBottom: HUECO_PX }}>
            <div>
              <button
                type="button"
                onClick={() => setAbierta(indice)}
                aria-label={`Ampliar ${f.title ?? `foto ${indice + 1}`}`}
                className="fo-pf-figura group relative block w-full overflow-hidden rounded-lg"
                style={{ backgroundColor: "color-mix(in srgb, var(--wsite-text) 8%, transparent)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.url}
                  alt={f.altText ?? f.title ?? `Obra de ${authorName}`}
                  width={f.width}
                  height={f.height}
                  loading="lazy"
                  onLoad={acomodar}
                  className="block w-full"
                  style={{ aspectRatio: `${f.width} / ${f.height}`, objectFit: "cover" }}
                />

                <span className="fo-pf-velo pointer-events-none absolute inset-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 via-black/10 to-transparent p-3 text-left">
                  <span className="text-sm text-white/95">
                    {f.title}
                    {f.title && f.year ? " · " : null}
                    {f.year}
                  </span>
                  <Expand size={16} className="shrink-0 text-white/90" aria-hidden />
                </span>
              </button>

              {f.title || f.year ? (
                <p className="mt-2 text-xs opacity-70 sm:hidden">
                  {f.title}
                  {f.title && f.year ? " · " : null}
                  {f.year}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogo}
        onClose={() => setAbierta(null)}
        className="max-h-[100dvh] max-w-[100vw] bg-transparent p-0 backdrop:bg-black/90"
        aria-label="Visor de obra"
      >
        {foto ? (
          <div className="relative flex h-[100dvh] w-[100vw] items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={foto.id}
              src={foto.url}
              alt={foto.altText ?? foto.title ?? `Obra de ${authorName}`}
              width={foto.width}
              height={foto.height}
              className="max-h-full max-w-full object-contain"
            />

            <button
              type="button"
              onClick={() => setAbierta(null)}
              aria-label="Cerrar el visor"
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors hover:bg-white/25"
            >
              <X size={20} aria-hidden />
            </button>

            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => mover(-1)}
                  aria-label="Foto anterior"
                  className="absolute left-4 rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors hover:bg-white/25"
                >
                  <ChevronLeft size={24} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => mover(1)}
                  aria-label="Foto siguiente"
                  className="absolute right-4 rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors hover:bg-white/25"
                >
                  <ChevronRight size={24} aria-hidden />
                </button>
              </>
            ) : null}

            <p className="absolute bottom-4 left-0 right-0 text-center text-sm text-white/80">
              {foto.title}
              {foto.title && foto.year ? " · " : null}
              {foto.year}
              <span className="ml-3 tabular-nums opacity-60">
                {(abierta ?? 0) + 1} / {photos.length}
              </span>
            </p>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
