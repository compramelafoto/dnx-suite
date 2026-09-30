"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore, useTransition, type DragEvent } from "react";
import { cerrarAction, moverAction } from "@/app/actions/circuitos";
import { ETIQUETA_SALIDA } from "@/lib/circuitos/constantes";
import { claseDeColorEtiqueta } from "@/lib/ficha/formato";
import type { Tablero as DatosTablero, TarjetaVista } from "@/lib/circuitos/tablero";
import { DialogoGanada } from "./dialogo-ganada";
import { DialogoPerdida } from "./dialogo-perdida";
import type { Destino } from "./mover-a";
import { Tarjeta, type AvisoTarjeta } from "./tarjeta";

/** Lo que responde el motor cuando alguien movió la consulta entre que se cargó y se soltó. */
export const MENSAJE_CAMBIO = "Esta consulta cambió mientras tanto.";
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
}: {
  datos: DatosTablero;
  filtros: FiltrosVista;
  /** El rol puede `configurar`: ofrece "Pasar igual" ante tareas obligatorias pendientes. */
  puedePasarIgual: boolean;
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

  const { circuito, columnas, salidas, motivos, responsables } = datos;
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
        if (r.error === MENSAJE_CAMBIO) router.refresh();
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
    router.push(s ? `/captacion?${s}` : "/captacion");
  }

  if (!circuito) {
    return (
      <div className="fo-card space-y-2 text-sm">
        <p className="text-[var(--fo-muted)]">Todavía no hay un circuito de venta activo para ordenar las consultas.</p>
        <Link href="/workspace/configuracion/circuitos" className="font-medium text-[var(--fo-accent)] hover:underline">
          Ir a Configuración → Circuitos
        </Link>
      </div>
    );
  }

  const hrefLista = `/captacion/lista?circuito=${encodeURIComponent(circuito.id)}`;
  const zonaClase = (clave: string, color: string) =>
    `flex min-h-24 items-center justify-center rounded-lg border-2 border-dashed p-4 text-center text-sm font-medium ${color} ${
      sobre === clave ? "ring-2 ring-[var(--fo-accent)]" : ""
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        {datos.circuitos.length > 1 ? (
          <label className="fo-field-stack">
            <span className="fo-label">Circuito</span>
            <select className="fo-input" value={circuito.id} onChange={(ev) => irA({ circuito: ev.target.value })}>
              {datos.circuitos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="fo-field-stack">
          <span className="fo-label">Responsable</span>
          <select
            className="fo-input"
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
        <label className="flex h-10 items-center gap-2">
          <input type="checkbox" checked={filtros.soloVencidas} onChange={(ev) => irA({ soloVencidas: ev.target.checked })} />
          Sólo vencidas
        </label>
        <Link href={hrefLista} className="ml-auto flex h-10 items-center font-medium text-[var(--fo-accent)] hover:underline">
          Modo lista
        </Link>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {pendiente ? "Guardando…" : estado}
      </p>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {columnas.map((col) => {
          const { etapa } = col;
          const clave = `etapa:${etapa.id}`;
          const destinos = etapasActivas.filter((e) => e.id !== etapa.id);
          return (
            <section
              key={etapa.id}
              aria-label={`Etapa ${etapa.nombre}${etapa.archivada ? " (archivada)" : ""}`}
              className={`flex w-72 shrink-0 flex-col gap-2 rounded-lg bg-[var(--fo-surface-muted)] p-2 ${
                sobre === clave ? "ring-2 ring-[var(--fo-accent)]" : ""
              } ${etapa.archivada ? "opacity-80" : ""}`}
              onDragOver={(ev) => sobreZona(clave, aceptaEtapa(etapa.id, etapa.archivada), ev)}
              onDragLeave={() => setSobre((s) => (s === clave ? null : s))}
              onDrop={(ev) => {
                if (aceptaEtapa(etapa.id, etapa.archivada)) soltarEn({ tipo: "etapa", id: etapa.id, nombre: etapa.nombre }, ev);
              }}
            >
              <header className="flex items-center justify-between gap-2 px-1">
                <span className={`truncate rounded px-2 py-0.5 text-xs font-medium ${claseDeColorEtiqueta(etapa.color)}`}>{etapa.nombre}</span>
                <span className="flex items-center gap-2 text-xs text-[var(--fo-muted)]">
                  {etapa.archivada ? <span title="Etapa archivada: se puede sacar a las consultas, no entrar">archivada</span> : null}
                  {col.total}
                </span>
              </header>
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
              {col.tarjetas.length === 0 ? <p className="px-1 py-4 text-center text-xs text-[var(--fo-muted)]">Sin consultas</p> : null}
              {col.masHref ? (
                <Link href={col.masHref} className="px-1 text-xs font-medium text-[var(--fo-accent)] hover:underline">
                  y {col.total - col.tarjetas.length} más
                </Link>
              ) : null}
            </section>
          );
        })}

        {ancha ? (
          <div className="flex w-40 shrink-0 flex-col gap-3" aria-hidden="true">
            <div
              className={zonaClase("ganada", "border-[var(--fo-success-border)] text-[var(--fo-success)]")}
              onDragOver={(ev) => sobreZona("ganada", !!arrastre.current, ev)}
              onDragLeave={() => setSobre((s) => (s === "ganada" ? null : s))}
              onDrop={(ev) => soltarEn({ tipo: "salida", salida: salidas.exito }, ev)}
            >
              {ETIQUETA_SALIDA[salidas.exito] ?? salidas.exito}
            </div>
            <div
              className={zonaClase("perdida", "border-[var(--fo-danger-border)] text-[var(--fo-danger)]")}
              onDragOver={(ev) => sobreZona("perdida", !!arrastre.current, ev)}
              onDragLeave={() => setSobre((s) => (s === "perdida" ? null : s))}
              onDrop={(ev) => soltarEn({ tipo: "salida", salida: salidas.fracaso }, ev)}
            >
              {ETIQUETA_SALIDA[salidas.fracaso] ?? salidas.fracaso}
            </div>
          </div>
        ) : null}
      </div>

      <DialogoGanada
        titulo={ganando?.titulo ?? null}
        onCancelar={() => setGanando(null)}
        onConfirmar={() => {
          if (!ganando) return;
          setGanando(null);
          ejecutar({ ...ganando, destino: { tipo: "salida", salida: salidas.exito } });
        }}
      />
      <DialogoPerdida
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
