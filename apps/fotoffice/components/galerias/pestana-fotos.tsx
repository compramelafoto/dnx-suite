"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  borrarFotoAction, establecerModoOrdenAction, establecerPortadaAction, fotosPorIdsAction, reordenarFotosAction,
} from "@/app/actions/galerias";
import { UploaderFotos } from "@/components/galerias/uploader-fotos";
import { MAX_FOTOS_POR_GALERIA, MAX_LAMINAS_POR_RONDA, MAX_VIDEOS_POR_GALERIA, type ModoOrden } from "@/lib/galerias/constantes";
import { fusionarFotos, moverAntesDe, moverUnLugar, reasignarOrden } from "@/lib/galerias/grilla";
import { pesoLegible } from "@/lib/galerias/subida";
import type { FotoVisible } from "@/lib/galerias/fotos";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";
/** Cuántas miniaturas se dibujan por vez (con 3.000 fotos no se arman 3.000 tarjetas de golpe). */
const TANDA = 120;
const MS_REFRESCO = 1200;
const MS_GUARDAR_ORDEN = 700;

type AccionesTarjeta = {
  portada: (id: string) => void;
  borrar: (id: string) => void;
  mover: (id: string, paso: -1 | 1) => void;
  reintentar: (id: string) => void;
  soltar: (id: string, antesDe: string) => void;
};

