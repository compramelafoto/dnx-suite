import Link from "next/link";
import { ETIQUETA_ESTADO_CONTRATO } from "@/lib/contratos/constantes";
import { claseDeEstadoContrato } from "@/lib/contratos/estado-vista";
import type { ContratoDeTarjeta } from "@/lib/contratos/tarjeta-tipos";
import { fechaBA } from "@/lib/ficha/formato";

/** Los contratos de un pedido o de un contacto: número, nombre, estado y fecha, con enlace a la ficha. */
export function ListaContratos({ contratos, mostrarPedido = false, vacio }: { contratos: ContratoDeTarjeta[]; mostrarPedido?: boolean; vacio: string }) {
  if (contratos.length === 0) return <p className="text-sm text-[var(--fo-muted)]">{vacio}</p>;
  return (
    <ul className="divide-y divide-[var(--fo-border)] text-sm">
      {contratos.map((c) => (
        <li key={c.id} className="py-2 first:pt-0 last:pb-0">
          <Link href={`/contratos/${encodeURIComponent(c.id)}`} className="block rounded-[var(--fo-radius-sm)] hover:bg-[var(--fo-surface-hover)]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-[var(--fo-text)]">N° {c.numero}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${claseDeEstadoContrato(c.estado)}`}>{ETIQUETA_ESTADO_CONTRATO[c.estado]}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--fo-muted)]">
              <span>{c.nombre}</span>
              {mostrarPedido ? <span>Pedido N° {c.pedido.numero}</span> : null}
              <span>{fechaBA(c.creadoEn)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
