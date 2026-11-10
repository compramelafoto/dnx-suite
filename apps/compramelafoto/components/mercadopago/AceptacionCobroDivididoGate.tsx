"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Button from "@/components/ui/Button";
import CobroDivididoCard from "@/components/mercadopago/CobroDivididoCard";
import { ANEXO_COBRO_DIVIDIDO_TEXTO } from "@/lib/split-1n-aceptacion/anexo";
import { rutaExenta, type DecisionAceptacion } from "@/lib/split-1n-aceptacion/regla";

type Mostrar = Extract<DecisionAceptacion, { mostrar: true }>;

const POSPUESTO_KEY = "clf-cobro-dividido-pospuesto";

function pospuesto(): boolean {
  try {
    return window.sessionStorage.getItem(POSPUESTO_KEY) === "1";
  } catch {
    return false;
  }
}

function posponer() {
  try {
    window.sessionStorage.setItem(POSPUESTO_KEY, "1");
  } catch {
    /* sin almacenamiento: vuelve a aparecer en la próxima página */
  }
}

/**
 * Último día en que todavía se puede posponer, en hora argentina. El límite es la medianoche
 * del día configurado, así que se muestra el día anterior («domingo 22 de noviembre»).
 */
function ultimoDia(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(new Date(iso).getTime() - 1));
}

/** El anexo está en Markdown: los títulos se muestran en negrita, sin los «#». */
function TextoAnexo() {
  return (
    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] p-3 text-xs text-[#374151]">
      {ANEXO_COBRO_DIVIDIDO_TEXTO.split("\n")
        .filter((l) => l.trim() !== "")
        .map((linea, i) =>
          linea.startsWith("#") ? (
            <p key={i} className="font-semibold text-[#1a1a1a]">
              {linea.replace(/^#+\s*/, "")}
            </p>
          ) : (
            <p key={i}>{linea}</p>
          ),
        )}
    </div>
  );
}

/**
 * Cartel grande del cobro dividido: pide aceptar el anexo de los términos y autorizar el cobro
 * dividido en Mercado Pago. Antes de la fecha límite se puede posponer (vuelve en cada sesión);
 * desde esa fecha tapa el panel hasta completarlo. La página de soporte nunca queda tapada.
 */
export default function AceptacionCobroDivididoGate({ rol }: { rol: "fotografo" | "organizador" }) {
  const pathname = usePathname();
  const [decision, setDecision] = useState<Mostrar | null>(null);
  const [cerrado, setCerrado] = useState(false);
  const [acepto, setAcepto] = useState(false);
  const [verTexto, setVerTexto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abierto = useRef(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  const consultar = useCallback(async () => {
    try {
      const res = await fetch("/api/split-1n/aceptacion", { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as DecisionAceptacion;
      abierto.current = data.mostrar;
      setDecision(data.mostrar ? data : null);
    } catch {
      /* sin red: no se bloquea */
    }
  }, []);

  useEffect(() => {
    setCerrado(pospuesto());
    void consultar();
    // Al volver de Mercado Pago se revisa de nuevo, sólo mientras el cartel está abierto.
    const alVolver = () => {
      if (abierto.current) void consultar();
    };
    window.addEventListener("focus", alVolver);
    return () => window.removeEventListener("focus", alVolver);
  }, [consultar]);

  const alCambiarEstadoMp = useCallback(
    (estado: string) => {
      if (estado === "ACTIVE") void consultar();
    },
    [consultar],
  );

  async function aceptarAnexo() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/split-1n/aceptacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ acepto: true }),
      });
      const data = (await res.json().catch(() => null)) as (DecisionAceptacion & { error?: string }) | null;
      if (!res.ok || !data) {
        setError(data?.error ?? "No pudimos guardar tu aceptación. Probá de nuevo en unos minutos.");
        return;
      }
      abierto.current = data.mostrar;
      setDecision(data.mostrar ? data : null);
    } catch {
      setError("No pudimos guardar tu aceptación. Revisá tu conexión y probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const visible = decision != null && !rutaExenta(pathname) && !(cerrado && !decision.obligatorio);

  // Mientras el cartel está a la vista: el fondo no se desplaza y el foco arranca en el título.
  useEffect(() => {
    if (!visible) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    titulo.current?.focus();
    return () => {
      document.body.style.overflow = previo;
    };
  }, [visible]);

  if (!visible || !decision) return null;

  const soporte = rol === "organizador" ? "/organizador/soporte" : "/fotografo/soporte";
  const dia = ultimoDia(decision.limite);

  return (
    <div
      className="fixed inset-0 z-[9980] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cobro-dividido-titulo"
      data-testid="aceptacion-cobro-dividido"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <h2 id="cobro-dividido-titulo" ref={titulo} tabIndex={-1} className="text-2xl font-bold text-[#1a1a1a] outline-none">
          Nuevos términos: cobro dividido con Mercado Pago
        </h2>
        <p className="mt-3 text-[#374151]">
          Empezamos a cobrar las ventas con el cobro dividido de Mercado Pago: cuando una venta se cobra
          así, {rol === "organizador" ? "tu comisión" : "tu parte"} va directo a tu cuenta en el momento,
          sin esperar liquidaciones. Para eso necesitamos dos cosas.
        </p>
        <p
          className={`mt-3 rounded-lg p-3 text-sm font-medium ${
            decision.obligatorio ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"
          }`}
        >
          {decision.obligatorio
            ? "Para seguir usando el panel tenés que completar los dos pasos."
            : `Tenés tiempo hasta el ${dia} inclusive. Después no vas a poder usar el panel sin completarlos.`}
        </p>

        <section className="mt-6">
          <h3 className="font-semibold text-[#1a1a1a]">1. Aceptá el anexo de los términos</h3>
          {decision.faltaTerminos ? (
            <div className="mt-2 space-y-3">
              <button
                type="button"
                onClick={() => setVerTexto((v) => !v)}
                className="text-sm text-[#2563eb] underline"
              >
                {verTexto ? "Ocultar el texto completo" : "Leer el texto completo"}
              </button>
              {verTexto ? <TextoAnexo /> : null}
              <label className="flex items-start gap-2 text-sm text-[#374151]">
                <input
                  type="checkbox"
                  checked={acepto}
                  onChange={(e) => setAcepto(e.target.checked)}
                  className="mt-0.5"
                />
                Leí y acepto el anexo de cobro dividido con Mercado Pago.
              </label>
              <Button onClick={aceptarAnexo} disabled={!acepto || guardando} className="text-sm">
                {guardando ? "Guardando…" : "Aceptar"}
              </Button>
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#10b981]">✅ Ya aceptaste el anexo.</p>
          )}
        </section>

        <section className="mt-6">
          <h3 className="font-semibold text-[#1a1a1a]">2. Autorizá el cobro dividido en Mercado Pago</h3>
          <p className="mt-1 text-sm text-[#6b7280]">
            Esto lo tenés que hacer vos desde tu cuenta de Mercado Pago: nosotros no podemos hacerlo por vos.
            Cuando lo autorices, este cartel se va solo.
          </p>
          <CobroDivididoCard rol={rol} onEstado={alCambiarEstadoMp} />
        </section>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#e5e7eb] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <a href={soporte} className="text-sm text-[#6b7280] underline">
            ¿No podés completarlo? Escribinos
          </a>
          {!decision.obligatorio ? (
            <Button
              variant="secondary"
              onClick={() => {
                posponer();
                setCerrado(true);
              }}
              className="text-sm"
            >
              Ahora no
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