const Tarjeta = memo(function Tarjeta({
  foto, esPortada, manual, puedeGestionar, ocupada, acciones, permitePortada,
}: {
  foto: FotoVisible;
  esPortada: boolean;
  /** Las láminas de un álbum no tienen portada. */
  permitePortada: boolean;
  manual: boolean;
  puedeGestionar: boolean;
  ocupada: boolean;
  acciones: AccionesTarjeta;
}) {
  const [sobre, setSobre] = useState(false);
  return (
    <li
      className={`group relative overflow-hidden rounded-lg border bg-[var(--fo-surface)] ${sobre ? "border-[var(--fo-accent,#1d4ed8)]" : "border-[var(--fo-border)]"}`}
      draggable={manual && puedeGestionar}
      onDragStart={(ev) => {
        ev.dataTransfer.setData("text/plain", foto.id);
        ev.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(ev) => {
        if (!manual || !puedeGestionar) return;
        ev.preventDefault();
        setSobre(true);
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(ev) => {
        setSobre(false);
        if (!manual || !puedeGestionar) return;
        ev.preventDefault();
        const id = ev.dataTransfer.getData("text/plain");
        if (id) acciones.soltar(id, foto.id);
      }}
    >
      <div className="relative aspect-square bg-[var(--fo-surface-hover)]">
        {foto.status === "LISTA" && foto.mediaType === "VIDEO" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-neutral-800 p-2 text-center text-xs text-white" role="img" aria-label={`Video ${foto.fileName}`}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 8l6 4-6 4z" />
            </svg>
            <span>Video</span>
          </div>
        ) : foto.status === "LISTA" && foto.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto.thumbUrl} alt={foto.fileName} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
        ) : foto.status === "ERROR" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-2 text-center text-xs">
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">Error</span>
            <span className="line-clamp-3 text-[var(--fo-danger)]">{foto.errorReason ?? "No pudimos procesar esta foto."}</span>
            {puedeGestionar ? (
              <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={ocupada} onClick={() => acciones.reintentar(foto.id)}>
                Reintentar
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-2 text-center text-xs">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">{foto.status === "PENDIENTE" ? "Pendiente" : "Sin vista"}</span>
            <span className="text-[var(--fo-muted)]">Se está procesando o no terminó de subirse.</span>
            {puedeGestionar ? (
              <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={ocupada} onClick={() => acciones.reintentar(foto.id)}>
                Reintentar
              </button>
            ) : null}
          </div>
        )}
        {esPortada ? <span className="absolute left-1 top-1 rounded-full bg-[var(--fo-accent,#1d4ed8)] px-2 py-0.5 text-[11px] font-medium text-white">Portada</span> : null}
      </div>
      <div className="space-y-1 p-2">
        <p className="truncate text-xs font-medium" title={foto.fileName}>
          {foto.fileName}
        </p>
        {foto.sizeBytes ? <p className="text-[11px] text-[var(--fo-muted)]">{pesoLegible(foto.sizeBytes)}</p> : null}
        {puedeGestionar ? (
          <div className="flex flex-wrap gap-1">
            {manual ? (
              <>
                <button type="button" className="fo-btn fo-btn-secondary px-2 py-0.5 text-xs" disabled={ocupada} aria-label={`Mover ${foto.fileName} antes`} onClick={() => acciones.mover(foto.id, -1)}>
                  ◀
                </button>
                <button type="button" className="fo-btn fo-btn-secondary px-2 py-0.5 text-xs" disabled={ocupada} aria-label={`Mover ${foto.fileName} después`} onClick={() => acciones.mover(foto.id, 1)}>
                  ▶
                </button>
              </>
            ) : null}
            {permitePortada && foto.status === "LISTA" && foto.mediaType !== "VIDEO" && !esPortada ? (
              <button type="button" className="fo-btn fo-btn-secondary px-2 py-0.5 text-xs" disabled={ocupada} aria-label={`Elegir ${foto.fileName} como portada`} onClick={() => acciones.portada(foto.id)}>
                Portada
              </button>
            ) : null}
            <button type="button" className="fo-btn fo-btn-secondary px-2 py-0.5 text-xs text-[var(--fo-danger)]" disabled={ocupada} aria-label={`Borrar ${foto.fileName}`} onClick={() => acciones.borrar(foto.id)}>
              Borrar
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
});

/**
 * Pestaña "Fotos" de la ficha: el uploader y la grilla. La grilla guarda las fotos en su estado y las
 * va completando mientras se sube (pide sólo las que terminaron, de a 100), sin recargar la página.
 * Orden por nombre (natural) o manual (arrastrar o con las flechas ◀ ▶), portada y borrado.
 */
export function PestanaFotos({
  galeriaId, fotosIniciales, orderMode, coverFotoId, archivada, puedeGestionar, esEntrega = false, esAlbum = false, soloLectura = false,
}: {
  galeriaId: string;
  /** Galería de entrega: acepta videos y no habla de selección. */
  esEntrega?: boolean;
  /** Álbum: son láminas (sólo imágenes), hasta 300 por ronda y sin portada. */
  esAlbum?: boolean;
  /** Ronda cerrada de un álbum: se mira, no se sube, borra ni reordena. */
  soloLectura?: boolean;
  fotosIniciales: FotoVisible[];
  orderMode: ModoOrden;
  coverFotoId: string | null;
  archivada: boolean;
  puedeGestionar: boolean;
}) {
  const [fotos, setFotos] = useState<FotoVisible[]>(fotosIniciales);
  const [modo, setModo] = useState<ModoOrden>(orderMode);
  const [portada, setPortada] = useState<string | null>(coverFotoId);
  const [visibles, setVisibles] = useState(TANDA);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState(false);
  const modoRef = useRef(modo);
  modoRef.current = modo;
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;

  // --- Completar la grilla con lo que va terminando el uploader ---
  const porPedir = useRef(new Set<string>());
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pidiendo = useRef(false);
  const guardado = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pedirPendientes = useCallback(async () => {
    if (pidiendo.current) return;
    pidiendo.current = true;
    try {
      while (porPedir.current.size > 0) {
        const lote = [...porPedir.current].slice(0, 100);
        for (const id of lote) porPedir.current.delete(id);
        const r = await fotosPorIdsAction(galeriaId, lote).catch(() => null);
        if (r && r.ok) setFotos((actuales) => fusionarFotos(actuales, r.fotos, modoRef.current));
      }
    } finally {
      pidiendo.current = false;
    }
  }, [galeriaId]);

  const alProcesar = useCallback(
    (fotoId: string) => {
      porPedir.current.add(fotoId);
      if (temporizador.current) return;
      temporizador.current = setTimeout(() => {
        temporizador.current = null;
        void pedirPendientes();
      }, MS_REFRESCO);
    },
    [pedirPendientes],
  );

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      if (guardado.current) clearTimeout(guardado.current);
    },
    [],
  );

  // --- Orden manual ---
  const programarGuardadoDeOrden = useCallback(() => {
    if (guardado.current) clearTimeout(guardado.current);
    guardado.current = setTimeout(async () => {
      guardado.current = null;
      const r = await reordenarFotosAction(galeriaId, fotosRef.current.map((f) => f.id)).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) setError(r.error);
    }, MS_GUARDAR_ORDEN);
  }, [galeriaId]);

  const mover = useCallback(
    (id: string, paso: -1 | 1) => {
      setError(null);
      setFotos((a) => reasignarOrden(moverUnLugar(a, id, paso)));
      programarGuardadoDeOrden();
    },
    [programarGuardadoDeOrden],
  );

  const soltar = useCallback(
    (id: string, antesDe: string) => {
      setError(null);
      setFotos((a) => reasignarOrden(moverAntesDe(a, id, antesDe)));
      programarGuardadoDeOrden();
    },
    [programarGuardadoDeOrden],
  );

  async function cambiarModo(nuevo: ModoOrden) {
    if (nuevo === modo || ocupada) return;
    setError(null);
    setAviso(null);
    setOcupada(true);
    try {
      if (nuevo === "NOMBRE") {
        const r = await establecerModoOrdenAction(galeriaId, "NOMBRE").catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
        if (!r.ok) return setError(r.error);
        setModo("NOMBRE");
        setFotos((a) => fusionarFotos(a, [], "NOMBRE"));
      } else {
        // Pasar a manual guarda el orden que se está viendo (por nombre) como punto de partida.
        const actual = reasignarOrden(fotosRef.current);
        const r = await reordenarFotosAction(galeriaId, actual.map((f) => f.id)).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
        if (!r.ok) return setError(r.error);
        setModo("MANUAL");
        setFotos(actual);
        setAviso("Orden manual: arrastrá las fotos o usá las flechas ◀ ▶.");
      }
    } finally {
      setOcupada(false);
    }
  }

  const elegirPortada = useCallback(
    async (id: string) => {
      setError(null);
      setOcupada(true);
      const r = await establecerPortadaAction(galeriaId, id).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      setOcupada(false);
      if (!r.ok) return setError(r.error);
      setPortada(id);
    },
    [galeriaId],
  );

  const borrar = useCallback(
    async (id: string) => {
      const foto = fotosRef.current.find((f) => f.id === id);
      if (!foto) return;
      if (!window.confirm(esEntrega || esAlbum ? `¿Borrar ${esAlbum ? "la lámina " : ""}"${foto.fileName}"? No se puede deshacer.` : `¿Borrar "${foto.fileName}"? Se borra también la elección de los clientes que la hayan marcado. No se puede deshacer.`)) return;
      setError(null);
      setOcupada(true);
      const r = await borrarFotoAction(galeriaId, id).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      setOcupada(false);
      if (!r.ok) return setError(r.error);
      setFotos((a) => a.filter((f) => f.id !== id));
      setPortada((p) => (p === id ? null : p));
    },
    [galeriaId, esEntrega, esAlbum],
  );

  const reintentar = useCallback(
    async (id: string) => {
      setError(null);
      setOcupada(true);
      try {
        const res = await fetch(`/api/galerias/${encodeURIComponent(galeriaId)}/fotos/confirmar`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fotoId: id }),
        });
        const cuerpo = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!res.ok || !cuerpo?.ok) setError(`${cuerpo?.error ?? ERROR_CONEXION} Si sigue fallando, borrá la foto y volvé a subirla.`);
      } catch {
        setError(ERROR_CONEXION);
      } finally {
        setOcupada(false);
        alProcesar(id);
      }
    },
    [galeriaId, alProcesar],
  );

  const acciones: AccionesTarjeta = { portada: elegirPortada, borrar, mover, reintentar, soltar };
  const listas = fotos.filter((f) => f.status === "LISTA").length;
  const problemas = fotos.length - listas;
  const puedeEditar = puedeGestionar && !soloLectura;
  const puedeSubir = puedeEditar && !archivada;
  const lugares = esAlbum ? MAX_LAMINAS_POR_RONDA : MAX_FOTOS_POR_GALERIA;
  const sustantivo = esEntrega ? "Archivos" : esAlbum ? "Láminas" : "Fotos";
  const videosUsados = fotos.filter((f) => f.mediaType === "VIDEO").length;

  return (
    <div className="space-y-4">
      {puedeEditar ? (
        <UploaderFotos
          galeriaId={galeriaId}
          lugaresLibres={Math.max(0, lugares - fotos.length)}
          admiteVideos={esEntrega}
          esAlbum={esAlbum}
          videosLibres={Math.max(0, MAX_VIDEOS_POR_GALERIA - videosUsados)}
          deshabilitado={!puedeSubir}
          motivoDeshabilitado={archivada ? "La galería está archivada: reactivala para subir archivos." : undefined}
          alProcesar={alProcesar}
        />
      ) : null}

      <section aria-labelledby="fotos-titulo" className="fo-card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="fotos-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
            {sustantivo} ({listas.toLocaleString("es-AR")}
            {problemas > 0 ? ` listas · ${problemas} con problemas` : ""})
          </h2>
          {fotos.length > 1 ? (
            <fieldset className="flex items-center gap-3 text-sm" disabled={!puedeEditar || ocupada}>
              <legend className="sr-only">Orden de las fotos</legend>
              <label className="flex items-center gap-1">
                <input type="radio" name="orden-fotos" checked={modo === "NOMBRE"} onChange={() => void cambiarModo("NOMBRE")} />
                Por nombre
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name="orden-fotos" checked={modo === "MANUAL"} onChange={() => void cambiarModo("MANUAL")} />
                Manual
              </label>
            </fieldset>
          ) : null}
        </div>

        <div aria-live="polite">
          {error ? (
            <p role="alert" className="text-sm text-[var(--fo-danger)]">
              {error}
            </p>
          ) : aviso ? (
            <p role="status" className="text-sm text-[var(--fo-muted)]">
              {aviso}
            </p>
          ) : null}
        </div>

        {fotos.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">
            {esEntrega ? "Todavía no hay archivos. Subí las primeras fotos y videos con el cuadro de arriba." : esAlbum ? (soloLectura ? "Esta ronda no tiene láminas." : "Todavía no hay láminas. Subí las primeras (una imagen JPG o PNG por lámina o pliego) con el cuadro de arriba.") : "Todavía no hay fotos. Subí las primeras con el cuadro de arriba."}
          </p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {fotos.slice(0, visibles).map((f) => (
                <Tarjeta key={f.id} foto={f} esPortada={portada === f.id} permitePortada={!esAlbum} manual={modo === "MANUAL"} puedeGestionar={puedeEditar} ocupada={ocupada} acciones={acciones} />
              ))}
            </ul>
            {fotos.length > visibles ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setVisibles((v) => v + TANDA)}>
                  Mostrar {Math.min(TANDA, fotos.length - visibles)} más
                </button>
                <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setVisibles(fotos.length)}>
                  Mostrar todas ({fotos.length.toLocaleString("es-AR")})
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
