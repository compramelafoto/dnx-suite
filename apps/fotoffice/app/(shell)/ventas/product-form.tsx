"use client";

import { useTransition, useState } from "react";
import { ImageUploadField } from "@/components/image-upload-field";
import { formatMinorArs } from "@/lib/membership/money";
import { PRODUCT_KINDS, PRODUCT_KIND_LABELS, type ProductKind } from "@/lib/sales/constants";
import type { ProductCategoryRow, ProductDetail } from "@/lib/sales/repository";
import { lookupGlobalProductAction, saveProductAction } from "./actions";

/** A texto plano, sin el símbolo: es lo que espera `parseArsToMinor` en el campo. */
function minorToInputText(minor: number | null): string {
  if (minor === null) return "";
  return formatMinorArs(minor).replace("$", "").trim();
}

/**
 * Alta y edición de un producto.
 *
 * Corre en el navegador por tres motivos, todos ligados entre sí: el tipo (Producto/Servicio)
 * cambia si tiene sentido mostrar la sección de existencia; el campo de código de barras
 * busca en el catálogo maestro al apretar Enter, sin pasar por un submit; y esa búsqueda
 * precarga nombre, marca, descripción y foto, que por eso también son controlados. La
 * validación de verdad no se movió de `lib/sales/product-form.ts`.
 */
export function ProductForm({
  product,
  categories,
  error,
}: {
  product: ProductDetail | null;
  categories: ProductCategoryRow[];
  error?: string;
}) {
  const esAlta = product === null;

  const [kind, setKind] = useState<ProductKind>((product?.kind as ProductKind) ?? "PRODUCTO");
  const [tracksStock, setTracksStock] = useState(product?.tracksStock ?? true);
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(product?.imageUrl ?? null);
  // Cambiar la key fuerza a `ImageUploadField` a remontarse con la foto nueva: guarda su
  // propio estado interno a partir de `initialUrl`, y no lo vuelve a leer si sólo cambia el
  // prop en un re-render.
  const [imageKey, setImageKey] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [buscando, startTransition] = useTransition();

  function buscarEnCatalogo() {
    const codigo = barcode.trim();
    if (codigo === "") return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("barcode", codigo);
      const resultado = await lookupGlobalProductAction(fd);
      if (resultado.foundInGlobal) {
        setName(resultado.name);
        setBrand(resultado.brand ?? "");
        setDescription(resultado.description ?? "");
        setImageUrl(resultado.imageUrl);
        setImageKey((k) => k + 1);
        setAviso(
          "Estos datos vienen del catálogo compartido de FotOffice: son un punto de partida, se pueden cambiar antes de guardar.",
        );
      } else {
        setAviso("Ese código todavía no está en el catálogo compartido: cargalo vos y va a quedar disponible para el resto.");
      }
    });
  }

  return (
    <form action={saveProductAction} className="space-y-6">
      {product ? <input type="hidden" name="productId" value={product.id} /> : null}
      {/* El activo/inactivo se cambia con el botón dedicado de la ficha, no acá: este campo
          sólo conserva el valor actual para que guardar el resto del formulario no lo pise. */}
      <input type="hidden" name="isActive" value={(product?.isActive ?? true) ? "on" : "off"} />

      {error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Código</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="barcode">
              Código de barras
            </label>
            <input
              id="barcode"
              name="barcode"
              className="fo-input"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (!esAlta || e.key !== "Enter") return;
                e.preventDefault();
                buscarEnCatalogo();
              }}
              autoFocus={esAlta}
              placeholder="Escaneá o tipeá el código y apretá Enter"
              inputMode="numeric"
            />
            <p className="fo-helper">
              {buscando
                ? "Buscando en el catálogo compartido…"
                : "Un lector de códigos es sólo un teclado que tipea y manda Enter: esto anda sin integrar nada más."}
            </p>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="sku">
              Código interno
            </label>
            <input
              id="sku"
              name="sku"
              className="fo-input"
              defaultValue={product?.sku ?? ""}
              placeholder="El que uses en tu local"
            />
          </div>
        </div>
        {aviso ? <p className="fo-helper text-[var(--fo-accent)]">{aviso}</p> : null}
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Identidad</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="name">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              className="fo-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="brand">
              Marca
            </label>
            <input
              id="brand"
              name="brand"
              className="fo-input"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
          </div>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="description">
            Descripción
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            className="fo-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="kind">
              Tipo
            </label>
            <select
              id="kind"
              name="kind"
              className="fo-input"
              value={kind}
              onChange={(e) => setKind(e.target.value as ProductKind)}
            >
              {PRODUCT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PRODUCT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="categoryId">
              Categoría
            </label>
            <select id="categoryId" name="categoryId" className="fo-input" defaultValue={product?.categoryId ?? ""}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Precio y costo</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="priceArs">
              Precio de venta
            </label>
            <input
              id="priceArs"
              name="priceArs"
              className="fo-input"
              defaultValue={minorToInputText(product?.priceMinor ?? null)}
              placeholder="0,00"
              required
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="costArs">
              Costo
            </label>
            <input
              id="costArs"
              name="costArs"
              className="fo-input"
              defaultValue={minorToInputText(product?.costMinor ?? null)}
              placeholder="0,00"
            />
            <p className="fo-helper">Sólo lo ve el equipo: es lo que define el margen.</p>
          </div>
        </div>
      </section>

      {kind === "PRODUCTO" ? (
        <section className="fo-card space-y-4 p-5">
          <h2 className="text-base font-semibold">Existencia</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="tracksStock"
              checked={tracksStock}
              onChange={(e) => setTracksStock(e.target.checked)}
            />
            {/* Una casilla destildada no manda nada: sin este respaldo, el parser nunca ve
                un "off" y asume que controla existencia igual. Tiene que ir DESPUÉS de la
                casilla en el DOM: `FormData.get` devuelve la primera coincidencia, y sólo
                así, cuando está tildada, gana el "on" del checkbox por sobre este "off". */}
            <input type="hidden" name="tracksStock" value="off" />
            Controla existencia
          </label>
          {tracksStock ? (
            <div className="fo-field-stack sm:max-w-xs">
              <label className="fo-label" htmlFor="minStockQty">
                Mínimo antes de avisar
              </label>
              <input
                id="minStockQty"
                name="minStockQty"
                type="number"
                min={0}
                className="fo-input"
                defaultValue={product?.minStockQty ?? ""}
              />
              <p className="fo-helper">Por debajo de este número —o en negativo— la lista lo va a marcar en rojo.</p>
            </div>
          ) : null}
        </section>
      ) : (
        // Un servicio no tiene nada que contar. `parseProductForm` ya fuerza `tracksStock` a
        // `false` para SERVICIO aunque este campo no viaje, pero no está de más no mostrar
        // una sección que no aplica.
        <input type="hidden" name="tracksStock" value="off" />
      )}

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Foto</h2>
        <ImageUploadField
          key={imageKey}
          name="imageUrl"
          presetKey="productPhoto"
          label="Foto del producto"
          initialUrl={imageUrl}
          onUploaded={setImageUrl}
        />
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Proveedor</h2>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="supplierName">
            Proveedor
          </label>
          <input
            id="supplierName"
            name="supplierName"
            className="fo-input"
            defaultValue={product?.supplierName ?? ""}
          />
        </div>
      </section>

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary text-sm">
          {product ? "Guardar cambios" : "Crear producto"}
        </button>
      </div>
    </form>
  );
}
