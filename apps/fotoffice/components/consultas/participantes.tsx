"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { X } from "lucide-react";
import { agregarParticipanteAction, quitarParticipanteAction } from "@/app/actions/consultas";
import type { ParticipanteFicha } from "@/lib/consultas/ficha";
import { marcaDeCampo, type CampoConError } from "@/lib/consultas/formulario";
import { SelectorContacto, type ContactoElegido } from "./selector-contacto";

const MENSAJE_FALLA = "No se pudo guardar el cambio. Probá de nuevo.";

/**
 * Participantes de la consulta (spec §3.2): cada uno es un contacto con un rol (Salón, DJ,
 * Fotógrafo secundario…) y una nota. Con "Gestionar" en Consultas se agregan y se quitan.
 */
export function Participantes({
  leadId,
  participantes,
  roles,
  puedeEditar,
}: {
  leadId: string;
  participantes: ParticipanteFicha[];
  /** Roles activos del workspace. */
  roles: { id: string; nombre: string }[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [agregando, setAgregando] = useState(false);
  const [contacto, setContacto] = useState<ContactoElegido | null>(null);
  const [rolId, setRolId] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<{ mensaje: string; campo?: CampoConError } | null>(null);
  const idError = useId();
  const marca = (c: CampoConError) => marcaDeCampo(error, c, idError);

  function correr(accion: () => Promise<{ ok: true } | { ok: false; error: string; campo?: CampoConError }>, alTerminar?: () => void) {
    setError(null);
    iniciar(async () => {
      try {
        const r = await accion();
        if (!r.ok) {
          setError({ mensaje: r.error, campo: r.campo });
          return;
        }
        alTerminar?.();
        router.refresh();
      } catch {
        setError({ mensaje: MENSAJE_FALLA });
      }
    });
  }

  function agregar() {
    if (!contacto) {
      setError({ mensaje: "Elegí un contacto.", campo: "participanteContacto" });
      return;
    }
    if (!rolId) {
      setError({ mensaje: "Elegí un rol.", campo: "rol" });
      return;
    }
    correr(
      () => agregarParticipanteAction({ leadId, clientId: contacto.id, roleId: rolId, nota: nota.trim() || undefined }),
      () => {
        setContacto(null);
        setRolId("");
        setNota("");
        setAgregando(false);
      },
    );
  }

  return (
    <section aria-labelledby="participantes-titulo" className="fo-card space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="participantes-titulo" className="text-base font-semibold text-[var(--fo-text)]">
          Participantes
        </h2>
        {puedeEditar && !agregando && roles.length > 0 ? (
          <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setAgregando(true)}>
            Agregar
          </button>
        ) : null}
      </div>

      {participantes.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Sin participantes.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {participantes.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <Link href={`/clientes/${p.contacto.id}`} className="font-medium text-[var(--fo-accent)] hover:underline">
                  {p.contacto.nombre}
                </Link>
                <span className="text-[var(--fo-muted)]"> · {p.rol.nombre}</span>
                {p.nota ? <span className="block break-words text-xs text-[var(--fo-muted)]">{p.nota}</span> : null}
              </span>
              {puedeEditar ? (
                <button
                  type="button"
                  className="fo-icon-btn"
                  disabled={pendiente}
                  aria-label={`Quitar a ${p.contacto.nombre} (${p.rol.nombre})`}
                  onClick={() => correr(() => quitarParticipanteAction({ leadId, participanteId: p.id }))}
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {puedeEditar && roles.length === 0 ? (
        <p className="text-xs text-[var(--fo-muted)]">Para sumar participantes, un administrador carga los roles en Configuración → Consultas.</p>
      ) : null}

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
            <SelectorContacto etiqueta="Contacto" elegido={contacto} onElegir={setContacto} deshabilitado={pendiente} marca={marca("participanteContacto")} />
            <label className="fo-field-stack">
              <span className="fo-label">Rol</span>
              <select className="fo-input" value={rolId} {...marca("rol")} onChange={(e) => setRolId(e.target.value)}>
                <option value="">Elegí un rol</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="fo-field-stack">
              <span className="fo-label">Nota (opcional)</span>
              <input className="fo-input" maxLength={200} value={nota} {...marca("participanteNota")} onChange={(e) => setNota(e.target.value)} />
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
        <p id={idError} role="alert" className="text-sm text-[var(--fo-danger)]">
          {error.mensaje}
        </p>
      ) : null}
    </section>
  );
}
