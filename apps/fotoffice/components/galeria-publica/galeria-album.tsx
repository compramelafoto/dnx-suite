"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { comentarLaminaAction, decidirAlbumAction, vistasAction } from "@/app/w/[workspaceSlug]/galeria/[token]/acciones";
import type { Pin } from "@/lib/galerias/album-reglas";
import { MAX_COMENTARIO, type DecisionAlbum } from "@/lib/galerias/constantes";
import { MAX_VISTAS_POR_LOTE, MENSAJES_PUBLICO, idsParaPrecargar, type ComentarioLamina, type VistaAlbum } from "@/lib/galerias/publico-tipos";
import { AlbumVisor, Conversacion } from "./album-visor";
import { ConfirmarDecision } from "./album-decision";
import { IconoCheck } from "./iconos";

const sinMenu = (e: React.SyntheticEvent) => e.preventDefault();

/**
 * La prueba de álbum del cliente (sin sesión; el token es la llave): hojea las láminas de a una, marca puntos con
 * comentarios (pines numerados) y termina con «Aprobar el álbum» o «Pedir cambios». Sólo la ronda abierta se puede
 * comentar; las anteriores se miran en sólo lectura.
 */
export function GaleriaAlbum({ slug, token, vista }: { slug: string; token: string; vista: VistaAlbum }) {
  const [indice, setIndice] = useState(0);
  const [vistas, setVistas] = useState<Record<string, string>>({});
  const [comentarios, setComentarios] = useState<ComentarioLamina[]>(vista.comentarios);
  const [decision, setDecision] = useState(vista.decision);
  const [borrador, setBorrador] = useState<Pin | null>(null);
  const [pinAbierto, setPinAbierto] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState<DecisionAlbum | null>(null);
  const [general, setGeneral] = useState("");
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviandoGeneral, setEnviandoGeneral] = useState(false);
  const pedidas = useRef(new Set<string>());
  const reintentadas = useRef(new Set<string>());
  const [textos, setTextos] = useState<Record<string, string>>({});
  const pinesPendientes = useRef(new Map<string, Pin>());
  const tira = useRef<HTMLUListElement>(null);

  const laminas = vista.laminas;
  const total = laminas.length;
  const lamina = laminas[Math.min(indice, Math.max(0, total - 1))];
  const puedeComentar = vista.puedeComentar && !decision;
  const ids = useMemo(() => laminas.map((l) => l.id), [laminas]);

  const porLamina = useMemo(() => {
    const m = new Map<string, ComentarioLamina[]>();
    for (const c of comentarios) m.set(c.fotoId, [...(m.get(c.fotoId) ?? []), c]);
    return m;
  }, [comentarios]);
  const propios = comentarios.filter((c) => c.autor === "CLIENTE");
  const laminasConComentarios = new Set(propios.map((c) => c.fotoId)).size;
  const deEsta = lamina ? (porLamina.get(lamina.id) ?? []) : [];

  const pedirVistas = useCallback(
    async (pedir: string[]) => {
      const faltan = pedir.filter((id) => !pedidas.current.has(id)).slice(0, MAX_VISTAS_POR_LOTE);
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
    [slug, token],
  );
  const vistaFallida = useCallback(
    (id: string) => {
      // Venció la firma o se cortó: se pide una nueva, una sola vez por lámina.
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
  useEffect(() => {
    void pedirVistas(idsParaPrecargar(ids, indice));
  }, [ids, indice, pedirVistas]);

  const cerrarCaja = useCallback(() => {
    setBorrador(null);
    setPinAbierto(null);
  }, []);
  /** Descarta el borrador de la lámina actual (se canceló o se guardó). */
  const descartarBorrador = useCallback(() => {
    if (lamina) {
      setTextos((t) => {
        const n = { ...t };
        delete n[lamina.id];
        return n;
      });
      pinesPendientes.current.delete(lamina.id);
    }
    cerrarCaja();
  }, [lamina, cerrarCaja]);
  const irA = useCallback(
    (i: number) => {
      if (i < 0 || i >= total) return;
      // Un borrador a medias se guarda para cuando vuelva a esa lámina.
      if (lamina && borrador) pinesPendientes.current.set(lamina.id, borrador);
      setIndice(i);
      setPinAbierto(null);
      setBorrador(pinesPendientes.current.get(laminas[i]!.id) ?? null);
      setGeneral("");
      setErrorGeneral(null);
    },
    [total, lamina, borrador, laminas],
  );

  // Teclado: flechas para hojear, Escape para cerrar la cajita. Si se está escribiendo o hay una pantalla encima, no.
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (confirmando) return;
      const t = e.target as HTMLElement | null;
      const escribiendo = t?.tagName === "TEXTAREA" || t?.tagName === "INPUT" || t?.tagName === "SELECT" || t?.isContentEditable;
      if (e.key === "Escape") descartarBorrador();
      else if (escribiendo) return;
      else if (e.key === "ArrowLeft") irA(indice - 1);
      else if (e.key === "ArrowRight") irA(indice + 1);
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [confirmando, descartarBorrador, irA, indice]);

  // La tira de miniaturas lleva la lámina actual al centro (sin mover la página).
  useEffect(() => {
    const ul = tira.current;
    const li = ul?.children[indice] as HTMLElement | undefined;
    if (ul && li) ul.scrollTo({ left: li.offsetLeft - ul.clientWidth / 2 + li.clientWidth / 2, behavior: "smooth" });
  }, [indice]);

  async function comentar(texto: string, pin: Pin | null): Promise<string | null> {
    if (!lamina) return MENSAJES_PUBLICO.generico;
    try {
      const r = await comentarLaminaAction(slug, token, lamina.id, texto, pin);
      if (!r.ok) return r.error;
      setComentarios((c) => [...c, r.comentario]);
      return null;
    } catch {
      return MENSAJES_PUBLICO.generico;
    }
  }
  async function comentarConPin(texto: string, pin: Pin): Promise<string | null> {
    const e = await comentar(texto, pin);
    if (!e) descartarBorrador();
    return e;
  }
  async function comentarGeneral() {
    if (enviandoGeneral) return;
    if (!general.trim()) return setErrorGeneral("Escribí el comentario.");
    setEnviandoGeneral(true);
    setErrorGeneral(null);
    const e = await comentar(general, null);
    setEnviandoGeneral(false);
    if (e) setErrorGeneral(e);
    else setGeneral("");
  }
  async function confirmar(mensaje: string): Promise<string | null> {
    if (!confirmando) return null;
    try {
      const r = await decidirAlbumAction(slug, token, confirmando, mensaje);
      if (!r.ok) return r.error;
      setDecision({ decision: r.decision, mensaje: mensaje.trim() || null, fecha: r.fecha });
      setConfirmando(null);
      cerrarCaja();
      return null;
    } catch {
      return MENSAJES_PUBLICO.generico;
    }
  }

  const estilo = { "--fo-accent": "var(--wsite-primary, #0ea5e9)", "--fo-accent-hover": "var(--wsite-primary, #0284c7)" } as CSSProperties;
  const ultima = vista.rondas[vista.rondas.length - 1]?.numero ?? vista.ronda.numero;
  const mirandoVieja = vista.ronda.estado === "CERRADA";

  return (
    <div className="select-none pb-28" style={estilo}>
      <main className="mx-auto max-w-5xl space-y-4 px-3 py-5 md:px-6">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            {vista.organizacion.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vista.organizacion.logoUrl} alt="" className="h-10 w-auto" referrerPolicy="no-referrer" />
            ) : null}
            {vista.organizacion.nombre ? <p className="text-sm opacity-70">{vista.organizacion.nombre}</p> : null}
          </div>
          <h1 className="text-2xl font-semibold md:text-3xl">{vista.galeria.nombre}</h1>
          <p className="text-sm opacity-70">
            Hola, {vista.cliente.nombre}. Ronda {vista.ronda.numero}
            {mirandoVieja ? " (cerrada)" : ""}.
          </p>
          {vista.galeria.mensaje ? <p className="max-w-3xl whitespace-pre-line text-base">{vista.galeria.mensaje}</p> : null}
        </header>

        {vista.rondas.length > 1 ? (
          <nav aria-label="Rondas" className="flex flex-wrap gap-2">
            {vista.rondas.map((r) => (
              <a
                key={r.numero}
                href={`?ronda=${r.numero}`}
                aria-current={r.numero === vista.ronda.numero ? "page" : undefined}
                className={`rounded-full border px-3 py-1.5 text-sm ${r.numero === vista.ronda.numero ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white" : "border-neutral-300"}`}
              >
                Ronda {r.numero}
                {r.numero === ultima && r.estado === "ABIERTA" ? " · actual" : ""}
              </a>
            ))}
          </nav>
        ) : null}

        {vista.ronda.nota ? (
          <section className="rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-neutral-900">
            <p className="text-xs font-medium uppercase tracking-wide opacity-60">Nota del estudio</p>
            <p className="whitespace-pre-line text-base">{vista.ronda.nota}</p>
          </section>
        ) : null}

        {mirandoVieja ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Estás mirando una ronda anterior: la podés revisar, pero ya no se puede comentar. <a className="font-medium underline" href={`?ronda=${ultima}`}>Ir a la ronda actual</a>
          </p>
        ) : decision ? (
          <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <IconoCheck className="mt-0.5 shrink-0" width={18} height={18} />
            <span>
              Enviaste tu decisión el {decision.fecha}: {decision.decision === "APROBADO" ? "aprobaste el álbum" : "pediste cambios"}. El estudio ya la recibió.
              {decision.mensaje ? <span className="mt-1 block whitespace-pre-line opacity-80">Tu mensaje: {decision.mensaje}</span> : null}
            </span>
          </p>
        ) : !puedeComentar ? (
          <p className="rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-800">Esta ronda ya no se puede modificar.</p>
        ) : (
          <p className="text-sm opacity-80">Tocá la lámina en el punto que quieras comentar. Cuando termines, aprobá el álbum o pedí cambios.</p>
        )}

        {total === 0 || !lamina ? (
          <p className="py-10 text-center opacity-70">Esta ronda todavía no tiene láminas.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-medium tabular-nums" aria-live="polite">
                Lámina {indice + 1} de {total}
              </p>
              {propios.length > 0 ? <p className="text-sm opacity-70">{propios.length === 1 ? "1 comentario tuyo" : `${propios.length.toLocaleString("es-AR")} comentarios tuyos`}</p> : null}
            </div>
            <AlbumVisor
              lamina={lamina}
              indice={indice}
              total={total}
              vistaUrl={vistas[lamina.id]}
              comentarios={deEsta}
              nombreEstudio={vista.organizacion.nombre}
              puedeComentar={puedeComentar}
              borrador={borrador}
              pinAbierto={pinAbierto}
              onToque={(p) => {
                setPinAbierto(null);
                setBorrador(p);
              }}
              onCerrarCaja={descartarBorrador}
              textoBorrador={lamina ? (textos[lamina.id] ?? "") : ""}
              onTextoBorrador={(t) => lamina && setTextos((x) => ({ ...x, [lamina.id]: t }))}
              onAbrirPin={(n) => {
                setBorrador(null);
                setPinAbierto((a) => (a === n ? null : n));
              }}
              onIr={irA}
              onVistaFallida={vistaFallida}
              onComentarPin={comentarConPin}
            />

            <ul ref={tira} className="flex gap-2 overflow-x-auto pb-1" aria-label="Todas las láminas" onContextMenu={sinMenu}>
              {laminas.map((l, i) => {
                const n = porLamina.get(l.id)?.length ?? 0;
                return (
                  <li key={l.id} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => irA(i)}
                      aria-label={`Ir a la lámina ${i + 1}${n > 0 ? `, con ${n} ${n === 1 ? "comentario" : "comentarios"}` : ""}`}
                      aria-current={i === indice ? "true" : undefined}
                      className={`block h-16 w-16 overflow-hidden rounded-md bg-neutral-200 [content-visibility:auto] ${i === indice ? "ring-2 ring-[var(--fo-accent)] ring-offset-2" : "opacity-80"}`}
                    >
                      {l.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.thumbUrl} alt="" loading="lazy" draggable={false} referrerPolicy="no-referrer" onContextMenu={sinMenu} className="h-full w-full select-none object-contain [-webkit-touch-callout:none]" />
                      ) : (
                        <span className="text-xs opacity-60">{i + 1}</span>
                      )}
                    </button>
                    {n > 0 ? <span className="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--fo-accent)] px-1 text-xs font-semibold text-white">{n}</span> : null}
                  </li>
                );
              })}
            </ul>

            <section aria-label="Comentarios de esta lámina" className="space-y-3">
              <h2 className="text-lg font-semibold">Comentarios de la lámina {indice + 1}</h2>
              {deEsta.length === 0 ? (
                <p className="text-sm opacity-70">{puedeComentar ? "Todavía no comentaste esta lámina." : "No hay comentarios en esta lámina."}</p>
              ) : (
                <div className="space-y-2">
                  {pinesYGenerales(deEsta).map((g) => (
                    <div key={g.clave} className="flex items-start gap-2">
                      {g.numero !== null ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBorrador(null);
                            setPinAbierto(g.numero);
                          }}
                          aria-label={`Ver el punto ${g.numero} en la lámina`}
                          className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent)] text-sm font-semibold text-white"
                        >
                          {g.numero}
                        </button>
                      ) : (
                        <span className="mt-2 h-7 w-7 shrink-0 rounded-full border border-dashed border-neutral-400" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <Conversacion comentarios={g.comentarios} nombreEstudio={vista.organizacion.nombre} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {puedeComentar ? (
                <div className="space-y-2">
                  <label htmlFor="album-comentario-general" className="block text-sm font-medium">
                    Comentario general de esta lámina
                  </label>
                  <textarea
                    id="album-comentario-general"
                    value={general}
                    onChange={(e) => setGeneral(e.target.value)}
                    maxLength={MAX_COMENTARIO}
                    rows={2}
                    placeholder="Algo que no está en un punto en particular."
                    className="w-full resize-y rounded-md border border-neutral-300 p-2 text-base text-neutral-900"
                  />
                  {errorGeneral ? <p role="alert" className="text-sm text-red-700">{errorGeneral}</p> : null}
                  <button type="button" onClick={comentarGeneral} disabled={enviandoGeneral} className="fo-btn fo-btn-secondary">
                    {enviandoGeneral ? "Guardando…" : "Dejar comentario"}
                  </button>
                </div>
              ) : null}
            </section>
          </>
        )}
      </main>

      {puedeComentar && total > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-300 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-neutral-900 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              {propios.length === 0 ? "Todavía no dejaste comentarios." : `${propios.length === 1 ? "1 comentario" : `${propios.length.toLocaleString("es-AR")} comentarios`} en ${laminasConComentarios === 1 ? "1 lámina" : `${laminasConComentarios.toLocaleString("es-AR")} láminas`}.`}
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <button type="button" onClick={() => setConfirmando("CAMBIOS")} className="fo-btn fo-btn-secondary flex-1 sm:flex-none">
                Pedir cambios
              </button>
              <button type="button" onClick={() => setConfirmando("APROBADO")} className="fo-btn fo-btn-primary flex-1 sm:flex-none">
                Aprobar el álbum
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmando ? (
        <ConfirmarDecision decision={confirmando} comentarios={propios.length} laminasConComentarios={laminasConComentarios} onConfirmar={confirmar} onVolver={() => setConfirmando(null)} />
      ) : null}

    </div>
  );
}

/** Agrupa los comentarios de una lámina: una conversación por pin (cliente + respuestas del estudio) y los generales sueltos. */
function pinesYGenerales(comentarios: readonly ComentarioLamina[]): { clave: string; numero: number | null; comentarios: ComentarioLamina[] }[] {
  const salida: { clave: string; numero: number | null; comentarios: ComentarioLamina[] }[] = [];
  const porPin = new Map<number, { clave: string; numero: number | null; comentarios: ComentarioLamina[] }>();
  for (const c of comentarios) {
    if (c.pinNumber === null) {
      salida.push({ clave: c.id, numero: null, comentarios: [c] });
      continue;
    }
    const g = porPin.get(c.pinNumber);
    if (g) g.comentarios.push(c);
    else {
      const nuevo = { clave: `pin-${c.pinNumber}`, numero: c.pinNumber, comentarios: [c] };
      porPin.set(c.pinNumber, nuevo);
      salida.push(nuevo);
    }
  }
  return salida;
}
