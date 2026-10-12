"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { puntoRelativo, rectDeImagenContenida, type Pin } from "@/lib/galerias/album-reglas";
import { direccionDeDeslizar, ubicarCaja } from "@/lib/galerias/album-gestos";
import { MAX_COMENTARIO } from "@/lib/galerias/constantes";
import type { ComentarioLamina, LaminaPublica } from "@/lib/galerias/publico-tipos";
import { IconoCerrar, IconoFlechaDer, IconoFlechaIzq } from "./iconos";

const sinMenu = (e: React.SyntheticEvent) => e.preventDefault();

/** Los pines de una lámina: uno por número, con la posición del primer comentario que lo marcó. */
export function pinesDeLamina(comentarios: readonly ComentarioLamina[]): { numero: number; x: number; y: number }[] {
  const m = new Map<number, { numero: number; x: number; y: number }>();
  for (const c of comentarios) {
    if (c.pinNumber !== null && c.pinX !== null && c.pinY !== null && !m.has(c.pinNumber)) m.set(c.pinNumber, { numero: c.pinNumber, x: c.pinX, y: c.pinY });
  }
  return [...m.values()].sort((a, b) => a.numero - b.numero);
}

/** El número que va a tener el próximo pin de esta lámina (el servidor lo vuelve a calcular). */
export function proximoPin(comentarios: readonly ComentarioLamina[]): number {
  return pinesDeLamina(comentarios).reduce((mx, p) => Math.max(mx, p.numero), 0) + 1;
}

export function Conversacion({ comentarios, nombreEstudio }: { comentarios: readonly ComentarioLamina[]; nombreEstudio: string }) {
  return (
    <ul className="space-y-2">
      {comentarios.map((c) => (
        <li key={c.id} className={`rounded-lg px-3 py-2 text-sm ${c.autor === "ESTUDIO" ? "bg-sky-50 text-neutral-900" : "bg-neutral-100 text-neutral-900"}`}>
          <p className="text-xs font-medium opacity-70">
            {c.autor === "ESTUDIO" ? nombreEstudio || "El estudio" : "Vos"} · {c.fecha}
          </p>
          <p className="whitespace-pre-line break-words">{c.texto}</p>
        </li>
      ))}
    </ul>
  );
}

type PropsVisor = {
  lamina: LaminaPublica;
  indice: number;
  total: number;
  vistaUrl: string | undefined;
  comentarios: readonly ComentarioLamina[];
  nombreEstudio: string;
  puedeComentar: boolean;
  borrador: Pin | null;
  pinAbierto: number | null;
  onToque: (p: Pin) => void;
  onCerrarCaja: () => void;
  onAbrirPin: (n: number) => void;
  onIr: (indice: number) => void;
  onVistaFallida: (id: string) => void;
  /** Guarda el comentario con pin; devuelve el error o null si salió bien. */
  onComentarPin: (texto: string, pin: Pin) => Promise<string | null>;
  /** Lo que ya había escrito en el borrador de esta lámina, y aviso de cada cambio (para no perderlo al hojear). */
  textoBorrador: string;
  onTextoBorrador: (t: string) => void;
};

/**
 * La lámina en grande, una por vez, con sus pines encima. Los pines se miden contra la imagen REAL dibujada (con
 * `object-fit: contain` sobran bandas arriba/abajo o a los costados): un toque en la banda no marca nada.
 */
