"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { finalizarAlbumAction, reactivarAlbumAction, responderLaminaAlbumAction, vistasPorIdsAction } from "@/app/actions/galerias";
import { rectDeImagenContenida } from "@/lib/galerias/album-reglas";
import { ETIQUETA_DECISION_ALBUM, ETIQUETA_ESTADO_CLIENTE, MAX_COMENTARIO, type EstadoCliente } from "@/lib/galerias/constantes";
import { fechaHoraBA } from "@/lib/ficha/formato";
import type { ComentarioAlbum, DecisionVista, LaminaRevision } from "@/lib/galerias/revision-album";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

const CLASE_ESTADO: Record<EstadoCliente, string> = {
  EN_PROGRESO: "bg-blue-100 text-blue-800",
  EN_REVISION: "bg-violet-100 text-violet-800",
  FINALIZADO: "bg-green-100 text-green-800",
};

export type DatosRevisionAlbum = {
  galeriaId: string;
  clienteId: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  estado: EstadoCliente;
  anulado: boolean;
  primeraVez: string | null;
  enviadoEn: string | null;
  finalizadoEn: string | null;
  reactivadoEn: string | null;
  rondas: { id: string; numero: number; estado: "ABIERTA" | "CERRADA" }[];
  ronda: { id: string; numero: number; estado: "ABIERTA" | "CERRADA"; nota: string | null };
  laminas: LaminaRevision[];
  decision: DecisionVista | null;
  historial: DecisionVista[];
  respuestasDelEstudio: number;
  laminaInicial: string | null;
};

type Hilo = { clave: string; pinNumber: number | null; comentarios: ComentarioAlbum[] };

/** Los hilos de una lámina: uno por número de pin y, aparte, el de los comentarios generales (sin pin). */
export function hilosDeLamina(comentarios: readonly ComentarioAlbum[]): Hilo[] {
  const porPin = new Map<number, ComentarioAlbum[]>();
  const generales: ComentarioAlbum[] = [];
  for (const c of comentarios) {
    if (c.pinNumber === null) generales.push(c);
    else porPin.set(c.pinNumber, [...(porPin.get(c.pinNumber) ?? []), c]);
  }
  const hilos: Hilo[] = [...porPin.entries()].sort((a, b) => a[0] - b[0]).map(([n, cs]) => ({ clave: `pin-${n}`, pinNumber: n, comentarios: cs }));
  if (generales.length > 0) hilos.push({ clave: "general", pinNumber: null, comentarios: generales });
  return hilos;
}

/** Posición de cada pin de la lámina: el primer comentario del cliente que lo marcó. */
export function pinesDe(comentarios: readonly ComentarioAlbum[]): { numero: number; x: number; y: number }[] {
  const m = new Map<number, { numero: number; x: number; y: number }>();
  for (const c of comentarios) {
    if (c.pinNumber !== null && c.pinX !== null && c.pinY !== null && !m.has(c.pinNumber)) m.set(c.pinNumber, { numero: c.pinNumber, x: c.pinX, y: c.pinY });
  }
  return [...m.values()].sort((a, b) => a.numero - b.numero);
}

