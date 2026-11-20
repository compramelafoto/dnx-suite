import { claseTarjetaEntidad, TituloEntidad } from "@/components/entidades/entidad";
import { estiloDeEntidad } from "@/lib/entidades/colores";
import type { ContratoDeTarjeta } from "@/lib/contratos/tarjeta-tipos";
import { ListaContratos } from "./lista-contratos";

/**
 * Tarjeta "Contratos" de la ficha del contacto: sus contratos con el estado de cada uno. Los
 * contratos se generan desde el pedido, así que acá no hay botón de alta.
 */
export function TarjetaContratos({ contratos, vacio = "Todavía no tiene contratos." }: { contratos: ContratoDeTarjeta[]; vacio?: string }) {
  return (
    <section id="contratos" aria-labelledby="tarjeta-contratos-titulo" style={estiloDeEntidad("contrato")} className={`scroll-mt-24 ${claseTarjetaEntidad()}`}>
      <TituloEntidad entidad="contrato" id="tarjeta-contratos-titulo" cantidad={contratos.length} />
      <ListaContratos contratos={contratos} mostrarPedido vacio={vacio} />
    </section>
  );
}