export function AlbumVisor(p: PropsVisor) {
  const caja = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ x: number; y: number; enCaja: boolean } | null>(null);
  const ultimoDeslizar = useRef(0);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState<{ id: string; w: number; h: number } | null>(null);
  const [cargada, setCargada] = useState<string | null>(null);
  const { lamina } = p;

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nat = natural?.id === lamina.id ? natural : null;
  const rect = useMemo(() => rectDeImagenContenida(tam.w, tam.h, nat?.w ?? lamina.width ?? 0, nat?.h ?? lamina.height ?? 0), [tam, nat, lamina.width, lamina.height]);
  const pines = useMemo(() => pinesDeLamina(p.comentarios), [p.comentarios]);
  const enPantalla = (x: number, y: number) => (rect ? { left: rect.left + x * rect.width, top: rect.top + y * rect.height } : null);

  function tocar(e: React.MouseEvent) {
    if (!p.puedeComentar || !rect || !caja.current) return;
    if (Date.now() - ultimoDeslizar.current < 400) return;
    if ((e.target as HTMLElement).closest("[data-no-toque]")) return;
    const b = caja.current.getBoundingClientRect();
    const punto = puntoRelativo(e.clientX - b.left, e.clientY - b.top, rect);
    if (punto) p.onToque(punto);
    else p.onCerrarCaja();
  }
  function empezar(e: React.TouchEvent) {
    inicio.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, enCaja: !!(e.target as HTMLElement).closest("[data-no-toque]") } : null;
  }
  function terminar(e: React.TouchEvent) {
    const i = inicio.current;
    inicio.current = null;
    if (!i || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - i.x;
    const dy = e.changedTouches[0].clientY - i.y;
    const dir = direccionDeDeslizar(dx, dy, p.borrador !== null || p.pinAbierto !== null, i.enCaja);
    if (dir === 0) return;
    ultimoDeslizar.current = Date.now();
    const destino = p.indice + dir;
    if (destino >= 0 && destino < p.total) p.onIr(destino);
  }

  // La cajita de comentario se ancla al punto: debajo si el punto está en la parte de arriba, encima si no.
  const ancla = p.borrador ? enPantalla(p.borrador.x, p.borrador.y) : p.pinAbierto !== null ? (() => {
    const pin = pines.find((x) => x.numero === p.pinAbierto);
    return pin ? enPantalla(pin.x, pin.y) : null;
  })() : null;
  // En pantallas angostas la cajita es una hoja pegada al borde de abajo: nunca queda cortada.
  const estiloCaja: React.CSSProperties | null = ancla ? (ubicarCaja(tam.w, tam.h, ancla) ?? { left: 4, right: 4, bottom: 4 }) : null;
  const hiloAbierto = p.pinAbierto !== null ? p.comentarios.filter((c) => c.pinNumber === p.pinAbierto) : [];

  return (
    <div
      ref={caja}
      className={`relative h-[62dvh] min-h-[300px] w-full overflow-hidden rounded-xl bg-neutral-900 md:h-[70dvh] ${p.puedeComentar ? "cursor-crosshair" : ""}`}
      onClick={tocar}
      onTouchStart={empezar}
      onTouchEnd={terminar}
      onContextMenu={sinMenu}
      aria-label={`Lámina ${p.indice + 1} de ${p.total}`}
    >
      <div key={lamina.id} className="absolute inset-0">
        {lamina.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lamina.thumbUrl} alt="" draggable={false} referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-contain opacity-80 blur-sm" />
        ) : null}
        {p.vistaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.vistaUrl}
            alt={`Lámina ${p.indice + 1}`}
            draggable={false}
            referrerPolicy="no-referrer"
            onContextMenu={sinMenu}
            onDragStart={sinMenu}
            onLoad={(e) => {
              setNatural({ id: lamina.id, w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
              setCargada(lamina.id);
            }}
            onError={() => p.onVistaFallida(lamina.id)}
            className={`absolute inset-0 h-full w-full select-none object-contain transition-opacity duration-200 [-webkit-touch-callout:none] ${cargada === lamina.id ? "opacity-100" : "opacity-0"}`}
          />
        ) : null}
        {!p.vistaUrl || cargada !== lamina.id ? <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">Cargando la lámina…</p> : null}
      </div>

      {/* Pines ya dejados */}
      {pines.map((pin) => {
        const pos = enPantalla(pin.x, pin.y);
        if (!pos) return null;
        const abierto = p.pinAbierto === pin.numero;
        return (
          <button
            key={pin.numero}
            type="button"
            data-no-toque
            onClick={(e) => {
              e.stopPropagation();
              p.onAbrirPin(pin.numero);
            }}
            aria-label={`Ver el comentario ${pin.numero}`}
            aria-expanded={abierto}
            style={{ left: pos.left, top: pos.top }}
            className={`absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-semibold shadow-lg ${abierto ? "border-white bg-white text-neutral-900" : "border-white bg-[var(--fo-accent)] text-white"}`}
          >
            {pin.numero}
          </button>
        );
      })}
      {/* Pin que se está por dejar */}
      {p.borrador ? (() => {
        const pos = enPantalla(p.borrador.x, p.borrador.y);
        return pos ? (
          <span
            data-no-toque
            style={{ left: pos.left, top: pos.top }}
            className="pointer-events-none absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed border-white bg-[var(--fo-accent)]/80 text-sm font-semibold text-white shadow-lg"
          >
            {proximoPin(p.comentarios)}
          </span>
        ) : null;
      })() : null}

      {/* Cajita anclada al punto */}
      {estiloCaja && p.borrador ? (
        <CajaNueva key={`${lamina.id}`} estilo={estiloCaja} textoInicial={p.textoBorrador} onTexto={p.onTextoBorrador} numero={proximoPin(p.comentarios)} onCancelar={p.onCerrarCaja} onGuardar={(t) => p.onComentarPin(t, p.borrador!)} />
      ) : null}
      {estiloCaja && !p.borrador && p.pinAbierto !== null ? (
        <div data-no-toque style={estiloCaja} className="absolute z-20 max-h-[85%] cursor-default overflow-y-auto rounded-xl bg-white p-3 text-neutral-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Comentario {p.pinAbierto}</p>
            <button type="button" onClick={p.onCerrarCaja} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100">
              <IconoCerrar width={18} height={18} />
            </button>
          </div>
          <Conversacion comentarios={hiloAbierto} nombreEstudio={p.nombreEstudio} />
        </div>
      ) : null}

      {p.indice > 0 ? (
        <button type="button" data-no-toque onClick={(e) => { e.stopPropagation(); p.onIr(p.indice - 1); }} aria-label="Lámina anterior" className="absolute left-1 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65">
          <IconoFlechaIzq width={28} height={28} />
        </button>
      ) : null}
      {p.indice < p.total - 1 ? (
        <button type="button" data-no-toque onClick={(e) => { e.stopPropagation(); p.onIr(p.indice + 1); }} aria-label="Lámina siguiente" className="absolute right-1 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65">
          <IconoFlechaDer width={28} height={28} />
        </button>
      ) : null}
    </div>
  );
}

