"use client";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

interface OrderItemProps {
  id: string;
  previewUrl: string;
  originalName: string;
  size: string;
  finish: string;
  quantity: number;
  basePrice: number;
  discountPercent: number;
  finalUnitPrice: number;
  subtotal: number;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
  onSizeChange: (size: string) => void;
  onFinishChange: (finish: string) => void;
  onQuantityChange: (quantity: number) => void;
  /** "digital" | "impresa". Si se pasa onTipoChange, se muestra el selector. */
  tipo?: "digital" | "impresa";
  onTipoChange?: (tipo: "digital" | "impresa") => void;
  /** Si false, no se puede elegir venta digital (solo impresa). Por defecto true. */
  sellDigital?: boolean;
  /** Si false, no se puede elegir venta impresa (solo digital). Por defecto true. */
  sellPrint?: boolean;
  /** Tamaños disponibles del laboratorio. Si no se proporciona, se usan tamaños por defecto. */
  availableSizes?: Array<{ size: string; unitPrice: number }>;
  /** Productos disponibles del laboratorio. Si se proporciona, se muestra selector de producto. */
  availableProducts?: Array<{ id: number; name: string; size: string | null; acabado: string | null }>;
  /** ID del producto seleccionado. Si se proporciona onProductChange, se muestra el selector. */
  productId?: number | null;
  /** Nombre del producto seleccionado (sin tamaño). Se usa para identificar el producto en el selector. */
  productName?: string | null;
  onProductChange?: (productId: number | null, productName?: string | null) => void;
  /** Mostrar selector de producto en el header */
  showProductInHeader?: boolean;
  /** Abrir modo slide desde el item */
  onOpenSlide?: () => void;
  /** Mostrar tipo de impresión en el item */
  showPrintType?: boolean;
  /** Color terciario para bordes y elementos destacados */
  tertiaryColor?: string | null;
}

// Formatear moneda simple (sin Intl para evitar hydration issues)
function formatMoney(n: number): string {
  if (!Number.isFinite(n) || isNaN(n)) return "$ 0";
  const rounded = Math.round(n);
  return `$ ${rounded.toLocaleString("es-AR").replace(/,/g, ".")}`;
}

function normalizeFinishValue(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.toString().trim().toUpperCase();
  if (normalized === "BRILLO") return "BRILLO";
  if (normalized === "MATE") return "MATE";
  return normalized || null;
}

function finishLabel(value?: string | null): string {
  if (!value) return "";
  if (value === "BRILLO") return "Brillo";
  if (value === "MATE") return "Mate";
  return value;
}

