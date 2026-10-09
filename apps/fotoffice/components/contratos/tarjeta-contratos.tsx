import type { ContratoDeTarjeta } from "@/lib/contratos/tarjeta-tipos";
import { ListaContratos } from "./lista-contratos";

/**
 * Tarjeta "Contratos" de la ficha del contacto: sus contratos con el estado de cada uno. Los
 * contratos se generan desde el pedido, así que acá no hay botón de alta.
 */
export function TarjetaContratos({ contratos, vacio = "Todavía no tiene contratos." }: { contratos: ContratoDeTarjeta[]; vacio?: string }) {
  return (
    <section aria-labelledby="tarjeta-contratos-titulo" className="fo-card space-y-3 p-4">
      <h2 id="tarjeta-contratos-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        Contratos
      </h2>
      <ListaContratos contratos={contratos} mostrarPedido vacio={vacio} />
    </section>
  );
}
