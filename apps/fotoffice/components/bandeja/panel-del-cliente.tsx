"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { buscarClientesAction, crearContactoDesdeChatAction, vincularClienteAction } from "@/app/actions/bandeja";

type Encontrado = { id: string; nombre: string; telefono: string | null };

export type ClienteDelPanel = {
  id: string;
  nombre: string;
  href: string;
  consultas: number | null;
  presupuestos: number | null;
};

/**
 * Panel lateral del chat: el cliente vinculado (con enlace a su ficha) o, para quien puede operar,
 * buscar un cliente para vincular o crear el contacto con el número del chat.
 */
export function PanelDelCliente({
  chatId,
  cliente,
  clienteOculto,
  puedeOperar,
  nombrePerfil,
  waId,
}: {
  chatId: string;
  cliente: ClienteDelPanel | null;
  clienteOculto: boolean;
  puedeOperar: boolean;
  nombrePerfil: string | null;
  waId: string;
}) {
  const router = useRouter();
  const idBusqueda = useId();
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Encontrado[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function correr(accion: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    if (ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      const r = await accion();
      if (r.ok) {
        setResultados(null);
        setQ("");
        router.refresh();
      } else {
        setError(r.error);
      }
    } catch {
      setError("No se pudo completar la acción. Probá de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      const r = await buscarClientesAction(q);
      if (r.ok) setResultados(r.clientes);
      else setError(r.error);
    } catch {
      setError("No se pudo buscar. Probá de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section aria-labelledby="panel-cliente-titulo" className="fo-card space-y-3">
      <h2 id="panel-cliente-titulo" className="text-base font-semibold text-[var(--fo-text)]">
        Cliente
      </h2>
      {cliente ? (
        <div className="space-y-1 text-sm">
          <p className="break-words font-medium text-[var(--fo-text)]">{cliente.nombre}</p>
          <Link href={cliente.href} className="text-[var(--fo-accent-hover)] underline">
            Abrir la ficha
          </Link>
          {cliente.consultas !== null ? <p className="text-[var(--fo-muted)]">Consultas: {cliente.consultas}</p> : null}
          {cliente.presupuestos !== null ? <p className="text-[var(--fo-muted)]">Presupuestos: {cliente.presupuestos}</p> : null}
        </div>
      ) : clienteOculto ? (
        <p className="text-sm text-[var(--fo-muted)]">Este chat está vinculado a un cliente, pero no tenés permiso para ver Clientes.</p>
      ) : (
        <p className="text-sm text-[var(--fo-muted)]">
          {nombrePerfil ? `${nombrePerfil} · ` : ""}+{waId}. Todavía no está vinculado a un cliente.
        </p>
      )}

      {puedeOperar && !cliente && !clienteOculto ? (
        <div className="space-y-3 border-t border-[var(--fo-border)] pt-3">
          <form onSubmit={buscar} className="space-y-2" role="search">
            <label htmlFor={idBusqueda} className="fo-label">
              Vincular a un cliente
            </label>
            <input
              id={idBusqueda}
              type="search"
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
              maxLength={80}
              className="fo-input"
              placeholder="Nombre o teléfono"
              autoComplete="off"
            />
            <button type="submit" className="fo-btn fo-btn-secondary text-sm" disabled={ocupado || q.trim().length < 2}>
              Buscar
            </button>
          </form>
          {resultados ? (
            resultados.length === 0 ? (
              <p role="status" className="text-sm text-[var(--fo-muted)]">
                No encontramos clientes con eso.
              </p>
            ) : (
              <ul className="space-y-2" aria-label="Clientes encontrados">
                {resultados.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 break-words text-sm">
                      {c.nombre}
                      {c.telefono ? <span className="block text-xs text-[var(--fo-muted)]">{c.telefono}</span> : null}
                    </span>
                    <button
                      type="button"
                      className="fo-btn fo-btn-secondary shrink-0 text-sm"
                      disabled={ocupado}
                      onClick={() => correr(() => vincularClienteAction(chatId, c.id))}
                    >
                      Vincular
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
          <div>
            <button type="button" className="fo-btn fo-btn-ghost text-sm" disabled={ocupado} onClick={() => correr(() => crearContactoDesdeChatAction(chatId, nombrePerfil ?? undefined))}>
              Crear contacto con este número
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
