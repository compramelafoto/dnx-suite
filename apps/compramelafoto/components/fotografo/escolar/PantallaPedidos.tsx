"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFullscreenElement } from "@/components/simulator/useFullscreenElement";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";
import {
  INFO_FUERA,
  INFO_PASOS,
  PASOS_EMBUDO,
  esPasoEmbudo,
  textoCurso,
  type PasoEmbudo,
  type UbicacionEnEmbudo,
} from "@/lib/schools/embudo-pedidos-escolares";
import {
  SEGUNDOS_ENTRE_ACTUALIZACIONES,
  coincideBusqueda,
  contadoresPorPaso,
  pedidosParaTarjetas,
  planDeAdelanto,
  planDeRetroceso,
  type PlanDeAdelanto,
} from "@/lib/schools/pantalla-pedidos";

/**
 * Tablero de pedidos escolares: una columna por paso de la línea de producción, con tarjetas
 * chicas. Tocar una tarjeta abre su detalle; arrastrarla a la columna siguiente la adelanta
 * (con confirmación y la misma acción que Pedidos escolares). Sirve para trabajar en la
 * computadora y también para mostrar en un televisor o una videollamada: es oscuro, se actualiza
 * solo y tiene pantalla completa.
 */

type Diseno = {
  id: number;
  status: string;
  reviewNote: string | null;
  emptySlots: number;
  printBatchName?: string | null;
  sentToPrintAt?: string | null;
  printedAt?: string | null;
  deliveredAt?: string | null;
};

type Pedido = {
  kind?: "TIENDA_ESCOLAR" | "PACK_EXTERNO";
  redemptionOrderId?: number | null;
  id: number;
  buyerEmail: string;
  buyerName: string | null;
  buyerPhone?: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  totalCents?: number;
  createdAt?: string;
  isDemo?: boolean;
  paso: UbicacionEnEmbudo;
  disenos?: Diseno[];
  items?: Array<{ id: number; status: string }>;
  /** Sólo en los canjes de copias impresas sin librito: su avance por la imprenta. */
  copias?: {
    printBatchName?: string | null;
    sentToPrintAt?: string | null;
    printedAt?: string | null;
    deliveredAt?: string | null;
  } | null;
  album: { id: number; title: string; school: { id: number; name: string } | null } | null;
  schoolCourse: { id: number; name: string; division: string | null } | null;
};

type Tarjeta = {
  clave: string;
  nombre: string;
  curso: string | null;
  escuela: string | null;
  paso: UbicacionEnEmbudo;
  demo: boolean;
  pedido: Pedido;
  /** Cómo pasa al paso siguiente. */
  plan: PlanDeAdelanto;
  /** Cómo vuelve al paso anterior. */
  vuelta: PlanDeAdelanto;
};

/** Un movimiento posible (adelante o atrás) de una tarjeta. */
type Movimiento = Extract<PlanDeAdelanto, { puede: true }>;

/** Cuántas tarjetas se dibujan por columna antes de pedir "mostrar más" (hay columnas de cientos). */
const TANDA = 60;

/** Color de cada paso sobre fondo oscuro: del naranja de la marca al verde de "entregado". */
const COLOR_PASO: Record<PasoEmbudo, { fondo: string; tinta: string }> = {
  POR_CANJEAR: { fondo: "#3a2a1d", tinta: "#f3d9c2" },
  REVISAR_DISENO: { fondo: "#c27b3d", tinta: "#ffffff" },
  CAMBIOS_PEDIDOS: { fondo: "#b45309", tinta: "#ffffff" },
  PARA_IMPRIMIR: { fondo: "#7c4a1f", tinta: "#ffffff" },
  EN_IMPRENTA: { fondo: "#5b3518", tinta: "#f3d9c2" },
  PARA_ENTREGAR: { fondo: "#1f5d4a", tinta: "#d1fae5" },
  ENTREGADO: { fondo: "#14532d", tinta: "#bbf7d0" },
};

const ESTADO_DISENO: Record<string, string> = {
  DRAFT: "En armado",
  PENDING_PHOTOGRAPHER_APPROVAL: "Espera tu revisión",
  NEEDS_ADJUSTMENT: "Pediste cambios",
  APPROVED_FOR_EXPORT: "Aprobado (preparando archivo)",
  EXPORTED: "Aprobado",
};

const horaArgentina = (d: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);

const fechaArgentina = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date(iso))
    : null;

