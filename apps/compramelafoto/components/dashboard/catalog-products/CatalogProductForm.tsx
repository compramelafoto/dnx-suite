"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import CatalogPhase1Notice from "@/components/dashboard/catalog-products/CatalogPhase1Notice";
import CatalogProductComponentsEditor, {
  buildComponentsPayload,
  validateComponentDrafts,
  type CatalogComponentDraft,
} from "@/components/dashboard/catalog-products/CatalogProductComponentsEditor";
import type { CatalogProductListItem } from "@/lib/catalog-products/serialize";
import { CATALOG_PRODUCT_TYPE_LABELS } from "@/lib/catalog-products/serialize";
import type { CatalogProductType } from "@/lib/prisma";

export type CatalogCategoryOption = { id: number; name: string };

type CatalogProductFormProps = {
  mode: "create" | "edit";
  productId?: number;
  initial?: Partial<CatalogProductListItem>;
  categories: CatalogCategoryOption[];
  onSaved: (product: CatalogProductListItem) => void;
  onCancel: () => void;
};

export default function CatalogProductForm({
  mode,
  productId,
  initial,
  categories,
  onSaved,
  onCancel,
}: CatalogProductFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<CatalogProductType>(initial?.type ?? "SIMPLE");
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId != null ? String(initial.categoryId) : categories[0] ? String(categories[0].id) : ""
  );
  const [basePrice, setBasePrice] = useState(
    initial?.basePriceCents != null ? String(initial.basePriceCents) : ""
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive !== false);
  const [mockupUrl, setMockupUrl] = useState(initial?.mockupUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [componentDrafts, setComponentDrafts] = useState<CatalogComponentDraft[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveProduct(targetId?: number) {
    setSaving(true);
    setError(null);
    try {
      const componentError = validateComponentDrafts(type, componentDrafts);
      if (componentError) {
        setError(componentError);
        return null;
      }

      const payload: Record<string, unknown> = {
        name,
        type,
        categoryId: parseInt(categoryId, 10),
        basePriceCents: basePrice,
        description,
        isActive,
      };

      if (type !== "SIMPLE" || componentDrafts.length > 0) {
        payload.components = buildComponentsPayload(componentDrafts);
      } else {
        payload.components = [];
      }
      const url =
        mode === "create"
          ? "/api/dashboard/catalog-products"
          : `/api/dashboard/catalog-products/${targetId ?? productId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Error al guardar");
      }
      return data as CatalogProductListItem;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      let saved = await saveProduct();
      if (!saved) return;

      const file = fileRef.current?.files?.[0];
      if (file && saved.id) {
        setUploading(true);
        const fd = new FormData();
        fd.append("file", file);
        const upRes = await fetch(`/api/dashboard/catalog-products/${saved.id}/mockup`, {
          method: "POST",
          body: fd,
        });
        const upData = await upRes.json().catch(() => ({}));
        if (upRes.ok && upData.product) {
          saved = upData.product as CatalogProductListItem;
        } else if (!upRes.ok) {
          setError(typeof upData.error === "string" ? upData.error : "Error al subir imagen");
          return;
        }
        setUploading(false);
      }

      onSaved(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  async function uploadMockupOnly() {
    if (!productId) return;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Elegí una imagen primero.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/dashboard/catalog-products/${productId}/mockup`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Error al subir");
      }
      if (data.mockupUrl) setMockupUrl(data.mockupUrl);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full min-w-0 ds-stack-section gap-6">
      <CatalogPhase1Notice />

      <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-8">
        <div className="grid w-full min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="ds-form-stack w-full min-w-0 gap-5">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Nombre</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Pack 10 fotos digitales"
                className="w-full min-w-0"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Tipo</label>
                <Select
                  value={type}
                  onChange={(e) => setType(e.target.value as CatalogProductType)}
                  className="w-full min-w-0"
                >
                  {(Object.keys(CATALOG_PRODUCT_TYPE_LABELS) as CatalogProductType[]).map((t) => (
                    <option key={t} value={t}>
                      {CATALOG_PRODUCT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Categoría</label>
                <Select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full min-w-0"
                  required
                >
                  <option value="">Elegir…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Precio base (ARS)</label>
              <Input
                type="number"
                min={1}
                step={1}
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="Ej: 45000"
                className="w-full min-w-0 max-w-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Descripción</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="text-sm"
                placeholder="Texto que verán tus clientes cuando conectemos la vitrina."
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-[#1a1a1a]">Producto activo en mi catálogo</span>
            </label>

            <CatalogProductComponentsEditor
              key={`${mode}-${productId ?? "new"}-${type}`}
              productType={type}
              initialComponents={initial?.components}
              onChange={setComponentDrafts}
            />
          </div>

          <div className="w-full min-w-0 space-y-3">
            <p className="text-sm font-medium text-[#1a1a1a] m-0">Imagen / mockup</p>
            <div className="relative w-full aspect-square ds-catalog-cover-frame rounded-xl border border-[#e5e7eb] bg-[#f9fafb] overflow-hidden flex items-center justify-center">
              {mockupUrl ? (
                <Image
                  src={mockupUrl}
                  alt={name || "Mockup"}
                  fill
                  className="object-cover"
                  unoptimized={mockupUrl.startsWith("http")}
                />
              ) : (
                <span className="text-sm text-[#9ca3af] px-4 text-center">Sin imagen — se mostrará un placeholder</span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="w-full min-w-0 text-sm"
            />
            {mode === "edit" && productId ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="w-full"
                disabled={uploading}
                onClick={() => void uploadMockupOnly()}
              >
                {uploading ? "Subiendo…" : "Subir imagen ahora"}
              </Button>
            ) : (
              <p className="text-xs text-[#6b7280] m-0">
                Al guardar, la imagen seleccionada se sube automáticamente.
              </p>
            )}
          </div>
        </div>
      </Card>

      {error ? (
        <p className="text-sm text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2 m-0">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" size="md" disabled={saving || uploading}>
          {saving || uploading ? "Guardando…" : mode === "create" ? "Crear producto" : "Guardar cambios"}
        </Button>
        <Button type="button" variant="secondary" size="md" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
