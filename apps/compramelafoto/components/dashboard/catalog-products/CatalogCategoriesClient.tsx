"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import CatalogPhase1Notice from "@/components/dashboard/catalog-products/CatalogPhase1Notice";

type CategoryRow = {
  id: number;
  name: string;
  sortOrder: number;
  productCount: number;
};

const SUGGESTED = ["Escolar", "Deporte", "XV", "Video", "Preventa", "Digital", "Impresión"];

export default function CatalogCategoriesClient() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/dashboard/catalog-product-categories", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.categories)) {
      setCategories(data.categories);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCategory(name: string) {
    setError(null);
    const res = await fetch("/api/dashboard/catalog-product-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Error al crear");
      return;
    }
    setNewName("");
    await load();
  }

  async function renameCategory(id: number, name: string) {
    const res = await fetch(`/api/dashboard/catalog-product-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(typeof data.error === "string" ? data.error : "Error");
      return;
    }
    await load();
  }

  async function deleteCategory(id: number) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    const res = await fetch(`/api/dashboard/catalog-product-categories/${id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof data.error === "string" ? data.error : "No se pudo eliminar");
      return;
    }
    await load();
  }

  return (
    <>
      <PhotographerDashboardHeader photographer={null} />
      <section className="py-10 md:py-12 bg-[#f9fafb] min-h-screen w-full min-w-0">
        <DsPageShell>
          <DsDashboardInner className="w-full max-w-3xl ds-stack-section gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-medium text-[#1a1a1a] m-0">Categorías</h1>
                <p className="text-sm text-[#6b7280] mt-1 m-0">Organizá tu catálogo con etiquetas simples.</p>
              </div>
              <Link href="/dashboard/productos">
                <Button type="button" variant="secondary" size="md">
                  ← Mis Packs y Combos
                </Button>
              </Link>
            </div>

            <CatalogPhase1Notice />

            <Card className="p-5 space-y-4">
              <p className="text-sm font-medium text-[#1a1a1a] m-0">Nueva categoría</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre de categoría"
                  className="flex-1 min-w-0"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="shrink-0"
                  onClick={() => newName.trim() && void createCategory(newName.trim())}
                >
                  Crear
                </Button>
              </div>
              {categories.length === 0 ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="text-xs text-[#6b7280] w-full">Sugerencias:</span>
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void createCategory(s)}
                      className="text-xs rounded-full border border-[#e5e7eb] px-3 py-1 hover:bg-[#f9fafb]"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              ) : null}
              {error ? <p className="text-sm text-red-700 m-0">{error}</p> : null}
            </Card>

            {loading ? (
              <p className="text-sm text-[#6b7280]">Cargando…</p>
            ) : (
              <ul className="m-0 p-0 list-none space-y-2">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <Input
                        defaultValue={c.name}
                        className="flex-1 min-w-0"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== c.name) void renameCategory(c.id, v);
                        }}
                      />
                      <span className="text-xs text-[#6b7280] shrink-0">
                        {c.productCount} producto{c.productCount === 1 ? "" : "s"}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={c.productCount > 0}
                        onClick={() => void deleteCategory(c.id)}
                        title={
                          c.productCount > 0
                            ? "Reasigná los productos antes de eliminar"
                            : "Eliminar"
                        }
                      >
                        Eliminar
                      </Button>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </DsDashboardInner>
        </DsPageShell>
      </section>
    </>
  );
}