function CajaNueva({ estilo, numero, textoInicial, onTexto, onCancelar, onGuardar }: { estilo: React.CSSProperties; numero: number; textoInicial: string; onTexto: (t: string) => void; onCancelar: () => void; onGuardar: (texto: string) => Promise<string | null> }) {
  const [texto, setTexto] = useState(textoInicial);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  useEffect(() => campo.current?.focus(), []);
  async function guardar() {
    if (enviando) return;
    if (!texto.trim()) return setError("Escribí el comentario.");
    setEnviando(true);
    setError(null);
    const e = await onGuardar(texto);
    setEnviando(false);
    if (e) setError(e);
  }
  return (
    <div data-no-toque style={estilo} className="absolute z-20 max-h-[90%] cursor-default overflow-y-auto rounded-xl bg-white p-3 text-neutral-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <label htmlFor="album-comentario-pin" className="mb-1 block text-sm font-semibold">
        Comentario {numero}
      </label>
      <textarea
        id="album-comentario-pin"
        ref={campo}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          onTexto(e.target.value);
        }}
        maxLength={MAX_COMENTARIO}
        rows={3}
        placeholder="¿Qué querés cambiar en este punto?"
        className="w-full resize-none rounded-md border border-neutral-300 p-2 text-base text-neutral-900"
      />
      {error ? <p role="alert" className="mt-1 text-sm text-red-700">{error}</p> : null}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="fo-btn fo-btn-secondary">
          Cancelar
        </button>
        <button type="button" onClick={guardar} disabled={enviando} className="fo-btn fo-btn-primary">
          {enviando ? "Guardando…" : "Dejar comentario"}
        </button>
      </div>
    </div>
  );
}
