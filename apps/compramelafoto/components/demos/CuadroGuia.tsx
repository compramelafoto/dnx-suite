"use client";

/**
 * Cuadro guía de las demos grabables. Aparece solo si hay una demo activa (marca `dnx_demo_activa`
 * y confirmación del servidor).
 *
 * Dos formas de usarlo:
 * - **En la pantalla compartida**: un cuadro abajo a la izquierda (la esquina inferior derecha queda
 *   libre para la cámara del presentador en la videollamada).
 * - **En otra ventana** (`/demo/guia`), para leerlo en una segunda pantalla. Mientras esa ventana
 *   está abierta, el cuadro desaparece de la pantalla compartida y la ventana aparte la maneja:
 *   el paso, las tarjetas para el público y la navegación. Las tarjetas siguen saliendo en la
 *   pantalla compartida, que es la que ve el público.
 *
 * El estado vive en `localStorage` (lo leen las dos ventanas) y las órdenes («andá a este paso»,
 * «cambiá de vista») viajan por un BroadcastChannel hacia la pantalla compartida, que es la única
 * que navega.
 *
 * Atajos: Avance de página / Retroceso de página (los presentadores inalámbricos mandan esas
 * teclas) o Alt + flechas. Funcionan en las dos ventanas. Las flechas solas quedan para las
 * pantallas (visor 3D, galería).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { GUION_ESCOLAR } from "@/lib/demos/guiones/escolar";
import type { CtxGuion, PasoGuion } from "@/lib/demos/guiones/tipos";
import {
  LATIDO_VENTANA_APARTE_MS,
  accionDeTecla,
  debeMostrarAclaracion,
  indiceValido,
  pasoAnterior,
  siguientePaso,
  ventanaAparteViva,
} from "@/lib/demos/guiones/navegacion";
import { VISTAS_DEMO, type VistaDemo } from "@/lib/demos/vistas";

const CLAVE_PASO = "dnx-demo-escolar-paso";
const CLAVE_VISTAS = "dnx-demo-escolar-aclaraciones";
const CLAVE_MINI = "dnx-demo-escolar-minimizado";
/** Id del paso cuya tarjeta para el público está abierta ("" si ninguna). */
const CLAVE_ACLARACION = "dnx-demo-escolar-aclaracion-abierta";
/** Último latido de la ventana aparte (milisegundos). */
const CLAVE_LATIDO = "dnx-demo-guia-latido";
const CANAL = "dnx-demo-guia";
export const RUTA_VENTANA_APARTE = "/demo/guia";

type Estado = {
  activa: boolean;
  ctx: CtxGuion | null;
  sesion: "fotografo" | "colegio" | null;
};

type Orden =
  | { tipo: "ir"; indice: number }
  | { tipo: "vista"; vista: VistaDemo | "salir" }
  | { tipo: "recargar" };

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
function leerVistas(): Set<string> {
  try {
    return new Set(JSON.parse(leer(CLAVE_VISTAS) || "[]"));
  } catch {
    return new Set();
  }
}

function hayMarcaDeDemo(): boolean {
  return typeof document !== "undefined" && document.cookie.split("; ").some((c) => c === "dnx_demo_activa=1");
}

function abrirCanal(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CANAL);
  } catch {
    return null;
  }
}

