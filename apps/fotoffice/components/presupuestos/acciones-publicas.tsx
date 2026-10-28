"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { aceptarPresupuestoAction, pedirPresupuestoNuevoAction } from "@/app/w/[workspaceSlug]/presupuesto/[token]/actions";
import { pesos } from "@/lib/presupuestos/editor";
import { pesosCuota, type OpcionPublica } from "@/lib/presupuestos/opciones-pago";
import type { AlternativaDeLaVista, EstadoDeLaVista } from "@/lib/presupuestos/vista-publica";
import { TarjetaAlternativa, totalDeAlternativa } from "./tarjeta-alternativa";

/**
 * Lo que hace el cliente en el enlace público, en tres pasos: elegir la opción (Básico,
 * Premium…; sin opciones, se saltea), elegir cómo pagarla (contado o un plan de cuotas, cada uno
 * con lo que paga por cuota y el total) y confirmar con su nombre. Al confirmar, si la organización
 * tiene encendido «Crear el pedido al aceptar», nace el pedido con sus cuotas y el cliente pasa a su
 * enlace para hacer el primer pago. Las reglas (una sola aceptación, versión vigente, vencimiento,
 * forma de pago válida) las vuelve a mirar el servidor.
 *
 * Una barra fija abajo muestra lo elegido y lleva al paso que falta. Además: «Tengo dudas»
 * (WhatsApp o correo), «Descargar PDF» y, si venció, «Pedir uno nuevo».
 */

