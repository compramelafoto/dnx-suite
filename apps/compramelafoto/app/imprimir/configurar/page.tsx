"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import OrderItem from "@/components/order/OrderItem";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

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
  unitPrice: number;
};

export default function ConfigurarPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Configuración masiva
  const [bulkSize, setBulkSize] = useState("10x15");
  const [bulkFinish, setBulkFinish] = useState<Finish>("BRILLO");
  const [bulkQuantity, setBulkQuantity] = useState(1);
  const [bulkPrice, setBulkPrice] = useState(1500);

  useEffect(() => {
    // Cargar fotos del paso anterior
    const savedPhotos = sessionStorage.getItem("uploadedPhotos");
    const savedItems = sessionStorage.getItem("orderItems");

    // Si hay items guardados (vuelve desde resumen o ya configuró), usarlos
    if (savedItems) {
      try {
        const parsed = JSON.parse(savedItems);
        setItems(parsed);
        return;
      } catch (e) {
        console.error("Error cargando items guardados:", e);
      }
    }

    // Si no hay items pero hay fotos, crear items nuevos
    if (savedPhotos) {
      try {
        const photos: UploadedFile[] = JSON.parse(savedPhotos);
        setItems(
          photos.map((p) => ({
            fileKey: p.fileKey,
            previewUrl: p.url,
            originalName: p.originalName,
            size: "10x15",
            finish: "BRILLO" as Finish,
            quantity: 1,
            unitPrice: 1500, // Precio por defecto
          }))
        );
        return;
      } catch (e) {
        console.error("Error cargando fotos:", e);
      }
    }

    // Si no hay nada, volver a subida
    router.push("/imprimir");
  }, [router]);

  function updateItem(index: number, updates: Partial<Item>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  }

  function toggleItemSelection(index: number) {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }

  function toggleSelectAll() {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((_, i) => i)));
    }
  }

  function applyBulkToSelected() {
    if (selectedItems.size === 0) {
      setError("Seleccioná al menos una foto para aplicar la configuración");
      return;
    }

    setItems((prev) =>
      prev.map((item, i) =>
        selectedItems.has(i)
          ? {
              ...item,
              size: bulkSize,
              finish: bulkFinish,
              quantity: bulkQuantity,
              unitPrice: bulkPrice,
            }
          : item
      )
    );
    setError(null);
  }

  function applyBulkToAll() {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        size: bulkSize,
        finish: bulkFinish,
        quantity: bulkQuantity,
        unitPrice: bulkPrice,
      }))
    );
    setError(null);
  }

  function handleContinue() {
    if (items.length === 0) {
      setError("No hay fotos para configurar");
      return;
    }

    // Guardar items en sessionStorage antes de continuar
    sessionStorage.setItem("orderItems", JSON.stringify(items));
    router.push("/imprimir/resumen");
  }

  function handleGoBack() {
    // Guardar items antes de volver para preservar la configuración
    sessionStorage.setItem("orderItems", JSON.stringify(items));
    router.push("/imprimir");
  }

  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-normal text-[#1a1a1a]">
              Configurá tus fotos
            </h1>
            <p className="text-[#6b7280]">
              Elegí tamaño, acabado y cantidad para cada foto
            </p>
          </div>

          {error && (
            <Card className="bg-[#ef4444]/10 border-[#ef4444]">
              <p className="text-[#ef4444]">{error}</p>
            </Card>
          )}

          {/* Configuración masiva */}
          <Card className="bg-[#f8f9fa]">
            <h2 className="text-lg font-medium text-[#1a1a1a] mb-4">
              ⚡ Configuración rápida
            </h2>
            <p className="text-sm text-[#6b7280] mb-4">
              Configurá todas las fotos o solo las seleccionadas de una vez
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Tamaño
                </label>
                <Select value={bulkSize} onChange={(e) => setBulkSize(e.target.value)}>
                  <option value="10x15">10x15 cm</option>
                  <option value="13x18">13x18 cm</option>
                  <option value="15x20">15x20 cm</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Acabado
                </label>
                <Select
                  value={bulkFinish}
                  onChange={(e) => setBulkFinish(e.target.value as Finish)}
                >
                  <option value="BRILLO">Brillo</option>
                  <option value="MATE">Mate</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Cantidad
                </label>
                <Input
                  type="number"
                  min="1"
                  value={bulkQuantity}
                  onChange={(e) => setBulkQuantity(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Precio unitario
                </label>
                <Input
                  type="number"
                  min="0"
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={applyBulkToAll}
                className="text-sm px-4 py-2"
              >
                Aplicar a todas
              </Button>
              <Button
                variant="secondary"
                onClick={applyBulkToSelected}
                disabled={selectedItems.size === 0}
                className="text-sm px-4 py-2"
              >
                Aplicar a seleccionadas ({selectedItems.size})
              </Button>
              <Button
                variant="secondary"
                onClick={toggleSelectAll}
                className="text-sm px-4 py-2"
              >
                {selectedItems.size === items.length ? "Deseleccionar todas" : "Seleccionar todas"}
              </Button>
            </div>
          </Card>

          <div className="space-y-6">
            {items.map((item, index) => (
              <OrderItem
                key={item.fileKey}
                id={item.fileKey}
                previewUrl={item.previewUrl}
                originalName={item.originalName}
                size={item.size}
                finish={item.finish}
                quantity={item.quantity}
                basePrice={item.unitPrice}
                discountPercent={0}
                finalUnitPrice={item.unitPrice}
                subtotal={item.unitPrice * item.quantity}
                selected={selectedItems.has(index)}
                onSelect={() => toggleItemSelection(index)}
                onSizeChange={(size) => updateItem(index, { size })}
                onFinishChange={(finish) => updateItem(index, { finish: finish as Finish })}
                onQuantityChange={(quantity) => updateItem(index, { quantity })}
              />
            ))}
          </div>

          <Card className="bg-[#f8f9fa]">
            <div className="flex justify-between items-center">
              <span className="text-xl font-medium text-[#1a1a1a]">Total estimado</span>
              <span className="text-3xl font-normal text-[#1a1a1a]">
                ${total.toLocaleString("es-AR")}
              </span>
            </div>
          </Card>

          <div className="flex justify-between pt-6">
            <Button variant="secondary" onClick={handleGoBack}>
              ← Agregar más fotos
            </Button>
            <Button variant="primary" onClick={handleContinue}>
              Continuar
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
