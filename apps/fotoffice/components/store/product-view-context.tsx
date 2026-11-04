"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Lo que comparten la galería y la compra en la ficha: el modelo elegido (cuando las variantes
 * se llaman "Modelo / Talle"). Así, al elegir un modelo, la galería salta a su foto. Sin este
 * proveedor, cada componente funciona solo, como siempre.
 */
type ProductView = { model: string | null; setModel: (model: string | null) => void };

const ProductViewContext = createContext<ProductView | null>(null);

export function ProductViewProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<string | null>(null);
  const value = useMemo(() => ({ model, setModel }), [model]);
  return <ProductViewContext.Provider value={value}>{children}</ProductViewContext.Provider>;
}

/** `null` fuera del proveedor. */
export function useProductView(): ProductView | null {
  return useContext(ProductViewContext);
}
