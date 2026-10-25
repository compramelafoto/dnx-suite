"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { aceptarPresupuestoAction, pedirPresupuestoNuevoAction } from "@/app/w/[workspaceSlug]/presupuesto/[token]/actions";
import { pesos } from "@/lib/presupuestos/editor";
import { importeDeOpcion, type OpcionPublica } from "@/lib/presupuestos/opciones-pago";
import type { EstadoDeLaVista } from "@/lib/presupuestos/vista-publica";

/**
 * Botones del enlace público: "Acepto" (nombre + tilde + forma de pago, por omisión la primera),
 * "Tengo dudas" (WhatsApp de la organización), "Descargar PDF" (vista para imprimir) y, si venció, "Pedir uno nuevo". Las
 * reglas (una sola aceptación, versión vigente, vencimiento) las vuelve a mirar el servidor.
 *
 * Con opciones (Básico, Premium…): «Elegir esta» en cada tarjeta lleva a `#elegir-<id>`, que elige
 * esa opción acá y baja hasta el formulario. Las formas de pago son las de la opción elegida.
 */

/** Una opción del presupuesto, lo justo para elegirla al aceptar. */
export type AlternativaParaAceptar = { id: string; nombre: string; total: number; opciones: OpcionPublica[] };
export function AccionesPublicas({
  slug,
  token,
  estado,
  whatsappUrl,
  email,
  hrefImprimir,
  opciones = [],
  alternativas = [],
}: {
  slug: string;
  token: string;
  estado: EstadoDeLaVista;
  whatsappUrl: string | null;
  email: string | null;
  hrefImprimir: string;
  /** Opciones de pago congeladas en la versión (sin costos). */
  opciones?: OpcionPublica[];
  /** Opciones del presupuesto para elegir ([] si no tiene). */
  alternativas?: AlternativaParaAceptar[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [nombre, setNombre] = useState("");
  const [acepta, setAcepta] = useState(false);
  // Con una sola opción del presupuesto, ya está elegida; con varias, la elige el cliente.
  const [alternativa, setAlternativa] = useState<string | null>(alternativas.length === 1 ? alternativas[0]!.id : null);
  const elegida = alternativas.find((a) => a.id === alternativa) ?? null;
  const formasDePago = alternativas.length > 0 ? (elegida?.opciones ?? []) : opciones;
  const [opcion, setOpcion] = useState<string | null>(formasDePago[0]?.id ?? null);
  const formulario = useRef<HTMLFormElement>(null);

  function elegirAlternativa(id: string) {
    const a = alternativas.find((x) => x.id === id);
    if (!a) return;
    setAlternativa(id);
    setOpcion(a.opciones[0]?.id ?? null);
  }

  // «Elegir esta» en una tarjeta: `#elegir-<id>`.
  useEffect(() => {
    if (alternativas.length === 0) return;
    const leer = () => {
      const m = /^#elegir-(.+)$/.exec(window.location.hash);
      if (!m) return;
      const id = decodeURIComponent(m[1]!);
      const a = alternativas.find((x) => x.id === id);
      if (!a) return;
      setAlternativa(a.id);
      setOpcion(a.opciones[0]?.id ?? null);
      formulario.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    leer();
    window.addEventListener("hashchange", leer);
    return () => window.removeEventListener("hashchange", leer);
  }, [alternativas]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function aceptar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await aceptarPresupuestoAction(slug, token, nombre, acepta, opcion, alternativa).catch(() => ({ ok: false as const, error: "No pudimos registrar tu aceptación. Probá de nuevo." }));
      // Etapa B: si se creó el pedido, el cliente pasa a su enlace para pagar la seña.
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
      Tengo dudas
    </a>
  ) : email ? (
    <a href={`mailto:${email}`} className="fo-btn fo-btn-secondary text-sm">
      Tengo dudas
    </a>
  ) : null;

  return (
    <div className="no-imprimir space-y-4">
      {estado === "ACTIVO" ? (
        <form ref={formulario} onSubmit={aceptar} className="fo-card scroll-mt-4 space-y-3 p-4">
          <h2 className="text-base font-semibold">¿Te sirve? Aceptalo acá</h2>
          {alternativas.length > 1 ? (
            <fieldset className="space-y-2 text-sm">
              <legend className="mb-1">¿Qué opción elegís?</legend>
              {alternativas.map((a) => (
                <label key={a.id} className="flex items-start gap-2">
                  <input type="radio" name="alternativa" value={a.id} checked={alternativa === a.id} onChange={() => elegirAlternativa(a.id)} className="mt-1" />
                  <span>
                    <span className="font-medium">{a.nombre}</span>
                    <span className="block tabular-nums opacity-75">{pesos(a.total)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <label className="block space-y-1 text-sm">
            <span>Tu nombre y apellido</span>
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
          {formasDePago.length > 0 ? (
            <fieldset className="space-y-2 text-sm">
              <legend className="mb-1">¿Cómo vas a pagar?{elegida && alternativas.length > 1 ? ` (${elegida.nombre})` : ""}</legend>
              {formasDePago.map((o) => (
                <label key={o.id} className="flex items-start gap-2">
                  <input type="radio" name="opcion-pago" value={o.id} checked={opcion === o.id} onChange={() => setOpcion(o.id)} className="mt-1" />
                  <span>
                    <span className="font-medium">{o.etiqueta}</span>
                    <span className="block tabular-nums opacity-75">{importeDeOpcion(o)}</span>
                    {o.medio === "TRANSFERENCIA" ? <span className="block text-xs opacity-70">Te mostramos los datos para transferir después de aceptar.</span> : null}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1" />
            <span>Leí el presupuesto y acepto sus condiciones.</span>
          </label>
          <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || !acepta || nombre.trim().length < 2 || (alternativas.length > 0 && !elegida)}>
            {pendiente ? "Registrando…" : alternativas.length > 0 && !elegida ? "Elegí una opción" : "Acepto"}
          </button>
        </form>
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

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
