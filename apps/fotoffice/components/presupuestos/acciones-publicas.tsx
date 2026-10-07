"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aceptarPresupuestoAction, pedirPresupuestoNuevoAction } from "@/app/w/[workspaceSlug]/presupuesto/[token]/actions";
import type { EstadoDeLaVista } from "@/lib/presupuestos/vista-publica";

/**
 * Botones del enlace público: "Acepto" (nombre + tilde), "Tengo dudas" (WhatsApp de la
 * organización), "Descargar PDF" (vista para imprimir) y, si venció, "Pedir uno nuevo". Las
 * reglas (una sola aceptación, versión vigente, vencimiento) las vuelve a mirar el servidor.
 */
export function AccionesPublicas({
  slug,
  token,
  estado,
  whatsappUrl,
  email,
  hrefImprimir,
}: {
  slug: string;
  token: string;
  estado: EstadoDeLaVista;
  whatsappUrl: string | null;
  email: string | null;
  hrefImprimir: string;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [nombre, setNombre] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function aceptar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await aceptarPresupuestoAction(slug, token, nombre, acepta).catch(() => ({ ok: false as const, error: "No pudimos registrar tu aceptación. Probá de nuevo." }));
      if (r.ok) router.refresh();
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
        <form onSubmit={aceptar} className="fo-card space-y-3 p-4">
          <h2 className="text-base font-semibold">¿Te sirve? Aceptalo acá</h2>
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
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-1" />
            <span>Leí el presupuesto y acepto sus condiciones.</span>
          </label>
          <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || !acepta || nombre.trim().length < 2}>
            {pendiente ? "Registrando…" : "Acepto"}
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
