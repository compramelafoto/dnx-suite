"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Mail, MessageCircle, Search, Truck, Wallet } from "lucide-react";
import { cerrarAction, moverAction } from "@/app/actions/circuitos";
import { avisarListoAction } from "@/app/actions/proyectos-proveedor";
import { formatMinorArs } from "@/lib/membership/money";
import { FASES, FASE_INFO, etapaSiguiente, urgenciaDeEntrega, type Fase, type Urgencia } from "@/lib/proyectos/en-curso-puro";
import type { TarjetaTrabajo } from "@/lib/proyectos/en-curso";

/** Color de cada columna: el mismo criterio que los colores de las etapas de DNX. */
const COLOR_FASE: Record<Fase, { barra: string; punto: string; suave: string }> = {
  RECIBIDO: { barra: "bg-slate-400", punto: "bg-slate-400", suave: "bg-slate-400/10" },
  EN_PROCESO: { barra: "bg-sky-500", punto: "bg-sky-500", suave: "bg-sky-500/10" },
  EN_PROVEEDOR: { barra: "bg-violet-500", punto: "bg-violet-500", suave: "bg-violet-500/10" },
  LISTO: { barra: "bg-amber-400", punto: "bg-amber-400", suave: "bg-amber-400/15" },
  ENTREGADO: { barra: "bg-emerald-500", punto: "bg-emerald-500", suave: "bg-emerald-500/10" },
};

const ESTILO_URGENCIA: Record<Urgencia, string> = {
  VENCIDO: "bg-[var(--fo-danger-soft)] text-[var(--fo-danger)] font-semibold",
  HOY: "bg-amber-400/20 text-amber-800 font-semibold",
  PRONTO: "bg-amber-400/10 text-amber-800",
  OK: "bg-[var(--fo-surface-hover)] text-[var(--fo-text-secondary)]",
  SIN_FECHA: "bg-[var(--fo-surface-hover)] text-[var(--fo-muted)]",
};

