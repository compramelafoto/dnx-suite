"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import CatalogRecommendedTemplatesBlock from "@/components/dashboard/catalog-products/CatalogRecommendedTemplatesBlock";
import { getVisualCategoryList } from "@/lib/catalog-templates/visual-categories";

type CatalogProductsEmptyStateProps = {
  onCloned?: () => void;
};

function HeroVisualMosaic() {
  const samples = getVisualCategoryList().slice(0, 4);

  return (
    <div className="hidden md:grid grid-cols-2 gap-2.5 w-full max-w-[15rem] shrink-0" aria-hidden>
      {samples.map((cat, i) => (
        <div
          key={cat.id}
          className={`aspect-square rounded-xl border border-[#e5e7eb] bg-gradient-to-br ${cat.fallbackGradient} flex flex-col items-center justify-center ${
            i === 1 ? "translate-y-2" : i === 3 ? "-translate-y-1.5" : ""
          }`}
        >
          <span className="text-xl text-[#9ca3af]/70">{cat.icon}</span>
          <span className="mt-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#6b7280]/80">
            {cat.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CatalogProductsEmptyState({ onCloned }: CatalogProductsEmptyStateProps) {
  return (
    <div className="w-full min-w-0 ds-catalog-stack">
      <div className="w-full min-w-0 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white ds-catalog-card">
        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8 px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex-1 min-w-0 max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#c27b3d] m-0 mb-2">
              Primeros pasos
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#1a1a1a] m-0 leading-snug">
              Comenzá con productos listos para vender
            </h2>
            <p className="text-sm text-[#6b7280] mt-2 m-0 max-w-lg leading-relaxed">
              Elegí plantillas del sistema, personalizalas con tu precio y reutilizalas en tus álbumes
              cuando quieras activar ventas.
            </p>

            <ol className="mt-5 space-y-2.5 m-0 p-0 list-none max-w-md">
              {[
                "Explorá plantillas por categoría",
                "Agregalas a tu catálogo en un click",
                "Editá precio, textos e imagen a tu gusto",
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-2.5 text-sm text-[#374151]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[10px] font-semibold text-[#6b7280]">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>

            <div
              className="mt-5 rounded-lg bg-[#f9fafb] border border-[#e5e7eb] px-3.5 py-3 sm:px-4"
              role="note"
            >
              <p className="text-sm text-[#6b7280] m-0 leading-relaxed">
                Estos productos <strong className="font-medium text-[#374151]">aún no se publican</strong>{" "}
                en tus galerías hasta que los actives en un álbum.
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5 w-full min-w-0">
              <Button
                type="button"
                variant="primary"
                size="md"
                className="w-full sm:w-auto"
                onClick={() => {
                  document
                    .getElementById("catalog-templates-marketplace")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Ver plantillas
              </Button>
              <Link href="/dashboard/productos/nuevo" className="w-full sm:w-auto min-w-0">
                <Button type="button" variant="secondary" size="md" className="w-full sm:w-auto">
                  Crear desde cero
                </Button>
              </Link>
            </div>
          </div>

          <HeroVisualMosaic />
        </div>
      </div>

      <div id="catalog-templates-marketplace" className="scroll-mt-4">
        <CatalogRecommendedTemplatesBlock variant="empty" onCloned={onCloned} />
      </div>
    </div>
  );
}
