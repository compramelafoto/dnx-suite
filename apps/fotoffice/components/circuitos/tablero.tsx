"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition, type DragEvent } from "react";
import { AlarmClock, Archive, CircleX, Inbox, LayoutGrid, List, Trophy } from "lucide-react";
import { cerrarAction, moverAction } from "@/app/actions/circuitos";
import { ETIQUETA_SALIDA } from "@/lib/circuitos/constantes";
import { formatoPesos } from "@/lib/consultas/valor";
import { clasePuntoDeEtapa, porcentajeDe, resumenDeColumnas } from "@/lib/circuitos/tablero-vista";
import type { Tablero as DatosTablero, TarjetaVista } from "@/lib/circuitos/tablero";
import { AltaRapida } from "@/components/consultas/alta-rapida";
import { DialogoGanada } from "./dialogo-ganada";
import { DialogoPerdida } from "./dialogo-perdida";
import type { Destino } from "./mover-a";
import { Tarjeta, type AvisoTarjeta } from "./tarjeta";

/** Lo que responde el motor cuando alguien movió la consulta entre que se cargó y se soltó. */
export const MENSAJE_CAMBIO = "Esta consulta cambió mientras tanto.";
const MENSAJE_CAMBIO_PROYECTO = "Este proyecto cambió mientras tanto.";
const MENSAJE_FALLA = "No se pudo guardar el cambio. Probá de nuevo.";

// ─── Pantalla grande: sólo ahí hay arrastre ──────────────────────────────────

const CONSULTA_ANCHA = "(min-width: 768px)";
function suscribirAncho(avisar: () => void) {
  const m = window.matchMedia(CONSULTA_ANCHA);
  m.addEventListener("change", avisar);
  return () => m.removeEventListener("change", avisar);
}
const esAncha = () => window.matchMedia(CONSULTA_ANCHA).matches;
/** En el servidor (y en el primer render) no hay arrastre: "Mover a…" siempre está. */
const esAnchaEnServidor = () => false;

// ─── Operaciones ─────────────────────────────────────────────────────────────

type Operacion = {
  journeyId: string;
  titulo: string;
  esperado: string;
  destino: Destino;
  lossReasonId?: string;
  nota?: string;
};

type Arrastre = { tarjeta: TarjetaVista; etapaId: string };

export type FiltrosVista = { circuito: string | null; responsable: number | null; soloVencidas: boolean };

function nombreDestino(d: Destino): string {
  return d.tipo === "etapa" ? d.nombre : (ETIQUETA_SALIDA[d.salida] ?? d.salida);
}

