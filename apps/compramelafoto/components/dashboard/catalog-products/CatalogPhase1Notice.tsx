import { DsInfoPanel } from "@/components/ui/DsLayout";

export default function CatalogPhase1Notice() {
  return (
    <DsInfoPanel title="Productos en preparación">
      <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-800 m-0">
        Tus productos todavía <strong>no están conectados</strong> a las ventas públicas de tus
        álbumes. Podés organizar tu oferta acá con tranquilidad: no afecta lo que ven tus clientes
        ni los packs que ya tenés configurados.
      </p>
    </DsInfoPanel>
  );
}