function fechaCorta(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

function textoEntrega(entrega: string | null, u: Urgencia): string {
  if (!entrega) return "Sin fecha";
  if (u === "VENCIDO") return `Vencido ${fechaCorta(entrega)}`;
  if (u === "HOY") return "Hoy";
  return `Entrega ${fechaCorta(entrega)}`;
}

/** wa.me con el número argentino normalizado (10 dígitos → 549…). null si no se entiende. */
function enlaceWhatsApp(telefono: string | null, texto: string): string | null {
  if (!telefono) return null;
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = `549${d}`;
  else if (d.length === 12 && d.startsWith("54") && !d.startsWith("549")) d = `549${d.slice(2)}`;
  if (d.length < 11) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

export function TableroEnCurso({
  tarjetas,
  hoy,
  estudio,
  puedeOperar,
}: {
  tarjetas: TarjetaTrabajo[];
  /** "aaaa-mm-dd" en Argentina. */
  hoy: string;
  estudio: string;
  puedeOperar: boolean;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [recorrido, setRecorrido] = useState<string>("");
  const [proveedor, setProveedor] = useState<string>("");
  const [soloVencidos, setSoloVencidos] = useState(false);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [, start] = useTransition();

  const recorridos = useMemo(() => {
    const m = new Map<string, { nombre: string; n: number }>();
    for (const t of tarjetas) {
      const r = m.get(t.recorrido.id) ?? { nombre: t.recorrido.nombre, n: 0 };
      r.n++;
      m.set(t.recorrido.id, r);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [tarjetas]);
  const proveedores = useMemo(() => [...new Set(tarjetas.map((t) => t.proveedor).filter((p): p is string => p !== null))].sort(), [tarjetas]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return tarjetas.filter((t) => {
      if (recorrido && t.recorrido.id !== recorrido) return false;
      if (proveedor && t.proveedor !== proveedor) return false;
      if (soloVencidos && (t.cerrado || urgenciaDeEntrega(t.entrega, hoy) !== "VENCIDO")) return false;
      if (q && !`${t.cliente} ${t.nombre} ${t.numero} ${t.pedido?.numero ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tarjetas, busqueda, recorrido, proveedor, soloVencidos, hoy]);

  const abiertas = tarjetas.filter((t) => !t.cerrado);
  const vencidas = abiertas.filter((t) => t.fase !== "ENTREGADO" && urgenciaDeEntrega(t.entrega, hoy) === "VENCIDO").length;
  const listas = abiertas.filter((t) => t.fase === "LISTO").length;
  const saldo = [...new Map(abiertas.filter((t) => t.pedido).map((t) => [t.pedido!.id, t.pedido!.saldoMinor])).values()].reduce((a, b) => a + b, 0);

  const porFase = (f: Fase) =>
    visibles
      .filter((t) => t.fase === f)
      .sort((a, b) => (a.entrega ?? "9999").localeCompare(b.entrega ?? "9999") || a.cliente.localeCompare(b.cliente));

  function avisarPorCorreo(t: TarjetaTrabajo) {
    setOcupada(t.journeyId);
    setAviso(null);
    start(async () => {
      const r = await avisarListoAction(t.proyectoId);
      setOcupada(null);
      setAviso(r.ok ? { ok: true, texto: `${t.cliente}: aviso enviado a ${r.email}.` } : { ok: false, texto: `${t.cliente}: ${r.error}` });
    });
  }

  function avanzar(t: TarjetaTrabajo) {
    if (!t.etapaActualId) return;
    const siguiente = etapaSiguiente(t.etapas, t.etapaActualId);
    setOcupada(t.journeyId);
    setAviso(null);
    start(async () => {
      const r = siguiente
        ? await moverAction({ journeyId: t.journeyId, destinoId: siguiente.id, esperado: t.enteredStageAt })
        : await cerrarAction({ journeyId: t.journeyId, salida: "TERMINADO", esperado: t.enteredStageAt });
      setOcupada(null);
      if (r.ok) {
        setAviso({ ok: true, texto: siguiente ? `${t.cliente}: pasó a «${siguiente.name}».` : `${t.cliente}: trabajo terminado.` });
        router.refresh();
      } else {
        setAviso({ ok: false, texto: `${t.cliente}: ${r.error}` });
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador icono={<ClipboardList className="size-4" />} titulo="En curso" valor={String(abiertas.length)} />
        <Indicador
          icono={<AlertTriangle className="size-4" />}
          titulo="Vencidos"
          valor={String(vencidas)}
          tono={vencidas > 0 ? "peligro" : undefined}
          onClick={vencidas > 0 ? () => setSoloVencidos(true) : undefined}
        />
        <Indicador icono={<CheckCircle2 className="size-4" />} titulo="Listos para retirar" valor={String(listas)} tono={listas > 0 ? "aviso" : undefined} />
        <Indicador icono={<Wallet className="size-4" />} titulo="Saldo por cobrar" valor={formatMinorArs(saldo).replace(",00", "")} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fo-muted)]" aria-hidden />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente, trabajo o número"
            className="fo-input h-10 !pl-9 text-sm"
            aria-label="Buscar trabajo"
          />
        </div>
        {proveedores.length > 0 ? (
          <div className="w-56 shrink-0">
          <select value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="fo-input h-10 text-sm" aria-label="Proveedor">
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          </div>
        ) : null}
        <label className="flex h-10 shrink-0 items-center gap-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] px-3 text-sm">
          <input type="checkbox" checked={soloVencidos} onChange={(e) => setSoloVencidos(e.target.checked)} />
          Sólo vencidos
        </label>
      </div>
      {recorridos.length > 1 ? (
        <div className="-mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Recorridos">
          {[["", { nombre: "Todos", n: tarjetas.length }] as const, ...recorridos].map(([id, r]) => (
            <button
              key={id || "todos"}
              type="button"
              role="tab"
              aria-selected={recorrido === id}
              onClick={() => setRecorrido(id)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                recorrido === id
                  ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-[var(--fo-on-accent,#fff)]"
                  : "border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
              }`}
            >
              {r.nombre} <span className="opacity-70">{r.n}</span>
            </button>
          ))}
        </div>
      ) : null}

      {aviso ? (
        <p role="status" className={`text-sm ${aviso.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}`}>
          {aviso.texto}
        </p>
      ) : null}

      {/* Tablero */}
      {tarjetas.length === 0 ? (
        <div className="fo-card flex flex-col items-center gap-2 px-6 py-14 text-center text-sm text-[var(--fo-muted)]">
          <ClipboardList className="size-8" aria-hidden />
          <p>No hay trabajos en curso. Se crean solos al cobrar en el Mostrador un producto con proceso.</p>
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto pb-2">
          <div className="grid min-w-[1100px] grid-cols-5 gap-3 px-1">
            {FASES.map((f) => {
              const lista = porFase(f);
              return (
                <section key={f} className="flex min-w-0 flex-col gap-2" aria-label={FASE_INFO[f].titulo}>
                  <header className={`rounded-[var(--fo-radius-sm)] ${COLOR_FASE[f].suave} px-3 py-2`}>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="flex items-center gap-2 text-sm font-semibold">
                        <span className={`size-2.5 rounded-full ${COLOR_FASE[f].punto}`} aria-hidden />
                        {FASE_INFO[f].titulo}
                      </h2>
                      <span className="rounded-full bg-[var(--fo-bg-elevated)] px-2 text-xs font-semibold tabular-nums">{lista.length}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--fo-muted)]">{FASE_INFO[f].ayuda}</p>
                  </header>
                  {lista.length === 0 ? (
                    <p className="rounded-[var(--fo-radius-sm)] border border-dashed border-[var(--fo-border)] px-3 py-6 text-center text-xs text-[var(--fo-muted-soft)]">
                      Nada acá
                    </p>
                  ) : (
                    lista.map((t) => (
                      <Tarjeta
                        key={t.journeyId}
                        t={t}
                        hoy={hoy}
                        estudio={estudio}
                        puedeOperar={puedeOperar}
                        ocupada={ocupada === t.journeyId}
                        onAvanzar={() => avanzar(t)}
                        onCorreo={() => avisarPorCorreo(t)}
                      />
                    ))
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Indicador({
  icono,
  titulo,
  valor,
  tono,
  onClick,
}: {
  icono: React.ReactNode;
  titulo: string;
  valor: string;
  tono?: "peligro" | "aviso";
  onClick?: () => void;
}) {
  const color = tono === "peligro" ? "text-[var(--fo-danger)]" : tono === "aviso" ? "text-amber-700" : "text-[var(--fo-text)]";
  const contenido = (
    <>
      <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--fo-muted)]">
        {icono}
        {titulo}
      </span>
      <span className={`text-2xl font-bold tabular-nums ${color}`}>{valor}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="fo-card flex flex-col items-start gap-1 p-4 text-left transition hover:border-[var(--fo-accent)]">
      {contenido}
    </button>
  ) : (
    <div className="fo-card flex flex-col gap-1 p-4">{contenido}</div>
  );
}

function Tarjeta({
  t,
  hoy,
  estudio,
  puedeOperar,
  ocupada,
  onAvanzar,
  onCorreo,
}: {
  t: TarjetaTrabajo;
  hoy: string;
  estudio: string;
  puedeOperar: boolean;
  ocupada: boolean;
  onAvanzar: () => void;
  onCorreo: () => void;
}) {
  const orden = [...t.etapas].sort((a, b) => a.order - b.order);
  const indice = t.cerrado ? orden.length : Math.max(0, orden.findIndex((e) => e.id === t.etapaActualId));
  const actual = t.cerrado ? null : (orden[indice] ?? null);
  const siguiente = actual ? etapaSiguiente(orden, actual.id) : null;
  const u = t.cerrado ? "OK" : urgenciaDeEntrega(t.entrega, hoy);
  const debe = t.pedido && t.pedido.saldoMinor > 0 ? t.pedido.saldoMinor : 0;
  const whatsapp =
    t.fase === "LISTO"
      ? enlaceWhatsApp(
          t.telefono,
          `Hola ${t.cliente.split(" ")[0]}! Tu pedido de ${estudio} (${t.producto ?? t.nombre}) ya está listo para retirar.${
            debe > 0 ? ` Queda un saldo de ${formatMinorArs(debe)}.` : ""
          } ¡Te esperamos!`,
        )
      : null;

  return (
    <article
      className={`group space-y-2.5 rounded-[var(--fo-radius)] border bg-[var(--fo-bg-elevated)] p-3 shadow-[var(--fo-shadow-xs)] transition hover:shadow-[var(--fo-shadow-sm)] ${
        u === "VENCIDO" ? "border-[var(--fo-danger-border)]" : "border-[var(--fo-border)]"
      } ${ocupada ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/proyectos/${t.proyectoId}`} className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--fo-text)] group-hover:underline">{t.cliente}</p>
          <p className="line-clamp-2 text-xs text-[var(--fo-muted)]">{t.producto ?? t.nombre}</p>
        </Link>
        {t.pedido ? (
          debe > 0 ? (
            <span className="shrink-0 rounded-full bg-[var(--fo-danger-soft)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--fo-danger)]">
              Debe {formatMinorArs(debe).replace(",00", "")}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-[var(--fo-success-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--fo-success)]">Pagado</span>
          )
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1">
        <span className="rounded-full bg-[var(--fo-surface-hover)] px-2 py-0.5 text-[11px] text-[var(--fo-text-secondary)]">{t.recorrido.nombre}</span>
        {t.proveedor ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-800">
            <Truck className="size-3" aria-hidden />
            {t.proveedor}
          </span>
        ) : null}
      </div>

      {/* Avance: un segmento por etapa, lleno hasta la actual. */}
      {orden.length > 0 ? (
        <div className="space-y-1">
          <div className="flex gap-0.5" aria-hidden>
            {orden.map((e, i) => (
              <span
                key={e.id}
                className={`h-1.5 flex-1 rounded-full ${i < indice ? "bg-[var(--fo-accent)]" : i === indice ? "bg-[var(--fo-accent)] opacity-60" : "bg-[var(--fo-border)]"}`}
              />
            ))}
          </div>
          <p className="truncate text-[11px] text-[var(--fo-muted)]">
            {t.cerrado ? "Terminado" : `Paso ${indice + 1} de ${orden.length} · ${actual?.name ?? ""}`}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] tabular-nums ${ESTILO_URGENCIA[u]}`}>
          <CalendarDays className="size-3" aria-hidden />
          {t.cerrado ? "Entregado" : textoEntrega(t.entrega, u)}
        </span>
        <span className="text-[11px] text-[var(--fo-muted-soft)]">{t.pedido ? `Pedido ${t.pedido.numero}` : t.numero}</span>
      </div>

      {!t.cerrado && puedeOperar ? (
        <div className="flex gap-1.5">
          {t.fase === "LISTO" && t.email ? (
            <button
              type="button"
              onClick={onCorreo}
              disabled={ocupada}
              className="fo-btn fo-btn-secondary gap-1 px-2.5 text-xs"
              title={`Mandar el aviso por correo a ${t.email}`}
            >
              <Mail className="size-3.5" aria-hidden />
              Correo
            </button>
          ) : null}
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="fo-btn fo-btn-secondary gap-1 px-2.5 text-xs"
              title="Avisarle por WhatsApp que está listo"
            >
              <MessageCircle className="size-3.5" aria-hidden />
              Avisar
            </a>
          ) : null}
          <button
            type="button"
            onClick={onAvanzar}
            disabled={ocupada}
            className="fo-btn fo-btn-secondary min-w-0 flex-1 justify-between gap-1 px-2.5 text-xs"
            title={siguiente ? `Pasar a «${siguiente.name}»` : "Terminar el trabajo"}
          >
            <span className="truncate">{siguiente ? siguiente.name : "Terminar"}</span>
            {siguiente ? <ArrowRight className="size-3.5 shrink-0" aria-hidden /> : <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />}
          </button>
        </div>
      ) : null}
    </article>
  );
}
