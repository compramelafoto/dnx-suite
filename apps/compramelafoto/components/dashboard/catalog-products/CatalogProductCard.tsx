"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Button from "@/components/ui/Button";
import type { CatalogProductListItem } from "@/lib/catalog-products/serialize";
import { formatCatalogDate, formatCatalogPriceArs } from "@/lib/catalog-products/format";
import {
  CATALOG_PRODUCT_STATUS_STYLES,
  CATALOG_PRODUCT_TYPE_DISPLAY,
  CATALOG_PRODUCT_TYPE_STYLES,
  getCatalogProductStatus,
} from "@/lib/catalog-products/catalog-product-visual";

type CatalogProductCardProps = {
  product: CatalogProductListItem;
  onDuplicate: (id: number) => void;
  onPatch: (id: number, body: Record<string, unknown>) => void;
};

function CatalogProductCardMenu({
  product,
  onPatch,
  onClose,
}: {
  product: CatalogProductListItem;
  onPatch: (id: number, body: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  if (product.isArchived) {
    return (
      <button
        type="button"
        role="menuitem"
        className="w-full text-left px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb] rounded-md"
        onClick={() => {
          void onPatch(product.id, { isArchived: false });
          onClose();
        }}
      >
        Restaurar del archivo
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        role="menuitem"
        className="w-full text-left px-3 py-2 text-sm text-[#6b7280] hover:bg-[#f9fafb] rounded-md"
        onClick={() => {
          void onPatch(product.id, { isActive: !product.isActive });
          onClose();
        }}
      >
        {product.isActive ? "Marcar como inactivo" : "Marcar como activo"}
      </button>
      <button
        type="button"
        role="menuitem"
        className="w-full text-left px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb] rounded-md"
        onClick={() => {
          if (confirm("¿Archivar este producto? Vas a poder restaurarlo desde Archivados.")) {
            void onPatch(product.id, { isArchived: true });
          }
          onClose();
        }}
      >
        Archivar
      </button>
    </>
  );
}

export default function CatalogProductCard({
  product,
  onDuplicate,
  onPatch,
}: CatalogProductCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const typeStyle = CATALOG_PRODUCT_TYPE_STYLES[product.type];
  const status = getCatalogProductStatus(product);
  const statusStyle = CATALOG_PRODUCT_STATUS_STYLES[status];

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  return (
    <article className="ds-catalog-card group">
      <Link
        href={`/dashboard/productos/${product.id}`}
        className="relative block w-full min-w-0 aspect-square ds-catalog-cover-frame overflow-hidden bg-[#f3f4f6] shrink-0"
      >
        {product.mockupUrl ? (
          <Image
            src={product.mockupUrl}
            alt=""
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            unoptimized={product.mockupUrl.startsWith("http")}
          />
        ) : (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${typeStyle.placeholderGradient} px-4`}
            aria-hidden
          >
            <span className="text-4xl sm:text-5xl drop-shadow-md opacity-95">
              {typeStyle.placeholderIcon}
            </span>
            <span className="text-xs font-medium text-white/90 text-center max-w-[12rem]">
              Sumá una imagen de venta
            </span>
          </div>
        )}
        <span
          className={`absolute left-3 top-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${typeStyle.badge}`}
        >
          {CATALOG_PRODUCT_TYPE_DISPLAY[product.type]}
        </span>
      </Link>

      <div className="ds-catalog-card__body">
        <div className="min-w-0 space-y-2">
          <Link
            href={`/dashboard/productos/${product.id}`}
            className="text-base font-semibold text-[#1a1a1a] hover:text-[#c27b3d] line-clamp-2 leading-snug transition-colors"
          >
            {product.name}
          </Link>
          <p className="text-lg font-semibold text-[#c27b3d] m-0 tracking-tight tabular-nums">
            {formatCatalogPriceArs(product.basePriceCents)}
          </p>
          {product.compositionSummary ? (
            <p
              className={`text-sm mt-2 m-0 leading-relaxed line-clamp-2 ${
                product.compositionSummary !== "Sin componentes definidos"
                  ? "text-[#4b5563]"
                  : "text-[#9ca3af] italic"
              }`}
            >
              {product.compositionSummary}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="inline-flex rounded-full bg-[#f9fafb] px-2.5 py-1 text-xs font-medium text-[#4b5563] border border-[#e5e7eb]">
            {product.categoryName}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle.className}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusStyle.dot}`} aria-hidden />
            {statusStyle.label}
          </span>
        </div>

        <p className="text-[11px] text-[#9ca3af] m-0">
          Actualizado {formatCatalogDate(product.updatedAt)}
        </p>

        <div className="ds-catalog-card__footer flex items-center gap-2 pt-2 border-t border-[#f3f4f6] min-w-0">
          <Link href={`/dashboard/productos/${product.id}`} className="min-w-0 flex-1 sm:flex-none">
            <Button type="button" variant="primary" className="w-full sm:w-auto">
              Editar
            </Button>
          </Link>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => onDuplicate(product.id)}
          >
            Duplicar
          </Button>
          <div className="relative shrink-0 ml-auto" ref={menuRef}>
            <button
              type="button"
              aria-label="Más acciones"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#d1d5db] hover:text-[#1a1a1a] transition-colors"
            >
              <span className="text-lg leading-none" aria-hidden>
                ⋯
              </span>
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 bottom-full mb-1 z-20 min-w-[11rem] rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg"
              >
                <CatalogProductCardMenu
                  product={product}
                  onPatch={onPatch}
                  onClose={() => setMenuOpen(false)}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