export function AccionesPublicas({
  slug,
  token,
  estado,
  whatsappUrl,
  email,
  hrefImprimir,
  opciones = [],
  total = 0,
  alternativas = [],
  pedidoAutomatico = false,
  condiciones = null,
}: {
  slug: string;
  token: string;
  estado: EstadoDeLaVista;
  whatsappUrl: string | null;
  email: string | null;
  hrefImprimir: string;
  /** Formas de pago del presupuesto sin opciones (congeladas en la versión). */
  opciones?: OpcionPublica[];
  /** Total del presupuesto sin opciones (con IVA si tiene). */
  total?: number;
  /** Opciones del presupuesto ([] si no tiene). */
  alternativas?: AlternativaDeLaVista[];
  /** ¿Al confirmar se crea el pedido? Sólo cambia los textos. */
  pedidoAutomatico?: boolean;
  /** Las condiciones del presupuesto (del servidor): van antes de confirmar, para leerlas antes de aceptarlas. */
  condiciones?: ReactNode;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [nombre, setNombre] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Con una sola opción del presupuesto, ya está elegida; con varias, la elige el cliente.
  const [alternativa, setAlternativa] = useState<string | null>(alternativas.length === 1 ? alternativas[0]!.id : null);
  const elegida = alternativas.find((a) => a.id === alternativa) ?? null;
  const conAlternativas = alternativas.length > 0;
  const formasDePago = conAlternativas ? (elegida?.opcionesPago ?? []) : opciones;
  const base = elegida ? totalDeAlternativa(elegida) : total;
  const [opcion, setOpcion] = useState<string | null>(formasDePago.length === 1 ? formasDePago[0]!.id : null);
  const forma = formasDePago.find((o) => o.id === opcion) ?? null;

  const pasoPago = useRef<HTMLElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const [formularioVisible, setFormularioVisible] = useState(false);

  useEffect(() => {
    const f = formulario.current;
    if (!f || typeof IntersectionObserver === "undefined") return;
    const o = new IntersectionObserver(([e]) => setFormularioVisible(Boolean(e?.isIntersecting)), { rootMargin: "0px 0px -20% 0px" });
    o.observe(f);
    return () => o.disconnect();
  }, [estado]);

  const ir = (el: HTMLElement | null) => el?.scrollIntoView({ behavior: "smooth", block: "start" });

  function elegirAlternativa(id: string) {
    const a = alternativas.find((x) => x.id === id);
    if (!a) return;
    setAlternativa(id);
    // La forma de pago se vuelve a elegir: los importes son otros.
    setOpcion(a.opcionesPago.length === 1 ? a.opcionesPago[0]!.id : null);
    setTimeout(() => ir(pasoPago.current), 50);
  }

  function elegirForma(id: string) {
    setOpcion(id);
    setTimeout(() => ir(formulario.current), 50);
  }

  function aceptar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await aceptarPresupuestoAction(slug, token, nombre, acepta, opcion, alternativa).catch(() => ({ ok: false as const, error: "No pudimos registrar tu aceptación. Probá de nuevo." }));
      // Si se creó el pedido, el cliente pasa a su enlace para hacer el primer pago.
      if (r.ok && r.pedidoUrl) window.location.assign(r.pedidoUrl);
      else if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function pedirNuevo() {
    setError(null);
    iniciar(async () => {
      const r = await pedirPresupuestoNuevoAction(slug, token).catch(() => ({ ok: false as const, error: "No pudimos avisar. Probá de nuevo." }));
      if (r.ok) setAviso("Listo: les avisamos que querés un presupuesto nuevo. Te van a escribir.");
      else setError(r.error);
    });
  }

  const dudas = whatsappUrl ? (
    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="fo-btn fo-btn-secondary text-sm">
      Tengo dudas · escribinos
    </a>
  ) : email ? (
    <a href={`mailto:${email}`} className="fo-btn fo-btn-secondary text-sm">
      Tengo dudas · escribinos
    </a>
  ) : null;

  // Sin elegir opción (una sola o ninguna) los pasos empiezan en «Elegí cómo pagar».
  const numero = (n: number) => (alternativas.length > 1 ? n : n - 1);
  const faltaOpcion = conAlternativas && !elegida;
  const faltaForma = formasDePago.length > 0 && !forma;
  const listo = !faltaOpcion && !faltaForma;
  const primerPago = forma ? (forma.sena > 0 ? forma.sena : forma.cuotas > 1 ? forma.importeCuota : forma.total) : null;

  return (
    <div className="no-imprimir space-y-14">
      {estado === "ACTIVO" ? (
        <>
          {alternativas.length > 1 ? (
            <section aria-labelledby="paso-opcion" className="space-y-6">
              <Titulo id="paso-opcion" n={1} titulo="Elegí tu opción" bajada="Tocá «Elegir» en la que más te guste. Podés cambiarla cuando quieras." />
              <div className={`grid gap-6 pt-2 ${alternativas.length >= 4 ? "md:grid-cols-2 xl:grid-cols-4" : alternativas.length >= 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"}`}>
                {alternativas.map((a, i) => (
                  <TarjetaAlternativa key={a.id} a={a} anterior={alternativas[i - 1]} seleccionada={a.id === alternativa} onElegir={() => elegirAlternativa(a.id)} />
                ))}
              </div>
            </section>
          ) : alternativas.length === 1 ? (
            <div className="mx-auto max-w-md pt-2">
              <TarjetaAlternativa a={alternativas[0]!} />
            </div>
          ) : null}

          {formasDePago.length > 0 || faltaOpcion ? (
            <section ref={pasoPago} aria-labelledby="paso-pago" className="scroll-mt-6 space-y-6">
              <Titulo
                id="paso-pago"
                n={numero(2)}
                titulo="Elegí cómo pagar"
                bajada={elegida && alternativas.length > 1 ? `Formas de pago para ${elegida.nombre} (${pesos(base)}).` : "Pagá todo junto o en cuotas: elegí la que te quede mejor."}
              />
              {faltaOpcion ? (
                <p className="rounded-2xl border border-dashed border-[var(--fo-border-strong)] p-6 text-center text-sm text-[var(--fo-muted)]">
                  Primero elegí una opción y acá te mostramos cómo podés pagarla.
                </p>
              ) : (
                <div role="radiogroup" aria-labelledby="paso-pago" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {formasDePago.map((o) => (
                    <FormaDePago key={o.id} o={o} base={base} elegida={o.id === opcion} onElegir={() => elegirForma(o.id)} />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {condiciones ? <div>{condiciones}</div> : null}

          <section aria-labelledby="paso-confirmar" className="space-y-6">
            <Titulo
              id="paso-confirmar"
              n={numero(3)}
              titulo="Confirmá y reservá"
              bajada={pedidoAutomatico ? "Al confirmar se crea tu pedido y te mostramos cómo hacer el primer pago." : "Al confirmar te escribimos para coordinar el pago y los detalles."}
            />
            <form ref={formulario} onSubmit={aceptar} className="grid scroll-mt-6 gap-6 rounded-2xl border border-[var(--fo-border)] bg-[var(--fo-surface)] p-6 shadow-sm md:grid-cols-2 md:p-8">
              <dl className="space-y-3 rounded-xl bg-[var(--fo-surface-hover)] p-5 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fo-muted)]">Tu elección</p>
                {conAlternativas ? <Fila t="Opción" v={elegida?.nombre ?? "Sin elegir"} falta={!elegida} /> : null}
                {formasDePago.length > 0 ? <Fila t="Forma de pago" v={forma ? tituloForma(forma) : "Sin elegir"} falta={!forma} /> : null}
                {forma?.medio ? <Fila t="Medio" v={forma.medio === "MERCADO_PAGO" ? "Mercado Pago" : "Transferencia o efectivo"} /> : null}
                {primerPago !== null && forma && (forma.sena > 0 || forma.cuotas > 1) ? (
                  <Fila t={forma.sena > 0 ? "Seña para reservar" : "Primera cuota"} v={pesosCuota(primerPago)} />
                ) : null}
                <div className="flex items-baseline justify-between gap-3 border-t border-[var(--fo-border)] pt-3">
                  <dt className="font-semibold">Total</dt>
                  <dd className="text-xl font-bold tabular-nums">{faltaOpcion ? "—" : pesos(forma ? forma.total : base)}</dd>
                </div>
              </dl>

              <div className="space-y-4">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Tu nombre y apellido</span>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    maxLength={120}
                    autoComplete="name"
                    required
                    className="fo-input w-full"
                  />
                </label>
                <label className="flex items-start gap-2.5 text-sm">
                  <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span>Leí el presupuesto y acepto sus condiciones.</span>
                </label>
                <button
                  type="submit"
                  className="fo-btn fo-btn-primary w-full py-3 text-base font-semibold"
                  disabled={pendiente || !acepta || nombre.trim().length < 2 || !listo}
                >
                  {pendiente ? "Registrando…" : faltaOpcion ? "Elegí una opción" : faltaForma ? "Elegí cómo pagar" : pedidoAutomatico ? "Confirmar y crear mi pedido" : "Confirmar"}
                </button>
                {error ? (
                  <p role="alert" className="text-sm text-[var(--fo-danger)]">
                    {error}
                  </p>
                ) : null}
              </div>
            </form>
          </section>

          {!formularioVisible && (elegida || !conAlternativas) ? (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--fo-border)] bg-[var(--fo-surface)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-8">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-semibold">{elegida && alternativas.length > 1 ? elegida.nombre : "Tu presupuesto"}</p>
                  <p className="truncate text-[var(--fo-muted)]">{forma ? `${tituloForma(forma)} · ${pesos(forma.total)}` : pesos(base)}</p>
                </div>
                <button type="button" className="fo-btn fo-btn-primary shrink-0 text-sm" onClick={() => ir(faltaForma ? pasoPago.current : formulario.current)}>
                  {faltaForma ? "Elegir cómo pagar" : "Confirmar"}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {estado === "VENCIDO" ? (
        <div className="fo-card space-y-2 p-4">
          <p className="font-semibold">Este presupuesto venció.</p>
          {aviso ? (
            <p role="status" className="text-sm">{aviso}</p>
          ) : (
            <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={pedirNuevo}>
              Pedir uno nuevo
            </button>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {dudas}
        <a href={hrefImprimir} className="fo-btn fo-btn-secondary text-sm" rel="nofollow">
          Descargar PDF
        </a>
      </div>

      {error && estado !== "ACTIVO" ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Titulo({ id, n, titulo, bajada }: { id: string; n: number; titulo: string; bajada: string }) {
  return (
    <div className="flex items-start gap-4">
      {n > 0 ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent)] text-base font-bold text-[var(--fo-on-accent,#fff)]">{n}</span>
      ) : null}
      <div>
        <h2 id={id} className="text-2xl font-semibold tracking-tight">
          {titulo}
        </h2>
        <p className="mt-1 text-sm text-[var(--fo-muted)]">{bajada}</p>
      </div>
    </div>
  );
}

function Fila({ t, v, falta = false }: { t: string; v: string; falta?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--fo-muted)]">{t}</dt>
      <dd className={`text-right font-medium ${falta ? "text-[var(--fo-muted)]" : ""}`}>{v}</dd>
    </div>
  );
}

/** «Un solo pago» o «6 cuotas». */
function tituloForma(o: OpcionPublica): string {
  return o.cuotas > 1 ? `${o.cuotas} cuotas` : "Un solo pago";
}

/** Una forma de pago como tarjeta para tocar: cuánto por cuota, el total y si ahorra o recarga. */
function FormaDePago({ o, base, elegida, onElegir }: { o: OpcionPublica; base: number; elegida: boolean; onElegir: () => void }) {
  const ahorro = base - o.total;
  const etiqueta =
    ahorro > 0.5
      ? { texto: `Ahorrás ${pesos(ahorro)}`, clase: "bg-[var(--fo-success-soft)] text-[var(--fo-success)]" }
      : ahorro < -0.5
        ? { texto: `Recargo ${pesos(-ahorro)}`, clase: "bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]" }
        : o.cuotas > 1
          ? { texto: "Sin interés", clase: "bg-[var(--fo-accent-soft)] text-[var(--fo-accent-hover)]" }
          : null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={elegida}
      onClick={onElegir}
      className={`flex flex-col gap-3 rounded-2xl border bg-[var(--fo-surface)] p-5 text-left transition-shadow hover:shadow-md ${
        elegida ? "border-[var(--fo-accent)] shadow-md ring-2 ring-[var(--fo-accent)]" : "border-[var(--fo-border)] shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold">{tituloForma(o)}</span>
        <span
          aria-hidden
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${elegida ? "border-[var(--fo-accent)] bg-[var(--fo-accent)]" : "border-[var(--fo-border-strong)]"}`}
        >
          {elegida ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
        </span>
      </div>
      {o.sena > 0 ? (
        <div>
          <p className="text-2xl font-bold tabular-nums">{pesosCuota(o.sena)}</p>
          <p className="text-sm text-[var(--fo-muted)]">
            de seña{o.cuotas > 1 ? ` + ${o.cuotas} cuotas de ${pesosCuota(o.importeCuota)}` : ` + saldo de ${pesosCuota(o.importeCuota)}`}
          </p>
        </div>
      ) : (
        <p className="text-2xl font-bold tabular-nums">
          {o.cuotas > 1 ? pesosCuota(o.importeCuota) : pesos(o.total)}
          {o.cuotas > 1 ? <span className="text-sm font-medium text-[var(--fo-muted)]"> por cuota</span> : null}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[var(--fo-muted)]">Total {pesos(o.total)}</span>
        {etiqueta ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${etiqueta.clase}`}>{etiqueta.texto}</span> : null}
      </div>
      {o.medio ? <p className="text-xs text-[var(--fo-muted)]">{o.medio === "MERCADO_PAGO" ? "Con Mercado Pago" : "Por transferencia o en efectivo"}</p> : null}
      {o.nota ? <p className="text-xs text-[var(--fo-muted)]">{o.nota}</p> : null}
    </button>
  );
}
