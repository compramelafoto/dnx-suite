"use client";

import { useEffect, useMemo, useState } from "react";
import { totalFromBase } from "@/lib/pricing/fee-formula";
import PhotoSlideViewer from "@/components/photo/PhotoSlideViewer";

type UploadedFile = {
  fileKey: string;
  url: string;
  originalName: string;
};

type Finish = "BRILLO" | "MATE";

type Item = {
  fileKey: string;
  previewUrl: string;
  originalName: string;

  size: string;
  finish: Finish;
  quantity: number;
  productId?: number | null;
  productName?: string | null;

  selected: boolean;
};

type LabPricing = {
  basePrices: Array<{ size: string; unitPrice: number }>;
  discounts: Array<{ size: string; minQty: number; discountPercent: number }>;
  platformCommissionPercent?: number;
  products?: LabProduct[];
};

type LabProduct = {
  id: number;
  name: string;
  size: string | null;
  acabado: string | null;
  retailPrice: number;
  isActive: boolean;
};

function roundMoney(n: number) {
  return Math.round(n);
}

function pickDiscountPercent(qty: number, d50?: number, d100?: number) {
  if (qty >= 100) return d100 ?? 0;
  if (qty >= 50) return d50 ?? 0;
  return 0;
}

export default function ImprimirPage() {
  const [labId, setLabId] = useState<number | null>(null);
  const [photographerId, setPhotographerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadDone, setUploadDone] = useState(0);

  // Config masiva (default pedido)
  const [bulkSize, setBulkSize] = useState("10x15");
  const [bulkFinish, setBulkFinish] = useState<Finish>("BRILLO");
  const [bulkQty, setBulkQty] = useState(1);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSlideViewer, setShowSlideViewer] = useState(false);
  const [slideViewerIndex, setSlideViewerIndex] = useState(0);

  // Pricing del fotógrafo
  const [pricing, setPricing] = useState<LabPricing | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [labProducts, setLabProducts] = useState<LabProduct[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  const [bulkProductId, setBulkProductId] = useState<number | null>(null);
  const [bulkProductName, setBulkProductName] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    if (photographerId === null) return;

    async function loadPricing() {
      try {
        setPricingLoading(true);
        const res = await fetch(`/api/public/lab-pricing?photographerId=${photographerId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Error cargando precios del fotógrafo");
        if (alive) setPricing(data);
        if (alive && Array.isArray(data.products)) {
          setLabProducts(data.products.filter((p: LabProduct) => p.isActive !== false));
          setProductsLoaded(true);
        }
      } catch (e: any) {
        if (alive) setError(e?.message || "Error");
      } finally {
        if (alive) setPricingLoading(false);
      }
    }

    loadPricing();
    return () => {
      alive = false;
    };
  }, [photographerId]);

  useEffect(() => {
    if (!pricing) return;
    if (labProducts.length === 0) {
      setProductsLoaded(true);
    }
  }, [pricing, labProducts.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const param = params.get("photographerId");
    const parsed = Number(param);
    const saved = Number(sessionStorage.getItem("photographerId") || "");
    const resolved = Number.isFinite(parsed) && parsed > 0
      ? parsed
      : Number.isFinite(saved) && saved > 0
      ? saved
      : 32;
    setPhotographerId(resolved);
    sessionStorage.setItem("imprimirPhotographerId", String(resolved));
  }, []);

  function setAllSelected(value: boolean) {
    setItems((prev) => prev.map((it) => ({ ...it, selected: value })));
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const nextItem = { ...current, ...patch };
      const productKey =
        (nextItem.productName || "").trim() ||
        (nextItem.productId != null ? String(nextItem.productId) : "__NO_PRODUCT__");
      const nextKey = `${nextItem.previewUrl}::${productKey}::${nextItem.size}::${nextItem.finish}`;
      if (productKey) {
        const hasDuplicate = prev.some((it, i) => {
          if (i === index) return false;
          const key =
            `${it.previewUrl}::${(it.productName || "").trim() || (it.productId != null ? String(it.productId) : "__NO_PRODUCT__")}::${it.size}::${it.finish}`;
          return key === nextKey;
        });
        if (hasDuplicate) {
          setError("Ya existe un ítem igual para esta foto (mismo producto, tamaño y acabado).");
          return prev;
        }
      }
      return prev.map((it, i) => (i === index ? nextItem : it));
    });
  }

  function applyBulkToSelected() {
    const hasSelected = items.some((it) => it.selected);
    if (!hasSelected) {
      alert("Primero seleccioná al menos una foto (checkbox).");
      return;
    }

    setItems((prev) =>
      prev.map((it) =>
        it.selected
          ? {
              ...it,
              productId: bulkProductId,
              productName: bulkProductName,
              size: bulkSize,
              finish: bulkFinish,
              quantity: bulkQty,
            }
          : it
      )
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const maxMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 10);
      const maxBytes = maxMb * 1024 * 1024;
      const fileList = Array.from(files);
      setUploadTotal(fileList.length);
      setUploadDone(0);
      const tooLarge = fileList.filter((f) => f.size > maxBytes);
      if (tooLarge.length > 0) {
        throw new Error(`Algunas fotos superan el límite de ${maxMb} MB.`);
      }

      const uploaded: UploadedFile[] = [];
      for (const file of fileList) {
        const formData = new FormData();
        formData.append("files", file);
        formData.append("applyWatermark", "false");

        const res = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });

        const contentType = res.headers.get("content-type") || "";
        if (!res.ok) {
          if (contentType.includes("application/json")) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData?.error || "Error subiendo archivos");
          }
          const text = await res.text();
          throw new Error(text || "Error subiendo archivos");
        }

        const data = contentType.includes("application/json") ? await res.json() : { files: [] };
        const batch = ((data.files as any[]) || []).map((f) => ({
          fileKey: f.fileKey || f.key,
          url: f.url,
          originalName: f.originalName || f.name,
        })) as UploadedFile[];
        uploaded.push(...batch);
        setUploadDone((prev) => prev + 1);
      }

      setItems((prev) => [
        ...prev,
        ...uploaded.map((u) => ({
          fileKey: u.fileKey,
          previewUrl: u.url,
          originalName: u.originalName,

          size: bulkSize,
          finish: bulkFinish,
          quantity: bulkQty,
          productId: bulkProductId,
          productName: bulkProductName,

          selected: true,
        })),
      ]);

      e.target.value = "";
    } catch (err: any) {
      setError(err?.message || "Error");
    } finally {
      setUploading(false);
    }
  }

  // ======== Cálculo estimado (mismo criterio que backend) ========

  const qtyBySize = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      m.set(it.size, (m.get(it.size) ?? 0) + (Number(it.quantity) || 0));
    }
    return m;
  }, [items]);

  const baseBySize = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pricing?.basePrices ?? []) m.set(p.size, p.unitPrice);
    return m;
  }, [pricing]);

  function normalizeProductName(name: string) {
    return name.split(" - ")[0].trim().toLowerCase();
  }

  function findProductForItem(it: Item) {
    if (!labProducts.length) return null;
    if (it.productId) {
      const byId = labProducts.find((p) => p.id === it.productId);
      if (byId) return byId;
    }
    if (it.productName) {
      const normalized = normalizeProductName(it.productName);
      const finish = it.finish || null;
      const size = it.size || null;
      return (
        labProducts.find((p) => {
          return normalizeProductName(p.name) === normalized &&
            (p.size || null) === size &&
            (p.acabado || null) === finish;
        }) ||
        labProducts.find((p) => normalizeProductName(p.name) === normalized && (p.size || null) === size) ||
        labProducts.find((p) => normalizeProductName(p.name) === normalized)
      );
    }
    return labProducts.find((p) => (p.size || null) === (it.size || null)) || null;
  }

  const platformFeePercent = pricing?.platformCommissionPercent ?? 0;

  function estimatedUnitPriceForItem(it: Item) {
    const product = findProductForItem(it);
    const base = product?.retailPrice ?? baseBySize.get(it.size) ?? 0;
    return totalFromBase(Math.round(base), platformFeePercent);
  }

  const totalPreview = useMemo(() => {
    return items.reduce((acc, it) => {
      const unit = estimatedUnitPriceForItem(it);
      return acc + unit * (Number(it.quantity) || 0);
    }, 0);
  }, [items, baseBySize, qtyBySize, labProducts, platformFeePercent]);

  // ======== Crear pedido (NO mandamos precios) ========

  async function createOrder() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (items.length === 0) throw new Error("Primero subí al menos una foto.");
      if (!photographerId) throw new Error("No se pudo cargar el fotógrafo/precios.");

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.fileKey) throw new Error(`Item #${i + 1}: falta fileKey`);
        if (!it.size) throw new Error(`Item #${i + 1}: falta tamaño`);
        if (!it.finish) throw new Error(`Item #${i + 1}: falta acabado`);
        if (!Number.isFinite(it.quantity) || it.quantity < 1)
          throw new Error(`Item #${i + 1}: cantidad inválida`);
      }

      const res = await fetch("/api/print-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId: 1,
          photographerId,
          customerName: customerName || undefined,
          customerEmail: customerEmail || undefined,
          customerPhone: customerPhone || undefined,
          items: items.map((it) => ({
            fileKey: it.fileKey,
            originalName: it.originalName,
            size: it.size,
            finish: it.finish,
            quantity: it.quantity,
            productId: it.productId ?? null,
            productName: it.productName ?? null,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error creando pedido");

      setResult(data);
    } catch (e: any) {
      setError(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8 py-6">
      <h1>Imprimí tus fotos</h1>
      <p style={{ opacity: 0.8, marginTop: 4 }}>
        Subí todas las fotos juntas. Luego aplicá tamaño/acabado/cantidad en masa con “Aplicar a seleccionadas”.
      </p>

      <section style={{ marginTop: 12, padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
        <b>Precios:</b>{" "}
        {pricingLoading ? "Cargando..." : pricing ? "Lista del fotógrafo" : "No disponible"}
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          * Precio final con fee de plataforma incluido ({platformFeePercent}%).
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>1) Subir fotos</h2>
        <input type="file" multiple accept="image/*" onChange={onPickFiles} disabled={uploading} />
        {uploading && <p>Subiendo...</p>}
        {uploading && uploadTotal > 0 && (
          <div className="mt-3 max-w-sm">
            <p className="text-sm text-[#6b7280]">
              Subiendo fotos {Math.min(uploadDone, uploadTotal)}/{uploadTotal}
            </p>
            <div className="h-2 w-full rounded-full bg-[#e5e7eb] overflow-hidden mt-2">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.round((Math.min(uploadDone, uploadTotal) / uploadTotal) * 100))}%`,
                  backgroundColor: "#c27b3d",
                }}
              />
            </div>
            <p className="mt-2 text-xs text-[#6b7280]">
              {Math.min(100, Math.round((Math.min(uploadDone, uploadTotal) / uploadTotal) * 100))}% completado
            </p>
          </div>
        )}

        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <h3>Configuración masiva (aplicar a seleccionadas)</h3>
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-start sm:items-center">
            {productsLoaded && labProducts.length > 0 && (
              <label>
                Producto{" "}
                <select
                  value={bulkProductName || ""}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    if (!selectedName) {
                      setBulkProductName(null);
                      setBulkProductId(null);
                      return;
                    }
                    const match =
                      labProducts.find(
                        (p) =>
                          p.name.split(" - ")[0].trim() === selectedName &&
                          (p.size === bulkSize || !bulkSize)
                      ) ||
                      labProducts.find((p) => p.name.split(" - ")[0].trim() === selectedName);
                    if (match) {
                      setBulkProductName(selectedName);
                      setBulkProductId(match.id);
                      if (match.size && match.size !== bulkSize) setBulkSize(match.size);
                      if (match.acabado) setBulkFinish(match.acabado as Finish);
                    }
                  }}
                >
                  <option value="">Sin producto específico</option>
                  {Array.from(
                    new Set(labProducts.map((p) => p.name.split(" - ")[0].trim()))
                  ).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Tamaño{" "}
              <select value={bulkSize} onChange={(e) => setBulkSize(e.target.value)}>
                {(pricing?.basePrices?.length
                  ? Array.from(new Map(pricing.basePrices.map((bp) => [bp.size, bp])).values())
                  : []
                ).map((bp) => (
                  <option key={bp.size} value={bp.size}>
                    {bp.size}
                  </option>
                ))}
                {!pricing?.basePrices?.length && (
                  <>
                    <option value="10x15">10x15</option>
                    <option value="13x18">13x18</option>
                    <option value="15x20">15x20</option>
                  </>
                )}
              </select>
            </label>

            <label>
              Acabado{" "}
              <select value={bulkFinish} onChange={(e) => setBulkFinish(e.target.value as Finish)}>
                <option value="BRILLO">Brillo</option>
                <option value="MATE">Mate</option>
              </select>
            </label>

            <label>
              Cantidad{" "}
              <input
                type="number"
                min={1}
                value={bulkQty}
                onChange={(e) => setBulkQty(Number(e.target.value) || 1)}
                style={{ width: 90 }}
              />
            </label>

            <button onClick={applyBulkToSelected}>Aplicar a seleccionadas</button>
            <button onClick={() => setAllSelected(true)}>Seleccionar todas</button>
            <button onClick={() => setAllSelected(false)}>Deseleccionar todas</button>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>2) Fotos subidas</h2>
        {items.length === 0 ? (
          <p>Subí fotos para empezar.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="flex justify-start sm:justify-end">
              <button
                onClick={() => {
                  setSlideViewerIndex(0);
                  setShowSlideViewer(true);
                }}
              >
                Ver en modo slide
              </button>
            </div>
            {items.map((it, idx) => {
              const unit = estimatedUnitPriceForItem(it);
              const subtotal = unit * (Number(it.quantity) || 0);

              return (
                <div
                  key={it.fileKey}
                  className="border border-[#ddd] rounded-[10px] p-3 grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3 items-center"
                >
                  <img
                    src={it.previewUrl}
                    alt={it.originalName}
                    className="w-full sm:w-[120px] h-auto sm:h-[120px] object-cover rounded-lg bg-[#f3f3f3]"
                  />

                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={it.selected}
                        onChange={(e) => updateItem(idx, { selected: e.target.checked })}
                        style={{
                          width: 26,
                          height: 26,
                          cursor: "pointer",
                          accentColor: "#000",
                          outline: "2px solid #000",
                          outlineOffset: "2px",
                          background: "#fff",
                        }}
                      />

                      <b>{it.originalName}</b>

                      <button onClick={() => removeItem(idx)} style={{ marginLeft: "auto" }}>
                        Eliminar
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {productsLoaded && labProducts.length > 0 && (
                        <label>
                          Producto{" "}
                          <select
                            value={it.productName || ""}
                            onChange={(e) => {
                              const selectedName = e.target.value;
                              if (!selectedName) {
                                updateItem(idx, { productId: null, productName: null });
                                return;
                              }
                              const match =
                                labProducts.find(
                                  (p) =>
                                    p.name.split(" - ")[0].trim() === selectedName &&
                                    (p.size === it.size || !it.size)
                                ) ||
                                labProducts.find(
                                  (p) => p.name.split(" - ")[0].trim() === selectedName
                                );
                              updateItem(idx, {
                                productId: match?.id ?? null,
                                productName: selectedName,
                                ...(match?.size ? { size: match.size } : {}),
                                ...(match?.acabado ? { finish: match.acabado as Finish } : {}),
                              });
                            }}
                          >
                            <option value="">Sin producto específico</option>
                            {Array.from(
                              new Set(labProducts.map((p) => p.name.split(" - ")[0].trim()))
                            ).map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label>
                        Tamaño{" "}
                        <select
                          value={it.size}
                          onChange={(e) => {
                            const newSize = e.target.value;
                            if (it.productName && labProducts.length > 0) {
                              const match = labProducts.find((p) => {
                                const pName = p.name.split(" - ")[0].trim();
                                return pName === it.productName && p.size === newSize;
                              });
                              if (match) {
                                updateItem(idx, {
                                  size: newSize,
                                  productId: match.id,
                                  productName: it.productName,
                                });
                                return;
                              }
                            }
                            updateItem(idx, { size: newSize });
                          }}
                        >
                          {(pricing?.basePrices?.length
                            ? Array.from(new Map(pricing.basePrices.map((bp) => [bp.size, bp])).values())
                            : []
                          ).map((bp) => (
                            <option key={bp.size} value={bp.size}>
                              {bp.size}
                            </option>
                          ))}
                          {!pricing?.basePrices?.length && (
                            <>
                              <option value="10x15">10x15</option>
                              <option value="13x18">13x18</option>
                              <option value="15x20">15x20</option>
                            </>
                          )}
                        </select>
                      </label>

                      <label>
                        Acabado{" "}
                        <select
                          value={it.finish}
                          onChange={(e) => {
                            const newFinish = e.target.value as Finish;
                            if (it.productName && labProducts.length > 0) {
                              const match =
                                labProducts.find((p) => {
                                  const pName = p.name.split(" - ")[0].trim();
                                  const matchesSize = p.size === it.size;
                                  const matchesFinish =
                                    p.acabado === newFinish ||
                                    (!p.acabado && newFinish === "BRILLO");
                                  return pName === it.productName && matchesSize && matchesFinish;
                                }) ||
                                labProducts.find((p) => {
                                  const pName = p.name.split(" - ")[0].trim();
                                  return pName === it.productName && p.size === it.size;
                                });
                              if (match) {
                                updateItem(idx, {
                                  finish: newFinish,
                                  productId: match.id,
                                  productName: it.productName,
                                });
                                return;
                              }
                            }
                            updateItem(idx, { finish: newFinish });
                          }}
                        >
                          <option value="BRILLO">Brillo</option>
                          <option value="MATE">Mate</option>
                        </select>
                      </label>

                      <label>
                        Cantidad{" "}
                        <input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })}
                          style={{ width: 90 }}
                        />
                      </label>

                      <div style={{ marginLeft: 8, display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ opacity: 0.8 }}>
                          Precio unitario final: ${unit} | Subtotal: ${subtotal}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ opacity: 0.7, fontSize: 12 }}>fileKey: {it.fileKey}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ marginTop: 12 }}>
          <b>Total estimado (con fee):</b> ${totalPreview}
        </p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>3) Datos del cliente</h2>
        <div style={{ display: "grid", gap: 12, maxWidth: 400 }}>
          <label>
            Nombre{" "}
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            Email{" "}
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            Teléfono{" "}
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
          </label>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <button onClick={createOrder} disabled={loading || items.length === 0}>
          {loading ? "Creando pedido..." : "Crear pedido"}
        </button>

        {error && (
          <p style={{ marginTop: 12, color: "crimson" }}>
            <b>Error:</b> {error}
          </p>
        )}

        {result && (
          <div style={{ marginTop: 12, padding: 12, background: "#e8f5e9", borderRadius: 8 }}>
            <h3>Pedido creado exitosamente</h3>
            <p>ID del pedido: {result.id}</p>
            <p>Total: ${result.total}</p>
          </div>
        )}
      </section>

      {showSlideViewer && items.length > 0 && (
        <PhotoSlideViewer
          photos={items.map((item, index) => ({
            id: String(index),
            src: item.previewUrl,
            alt: item.originalName,
            selected: item.selected,
          }))}
          initialIndex={slideViewerIndex}
          onClose={() => setShowSlideViewer(false)}
          onPhotoSelect={(id) => updateItem(Number(id), { selected: !items[Number(id)]?.selected })}
          renderControls={(_, index) => {
            const item = items[index];
            if (!item) return null;
            const sizes = (pricing?.basePrices?.length
              ? Array.from(new Map(pricing.basePrices.map((bp) => [bp.size, bp])).values()).map((bp) => bp.size)
              : ["10x15", "13x18", "15x20"]);
            return (
              <div className="grid grid-cols-2 md:grid-cols-[minmax(160px,2fr)_minmax(110px,1fr)_minmax(110px,1fr)_minmax(90px,1fr)] gap-2">
                {productsLoaded && labProducts.length > 0 && (
                  <label>
                    Producto{" "}
                    <select
                      style={{
                        padding: "2px 6px",
                        fontSize: 11,
                        borderRadius: 6,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        color: "#1a1a1a",
                      }}
                      value={item.productName || ""}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        if (!selectedName) {
                          updateItem(index, { productId: null, productName: null });
                          return;
                        }
                        const match =
                          labProducts.find(
                            (p) =>
                              p.name.split(" - ")[0].trim() === selectedName &&
                              (p.size === item.size || !item.size)
                          ) ||
                          labProducts.find((p) => p.name.split(" - ")[0].trim() === selectedName);
                        updateItem(index, {
                          productId: match?.id ?? null,
                          productName: selectedName,
                          ...(match?.size ? { size: match.size } : {}),
                          ...(match?.acabado ? { finish: match.acabado as Finish } : {}),
                        });
                      }}
                    >
                      <option value="">Sin producto específico</option>
                      {Array.from(
                        new Set(labProducts.map((p) => p.name.split(" - ")[0].trim()))
                      ).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Tamaño{" "}
                  <select
                    style={{
                      padding: "2px 6px",
                      fontSize: 11,
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      color: "#1a1a1a",
                    }}
                    value={item.size}
                    onChange={(e) => updateItem(index, { size: e.target.value })}
                  >
                    {sizes.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Acabado{" "}
                  <select
                    style={{
                      padding: "2px 6px",
                      fontSize: 11,
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      color: "#1a1a1a",
                    }}
                    value={item.finish}
                    onChange={(e) => updateItem(index, { finish: e.target.value as Finish })}
                  >
                    <option value="BRILLO">Brillo</option>
                    <option value="MATE">Mate</option>
                  </select>
                </label>
                <label>
                  Cantidad{" "}
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 1 })}
                    style={{
                      width: 72,
                      padding: "2px 6px",
                      fontSize: 11,
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      color: "#1a1a1a",
                    }}
                  />
                </label>
              </div>
            );
          }}
        />
      )}
    </main>
  );
}
