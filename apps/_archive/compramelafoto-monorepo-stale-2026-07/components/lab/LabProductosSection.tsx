"use client";

import { useState, useEffect, useMemo } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type LabProduct = {
  id?: number;
  name: string;
  size: string | null;
  acabado: string | null;
  photographerPrice: number;
  retailPrice: number;
  currency?: string;
  isActive: boolean;
};

export default function LabProductosSection({ labId }: { labId: number }) {
  const [products, setProducts] = useState<LabProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string>("");
  const [globalDiscount10, setGlobalDiscount10] = useState<number>(0);
  const [globalDiscount30, setGlobalDiscount30] = useState<number>(0);
  const [globalDiscount50, setGlobalDiscount50] = useState<number>(0);
  const [globalDiscount80, setGlobalDiscount80] = useState<number>(0);
  const [globalDiscount100, setGlobalDiscount100] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [lab, setLab] = useState<{ showCarnetPrints?: boolean; showPolaroidPrints?: boolean } | null>(null);

  const normalizeProductName = (name: string) => name.trim().toLowerCase();
  const isCarnetProduct = (product: { name: string }) => {
    const n = normalizeProductName(product.name || "");
    return n === "fotos carnet" || n === "foto carnet";
  };
  const isPolaroidProduct = (product: { name: string }) => {
    const n = normalizeProductName(product.name || "");
    return n === "polaroid" || n === "polaroids";
  };

  const orderedProducts = useMemo(() => {
    const shouldPinCarnet = lab?.showCarnetPrints === true;
    const shouldPinPolaroid = lab?.showPolaroidPrints === true;
    return products
      .map((product, index) => ({ product, index }))
      .sort((a, b) => {
        const aRank = isCarnetProduct(a.product) && shouldPinCarnet ? 0 : isPolaroidProduct(a.product) && shouldPinPolaroid ? 1 : 2;
        const bRank = isCarnetProduct(b.product) && shouldPinCarnet ? 0 : isPolaroidProduct(b.product) && shouldPinPolaroid ? 1 : 2;
        if (aRank !== bRank) return aRank - bRank;
        return a.index - b.index;
      });
  }, [products, lab]);

  async function loadProducts() {
    setProductsLoading(true);
    setProductsError("");
    try {
      const res = await fetch(`/api/lab/products?labId=${labId}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } else {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        setProductsError(err.error || "Error cargando productos");
      }
    } catch (err: any) {
      setProductsError(err?.message || "Error cargando productos");
    } finally {
      setProductsLoading(false);
    }
  }

  const disc = (arr: any[], minQty: number) => arr.find((d: any) => d.size === "GLOBAL" && d.minQty === minQty)?.discountPercent || 0;

  async function loadGlobalDiscounts() {
    try {
      const res = await fetch(`/api/lab/pricing?labId=${labId}`);
      if (res.ok) {
        const data = await res.json();
        const discounts = data.discounts || [];
        setGlobalDiscount10(disc(discounts, 10));
        setGlobalDiscount30(disc(discounts, 30));
        setGlobalDiscount50(disc(discounts, 50));
        setGlobalDiscount80(disc(discounts, 80));
        setGlobalDiscount100(disc(discounts, 100));
      }
    } catch (err) {
      console.error("Error cargando descuentos:", err);
    }
  }

  async function saveGlobalDiscounts() {
    setBusy(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/lab/pricing?labId=${labId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discounts: [
            { size: "GLOBAL", minQty: 10, discountPercent: globalDiscount10 },
            { size: "GLOBAL", minQty: 30, discountPercent: globalDiscount30 },
            { size: "GLOBAL", minQty: 50, discountPercent: globalDiscount50 },
            { size: "GLOBAL", minQty: 80, discountPercent: globalDiscount80 },
            { size: "GLOBAL", minQty: 100, discountPercent: globalDiscount100 },
          ],
        }),
      });
      if (res.ok) {
        await loadGlobalDiscounts();
        alert("✅ Descuentos guardados exitosamente");
      } else {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        setErrorMsg(err.error || "Error guardando descuentos");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Error guardando descuentos");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadProducts();
    loadGlobalDiscounts();
    fetch(`/api/lab/${labId}`)
      .then((res) => res.json())
      .then((data) => setLab({ showCarnetPrints: data.showCarnetPrints ?? false, showPolaroidPrints: data.showPolaroidPrints ?? false }))
      .catch(() => {});
  }, [labId]);

  function updateProduct(index: number, field: keyof LabProduct, value: any) {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
  }

  function removeProduct(index: number) {
    setProducts(products.filter((_, i) => i !== index));
  }

  function duplicateProduct(index: number) {
    const p = products[index];
    const updated = [...products];
    updated.splice(index + 1, 0, { ...p, id: undefined });
    setProducts(updated);
  }

  async function saveProducts() {
    setProductsLoading(true);
    setProductsError("");
    try {
      const res = await fetch(`/api/lab/products?labId=${labId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId,
          products: products
            .map((p) => {
              if (isCarnetProduct(p)) return { ...p, name: "Fotos Carnet", size: "10x15", acabado: "BRILLO" };
              if (isPolaroidProduct(p)) return { ...p, name: "Polaroid" };
              return p;
            })
            .filter((p) => p.name.trim()),
        }),
        credentials: "include",
      });
      if (res.ok) {
        await loadProducts();
        alert("✅ Productos guardados exitosamente");
      } else {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        setProductsError(err.error || "Error guardando productos");
      }
    } catch (err: any) {
      setProductsError(err?.message || "Error guardando productos");
    } finally {
      setProductsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-medium text-[#1a1a1a]">Productos a la venta</h2>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const res = await fetch("/api/lab/catalog/template", { credentials: "include" });
                  if (res.ok) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "plantilla-productos.xlsx";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  }
                } catch (err) {
                  console.error("Error descargando plantilla:", err);
                }
              }}
            >
              📥 Descargar Plantilla
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const res = await fetch("/api/lab/catalog/export", { credentials: "include" });
                  if (res.ok) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `catalogo-productos-${new Date().toISOString().split("T")[0]}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  }
                } catch (err) {
                  console.error("Error exportando catálogo:", err);
                }
              }}
            >
              📤 Exportar Catálogo
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".xlsx,.xls";
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  setProductsLoading(true);
                  setProductsError("");
                  try {
                    const formData = new FormData();
                    formData.append("file", file);
                    const res = await fetch("/api/lab/catalog/import", { method: "POST", body: formData, credentials: "include" });
                    if (res.ok) {
                      const data = await res.json();
                      await loadProducts();
                      alert(`✅ Importación exitosa: ${data.created || 0} creados, ${data.updated || 0} actualizados`);
                    } else {
                      const errData = await res.json().catch(() => ({}));
                      setProductsError(errData.error || (errData.errors ? errData.errors.map((x: any) => x.message).join("\n") : "Error importando"));
                    }
                  } catch (err: any) {
                    setProductsError(err?.message || "Error importando catálogo");
                  } finally {
                    setProductsLoading(false);
                  }
                };
                input.click();
              }}
            >
              📥 Importar/Actualizar
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                setProducts([
                  ...products,
                  { name: "", size: null, acabado: null, photographerPrice: 0, retailPrice: 0, currency: "ARS", isActive: true },
                ])
              }
            >
              + Agregar Producto
            </Button>
          </div>
        </div>

        {productsError && (
          <div className="p-4 border-2 border-red-400 bg-red-50 rounded-lg mb-4">
            <p className="text-sm text-red-700 whitespace-pre-wrap">{productsError}</p>
          </div>
        )}

        {productsLoading && !products.length && (
          <div className="text-center py-8">
            <p className="text-[#6b7280]">Cargando productos...</p>
          </div>
        )}

        {products.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-[#f8f9fa]">
                  <th className="text-left py-3 px-4 border-b-2 border-[#e5e7eb] font-semibold text-sm text-[#1a1a1a]">Nombre</th>
                  <th className="text-left py-3 px-4 border-b-2 border-[#e5e7eb] font-semibold text-sm text-[#1a1a1a]">Tamaño</th>
                  <th className="text-left py-3 px-4 border-b-2 border-[#e5e7eb] font-semibold text-sm text-[#1a1a1a]">Acabado</th>
                  <th className="text-left py-3 px-4 border-b-2 border-[#e5e7eb] font-semibold text-sm text-[#1a1a1a]">Precio Profesional (ARS)</th>
                  <th className="text-left py-3 px-4 border-b-2 border-[#e5e7eb] font-semibold text-sm text-[#1a1a1a]">Precio al Público (ARS)</th>
                  <th className="text-left py-3 px-4 border-b-2 border-[#e5e7eb] font-semibold text-sm text-[#1a1a1a]">Activo</th>
                  <th className="text-center py-3 px-4 border-b-2 border-[#e5e7eb] font-semibold text-sm text-[#1a1a1a]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orderedProducts.map(({ product, index }) => {
                  const isCarnet = isCarnetProduct(product);
                  const isPolaroid = isPolaroidProduct(product);
                  return (
                    <tr key={index} className="hover:bg-[#f9fafb] transition-colors">
                      <td className="py-3 px-4 border-b border-[#e5e7eb]">
                        <input
                          className="w-full px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                          type="text"
                          placeholder="Ej: Foto Impresa..."
                          value={isCarnet ? "Fotos Carnet" : isPolaroid ? "Polaroid" : product.name}
                          onChange={(e) => updateProduct(index, "name", e.target.value)}
                          disabled={isCarnet || isPolaroid}
                        />
                      </td>
                      <td className="py-3 px-4 border-b border-[#e5e7eb]">
                        <input
                          className="w-full px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                          type="text"
                          placeholder="Ej: 10x15..."
                          value={isCarnet ? "10x15" : product.size || ""}
                          onChange={(e) => updateProduct(index, "size", e.target.value.trim() || null)}
                          disabled={isCarnet || isPolaroid}
                        />
                      </td>
                      <td className="py-3 px-4 border-b border-[#e5e7eb]">
                        <input
                          className="w-full px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                          type="text"
                          placeholder="Ej: Brillo, Mate..."
                          value={isCarnet ? "BRILLO" : product.acabado || ""}
                          onChange={(e) => updateProduct(index, "acabado", e.target.value.trim() || null)}
                          disabled={isCarnet}
                        />
                      </td>
                      <td className="py-3 px-4 border-b border-[#e5e7eb]">
                        <input
                          className="w-full px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={product.photographerPrice || ""}
                          onChange={(e) => updateProduct(index, "photographerPrice", parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="py-3 px-4 border-b border-[#e5e7eb]">
                        <input
                          className="w-full px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={product.retailPrice || ""}
                          onChange={(e) => updateProduct(index, "retailPrice", parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="py-3 px-4 border-b border-[#e5e7eb]">
                        <input type="checkbox" checked={product.isActive} onChange={(e) => updateProduct(index, "isActive", e.target.checked)} className="w-5 h-5" />
                      </td>
                      <td className="py-3 px-4 border-b border-[#e5e7eb] text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => duplicateProduct(index)} className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md" title="Duplicar" aria-label="Duplicar">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                          </button>
                          <button onClick={() => removeProduct(index)} className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md" title="Eliminar" aria-label="Eliminar">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {products.length === 0 && !productsLoading && (
          <div className="text-center py-8 text-[#6b7280]">
            <p>No hay productos cargados. Hacé clic en &quot;Agregar Producto&quot; para comenzar.</p>
          </div>
        )}

        {products.length > 0 && (
          <div className="flex justify-end pt-4 border-t border-[#e5e7eb] mt-6">
            <Button variant="primary" onClick={saveProducts} disabled={productsLoading}>
              {productsLoading ? "Guardando..." : "Guardar Productos"}
            </Button>
          </div>
        )}
      </Card>

      <Card className="space-y-6 mt-6">
        <h2 className="text-xl font-medium text-[#1a1a1a] mb-2">Descuentos por Cantidad</h2>
        <p className="text-sm text-[#6b7280] mb-4">
          Configurá descuentos porcentuales por cantidad (10, 30, 50, 80, 100+ unidades). Los descuentos se gestionan en Configuración → Descuentos.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {[
            { qty: 10, val: globalDiscount10, set: setGlobalDiscount10 },
            { qty: 30, val: globalDiscount30, set: setGlobalDiscount30 },
            { qty: 50, val: globalDiscount50, set: setGlobalDiscount50 },
            { qty: 80, val: globalDiscount80, set: setGlobalDiscount80 },
            { qty: 100, val: globalDiscount100, set: setGlobalDiscount100 },
          ].map(({ qty, val, set }) => (
            <div key={qty}>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">{qty}+ unidades (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={val}
                onChange={(e) => set(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-[#d1d5db] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
              />
            </div>
          ))}
        </div>
        {errorMsg && <div className="p-3 border border-red-300 bg-red-50 rounded-lg text-red-700 text-sm">{errorMsg}</div>}
        <div className="flex gap-3 pt-4">
          <Button variant="primary" onClick={saveGlobalDiscounts} disabled={busy}>
            {busy ? "Guardando..." : "Guardar Descuentos"}
          </Button>
          <Button variant="secondary" onClick={loadGlobalDiscounts} disabled={busy}>
            Recargar
          </Button>
        </div>
      </Card>
    </div>
  );
}
