"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PAPER_TOKENS, TemplateCanvasRenderer, editorThemeStyle, type PhotoOverride } from "@repo/template-editor-ui";
import type { TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";
import LibritoEscena from "./LibritoEscena";
import { modeloDelLibrito, tamanoTextura } from "./modelo-librito";
import { esperarImagenes, paginaEnBlanco, rasterizarPagina } from "./rasterizar-pagina";

/**
 * "Ver en 3D": el librito armado con las fotos elegidas, para girarlo y abrirlo.
 *
 * Cada página se dibuja con el mismo `TemplateCanvasRenderer` de la vista plana (fuera de la
 * pantalla, a tamaño real), se pasa a un canvas y ese canvas es la textura del modelo. Así lo
 * que se ve en 3D es lo mismo que en la vista plana. Este archivo se carga aparte (`next/dynamic`)
 * para no sumarle three.js a la página.
 */

export type Librito3DVisorProps = {
  titulo: string;
  canvas: TemplateV2Canvas;
  blocks: TemplateV2Block[];
  values: Record<string, string>;
  photoOverrides: Record<string, PhotoOverride>;
  pageCount: number;
  giro: number;
  onClose: () => void;
};

type Estado =
  | { tipo: "cargando" }
  | { tipo: "listo"; paginas: HTMLCanvasElement[]; aviso: string | null };

function hayWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function Librito3DVisor({
  titulo,
  canvas,
  blocks,
  values,
  photoOverrides,
  pageCount,
  giro: giroInicial,
  onClose,
}: Librito3DVisorProps) {
  const canvasW = Number(canvas.width) || 1;
  const canvasH = Number(canvas.height) || 1;
  const paginasTotales = Math.max(1, pageCount);
  const modelo = useMemo(() => modeloDelLibrito(canvasW, canvasH, paginasTotales), [canvasW, canvasH, paginasTotales]);
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  /*
   * Plegado: se recorre como la vista plana, con flechas: tapa, interior (abierto) y
   * contratapa (cerrado y de espaldas). Antes había un solo botón «Abrir el librito» y la
   * contratapa no se podía ver.
   */
  const [paso, setPaso] = useState(0);
  const abierto = paso === 1;
  const [hoja, setHoja] = useState(0);
  const [volteada, setVolteada] = useState(false);
  const [giro, setGiro] = useState(giroInicial);
  const [webgl] = useState(hayWebGL);
  const paginasRef = useRef<Array<HTMLDivElement | null>>([]);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /*
   * El teclado hace lo mismo que en la vista plana: ↑ gira (↓ al revés), ← y → abren y cierran
   * el plegado o pasan de hoja, y Escape cierra. Mientras el visor está abierto la página de
   * atrás no escucha las flechas ni se mueve.
   */
  const teclasRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    teclasRef.current = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowUp") setGiro((g) => g + 90);
      else if (e.key === "ArrowDown") setGiro((g) => g - 90);
      else if (e.key === "ArrowRight") {
        if (modelo.tipo === "plegado") setPaso((p) => Math.min(2, p + 1));
        else {
          setHoja((h) => Math.min(hojas - 1, h + 1));
          setVolteada(false);
        }
      } else if (e.key === "ArrowLeft") {
        if (modelo.tipo === "plegado") setPaso((p) => Math.max(0, p - 1));
        else {
          setHoja((h) => Math.max(0, h - 1));
          setVolteada(false);
        }
      } else return;
      e.preventDefault();
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      teclasRef.current(e);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cerrarRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  // Dibuja las páginas una vez montadas fuera de la pantalla.
  useEffect(() => {
    let cancelado = false;
    const { w, h } = tamanoTextura(canvasW, canvasH);
    (async () => {
      const paginas: HTMLCanvasElement[] = [];
      let fallidas = 0;
      let simplificada = false;
      let enBlanco = 0;
      for (let i = 0; i < paginasTotales; i++) {
        const el = paginasRef.current[i];
        if (cancelado) return;
        if (!el) {
          paginas.push(paginaEnBlanco(w, h));
          enBlanco++;
          continue;
        }
        try {
          await esperarImagenes(el);
          const r = await rasterizarPagina(el, canvasW, canvasH, w, h);
          paginas.push(r.canvas);
          fallidas += r.imagenesFallidas;
          simplificada ||= r.simplificada;
        } catch {
          paginas.push(paginaEnBlanco(w, h));
          enBlanco++;
        }
      }
      if (cancelado) return;
      const aviso =
        enBlanco > 0
          ? "Este navegador no nos dejó dibujar el diseño en 3D. Te mostramos la forma del librito; el diseño lo ves en la vista plana."
          : simplificada
            ? "Vista simplificada: en este navegador el 3D muestra las fotos pero no los textos. Lo impreso sale como en la vista plana."
            : fallidas > 0
              ? "Algunas imágenes no se pudieron cargar en el 3D. Lo impreso sale como en la vista plana."
              : null;
      setEstado({ tipo: "listo", paginas, aviso });
    })();
    return () => {
      cancelado = true;
    };
    // Se dibuja una vez por apertura: el visor se cierra para volver a cambiar fotos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const esPlegado = modelo.tipo === "plegado";
  const hojas = modelo.tipo === "hojas" ? modelo.hojas.length : 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${titulo} en 3D`}
      className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#f7f3ee] sm:h-[min(720px,100%)] sm:max-w-3xl sm:rounded-2xl sm:shadow-2xl">
        <div className="flex items-center gap-3 px-4 pb-2 pt-[calc(12px+env(safe-area-inset-top,0px))]">
          <div className="min-w-0">
            <h2 className="m-0 truncate text-lg font-semibold text-[#1f2328]">{titulo} en 3D</h2>
            <p className="m-0 text-[13px] text-[#6b6f76]">Arrastrá para girarlo · pellizcá o usá la rueda para acercar</p>
          </div>
          <button
            ref={cerrarRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar la vista 3D"
            className="ml-auto grid h-10 w-10 flex-none place-items-center rounded-full bg-white text-[#1f2328] shadow-[0_2px_8px_rgba(0,0,0,.12)]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          {!webgl ? (
            <div className="grid h-full place-items-center px-6 text-center text-[15px] text-[#4b4f56]">
              Este navegador no puede mostrar el 3D. Podés ver todas las páginas en la vista plana.
            </div>
          ) : estado.tipo === "cargando" ? (
            <div className="grid h-full place-items-center" role="status" aria-live="polite">
              <div className="flex flex-col items-center gap-3 text-[14px] text-[#6b6f76]">
                <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e7e1da] border-t-[#c27b3d]" aria-hidden />
                Armando tu librito…
              </div>
            </div>
          ) : (
            <LibritoEscena
              modelo={modelo}
              paginas={estado.paginas}
              abierto={abierto}
              deEspaldas={paso === 2}
              hoja={hoja}
              volteada={volteada}
              giro={giro}
            />
          )}
          {estado.tipo === "listo" && estado.aviso ? (
            <p className="absolute inset-x-3 top-1 m-0 rounded-lg bg-[#fff6e5] px-3 py-2 text-[13px] text-[#7a5418] shadow-sm">
              {estado.aviso}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 px-4 pb-[calc(14px+env(safe-area-inset-bottom,0px))] pt-2">
          {esPlegado ? (
            <>
              <button
                type="button"
                onClick={() => setPaso((p) => Math.max(0, p - 1))}
                disabled={paso === 0 || estado.tipo !== "listo"}
                aria-label="Página anterior"
                className="grid h-11 w-11 place-items-center rounded-full bg-white text-xl text-[#1f2328] shadow-[0_2px_8px_rgba(0,0,0,.12)] ring-1 ring-[#e7e1da] disabled:opacity-40"
              >
                ‹
              </button>
              <span className="min-w-[110px] text-center text-[15px] font-semibold text-[#1f2328]" aria-live="polite">
                {["Tapa", "Interior", "Contratapa"][paso]}
              </span>
              <button
                type="button"
                onClick={() => setPaso((p) => Math.min(2, p + 1))}
                disabled={paso === 2 || estado.tipo !== "listo"}
                aria-label="Página siguiente"
                className="grid h-11 w-11 place-items-center rounded-full bg-white text-xl text-[#1f2328] shadow-[0_2px_8px_rgba(0,0,0,.12)] ring-1 ring-[#e7e1da] disabled:opacity-40"
              >
                ›
              </button>
            </>
          ) : (
            <>
              {hojas > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setHoja((h) => Math.max(0, h - 1));
                    setVolteada(false);
                  }}
                  disabled={hoja === 0}
                  aria-label="Hoja anterior"
                  className="grid h-11 w-11 place-items-center rounded-full bg-white text-xl text-[#1f2328] ring-1 ring-[#e7e1da] disabled:opacity-40"
                >
                  ‹
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setVolteada((v) => !v)}
                disabled={estado.tipo !== "listo"}
                className="min-h-11 rounded-full bg-[#1f2328] px-5 text-[15px] font-semibold text-white disabled:opacity-40"
              >
                {volteada ? "Ver el frente" : "Dar vuelta"}
              </button>
              {hojas > 1 ? (
                <>
                  <span className="text-[13px] font-semibold text-[#6b6f76]">
                    Hoja {hoja + 1} de {hojas}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setHoja((h) => Math.min(hojas - 1, h + 1));
                      setVolteada(false);
                    }}
                    disabled={hoja === hojas - 1}
                    aria-label="Hoja siguiente"
                    className="grid h-11 w-11 place-items-center rounded-full bg-white text-xl text-[#1f2328] ring-1 ring-[#e7e1da] disabled:opacity-40"
                  >
                    ›
                  </button>
                </>
              ) : null}
            </>
          )}
          <button
            type="button"
            onClick={() => setGiro((g) => g + 90)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-semibold text-[#1f2328] ring-1 ring-[#e7e1da]"
            aria-label="Girar el librito 90 grados"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 12a8 8 0 1 1-2.34-5.66" />
              <path d="M20 4v5h-5" />
            </svg>
            Girar
          </button>
        </div>
      </div>

      {/* Las páginas a tamaño real, fuera de la pantalla: de acá salen las texturas. */}
      <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none" }}>
        {Array.from({ length: paginasTotales }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              paginasRef.current[i] = el;
            }}
            style={{
              ...editorThemeStyle(),
              ...PAPER_TOKENS,
              position: "relative",
              width: canvasW,
              height: canvasH,
              overflow: "hidden",
              background: "#ffffff",
            }}
          >
            <TemplateCanvasRenderer
              canvas={canvas}
              blocks={blocks}
              resolvedVariables={values}
              readOnly
              pageIndex={i}
              photoOverrides={photoOverrides}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
