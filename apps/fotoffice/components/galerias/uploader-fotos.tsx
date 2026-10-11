"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { borrarFotoAction, pedirSubidaFotoAction } from "@/app/actions/galerias";
import { TAMANO_MAXIMO_ORIGINAL, type TipoFotoPermitido } from "@/lib/galerias/constantes";
import {
  ERRORES_SUBIDA, SUBIDAS_EN_PARALELO, clasificarArchivos, crearCola, pesoLegible, resumirSubidas, tipoDeFoto, type EstadoSubida,
} from "@/lib/galerias/subida";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";
/** Cuántas filas de la lista se dibujan: con mil fotos no se dibujan mil filas. */
const MAX_FILAS_EN_CURSO = 8;
const MAX_FILAS_CON_ERROR = 40;

type Entrada = {
  key: number;
  archivo: File;
  nombre: string;
  tamano: number;
  tipo: TipoFotoPermitido;
  estado: EstadoSubida;
  progreso: number;
  error: string | null;
  /** Id de la foto reservada en el servidor (desde que se pidió el permiso hasta que se confirmó). */
  fotoId: string | null;
};

/**
 * PUT directo al almacenamiento con el enlace firmado, informando el progreso. Se usa XMLHttpRequest
 * porque `fetch` no informa cuánto se subió. El `content-type` tiene que ser el mismo que se declaró al
 * pedir el permiso: es parte de la firma.
 */
function putConProgreso(url: string, archivo: File, tipo: string, alAvanzar: (porcentaje: number) => void): Promise<boolean> {
  return new Promise((resolver) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", tipo);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) alAvanzar(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolver(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolver(false);
    xhr.onabort = () => resolver(false);
    xhr.send(archivo);
  });
}

async function confirmarEnServidor(galeriaId: string, fotoId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/galerias/${encodeURIComponent(galeriaId)}/fotos/confirmar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fotoId }),
    });
    const cuerpo = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (res.ok && cuerpo?.ok) return { ok: true };
    return { ok: false, error: cuerpo?.error ?? ERROR_CONEXION };
  } catch {
    return { ok: false, error: ERROR_CONEXION };
  }
}

/**
 * Subida de fotos al R2 privado: varias a la vez (elegir o arrastrar), 4 en paralelo, con reintento por
 * foto. Cada foto: pedir permiso (el servidor valida y reserva) → PUT directo → confirmar (el servidor
 * genera la vista y la miniatura). Con mil fotos no se dibuja una fila por foto ni se crean vistas
 * previas: sólo se muestran las que están en curso y las que fallaron; el resto es un contador.
 */