export default function CuadroGuia() {
  const pathname = usePathname();
  const esVentanaAparte = pathname === RUTA_VENTANA_APARTE;
  const [estado, setEstado] = useState<Estado | null>(null);
  const [indice, setIndice] = useState(0);
  const [aclaracionId, setAclaracionId] = useState("");
  const [ventanaAparte, setVentanaAparte] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [indiceAbierto, setIndiceAbierto] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [avisoAccion, setAvisoAccion] = useState<string | null>(null);
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

  // Estado compartido: se lee al montar y cada vez que la otra ventana lo cambia.
  useEffect(() => {
    const sincronizar = () => {
      setIndice(indiceValido(leer(CLAVE_PASO), pasos.length));
      setAclaracionId(leer(CLAVE_ACLARACION) || "");
      setMinimizado(leer(CLAVE_MINI) === "1");
    };
    sincronizar();
    // Primera vez en la demo: la tarjeta de apertura para el público.
    if (!esVentanaAparte && leer(CLAVE_PASO) == null && pasos[0]?.aclaracion && !leerVistas().has(pasos[0].id)) {
      guardar(CLAVE_VISTAS, JSON.stringify([...leerVistas(), pasos[0].id]));
      guardar(CLAVE_ACLARACION, pasos[0].id);
      guardar(CLAVE_PASO, "0");
      setAclaracionId(pasos[0].id);
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === CLAVE_PASO || e.key === CLAVE_ACLARACION || e.key === CLAVE_MINI) sincronizar();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [pasos, esVentanaAparte]);

  const activa = Boolean(estado?.activa);

  // La ventana aparte late; la pantalla compartida esconde su cuadro mientras la ventana viva.
  useEffect(() => {
    if (!activa) return;
    if (esVentanaAparte) {
      const latir = () => guardar(CLAVE_LATIDO, String(Date.now()));
      latir();
      const t = window.setInterval(latir, LATIDO_VENTANA_APARTE_MS);
      const alCerrar = () => guardar(CLAVE_LATIDO, "0");
      window.addEventListener("beforeunload", alCerrar);
      return () => {
        window.clearInterval(t);
        window.removeEventListener("beforeunload", alCerrar);
        alCerrar();
      };
    }
    const mirar = () => setVentanaAparte(ventanaAparteViva(Number(leer(CLAVE_LATIDO)) || null, Date.now()));
    mirar();
    const t = window.setInterval(mirar, 1000);
    return () => window.clearInterval(t);
  }, [activa, esVentanaAparte]);

  useEffect(() => {
    if (!activa || esVentanaAparte) return;
    document.body.dataset.demo = "1";
    return () => {
      delete document.body.dataset.demo;
    };
  }, [activa, esVentanaAparte]);

  const paso = pasos[indice];
  const ctx = estado?.ctx ?? null;
  const rutaDelPaso = useMemo(() => (paso?.ruta && ctx ? paso.ruta(ctx) : null), [paso, ctx]);
  const aclaracion = aclaracionId ? (pasos.find((p) => p.id === aclaracionId) ?? null) : null;

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

  // Órdenes de la ventana aparte: solo la pantalla compartida navega.
  useEffect(() => {
    if (!activa || esVentanaAparte) return;
    const canal = abrirCanal();
    if (!canal) return;
    canal.onmessage = (e: MessageEvent<Orden>) => {
      const orden = e.data;
      if (orden?.tipo === "ir" && pasos[orden.indice]) irAlPaso(pasos[orden.indice]);
      else if (orden?.tipo === "vista") void cambiarVista(orden.vista);
      else if (orden?.tipo === "recargar") window.location.reload();
    };
    return () => canal.close();
  }, [activa, esVentanaAparte, pasos, irAlPaso, cambiarVista]);

  /** Desde la ventana aparte se pide a la pantalla compartida; desde la compartida se hace acá. */
  const ordenar = useCallback(
    (orden: Orden) => {
      if (!esVentanaAparte) {
        if (orden.tipo === "ir" && pasos[orden.indice]) irAlPaso(pasos[orden.indice]);
        else if (orden.tipo === "vista") void cambiarVista(orden.vista);
        else if (orden.tipo === "recargar") window.location.reload();
        return;
      }
      const canal = abrirCanal();
      canal?.postMessage(orden);
      canal?.close();
      if (orden.tipo === "vista" && orden.vista === "salir") window.setTimeout(() => window.close(), 300);
    },
    [esVentanaAparte, pasos, irAlPaso, cambiarVista],
  );

  const moverA = useCallback(
    (nuevo: number, direccion: "adelante" | "atras" | "salto") => {
      const destino = pasos[nuevo];
      if (!destino) return;
      setIndice(nuevo);
      guardar(CLAVE_PASO, String(nuevo));
      setIndiceAbierto(false);
      const vistas = leerVistas();
      if (debeMostrarAclaracion(destino, vistas, direccion)) {
        guardar(CLAVE_VISTAS, JSON.stringify([...vistas, destino.id]));
        guardar(CLAVE_ACLARACION, destino.id);
        setAclaracionId(destino.id);
        return;
      }
      guardar(CLAVE_ACLARACION, "");
      setAclaracionId("");
      ordenar({ tipo: "ir", indice: nuevo });
    },
    [pasos, ordenar],
  );

  const cerrarAclaracion = useCallback(() => {
    const p = aclaracion;
    guardar(CLAVE_ACLARACION, "");
    setAclaracionId("");
    if (p) ordenar({ tipo: "ir", indice: pasos.indexOf(p) });
  }, [aclaracion, ordenar, pasos]);

  const volverAlInicio = useCallback(() => {
    // Una pasada nueva: vuelven a salir todas las tarjetas para el público.
    guardar(CLAVE_VISTAS, "[]");
    moverA(0, "adelante");
  }, [moverA]);

  useEffect(() => {
    if (!activa) return;
    // Con la ventana aparte abierta, la pantalla compartida igual atiende las teclas del
    // presentador inalámbrico (suele tener el foco). La extensión de atajos globales manda estas
    // mismas teclas. Se escucha en captura para que ninguna pantalla (el diseñador) se las coma.
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const enCampo = Boolean(t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)));
      const accion = accionDeTecla(e, enCampo);
      if (!accion) return;
      if (aclaracion && accion !== "atras") {
        e.preventDefault();
        e.stopPropagation();
        cerrarAclaracion();
        return;
      }
      if (accion === "cerrar") return;
      e.preventDefault();
      e.stopPropagation();
      if (accion === "adelante") moverA(siguientePaso(indice, pasos.length), "adelante");
      else moverA(pasoAnterior(indice), "atras");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [activa, aclaracion, cerrarAclaracion, indice, moverA, pasos.length]);

  const ejecutarAccion = useCallback(
    async (p: PasoGuion) => {
      if (!p.accion) return;
      setTrabajando(true);
      setAvisoAccion("Trabajando…");
      try {
        const res = await fetch(p.accion.endpoint, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "No se pudo completar.");
        setAvisoAccion(p.accion.hecho);
        window.setTimeout(() => ordenar({ tipo: "recargar" }), 1200);
      } catch (err) {
        setAvisoAccion(err instanceof Error ? err.message : "No se pudo completar.");
      } finally {
        setTrabajando(false);
      }
    },
    [ordenar],
  );

  const abrirVentanaAparte = useCallback(() => {
    const w = window.open(RUTA_VENTANA_APARTE, "dnx-demo-guia", "popup,width=560,height=820");
    if (!w) window.alert("El navegador bloqueó la ventana. Permití las ventanas emergentes para este sitio.");
  }, []);

  if (esVentanaAparte) {
    return (
      <VentanaAparte
        activa={activa}
        pasos={pasos}
        indice={indice}
        paso={paso}
        aclaracion={aclaracion}
        trabajando={trabajando}
        avisoAccion={avisoAccion}
        hayCtx={Boolean(ctx)}
        rutaDelPaso={rutaDelPaso}
        moverA={moverA}
        cerrarAclaracion={cerrarAclaracion}
        volverAlInicio={volverAlInicio}
        ordenar={ordenar}
        ejecutarAccion={ejecutarAccion}
      />
    );
  }

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

      {ventanaAparte ? null : (
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
                onClick={abrirVentanaAparte}
                title="Abrir la guía en otra ventana para leerla en una segunda pantalla"
              >
                Otra ventana ↗
              </button>
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
            <ListaDePasos pasos={pasos} indice={indice} onElegir={(i) => moverA(i, "salto")} className="max-h-72 px-2 py-2 text-sm" />
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
              {paso.accion ? (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void ejecutarAccion(paso)}
                    disabled={trabajando}
                    className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {paso.accion.etiqueta}
                  </button>
                  {avisoAccion ? <span className="text-xs text-gray-600">{avisoAccion}</span> : null}
                </div>
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
              className="whitespace-nowrap rounded-full border border-gray-300 px-3 py-1 text-sm disabled:opacity-40"
            >
              ‹ Anterior
            </button>
            <BotonesDeVista vistaDelPaso={paso.vista} trabajando={trabajando} onCambiar={(v) => void cambiarVista(v)} />
            <button
              type="button"
              onClick={() => moverA(siguientePaso(indice, pasos.length), "adelante")}
              disabled={indice >= pasos.length - 1 || trabajando}
              className="whitespace-nowrap rounded-full bg-[#c27b3d] px-3 py-1 text-sm font-semibold text-white disabled:opacity-40"
            >
              Siguiente ›
            </button>
          </div>
          <div className="flex justify-between px-3 pb-2 text-[11px] text-gray-500">
            <button type="button" onClick={volverAlInicio} className="underline">
              Volver al inicio
            </button>
            <button type="button" onClick={() => void cambiarVista("salir")} className="underline">
              Salir de la demo
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ListaDePasos({
  pasos,
  indice,
  onElegir,
  className,
}: {
  pasos: PasoGuion[];
  indice: number;
  onElegir: (i: number) => void;
  className?: string;
}) {
  return (
    <ol className={`overflow-auto ${className ?? ""}`}>
      {pasos.map((p, i) => (
        <li key={p.id}>
          {p.etapa !== pasos[i - 1]?.etapa ? (
            <p className="mt-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 first:mt-0">{p.etapa}</p>
          ) : null}
          <button
            type="button"
            onClick={() => onElegir(i)}
            className={`w-full rounded px-2 py-1 text-left hover:bg-amber-50 ${i === indice ? "bg-amber-50 font-semibold text-[#c27b3d]" : ""}`}
          >
            {i + 1}. {p.titulo}
          </button>
        </li>
      ))}
    </ol>
  );
}

function BotonesDeVista({
  vistaDelPaso,
  trabajando,
  onCambiar,
  grande = false,
}: {
  vistaDelPaso: VistaDemo;
  trabajando: boolean;
  onCambiar: (v: VistaDemo) => void;
  grande?: boolean;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Vista">
      {VISTAS_DEMO.map((v) => (
        <button
          key={v.id}
          type="button"
          disabled={trabajando}
          onClick={() => onCambiar(v.id)}
          className={`whitespace-nowrap rounded-full ${grande ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-xs"} ${vistaDelPaso === v.id ? "bg-[#c27b3d] text-white" : "bg-gray-100 text-gray-700"}`}
          title={`Cambiar a la vista ${v.etiqueta.toLowerCase()}`}
        >
          {v.etiqueta}
        </button>
      ))}
    </div>
  );
}

/** La guía en su propia ventana: letra grande para leer en la segunda pantalla. */
function VentanaAparte(props: {
  activa: boolean;
  pasos: PasoGuion[];
  indice: number;
  paso: PasoGuion | undefined;
  aclaracion: PasoGuion | null;
  trabajando: boolean;
  avisoAccion: string | null;
  hayCtx: boolean;
  rutaDelPaso: string | null;
  moverA: (i: number, d: "adelante" | "atras" | "salto") => void;
  cerrarAclaracion: () => void;
  volverAlInicio: () => void;
  ordenar: (o: Orden) => void;
  ejecutarAccion: (p: PasoGuion) => Promise<void>;
}) {
  const { activa, pasos, indice, paso, aclaracion } = props;

  useEffect(() => {
    document.title = paso ? `Guía · ${indice + 1}/${pasos.length} · ${paso.titulo}` : "Guía de la demo";
  }, [paso, indice, pasos.length]);

  return (
    <div className="fixed inset-0 z-[10001] flex flex-col bg-white text-gray-900">
      {!activa || !paso ? (
        <div className="m-auto max-w-md p-8 text-center">
          <h1 className="text-xl font-bold">Guía de la demo</h1>
          <p className="mt-2 text-gray-600">
            No hay una demo activa. Entrá desde Admin → Demos para charlas → «Entrar a la demo» y volvé a abrir esta
            ventana.
          </p>
        </div>
      ) : (
        <>
          <header className="flex items-center justify-between gap-3 bg-[#c27b3d] px-5 py-3 text-white">
            <span className="text-sm font-semibold uppercase tracking-wide">
              Paso {indice + 1} de {pasos.length}
            </span>
            <span className="text-xs opacity-90">Tus teclas del presentador funcionan en las dos ventanas</span>
          </header>

          <div className="flex min-h-0 flex-1">
            <main className="min-h-0 flex-1 overflow-auto px-6 py-5">
              {aclaracion?.aclaracion ? (
                <div className="mb-5 rounded-xl border-2 border-[#c27b3d] bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#c27b3d]">
                    En la pantalla compartida: tarjeta para el público
                  </p>
                  <p className="mt-1 text-lg font-bold">{aclaracion.aclaracion.titulo}</p>
                  <p className="mt-1 text-base text-gray-700">{aclaracion.aclaracion.texto}</p>
                  <button
                    type="button"
                    onClick={props.cerrarAclaracion}
                    className="mt-3 rounded-full bg-[#c27b3d] px-5 py-2 text-base font-semibold text-white"
                  >
                    Seguir ›
                  </button>
                </div>
              ) : null}

              <p className="text-sm font-semibold uppercase tracking-widest text-[#c27b3d]">{paso.etapa}</p>
              <h1 className="mt-1 text-3xl font-bold leading-tight">{paso.titulo}</h1>
              <p className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-lg leading-relaxed text-gray-700">
                <strong className="text-gray-900">En pantalla:</strong> {paso.texto}
              </p>
              {paso.puntos?.length ? (
                <>
                  <h2 className="mt-5 text-sm font-semibold uppercase tracking-widest text-gray-500">Para contar</h2>
                  <ol className="mt-2 space-y-2">
                    {paso.puntos.map((punto, i) => (
                      <li key={i} className="flex gap-3 text-xl leading-snug text-gray-900">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c27b3d] text-sm font-bold text-white">
                          {i + 1}
                        </span>
                        <span>{punto}</span>
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}
              {paso.bot ? (
                <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-base text-amber-900">
                  <strong>Con el bot:</strong> {paso.bot}
                </p>
              ) : null}
              {paso.accion ? (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void props.ejecutarAccion(paso)}
                    disabled={props.trabajando}
                    className="rounded-full bg-gray-900 px-4 py-2 text-base font-semibold text-white disabled:opacity-50"
                  >
                    {paso.accion.etiqueta}
                  </button>
                  {props.avisoAccion ? <span className="text-sm text-gray-600">{props.avisoAccion}</span> : null}
                </div>
              ) : null}
              {!props.hayCtx ? (
                <p className="mt-4 text-sm text-red-700">La demo no está preparada: tocá «Preparar» en Admin → Demos.</p>
              ) : null}
              {props.rutaDelPaso ? (
                <button
                  type="button"
                  onClick={() => props.ordenar({ tipo: "ir", indice })}
                  className="mt-4 text-sm font-semibold text-[#c27b3d] underline"
                >
                  Llevar la pantalla compartida a este paso
                </button>
              ) : null}
              {pasos[indice + 1] ? (
                <div className="mt-8 border-t border-gray-200 pt-4 text-base text-gray-600">
                  {paso.puente ? (
                    <p>
                      <strong className="text-gray-900">Para pasar al siguiente:</strong> {paso.puente}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-gray-500">
                    <strong>Después:</strong> {pasos[indice + 1].etapa !== paso.etapa ? `${pasos[indice + 1].etapa} — ` : ""}
                    {pasos[indice + 1].titulo}
                  </p>
                </div>
              ) : null}
            </main>

            <aside className="hidden w-64 shrink-0 border-l border-gray-100 py-3 sm:block">
              <ListaDePasos pasos={pasos} indice={indice} onElegir={(i) => props.moverA(i, "salto")} className="h-full px-2 text-sm" />
            </aside>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-3">
            <button
              type="button"
              onClick={() => props.moverA(pasoAnterior(indice), "atras")}
              disabled={indice === 0 || props.trabajando}
              className="rounded-full border border-gray-300 px-5 py-2 text-base disabled:opacity-40"
            >
              ‹ Anterior
            </button>
            <BotonesDeVista
              grande
              vistaDelPaso={paso.vista}
              trabajando={props.trabajando}
              onCambiar={(v) => props.ordenar({ tipo: "vista", vista: v })}
            />
            <button
              type="button"
              onClick={() => props.moverA(siguientePaso(indice, pasos.length), "adelante")}
              disabled={indice >= pasos.length - 1 || props.trabajando}
              className="rounded-full bg-[#c27b3d] px-6 py-2 text-base font-semibold text-white disabled:opacity-40"
            >
              Siguiente ›
            </button>
            <div className="flex w-full justify-between text-xs text-gray-500">
              <button type="button" onClick={props.volverAlInicio} className="underline">
                Volver al inicio
              </button>
              <button type="button" onClick={() => window.close()} className="underline">
                Cerrar esta ventana (la guía vuelve a la pantalla compartida)
              </button>
              <button type="button" onClick={() => props.ordenar({ tipo: "vista", vista: "salir" })} className="underline">
                Salir de la demo
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
