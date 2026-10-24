"use client";

/**
 * Cuadro guía de las demos grabables. Aparece solo si hay una demo activa (marca `dnx_demo_activa`
 * y confirmación del servidor). Va abajo a la izquierda: la esquina inferior derecha queda libre
 * para la cámara del presentador en la videollamada.
 *
 * Atajos: Avance de página / Retroceso de página (los presentadores inalámbricos mandan esas
 * teclas) o Alt + flechas. Las flechas solas quedan para las pantallas (visor 3D, galería).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { GUION_ESCOLAR } from "@/lib/demos/guiones/escolar";
import type { CtxGuion, PasoGuion } from "@/lib/demos/guiones/tipos";
import { debeMostrarAclaracion, indiceValido, pasoAnterior, siguientePaso } from "@/lib/demos/guiones/navegacion";
import { VISTAS_DEMO, type VistaDemo } from "@/lib/demos/vistas";

const CLAVE_PASO = "dnx-demo-escolar-paso";
const CLAVE_VISTAS = "dnx-demo-escolar-aclaraciones";
const CLAVE_MINI = "dnx-demo-escolar-minimizado";

type Estado = {
  activa: boolean;
  ctx: CtxGuion | null;
  sesion: "fotografo" | "colegio" | null;
};

function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}
function guardar(clave: string, valor: string) {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {}
}

function hayMarcaDeDemo(): boolean {
  return typeof document !== "undefined" && document.cookie.split("; ").some((c) => c === "dnx_demo_activa=1");
}

export default function CuadroGuia() {
  const pathname = usePathname();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [indice, setIndice] = useState(0);
  const [aclaracion, setAclaracion] = useState<PasoGuion | null>(null);
  const [minimizado, setMinimizado] = useState(false);
  const [indiceAbierto, setIndiceAbierto] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const vistasRef = useRef<Set<string>>(new Set());
  const pasos = GUION_ESCOLAR.pasos;

  useEffect(() => {
    if (!hayMarcaDeDemo()) {
      setEstado(null);
      return;
    }
    let cancelado = false;
    fetch("/api/demo/estado", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Estado) => {
        if (!cancelado) setEstado(d.activa ? d : null);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [pathname]);

  useEffect(() => {
    setIndice(indiceValido(leer(CLAVE_PASO), pasos.length));
    setMinimizado(leer(CLAVE_MINI) === "1");
    try {
      vistasRef.current = new Set(JSON.parse(leer(CLAVE_VISTAS) || "[]"));
    } catch {}
  }, [pasos.length]);

  const activa = Boolean(estado?.activa);
  useEffect(() => {
    if (!activa) return;
    document.body.dataset.demo = "1";
    return () => {
      delete document.body.dataset.demo;
    };
  }, [activa]);

  const paso = pasos[indice];
  const ctx = estado?.ctx ?? null;
  const rutaDelPaso = useMemo(() => (paso?.ruta && ctx ? paso.ruta(ctx) : null), [paso, ctx]);

  const cambiarVista = useCallback(
    async (vista: VistaDemo | "salir", destino?: string | null) => {
      setTrabajando(true);
      try {
        const res = await fetch("/api/demo/vista", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vista }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "No se pudo cambiar de vista");
        try {
          window.sessionStorage.clear();
        } catch {}
        window.location.href = destino || data.destino || "/";
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "No se pudo cambiar de vista");
        setTrabajando(false);
      }
    },
    [],
  );

  /** Lleva a la pantalla del paso, cambiando de sesión si el paso es del colegio (o viceversa). */
  const irAlPaso = useCallback(
    (p: PasoGuion) => {
      if (!ctx || !p.ruta) return;
      const ruta = p.ruta(ctx);
      const sesionNecesaria = p.vista === "colegio" ? "colegio" : "fotografo";
      if (estado?.sesion !== sesionNecesaria) {
        void cambiarVista(p.vista, ruta);
        return;
      }
      if (ruta !== `${window.location.pathname}${window.location.search}`) window.location.href = ruta;
    },
    [ctx, estado?.sesion, cambiarVista],
  );

  const moverA = useCallback(
    (nuevo: number, direccion: "adelante" | "atras" | "salto") => {
      const destino = pasos[nuevo];
      if (!destino) return;
      setIndice(nuevo);
      guardar(CLAVE_PASO, String(nuevo));
      setIndiceAbierto(false);
      if (debeMostrarAclaracion(destino, vistasRef.current, direccion)) {
        vistasRef.current.add(destino.id);
        guardar(CLAVE_VISTAS, JSON.stringify([...vistasRef.current]));
        setAclaracion(destino);
        return;
      }
      irAlPaso(destino);
    },
    [pasos, irAlPaso],
  );

  const cerrarAclaracion = useCallback(() => {
    const p = aclaracion;
    setAclaracion(null);
    if (p) irAlPaso(p);
  }, [aclaracion, irAlPaso]);

  useEffect(() => {
    if (!activa) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      const adelante = e.key === "PageDown" || (e.altKey && e.key === "ArrowRight");
      const atras = e.key === "PageUp" || (e.altKey && e.key === "ArrowLeft");
      if (aclaracion && (adelante || e.key === "Escape" || e.key === "Enter")) {
        e.preventDefault();
        cerrarAclaracion();
        return;
      }
      if (adelante) {
        e.preventDefault();
        moverA(siguientePaso(indice, pasos.length), "adelante");
      } else if (atras) {
        e.preventDefault();
        moverA(pasoAnterior(indice), "atras");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activa, aclaracion, cerrarAclaracion, indice, moverA, pasos.length]);

  if (!activa || !paso) return null;

  const enPantallaDelPaso =
    rutaDelPaso != null && typeof window !== "undefined" && rutaDelPaso.split("?")[0] === pathname;

  return (
    <>
      {aclaracion?.aclaracion ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-6"
          onClick={cerrarAclaracion}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-w-2xl rounded-2xl bg-white p-10 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-[#c27b3d]">Para tener en cuenta</p>
            <h2 className="mt-3 text-3xl font-bold text-gray-900">{aclaracion.aclaracion.titulo}</h2>
            <p className="mt-4 text-xl leading-relaxed text-gray-700">{aclaracion.aclaracion.texto}</p>
            <button
              type="button"
              onClick={cerrarAclaracion}
              className="mt-8 rounded-full bg-[#c27b3d] px-6 py-3 text-base font-semibold text-white hover:bg-[#a0652d]"
            >
              Seguir
            </button>
          </div>
        </div>
      ) : null}

      <div
        className="fixed bottom-4 left-4 z-[9995] w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-[#c27b3d]/40 bg-white/95 text-gray-900 shadow-2xl backdrop-blur"
        role="region"
        aria-label="Guía de la demo"
      >
        <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-[#c27b3d] px-3 py-1.5 text-white">
          <span className="text-xs font-semibold uppercase tracking-wide">
            Demo · paso {indice + 1} de {pasos.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded px-1.5 text-xs hover:bg-white/20"
              onClick={() => setIndiceAbierto((v) => !v)}
              aria-expanded={indiceAbierto}
            >
              Índice
            </button>
            <button
              type="button"
              className="rounded px-1.5 text-sm hover:bg-white/20"
              onClick={() => {
                setMinimizado((v) => !v);
                guardar(CLAVE_MINI, minimizado ? "0" : "1");
              }}
              aria-label={minimizado ? "Abrir la guía" : "Minimizar la guía"}
            >
              {minimizado ? "▴" : "▾"}
            </button>
          </div>
        </div>

        {indiceAbierto ? (
          <ol className="max-h-72 overflow-auto px-2 py-2 text-sm">
            {pasos.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => moverA(i, "salto")}
                  className={`w-full rounded px-2 py-1 text-left hover:bg-amber-50 ${i === indice ? "font-semibold text-[#c27b3d]" : ""}`}
                >
                  {p.titulo}
                </button>
              </li>
            ))}
          </ol>
        ) : null}

        {!minimizado && !indiceAbierto ? (
          <div className="px-4 pb-3 pt-2">
            <h3 className="text-base font-bold leading-snug">{paso.titulo}</h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-700">{paso.texto}</p>
            {paso.bot ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                <strong>Con el bot:</strong> {paso.bot}
              </p>
            ) : null}
            {!ctx ? (
              <p className="mt-2 text-xs text-red-700">La demo no está preparada: tocá «Preparar» en Admin → Demos.</p>
            ) : null}
            {rutaDelPaso && !enPantallaDelPaso ? (
              <button
                type="button"
                onClick={() => irAlPaso(paso)}
                disabled={trabajando}
                className="mt-2 text-xs font-semibold text-[#c27b3d] underline"
              >
                Ir a la pantalla de este paso
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
          <button
            type="button"
            onClick={() => moverA(pasoAnterior(indice), "atras")}
            disabled={indice === 0 || trabajando}
            className="rounded-full border border-gray-300 px-3 py-1 text-sm disabled:opacity-40"
          >
            ‹ Anterior
          </button>
          <div className="flex gap-1" role="group" aria-label="Vista">
            {VISTAS_DEMO.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={trabajando}
                onClick={() => void cambiarVista(v.id)}
                className={`rounded-full px-2 py-1 text-xs ${paso.vista === v.id ? "bg-[#c27b3d] text-white" : "bg-gray-100 text-gray-700"}`}
                title={`Cambiar a la vista ${v.etiqueta.toLowerCase()}`}
              >
                {v.etiqueta}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => moverA(siguientePaso(indice, pasos.length), "adelante")}
            disabled={indice >= pasos.length - 1 || trabajando}
            className="rounded-full bg-[#c27b3d] px-3 py-1 text-sm font-semibold text-white disabled:opacity-40"
          >
            Siguiente ›
          </button>
        </div>
        <div className="flex justify-between px-3 pb-2 text-[11px] text-gray-500">
          <button type="button" onClick={() => moverA(0, "salto")} className="underline">
            Volver al inicio
          </button>
          <button type="button" onClick={() => void cambiarVista("salir")} className="underline">
            Salir de la demo
          </button>
        </div>
      </div>
    </>
  );
}
