"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { descargarOriginalAction, reproducirVideoAction, vistasAction } from "@/app/w/[workspaceSlug]/galeria/[token]/acciones";
import { EnlacePedirCopias } from "@/components/impresiones/enlace-pedir-copias";
import { MAX_VISTAS_POR_LOTE, MENSAJES_PUBLICO, idsParaPrecargar, type FotoPublica, type VistaGaleria } from "@/lib/galerias/publico-tipos";
import { IconoCerrar, IconoDescarga, IconoFlechaDer, IconoFlechaIzq, IconoPlay } from "./iconos";

const sinMenu = (e: React.SyntheticEvent) => e.preventDefault();
const UMBRAL_DESLIZAR = 50;

/** Tapa genérica de un video: no hay miniatura ni se conoce la duración. */
function TapaVideo({ grande = false }: { grande?: boolean }) {
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-neutral-800 text-white" role="img" aria-label="Video">
      <span className={`flex items-center justify-center rounded-full border-2 border-white/80 ${grande ? "h-16 w-16" : "h-12 w-12"}`}>
        <IconoPlay width={grande ? 30 : 24} height={grande ? 30 : 24} />
      </span>
      <span className="text-xs opacity-80">Video</span>
    </span>
  );
}

const Celda = memo(function Celda({ foto, numero, onAbrir, onDescargar }: { foto: FotoPublica; numero: number; onAbrir: (id: string) => void; onDescargar: (id: string) => void }) {
  const esVideo = foto.tipo === "VIDEO";
  return (
    <li className="relative aspect-square overflow-hidden rounded-md bg-neutral-200 [contain-intrinsic-size:160px] [content-visibility:auto]">
      <button type="button" onClick={() => onAbrir(foto.id)} aria-label={`${esVideo ? "Ver el video" : "Ver la foto"} ${numero}`} className="absolute inset-0 block h-full w-full" onContextMenu={sinMenu}>
        {esVideo ? (
          <TapaVideo />
        ) : foto.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto.thumbUrl}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onContextMenu={sinMenu}
            onDragStart={sinMenu}
            referrerPolicy="no-referrer"
            width={foto.width ?? undefined}
            height={foto.height ?? undefined}
            className="h-full w-full select-none object-contain [-webkit-touch-callout:none]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs opacity-60">Sin vista previa</span>
        )}
      </button>
      <button
        type="button"
        onClick={() => onDescargar(foto.id)}
        aria-label={`Descargar ${esVideo ? "el video" : "la foto"} ${numero} en alta`}
        className="absolute left-1 top-1 flex h-9 items-center gap-1 rounded-full bg-black/60 px-3 text-xs font-medium text-white shadow"
      >
        <IconoDescarga width={14} height={14} />
        Descargar
      </button>
    </li>
  );
});

type PropsVisor = {
  fotos: FotoPublica[];
  indice: number;
  numeros: ReadonlyMap<string, number>;
  total: number;
  vistas: Readonly<Record<string, string>>;
  videos: Readonly<Record<string, string>>;
  errorVideo: string | null;
  onIr: (indice: number) => void;
  onCerrar: () => void;
  onDescargar: (id: string) => void;
  onVistaFallida: (id: string) => void;
  onVideoFallido: (id: string) => void;
};

