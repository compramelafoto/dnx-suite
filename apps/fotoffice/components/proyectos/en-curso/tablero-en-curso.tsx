"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, ClipboardList, Mail, MessageCircle, PackageCheck, Search, Send, Wallet } from "lucide-react";
import { cerrarAction, moverAction } from "@/app/actions/circuitos";
import { avisarListoAction, enviarAlProveedorAction, llegoDelProveedorAction } from "@/app/actions/proyectos-proveedor";
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

  function enviarAlProveedor(t: TarjetaTrabajo) {
    if (!t.proveedorId) return;
    setOcupada(t.journeyId);
    setAviso(null);
    start(async () => {
      const r = await enviarAlProveedorAction(t.proyectoId, t.proveedorId as string, "");
      setOcupada(null);
      setAviso(r.ok ? { ok: r.porCorreo, texto: `${t.cliente}: ${r.aviso}` } : { ok: false, texto: `${t.cliente}: ${r.error}` });
      if (r.ok) router.refresh();
    });
  }

  function llego(t: TarjetaTrabajo) {
    setOcupada(t.journeyId);
    setAviso(null);
    start(async () => {
      const r = await llegoDelProveedorAction(t.proyectoId);
      setOcupada(null);
      if (!r.ok) {
        setAviso({ ok: false, texto: `${t.cliente}: ${r.error}` });
        return;
      }
      const correo = r.correo ? ` Se le avisó por correo a ${r.correo}.` : r.avisoError ? ` ${r.avisoError}` : "";
      setAviso({ ok: true, texto: `${t.cliente}: listo para retirar.${correo}` });
      router.refresh();
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
                        onEnviar={() => enviarAlProveedor(t)}
                        onLlego={() => llego(t)}
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

/** Botón chico de ícono, para las acciones secundarias de la tarjeta. */
function BotonIcono({ titulo, onClick, href, disabled, children }: { titulo: string; onClick?: () => void; href?: string; disabled?: boolean; children: React.ReactNode }) {
  const clase =
    "flex size-7 shrink-0 items-center justify-center rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)] transition hover:border-[var(--fo-accent)] hover:text-[var(--fo-text)] disabled:opacity-50";
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" title={titulo} aria-label={titulo} className={clase}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} title={titulo} aria-label={titulo} className={clase}>
      {children}
    </button>
  );
}

/**
 * Tarjeta compacta: tres renglones. Arriba quién y cuánto debe; en el medio qué es; abajo la
 * entrega y la acción que corresponde a la columna:
 * - Recibido / En proceso con proveedor sin enviar: «Enviar a …» (correo al laboratorio y pasa sola a En el proveedor).
 * - En el proveedor: «Llegó» (pasa directo a Listo para retirar y le avisa al cliente por correo).
 * - Listo para retirar: WhatsApp, correo y «Entregado».
 * - El resto: la etapa siguiente.
 */
function Tarjeta({
  t,
  hoy,
  estudio,
  puedeOperar,
  ocupada,
  onAvanzar,
  onCorreo,
  onEnviar,
  onLlego,
}: {
  t: TarjetaTrabajo;
  hoy: string;
  estudio: string;
  puedeOperar: boolean;
  ocupada: boolean;
  onAvanzar: () => void;
  onCorreo: () => void;
  onEnviar: () => void;
  onLlego: () => void;
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
  const porEnviar = (t.fase === "RECIBIDO" || t.fase === "EN_PROCESO") && t.proveedorId !== null && t.enviadoAt === null;
  const detalle = [t.producto ?? t.nombre, t.proveedor].filter(Boolean).join(" · ");
  const ayuda = `${t.recorrido.nombre} · ${t.cerrado ? "Terminado" : `paso ${indice + 1} de ${orden.length}: ${actual?.name ?? ""}`}`;

  let principal: { texto: string; icono: React.ReactNode; onClick: () => void; titulo: string } | null = null;
  if (!t.cerrado && puedeOperar) {
    if (porEnviar) principal = { texto: `Enviar a ${t.proveedor}`, icono: <Send className="size-3.5" aria-hidden />, onClick: onEnviar, titulo: "Le manda el pedido por correo y pasa a En el proveedor" };
    else if (t.fase === "EN_PROVEEDOR") principal = { texto: "Llegó", icono: <PackageCheck className="size-3.5" aria-hidden />, onClick: onLlego, titulo: "Pasa a Listo para retirar y le avisa al cliente por correo" };
    else if (t.fase === "LISTO") principal = { texto: "Entregado", icono: <Check className="size-3.5" aria-hidden />, onClick: onAvanzar, titulo: siguiente ? `Pasar a «${siguiente.name}»` : "Terminar el trabajo" };
    else principal = { texto: siguiente ? siguiente.name : "Terminar", icono: siguiente ? <ArrowRight className="size-3.5" aria-hidden /> : <CheckCircle2 className="size-3.5" aria-hidden />, onClick: onAvanzar, titulo: siguiente ? `Pasar a «${siguiente.name}»` : "Terminar el trabajo" };
  }

  return (
    <article
      title={ayuda}
      className={`group relative space-y-1.5 overflow-hidden rounded-[var(--fo-radius-sm)] border bg-[var(--fo-bg-elevated)] px-2.5 pb-2 pt-2.5 shadow-[var(--fo-shadow-xs)] transition hover:shadow-[var(--fo-shadow-sm)] ${
        u === "VENCIDO" ? "border-[var(--fo-danger-border)]" : "border-[var(--fo-border)]"
      } ${ocupada ? "opacity-60" : ""}`}
    >
      {/* Avance: una línea fina arriba, llena hasta la etapa actual. */}
      {orden.length > 0 ? (
        <div className="absolute inset-x-0 top-0 flex h-[3px] gap-px" aria-hidden>
          {orden.map((e, i) => (
            <span key={e.id} className={`flex-1 ${i <= indice ? "bg-[var(--fo-accent)]" : "bg-[var(--fo-border)]"} ${i === indice ? "opacity-60" : ""}`} />
          ))}
        </div>
      ) : null}

      <div className="flex items-baseline justify-between gap-2">
        <Link href={`/proyectos/${t.proyectoId}`} className="min-w-0 truncate text-[13px] font-semibold text-[var(--fo-text)] hover:underline">
          {t.cliente}
        </Link>
        {t.pedido ? (
          debe > 0 ? (
            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--fo-danger)]">Debe {formatMinorArs(debe).replace(",00", "")}</span>
          ) : (
            <span className="shrink-0 text-[11px] font-semibold text-[var(--fo-success)]">Pagado</span>
          )
        ) : null}
      </div>
      <p className="truncate text-[11px] text-[var(--fo-muted)]">{detalle}</p>

      <div className="flex items-center gap-1.5">
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] tabular-nums ${ESTILO_URGENCIA[u]}`}>
          <CalendarDays className="size-3" aria-hidden />
          {t.cerrado ? "Entregado" : textoEntrega(t.entrega, u)}
        </span>
        <span className="flex-1" />
        {t.fase === "LISTO" && !t.cerrado && puedeOperar ? (
          <>
            {whatsapp ? (
              <BotonIcono titulo="Avisar por WhatsApp" href={whatsapp}>
                <MessageCircle className="size-3.5" aria-hidden />
              </BotonIcono>
            ) : null}
            {t.email ? (
              <BotonIcono titulo={`Reenviar el aviso por correo a ${t.email}`} onClick={onCorreo} disabled={ocupada}>
                <Mail className="size-3.5" aria-hidden />
              </BotonIcono>
            ) : null}
          </>
        ) : null}
        {principal && (porEnviar || t.fase === "EN_PROVEEDOR") && siguiente ? (
          <BotonIcono titulo={`Pasar a «${siguiente.name}» a mano`} onClick={onAvanzar} disabled={ocupada}>
            <ArrowRight className="size-3.5" aria-hidden />
          </BotonIcono>
        ) : null}
        {principal ? (
          <button
            type="button"
            onClick={principal.onClick}
            disabled={ocupada}
            title={principal.titulo}
            className="inline-flex h-7 min-w-0 max-w-[60%] items-center gap-1 rounded-[var(--fo-radius-sm)] bg-[var(--fo-accent)] px-2 text-[11px] font-semibold text-[var(--fo-on-accent,#fff)] transition hover:bg-[var(--fo-accent-hover)] disabled:opacity-50"
          >
            {principal.icono}
            <span className="truncate">{principal.texto}</span>
          </button>
        ) : null}
      </div>
    </article>
  );
}
