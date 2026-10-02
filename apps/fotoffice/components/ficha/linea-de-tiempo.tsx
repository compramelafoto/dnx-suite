"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { verMasAction } from "@/app/actions/ficha";
import type { EventoFichaWire, PaginaLineaWire, TipoEvento } from "@/lib/ficha/linea-de-tiempo";
import { filtrosVisibles } from "@/lib/ficha/formato";
import { Evento } from "./evento";
import { Nota } from "./nota";
import type { CategoriaVista, NotaVista, PersonaFicha } from "./tipos";

type Props = {
  persona: PersonaFicha;
  /** La primera página sin filtro, armada en el servidor. */
  inicial: PaginaLineaWire;
  /** Las notas fijadas: van arriba de todo, fuera de la paginación. */
  fijadas: NotaVista[];
  categorias: CategoriaVista[];
  userId: number;
  esConfigurador: boolean;
  veDinero: boolean;
};

/** De un evento de nota a lo que necesita `<Nota>`. */
function notaDeEvento(e: EventoFichaWire, userId: number, esConfigurador: boolean): NotaVista | null {
  if (e.tipo !== "notas" || !e.nota) return null;
  return {
    id: e.nota.id,
    body: e.detalle ?? "",
    categoryId: e.nota.categoryId,
    categoria: e.nota.categoria,
    autor: e.actor,
    fecha: e.fecha,
    editada: e.nota.editada,
    pinned: false,
    puedeModificar: esConfigurador || (e.nota.authorUserId !== null && e.nota.authorUserId === userId),
  };
}

export function LineaDeTiempo({ persona, inicial, fijadas, categorias, userId, esConfigurador, veDinero }: Props) {
  const [filtro, setFiltro] = useState<TipoEvento | null>(null);
  const [eventos, setEventos] = useState<EventoFichaWire[]>(inicial.eventos);
  const [siguiente, setSiguiente] = useState<string | null>(inicial.siguiente);
  const [fallaron, setFallaron] = useState<string[]>(inicial.fallaron);
  const [error, setError] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();

  // Después de guardar algo, el servidor manda una primera página nueva: se vuelve a partir
  // de ella (sin filtro) o se recarga el filtro elegido.
  const [previa, setPrevia] = useState(inicial);
  const [recargar, setRecargar] = useState(0);
  if (previa !== inicial) {
    setPrevia(inicial);
    if (filtro === null) {
      setEventos(inicial.eventos);
      setSiguiente(inicial.siguiente);
      setFallaron(inicial.fallaron);
    } else {
      setRecargar((n) => n + 1);
    }
  }

  // Sólo cuenta la última respuesta: un "Ver más" lento no se mezcla con otro filtro.
  const ultimoPedido = useRef(0);
  function cargar(tipo: TipoEvento | null, cursor: string | null) {
    setError(null);
    const pedido = ++ultimoPedido.current;
    iniciar(async () => {
      const r = await verMasAction(persona, tipo, cursor);
      if (pedido !== ultimoPedido.current) return;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEventos((antes) => (cursor ? [...antes, ...r.eventos] : r.eventos));
      setSiguiente(r.siguiente);
      setFallaron(r.fallaron);
    });
  }

  useEffect(() => {
    if (recargar > 0 && filtro !== null) cargar(filtro, null);
    // Sólo cuando llega una página nueva del servidor con un filtro elegido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recargar]);

  function elegir(tipo: TipoEvento | null) {
    if (tipo === filtro) return;
    setFiltro(tipo);
    if (tipo === null) {
      ultimoPedido.current++;
      setEventos(inicial.eventos);
      setSiguiente(inicial.siguiente);
      setFallaron(inicial.fallaron);
      setError(null);
    } else {
      setEventos([]);
      setSiguiente(null);
      cargar(tipo, null);
    }
  }

  const verFijadas = (filtro === null || filtro === "notas") && fijadas.length > 0;

  return (
    <section className="space-y-3" aria-labelledby="linea-titulo">
      <h2 id="linea-titulo" className="sr-only">
        Línea de tiempo
      </h2>
      <div role="group" aria-label="Filtrar la línea de tiempo" className="flex flex-wrap gap-1.5">
        {filtrosVisibles(veDinero).map((f) => (
          <button
            key={f.texto}
            type="button"
            aria-pressed={filtro === f.valor}
            onClick={() => elegir(f.valor)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              filtro === f.valor
                ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white"
                : "border-[var(--fo-border)] bg-[var(--fo-surface)] text-[var(--fo-text-secondary)] hover:bg-[var(--fo-surface-hover)]"
            }`}
          >
            {f.texto}
          </button>
        ))}
      </div>

      {fallaron.length > 0 ? (
        <p role="status" className="rounded-lg border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] px-3 py-2 text-sm text-[var(--fo-warning)]">
          No pudimos traer una parte de la historia; lo que ves puede estar incompleto. Probá de nuevo en un rato.
        </p>
      ) : null}

      {verFijadas ? (
        <ul className="space-y-2" aria-label="Notas fijadas">
          {fijadas.map((n) => (
            <li key={n.id}>
              <Nota persona={persona} nota={n} categorias={categorias} />
            </li>
          ))}
        </ul>
      ) : null}

      <ol className="fo-card divide-y divide-[var(--fo-border)] !py-1" aria-busy={cargando}>
        {eventos.map((e) => {
          const nota = notaDeEvento(e, userId, esConfigurador);
          return (
            <li key={e.id} className={nota ? "py-2" : undefined}>
              {nota ? <Nota persona={persona} nota={nota} categorias={categorias} /> : <Evento evento={e} />}
            </li>
          );
        })}
        {eventos.length === 0 && !cargando ? (
          <li className="py-6 text-center text-sm text-[var(--fo-muted)]">
            {filtro === null ? "Todavía no hay nada en la historia de esta persona." : "No hay nada de este tipo."}
          </li>
        ) : null}
        {cargando && eventos.length === 0 ? (
          <li className="py-6 text-center text-sm text-[var(--fo-muted)]">Cargando…</li>
        ) : null}
      </ol>

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}

      {siguiente ? (
        <div className="flex justify-center">
          <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={cargando} onClick={() => cargar(filtro, siguiente)}>
            {cargando ? "Cargando…" : "Ver más"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