/** Visor de la entrega: la foto en grande o el video con su reproductor; flechas, teclado y deslizar con el dedo. */
function VisorEntrega(p: PropsVisor) {
  const foto = p.fotos[p.indice];
  const [cargada, setCargada] = useState<string | null>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const cierre = useRef<HTMLButtonElement>(null);
  const previo = useRef<Element | null>(null);
  const { onIr, onCerrar, indice, fotos } = p;

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const destino = e.target as HTMLElement | null;
      // Con el reproductor enfocado las flechas adelantan y atrasan el video.
      if (destino?.tagName === "VIDEO" && e.key !== "Escape") return;
      if (e.key === "Escape") onCerrar();
      else if (e.key === "ArrowLeft" && indice > 0) onIr(indice - 1);
      else if (e.key === "ArrowRight" && indice < fotos.length - 1) onIr(indice + 1);
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onIr, onCerrar, indice, fotos.length]);

  useEffect(() => {
    previo.current = document.activeElement;
    cierre.current?.focus();
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
      if (previo.current instanceof HTMLElement) previo.current.focus();
    };
  }, []);

  if (!foto) return null;
  const esVideo = foto.tipo === "VIDEO";
  const numero = (p.numeros.get(foto.id) ?? 0) + 1;
  const vista = p.vistas[foto.id];
  const video = p.videos[foto.id];

  function empezar(e: React.TouchEvent) {
    inicio.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }
  function terminar(e: React.TouchEvent) {
    const i = inicio.current;
    inicio.current = null;
    // Sobre un video el deslizar es del reproductor (barra de avance).
    if (!i || esVideo || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - i.x;
    const dy = e.changedTouches[0].clientY - i.y;
    if (Math.abs(dx) < UMBRAL_DESLIZAR || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && p.indice < p.fotos.length - 1) p.onIr(p.indice + 1);
    else if (dx > 0 && p.indice > 0) p.onIr(p.indice - 1);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`${esVideo ? "Video" : "Foto"} ${numero} de ${p.total}`} className="fixed inset-0 z-50 flex select-none flex-col bg-black/95 text-white" onContextMenu={esVideo ? undefined : sinMenu}>
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-sm tabular-nums" aria-live="polite">
          {esVideo ? "Video" : "Foto"} {numero} de {p.total}
        </p>
        <button ref={cierre} type="button" onClick={p.onCerrar} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
          <IconoCerrar />
        </button>
      </header>

      <div className="relative min-h-0 flex-1" onTouchStart={empezar} onTouchEnd={terminar}>
        <div key={foto.id} className="absolute inset-0 p-1 sm:p-4">
          {esVideo ? (
            video ? (
              <video
                key={video}
                src={video}
                controls
                playsInline
                preload="metadata"
                controlsList="nodownload"
                onError={() => p.onVideoFallido(foto.id)}
                className="absolute inset-0 h-full w-full bg-black object-contain"
              />
            ) : (
              <p className="absolute bottom-1/2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs">{p.errorVideo ?? "Cargando el video…"}</p>
            )
          ) : (
            <>
              {foto.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto.thumbUrl} alt="" draggable={false} referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-contain opacity-80 blur-sm" />
              ) : null}
              {vista ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={vista}
                  alt={`Foto ${numero}`}
                  draggable={false}
                  referrerPolicy="no-referrer"
                  onContextMenu={sinMenu}
                  onDragStart={sinMenu}
                  onLoad={() => setCargada(foto.id)}
                  onError={() => p.onVistaFallida(foto.id)}
                  className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 [-webkit-touch-callout:none] ${cargada === foto.id ? "opacity-100" : "opacity-0"}`}
                />
              ) : null}
              {!vista || cargada !== foto.id ? <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs">Cargando la foto…</p> : null}
            </>
          )}
        </div>
        {p.indice > 0 ? (
          <button type="button" onClick={() => p.onIr(p.indice - 1)} aria-label="Anterior" className="absolute left-1 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 hover:bg-black/60">
            <IconoFlechaIzq width={28} height={28} />
          </button>
        ) : null}
        {p.indice < p.fotos.length - 1 ? (
          <button type="button" onClick={() => p.onIr(p.indice + 1)} aria-label="Siguiente" className="absolute right-1 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 hover:bg-black/60">
            <IconoFlechaDer width={28} height={28} />
          </button>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-white/15 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <button type="button" onClick={() => p.onDescargar(foto.id)} className="fo-btn fo-btn-secondary">
          <IconoDescarga />
          Descargar
        </button>
      </footer>
    </div>
  );
}

/**
 * La galería de entrega del cliente (sin sesión; el token es la llave): grilla con fotos y videos, visor con
 * reproductor y "Descargar" por archivo (el original). No hay selección, comentarios ni compra. `slotRecibirTodo`
 * deja el lugar de «Recibir todo por correo».
 */
export function GaleriaEntrega({
  slug,
  token,
  vista,
  slotRecibirTodo = null,
  enlaceImprimir,
}: {
  slug: string;
  token: string;
  vista: VistaGaleria;
  slotRecibirTodo?: ReactNode;
  /** Sólo si el estudio ofrece copias y la entrega tiene alguna foto. */
  enlaceImprimir?: string;
}) {
  const [visor, setVisor] = useState<{ ids: string[]; indice: number } | null>(null);
  const [vistas, setVistas] = useState<Record<string, string>>({});
  const [videos, setVideos] = useState<Record<string, string>>({});
  const [errorVideo, setErrorVideo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const pedidas = useRef(new Set<string>());
  const reintentadas = useRef(new Set<string>());
  const videosPedidos = useRef(new Set<string>());

  const porId = useMemo(() => new Map(vista.fotos.map((f) => [f.id, f])), [vista.fotos]);
  const numeros = useMemo(() => new Map(vista.fotos.map((f, i) => [f.id, i])), [vista.fotos]);
  const cuantos = useMemo(() => {
    const v = vista.fotos.filter((f) => f.tipo === "VIDEO").length;
    return { fotos: vista.fotos.length - v, videos: v };
  }, [vista.fotos]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const pedirVistas = useCallback(
    async (ids: string[]) => {
      const faltan = ids.filter((id) => !pedidas.current.has(id) && porId.get(id)?.tipo === "FOTO").slice(0, MAX_VISTAS_POR_LOTE);
      if (faltan.length === 0) return;
      faltan.forEach((id) => pedidas.current.add(id));
      try {
        const r = await vistasAction(slug, token, faltan);
        if (r.ok) setVistas((v) => ({ ...v, ...r.urls }));
        else faltan.forEach((id) => pedidas.current.delete(id));
      } catch {
        faltan.forEach((id) => pedidas.current.delete(id));
      }
    },
    [slug, token, porId],
  );
  const vistaFallida = useCallback(
    (id: string) => {
      if (reintentadas.current.has(id)) return;
      reintentadas.current.add(id);
      pedidas.current.delete(id);
      setVistas((v) => {
        const n = { ...v };
        delete n[id];
        return n;
      });
      void pedirVistas([id]);
    },
    [pedirVistas],
  );

  /** La URL del video se pide al abrirlo (dura 1 h): no se firman todos de entrada. */
  const pedirVideo = useCallback(
    async (id: string, forzar = false) => {
      if (!forzar && videosPedidos.current.has(id)) return;
      videosPedidos.current.add(id);
      setErrorVideo(null);
      try {
        const r = await reproducirVideoAction(slug, token, id);
        if (r.ok) setVideos((v) => ({ ...v, [id]: r.url }));
        else {
          videosPedidos.current.delete(id);
          setErrorVideo(r.error);
        }
      } catch {
        videosPedidos.current.delete(id);
        setErrorVideo(MENSAJES_PUBLICO.videoNoDisponible);
      }
    },
    [slug, token],
  );
  const videoFallido = useCallback(
    (id: string) => {
      // Venció la firma o se cortó: se pide una nueva, una sola vez por video.
      if (reintentadas.current.has(`v:${id}`)) {
        setErrorVideo(MENSAJES_PUBLICO.videoNoDisponible);
        return;
      }
      reintentadas.current.add(`v:${id}`);
      setVideos((v) => {
        const n = { ...v };
        delete n[id];
        return n;
      });
      void pedirVideo(id, true);
    },
    [pedirVideo],
  );

  const actual = visor ? visor.ids[visor.indice] : null;
  useEffect(() => {
    if (!visor) return;
    void pedirVistas(idsParaPrecargar(visor.ids, visor.indice));
    if (actual && porId.get(actual)?.tipo === "VIDEO") void pedirVideo(actual);
  }, [visor, actual, pedirVistas, pedirVideo, porId]);

  const abrir = useCallback(
    (id: string) => {
      const ids = vista.fotos.map((f) => f.id);
      const indice = ids.indexOf(id);
      if (indice >= 0) setVisor({ ids, indice });
    },
    [vista.fotos],
  );
  const irA = useCallback((indice: number) => setVisor((v) => (v ? { ...v, indice } : v)), []);
  const cerrarVisor = useCallback(() => setVisor(null), []);

  const descargar = useCallback(
    async (id: string) => {
      try {
        const r = await descargarOriginalAction(slug, token, id);
        if (!r.ok) return setAviso(r.error);
        const a = document.createElement("a");
        a.href = r.url;
        a.rel = "noreferrer noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {
        setAviso(MENSAJES_PUBLICO.generico);
      }
    },
    [slug, token],
  );

  const estilo = { "--fo-accent": "var(--wsite-primary, #0ea5e9)", "--fo-accent-hover": "var(--wsite-primary, #0284c7)" } as CSSProperties;
  const resumen = [
    cuantos.fotos > 0 ? (cuantos.fotos === 1 ? "1 foto" : `${cuantos.fotos.toLocaleString("es-AR")} fotos`) : null,
    cuantos.videos > 0 ? (cuantos.videos === 1 ? "1 video" : `${cuantos.videos.toLocaleString("es-AR")} videos`) : null,
  ].filter(Boolean).join(" y ");

  return (
    <div className="select-none pb-16" style={estilo}>
      {vista.portadaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vista.portadaUrl} alt="" draggable={false} onContextMenu={sinMenu} onDragStart={sinMenu} referrerPolicy="no-referrer" className="max-h-[55vh] w-full object-cover [-webkit-touch-callout:none]" />
      ) : null}

      <main className="mx-auto max-w-6xl space-y-5 px-3 py-6 md:px-6">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            {vista.organizacion.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vista.organizacion.logoUrl} alt="" className="h-10 w-auto" referrerPolicy="no-referrer" />
            ) : null}
            {vista.organizacion.nombre ? <p className="text-sm opacity-70">{vista.organizacion.nombre}</p> : null}
          </div>
          <h1 className="text-2xl font-semibold md:text-3xl">{vista.galeria.nombre}</h1>
          <p className="text-sm opacity-70">Hola, {vista.cliente.nombre}.</p>
          {vista.galeria.mensaje ? <p className="max-w-3xl whitespace-pre-line text-base">{vista.galeria.mensaje}</p> : null}
          <p className="text-sm opacity-80">
            {resumen ? `Tu entrega tiene ${resumen}. ` : ""}Tocá un archivo para verlo en grande y «Descargar» para bajarlo tal como lo subió el estudio, en alta calidad.
          </p>
          {enlaceImprimir ? <EnlacePedirCopias href={enlaceImprimir} /> : null}
        </header>

        {/* Lugar de «Recibir todo por correo» (lo conecta la descarga por correo). */}
        {slotRecibirTodo}

        {vista.fotos.length === 0 ? (
          <p className="py-10 text-center opacity-70">Esta entrega todavía no tiene archivos.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-2 md:grid-cols-5 lg:grid-cols-6" onContextMenu={sinMenu}>
            {vista.fotos.map((f) => (
              <Celda key={f.id} foto={f} numero={(numeros.get(f.id) ?? 0) + 1} onAbrir={abrir} onDescargar={descargar} />
            ))}
          </ul>
        )}
      </main>

      {visor ? (
        <VisorEntrega
          fotos={visor.ids.map((id) => porId.get(id)).filter((f): f is NonNullable<typeof f> => !!f)}
          indice={visor.indice}
          numeros={numeros}
          total={vista.fotos.length}
          vistas={vistas}
          videos={videos}
          errorVideo={errorVideo}
          onIr={irA}
          onCerrar={cerrarVisor}
          onDescargar={descargar}
          onVistaFallida={vistaFallida}
          onVideoFallido={videoFallido}
        />
      ) : null}

      {aviso ? (
        <div role="alert" className="fixed inset-x-3 top-3 z-[60] mx-auto max-w-md rounded-lg bg-red-700 px-4 py-3 text-sm text-white shadow-lg" onClick={() => setAviso(null)}>
          {aviso}
        </div>
      ) : null}
    </div>
  );
}
