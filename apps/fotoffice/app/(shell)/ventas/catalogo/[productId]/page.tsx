import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireSalesAdmin } from "@/lib/sales/access";
import { getProduct, listProductCategories } from "@/lib/sales/repository";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { loadPublicSlug } from "@/lib/blog/admin-queries";
import { STORE_MODULE_KEY } from "@/lib/store/constants";
import { QUOTES_MODULE_KEY } from "@/lib/presupuestos/acceso";
import { ProductForm } from "../../product-form";
import { toggleProductActiveAction } from "../../actions";
import { StoreSections } from "./store-sections";
import { PresupuestoSections } from "./presupuesto-sections";
import { leerPerfil, rubrosDeIngreso } from "@/lib/catalogo/perfil";
import { sugerirRubro } from "@/lib/rubros/rubros";
import { leerCombo, productosParaCombo } from "@/lib/catalogo/combos";
import { leerCostos, proveedoresDelWorkspace } from "@/lib/catalogo/costos";
import { proyectosEncendidos } from "@/lib/proyectos/crear";
import { leerReglas, opcionesDeRegla } from "@/lib/proyectos/reglas-catalogo";
import { agendaEncendida } from "@/lib/agenda/crear";
import { leerReglas as leerReglasCita, opcionesDeRegla as opcionesDeReglaCita } from "@/lib/agenda/reglas-catalogo";

export const dynamic = "force-dynamic";

export default async function ProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireSalesAdmin();
  const { productId } = await params;
  const query = await searchParams;

  const [producto, categorias, storeEnabled, publicSlug, presupuestosEnabled] = await Promise.all([
    getProduct(workspace.id, productId),
    listProductCategories(workspace.id),
    isModuleEnabledForWorkspace(workspace.id, STORE_MODULE_KEY),
    loadPublicSlug(workspace.id),
    isModuleEnabledForWorkspace(workspace.id, QUOTES_MODULE_KEY),
  ]);
  if (!producto) notFound();

  // Etapa 2: combo, costos-plantilla y datos para presupuestos, SÓLO con el módulo Presupuestos
  // encendido (si no, la ficha queda como antes y ni se leen). Esta ficha ya exige
  // `sales.catalog` (`requireSalesAdmin`), que es el permiso para ver costos y margen.
  const etapa2 = presupuestosEnabled
    ? await Promise.all([
        leerPerfil(workspace.id, producto.id),
        rubrosDeIngreso(workspace.id, producto.id),
        leerCombo(workspace.id, producto.id, producto.priceMinor),
        productosParaCombo(workspace.id, producto.id),
        leerCostos(workspace.id, producto.id),
        proveedoresDelWorkspace(workspace.id),
      ])
    : null;

  // Etapa 4: "Proyecto que genera", sólo con Presupuestos y Proyectos encendidos.
  const proyectos =
    etapa2 && (await proyectosEncendidos(workspace.id))
      ? { reglas: await leerReglas(workspace.id, producto.id), opciones: await opcionesDeRegla(workspace.id) }
      : null;
  // Etapa 4, Entrega B: "Cita que genera", sólo con Presupuestos y Agenda encendidos.
  const citas =
    etapa2 && (await agendaEncendida(workspace.id))
      ? { reglas: await leerReglasCita(workspace.id, producto.id), opciones: await opcionesDeReglaCita(workspace.id) }
      : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={producto.name}
        description={producto.sku ? `Código interno ${producto.sku}.` : "Sin código interno."}
        actions={
          <form action={toggleProductActiveAction}>
            <input type="hidden" name="productId" value={producto.id} />
            <input type="hidden" name="active" value={producto.isActive ? "off" : "on"} />
            <button
              type="submit"
              className={producto.isActive ? "fo-btn fo-btn-ghost text-sm" : "fo-btn fo-btn-secondary text-sm"}
            >
              {producto.isActive ? "Desactivar" : "Activar"}
            </button>
          </form>
        }
      />

      {query.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p> : null}
      {!producto.isActive ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          Este producto está inactivo: no aparece para vender, pero las ventas viejas lo siguen nombrando.
        </p>
      ) : null}

      <ProductForm product={producto} categories={categorias} error={query.error} />

      {etapa2 ? (
        <PresupuestoSections
          productId={producto.id}
          priceMinor={producto.priceMinor}
          perfil={etapa2[0]}
          rubros={etapa2[1]}
          rubroSugerido={etapa2[0].incomeCategoryId ? null : sugerirRubro(etapa2[0].incomeLabel, etapa2[1])}
          combo={etapa2[2]}
          productosCombo={etapa2[3]}
          costos={etapa2[4]}
          proveedores={etapa2[5]}
          proyectos={proyectos}
          citas={citas}
        />
      ) : null}

      <StoreSections product={producto} publicSlug={publicSlug} storeEnabled={storeEnabled} />
    </div>
  );
}
