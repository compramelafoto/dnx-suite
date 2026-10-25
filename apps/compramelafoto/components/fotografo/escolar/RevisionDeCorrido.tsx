"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DesignPagesPreview from "@/components/design-v2/DesignPagesPreview";
import type { DesignPhotoPayload, DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { emptySlotIds, type DesignV2Data } from "@/lib/design-v2/design-data";

/**
 * Revisión "de corrido": los diseños del paso "Revisar diseño", uno atrás del otro, grandes y
 * sin salir de la pantalla. Aprobar o pedir cambios pasa al siguiente enseguida; el guardado
 * (que en la aprobación genera el PDF y puede tardar) sigue por detrás, de a dos por vez.
 *
 * Atajos: A aprueba · C pide cambios (Enter confirma) · E abre el editor en otra pestaña ·
 * ← → navegan sin decidir · Esc cierra.
 */

export type DisenoEnFila = {
  designId: number;
  alumno: string;
  curso: string | null;
  escuela: string | null;
  isDemo: boolean;
};

type Cargado = { data: DesignV2Data; template: DesignTemplatePayload; photos: DesignPhotoPayload[] };

type Decision =
  | { estado: "aprobando" | "enviando-cambios" }
  | { estado: "aprobado"; sinArchivo?: string | null }
  | { estado: "cambios"; nota: string }
  | { estado: "error"; accion: "aprobar" | "cambios"; mensaje: string };

const EN_PARALELO = 2;

export type ResumenRevision = {
  aprobados: number;
  cambios: number;
  errores: number;
  /** Decisiones que todavía se estaban guardando al cerrar (terminan solas). */
  guardando: number;
};

export default function RevisionDeCorrido({
  disenos,
  onClose,
}: {
  disenos: DisenoEnFila[];
  onClose: (resumen: ResumenRevision) => void;
}) {
  const total = disenos.length;
  const [indice, setIndice] = useState(0);
  const [cargados, setCargados] = useState<Record<number, Cargado | { error: string }>>({});
  const [decisiones, setDecisiones] = useState<Record<number, Decision>>({});
  const [pidiendoCambios, setPidiendoCambios] = useState(false);
  const [nota, setNota] = useState("");
  const [avisoHuecos, setAvisoHuecos] = useState<number | null>(null);
  const pedidos = useRef(new Set<number>());
  const cola = useRef<Array<() => Promise<void>>>([]);
  const corriendo = useRef(0);
  const notaRef = useRef<HTMLTextAreaElement>(null);

  const terminado = indice >= total;
  const actual = terminado ? null : disenos[indice];

  // Cargar el actual y los dos siguientes, para que pasar sea instantáneo.
  useEffect(() => {
    for (const d of disenos.slice(indice, indice + 3)) {
      if (pedidos.current.has(d.designId)) continue;
      pedidos.current.add(d.designId);
      void fetch(`/api/fotografo/disenos/${d.designId}`, { credentials: "include", cache: "no-store" })
        .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
        .then(({ ok, body }) => {
          setCargados((s) => ({
            ...s,
            [d.designId]:
              ok && body.ok
                ? { data: body.data, template: body.template, photos: body.photos }
                : { error: body.error || "No se pudo abrir el diseño." },
          }));
        })
        .catch(() => setCargados((s) => ({ ...s, [d.designId]: { error: "Error de red al abrir el diseño." } })));
    }
  }, [indice, disenos]);

  const correrCola = useCallback(() => {
    while (corriendo.current < EN_PARALELO && cola.current.length > 0) {
      const tarea = cola.current.shift()!;
      corriendo.current += 1;
      void tarea().finally(() => {
        corriendo.current -= 1;
        correrCola();
      });
    }
  }, []);

  const siguiente = useCallback(() => {
    setPidiendoCambios(false);
    setNota("");
    setAvisoHuecos(null);
    setIndice((i) => Math.min(total, i + 1));
  }, [total]);

  const anterior = useCallback(() => {
    setPidiendoCambios(false);
    setNota("");
    setAvisoHuecos(null);
    setIndice((i) => Math.max(0, i - 1));
  }, []);

  const aprobar = useCallback(() => {
    if (!actual) return;
    const id = actual.designId;
    const c = cargados[id];
    if (!c || "error" in c) return;
    const vacios = emptySlotIds(c.data).length;
    // Con huecos vacíos se pide confirmar apretando otra vez, sin cortar el ritmo con un diálogo.
    if (vacios > 0 && avisoHuecos !== id) {
      setAvisoHuecos(id);
      return;
    }
    setDecisiones((s) => ({ ...s, [id]: { estado: "aprobando" } }));
    cola.current.push(async () => {
      try {
        const res = await fetch(`/api/fotografo/disenos/${id}/approve`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo aprobar.");
        setDecisiones((s) => ({
          ...s,
          [id]: { estado: "aprobado", sinArchivo: body.status === "EXPORTED" ? null : body.error || "sin archivo" },
        }));
      } catch (err) {
        setDecisiones((s) => ({
          ...s,
          [id]: { estado: "error", accion: "aprobar", mensaje: err instanceof Error ? err.message : "No se pudo aprobar." },
        }));
      }
    });
    correrCola();
    siguiente();
  }, [actual, cargados, avisoHuecos, correrCola, siguiente]);

  const confirmarCambios = useCallback(() => {
    if (!actual) return;
    const texto = nota.trim();
    if (!texto) return;
    const id = actual.designId;
    setDecisiones((s) => ({ ...s, [id]: { estado: "enviando-cambios" } }));
    cola.current.push(async () => {
      try {
        const res = await fetch(`/api/fotografo/disenos/${id}/request-changes`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: texto }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo pedir el cambio.");
        setDecisiones((s) => ({ ...s, [id]: { estado: "cambios", nota: texto } }));
      } catch (err) {
        setDecisiones((s) => ({
          ...s,
          [id]: { estado: "error", accion: "cambios", mensaje: err instanceof Error ? err.message : "No se pudo pedir el cambio." },
        }));
      }
    });
    correrCola();
    siguiente();
  }, [actual, nota, correrCola, siguiente]);

  const abrirEditor = useCallback(() => {
    if (actual) window.open(`/fotografo/disenos/${actual.designId}`, "_blank", "noopener");
  }, [actual]);

  const valores = Object.values(decisiones);
  const guardando = valores.filter((d) => d.estado === "aprobando" || d.estado === "enviando-cambios").length;
  const resumen: ResumenRevision = {
    aprobados: valores.filter((d) => d.estado === "aprobado").length,
    cambios: valores.filter((d) => d.estado === "cambios").length,
    errores: valores.filter((d) => d.estado === "error").length,
    guardando,
  };

  const cerrar = useCallback(() => {
    if (
      resumen.guardando > 0 &&
      !window.confirm(
        `Todavía se están guardando ${resumen.guardando}. Si cerrás, terminan solos en unos segundos. ¿Cerrar?`,
      )
    ) {
      return;
    }
    onClose(resumen);
  }, [onClose, resumen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const enTexto = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;
      if (pidiendoCambios && enTexto) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          confirmarCambios();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setPidiendoCambios(false);
        }
        return;
      }
      if (enTexto) return;
      const k = e.key.toLowerCase();
      if (e.key === "Escape") {
        e.preventDefault();
        cerrar();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        siguiente();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        anterior();
      } else if (terminado) {
        return;
      } else if (k === "a") {
        e.preventDefault();
        aprobar();
      } else if (k === "c") {
        e.preventDefault();
        setPidiendoCambios(true);
      } else if (k === "e") {
        e.preventDefault();
        abrirEditor();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pidiendoCambios, terminado, confirmarCambios, cerrar, siguiente, anterior, aprobar, abrirEditor]);

  useEffect(() => {
    if (pidiendoCambios) notaRef.current?.focus();
  }, [pidiendoCambios]);

  // Mientras está abierta, la página de atrás no se desplaza.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const cargado = actual ? cargados[actual.designId] : undefined;
  const decision = actual ? decisiones[actual.designId] : undefined;
  const progreso = total > 0 ? Math.round((Math.min(indice, total) / total) * 100) : 100;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[#f3f4f6]"
      role="dialog"
      aria-modal="true"
      aria-label="Revisión de corrido"
    >
      <header className="border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-xs font-medium uppercase tracking-wide text-[#c27b3d]">Revisión de corrido</p>
            <p className="m-0 truncate text-base font-semibold text-gray-900 sm:text-lg">
              {actual ? (
                <>
                  {actual.alumno}
                  {actual.curso ? <span className="font-normal text-gray-600"> · {actual.curso}</span> : null}
                  {actual.escuela ? <span className="hidden font-normal text-gray-500 sm:inline"> · {actual.escuela}</span> : null}
                  {actual.isDemo ? (
                    <span className="ml-2 inline-flex rounded bg-fuchsia-100 px-1.5 py-0.5 align-middle text-[11px] font-bold text-fuchsia-800">
                      DEMO
                    </span>
                  ) : null}
                </>
              ) : (
                "Terminaste"
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm font-semibold tabular-nums text-gray-700">
              {Math.min(indice + 1, total)} de {total}
            </span>
            <button
              type="button"
              onClick={cerrar}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
            >
              Cerrar <kbd className="ml-1 hidden text-[10px] text-gray-400 sm:inline">Esc</kbd>
            </button>
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden>
          <div className="h-full rounded-full bg-[#c27b3d] transition-all" style={{ width: `${progreso}%` }} />
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col p-3 sm:p-5">
        {terminado ? (
          <div className="m-auto w-full max-w-md rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-100">
            <p className="m-0 text-lg font-semibold text-gray-900">
              Aprobaste {resumen.aprobados}, pediste cambios en {resumen.cambios}
            </p>
            {total - resumen.aprobados - resumen.cambios - resumen.errores - guardando > 0 ? (
              <p className="mt-2 text-sm text-gray-600">
                {total - resumen.aprobados - resumen.cambios - resumen.errores - guardando} quedaron sin decidir: siguen en
                “Revisar diseño”.
              </p>
            ) : null}
            {guardando > 0 ? (
              <p className="mt-2 text-sm text-amber-700">Guardando {guardando}… (generamos el PDF de cada aprobado)</p>
            ) : null}
            {resumen.errores > 0 ? (
              <p className="mt-2 text-sm text-red-700">
                {resumen.errores} no se pudieron guardar. Volvé con ← para verlos y probar de nuevo.
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={anterior}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
              >
                ← Volver al último
              </button>
              <button
                type="button"
                onClick={cerrar}
                disabled={guardando > 0}
                className="rounded-lg bg-[#c27b3d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a9682f] disabled:opacity-60"
              >
                {guardando > 0 ? "Esperá un momento…" : "Listo"}
              </button>
            </div>
          </div>
        ) : !cargado ? (
          <div className="m-auto text-sm text-gray-500">Cargando diseño…</div>
        ) : "error" in cargado ? (
          <div className="m-auto max-w-md text-center text-sm text-red-700">
            {cargado.error} Pasá al siguiente con → o abrilo en el editor con E.
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <DesignPagesPreview template={cargado.template} photos={cargado.photos} data={cargado.data} />
          </div>
        )}

        {!terminado && decision ? (
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
            <EstadoDecision decision={decision} />
          </div>
        ) : null}
      </main>

      {!terminado ? (
        <footer className="border-t border-gray-200 bg-white px-3 py-3 sm:px-6">
          {avisoHuecos === actual?.designId && cargado && !("error" in cargado) ? (
            <p className="m-0 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              Hay {emptySlotIds(cargado.data).length} hueco(s) sin foto (marcados en rojo): van a salir vacíos. Apretá{" "}
              <strong>Aprobar</strong> otra vez para aprobarlo igual, o <strong>Pedir cambios</strong>.
            </p>
          ) : null}
          {pidiendoCambios ? (
            <div className="mb-2">
              <label htmlFor="nota-cambios" className="block text-sm font-medium text-gray-900">
                ¿Qué necesitás que haga la familia?
              </label>
              <textarea
                id="nota-cambios"
                ref={notaRef}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Por ejemplo: la foto de la tapa salió con los ojos cerrados, ¿me elegís otra?"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#c27b3d] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/20"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={confirmarCambios}
                  disabled={!nota.trim()}
                  className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  Enviar y seguir <kbd className="ml-1 hidden text-[10px] opacity-75 sm:inline">Enter</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setPidiendoCambios(false)}
                  className="rounded-lg px-3 py-2 text-sm text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <span className="text-xs text-gray-500">
                  {actual?.isDemo ? "Es una prueba DEMO: no le llega ningún correo." : "Le llega a la familia por correo."}
                </span>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <BotonAtajo onClick={anterior} atajo="←" disabled={indice === 0}>
                Anterior
              </BotonAtajo>
              <BotonAtajo onClick={siguiente} atajo="→">
                Saltar
              </BotonAtajo>
            </div>
            <div className="flex flex-wrap gap-2">
              <BotonAtajo onClick={abrirEditor} atajo="E">
                Abrir editor
              </BotonAtajo>
              <BotonAtajo onClick={() => setPidiendoCambios(true)} atajo="C" disabled={pidiendoCambios}>
                Pedir cambios
              </BotonAtajo>
              <BotonAtajo
                onClick={aprobar}
                atajo="A"
                principal
                disabled={!cargado || "error" in cargado || pidiendoCambios}
              >
                {avisoHuecos === actual?.designId ? "Aprobar igual" : "Aprobar"}
              </BotonAtajo>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

function BotonAtajo({
  children,
  onClick,
  atajo,
  principal = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  atajo: string;
  principal?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
        principal
          ? "bg-[#c27b3d] text-white hover:bg-[#a9682f]"
          : "bg-white text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50"
      }`}
    >
      {children}
      <kbd
        className={`hidden rounded px-1.5 py-0.5 text-[11px] font-mono sm:inline ${
          principal ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
        }`}
      >
        {atajo}
      </kbd>
    </button>
  );
}

function EstadoDecision({ decision }: { decision: Decision }) {
  const base = "rounded-full px-3 py-1 text-xs font-semibold shadow-sm ring-1";
  switch (decision.estado) {
    case "aprobando":
      return <span className={`${base} bg-amber-50 text-amber-800 ring-amber-200`}>Aprobando…</span>;
    case "enviando-cambios":
      return <span className={`${base} bg-sky-50 text-sky-800 ring-sky-200`}>Enviando el pedido…</span>;
    case "aprobado":
      return decision.sinArchivo ? (
        <span className={`${base} bg-rose-50 text-rose-800 ring-rose-200`}>
          Aprobado, pero falta el archivo: reintentalo desde el editor
        </span>
      ) : (
        <span className={`${base} bg-emerald-50 text-emerald-800 ring-emerald-200`}>Aprobado</span>
      );
    case "cambios":
      return <span className={`${base} bg-sky-50 text-sky-800 ring-sky-200`}>Cambios pedidos</span>;
    case "error":
      return (
        <span className={`${base} bg-red-50 text-red-800 ring-red-200`}>
          No se pudo {decision.accion === "aprobar" ? "aprobar" : "pedir el cambio"}: {decision.mensaje}
        </span>
      );
  }
}