export function Tablero({
  datos,
  filtros,
  puedePasarIgual,
  altaRapida = null,
  tipo = "CAPTACION",
}: {
  /** Qué tablero es: cambia la ruta, los textos y si hay valor estimado (sólo Consultas). */
  tipo?: "CAPTACION" | "PROYECTO";
  datos: DatosTablero;
  filtros: FiltrosVista;
  /** El rol puede `configurar`: ofrece "Pasar igual" ante tareas obligatorias pendientes. */
  puedePasarIgual: boolean;
  /**
   * Con "Gestionar" en Consultas: el alta rápida de la primera columna, con las categorías
   * activas. Sólo en el circuito predeterminado, que es donde entra toda consulta nueva.
   */
  altaRapida?: { categorias: { id: string; nombre: string }[] } | null;
}) {
  const router = useRouter();
  const ancha = useSyncExternalStore(suscribirAncho, esAncha, esAnchaEnServidor);
  const [pendiente, iniciar] = useTransition();
  // Tarjetas con una operación en curso: cada una se libera sola, así dos operaciones a la vez no se pisan.
  const [ocupadas, setOcupadas] = useState<ReadonlySet<string>>(() => new Set());
  const [avisos, setAvisos] = useState<Record<string, AvisoTarjeta & { op: Operacion }>>({});
  const [estado, setEstado] = useState("");
  const [perdiendo, setPerdiendo] = useState<Omit<Operacion, "destino"> | null>(null);
  const [ganando, setGanando] = useState<Omit<Operacion, "destino"> | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const arrastre = useRef<Arrastre | null>(null);
  // Sombras en los bordes del tablero: avisan que hay más columnas a un costado.
  const scroller = useRef<HTMLDivElement | null>(null);
  const [bordes, setBordes] = useState({ izquierda: false, derecha: false });
  const medirBordes = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const izquierda = el.scrollLeft > 4;
    const derecha = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setBordes((b) => (b.izquierda === izquierda && b.derecha === derecha ? b : { izquierda, derecha }));
  }, []);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    medirBordes();
    const obs = new ResizeObserver(medirBordes);
    obs.observe(el);
    return () => obs.disconnect();
  }, [medirBordes, datos]);

  const { circuito, columnas, salidas, motivos, responsables } = datos;
  const esProyecto = tipo === "PROYECTO";
  const ruta = esProyecto ? "/proyectos" : "/consultas";
  const plural = esProyecto ? "proyectos" : "consultas";
  const nombreResponsable = new Map(responsables.map((r) => [r.id, r.nombre]));
  const etapasActivas = columnas.filter((c) => !c.etapa.archivada).map((c) => ({ id: c.etapa.id, nombre: c.etapa.nombre }));
  const listaSalidas = [salidas.exito, salidas.fracaso];

  function quitarAviso(journeyId: string) {
    setAvisos((a) => {
      if (!(journeyId in a)) return a;
      const resto = { ...a };
      delete resto[journeyId];
      return resto;
    });
  }

  function marcarOcupada(journeyId: string, ocupada: boolean) {
    setOcupadas((prev) => {
      const s = new Set(prev);
      if (ocupada) s.add(journeyId);
      else s.delete(journeyId);
      return s;
    });
  }

  function ejecutar(op: Operacion, forzar = false) {
    if (ocupadas.has(op.journeyId)) return;
    quitarAviso(op.journeyId);
    setEstado("");
    marcarOcupada(op.journeyId, true);
    iniciar(async () => {
      try {
        const base = { journeyId: op.journeyId, esperado: op.esperado, ...(forzar ? { forzar: true } : {}) };
        const r =
          op.destino.tipo === "etapa"
            ? await moverAction({ ...base, destinoId: op.destino.id })
            : await cerrarAction({ ...base, salida: op.destino.salida, lossReasonId: op.lossReasonId, nota: op.nota || undefined });
        if (r.ok) {
          setEstado(`«${op.titulo}» pasó a ${nombreDestino(op.destino)}.`);
          return;
        }
        const pendientes = "pendientes" in r ? r.pendientes : undefined;
        setAvisos((a) => ({
          ...a,
          [op.journeyId]: {
            mensaje: r.error,
            pendientes,
            puedePasarIgual: puedePasarIgual && !!pendientes && pendientes.length > 0,
            op,
          },
        }));
        // Otra persona (o una regla) la movió: se trae el tablero de nuevo para ver dónde quedó.
        if (r.error === MENSAJE_CAMBIO || r.error === MENSAJE_CAMBIO_PROYECTO) router.refresh();
      } catch {
        setAvisos((a) => ({ ...a, [op.journeyId]: { mensaje: MENSAJE_FALLA, puedePasarIgual: false, op } }));
      } finally {
        marcarOcupada(op.journeyId, false);
      }
    });
  }

  function pedir(tarjeta: TarjetaVista, destino: Destino) {
    const op = { journeyId: tarjeta.journeyId, titulo: tarjeta.sujeto.titulo, esperado: tarjeta.enteredStageAt };
    if (destino.tipo === "salida" && destino.salida === salidas.fracaso) {
      setPerdiendo(op);
      return;
    }
    // Ganar no se puede deshacer: se confirma siempre (al soltar y desde "Mover a…").
    if (destino.tipo === "salida" && destino.salida === salidas.exito) {
      setGanando(op);
      return;
    }
    ejecutar({ ...op, destino });
  }

  // ─── Arrastrar y soltar (HTML5 nativo) ─────────────────────────────────────

  function alArrastrar(tarjeta: TarjetaVista, etapaId: string, ev: DragEvent<HTMLElement>) {
    arrastre.current = { tarjeta, etapaId };
    ev.dataTransfer.effectAllowed = "move";
    ev.dataTransfer.setData("text/plain", tarjeta.journeyId); // Firefox no arrastra sin datos.
  }
  function alSoltarTarjeta() {
    arrastre.current = null;
    setSobre(null);
  }
  /** ¿Se puede soltar acá? Nunca en la misma columna ni en una etapa archivada. */
  function aceptaEtapa(etapaId: string, archivada: boolean): boolean {
    const a = arrastre.current;
    return !!a && !archivada && a.etapaId !== etapaId;
  }
  function sobreZona(clave: string, acepta: boolean, ev: DragEvent<HTMLElement>) {
    if (!acepta) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
    if (sobre !== clave) setSobre(clave);
  }
  function soltarEn(destino: Destino, ev: DragEvent<HTMLElement>) {
    ev.preventDefault();
    const a = arrastre.current;
    arrastre.current = null;
    setSobre(null);
    if (a) pedir(a.tarjeta, destino);
  }

  // ─── Barra ─────────────────────────────────────────────────────────────────

  function irA(cambios: Partial<FiltrosVista>) {
    const f = { ...filtros, ...cambios };
    const q = new URLSearchParams();
    if (f.circuito) q.set("circuito", f.circuito);
    if (f.responsable !== null) q.set("responsable", String(f.responsable));
    if (f.soloVencidas) q.set("vencidas", "si");
    const s = q.toString();
    router.push(s ? `${ruta}?${s}` : ruta);
  }

  if (!circuito) {
    return (
      <div className="fo-card space-y-2 text-sm">
        <p className="text-[var(--fo-muted)]">
          {esProyecto
            ? "Todavía no hay un flujo de trabajo activo para ordenar los proyectos."
            : "Todavía no hay un circuito de venta activo para ordenar las consultas."}
        </p>
        <Link href="/workspace/configuracion/circuitos" className="font-medium text-[var(--fo-accent)] hover:underline">
          Ir a Configuración → Circuitos
        </Link>
      </div>
    );
  }

  const hrefLista = `${ruta}/lista?circuito=${encodeURIComponent(circuito.id)}`;
  const resumen = resumenDeColumnas(columnas);
  const zonaClase = (clave: string, color: string) =>
    `flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-[var(--fo-radius)] border-2 border-dashed p-4 text-center text-sm font-medium transition-colors ${color} ${
      sobre === clave ? "ring-2 ring-[var(--fo-accent)] ring-offset-2 ring-offset-[var(--fo-bg)]" : ""
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {datos.circuitos.length > 1 ? (
          <label className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--fo-muted)]">{esProyecto ? "Flujo" : "Circuito"}</span>
            <select className="fo-input h-9 min-h-0! w-auto! py-0! pr-8! text-sm" value={circuito.id} onChange={(ev) => irA({ circuito: ev.target.value })}>
              {datos.circuitos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--fo-muted)]">Responsable</span>
          <select
            className="fo-input h-9 min-h-0! w-auto! py-0! pr-8! text-sm"
            value={filtros.responsable ?? ""}
            onChange={(ev) => irA({ responsable: ev.target.value ? Number(ev.target.value) : null })}
          >
            <option value="">Todos</option>
            {responsables.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </label>
        <label
          className={`inline-flex h-9 cursor-pointer select-none items-center gap-2 rounded-full border px-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-[var(--fo-accent-muted)] ${
            filtros.soloVencidas
              ? "border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] font-medium text-[var(--fo-danger)]"
              : "border-[var(--fo-border-strong)] bg-[var(--fo-bg-elevated)] text-[var(--fo-text-secondary)] hover:bg-[var(--fo-surface-hover)]"
          }`}
        >
          <input
            type="checkbox"
            className="size-3.5 accent-[var(--fo-danger)]"
            checked={filtros.soloVencidas}
            onChange={(ev) => irA({ soloVencidas: ev.target.checked })}
          />
          <AlarmClock className="size-3.5" aria-hidden="true" />
          Sólo vencidas
        </label>

        <div className="flex w-full items-center gap-3 sm:ml-auto sm:w-auto">
          <p className="hidden text-xs text-[var(--fo-muted)] sm:block">
            <span className="font-medium tabular-nums text-[var(--fo-text-secondary)]">{resumen.total}</span> {plural}
            {esProyecto ? null : (
              <>
                {" · "}
                <span className="tabular-nums" title="Suma del valor estimado de todas las columnas">
                  {formatoPesos(resumen.valor)}
                </span>
              </>
            )}
          </p>
          <nav aria-label="Modo de vista" className="grid w-full grid-cols-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-surface-muted)] p-0.5 sm:inline-grid sm:w-auto">
            <span
              aria-current="page"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-[var(--fo-surface)] px-3 text-xs font-medium text-[var(--fo-text)] shadow-[var(--fo-shadow-xs)]"
            >
              <LayoutGrid className="size-3.5" aria-hidden="true" /> Tablero
            </span>
            <Link
              href={hrefLista}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium text-[var(--fo-muted)] transition-colors hover:text-[var(--fo-text)] focus-visible:outline-2 focus-visible:outline-[var(--fo-accent)]"
            >
              <List className="size-3.5" aria-hidden="true" /> Modo lista
            </Link>
          </nav>
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {pendiente ? "Guardando…" : estado}
      </p>

      <div className="relative">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[var(--fo-bg)] to-transparent transition-opacity duration-200 ${
            bordes.izquierda ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[var(--fo-bg)] to-transparent transition-opacity duration-200 ${
            bordes.derecha ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          ref={scroller}
          data-tablero-scroll=""
          onScroll={medirBordes}
          className="flex snap-x snap-mandatory scroll-px-1 gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 [scrollbar-color:var(--fo-border-strong)_transparent] [scrollbar-width:thin] md:snap-proximity"
        >
          {columnas.map((col, indice) => {
            const { etapa } = col;
            const clave = `etapa:${etapa.id}`;
            const destinos = etapasActivas.filter((e) => e.id !== etapa.id);
            const parte = porcentajeDe(col.total, resumen.total);
            const conAlta = indice === 0 && altaRapida && circuito.predeterminado && altaRapida.categorias.length > 0;
            return (
              <section
                key={etapa.id}
                aria-label={`Etapa ${etapa.nombre}${etapa.archivada ? " (archivada)" : ""}`}
                className={`flex max-h-[calc(100dvh-13rem)] min-h-64 w-[calc(100vw-4rem)] max-w-[320px] shrink-0 snap-start flex-col rounded-[var(--fo-radius)] border bg-[color-mix(in_srgb,var(--fo-surface-muted)_55%,var(--fo-bg))] transition-[box-shadow,border-color] md:w-[300px] ${
                  sobre === clave ? "border-[var(--fo-accent)] ring-2 ring-[var(--fo-accent-muted)]" : "border-[var(--fo-border)]"
                } ${etapa.archivada ? "opacity-75" : ""}`}
                onDragOver={(ev) => sobreZona(clave, aceptaEtapa(etapa.id, etapa.archivada), ev)}
                onDragLeave={() => setSobre((s) => (s === clave ? null : s))}
                onDrop={(ev) => {
                  if (aceptaEtapa(etapa.id, etapa.archivada)) soltarEn({ tipo: "etapa", id: etapa.id, nombre: etapa.nombre }, ev);
                }}
              >
                <header className="shrink-0 space-y-2 px-3 pb-2 pt-3">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 shrink-0 rounded-full ${clasePuntoDeEtapa(etapa.color)}`} aria-hidden="true" />
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--fo-text)]" title={etapa.nombre}>
                      {etapa.nombre}
                    </h3>
                    {etapa.archivada ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--fo-surface)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--fo-muted)]"
                        title={`Etapa archivada: se pueden sacar ${esProyecto ? "los proyectos" : "las consultas"}, no entrar`}
                      >
                        <Archive className="size-3" aria-hidden="true" /> archivada
                      </span>
                    ) : null}
                    <span
                      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--fo-surface)] px-1.5 text-[11px] font-semibold tabular-nums text-[var(--fo-text-secondary)] shadow-[var(--fo-shadow-xs)]"
                      aria-label={`${col.total} ${plural}`}
                    >
                      {col.total}
                    </span>
                  </div>
                  {esProyecto ? null : (
                    <p className="flex items-baseline justify-between gap-2 text-xs text-[var(--fo-muted)]" title="Suma del valor estimado de las consultas de esta columna">
                      <span>Valor</span>
                      <span className="font-medium tabular-nums text-[var(--fo-text-secondary)]">{formatoPesos(col.valorTotal)}</span>
                    </p>
                  )}
                  {/* Qué parte del tablero está en esta etapa: sale de los mismos totales de las columnas. */}
                  <div
                    className="h-1 overflow-hidden rounded-full bg-[var(--fo-border)]"
                    role="img"
                    aria-label={`${parte} % de ${esProyecto ? "los proyectos" : "las consultas"} del tablero`}
                    title={`${parte} % de ${esProyecto ? "los proyectos" : "las consultas"} del tablero`}
                  >
                    <div className={`h-full rounded-full ${clasePuntoDeEtapa(etapa.color)} transition-[width] duration-300`} style={{ width: `${parte}%` }} />
                  </div>
                </header>

                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
                  {conAlta && altaRapida ? <AltaRapida categorias={altaRapida.categorias} /> : null}
                  {col.tarjetas.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {col.tarjetas.map((t) => {
                        const aviso = avisos[t.journeyId];
                        return (
                          <Tarjeta
                            key={t.journeyId}
                            tarjeta={t}
                            responsable={t.responsableId !== null ? (nombreResponsable.get(t.responsableId) ?? null) : null}
                            arrastrable={ancha}
                            ocupada={ocupadas.has(t.journeyId)}
                            aviso={aviso ?? null}
                            etapasDestino={destinos}
                            salidas={listaSalidas}
                            onArrastrar={(ev) => alArrastrar(t, etapa.id, ev)}
                            onSoltar={alSoltarTarjeta}
                            onMover={(d) => pedir(t, d)}
                            onPasarIgual={() => aviso && ejecutar(aviso.op, true)}
                            onCerrarAviso={() => quitarAviso(t.journeyId)}
                          />
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 rounded-[var(--fo-radius-sm)] border border-dashed border-[var(--fo-border-strong)] px-3 py-5 text-center">
                      <Inbox className="size-5 text-[var(--fo-muted-soft)]" aria-hidden="true" />
                      <p className="text-xs font-medium text-[var(--fo-muted)]">Sin {plural}</p>
                      {ancha && !etapa.archivada ? <p className="text-[11px] text-[var(--fo-muted-soft)]">Arrastrá una tarjeta hasta acá</p> : null}
                    </div>
                  )}
                  {col.masHref ? (
                    <Link
                      href={col.masHref}
                      className="mt-1 inline-flex items-center justify-center rounded-[var(--fo-radius-sm)] px-2 py-1.5 text-xs font-medium text-[var(--fo-accent-hover)] hover:bg-[var(--fo-accent-soft)]"
                    >
                      y {col.total - col.tarjetas.length} más
                    </Link>
                  ) : null}
                </div>
              </section>
            );
          })}

          {ancha ? (
            <div className="flex w-40 shrink-0 flex-col gap-3" aria-hidden="true">
              <div
                className={zonaClase(
                  "ganada",
                  "border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] text-[var(--fo-success)]",
                )}
                onDragOver={(ev) => sobreZona("ganada", !!arrastre.current, ev)}
                onDragLeave={() => setSobre((s) => (s === "ganada" ? null : s))}
                onDrop={(ev) => soltarEn({ tipo: "salida", salida: salidas.exito }, ev)}
              >
                <Trophy className="size-5" />
                {ETIQUETA_SALIDA[salidas.exito] ?? salidas.exito}
                <span className="text-[11px] font-normal opacity-80">Soltá acá</span>
              </div>
              <div
                className={zonaClase("perdida", "border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] text-[var(--fo-danger)]")}
                onDragOver={(ev) => sobreZona("perdida", !!arrastre.current, ev)}
                onDragLeave={() => setSobre((s) => (s === "perdida" ? null : s))}
                onDrop={(ev) => soltarEn({ tipo: "salida", salida: salidas.fracaso }, ev)}
              >
                <CircleX className="size-5" />
                {ETIQUETA_SALIDA[salidas.fracaso] ?? salidas.fracaso}
                <span className="text-[11px] font-normal opacity-80">Soltá acá</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <DialogoGanada
        pregunta={esProyecto ? "¿Marcar el proyecto como terminado? No se puede deshacer." : undefined}
        titulo={ganando?.titulo ?? null}
        onCancelar={() => setGanando(null)}
        onConfirmar={() => {
          if (!ganando) return;
          setGanando(null);
          ejecutar({ ...ganando, destino: { tipo: "salida", salida: salidas.exito } });
        }}
      />
      <DialogoPerdida
        textos={esProyecto ? { titulo: "Cancelar el proyecto", boton: "Cancelar el proyecto" } : undefined}
        titulo={perdiendo?.titulo ?? null}
        motivos={motivos}
        onCancelar={() => setPerdiendo(null)}
        onConfirmar={(motivoId, nota) => {
          if (!perdiendo) return;
          setPerdiendo(null);
          ejecutar({ ...perdiendo, destino: { tipo: "salida", salida: salidas.fracaso }, lossReasonId: motivoId, nota });
        }}
      />
    </div>
  );
}
