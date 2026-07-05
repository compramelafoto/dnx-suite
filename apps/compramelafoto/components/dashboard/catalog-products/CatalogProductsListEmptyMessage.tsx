"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import { CatalogProductsEmptyShell } from "@/components/dashboard/catalog-products/CatalogProductsEmptyShell";

type Props = {
  variant: "search" | "archived" | "filtered";
};

export default function CatalogProductsListEmptyMessage({ variant }: Props) {
  const copy =
    variant === "archived"
      ? {
          title: "Sin archivados",
          body: "Acá van los productos de temporadas pasadas. Archivalos desde la lista cuando no los uses.",
        }
      : variant === "search"
        ? {
            title: "Sin resultados",
            body: "No encontramos ese nombre en tu catálogo. Probá con otras palabras o limpiá los filtros.",
          }
        : {
            title: "Nada en esta vista",
            body: "No hay productos con los filtros actuales. Cambiá la categoría, el tipo o la pestaña.",
          };

  return (
    <CatalogProductsEmptyShell>
      <Card className="ds-fill-width w-full min-w-0 p-0 shadow-sm">
        <DsEmptyState title={copy.title} className="ds-empty-state--catalog">
          <p className="ds-readable-text ds-readable-text--center ds-readable-text--sm m-0">
            {copy.body}
          </p>
          {variant !== "archived" ? (
            <div className="ds-empty-state__actions">
              <Link href="/dashboard/productos/nuevo" className="ds-empty-state__cta">
                <Button type="button" variant="primary" size="md" className="w-full sm:w-auto">
                  + Crear producto
                </Button>
              </Link>
            </div>
          ) : null}
        </DsEmptyState>
      </Card>
    </CatalogProductsEmptyShell>
  );
}
