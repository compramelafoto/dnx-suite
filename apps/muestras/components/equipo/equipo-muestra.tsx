"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ACTIVITY_ROLE_LABELS, MEMBER_STATUS_LABELS, TEAM_ROLES, formatArDay, type MemberStatus, type TeamRole } from "@repo/muestras";
import { CopiarEnlace } from "@/components/enlace/copiar-enlace";
import { cambiarRol, dejarElEquipo, invitarAlEquipo, reenviarInvitacion, sacarDelEquipo } from "@/lib/equipo/acciones";
import type { Integrante } from "@/lib/equipo/consultas";
import { botonFino, campo, fila, nota } from "./estilos";

type Resultado = { ok: true; id: string; enlace?: string } | { ok: false; errores: string[] };

function estadoDe(k: Integrante): string {
  if (k.status === "INVITED") return k.vencida ? `Invitación vencida (enviada el ${formatArDay(k.invitedAt)})` : `Invitación pendiente desde el ${formatArDay(k.invitedAt)}`;
  if (k.status === "ACTIVE" && k.acceptedAt) return `En el equipo desde el ${formatArDay(k.acceptedAt)}`;
  return MEMBER_STATUS_LABELS[k.status as MemberStatus] ?? k.status;
}

export function EquipoMuestra({ activityId, integrantes, puedeGestionar, soyIntegrante }: {
  activityId: string; integrantes: Integrante[]; puedeGestionar: boolean; soyIntegrante: boolean;
}) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<TeamRole>("CO_ORGANIZER");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enlace, setEnlace] = useState<string | null>(null);

  const correr = (f: () => Promise<Resultado>, exito: string, despues?: () => void) =>
    start(async () => {
      const r = await f();
      // Con `enlace` el correo no salió: no se dice "enviada" y se muestra el enlace para copiar.
      setEnlace(r.ok && r.enlace ? r.enlace : null);
      setMensaje(r.ok ? (r.enlace ? null : { ok: true, texto: exito }) : { ok: false, texto: r.errores.join(" ") });
      if (r.ok) {
        despues?.();
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      {integrantes.length === 0 ? <p className="text-[var(--mf-muted)]">Todavía no hay nadie más en el equipo.</p> : (
        <ul className="border-t border-[var(--mf-line)]">
          {integrantes.map((k) => (
            <li key={k.id} className={`${fila} space-y-2`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="break-all">{k.nombre ? `${k.nombre} · ` : ""}{k.email}{k.esVos ? " (vos)" : ""}</span>
                <span className={nota}>{ACTIVITY_ROLE_LABELS[k.role]} · {estadoDe(k)}</span>
              </div>
              {puedeGestionar ? (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  {k.status !== "REVOKED" ? (
                    <label className="flex items-center gap-2">
                      <span className="text-[var(--mf-muted)]">Rol</span>
                      <select
                        value={k.role}
                        disabled={pendiente}
                        className="h-9 rounded-[2px] border border-[var(--mf-line)] bg-white px-2"
                        onChange={(e) => correr(() => cambiarRol(k.id, e.target.value), "Cambiamos el rol.")}
                      >
                        {TEAM_ROLES.map((r) => <option key={r} value={r}>{ACTIVITY_ROLE_LABELS[r]}</option>)}
                      </select>
                    </label>
                  ) : null}
                  {k.status === "INVITED" ? (
                    <button type="button" disabled={pendiente} className="underline" onClick={() => correr(() => reenviarInvitacion(k.id), "Mandamos la invitación de nuevo.")}>Reenviar</button>
                  ) : null}
                  {k.status === "REVOKED" ? (
                    <button type="button" disabled={pendiente} className="underline" onClick={() => correr(() => reenviarInvitacion(k.id), "Mandamos la invitación.")}>Volver a invitar</button>
                  ) : (
                    <button
                      type="button"
                      disabled={pendiente}
                      className="underline"
                      onClick={() => { if (window.confirm(`¿Sacar a ${k.email} del equipo? Deja de ver la muestra en el panel en ese momento.`)) correr(() => sacarDelEquipo(k.id), "Listo."); }}
                    >
                      Sacar del equipo
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {puedeGestionar ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            correr(() => invitarAlEquipo(activityId, email, rol), "Mandamos la invitación.", () => setEmail(""));
          }}
        >
          <h2 className="text-lg">Invitar a alguien</h2>
          <div className="flex flex-wrap gap-3">
            <label className="min-w-0 flex-1 basis-64">
              <span className="sr-only">Email de quien querés invitar</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com" className={campo} />
            </label>
            <label>
              <span className="sr-only">Rol</span>
              <select value={rol} onChange={(e) => setRol(e.target.value as TeamRole)} className="h-11 rounded-[2px] border border-[var(--mf-line)] bg-white px-3">
                {TEAM_ROLES.map((r) => <option key={r} value={r}>{ACTIVITY_ROLE_LABELS[r]}</option>)}
              </select>
            </label>
            <button type="submit" disabled={pendiente} className={botonFino}>Invitar</button>
          </div>
          <p className={nota}>La persona tiene que entrar con la cuenta de Google de ese email para aceptar.</p>
        </form>
      ) : null}

      {mensaje ? <p role="status" className={mensaje.ok ? "text-[var(--mf-teal)]" : "text-[var(--mf-alerta)]"}>{mensaje.texto}</p> : null}
      {enlace ? (
        <div className="space-y-2" role="status">
          <p className="text-[var(--mf-alerta)]">No pudimos mandar el correo: copiá el enlace y mandáselo por WhatsApp o por mail. Vence en 30 días y sirve una sola vez.</p>
          <CopiarEnlace url={enlace} etiqueta="Enlace de la invitación" />
        </div>
      ) : null}

      {soyIntegrante ? (
        <div className="border-t border-[var(--mf-line)] pt-4">
          <button
            type="button"
            disabled={pendiente}
            className={botonFino}
            onClick={() => {
              if (!window.confirm("¿Dejar el equipo de esta muestra? Vas a dejar de verla en tu panel.")) return;
              start(async () => {
                const r = await dejarElEquipo(activityId);
                if (r.ok) router.push("/panel/muestras");
                else setMensaje({ ok: false, texto: r.errores.join(" ") });
              });
            }}
          >
            Dejar el equipo
          </button>
        </div>
      ) : null}
    </div>
  );
}
