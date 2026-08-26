import { ShareEditionSalesButton } from "@/components/admin/editions/ShareEditionSalesButton";
import { EditionUnpublishButton } from "@/components/admin/venues/VenueActionButtons";
import { Button } from "@/components/ui/Button";
import { adminRoutes } from "@/config/admin/navigation";

type Props = {
  editionId: string;
  editionName: string;
  isPublished: boolean;
  salesUrl: string;
};

const MODULES = [
  { key: "precios", label: "Precios" },
  { key: "finanzas", label: "Finanzas" },
  { key: "sponsors", label: "Sponsors y beneficios" },
  { key: "cronograma", label: "Cronograma" },
  { key: "consignas", label: "Consignas" },
  { key: "envios", label: "Envíos" },
  { key: "admision", label: "Admisión" },
  { key: "acreditacion", label: "Acreditación" },
  { key: "placas", label: "Placas" },
] as const;

/**
 * Acciones de la ficha de edición: primarias arriba, módulos abajo.
 * Evita una sola fila con 10+ botones que se encogen y se pisan.
 */
export function EditionDetailActions({
  editionId,
  editionName,
  isPublished,
  salesUrl,
}: Props) {
  const base = `${adminRoutes.editions}/${editionId}`;

  return (
    <div className="w-full space-y-4">
      <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3">
        <ShareEditionSalesButton salesUrl={salesUrl} editionName={editionName} />
        <Button href={`${base}/editar`} variant="secondary">
          Editar
        </Button>
        <EditionUnpublishButton editionId={editionId} isPublished={isPublished} />
        <Button href={`${base}/sedes/nueva`} variant="primary">
          Nueva sede
        </Button>
      </div>
      <nav aria-label="Módulos de la edición" className="flex w-full flex-wrap gap-2">
        {MODULES.map((mod) => (
          <Button key={mod.key} href={`${base}/${mod.key}`} variant="outline" size="sm">
            {mod.label}
          </Button>
        ))}
      </nav>
    </div>
  );
}
