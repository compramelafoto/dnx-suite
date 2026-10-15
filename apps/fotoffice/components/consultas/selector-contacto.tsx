"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { buscarContactosAction } from "@/app/actions/consultas";
import type { MarcaDeCampo } from "@/lib/consultas/formulario";

export type ContactoElegido = { id: string; nombre: string; email: string | null; telefono: string | null };

/** Mismo mínimo que el servidor (`MIN_BUSQUEDA_CONTACTO`): con menos no se busca. */
const MIN_TEXTO = 2;

/**
 * Buscador de contactos del workspace (nombre, correo o teléfono). Busca en el servidor, que
 * devuelve hasta 20, y con un clic se elige uno. Sin `elegido`, muestra el buscador.
 */
export function SelectorContacto({
  etiqueta,
  elegido,
  onElegir,
  excluir,
  deshabilitado,
  marca = {},
  buscar = buscarContactosAction,
}: {
  /** Quién busca (por omisión, el de Consultas; la ficha del proyecto pasa el suyo). */
  buscar?: (texto: string) => Promise<{ ok: true; contactos: ContactoElegido[] } | { ok: false; error: string }>;
  etiqueta: string;
  elegido: ContactoElegido | null;
  onElegir: (c: ContactoElegido | null) => void;
  /** Ids que no se ofrecen (por ejemplo, el propio contacto de la consulta). */
  excluir?: readonly string[];
  deshabilitado?: boolean;
  /** `aria-invalid` + `aria-describedby` si el error de la acción apunta a este dato. */
  marca?: MarcaDeCampo;
}) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ContactoElegido[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clavesExcluidas = (excluir ?? []).join("|");

  const t = texto.trim();
  const busca = !elegido && t.length >= MIN_TEXTO;
  useEffect(() => {
    if (!busca) return;
    let vigente = true;
    const espera = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await buscar(t);
        if (!vigente) return;
        if (!r.ok) {
          setError(r.error);
          setResultados([]);
          return;
        }
        setError(null);
        const fuera = new Set(clavesExcluidas ? clavesExcluidas.split("|") : []);
        setResultados(r.contactos.filter((c) => !fuera.has(c.id)));
      } catch {
        if (vigente) setError("No se pudo buscar. Probá de nuevo.");
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [busca, t, clavesExcluidas, buscar]);

  if (elegido) {
    return (
      <div className="fo-field-stack">
        <span className="fo-label">{etiqueta}</span>
        <div role="group" aria-label={etiqueta} {...marca} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--fo-surface-muted)] px-3 py-2 text-sm">
          <span className="min-w-0">
            <Link href={`/clientes/${elegido.id}`} className="font-medium text-[var(--fo-text)] hover:underline">
              {elegido.nombre}
            </Link>
            {elegido.email || elegido.telefono ? (
              <span className="ml-1 break-words text-xs text-[var(--fo-muted)]">
                {[elegido.email, elegido.telefono].filter(Boolean).join(" · ")}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            className="fo-icon-btn"
            disabled={deshabilitado}
            onClick={() => {
              setTexto("");
              onElegir(null);
            }}
            aria-label={`Quitar ${elegido.nombre}`}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fo-field-stack">
      <label className="fo-label" htmlFor={`${id}-buscar`}>
        {etiqueta}
      </label>
      <input
        id={`${id}-buscar`}
        className="fo-input"
        value={texto}
        maxLength={100}
        disabled={deshabilitado}
        {...marca}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscá por nombre, correo o teléfono"
        autoComplete="off"
      />
      {error ? (
        <p role="alert" className="text-xs text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
      {busca ? (
        resultados.length > 0 ? (
          <ul className="max-h-60 divide-y divide-[var(--fo-border)] overflow-y-auto rounded-lg border border-[var(--fo-border)]" aria-label="Contactos encontrados">
            {resultados.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--fo-surface-muted)]"
                  onClick={() => onElegir(c)}
                >
                  <span className="font-medium text-[var(--fo-text)]">{c.nombre}</span>
                  {c.email || c.telefono ? (
                    <span className="ml-1 text-xs text-[var(--fo-muted)]">{[c.email, c.telefono].filter(Boolean).join(" · ")}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--fo-muted)]">{buscando ? "Buscando…" : "No encontramos contactos con ese dato."}</p>
        )
      ) : null}
    </div>
  );
}
