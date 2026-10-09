"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buscarContactosContratosAction, fijarContratanteAction, quitarContratante2Action } from "@/app/actions/contratos";
import { SelectorContacto, type ContactoElegido } from "@/components/consultas/selector-contacto";

export type ContratanteVista = {
  orden: 1 | 2;
  clientId: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  porOmision: boolean;
};

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

/**
 * Contratantes de la ficha del pedido. El 1 es, por omisión, el contacto del pedido; el 2 es opcional.
 * Cada uno se elige entre los contactos del workspace. Sin correo, el contrato no se puede mandar a
 * firmar a esa persona: se avisa acá, antes de llegar al envío. Las reglas las vuelve a mirar el servidor.
 */
export function ContratantesDelPedido({
  pedidoId,
  contratantes,
  puedeEditar,
  puedeBuscar,
  puedeVerContactos,
}: {
  pedidoId: string;
  contratantes: ContratanteVista[];
  puedeEditar: boolean;
  /** "Ver" en Clientes: sin eso el buscador no funciona. */
  puedeBuscar: boolean;
  puedeVerContactos: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [editando, setEditando] = useState<1 | 2 | null>(null);
  const [elegido, setElegido] = useState<ContactoElegido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uno = contratantes.find((c) => c.orden === 1);
  const dos = contratantes.find((c) => c.orden === 2);
  const excluir = contratantes.map((c) => c.clientId);

  function cerrar() {
    setEditando(null);
    setElegido(null);
  }

  function guardar() {
    if (!editando || !elegido) return;
    setError(null);
    iniciar(async () => {
      const r = await fijarContratanteAction({ pedidoId, orden: editando, clientId: elegido.id }).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (r.ok) {
        cerrar();
        router.refresh();
      } else setError(r.error);
    });
  }

  function quitar2() {
    setError(null);
    iniciar(async () => {
      const r = await quitarContratante2Action(pedidoId).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function Fila({ c, etiqueta }: { c: ContratanteVista; etiqueta: string }) {
    return (
      <li className="space-y-1 py-3 text-sm">
        <p className="text-xs text-[var(--fo-muted)]">
          {etiqueta}
          {c.porOmision ? " · contacto del pedido" : ""}
        </p>
        <p>
          {puedeVerContactos ? (
            <Link href={`/clientes/${encodeURIComponent(c.clientId)}`} className="font-medium hover:underline">
              {c.nombre}
            </Link>
          ) : (
            <span className="font-medium">{c.nombre}</span>
          )}
          {c.email || c.telefono ? <span className="ml-1 text-xs text-[var(--fo-muted)]">{[c.email, c.telefono].filter(Boolean).join(" · ")}</span> : null}
        </p>
        {!c.email ? (
          <p role="status" className="text-xs text-[var(--fo-warning)]">
            Este contacto no tiene correo: sin correo no se le puede mandar el contrato a firmar. Cargalo en su ficha.
          </p>
        ) : null}
        {puedeEditar && puedeBuscar ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={() => { setError(null); setElegido(null); setEditando(c.orden); }} disabled={pendiente}>
              Cambiar
            </button>
            {c.orden === 2 ? (
              <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={quitar2} disabled={pendiente}>
                Quitar
              </button>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-[var(--fo-border)]">
        {uno ? <Fila c={uno} etiqueta="Contratante 1" /> : null}
        {dos ? <Fila c={dos} etiqueta="Contratante 2" /> : null}
      </ul>
      {!dos && puedeEditar && puedeBuscar && editando === null ? (
        <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => { setError(null); setElegido(null); setEditando(2); }} disabled={pendiente}>
          Agregar contratante 2
        </button>
      ) : null}
      {editando !== null ? (
        <div className="space-y-3 rounded-lg border border-[var(--fo-border)] p-3">
          <SelectorContacto
            etiqueta={`Contratante ${editando}`}
            elegido={elegido}
            onElegir={setElegido}
            excluir={editando === 1 ? excluir.filter((id) => id !== uno?.clientId) : excluir.filter((id) => id !== dos?.clientId)}
            deshabilitado={pendiente}
            buscar={buscarContactosContratosAction}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={guardar} disabled={pendiente || !elegido}>
              {pendiente ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={cerrar} disabled={pendiente}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
      {puedeEditar && !puedeBuscar ? (
        <p className="text-xs text-[var(--fo-muted)]">Para elegir otros contratantes necesitás permiso para ver Clientes.</p>
      ) : null}
    </div>
  );
}
