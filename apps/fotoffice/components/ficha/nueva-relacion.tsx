"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import { buscarPersonasAction, crearRelacionAction, type OtraPedida } from "@/app/actions/ficha";
import { CLAVE_VINCULO_LIBRE, carasDeVinculos } from "@/lib/ficha/vinculos";
import type { PersonaFicha } from "./tipos";

type Encontrada = { tipo: "CLIENTE" | "SOCIO"; id: string; nombre: string; detalle: string | null };

const CARAS = carasDeVinculos();

/**
 * Formulario para vincular a otra persona: se la busca (o se la crea como cliente con nombre
 * y teléfono) y se contesta "¿Qué es <la otra> para <esta>?" con una de las caras del vínculo.
 */
export function NuevaRelacion({
  persona,
  nombre,
  palabraSocio,
  alTerminar,
}: {
  persona: PersonaFicha;
  nombre: string;
  /** Cómo le dice el workspace a sus socios ("socio", "voluntario/a"…). */
  palabraSocio: string;
  alTerminar: () => void;
}) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Encontrada[]>([]);
  const [elegida, setElegida] = useState<Encontrada | null>(null);
  const [nueva, setNueva] = useState(false);
  const [cara, setCara] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    const t = texto.trim();
    if (!t || elegida || nueva) {
      setResultados([]);
      return;
    }
    let vigente = true;
    const espera = setTimeout(async () => {
      const r = await buscarPersonasAction(t);
      // La propia ficha no se ofrece.
      if (vigente) setResultados(r.filter((p) => !(p.tipo === persona.tipo && p.id === persona.id)));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [texto, elegida, nueva, persona.tipo, persona.id]);

  const elegidaCara = CARAS.find((c) => c.valor === cara);
  const otraNombre = elegida?.nombre ?? (nueva ? texto.trim() : "");

  function enviar(fd: FormData) {
    if (!elegidaCara) {
      setError("Elegí qué es esa persona para esta.");
      return;
    }
    let otra: OtraPedida;
    if (elegida) otra = { tipo: elegida.tipo, id: elegida.id };
    else if (nueva) otra = { nuevoCliente: { nombre: texto, telefono: String(fd.get("telefono") ?? "") } };
    else {
      setError("Buscá y elegí a la otra persona.");
      return;
    }
    const customLabel = String(fd.get("customLabel") ?? "");
    const nota = String(fd.get("nota") ?? "");
    setError(null);
    iniciar(async () => {
      const r = await crearRelacionAction(persona, {
        otra,
        clave: elegidaCara.clave,
        sentido: elegidaCara.sentido,
        ...(elegidaCara.clave === CLAVE_VINCULO_LIBRE ? { customLabel } : {}),
        ...(nota.trim() ? { nota } : {}),
      });
      if (r.ok) alTerminar();
      else setError(r.error);
    });
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-[var(--fo-border)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        enviar(new FormData(e.currentTarget));
      }}
      aria-label="Agregar persona relacionada"
    >
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor={`${id}-buscar`}>
          {nueva ? "Nombre de la persona nueva" : "Persona"}
        </label>
        {elegida ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--fo-surface-muted)] px-3 py-2 text-sm">
            <span>
              {elegida.nombre}
              <span className="ml-1 text-xs text-[var(--fo-muted)]">{elegida.tipo === "SOCIO" ? `(${palabraSocio})` : "(cliente)"}</span>
            </span>
            <button type="button" className="fo-icon-btn" onClick={() => setElegida(null)} aria-label="Elegir otra persona">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <input
            id={`${id}-buscar`}
            className="fo-input"
            value={texto}
            maxLength={100}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={nueva ? "Nombre y apellido" : "Buscá por nombre, documento o teléfono"}
            autoComplete="off"
          />
        )}
        {resultados.length > 0 ? (
          <ul className="fo-popover mt-1 max-h-56 overflow-y-auto py-1 text-sm" aria-label="Personas encontradas">
            {resultados.map((p) => (
              <li key={`${p.tipo}-${p.id}`}>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--fo-surface-hover)]"
                  onClick={() => setElegida(p)}
                >
                  {p.nombre}
                  <span className="ml-1 text-xs text-[var(--fo-muted)]">
                    {p.tipo === "SOCIO" ? palabraSocio : "cliente"}
                    {p.detalle ? ` · ${p.detalle}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {!elegida ? (
          <button type="button" className="self-start text-xs font-medium text-[var(--fo-accent)] hover:underline" onClick={() => setNueva(!nueva)}>
            {nueva ? "Buscar entre los que ya están cargados" : "No está: crearla como cliente nuevo"}
          </button>
        ) : null}
      </div>

      {nueva && !elegida ? (
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`${id}-tel`}>
            Teléfono (opcional)
          </label>
          <input id={`${id}-tel`} name="telefono" className="fo-input" maxLength={40} inputMode="tel" autoComplete="off" />
        </div>
      ) : null}

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor={`${id}-vinculo`}>
          ¿Qué es {otraNombre || "la otra persona"} para {nombre}?
        </label>
        <select id={`${id}-vinculo`} className="fo-input" value={cara} onChange={(e) => setCara(e.target.value)} required>
          <option value="" disabled>
            Elegí una opción
          </option>
          {CARAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.texto}
            </option>
          ))}
        </select>
      </div>

      {elegidaCara?.clave === CLAVE_VINCULO_LIBRE ? (
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`${id}-libre`}>
            ¿Cómo se relacionan?
          </label>
          <input id={`${id}-libre`} name="customLabel" className="fo-input" maxLength={40} required placeholder="Padrino, vecina…" />
        </div>
      ) : null}

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor={`${id}-nota`}>
          Nota (opcional)
        </label>
        <input id={`${id}-nota`} name="nota" className="fo-input" maxLength={200} placeholder="Por ejemplo: paga el álbum" />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={alTerminar} disabled={pendiente}>
          Cancelar
        </button>
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          <UserPlus className="size-4" aria-hidden />
          {pendiente ? "Guardando…" : "Vincular"}
        </button>
      </div>
    </form>
  );
}
