import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";
import { requireClickatonAdmin } from "@/lib/admin/auth";

type HubCard = {
  title: string;
  body: string;
  status: "available" | "soon";
  href?: string;
  cta?: string;
};

const CARDS: HubCard[] = [
  {
    title: "Productos y variantes",
    body: "Merchandising, variantes (talles, colores, formatos), stock y precios opcionales.",
    status: "available",
    href: catalogAdminRoutes.products,
    cta: "Administrar productos",
  },
  {
    title: "Entradas y kits",
    body: "Tipos de entrada y composición de kits. Disponible en una etapa siguiente.",
    status: "soon",
  },
  {
    title: "Disponibilidad y cupos",
    body: "Lectura de cupos, holds y agotados por tipo de entrada.",
    status: "soon",
  },
  {
    title: "Operación de kits",
    body: "Entrega operativa de kits en sede. Fuera del alcance de esta etapa.",
    status: "soon",
  },
];

export default async function AdminCatalogHubPage() {
  await requireClickatonAdmin();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Catálogo"
        description="Gestión administrativa de productos, variantes y, más adelante, entradas y kits."
        breadcrumbs={[
          { label: "Admin", href: adminRoutes.dashboard },
          { label: "Catálogo" },
        ]}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {CARDS.map((card) => (
          <Card key={card.title} variant="outlined" className="flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-ck-text">{card.title}</h2>
              {card.status === "available" ? (
                <Badge variant="success">Disponible</Badge>
              ) : (
                <Badge variant="neutral">Próximamente</Badge>
              )}
            </div>
            <p className="flex-1 text-sm text-ck-text-secondary">{card.body}</p>
            {card.status === "available" && card.href && card.cta ? (
              <Button href={card.href} variant="primary" className="w-fit">
                {card.cta}
              </Button>
            ) : (
              <p className="text-sm text-ck-text-muted">Sin ruta productiva en esta etapa.</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
