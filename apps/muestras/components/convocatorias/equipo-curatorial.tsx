"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatArDay } from "@repo/muestras";
import { invitarCurador, revocarCurador } from "@/lib/curaduria/acciones";
import { botonFino, campo } from "./estilos";

export type Curador = { id: string; email: string; status: string; invitedAt: Date; acceptedAt: Date | null };

const ESTADO: Record<string, string> = { INVITED: "Invitación enviada", ACTIVE: "En el equipo", REVOKED: "Fuera del equipo" };

export function EquipoCuratorial({ callId, curadores, editable }: { callId: string; curadores: Curador[]; editable: boolean }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enlace, setEnlace] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const correr = (f: () => Promise<{ ok: boolean; errores?: string[]; enlace?: string }>, exito: string) =>
    start(async () => {
      const r = await f();
      setCopiado(false);
      // Con `enlace` el correo no salió: no se dice "enviada" y se muestra el enlace para copiar.
      setEnlace(r.ok && r.enlace ? r.enlace : null);
      setMensaje(r.ok ? (r.enlace ? null : { ok: true, texto: exito }) : { ok: false, texto: (r.errores ?? []).join(" ") });
      if (r.ok) router.refresh();
    });
  const copiar = async () => {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <div className="space-y-4">
      {curadores.length === 0 ? <p className="text-[var(--mf-muted)]">Todavía no invitaste a nadie.</p> : (
        <ul className="border-t border-[var(--mf-line)]">
          {curadores.map((k) => (
            <li key={k.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--mf-line)] py-3">
              <span>{k.email}</span>
              <span className="text-sm text-[var(--mf-muted)]">
                {ESTADO[k.status] ?? k.status}{k.status === "INVITED" ? ` el ${formatArDay(k.invitedAt)}` : ""}
              </span>
              {editable && k.status !== "REVOKED" ? (
                <span className="flex gap-4 text-sm">
                  {k.status === "INVITED" ? <button type="button" disabled={pendiente} className="underline" onClick={() => correr(() => invitarCurador(callId, k.email), "Invitación reenviada.")}>Reenviar</button> : null}
                  <button type="button" disabled={pendiente} className="underline" onClick={() => { if (window.confirm(`¿Sacar a ${k.email} del equipo? Sus puntajes dejan de contar.`)) correr(() => revocarCurador(k.id), "Listo."); }}>Sacar</button>
                </span>
              ) : k.status === "REVOKED" && editable ? (
                <button type="button" disabled={pendiente} className="text-sm underline" onClick={() => correr(() => invitarCurador(callId, k.email), "Invitación enviada.")}>Volver a invitar</button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            correr(async () => {
              const r = await invitarCurador(callId, email);
              if (r.ok) setEmail("");
              return r;
            }, "Invitación enviada.");
          }}
        >
          <label className="min-w-[16rem] flex-1">
            <span className="sr-only">Email de quien querés invitar</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com" className={campo} />
          </label>
          <button type="submit" disabled={pendiente} className={botonFino}>Invitar a curar</button>
        </form>
      ) : null}
      {mensaje ? <p className={mensaje.ok ? "text-[var(--mf-teal)]" : "text-[var(--mf-alerta)]"}>{mensaje.texto}</p> : null}
      {enlace ? (
        <div className="space-y-2">
          <p className="text-[var(--mf-alerta)]" role="status">No pudimos mandar el mail. Copiá este enlace y mandáselo a la persona que va a curar. Tiene que entrar con la cuenta de Google de ese mail.</p>
          <div className="flex flex-wrap gap-3">
            <label className="min-w-[16rem] flex-1">
              <span className="sr-only">Enlace de la invitación</span>
              <input type="text" readOnly value={enlace} onFocus={(e) => e.currentTarget.select()} className={campo} />
            </label>
            <button type="button" className={botonFino} onClick={copiar}>{copiado ? "Copiado" : "Copiar enlace"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