export function UploaderFotos({
  galeriaId,
  lugaresLibres,
  deshabilitado,
  motivoDeshabilitado,
  alProcesar,
}: {
  galeriaId: string;
  /** Cuántas fotos más entran en la galería (tope 3.000). */
  lugaresLibres: number;
  deshabilitado: boolean;
  motivoDeshabilitado?: string;
  /** Una foto terminó (ok) o quedó con error en el servidor: la grilla la vuelve a pedir. */
  alProcesar: (fotoId: string, ok: boolean) => void;
}) {
  // El estado vivo (cientos de fotos que cambian varias veces por segundo) está en refs; lo que se dibuja es una
  // copia que se toma a lo sumo cada 150 ms.
  const entradas = useRef(new Map<number, Entrada>());
  const contadores = useRef({ listas: 0 });
  const siguienteKey = useRef(1);
  const [vista, setVista] = useState<{ lista: Entrada[]; listas: number }>({ lista: [], listas: 0 });
  const refrescoPendiente = useRef(false);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const lugares = useRef(lugaresLibres);
  const alProcesarRef = useRef(alProcesar);
  useEffect(() => {
    lugares.current = lugaresLibres;
    alProcesarRef.current = alProcesar;
  }, [lugaresLibres, alProcesar]);

  // Un cambio de estado por foto, pero se dibuja a lo sumo cada 150 ms.
  const dibujar = useCallback(() => {
    if (refrescoPendiente.current) return;
    refrescoPendiente.current = true;
    setTimeout(() => {
      refrescoPendiente.current = false;
      setVista({ lista: [...entradas.current.values()].map((e) => ({ ...e })), listas: contadores.current.listas });
    }, 150);
  }, []);

  const procesar = useCallback(
    async (e: Entrada) => {
      e.error = null;
      const fallar = (motivo: string) => {
        e.estado = "ERROR";
        e.error = motivo;
        dibujar();
      };
      if (!e.fotoId) {
        e.estado = "SUBIENDO";
        e.progreso = 0;
        dibujar();
        const permiso = await pedirSubidaFotoAction(galeriaId, { nombre: e.nombre, tipo: e.tipo, tamano: e.tamano }).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
        if (!permiso.ok) return fallar(permiso.error);
        e.fotoId = permiso.id;
        const subio = await putConProgreso(permiso.url, e.archivo, e.tipo, (p) => {
          e.progreso = p;
          dibujar();
        });
        if (!subio) {
          // La reserva quedó sin archivo: se limpia para no dejar una foto "pendiente" de más.
          const huerfana = e.fotoId;
          e.fotoId = null;
          void borrarFotoAction(galeriaId, huerfana).catch(() => undefined);
          return fallar(ERRORES_SUBIDA.subida);
        }
      }
      e.estado = "PROCESANDO";
      e.progreso = 100;
      dibujar();
      const r = await confirmarEnServidor(galeriaId, e.fotoId);
      if (!r.ok) {
        alProcesarRef.current(e.fotoId, false);
        return fallar(r.error);
      }
      e.estado = "LISTA";
      contadores.current.listas++;
      entradas.current.delete(e.key);
      alProcesarRef.current(e.fotoId, true);
      dibujar();
    },
    [dibujar, galeriaId],
  );

  // La cola es una sola para toda la vida del componente y llama siempre a la versión vigente de `procesar`.
  const procesarRef = useRef(procesar);
  useEffect(() => {
    procesarRef.current = procesar;
  }, [procesar]);
  const colaRef = useRef<ReturnType<typeof crearCola<Entrada>> | null>(null);
  function obtenerCola() {
    colaRef.current ??= crearCola<Entrada>(SUBIDAS_EN_PARALELO, (e) => procesarRef.current(e));
    return colaRef.current;
  }

  function agregar(archivos: File[]) {
    if (deshabilitado || archivos.length === 0) return;
    const { aceptados, rechazados, sobrantes } = clasificarArchivos(archivos, lugares.current);
    const nuevos: Entrada[] = aceptados.map((archivo) => ({
      key: siguienteKey.current++,
      archivo,
      nombre: archivo.name,
      tamano: archivo.size,
      tipo: tipoDeFoto(archivo.name, archivo.type) as TipoFotoPermitido,
      estado: "ESPERA",
      progreso: 0,
      error: null,
      fotoId: null,
    }));
    for (const n of nuevos) entradas.current.set(n.key, n);
    const mensajes: string[] = [];
    if (rechazados.length > 0) {
      const ejemplos = rechazados.slice(0, 3).map((r) => `${r.archivo.name} (${r.motivo.replace(/\.$/, "").toLowerCase()})`);
      mensajes.push(`No se subieron ${rechazados.length} ${rechazados.length === 1 ? "archivo" : "archivos"}: ${ejemplos.join(", ")}${rechazados.length > 3 ? " y otros" : ""}.`);
    }
    if (sobrantes > 0) mensajes.push(`La galería llegó al máximo de fotos: quedaron afuera ${sobrantes}.`);
    setAvisos(mensajes);
    obtenerCola().agregar(nuevos);
    dibujar();
  }

  // Lo que se dibuja es una copia: las acciones buscan la entrada viva por su clave.
  function reintentar(key: number) {
    const e = entradas.current.get(key);
    if (!e || e.estado !== "ERROR") return;
    e.estado = "ESPERA";
    e.error = null;
    obtenerCola().agregar([e]);
    dibujar();
  }

  function reintentarTodas() {
    const falladas = [...entradas.current.values()].filter((e) => e.estado === "ERROR");
    for (const e of falladas) {
      e.estado = "ESPERA";
      e.error = null;
    }
    obtenerCola().agregar(falladas);
    dibujar();
  }

  function descartar(key: number) {
    const e = entradas.current.get(key);
    if (!e || e.estado !== "ERROR") return;
    entradas.current.delete(e.key);
    dibujar();
  }

  const { lista, listas } = vista;
  const parcial = resumirSubidas(lista.map((e) => e.estado));
  const resumen = { ...parcial, total: parcial.total + listas, listas: parcial.listas + listas };
  const enCurso = lista.filter((e) => e.estado === "SUBIENDO" || e.estado === "PROCESANDO").slice(0, MAX_FILAS_EN_CURSO);
  const conError = lista.filter((e) => e.estado === "ERROR");
  const hayActividad = !resumen.terminado;

  // Avisa antes de cerrar la pestaña con subidas a medias.
  useEffect(() => {
    if (!hayActividad) return;
    const alSalir = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [hayActividad]);

  const porcentaje = resumen.total > 0 ? Math.round(((resumen.listas + resumen.conError) / resumen.total) * 100) : 0;

  return (
    <section aria-labelledby="subir-fotos-titulo" className="fo-card space-y-3 p-4">
      <h2 id="subir-fotos-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        Subir fotos
      </h2>
      <div
        onDragOver={(ev) => {
          if (deshabilitado) return;
          ev.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(ev) => {
          ev.preventDefault();
          setArrastrando(false);
          agregar([...ev.dataTransfer.files]);
        }}
        className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-5 text-center text-sm ${
          arrastrando ? "border-[var(--fo-accent,#1d4ed8)] bg-[var(--fo-surface-hover)]" : "border-[var(--fo-border)]"
        } ${deshabilitado ? "opacity-60" : ""}`}
      >
        <p className="text-[var(--fo-muted)]">
          {deshabilitado
            ? motivoDeshabilitado ?? "No se pueden subir fotos ahora."
            : "Arrastrá las fotos hasta acá o elegilas desde tu computadora. JPG o PNG, hasta 50 MB cada una."}
        </p>
        <input
          ref={entrada}
          type="file"
          multiple
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          className="sr-only"
          id="galeria-elegir-fotos"
          disabled={deshabilitado}
          onChange={(ev) => {
            agregar([...(ev.target.files ?? [])]);
            ev.target.value = "";
          }}
        />
        <label htmlFor="galeria-elegir-fotos" className={`fo-btn fo-btn-primary text-sm ${deshabilitado ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
          Elegir fotos
        </label>
        {!deshabilitado ? <p className="text-xs text-[var(--fo-muted)]">Entran {lugaresLibres.toLocaleString("es-AR")} fotos más en esta galería.</p> : null}
      </div>

      {avisos.map((a) => (
        <p key={a} role="status" className="text-sm text-[var(--fo-warning)]">
          {a}
        </p>
      ))}

      {resumen.total > 0 ? (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm">
            <span className="font-medium">
              {resumen.listas.toLocaleString("es-AR")} de {resumen.total.toLocaleString("es-AR")}
            </span>{" "}
            {resumen.terminado ? "terminadas" : "listas"}
            {resumen.conError > 0 ? <span className="text-[var(--fo-danger)]"> · {resumen.conError} con error</span> : null}
            {!resumen.terminado ? <span className="text-[var(--fo-muted)]"> · no cierres esta página hasta que termine</span> : null}
          </p>
          <progress className="h-2 w-full" max={100} value={porcentaje} aria-label="Avance de la subida" />
        </div>
      ) : null}

      {enCurso.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {enCurso.map((e) => (
            <li key={e.key} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">{e.nombre}</span>
              <span className="shrink-0 text-[var(--fo-muted)]">{e.estado === "SUBIENDO" ? `Subiendo ${e.progreso}%` : "Preparando vistas…"}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {conError.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-[var(--fo-danger)]">No se pudieron subir {conError.length}:</p>
            {conError.length > 1 ? (
              <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={reintentarTodas}>
                Reintentar todas
              </button>
            ) : null}
          </div>
          <ul className="divide-y divide-[var(--fo-border)] text-sm">
            {conError.slice(0, MAX_FILAS_CON_ERROR).map((e) => (
              <li key={e.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{e.nombre}</span>
                  <span className="block text-xs text-[var(--fo-danger)]">
                    {e.error} ({pesoLegible(e.tamano)})
                  </span>
                </span>
                <span className="flex gap-2">
                  <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={() => reintentar(e.key)}>
                    Reintentar
                  </button>
                  <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={() => descartar(e.key)}>
                    Descartar
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {conError.length > MAX_FILAS_CON_ERROR ? <p className="text-xs text-[var(--fo-muted)]">Y {conError.length - MAX_FILAS_CON_ERROR} más. Usá “Reintentar todas”.</p> : null}
        </div>
      ) : null}
      <p className="sr-only">Peso máximo por foto: {pesoLegible(TAMANO_MAXIMO_ORIGINAL)}.</p>
    </section>
  );
}