/** La API manda el total en centavos (también para los packs cobrados por fuera). */
const pesos = (centavos: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(centavos / 100);

/**
 * Todo lo que se puede buscar de un pedido: alumno, curso, escuela, álbum, familia, correo,
 * teléfono (con y sin espacios), números de pedido y de canje, tipo, paso, estado del librito,
 * lote, cambios pedidos, fechas y total. "DEMO" encuentra las pruebas.
 */
function textosParaBuscar(t: Tarjeta): Array<string | null | undefined> {
  const o = t.pedido;
  const disenos = o.disenos ?? [];
  const fechas = [
    o.createdAt,
    ...disenos.flatMap((d) => [d.sentToPrintAt, d.printedAt, d.deliveredAt]),
    o.copias?.sentToPrintAt,
    o.copias?.printedAt,
    o.copias?.deliveredAt,
  ].map((f) => fechaArgentina(f));
  return [
    t.nombre,
    t.curso,
    t.escuela,
    o.album?.title,
    o.buyerName,
    o.buyerEmail,
    o.buyerPhone,
    o.buyerPhone?.replace(/\D/g, ""),
    String(o.id),
    `#${o.id}`,
    o.redemptionOrderId ? `${o.redemptionOrderId} #${o.redemptionOrderId} canje` : null,
    o.kind === "PACK_EXTERNO" ? "Pack cobrado por fuera" : "Tienda escolar",
    t.demo ? "DEMO prueba" : null,
    esPasoEmbudo(t.paso) ? `${INFO_PASOS[t.paso].numero}. ${INFO_PASOS[t.paso].titulo}` : INFO_FUERA[t.paso as keyof typeof INFO_FUERA],
    disenos.length ? "librito" : o.copias ? "copias sueltas" : null,
    ...disenos.map((d) => `${ESTADO_DISENO[d.status] ?? d.status} ${d.printBatchName ?? ""} ${d.reviewNote ?? ""}`),
    disenos.some((d) => d.emptySlots > 0) ? "sin foto huecos" : null,
    o.copias?.printBatchName,
    ...fechas,
    typeof o.totalCents === "number" && !o.isDemo ? pesos(o.totalCents) : null,
  ];
}

function paraMover(o: Pedido) {
  return {
    paso: o.paso,
    isDemo: o.isDemo,
    disenos: o.disenos ?? [],
    items: o.items,
    redemptionOrderId: o.redemptionOrderId,
    copias: o.copias,
  };
}

function aTarjeta(o: Pedido): Tarjeta {
  const nombre =
    [o.studentFirstName, o.studentLastName].filter(Boolean).join(" ").trim() ||
    o.buyerName ||
    o.buyerEmail ||
    "Sin nombre";
  return {
    clave: `${o.kind ?? "TIENDA_ESCOLAR"}-${o.id}`,
    nombre,
    curso: textoCurso(o.schoolCourse),
    escuela: o.album?.school?.name ?? null,
    paso: o.paso,
    demo: Boolean(o.isDemo),
    pedido: o,
    plan: planDeAdelanto(paraMover(o)),
    vuelta: planDeRetroceso(paraMover(o)),
  };
}

function siguientePaso(p: PasoEmbudo): PasoEmbudo | null {
  return PASOS_EMBUDO[PASOS_EMBUDO.indexOf(p) + 1] ?? null;
}

export default function PantallaPedidos() {
  const router = useRouter();
  const raizRef = useRef<HTMLDivElement | null>(null);
  const enPantallaCompleta = useFullscreenElement(raizRef);
  const tableroRef = useRef<HTMLDivElement | null>(null);

  const [listo, setListo] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [error, setError] = useState(false);
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const [filtro, setFiltro] = useState<{ schoolId: string; curso: string }>({ schoolId: "", curso: "" });
  const [busqueda, setBusqueda] = useState("");
  const [visibles, setVisibles] = useState<Partial<Record<PasoEmbudo, number>>>({});

  const [abierta, setAbierta] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<Tarjeta | null>(null);
  const [sobre, setSobre] = useState<PasoEmbudo | null>(null);
  const [aConfirmar, setAConfirmar] = useState<{ t: Tarjeta; mov: Movimiento } | null>(null);
  const [moviendo, setMoviendo] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  // Escuela y curso pueden venir en la dirección (?schoolId=3&curso=5°%20A), desde Pedidos escolares.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setFiltro({ schoolId: q.get("schoolId") ?? "", curso: q.get("curso") ?? "" });
  }, []);

  useEffect(() => {
    let activo = true;
    ensurePhotographerSession().then((session) => {
      if (!activo) return;
      if (!session) router.push("/fotografo/login");
      else setListo(true);
    });
    return () => {
      activo = false;
    };
  }, [router]);

  const recargar = useCallback(async () => {
    const params = new URLSearchParams();
    if (filtro.schoolId && Number.isFinite(Number(filtro.schoolId))) params.set("schoolId", filtro.schoolId);
    try {
      const res = await fetch(`/api/fotografo/school-orders?${params}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setPedidos(Array.isArray(data) ? data : []);
      setActualizado(new Date());
      setError(false);
    } catch {
      // Se queda con lo último que tenía: en un televisor es mejor eso que una pantalla vacía.
      setError(true);
    }
  }, [filtro.schoolId]);

  // Mientras se arrastra o hay una ventana abierta no se recarga: la tarjeta no se mueve sola.
  const quieto = arrastrando !== null || abierta !== null || aConfirmar !== null || moviendo;
  useEffect(() => {
    if (!listo || quieto) return;
    void recargar();
    const id = window.setInterval(() => void recargar(), SEGUNDOS_ENTRE_ACTUALIZACIONES * 1000);
    return () => window.clearInterval(id);
  }, [listo, quieto, recargar]);

  useEffect(() => {
    if (!aviso) return;
    const id = window.setTimeout(() => setAviso(null), 6000);
    return () => window.clearTimeout(id);
  }, [aviso]);

  const delCurso = useMemo(
    () => (pedidos ?? []).filter((o) => !filtro.curso || textoCurso(o.schoolCourse) === filtro.curso),
    [pedidos, filtro.curso],
  );
  const contadores = useMemo(() => contadoresPorPaso(delCurso.map((o) => o.paso)), [delCurso]);
  const tarjetas = useMemo(
    () =>
      pedidosParaTarjetas(delCurso.map(aTarjeta), { incluirEntregados: true }).filter((t) =>
        coincideBusqueda(textosParaBuscar(t), busqueda),
      ),
    [delCurso, busqueda],
  );
  const porPaso = useMemo(() => {
    const m = Object.fromEntries(PASOS_EMBUDO.map((p) => [p, [] as Tarjeta[]])) as Record<PasoEmbudo, Tarjeta[]>;
    for (const t of tarjetas) if (esPasoEmbudo(t.paso)) m[t.paso].push(t);
    return m;
  }, [tarjetas]);

  const tarjetaAbierta = abierta ? (delCurso.map(aTarjeta).find((t) => t.clave === abierta) ?? null) : null;

  const escuela = filtro.schoolId ? (delCurso.find((o) => o.album?.school)?.album?.school?.name ?? null) : null;
  const subtitulo = [escuela, filtro.curso || null].filter(Boolean).join(" · ") || "Todas las escuelas";

  const alternarPantallaCompleta = useCallback(async () => {
    const el = raizRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* el navegador no dejó */
    }
  }, []);

  async function mover(t: Tarjeta, mov: Movimiento) {
    setMoviendo(true);
    try {
      for (const l of mov.llamadas) {
        const r = await fetch(l.url, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(l.body ?? {}),
        });
        const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        if (!r.ok || d.ok === false) {
          const texto = [d.message, d.reason, d.error].find((v) => typeof v === "string" && v.trim());
          throw new Error(typeof texto === "string" ? texto : `Error (${r.status})`);
        }
        // «Volver un paso» responde cuántas piezas movió: cero es que no se pudo.
        if (typeof d.actualizados === "number" && d.actualizados === 0) {
          throw new Error("ya no estaba en ese paso");
        }
      }
      setAviso({ tono: "ok", texto: `${t.nombre} pasó a «${INFO_PASOS[mov.destino].titulo}».` });
    } catch (e) {
      setAviso({ tono: "error", texto: `No pude mover a ${t.nombre}: ${e instanceof Error ? e.message : "error"}` });
    } finally {
      setAConfirmar(null);
      setAbierta(null);
      setMoviendo(false);
      await recargar();
    }
  }

  const boton =
    "rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c27b3d]";
  const destinoAdelante = arrastrando?.plan.puede ? arrastrando.plan.destino : null;
  const destinoAtras = arrastrando?.vuelta.puede ? arrastrando.vuelta.destino : null;
  const movimientoHacia = (t: Tarjeta, paso: PasoEmbudo): Movimiento | null =>
    t.plan.puede && t.plan.destino === paso ? t.plan : t.vuelta.puede && t.vuelta.destino === paso ? t.vuelta : null;

  return (
    <div
      ref={raizRef}
      className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#0b0d12] text-white"
      style={{ colorScheme: "dark" }}
    >
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-2">
          {!enPantallaCompleta ? (
            <Link href="/fotografo/escuelas/pedidos" className={boton}>
              ← Volver
            </Link>
          ) : null}
          <button type="button" onClick={() => void alternarPantallaCompleta()} className={boton}>
            {enPantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}
          </button>
        </div>
        <div className="min-w-0">
          <h1 className="text-[clamp(22px,2vw,34px)] font-bold leading-tight">Pedidos escolares</h1>
          <p className="text-sm text-white/60">{subtitulo}</p>
        </div>
        <label className="relative order-last w-full sm:order-none sm:ml-auto sm:w-72">
          <span className="sr-only">Buscar por cualquier dato del pedido</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cualquier dato del pedido…"
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#c27b3d] focus:outline-none"
          />
        </label>
        <div className="text-right text-xs text-white/50 sm:text-sm">
          {actualizado ? <p>Actualizado {horaArgentina(actualizado)}</p> : null}
          {error ? <p className="text-amber-400">Sin conexión: muestro lo último que llegó</p> : null}
        </div>
      </header>

      <p className="px-4 pt-2 text-xs text-white/40 sm:px-6">
        Tocá una tarjeta para ver todo el pedido. Arrastrala a la columna siguiente para adelantarla, o a la anterior para volverla atrás.
      </p>

      {/* El tablero: una columna por paso. Se desplaza de costado si la ventana es angosta. */}
      <div
        ref={tableroRef}
        onDragOver={(e) => {
          // Si la columna siguiente no entra en la ventana, acercar la tarjeta al borde desplaza el tablero.
          const el = tableroRef.current;
          if (!el || !arrastrando) return;
          const caja = el.getBoundingClientRect();
          const borde = 90;
          if (e.clientX > caja.right - borde) el.scrollLeft += 18;
          else if (e.clientX < caja.left + borde) el.scrollLeft -= 18;
        }}
        className="min-h-0 flex-1 overflow-x-auto px-4 pb-4 pt-3 sm:px-6"
      >
        {pedidos === null ? (
          <p className="flex h-full items-center justify-center text-xl text-white/50">
            {error ? "No pude traer los pedidos. Reintento en unos segundos…" : "Cargando pedidos…"}
          </p>
        ) : (
          <div className="flex h-full min-w-max gap-3 2xl:min-w-0">
            {contadores.map((c) => {
              const lista = porPaso[c.paso];
              const color = COLOR_PASO[c.paso];
              const cuantas = visibles[c.paso] ?? TANDA;
              const esAdelante = destinoAdelante === c.paso;
              const esAtras = destinoAtras === c.paso;
              const esDestino = esAdelante || esAtras;
              const apagada = arrastrando !== null && !esDestino && arrastrando.paso !== c.paso;
              return (
                <section
                  key={c.paso}
                  id={`columna-${c.paso}`}
                  aria-label={`${c.titulo}: ${c.cantidad}`}
                  onDragOver={(e) => {
                    if (!esDestino) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setSobre(c.paso);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setSobre(null);
                    const mov = arrastrando ? movimientoHacia(arrastrando, c.paso) : null;
                    if (arrastrando && mov) setAConfirmar({ t: arrastrando, mov });
                    setArrastrando(null);
                  }}
                  className={`flex w-[300px] shrink-0 flex-col rounded-xl border transition 2xl:w-auto 2xl:min-w-[300px] 2xl:flex-1 ${
                    esAdelante
                      ? sobre === c.paso
                        ? "border-[#c27b3d] bg-[#c27b3d]/15"
                        : "border-dashed border-[#c27b3d]/70 bg-[#c27b3d]/5"
                      : esAtras
                        ? sobre === c.paso
                          ? "border-sky-400 bg-sky-400/15"
                          : "border-dashed border-sky-400/60 bg-sky-400/5"
                        : "border-white/5 bg-white/[0.02]"
                  } ${apagada ? "opacity-40" : ""}`}
                >
                  <div
                    title={INFO_PASOS[c.paso].ayuda}
                    className="flex items-end justify-between gap-2 rounded-t-xl px-4 py-3"
                    style={{
                      background: c.cantidad === 0 ? "#1a1d24" : color.fondo,
                      color: c.cantidad === 0 ? "#6b7280" : color.tinta,
                    }}
                  >
                    <span className="truncate text-xl font-bold leading-tight">
                      {c.numero}. {c.titulo}
                    </span>
                    <span className="text-4xl font-bold leading-none tabular-nums">{c.cantidad}</span>
                  </div>
                  {esAdelante ? (
                    <p className="px-3 pt-2 text-xs font-semibold text-[#e7a86b]">Soltala acá para pasarla a este paso</p>
                  ) : esAtras ? (
                    <p className="px-3 pt-2 text-xs font-semibold text-sky-300">← Soltala acá para volverla a este paso</p>
                  ) : null}
                  <ol className="m-0 flex min-h-0 flex-1 list-none flex-col gap-2 overflow-y-auto p-2">
                    {lista.length === 0 ? (
                      <li className="px-1 py-3 text-center text-xs text-white/30">
                        {busqueda ? "Nada coincide" : "Sin pedidos"}
                      </li>
                    ) : null}
                    {lista.slice(0, cuantas).map((t) => (
                      <TarjetaPedido
                        key={t.clave}
                        t={t}
                        arrastrada={arrastrando?.clave === t.clave}
                        onAbrir={() => setAbierta(t.clave)}
                        onEmpezar={() => {
                          setArrastrando(t);
                          // Se lleva a la vista la columna siguiente (o, si no avanza, la anterior).
                          const hacia = t.plan.puede ? t.plan.destino : t.vuelta.puede ? t.vuelta.destino : null;
                          if (!hacia) return;
                          const idDestino = `columna-${hacia}`;
                          // Después de dibujar el arrastre: si la columna de destino no se ve entera, se corre el tablero.
                          window.setTimeout(() => {
                            const el = tableroRef.current;
                            const destino = document.getElementById(idDestino);
                            if (!el || !destino) return;
                            const caja = el.getBoundingClientRect();
                            const d = destino.getBoundingClientRect();
                            if (d.right > caja.right) el.scrollBy({ left: d.right - caja.right + 24 });
                            else if (d.left < caja.left) el.scrollBy({ left: d.left - caja.left - 24 });
                          }, 0);
                        }}
                        onTerminar={() => {
                          setArrastrando(null);
                          setSobre(null);
                        }}
                      />
                    ))}
                    {lista.length > cuantas ? (
                      <li>
                        <button
                          type="button"
                          onClick={() => setVisibles((v) => ({ ...v, [c.paso]: cuantas + TANDA }))}
                          className="w-full rounded-lg border border-white/10 py-2 text-xs font-semibold text-white/70 hover:bg-white/5"
                        >
                          Mostrar {Math.min(TANDA, lista.length - cuantas)} más (quedan {lista.length - cuantas})
                        </button>
                      </li>
                    ) : null}
                  </ol>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {tarjetaAbierta ? (
        // Con la confirmación encima, Escape (o tocar afuera) cierra sólo la confirmación.
        <Ventana onCerrar={() => (aConfirmar ? undefined : setAbierta(null))} titulo={tarjetaAbierta.nombre}>
          <DetallePedido t={tarjetaAbierta} onMover={(mov) => setAConfirmar({ t: tarjetaAbierta, mov })} />
        </Ventana>
      ) : null}

      {aConfirmar ? (
        <Ventana
          onCerrar={() => (moviendo ? undefined : setAConfirmar(null))}
          titulo={`¿${aConfirmar.mov === aConfirmar.t.vuelta ? "Volver" : "Pasar"} a «${INFO_PASOS[aConfirmar.mov.destino].titulo}»?`}
          chica
        >
          <p className="text-base font-semibold">{aConfirmar.t.nombre}</p>
          <p className="mt-2 text-sm text-white/80">{aConfirmar.mov.explicacion}</p>
          {aConfirmar.mov.aviso ? (
            <p className="mt-2 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-300">{aConfirmar.mov.aviso}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={moviendo} onClick={() => setAConfirmar(null)} className={boton}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={moviendo}
              onClick={() => void mover(aConfirmar.t, aConfirmar.mov)}
              className="rounded-lg bg-[#c27b3d] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#d08a4b] disabled:opacity-60"
            >
              {moviendo
                ? "Moviendo…"
                : `Sí, ${aConfirmar.mov === aConfirmar.t.vuelta ? "volver" : "pasar"} a «${INFO_PASOS[aConfirmar.mov.destino].titulo}»`}
            </button>
          </div>
        </Ventana>
      ) : null}

      {aviso ? (
        <div
          role="status"
          className={`fixed bottom-4 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-semibold shadow-lg ${
            aviso.tono === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {aviso.texto}
        </div>
      ) : null}
    </div>
  );
}

/** Lo que espera cada paso que no se adelanta desde el tablero, en pocas palabras. */
const ESPERA_CORTA: Partial<Record<PasoEmbudo, string>> = {
  POR_CANJEAR: "Espera que la familia elija",
  CAMBIOS_PEDIDOS: "Espera la respuesta de la familia",
  ENTREGADO: "Listo",
};

function TarjetaPedido({
  t,
  arrastrada,
  onAbrir,
  onEmpezar,
  onTerminar,
}: {
  t: Tarjeta;
  arrastrada: boolean;
  onAbrir: () => void;
  onEmpezar: () => void;
  onTerminar: () => void;
}) {
  const paso = t.paso as PasoEmbudo;
  const o = t.pedido;
  const disenos = o.disenos ?? [];
  const sePuede = t.plan.puede;
  const seMueve = t.plan.puede || t.vuelta.puede;
  const huecos = disenos.reduce((n, d) => n + (d.status === "PENDING_PHOTOGRAPHER_APPROVAL" ? d.emptySlots : 0), 0);
  const nota = disenos.find((d) => d.status === "NEEDS_ADJUSTMENT" && d.reviewNote)?.reviewNote ?? null;
  const lote = disenos.find((d) => d.printBatchName)?.printBatchName ?? o.copias?.printBatchName ?? null;
  const adulto = o.buyerName?.trim() || o.buyerEmail || null;
  const fecha = fechaArgentina(o.createdAt);
  const librito =
    disenos.length === 0
      ? o.copias
        ? "Copias sueltas"
        : o.kind === "PACK_EXTERNO" && t.paso !== "POR_CANJEAR"
          ? "Sólo digital"
          : null
      : disenos.length > 1
        ? `${disenos.length} librititos`
        : `Librito: ${(ESTADO_DISENO[disenos[0].status] ?? disenos[0].status).toLowerCase()}`;

  // Es un div (no un botón) para que se pueda arrastrar en todos los navegadores: Firefox y
  // Safari no arrastran un <button>.
  return (
    <li
      draggable={seMueve}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", t.clave);
        onEmpezar();
      }}
      onDragEnd={onTerminar}
      className={arrastrada ? "opacity-40" : ""}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onAbrir}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onAbrir();
          }
        }}
        title={seMueve ? "Tocá para ver el pedido · arrastralo para moverlo de paso" : "Tocá para ver el pedido"}
        className={`group flex w-full select-none items-stretch rounded-lg border border-white/10 bg-[#161a22] text-left transition hover:border-white/25 hover:bg-[#1c212b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c27b3d] ${
          seMueve ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        }`}
      >
        <span aria-hidden className="w-1.5 shrink-0 rounded-l-lg" style={{ background: COLOR_PASO[paso].fondo }} />
        <span className="min-w-0 flex-1 px-3 py-2.5">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold leading-tight">{t.nombre}</span>
            {t.demo ? (
              <span className="shrink-0 rounded bg-fuchsia-500/20 px-1.5 text-[10px] font-bold text-fuchsia-300">DEMO</span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-[13px] leading-snug text-white/60">
            {[t.curso, t.escuela].filter(Boolean).join(" · ") || "Sin curso"}
          </span>
          {adulto || fecha ? (
            <span className="mt-1 block truncate text-xs leading-snug text-white/45">
              {[adulto, fecha].filter(Boolean).join(" · ")}
            </span>
          ) : null}
          {librito || huecos > 0 || lote ? (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {librito ? <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[11px] text-white/70">{librito}</span> : null}
              {huecos > 0 ? (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-300">{huecos} sin foto</span>
              ) : null}
              {lote ? <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[11px] text-white/70">{lote}</span> : null}
            </span>
          ) : null}
          {nota ? <span className="mt-1 block truncate text-[11px] text-sky-300">“{nota}”</span> : null}
          <span className="mt-2 flex items-center justify-between gap-2 border-t border-white/5 pt-1.5 text-[11px]">
            {sePuede ? (
              <span className="font-semibold text-[#e7a86b]">Arrastrá a «{INFO_PASOS[t.plan.destino].titulo}» →</span>
            ) : (
              <span className="text-white/35">{ESPERA_CORTA[paso] ?? "Se mueve desde Pedidos escolares"}</span>
            )}
            {seMueve ? (
              <span aria-hidden className="text-sm text-white/30 group-hover:text-[#e7a86b]">
                ⠿
              </span>
            ) : null}
          </span>
        </span>
      </div>
    </li>
  );
}

function Ventana({
  titulo,
  onCerrar,
  chica,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  chica?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      // Con una foto ampliada encima, Escape cierra sólo la foto.
      if (e.key === "Escape" && !document.querySelector("[data-visor-abierto]")) onCerrar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90dvh] w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#12151c] p-5 shadow-2xl ${
          chica ? "max-w-md" : "max-w-xl"
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold leading-tight">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-lg px-2 py-1 text-lg leading-none text-white/60 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-white/45">{etiqueta}</dt>
      <dd className="m-0 break-words text-sm">{children}</dd>
    </div>
  );
}

type Imagen = { chica: string; grande: string; texto: string };

/**
 * Miniaturas de lo que va en el pedido: las caras del librito y las fotos. Se piden recién al
 * abrir la ficha (nunca en el tablero), así que no lo hacen más lento. La primera vez que se
 * abre un librito sus caras se generan (unos segundos) y quedan guardadas.
 */
function VistaPrevia({ o }: { o: Pedido }) {
  const disenos = o.disenos ?? [];
  const [libritos, setLibritos] = useState<Record<number, Imagen[] | "cargando" | "error">>({});
  const [fotos, setFotos] = useState<Imagen[] | "cargando" | "error" | null>(o.redemptionOrderId ? "cargando" : null);
  const [visor, setVisor] = useState<{ lista: Imagen[]; i: number } | null>(null);
  const idsDisenos = disenos.map((d) => d.id).join(",");

  useEffect(() => {
    let activo = true;
    const ids = idsDisenos ? idsDisenos.split(",").map(Number) : [];
    setLibritos(Object.fromEntries(ids.map((id) => [id, "cargando" as const])));
    for (const id of ids) {
      fetch(`/api/fotografo/disenos/${id}/miniaturas`, { credentials: "include", cache: "no-store" })
        .then((r) => r.json().then((d) => ({ r, d })))
        .then(({ r, d }) => {
          if (!activo) return;
          if (!r.ok || !Array.isArray(d.caras)) throw new Error();
          const caras: Imagen[] = (d.caras as string[]).map((url, i, todas) => ({
            chica: url,
            grande: url,
            texto: todas.length > 1 ? `Cara ${i + 1} de ${todas.length}` : "Diseño",
          }));
          setLibritos((v) => ({ ...v, [id]: caras }));
        })
        .catch(() => activo && setLibritos((v) => ({ ...v, [id]: "error" })));
    }
    return () => {
      activo = false;
    };
  }, [idsDisenos]);

  useEffect(() => {
    if (!o.redemptionOrderId) return;
    let activo = true;
    setFotos("cargando");
    fetch(`/api/fotografo/escolar/fotos-del-pedido?canje=${o.redemptionOrderId}`, { credentials: "include", cache: "no-store" })
      .then((r) => r.json().then((d) => ({ r, d })))
      .then(({ r, d }) => {
        if (!activo) return;
        if (!r.ok || !Array.isArray(d.fotos)) throw new Error();
        setFotos(
          (d.fotos as Array<{ miniatura: string; grande: string; tipos: string[] }>).map((f) => ({
            chica: f.miniatura,
            grande: f.grande,
            texto: f.tipos.join(" · "),
          })),
        );
      })
      .catch(() => activo && setFotos("error"));
    return () => {
      activo = false;
    };
  }, [o.redemptionOrderId]);

  if (disenos.length === 0 && fotos === null) return null;
  const miniatura = "h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5 hover:border-[#c27b3d]";

  return (
    <div className="border-t border-white/10 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-white/80">Vista previa</h3>
      {disenos.map((d, n) => {
        const estado = libritos[d.id];
        return (
          <div key={d.id} className="mb-3">
            <p className="mb-1 text-xs text-white/50">{disenos.length > 1 ? `Librito ${n + 1}` : "Librito"}</p>
            {estado === "error" ? (
              <p className="text-xs text-amber-300">No pude preparar la vista previa del librito.</p>
            ) : !estado || estado === "cargando" ? (
              <p className="text-xs text-white/40">Preparando la vista previa del librito… (la primera vez tarda unos segundos)</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {estado.map((img, i) => (
                  <button
                    key={img.chica}
                    type="button"
                    onClick={() => setVisor({ lista: estado, i })}
                    title={img.texto}
                    className="h-28 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5 hover:border-[#c27b3d]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.chica} alt={img.texto} loading="lazy" className="h-full w-auto object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {fotos !== null ? (
        <div>
          <p className="mb-1 text-xs text-white/50">Fotos del pedido</p>
          {fotos === "error" ? (
            <p className="text-xs text-amber-300">No pude traer las fotos del pedido.</p>
          ) : fotos === "cargando" ? (
            <p className="text-xs text-white/40">Cargando fotos…</p>
          ) : fotos.length === 0 ? (
            <p className="text-xs text-white/40">El pedido no tiene fotos.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {fotos.map((img, i) => (
                <button key={img.chica} type="button" onClick={() => setVisor({ lista: fotos, i })} title={img.texto} className="text-left">
                  <span className={`${miniatura} block`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.chica} alt={img.texto} loading="lazy" className="h-full w-full object-cover" />
                  </span>
                  <span className="mt-0.5 block w-24 truncate text-[10px] text-white/50">{img.texto}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
      {visor ? <Visor lista={visor.lista} inicio={visor.i} onCerrar={() => setVisor(null)} /> : null}
    </div>
  );
}

/** Una imagen ampliada, con flechas (y teclado) para pasar a la anterior o la siguiente. */
function Visor({ lista, inicio, onCerrar }: { lista: Imagen[]; inicio: number; onCerrar: () => void }) {
  const [i, setI] = useState(inicio);
  const ir = useCallback((paso: number) => setI((n) => (n + paso + lista.length) % lista.length), [lista.length]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      else if (e.key === "ArrowRight") ir(1);
      else if (e.key === "ArrowLeft") ir(-1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar, ir]);
  const img = lista[i]!;
  const flecha =
    "absolute top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-2xl leading-none text-white hover:bg-black/80";
  return (
    <div data-visor-abierto className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4" onClick={onCerrar}>
      <div className="relative flex max-h-full w-full max-w-5xl flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.grande} alt={img.texto} className="max-h-[80dvh] max-w-full rounded-lg object-contain" />
        {lista.length > 1 ? (
          <>
            <button type="button" aria-label="Anterior" onClick={() => ir(-1)} className={`${flecha} left-2`}>
              ‹
            </button>
            <button type="button" aria-label="Siguiente" onClick={() => ir(1)} className={`${flecha} right-2`}>
              ›
            </button>
          </>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-white/80">
        {img.texto}
        {lista.length > 1 ? ` · ${i + 1} de ${lista.length}` : ""}
      </p>
      <button type="button" onClick={onCerrar} className="absolute right-4 top-4 rounded-lg px-3 py-1 text-2xl text-white/80 hover:bg-white/10" aria-label="Cerrar">
        ✕
      </button>
    </div>
  );
}

/**
 * Lo que se puede bajar de un pedido, sea librito, copias sueltas o los dos: las mismas descargas
 * que Pedidos escolares.
 */
function Descargas({ o }: { o: Pedido }) {
  const disenos = o.disenos ?? [];
  const aprobados = disenos.filter((d) => d.status === "APPROVED_FOR_EXPORT" || d.status === "EXPORTED").map((d) => d.id);
  const copias = o.copias && o.redemptionOrderId ? [o.redemptionOrderId] : [];
  const q = new URLSearchParams();
  if (aprobados.length) q.set("ids", aprobados.join(","));
  if (copias.length) q.set("copias", copias.join(","));
  const paraImprenta = aprobados.length + copias.length > 0;
  const boton =
    "inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15";
  if (!paraImprenta && !o.redemptionOrderId) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-white/80">Descargas</h3>
      <div className="flex flex-wrap gap-2">
        {paraImprenta ? (
          <>
            <a href={`/api/fotografo/escolar/lotes/zip?${q}`} target="_blank" rel="noreferrer" className={boton}>
              Para imprenta (ZIP)
            </a>
            <a href={`/api/fotografo/escolar/lotes/zip?${q}&formato=jpg`} target="_blank" rel="noreferrer" className={boton}>
              Para imprenta en JPG (ZIP)
            </a>
          </>
        ) : null}
        {o.redemptionOrderId ? (
          <a
            href={`/api/fotografo/pedidos/${o.redemptionOrderId}/export-print`}
            target="_blank"
            rel="noreferrer"
            className={boton}
            title="ZIP con las copias de este pedido ordenadas por tamaño (y el PDF del librito, si tiene)"
          >
            Fotos del pedido por tamaño (ZIP)
          </a>
        ) : null}
      </div>
    </div>
  );
}

function DetallePedido({ t, onMover }: { t: Tarjeta; onMover: (mov: Movimiento) => void }) {
  const o = t.pedido;
  const paso = esPasoEmbudo(t.paso) ? t.paso : null;
  const telefono = o.buyerPhone?.replace(/\D/g, "") ?? "";
  const disenos = o.disenos ?? [];
  const link = "text-[#e7a86b] hover:underline";
  const siguiente = paso ? siguientePaso(paso) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {paso ? (
          <span
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{ background: COLOR_PASO[paso].fondo, color: COLOR_PASO[paso].tinta }}
          >
            {INFO_PASOS[paso].numero}. {INFO_PASOS[paso].titulo}
          </span>
        ) : (
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
            {INFO_FUERA[t.paso as keyof typeof INFO_FUERA]}
          </span>
        )}
        {t.demo ? <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/60">DEMO</span> : null}
      </div>
      {paso ? <p className="-mt-2 text-sm text-white/60">{INFO_PASOS[paso].ayuda}</p> : null}

      <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Dato etiqueta="Escuela">{t.escuela ?? "—"}</Dato>
        <Dato etiqueta="Curso">{t.curso ?? "—"}</Dato>
        <Dato etiqueta="Quién compró">{o.buyerName || "—"}</Dato>
        <Dato etiqueta="Correo">
          {o.buyerEmail ? (
            <a href={`mailto:${o.buyerEmail}`} className={link}>
              {o.buyerEmail}
            </a>
          ) : (
            "—"
          )}
        </Dato>
        <Dato etiqueta="Teléfono">
          {telefono ? (
            <a href={`https://wa.me/${telefono}`} target="_blank" rel="noreferrer" className={link}>
              {o.buyerPhone} · WhatsApp
            </a>
          ) : (
            "—"
          )}
        </Dato>
        <Dato etiqueta="Pedido">
          {o.kind === "PACK_EXTERNO" ? "Pack cobrado por fuera" : "Tienda escolar"} · #{o.id}
          {o.redemptionOrderId ? ` (canje #${o.redemptionOrderId})` : ""}
        </Dato>
        <Dato etiqueta="Fecha">{fechaArgentina(o.createdAt) ?? "—"}</Dato>
        <Dato etiqueta="Total">{o.isDemo ? "Prueba" : typeof o.totalCents === "number" ? pesos(o.totalCents) : "—"}</Dato>
        {o.album ? <Dato etiqueta="Álbum">{o.album.title}</Dato> : null}
      </dl>

      <VistaPrevia o={o} />

      <div className="border-t border-white/10 pt-4">
        <h3 className="mb-2 text-sm font-semibold text-white/80">
          {disenos.length > 1 ? `Librititos (${disenos.length})` : "Librito"}
        </h3>
        {disenos.length === 0 ? (
          <p className="text-sm text-white/50">
            {t.paso === "POR_CANJEAR"
              ? "Todavía no hay: la familia no eligió sus fotos."
              : o.copias
                ? "Sin librito: son copias sueltas impresas."
                : "Sin librito."}
          </p>
        ) : (
          <ul className="m-0 list-none space-y-2 p-0">
            {disenos.map((d, i) => (
              <li key={d.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {disenos.length > 1 ? `Librito ${i + 1}` : "Diseño"} · {ESTADO_DISENO[d.status] ?? d.status}
                  </span>
                  <span className="flex gap-3 text-xs">
                    <a href={`/fotografo/disenos/${d.id}`} target="_blank" rel="noreferrer" className={link}>
                      Abrir diseño
                    </a>
                    <a href={`/api/fotografo/disenos/${d.id}/pdf`} target="_blank" rel="noreferrer" className={link}>
                      PDF
                    </a>
                    <a
                      href={`/api/fotografo/disenos/${d.id}/jpg`}
                      target="_blank"
                      rel="noreferrer"
                      className={link}
                      title="JPG de 300 dpi para imprenta, un archivo por cara"
                    >
                      JPG
                    </a>
                  </span>
                </div>
                {d.emptySlots > 0 ? <p className="mt-1 text-xs text-amber-300">{d.emptySlots} lugar(es) sin foto</p> : null}
                {/* La nota sólo vale mientras se esperan los cambios: aprobado, ya quedó atrás. */}
                {d.reviewNote && d.status === "NEEDS_ADJUSTMENT" ? (
                  <p className="mt-1 text-xs text-sky-300">Cambio pedido: “{d.reviewNote}”</p>
                ) : null}
                {d.printBatchName || d.sentToPrintAt || d.printedAt || d.deliveredAt ? (
                  <p className="mt-1 text-xs text-white/50">
                    {[
                      d.printBatchName,
                      d.sentToPrintAt ? `a imprenta ${fechaArgentina(d.sentToPrintAt)}` : null,
                      d.printedAt ? `impreso ${fechaArgentina(d.printedAt)}` : null,
                      d.deliveredAt ? `entregado ${fechaArgentina(d.deliveredAt)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {o.copias ? (
        <p className="-mt-2 text-xs text-white/50">
          {[
            o.copias.printBatchName,
            o.copias.sentToPrintAt ? `a imprenta ${fechaArgentina(o.copias.sentToPrintAt)}` : "Todavía no se mandó a imprimir",
            o.copias.printedAt ? `impreso ${fechaArgentina(o.copias.printedAt)}` : null,
            o.copias.deliveredAt ? `entregado ${fechaArgentina(o.copias.deliveredAt)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      <Descargas o={o} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <Link
          href={`/fotografo/escuelas/pedidos${paso ? `?paso=${paso}` : ""}`}
          className="text-sm text-white/60 hover:text-white hover:underline"
        >
          Ver en Pedidos escolares
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {t.vuelta.puede ? (
            <button
              type="button"
              onClick={() => t.vuelta.puede && onMover(t.vuelta)}
              className="rounded-lg border border-sky-400/40 px-3 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-400/10"
            >
              ← Volver a «{INFO_PASOS[t.vuelta.destino].titulo}»
            </button>
          ) : null}
          {t.plan.puede ? (
            <button
              type="button"
              onClick={() => t.plan.puede && onMover(t.plan)}
              className="rounded-lg bg-[#c27b3d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d08a4b]"
            >
              Pasar a «{INFO_PASOS[t.plan.destino].titulo}» →
            </button>
          ) : (
            <p className="max-w-xs text-right text-xs text-white/45">
              {siguiente ? `No se puede pasar a «${INFO_PASOS[siguiente].titulo}» desde acá: ` : ""}
              {t.plan.motivo}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
