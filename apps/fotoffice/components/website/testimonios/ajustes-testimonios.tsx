"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { guardarAjustesTestimoniosAction } from "@/app/actions/testimonios";
import { DIAS_DESPUES_MAX, DIAS_DESPUES_MIN } from "@/lib/testimonios/dominio";

type Inicial = { automaticoEncendido: boolean; diasDespues: number; avisarAlEquipo: boolean; encendidoAt: string | null };

const FECHA = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "long", year: "numeric" });

/**
 * Ajustes de Testimonios. Encender el pedido automático equivale a mandar correos a clientes: por
 * eso se pide confirmarlo, y sólo se invita por proyectos que se finalicen desde ese momento.
 */
export function AjustesTestimonios({
  inicial,
  enlaceAbierto,
  faltaParaElAutomatico,
}: {
  inicial: Inicial;
  enlaceAbierto: string | null;
  /** Por qué el pedido automático no saldría aunque esté encendido (null si está todo en orden). */
  faltaParaElAutomatico: string | null;
}) {
  const [automatico, setAutomatico] = useState(inicial.automaticoEncendido);
  const [dias, setDias] = useState(String(inicial.diasDespues));
  const [avisar, setAvisar] = useState(inicial.avisarAlEquipo);
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();

  // Encender (pasar de apagado a encendido) pide una confirmación aparte.
  const enciende = automatico && !inicial.automaticoEncendido;

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (enciende && !confirmado) {
      setError("Confirmá que querés que FOTOFFICE mande los pedidos solo.");
      return;
    }
    setError(null);
    setAviso(null);
    empezar(async () => {
      try {
        const r = await guardarAjustesTestimoniosAction({ automaticoEncendido: automatico, diasDespues: dias, avisarAlEquipo: avisar });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setConfirmado(false);
        setAviso("Listo: se guardaron los ajustes.");
        router.refresh();
      } catch {
        setError("No pudimos conectar con el servidor. Probá de nuevo.");
      }
    });
  }

  async function copiar() {
    if (!enlaceAbierto) return;
    try {
      await navigator.clipboard.writeText(enlaceAbierto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="fo-card space-y-2" aria-labelledby="tst-enlace">
        <h2 id="tst-enlace" className="text-base font-semibold text-[var(--fo-text)]">
          Enlace para dejar un testimonio
        </h2>
        {enlaceAbierto ? (
          <>
            <p className="text-sm text-[var(--fo-muted)]">
              Compartilo donde quieras (redes, firma del correo). Lo que llegue por acá queda pendiente hasta que lo revises.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-[var(--fo-bg-elevated)] px-2 py-1 text-xs">{enlaceAbierto}</code>
              <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => void copiar()}>
                <Copy size={16} aria-hidden /> {copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
          </>
        ) : (
          <p className="fo-alert-warning text-sm">
            Tu sitio todavía no tiene dirección pública: elegila en Sitio web para poder recibir testimonios.
          </p>
        )}
      </section>

      <form onSubmit={guardar} className="fo-card space-y-4" aria-labelledby="tst-ajustes">
        <h2 id="tst-ajustes" className="text-base font-semibold text-[var(--fo-text)]">
          Avisos y pedido automático
        </h2>
        <fieldset disabled={pendiente} className="space-y-4">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="mt-1" />
            <span>
              Avisarme por correo cuando entra un testimonio nuevo.
              <span className="block text-xs text-[var(--fo-muted)]">Le llega al dueño de la cuenta.</span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={automatico}
              onChange={(e) => {
                setAutomatico(e.target.checked);
                setConfirmado(false);
              }}
              className="mt-1"
            />
            <span>
              Pedir testimonio solo, por correo, después de finalizar cada proyecto.
              <span className="block text-xs text-[var(--fo-muted)]">
                Una sola vez por cliente y proyecto (y no más de un pedido por cliente cada 30 días), a los clientes con correo, hasta 20 por día. Sale con el mismo texto que
                «Pedir testimonio» desde la ficha del cliente (ahí se ve y se puede retocar antes de mandarlo a mano).
              </span>
            </span>
          </label>

          <label className="block max-w-xs">
            <span className="fo-label">Días después de finalizar el proyecto</span>
            <input
              type="number"
              inputMode="numeric"
              min={DIAS_DESPUES_MIN}
              max={DIAS_DESPUES_MAX}
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              className="fo-input"
              required
            />
          </label>

          {inicial.automaticoEncendido && inicial.encendidoAt ? (
            <p className="text-xs text-[var(--fo-muted)]">
              Encendido desde el {FECHA.format(new Date(inicial.encendidoAt))}: sólo se pide por proyectos finalizados desde ese día.
            </p>
          ) : null}

          {automatico && faltaParaElAutomatico ? (
            <p className="fo-alert-warning text-sm" role="status">
              Los pedidos automáticos no van a salir: {faltaParaElAutomatico}.
            </p>
          ) : null}

          {enciende ? (
            <div className="fo-alert-warning space-y-2 text-sm">
              <p>
                Encenderlo equivale a mandar: FOTOFFICE le va a escribir solo a cada cliente con correo cuando pasen esos días desde
                que finalice su proyecto. Sólo cuenta para los proyectos que se finalicen desde hoy; los anteriores no reciben nada.
              </p>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} className="mt-1" />
                <span>Entiendo, quiero que se manden solos.</span>
              </label>
            </div>
          ) : null}
        </fieldset>

        {error ? (
          <p className="fo-alert-error text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {aviso ? (
          <p className="text-sm text-[var(--fo-success)]" role="status">
            {aviso}
          </p>
        ) : null}

        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || (enciende && !confirmado)}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      </form>
    </div>
  );
}
