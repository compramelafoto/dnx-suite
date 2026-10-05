"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ImageUploadField } from "@/components/image-upload-field";
import { formatMinorArs } from "@/lib/membership/money";
import type { ProductDetail, ProductVariantDetail } from "@/lib/sales/repository";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { slugify } from "@/lib/store/slug";
import {
  addProductImageAction,
  removeProductImageAction,
  reorderProductImagesAction,
  saveListingAction,
  saveVariantsAction,
  setSizeChartAction,
  type StoreActionResult,
} from "./store-actions";

/**
 * Las secciones de tienda de la ficha de un producto: dónde se vende, la ficha online, la
 * galería y los talles.
 *
 * Cada sección guarda por su lado con su propia acción, sin redirigir, para no perder lo que
 * se está escribiendo en las otras. Las reglas de verdad no viven acá: están en
 * `lib/store/listing-form.ts`, `lib/store/variant-form.ts` y `lib/store/save-variants.ts`.
 */

/** A texto plano, sin el símbolo: es lo que espera `parseArsToMinor` en el campo. */
function minorToInputText(minor: number | null): string {
  if (minor === null) return "";
  return formatMinorArs(minor).replace("$", "").trim();
}

function Aviso({ resultado }: { resultado: StoreActionResult | null }) {
  if (!resultado) return null;
  return resultado.ok ? (
    <p className="text-sm text-[var(--fo-success)]">Listo, se guardó.</p>
  ) : (
    <p className="text-sm text-[var(--fo-danger)]" role="alert">
      {resultado.error}
    </p>
  );
}

function AvisoModuloApagado({ storeEnabled }: { storeEnabled: boolean }) {
  if (storeEnabled) return null;
  return (
    <p className="fo-helper text-[var(--fo-warning,#a16207)]">
      La tienda online está apagada para tu institución: lo que cargues acá queda guardado, pero no se ve en ningún
      lado hasta que se encienda.
    </p>
  );
}

export function StoreSections({
  product,
  publicSlug,
  storeEnabled,
}: {
  product: ProductDetail;
  /** La dirección pública del sitio de la institución; null si todavía no tiene. */
  publicSlug: string | null;
  storeEnabled: boolean;
}) {
  return (
    <div className="space-y-6">
      <ListingForm product={product} publicSlug={publicSlug} storeEnabled={storeEnabled} />
      <GallerySection product={product} storeEnabled={storeEnabled} />
      {/* La key remonta la tabla cuando cambian los talles guardados: sin esto, después de
          guardar, las filas nuevas seguirían en pantalla sin su id y un segundo "Guardar" las
          mandaría como nuevas otra vez. */}
      <VariantsSection
        key={product.variants.map((v) => `${v.id}:${v.name}:${v.isActive}`).join("|")}
        product={product}
        storeEnabled={storeEnabled}
      />
    </div>
  );
}