function HiloVista({
  hilo, activo, laminaId, d, puedeResponder, alResponder,
}: {
  hilo: Hilo;
  activo: boolean;
  laminaId: string;
  d: DatosRevisionAlbum;
  puedeResponder: boolean;
  alResponder: (c: ComentarioAlbum) => void;
}) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const id = `responder-${laminaId}-${hilo.clave}`;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await responderLaminaAlbumAction(d.galeriaId, d.clienteId, laminaId, hilo.pinNumber, texto).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      alResponder(r.comentario);
      setTexto("");
    });
  }

  return (
    <div className={`space-y-2 rounded-lg border p-3 ${activo ? "border-[var(--fo-accent,#1d4ed8)] ring-1 ring-[var(--fo-accent,#1d4ed8)]" : "border-[var(--fo-border)]"}`}>
      <p className="text-xs font-semibold text-[var(--fo-muted)]">{hilo.pinNumber === null ? "Comentarios generales de la lámina" : `Punto ${hilo.pinNumber}`}</p>
      <ul className="space-y-2" aria-label={hilo.pinNumber === null ? "Conversación general" : `Conversación del punto ${hilo.pinNumber}`}>
        {hilo.comentarios.map((c) => (
          <li key={c.id} className={`rounded-lg px-3 py-2 text-sm ${c.autor === "ESTUDIO" ? "ml-6 bg-[var(--fo-surface-muted)]" : "mr-6 border border-[var(--fo-border)]"}`}>
            <p className="text-xs text-[var(--fo-muted)]">
              {c.autor === "ESTUDIO" ? `${c.nombreAutor} (estudio)` : c.nombreAutor} · <time dateTime={c.fecha}>{fechaHoraBA(c.fecha)}</time>
            </p>
            <p className="whitespace-pre-wrap break-words text-[var(--fo-text)]">{c.texto}</p>
          </li>
        ))}
      </ul>
      {puedeResponder && hilo.comentarios.some((c) => c.autor === "CLIENTE") ? (
        <form onSubmit={enviar} className="space-y-2">
          <label className="text-xs font-medium text-[var(--fo-muted)]" htmlFor={id}>
            Responder
          </label>
          <textarea id={id} className="fo-input w-full" rows={2} maxLength={MAX_COMENTARIO} value={texto} onChange={(e) => setTexto(e.target.value)} disabled={pendiente} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--fo-muted)]">
              {texto.length.toLocaleString("es-AR")} / {MAX_COMENTARIO.toLocaleString("es-AR")}
            </span>
            <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || texto.trim() === ""}>
              Responder
            </button>
          </div>
          <div aria-live="polite">
            {error ? (
              <p role="alert" className="text-sm text-[var(--fo-danger)]">
                {error}
              </p>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}

/** La lámina en grande con los puntos del cliente encima, medidos contra la imagen REAL dibujada. */
function LaminaConPines({ lamina, url, pinActivo, alElegirPin }: { lamina: LaminaRevision; url: string | null; pinActivo: number | null; alElegirPin: (n: number) => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState<{ id: string; w: number; h: number } | null>(null);

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
  const rect = useMemo(() => rectDeImagenContenida(tam.w, tam.h, nat?.w ?? lamina.ancho ?? 0, nat?.h ?? lamina.alto ?? 0), [tam, nat, lamina.ancho, lamina.alto]);
  const pines = useMemo(() => pinesDe(lamina.comentarios), [lamina.comentarios]);
  const src = url ?? lamina.thumbUrl;

  return (
    <div ref={caja} className="relative h-[60vh] min-h-[260px] w-full overflow-hidden rounded-lg bg-neutral-900">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={lamina.fileName}
          className="absolute inset-0 h-full w-full object-contain"
          onLoad={(e) => setNatural({ id: lamina.id, w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
      ) : null}
      {rect
        ? pines.map((p) => (
            <button
              key={p.numero}
              type="button"
              aria-label={`Punto ${p.numero}`}
              aria-pressed={pinActivo === p.numero}
              onClick={() => alElegirPin(p.numero)}
              style={{ left: rect.left + p.x * rect.width, top: rect.top + p.y * rect.height }}
              className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow ${pinActivo === p.numero ? "bg-blue-600" : "bg-rose-600"}`}
            >
              {p.numero}
            </button>
          ))
        : null}
    </div>
  );
}

/**
 * Revisión de la prueba de álbum de un cliente: ronda, decisión (con el historial de rondas), las láminas con sus
 * puntos dibujados encima, la conversación de cada punto con "Responder", y finalizar / reactivar con confirmación.
 * El servidor vuelve a decidir permisos y estados en cada acción.
 */
export function RevisionAlbum({ d, puedeGestionar }: { d: DatosRevisionAlbum; puedeGestionar: boolean }) {
  const router = useRouter();
  const [laminas, setLaminas] = useState(d.laminas);
  const [abiertaId, setAbiertaId] = useState<string | null>(d.laminaInicial && d.laminas.some((l) => l.id === d.laminaInicial) ? d.laminaInicial : (d.laminas[0]?.id ?? null));
  const [soloConComentarios, setSoloConComentarios] = useState(false);
  const [pinActivo, setPinActivo] = useState<number | null>(null);
  const [grande, setGrande] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const rondaAbierta = d.ronda.estado === "ABIERTA";
  const abierta = laminas.find((l) => l.id === abiertaId) ?? null;
  const conComentarios = laminas.filter((l) => l.comentarios.length > 0).length;
  const lista = soloConComentarios ? laminas.filter((l) => l.comentarios.length > 0) : laminas;
  const puedeResponder = puedeGestionar && rondaAbierta;
  const puedeFinalizar = puedeGestionar && rondaAbierta && d.estado === "EN_REVISION" && d.decision?.decision === "APROBADO";
  const puedeReactivar = puedeGestionar && rondaAbierta && (d.estado === "EN_REVISION" || d.estado === "FINALIZADO") && !d.anulado;
  const hilos = abierta ? hilosDeLamina(abierta.comentarios) : [];

  useEffect(() => {
    if (!abiertaId || grande[abiertaId] !== undefined) return;
    const id = abiertaId;
    const mini = laminas.find((l) => l.id === id)?.thumbUrl ?? null;
    setGrande((g) => ({ ...g, [id]: null }));
    vistasPorIdsAction(d.galeriaId, [id])
      .then((r) => setGrande((g) => ({ ...g, [id]: (r.ok ? r.vistas[id] : null) ?? mini })))
      .catch(() => setGrande((g) => ({ ...g, [id]: mini })));
    // Sólo cuando cambia la lámina que se mira.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abiertaId]);

  function abrir(l: LaminaRevision) {
    setAbiertaId(l.id);
    setPinActivo(null);
  }

  function transicion(tipo: "finalizar" | "reactivar") {
    const texto =
      tipo === "finalizar"
        ? `¿Finalizar la prueba de ${d.nombre}? Queda cerrada: el cliente ya no puede cambiar su decisión.`
        : `¿Devolverle la prueba a ${d.nombre}? Va a poder comentar y decidir de nuevo en la ronda ${d.ronda.numero}; su decisión actual se borra, sus comentarios se conservan. No le mandamos ningún correo: si querés avisarle, reenviale el enlace desde la pestaña Clientes.`;
    if (!window.confirm(texto)) return;
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const accion = tipo === "finalizar" ? finalizarAlbumAction : reactivarAlbumAction;
      const r = await accion(d.galeriaId, d.clienteId).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      setAviso(tipo === "finalizar" ? "Listo: la prueba quedó finalizada." : "Listo: el cliente puede comentar y decidir de nuevo.");
      router.refresh();
    });
  }

  function agregarRespuesta(c: ComentarioAlbum) {
    setLaminas((ls) => ls.map((l) => (l.id === c.laminaId ? { ...l, comentarios: [...l.comentarios, c] } : l)));
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="estado-cliente-titulo" className="fo-card space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id="estado-cliente-titulo" className="text-lg font-semibold text-[var(--fo-text)]">
              {d.nombre}
            </h2>
            <p className="break-all text-xs text-[var(--fo-muted)]">{[d.email, d.telefono].filter(Boolean).join(" · ") || "Sin correo ni teléfono"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {d.anulado ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Enlace anulado</span> : null}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASE_ESTADO[d.estado]}`}>{ETIQUETA_ESTADO_CLIENTE[d.estado]}</span>
          </div>
        </div>

        <nav aria-label="Rondas del álbum">
          <ul className="flex flex-wrap gap-2">
            {d.rondas.map((r) => (
              <li key={r.id}>
                <Link
                  href={`?ronda=${r.numero}`}
                  aria-current={r.id === d.ronda.id ? "page" : undefined}
                  className={`fo-btn text-xs ${r.id === d.ronda.id ? "fo-btn-primary" : "fo-btn-secondary"}`}
                >
                  Ronda {r.numero}
                  {r.estado === "CERRADA" ? " (cerrada)" : ""}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {d.ronda.nota ? (
          <blockquote className="whitespace-pre-wrap break-words rounded-lg bg-[var(--fo-surface-muted)] px-3 py-2 text-sm">
            <span className="block text-xs text-[var(--fo-muted)]">Nota del estudio para la ronda {d.ronda.numero}</span>
            {d.ronda.nota}
          </blockquote>
        ) : null}
        {!rondaAbierta ? <p className="text-sm text-[var(--fo-muted)]">Esta ronda está cerrada: se puede mirar, pero no se responde ni se cambia.</p> : null}

        <div className="rounded-lg border border-[var(--fo-border)] px-3 py-2 text-sm" aria-label={`Decisión de la ronda ${d.ronda.numero}`}>
          {d.decision ? (
            <>
              <p className="font-medium">
                <span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${d.decision.decision === "APROBADO" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  {ETIQUETA_DECISION_ALBUM[d.decision.decision]}
                </span>
                <time dateTime={d.decision.fecha} className="text-xs font-normal text-[var(--fo-muted)]">
                  {fechaHoraBA(d.decision.fecha)}
                </time>
              </p>
              {d.decision.mensaje ? <p className="mt-1 whitespace-pre-wrap break-words">{d.decision.mensaje}</p> : null}
            </>
          ) : (
            <p className="text-[var(--fo-muted)]">{d.anulado ? "El enlace está anulado." : "Todavía no decidió sobre esta ronda."}</p>
          )}
        </div>

        {d.historial.length > 0 ? (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">Decisiones por ronda</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {d.historial.map((h) => (
                <li key={h.rondaId}>
                  <Link href={`?ronda=${h.rondaNumero}`} className="font-medium text-[var(--fo-accent)] hover:underline">
                    Ronda {h.rondaNumero}
                  </Link>
                  : {ETIQUETA_DECISION_ALBUM[h.decision]} · {fechaHoraBA(h.fecha)}
                  {h.mensaje ? <span className="block whitespace-pre-wrap break-words text-xs text-[var(--fo-muted)]">{h.mensaje}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[var(--fo-muted)]">Entró por primera vez</dt>
            <dd>{d.primeraVez ? fechaHoraBA(d.primeraVez) : "Todavía no entró"}</dd>
          </div>
          {d.finalizadoEn ? (
            <div>
              <dt className="text-xs text-[var(--fo-muted)]">Finalizada</dt>
              <dd>{fechaHoraBA(d.finalizadoEn)}</dd>
            </div>
          ) : null}
          {d.reactivadoEn ? (
            <div>
              <dt className="text-xs text-[var(--fo-muted)]">Devuelta al cliente</dt>
              <dd>{fechaHoraBA(d.reactivadoEn)}</dd>
            </div>
          ) : null}
        </dl>

        {puedeFinalizar || puedeReactivar ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {puedeFinalizar ? (
              <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={() => transicion("finalizar")}>
                Finalizar
              </button>
            ) : null}
            {puedeReactivar ? (
              <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => transicion("reactivar")}>
                Reactivar
              </button>
            ) : null}
          </div>
        ) : null}
        {rondaAbierta && d.estado === "EN_REVISION" && d.decision?.decision === "CAMBIOS" ? (
          <p className="text-xs text-[var(--fo-muted)]">Pidió cambios: corregí las láminas y abrí una ronda nueva desde la pestaña Láminas. Sólo se puede finalizar si aprueba el álbum.</p>
        ) : null}
        {d.anulado && (d.estado === "EN_REVISION" || d.estado === "FINALIZADO") ? (
          <p className="text-xs text-[var(--fo-muted)]">Para reactivarla primero habilitá su enlace con uno nuevo desde la pestaña Clientes.</p>
        ) : null}
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
      </section>

      <section aria-labelledby="laminas-cliente-titulo" className="fo-card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="laminas-cliente-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
            Láminas de la ronda {d.ronda.numero}
          </h2>
          <div role="group" aria-label="Filtro de láminas" className="flex gap-1">
            <button type="button" aria-pressed={!soloConComentarios} className={`fo-btn text-xs ${!soloConComentarios ? "fo-btn-primary" : "fo-btn-secondary"}`} onClick={() => setSoloConComentarios(false)}>
              Todas ({laminas.length.toLocaleString("es-AR")})
            </button>
            <button type="button" aria-pressed={soloConComentarios} className={`fo-btn text-xs ${soloConComentarios ? "fo-btn-primary" : "fo-btn-secondary"}`} onClick={() => setSoloConComentarios(true)}>
              Con comentarios ({conComentarios.toLocaleString("es-AR")})
            </button>
          </div>
        </div>

        {laminas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Esta ronda no tiene láminas.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="min-w-0 space-y-3">
              {abierta ? <LaminaConPines lamina={abierta} url={grande[abierta.id] ?? null} pinActivo={pinActivo} alElegirPin={setPinActivo} /> : null}
              {lista.length === 0 ? (
                <p className="text-sm text-[var(--fo-muted)]">Ninguna lámina tiene comentarios.</p>
              ) : (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                  {lista.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => abrir(l)}
                        aria-pressed={abiertaId === l.id}
                        className={`block w-full overflow-hidden rounded-lg border text-left ${abiertaId === l.id ? "border-[var(--fo-accent,#1d4ed8)] ring-2 ring-[var(--fo-accent,#1d4ed8)]" : "border-[var(--fo-border)]"}`}
                      >
                        <span className="block aspect-[4/3] bg-[var(--fo-surface-muted)]">
                          {l.thumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.thumbUrl} alt={l.fileName} loading="lazy" className="h-full w-full object-cover" />
                          ) : null}
                        </span>
                        <span className="flex items-center justify-between gap-1 px-2 py-1 text-xs">
                          <span className="min-w-0 truncate">{l.fileName}</span>
                          {l.comentarios.length > 0 ? (
                            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-amber-800" aria-label={`${l.comentarios.length} comentarios`}>
                              {l.comentarios.length}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="min-w-0 space-y-3 self-start lg:sticky lg:top-4">
              {abierta ? (
                <>
                  <p className="break-all text-sm font-medium">{abierta.fileName}</p>
                  {hilos.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">El cliente no comentó esta lámina.</p> : null}
                  {hilos.map((h) => (
                    <HiloVista key={`${abierta.id}:${h.clave}`} hilo={h} activo={h.pinNumber !== null && h.pinNumber === pinActivo} laminaId={abierta.id} d={d} puedeResponder={puedeResponder} alResponder={agregarRespuesta} />
                  ))}
                </>
              ) : (
                <p className="text-sm text-[var(--fo-muted)]">Tocá una lámina para verla en grande y leer su conversación.</p>
              )}
            </div>
          </div>
        )}
        <p className="text-xs text-[var(--fo-muted)]">
          <Link href={`/galerias/${encodeURIComponent(d.galeriaId)}?tab=clientes`} className="hover:underline">
            Volver a los clientes de la galería
          </Link>
        </p>
      </section>
    </div>
  );
}
