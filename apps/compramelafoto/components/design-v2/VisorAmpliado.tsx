"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import ConLupa from "./ConLupa";

const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
const PASO = 1.5;
const MARGEN = 24;

function limitar(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/**
 * El librito a pantalla completa para mirarlo en detalle: zoom con botones, con dos dedos o con
 * Ctrl + rueda; se recorre arrastrando (o con las barras), y con la lupa se agranda la zona que
 * se toca. Cada cara se vuelve a dibujar al tamaño pedido, así el texto se ve nítido: sirve para
 * revisar letra por letra un listado largo.
 *
 * `dibujar(pagina, escala)` devuelve la cara dibujada a esa escala.
 */
export default function VisorAmpliado({
  ancho,
  alto,
  paginas,
  paginaInicial = 0,
  etiqueta,
  dibujar,
  onCerrar,
}: {
  ancho: number;
  alto: number;
  paginas: number;
  paginaInicial?: number;
  etiqueta: (pagina: number) => string;
  dibujar: (pagina: number, escala: number) => ReactNode;
  onCerrar: () => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [pagina, setPagina] = useState(paginaInicial);
  const [zoom, setZoom] = useState(1);
  const [lupa, setLupa] = useState(false);
  const [caja, setCaja] = useState({ width: 0, height: 0 });
  /** Qué punto de la cara (0..1) tiene que quedar en el centro después de cambiar el zoom. */
  const centroPendiente = useRef<{ x: number; y: number } | null>(null);
  const dedos = useRef(new Map<number, { x: number; y: number }>());
  const pellizco = useRef<{ distancia: number; zoom: number } | null>(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => setCaja({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escape cierra, flechas cambian de cara; y la página de atrás no se mueve mientras está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowRight") setPagina((p) => Math.min(paginas - 1, p + 1));
      if (e.key === "ArrowLeft") setPagina((p) => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onCerrar, paginas]);

  const ajuste = caja.width > 0 ? Math.min((caja.width - MARGEN * 2) / ancho, (caja.height - MARGEN * 2) / alto) : 0;
  const escala = Math.max(0, ajuste) * zoom;

  const cambiarZoom = useCallback(
    (nuevo: number) => {
      const el = areaRef.current;
      if (el && escala > 0) {
        const anchoVisto = ancho * escala + MARGEN * 2;
        const altoVisto = alto * escala + MARGEN * 2;
        centroPendiente.current = {
          x: (el.scrollLeft + el.clientWidth / 2) / Math.max(anchoVisto, el.clientWidth),
          y: (el.scrollTop + el.clientHeight / 2) / Math.max(altoVisto, el.clientHeight),
        };
      }
      setZoom(limitar(nuevo));
    },
    [ancho, alto, escala],
  );

  // Después de cambiar el zoom, deja en el centro lo que estaba en el centro.
  useLayoutEffect(() => {
    const el = areaRef.current;
    const c = centroPendiente.current;
    if (!el || !c) return;
    centroPendiente.current = null;
    el.scrollLeft = c.x * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = c.y * el.scrollHeight - el.clientHeight / 2;
  }, [zoom]);

  useEffect(() => {
    setZoom(1);
    areaRef.current?.scrollTo({ left: 0, top: 0 });
  }, [pagina]);

  // Ctrl/⌘ + rueda (y el pellizco del trackpad, que llega igual): zoom sin que el navegador agrande todo.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      cambiarZoom(zoom * Math.exp(-e.deltaY / 300));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [cambiarZoom, zoom]);

  function distancia(): number {
    const [a, b] = [...dedos.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  const boton =
    "grid h-11 min-w-11 place-items-center rounded-full bg-white/95 px-3 text-base font-semibold text-[#1f2328] shadow-[0_2px_8px_rgba(0,0,0,.25)] disabled:opacity-40";

  return (
    <div role="dialog" aria-modal="true" aria-label="Ver el librito en grande" className="fixed inset-0 z-[100] flex flex-col bg-[#1f1b17]/95">
      <div className="flex items-center gap-2 px-3 pb-2 pt-[calc(8px+env(safe-area-inset-top,0px))] text-white">
        <p className="m-0 min-w-0 flex-1 truncate text-sm font-semibold">
          {etiqueta(pagina)}
          {paginas > 1 ? <span className="font-normal text-white/70"> · {pagina + 1} de {paginas}</span> : null}
        </p>
        {paginas > 1 ? (
          <>
            <button type="button" className={boton} onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={pagina === 0} aria-label="Cara anterior">
              ‹
            </button>
            <button type="button" className={boton} onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))} disabled={pagina === paginas - 1} aria-label="Cara siguiente">
              ›
            </button>
          </>
        ) : null}
        <button type="button" onClick={onCerrar} className={boton} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <div
        ref={areaRef}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain"
        // El arrastre y el pellizco los maneja el visor: si los maneja el navegador, corta el
        // pellizco a mitad de camino (o agranda la página entera en vez del librito).
        style={{ touchAction: "none", cursor: lupa ? "default" : "grab", userSelect: "none", WebkitUserSelect: "none" }}
        onPointerDown={(e) => {
          if (lupa && e.pointerType !== "touch") return;
          if (lupa && dedos.current.size === 0) {
            // Con la lupa, un dedo es la lupa; con el segundo se vuelve a poder agrandar.
            dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            return;
          }
          dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (dedos.current.size === 2) pellizco.current = { distancia: distancia(), zoom };
        }}
        onPointerMove={(e) => {
          const antes = dedos.current.get(e.pointerId);
          if (!antes) return;
          dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const p = pellizco.current;
          if (p && dedos.current.size === 2 && p.distancia > 0) {
            cambiarZoom(p.zoom * (distancia() / p.distancia));
            return;
          }
          if (!lupa && dedos.current.size === 1) areaRef.current?.scrollBy(antes.x - e.clientX, antes.y - e.clientY);
        }}
        onPointerUp={(e) => {
          dedos.current.delete(e.pointerId);
          if (dedos.current.size < 2) pellizco.current = null;
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") dedos.current.delete(e.pointerId);
        }}
        onPointerCancel={(e) => {
          dedos.current.delete(e.pointerId);
          pellizco.current = null;
        }}
      >
        {escala > 0 ? (
          <div
            className="flex min-h-full min-w-full items-center justify-center"
            style={{ padding: MARGEN, width: "max-content", height: "max-content" }}
          >
            <div className="bg-white shadow-[0_10px_40px_rgba(0,0,0,.5)]">
              <ConLupa
                ancho={ancho}
                alto={alto}
                escala={escala}
                activa={lupa}
                conDedo
                aumento={zoom < 2.5 ? 2.5 : 2}
                diametro={Math.min(260, Math.max(160, caja.width * 0.45))}
                dibujar={(s) => dibujar(pagina, s)}
              >
                {dibujar(pagina, escala)}
              </ConLupa>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 px-3 pb-[calc(10px+env(safe-area-inset-bottom,0px))] pt-2">
        <button type="button" className={boton} onClick={() => cambiarZoom(zoom / PASO)} disabled={zoom <= ZOOM_MIN} aria-label="Alejar">
          −
        </button>
        <button type="button" className={`${boton} min-w-16 text-sm`} onClick={() => cambiarZoom(1)} aria-label="Ver la cara entera">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className={boton} onClick={() => cambiarZoom(zoom * PASO)} disabled={zoom >= ZOOM_MAX} aria-label="Acercar">
          +
        </button>
        <button
          type="button"
          onClick={() => setLupa((v) => !v)}
          aria-pressed={lupa}
          className={`${boton} !flex items-center gap-1.5 text-sm ${lupa ? "!bg-[#c27b3d] !text-white" : ""}`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          Lupa
        </button>
        <p className="m-0 w-full text-center text-xs text-white/70">
          {lupa
            ? "Apoyá el dedo o pasá el mouse por arriba para agrandar esa parte."
            : "Agrandá con + o con dos dedos, y arrastrá para recorrer la hoja."}
        </p>
      </div>
    </div>
  );
}
