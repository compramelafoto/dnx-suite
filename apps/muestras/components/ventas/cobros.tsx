"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ConsentStatus } from "@repo/muestras";
import { guardarCuentaDeCobro, verificarCuentaDeCobro } from "@/lib/ventas/cobros";
import { alerta, botonFino, botonLleno, campo, etiqueta, nota } from "./estilos";

export type CuentaParaPantalla = { email: string | null; estado: ConsentStatus; inviteUrl: string | null };

function textoDelEstado(c: CuentaParaPantalla): string {
  switch (c.estado) {
    case "NONE":
      return "Todavía no conectaste tu Mercado Pago.";
    case "PENDING":
      return "Falta que aceptes en Mercado Pago.";
    case "ACTIVE":
      return `Listo: vas a recibir tu parte en ${c.email ?? "tu cuenta"}.`;
    default:
      return "Mercado Pago dice que no está aceptado: volvé a pedirlo.";
  }
}

/** Email de la cuenta, invitación y verificación (spec D13). */
export function Cobros({ cuenta }: { cuenta: CuentaParaPantalla }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const [cambiando, setCambiando] = useState(cuenta.email == null);

  const correr = (fn: () => Promise<{ ok: true } | { ok: false; errores: string[] }>) => {
    setErrores([]);
    start(async () => {
      const r = await fn();
      if (!r.ok) return setErrores(r.errores);
      setCambiando(false);
      router.refresh();
    });
  };

  // Sólo un enlace https de Mercado Pago se ofrece como botón.
  const invitacion = cuenta.inviteUrl && /^https:\/\//.test(cuenta.inviteUrl) ? cuenta.inviteUrl : null;

  return (
    <div className="space-y-5">
      <p className="text-lg" role="status">{textoDelEstado(cuenta)}</p>
      {cuenta.estado === "PENDING" ? (
        <div className="flex flex-wrap gap-2">
          {invitacion ? (
            <a href={invitacion} target="_blank" rel="noopener noreferrer" className={botonLleno}>Aceptar en Mercado Pago</a>
          ) : null}
          <button type="button" className={botonFino} disabled={pendiente} onClick={() => correr(verificarCuentaDeCobro)}>
            {pendiente ? "Verificando…" : "Ya lo acepté, verificar"}
          </button>
        </div>
      ) : null}
      {cuenta.estado === "ACTIVE" ? (
        <button type="button" className={botonFino} disabled={pendiente} onClick={() => correr(verificarCuentaDeCobro)}>
          {pendiente ? "Verificando…" : "Verificar de nuevo"}
        </button>
      ) : null}
      {cambiando ? (
        <form className="space-y-3" action={(fd) => correr(() => guardarCuentaDeCobro(fd))}>
          <label className={etiqueta}>
            <span>Email de tu cuenta de Mercado Pago</span>
            <span className={`block ${nota}`}>Te va a llegar un pedido de Mercado Pago para aceptar que te paguen tu parte de cada venta.</span>
            <input name="email" type="email" required maxLength={254} autoComplete="email" defaultValue={cuenta.email ?? ""} className={campo} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={botonLleno} disabled={pendiente}>{pendiente ? "Pidiendo…" : "Conectar mi Mercado Pago"}</button>
            {cuenta.email ? <button type="button" className={botonFino} disabled={pendiente} onClick={() => setCambiando(false)}>Cancelar</button> : null}
          </div>
        </form>
      ) : (
        <p className={nota}>
          Cuenta: {cuenta.email}.{" "}
          <button type="button" className="underline underline-offset-4" onClick={() => setCambiando(true)}>
            {cuenta.estado === "ACTIVE" ? "Cambiar de cuenta" : "Volver a pedirlo o cambiar el email"}
          </button>
        </p>
      )}
      {errores.length ? <ul role="alert" className={`space-y-1 ${alerta}`}>{errores.map((e) => <li key={e}>{e}</li>)}</ul> : null}
    </div>
  );
}