export default function OrderItem({
  id,
  previewUrl,
  originalName,
  size,
  finish,
  quantity,
  basePrice,
  discountPercent,
  finalUnitPrice,
  subtotal,
  selected = false,
  onSelect,
  onRemove,
  onDuplicate,
  onSizeChange,
  onFinishChange,
  onQuantityChange,
  tipo = "digital",
  onTipoChange,
  sellDigital = true,
  sellPrint = true,
  availableSizes,
  availableProducts,
  productId,
  productName,
  onProductChange,
  showProductInHeader = false,
  onOpenSlide,
  showPrintType = false,
  tertiaryColor,
}: OrderItemProps) {
  const isDigital = (tipo || "digital") === "digital";
  const accentColor = tertiaryColor || "#c27b3d";
  
  // Agrupar productos por nombre (sin tamaño) para mostrar solo nombres únicos
  const productsGrouped = availableProducts && availableProducts.length > 0
    ? availableProducts.reduce((acc, p) => {
        // Usar solo el nombre del producto (sin tamaño) como clave
        const productName = p.name.split(' - ')[0].trim(); // Remover tamaño si está en el nombre
        if (!acc[productName]) {
          acc[productName] = [];
        }
        acc[productName].push(p);
        return acc;
      }, {} as Record<string, typeof availableProducts>)
    : {};

  // Obtener el nombre del producto seleccionado (sin tamaño)
  const selectedProductName = productName || (productId && availableProducts
    ? (() => {
        const selected = availableProducts.find(p => p.id === productId);
        return selected ? selected.name.split(' - ')[0].trim() : null;
      })()
    : null);

  // Si hay un producto seleccionado, obtener todos los tamaños disponibles para ese producto
  let sizes: string[] = [];
  if (availableProducts && availableProducts.length > 0 && selectedProductName) {
    // Obtener todos los tamaños únicos de productos con ese nombre
    const productSizes = availableProducts
      .filter(p => {
        const pName = p.name.split(' - ')[0].trim();
        return pName === selectedProductName && p.size;
      })
      .map(p => p.size!)
      .filter(Boolean);
    const uniqueProductSizes = Array.from(new Set(productSizes)).sort();
    
    sizes = uniqueProductSizes.length > 0
      ? uniqueProductSizes
      : Array.from(new Set(availableSizes?.map(s => s.size) || [])).sort();
  } else if (availableSizes && availableSizes.length > 0) {
    // Si no hay producto seleccionado, usar todos los tamaños disponibles
    sizes = Array.from(new Set(availableSizes.map((s) => s.size))).sort();
  } else {
    // Fallback a tamaños por defecto
    sizes = ["10x15", "13x18", "15x20"];
  }

  // Obtener acabados disponibles para el producto+tamaño seleccionado
  const availableFinishes: string[] = [];
  if (availableProducts && availableProducts.length > 0 && selectedProductName && size) {
    const finishes = availableProducts
      .filter((p) => {
        const pName = p.name.split(" - ")[0].trim();
        return pName === selectedProductName && p.size === size && p.acabado;
      })
      .map((p) => normalizeFinishValue(p.acabado))
      .filter((f): f is string => Boolean(f))
      .filter((f, i, arr) => arr.indexOf(f) === i)
      .sort();
    availableFinishes.push(...finishes);
  }
  
  // Mostrar los acabados disponibles para ese producto+tamaño, o los por defecto si no hay productos disponibles
  let finishesToShow: string[] = [];
  if (availableFinishes.length > 0) {
    finishesToShow = availableFinishes;
  } else {
    // Fallback: permitir elegir acabados básicos cuando no hay variantes cargadas
    finishesToShow = ["BRILLO", "MATE"];
  }

  function handleRemoveClick(e: React.MouseEvent) {
    e.stopPropagation();
    onRemove?.();
  }

  return (
    <Card
      className={`p-4 md:p-6 cursor-pointer transition-all relative ${
        selected ? "" : "hover:bg-[#fafafa]"
      }`}
      style={selected ? {
        boxShadow: `0 0 0 2px ${accentColor}, 0 0 0 4px ${accentColor}33`,
        backgroundColor: `${accentColor}14`, // ~8% opacity
        border: `2px solid ${accentColor}`,
      } : {}}
      onClick={onSelect}
    >
      <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
        <div className="w-full sm:w-64 flex-shrink-0">
          <div className="relative w-full max-h-64 rounded-lg overflow-hidden bg-[#f3f4f6] flex items-center justify-center p-1">
          {selected && (
            <div 
              className="absolute top-2 right-2 text-white rounded-full p-1.5 z-10"
              style={{ backgroundColor: accentColor }}
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
          <img
            src={previewUrl}
            alt={originalName}
            className="max-w-full max-h-full object-contain"
            style={{ width: "auto", height: "auto", maxWidth: "256px", maxHeight: "256px" }}
          />
        </div>
          <p className="mt-2 text-sm text-[#4b5563] text-center break-words">{originalName}</p>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-0 sm:min-w-[220px]" />
            <div className="flex flex-wrap items-start gap-3 justify-end">
              {onProductChange && availableProducts && availableProducts.length > 0 && !isDigital && showProductInHeader && (
                <div className="flex flex-col items-start gap-1">
                  <span className="text-sm font-medium text-[#1a1a1a]">Producto</span>
                  <Select
                    value={selectedProductName || ""}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      if (!selectedName) {
                        onProductChange?.(null, null);
                        return;
                      }
                      const currentSize = size;
                      const matchingProduct =
                        availableProducts.find((p) => {
                          const pName = p.name.split(" - ")[0].trim();
                          return pName === selectedName && (p.size === currentSize || !currentSize);
                        }) ||
                        availableProducts.find((p) => {
                          const pName = p.name.split(" - ")[0].trim();
                          return pName === selectedName;
                        });

                      if (matchingProduct) {
                        onProductChange?.(matchingProduct.id, selectedName);
                        if (matchingProduct.size && matchingProduct.size !== currentSize) {
                          onSizeChange(matchingProduct.size);
                        }
                      }
                    }}
                    className="w-full sm:w-[220px] text-xs"
                  >
                    <option value="">Seleccionar producto</option>
                    {Object.keys(productsGrouped).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              {onTipoChange && (sellDigital || sellPrint) && (
                <div className="flex flex-col items-start gap-1" onClick={(e) => e.stopPropagation()}>
                  <span className="text-sm font-medium text-[#1a1a1a]">Formato</span>
                  <div className="flex items-center gap-1 rounded-lg bg-[#f3f4f6] p-1">
                    {sellPrint && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTipoChange("impresa");
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          tipo === "impresa"
                            ? "text-white"
                            : "text-[#374151] hover:bg-white"
                        }`}
                        style={tipo === "impresa" ? { backgroundColor: accentColor } : undefined}
                      >
                        Impresa
                      </button>
                    )}
                    {sellDigital && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTipoChange("digital");
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          tipo === "digital"
                            ? "text-white bg-gray-900"
                            : "text-[#374151] hover:bg-white"
                        }`}
                      >
                        Digital
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 self-end">
                {onOpenSlide && (
                  <div className="relative group">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSlide();
                      }}
                      className="text-[#f59e0b] hover:text-[#d97706] transition-colors p-1 rounded-full hover:bg-amber-50"
                      aria-label="Ver en modo slide"
                      title="Ver en modo slide"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-5 h-5"
                      >
                        <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                      </svg>
                    </button>
                  </div>
                )}
                {onDuplicate && (
                  <div className="relative group">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate();
                      }}
                      className="text-blue-600 hover:text-blue-700 transition-colors p-1 rounded-full hover:bg-blue-50"
                      aria-label="Duplicar foto"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      Duplicar para pedir otro formato
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></div>
                    </div>
                  </div>
                )}
                {onRemove && (
                  <div className="relative group">
                    <button
                      onClick={handleRemoveClick}
                      className="text-[#ef4444] hover:text-[#dc2626] transition-colors p-1 rounded-full hover:bg-[#ef4444]/10"
                      aria-label="Eliminar foto"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      Eliminar
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {showPrintType && !isDigital && (
            <p className="text-sm text-[#6b7280]">
              Tipo de impresión:{" "}
              <span className="font-medium text-[#1a1a1a]">
                {selectedProductName || "Impresión estándar"}
              </span>
            </p>
          )}

          {!isDigital && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {onProductChange && availableProducts && availableProducts.length > 0 && !showProductInHeader && (
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Producto</label>
                  <Select 
                    value={selectedProductName || ""} 
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      if (!selectedName) {
                        onProductChange?.(null, null);
                        return;
                      }
                      // Encontrar el primer producto con ese nombre que tenga el tamaño actual, o el primero disponible
                      const currentSize = size;
                      const matchingProduct = availableProducts.find(p => {
                        const pName = p.name.split(' - ')[0].trim();
                        return pName === selectedName && (p.size === currentSize || !currentSize);
                      }) || availableProducts.find(p => {
                        const pName = p.name.split(' - ')[0].trim();
                        return pName === selectedName;
                      });
                      
                      if (matchingProduct) {
                        onProductChange?.(matchingProduct.id, selectedName);
                        // Si el producto tiene un tamaño específico y es diferente al actual, actualizarlo
                        if (matchingProduct.size && matchingProduct.size !== currentSize) {
                          onSizeChange(matchingProduct.size);
                        } else if (!currentSize) {
                          // Si no hay tamaño actual, usar el primer tamaño disponible de ese producto
                          const productSizes = availableProducts
                            .filter(p => {
                              const pName = p.name.split(' - ')[0].trim();
                              return pName === selectedName && p.size;
                            })
                            .map(p => p.size!)
                            .filter((s, i, arr) => arr.indexOf(s) === i)
                            .sort();
                          if (productSizes.length > 0) {
                            onSizeChange(productSizes[0]);
                          }
                        }
                      }
                    }}
                  >
                    <option value="">Seleccionar producto</option>
                    {Object.keys(productsGrouped).map((productName) => (
                      <option key={productName} value={productName}>
                        {productName}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Tamaño</label>
                <Select 
                  value={size} 
                  onChange={(e) => {
                    const newSize = e.target.value;
                    onSizeChange(newSize);
                    // Si hay un producto seleccionado, buscar el producto que tenga ese nombre + nuevo tamaño
                    if (onProductChange && availableProducts && selectedProductName && newSize) {
                      const matchingProduct = availableProducts.find(p => {
                        const pName = p.name.split(' - ')[0].trim();
                        return pName === selectedProductName && p.size === newSize;
                      });
                      if (matchingProduct) {
                        onProductChange(matchingProduct.id, selectedProductName);
                      }
                    }
                  }}
                >
                  {sizes.length > 0 ? (
                    sizes.map((s) => {
                      return (
                        <option key={s} value={s}>
                          {s} cm
                        </option>
                      );
                    })
                  ) : (
                    <option value="">{selectedProductName ? "No hay tamaños disponibles" : "Seleccionar producto primero"}</option>
                  )}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Acabado</label>
                <Select 
                  value={finish} 
                  onChange={(e) => {
                    const newFinish = e.target.value;
                    onFinishChange(newFinish);
                    // Si hay un producto seleccionado, buscar el producto que tenga ese nombre + tamaño + acabado
                    if (onProductChange && availableProducts && selectedProductName && size && newFinish) {
                      const matchingProduct = availableProducts.find(p => {
                        const pName = p.name.split(' - ')[0].trim();
                        return pName === selectedProductName && p.size === size && p.acabado === newFinish;
                      });
                      if (matchingProduct) {
                        onProductChange(matchingProduct.id, selectedProductName);
                      }
                    }
                  }}
                >
                  {finishesToShow.map((f) => (
                    <option key={f} value={f}>
                      {finishLabel(f)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Cantidad</label>
                <Input
                  className="w-full !min-w-0"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => onQuantityChange(Number(e.target.value))}
                />
              </div>
            </div>
          )}
          {isDigital && (
            <p className="text-sm text-[#6b7280]">Foto digital — alta calidad sin marca de agua para descargar.</p>
          )}

          {/* Precios - Desglose completo */}
          <div className="bg-[#f8f9fa] rounded-lg p-4 space-y-2 border border-[#e5e7eb]">
            {!isDigital && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6b7280]">Precio unitario:</span>
                  <span className="text-[#1a1a1a] font-medium">{formatMoney(finalUnitPrice)}</span>
                </div>
                {discountPercent > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6b7280]">Descuento aplicado:</span>
                    <span className="text-[#10b981] font-medium">
                      -{Math.round(discountPercent)}%
                    </span>
                  </div>
                )}
              </>
            )}
            {isDigital && (
              <div className="flex justify-between text-sm">
                <span className="text-[#6b7280]">Precio unitario:</span>
                <span className="text-[#1a1a1a] font-medium">{formatMoney(finalUnitPrice)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-[#e5e7eb]">
              <span className="text-sm font-medium text-[#1a1a1a]">Subtotal del ítem:</span>
              <span className="text-base sm:text-lg font-semibold text-[#1a1a1a]">{formatMoney(subtotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
