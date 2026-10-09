"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  agregarParticipanteAction, buscarContactosProyectoAction, crearRolAction, editarParticipanteAction, quitarParticipanteAction,
} from "@/app/actions/proyectos";
import type { ParticipanteVista } from "@/lib/proyectos/ficha-vista";
import { SelectorContacto, type ContactoElegido } from "@/components/consultas/selector-contacto";

const MENSAJE_FALLA = "No se pudo guardar el cambio. Probá de nuevo.";

/**
 * Equipo del proyecto: cada participante es un integrante del equipo o un contacto (salón, DJ,
 * maquilladora…), con un rol y una nota. Con "Gestionar" en Proyectos se agregan, se cambia el rol
 * y se quitan. El rol se puede crear al vuelo con «Otro rol…» si la persona además configura el
 * workspace.
 */
export function ParticipantesProyecto({
  proyectoId,
  participantes,
  roles,
  equipo,
  puedeEditar,
  puedeElegirContactos,
  puedeCrearRoles,
}: {
  proyectoId: string;
  participantes: ParticipanteVista[];
  roles: { id: string; nombre: string }[];
  equipo: { id: number; nombre: string }[];
  puedeEditar: boolean;
  /** "Ver" en Clientes (R10): sin esto sólo se suman integrantes del equipo. */
  puedeElegirContactos: boolean;
  puedeCrearRoles: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [agregando, setAgregando] = useState(false);
  const [origen, setOrigen] = useState<"EQUIPO" | "CONTACTO">("EQUIPO");
  const [usuario, setUsuario] = useState("");
  const [contacto, setContacto] = useState<ContactoElegido | null>(null);
  const [rolId, setRolId] = useState("");
  const [rolNuevo, setRolNuevo] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);

  function correr(accion: () => Promise<{ ok: true } | { ok: false; error: string }>, alTerminar?: () => void) {
    setError(null);
    iniciar(async () => {
      try {
        const r = await accion();
        if (!r.ok) {
          setError(r.error);
          return;
        }
        alTerminar?.();
        router.refresh();
      } catch {
        setError(MENSAJE_FALLA);
      }
    });
  }

  function agregar() {
    if (origen === "EQUIPO" && usuario === "") {
      setError("Elegí un integrante del equipo.");
      return;
    }
    if (origen === "CONTACTO" && !contacto) {
      setError("Elegí un contacto.");
      return;
    }
    correr(
      async () => {
        let rol: string | null = rolId === "" || rolId === "__nuevo" ? null : rolId;
        if (rolId === "__nuevo") {
          const creado = await crearRolAction(rolNuevo);
          if (!creado.ok) return creado;
          rol = creado.id;
        }
        return agregarParticipanteAction(proyectoId, {
          ...(origen === "EQUIPO" ? { userId: Number(usuario) } : { clientId: contacto!.id }),
          roleId: rol,
          note: nota.trim() === "" ? null : nota.trim(),
        });
      },
      () => {
        setAgregando(false);
        setUsuario("");
        setContacto(null);
        setRolId("");
        setRolNuevo("");
        setNota("");
      },
    );
  }

  return (
    <section aria-labelledby="participantes-proyecto-titulo" className="fo-card space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="participantes-proyecto-titulo" className="text-base font-semibold text-[var(--fo-text)]">
          Equipo del proyecto
        </h2>
        {puedeEditar && !agregando ? (
          <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setAgregando(true)}>
            Agregar
          </button>
        ) : null}
      </div>

      {participantes.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay participantes.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {participantes.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1">
                {p.clientId ? (
                  <Link href={`/clientes/${encodeURIComponent(p.clientId)}`} className="font-medium text-[var(--fo-accent)] hover:underline">
                    {p.nombre}
                  </Link>
                ) : (
                  <span className="font-medium text-[var(--fo-text)]">{p.nombre}</span>
                )}
                <span className="text-xs text-[var(--fo-muted)]"> · {p.tipo === "EQUIPO" ? "Equipo" : "Contacto"}</span>
                {puedeEditar ? (
                  <select
                    className="fo-input mt-1 block"
                    aria-label={`Rol de ${p.nombre}`}
                    value={p.roleId ?? ""}
                    disabled={pendiente}
                    onChange={(e) => correr(() => editarParticipanteAction(proyectoId, p.id, { roleId: e.target.value === "" ? null : e.target.value }))}
                  >
                    <option value="">Sin rol</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                    {p.roleId && !roles.some((r) => r.id === p.roleId) ? <option value={p.roleId}>{p.rol ?? "Rol dado de baja"}</option> : null}
                  </select>
                ) : p.rol ? (
                  <span className="text-[var(--fo-muted)]"> · {p.rol}</span>
                ) : null}
                {p.nota ? <span className="block break-words text-xs text-[var(--fo-muted)]">{p.nota}</span> : null}
              </span>
              {puedeEditar ? (
                <button
                  type="button"
                  className="fo-icon-btn"
                  disabled={pendiente}
                  aria-label={`Quitar a ${p.nombre}`}
                  onClick={() => correr(() => quitarParticipanteAction(proyectoId, p.id))}
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {agregando ? (
        <form
          className="space-y-2 rounded-lg border border-[var(--fo-border)] p-3 text-sm"
          aria-label="Agregar participante"
          onSubmit={(e) => {
            e.preventDefault();
            agregar();
          }}
        >
          <fieldset className="space-y-2" disabled={pendiente}>
            {puedeElegirContactos ? (
              <div className="flex gap-4" role="radiogroup" aria-label="Quién participa">
                <label className="flex items-center gap-2">
                  <input type="radio" name="origen" checked={origen === "EQUIPO"} onChange={() => setOrigen("EQUIPO")} />
                  Del equipo
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="origen" checked={origen === "CONTACTO"} onChange={() => setOrigen("CONTACTO")} />
                  Un contacto
                </label>
              </div>
            ) : null}
            {origen === "EQUIPO" ? (
              <label className="fo-field-stack">
                <span className="fo-label">Integrante del equipo</span>
                <select className="fo-input" value={usuario} onChange={(e) => setUsuario(e.target.value)}>
                  <option value="">Elegí una persona</option>
                  {equipo.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <SelectorContacto etiqueta="Contacto" elegido={contacto} onElegir={setContacto} deshabilitado={pendiente} buscar={buscarContactosProyectoAction} />
            )}
            <label className="fo-field-stack">
              <span className="fo-label">Rol</span>
              <select className="fo-input" value={rolId} onChange={(e) => setRolId(e.target.value)}>
                <option value="">Sin rol</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
                {puedeCrearRoles ? <option value="__nuevo">Otro rol…</option> : null}
              </select>
            </label>
            {rolId === "__nuevo" ? (
              <label className="fo-field-stack">
                <span className="fo-label">Nombre del rol nuevo</span>
                <input className="fo-input" maxLength={80} value={rolNuevo} onChange={(e) => setRolNuevo(e.target.value)} />
              </label>
            ) : null}
            <label className="fo-field-stack">
              <span className="fo-label">Nota (opcional)</span>
              <input className="fo-input" maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="submit" className="fo-btn fo-btn-primary text-xs">
                {pendiente ? "Guardando…" : "Agregar"}
              </button>
              <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={() => setAgregando(false)}>
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