function ListingForm({
  product,
  publicSlug,
  storeEnabled,
}: {
  product: ProductDetail;
  publicSlug: string | null;
  storeEnabled: boolean;
}) {
  const ficha = product.storeListing;
  const [slug, setSlug] = useState(ficha?.slug ?? "");
  const [resultado, setResultado] = useState<StoreActionResult | null>(null);
  const [guardando, startTransition] = useTransition();

  const slugVista = slugify(slug) || ficha?.slug || slugify(product.name) || "producto";

  function guardar(fd: FormData) {
    startTransition(async () => {
      setResultado(await saveListingAction(product.id, fd));
    });
  }

  return (
    // `onSubmit` y no `action`: un `<form action={fn}>` se resetea solo al terminar, y si el
    // guardado vuelve con un error se perdería lo que la persona escribió.
    <form onSubmit={(e) => { e.preventDefault(); guardar(new FormData(e.currentTarget)); }} className="space-y-6">
      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Dónde se vende</h2>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sellAtCounter" defaultChecked={ficha?.sellAtCounter ?? true} />
            {/* El respaldo va DESPUÉS de la casilla: `FormData.get` devuelve la primera
                coincidencia (ver `lib/sales/checkbox-respaldo.test.ts`). */}
            <input type="hidden" name="sellAtCounter" value="off" />
            Mostrador
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sellOnline" defaultChecked={ficha?.sellOnline ?? false} />
            <input type="hidden" name="sellOnline" value="off" />
            Tienda online
          </label>
        </div>
        <p className="fo-helper">Un producto sólo online no aparece en el buscador del mostrador.</p>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Tienda online</h2>
        <AvisoModuloApagado storeEnabled={storeEnabled} />
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="slug">
            Dirección
          </label>
          <input
            id="slug"
            name="slug"
            className="fo-input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={slugify(product.name)}
          />
          <p className="fo-helper break-all">
            {publicSlug
              ? `Se va a ver en /w/${publicSlug}/${STORE_PUBLIC_SEGMENT}/${slugVista}`
              : `Tu sitio todavía no tiene dirección pública. El producto va a quedar en …/${STORE_PUBLIC_SEGMENT}/${slugVista}`}
            . Vacía: la primera vez se arma con el nombre, después se queda la que tiene. Cambiarla rompe los enlaces
            que ya se compartieron.
          </p>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="onlineTitle">
            Título en la tienda
          </label>
          <input
            id="onlineTitle"
            name="onlineTitle"
            className="fo-input"
            defaultValue={ficha?.onlineTitle ?? ""}
            placeholder={product.name}
            maxLength={200}
          />
          <p className="fo-helper">Vacío: se usa el nombre del producto.</p>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="onlineDescription">
            Descripción en la tienda
          </label>
          <textarea
            id="onlineDescription"
            name="onlineDescription"
            rows={5}
            className="fo-input"
            defaultValue={ficha?.onlineDescription ?? ""}
            maxLength={5000}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <CampoEntero nombre="weightGrams" etiqueta="Peso (g)" valor={ficha?.weightGrams ?? null} />
          <CampoEntero nombre="lengthCm" etiqueta="Largo (cm)" valor={ficha?.lengthCm ?? null} />
          <CampoEntero nombre="widthCm" etiqueta="Ancho (cm)" valor={ficha?.widthCm ?? null} />
          <CampoEntero nombre="heightCm" etiqueta="Alto (cm)" valor={ficha?.heightCm ?? null} />
        </div>
        <p className="fo-helper">Peso y medidas son opcionales: se van a usar para cotizar envíos más adelante.</p>
        <div className="sm:max-w-xs">
          <CampoEntero nombre="maxPerOrder" etiqueta="Tope por compra" valor={ficha?.maxPerOrder ?? null} />
          <p className="fo-helper">Cuántas unidades puede llevar una persona en un pedido. Vacío: sin tope.</p>
        </div>
      </section>

      <div className="fo-form-actions flex items-center gap-4">
        <Aviso resultado={resultado} />
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar ficha online"}
        </button>
      </div>
    </form>
  );
}

function CampoEntero({ nombre, etiqueta, valor }: { nombre: string; etiqueta: string; valor: number | null }) {
  return (
    <div className="fo-field-stack">
      <label className="fo-label" htmlFor={nombre}>
        {etiqueta}
      </label>
      <input
        id={nombre}
        name={nombre}
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        className="fo-input"
        defaultValue={valor ?? ""}
      />
    </div>
  );
}

