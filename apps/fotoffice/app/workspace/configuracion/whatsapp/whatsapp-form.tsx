"use client";

import Link from "next/link";
import { useActionState } from "react";
import { guardarWhatsappAction, simularEntranteAction, type EstadoWhatsappConfig } from "./actions";

/** Lo que muestra el formulario. NUNCA lleva el token: sólo si hay uno cargado. */
export type ConexionVista = {
  modo: "SIMULADO" | "REAL";
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string;
  pausaBotHoras: number;
};

const INICIAL: EstadoWhatsappConfig = { error: null };

function Mensaje({ estado }: { estado: EstadoWhatsappConfig }) {
  if (estado.error) return <p role="alert" className="text-sm text-[var(--fo-danger)]">{estado.error}</p>;
  if (estado.ok) return <p role="status" className="text-sm text-[var(--fo-success)]">{estado.ok}</p>;
  return null;
}

export function ConexionForm({ conexion, tieneToken }: { conexion: ConexionVista; tieneToken: boolean }) {
  const [estado, guardar, guardando] = useActionState(guardarWhatsappAction, INICIAL);
  return (
    <form action={guardar} className="fo-card space-y-4 p-5" aria-labelledby="whatsapp-conexion-titulo">
      <h2 id="whatsapp-conexion-titulo" className="text-base font-semibold">Conexión</h2>
      <div className="fo-field-stack max-w-xs">
        <label className="fo-label" htmlFor="wa-modo">Modo</label>
        <select id="wa-modo" name="modo" defaultValue={conexion.modo} className="fo-input">
          <option value="SIMULADO">Prueba (los mensajes no salen)</option>
          <option value="REAL">Real (conectado a WhatsApp)</option>
        </select>
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="wa-phone-number-id">Phone number ID</label>
        <input id="wa-phone-number-id" name="phoneNumberId" inputMode="numeric" autoComplete="off" defaultValue={conexion.phoneNumberId} className="fo-input" />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="wa-waba-id">WhatsApp Business Account ID</label>
        <input id="wa-waba-id" name="wabaId" inputMode="numeric" autoComplete="off" defaultValue={conexion.wabaId} className="fo-input" />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="wa-display-phone">Número para mostrar</label>
        <input id="wa-display-phone" name="displayPhone" autoComplete="off" defaultValue={conexion.displayPhone} className="fo-input" />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="wa-token">Token de acceso</label>
        <input id="wa-token" name="token" type="password" autoComplete="new-password" placeholder="Dejalo vacío para no cambiarlo" className="fo-input" />
        <p className="text-xs text-[var(--fo-muted)]">{tieneToken ? "Token cargado." : "Falta el token."} Por seguridad nunca se muestra.</p>
      </div>
      <div className="fo-field-stack max-w-xs">
        <label className="fo-label" htmlFor="wa-pausa">Horas de pausa del bot</label>
        <input id="wa-pausa" name="pausaBotHoras" type="number" inputMode="numeric" min={1} max={72} step={1} required defaultValue={conexion.pausaBotHoras} className="fo-input" />
        <p className="text-xs text-[var(--fo-muted)]">De 1 a 72. Si alguien responde desde el celular, el bot espera ese tiempo.</p>
      </div>
      <Mensaje estado={estado} />
      <button type="submit" disabled={guardando} className="fo-btn fo-btn-primary">{guardando ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}

export function SimuladorForm() {
  const [estado, simular, enviando] = useActionState(simularEntranteAction, INICIAL);
  return (
    <form action={simular} className="fo-card space-y-4 p-5" aria-labelledby="whatsapp-simulador-titulo">
      <div className="space-y-1">
        <h2 id="whatsapp-simulador-titulo" className="text-base font-semibold">Simular un mensaje entrante</h2>
        <p className="text-sm text-[var(--fo-muted)]">Entra como si lo hubiera mandado un cliente por WhatsApp. Sólo en modo de prueba.</p>
      </div>
      <div className="fo-field-stack max-w-xs">
        <label className="fo-label" htmlFor="sim-telefono">Número</label>
        <input id="sim-telefono" name="telefono" required autoComplete="off" placeholder="341 555-1234" className="fo-input" />
      </div>
      <div className="fo-field-stack max-w-xs">
        <label className="fo-label" htmlFor="sim-nombre">Nombre</label>
        <input id="sim-nombre" name="nombre" autoComplete="off" maxLength={120} className="fo-input" />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="sim-texto">Mensaje</label>
        <textarea id="sim-texto" name="texto" required rows={3} maxLength={4096} className="fo-input" />
      </div>
      <Mensaje estado={estado} />
      {estado.chatId ? (
        <Link href={`/bandeja/${estado.chatId}`} className="text-sm text-[var(--fo-accent)] hover:underline">Ver en la Bandeja</Link>
      ) : null}
      <button type="submit" disabled={enviando} className="fo-btn fo-btn-secondary">{enviando ? "Enviando…" : "Simular"}</button>
    </form>
  );
}