function GallerySection({ product, storeEnabled }: { product: ProductDetail; storeEnabled: boolean }) {
  const [resultado, setResultado] = useState<StoreActionResult | null>(null);
  const [ocupado, startTransition] = useTransition();
  // Remonta el campo de subida después de cada foto, para dejarlo listo para la siguiente.
  const [subidaKey, setSubidaKey] = useState(0);
  const fotos = product.images;

  function correr(accion: () => Promise<StoreActionResult>) {
    startTransition(async () => {
      setResultado(await accion());
    });
  }

  function mover(desde: number, hacia: number) {
    const ids = fotos.map((f) => f.id);
    const [movida] = ids.splice(desde, 1);
    ids.splice(hacia, 0, movida);
    correr(() => reorderProductImagesAction(product.id, ids));
  }

  return (
    <section className="fo-card space-y-4 p-5">
      <h2 className="text-base font-semibold">Fotos</h2>
      <AvisoModuloApagado storeEnabled={storeEnabled} />
      <p className="fo-helper">La primera es la principal en la tienda. Es aparte de la foto del mostrador.</p>

      {fotos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {fotos.map((foto, i) => (
            <li key={foto.id} className="space-y-2">
              <div className="aspect-square overflow-hidden rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foto.url} alt={foto.alt ?? ""} className="h-full w-full object-cover" />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--fo-muted)]">{i === 0 ? "Principal" : `${i + 1}`}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="font-medium text-[var(--fo-accent)] disabled:opacity-40"
                    disabled={ocupado || i === 0}
                    onClick={() => mover(i, i - 1)}
                    aria-label="Mover antes"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="font-medium text-[var(--fo-accent)] disabled:opacity-40"
                    disabled={ocupado || i === fotos.length - 1}
                    onClick={() => mover(i, i + 1)}
                    aria-label="Mover después"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    className="font-medium text-[var(--fo-danger)] disabled:opacity-40"
                    disabled={ocupado}
                    onClick={() => correr(() => removeProductImageAction(foto.id))}
                  >
                    Quitar
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <ImageUploadField
        key={subidaKey}
        name="galleryImageUrl"
        presetKey="productGallery"
        label="Agregar una foto"
        onUploaded={(url) => {
          if (!url) return;
          correr(async () => {
            const r = await addProductImageAction(product.id, url);
            setSubidaKey((k) => k + 1);
            return r;
          });
        }}
      />
      <Aviso resultado={resultado} />
    </section>
  );
}

type FilaTalle = {
  /** Sólo para React: los talles nuevos todavía no tienen id. */
  clave: string;
  id: string | null;
  name: string;
  sku: string;
  barcode: string;
  price: string;
  isActive: boolean;
  stockQty: number | null;
};

function filaDesde(v: ProductVariantDetail): FilaTalle {
  return {
    clave: v.id,
    id: v.id,
    name: v.name,
    sku: v.sku ?? "",
    barcode: v.barcode ?? "",
    price: minorToInputText(v.priceMinor),
    isActive: v.isActive,
    stockQty: v.stockQty,
  };
}

let proximaClave = 0;
function filaNueva(): FilaTalle {
  proximaClave += 1;
  return { clave: `nueva-${proximaClave}`, id: null, name: "", sku: "", barcode: "", price: "", isActive: true, stockQty: null };
}

function VariantsSection({ product, storeEnabled }: { product: ProductDetail; storeEnabled: boolean }) {
  const [filas, setFilas] = useState<FilaTalle[]>(() =>
    product.variants.length > 0 ? product.variants.map(filaDesde) : [filaNueva()],
  );
  const [resultado, setResultado] = useState<StoreActionResult | null>(null);
  const [guardando, startTransition] = useTransition();
  const [tablaResultado, setTablaResultado] = useState<StoreActionResult | null>(null);
  const [, startTabla] = useTransition();

  function cambiar(clave: string, cambios: Partial<FilaTalle>) {
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));
  }

  function guardar(fd: FormData) {
    startTransition(async () => {
      setResultado(await saveVariantsAction(product.id, fd));
    });
  }

  const precioProducto = minorToInputText(product.priceMinor);

  return (
    <section className="fo-card space-y-4 p-5">
      <h2 className="text-base font-semibold">Talles</h2>
      <AvisoModuloApagado storeEnabled={storeEnabled} />
      <p className="fo-helper">
        Si el producto tiene talles, su stock vive en cada talle y el total es la suma. Un talle no se borra: se
        desactiva, y para eso su stock tiene que estar en cero. La primera vez, el stock que ya tenía el producto pasa
        al primer talle.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); guardar(new FormData(e.currentTarget)); }} className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--fo-muted)]">
                <th className="py-2 pr-2 font-medium">Nombre</th>
                <th className="py-2 pr-2 font-medium">Código interno</th>
                <th className="py-2 pr-2 font-medium">Código de barras</th>
                <th className="py-2 pr-2 font-medium">Precio</th>
                <th className="py-2 pr-2 font-medium">Stock</th>
                <th className="py-2 font-medium">Activo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={f.clave} className="border-t border-[var(--fo-border)]">
                  <td className="py-2 pr-2">
                    <input type="hidden" name={`variants.${i}.id`} value={f.id ?? ""} />
                    <input
                      name={`variants.${i}.name`}
                      className="fo-input"
                      value={f.name}
                      onChange={(e) => cambiar(f.clave, { name: e.target.value })}
                      placeholder="S, M, L…"
                      aria-label="Nombre del talle"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`variants.${i}.sku`}
                      className="fo-input"
                      value={f.sku}
                      onChange={(e) => cambiar(f.clave, { sku: e.target.value })}
                      aria-label="Código interno del talle"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`variants.${i}.barcode`}
                      className="fo-input"
                      value={f.barcode}
                      onChange={(e) => cambiar(f.clave, { barcode: e.target.value })}
                      inputMode="numeric"
                      aria-label="Código de barras del talle"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      name={`variants.${i}.price`}
                      className="fo-input"
                      value={f.price}
                      onChange={(e) => cambiar(f.clave, { price: e.target.value })}
                      placeholder={`Igual al producto (${precioProducto})`}
                      aria-label="Precio del talle"
                    />
                  </td>
                  <td className="py-2 pr-2 whitespace-nowrap">
                    {f.stockQty === null ? (
                      <span className="text-[var(--fo-muted)]">—</span>
                    ) : (
                      <Link href="/ventas/stock" className="text-[var(--fo-accent)] hover:underline">
                        {f.stockQty}
                      </Link>
                    )}
                  </td>
                  <td className="py-2">
                    {/* La casilla no tiene `name`: el valor viaja en el oculto, siempre "on" u
                        "off". `parseVariantsForm` se queda con el ÚLTIMO valor de cada campo, así
                        que el truco del respaldo de las otras casillas acá no serviría. */}
                    <input type="hidden" name={`variants.${i}.isActive`} value={f.isActive ? "on" : "off"} />
                    <input
                      type="checkbox"
                      checked={f.isActive}
                      onChange={(e) => cambiar(f.clave, { isActive: e.target.checked })}
                      aria-label="Talle activo"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fo-helper">
          El stock de cada talle se carga desde <Link href="/ventas/stock" className="text-[var(--fo-accent)] hover:underline">Stock</Link>.
        </p>

        <div className="fo-form-actions flex flex-wrap items-center gap-4">
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setFilas((fs) => [...fs, filaNueva()])}>
            Agregar talle
          </button>
          <Aviso resultado={resultado} />
          <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar talles"}
          </button>
        </div>
      </form>

      <div className="space-y-2 border-t border-[var(--fo-border)] pt-4">
        <ImageUploadField
          name="sizeChartImageUrl"
          presetKey="sizeChart"
          label="Tabla de talles"
          description="Una imagen con las medidas de cada talle. Se muestra en la tienda junto al selector."
          initialUrl={product.storeListing?.sizeChartImageUrl ?? null}
          onUploaded={(url) => {
            startTabla(async () => {
              setTablaResultado(await setSizeChartAction(product.id, url));
            });
          }}
        />
        <Aviso resultado={tablaResultado} />
      </div>
    </section>
  );
}
