import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireSalesAdmin } from "@/lib/sales/access";
import { getProduct, listProductCategories } from "@/lib/sales/repository";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { loadPublicSlug } from "@/lib/blog/admin-queries";
import { STORE_MODULE_KEY } from "@/lib/store/constants";
import { QUOTES_MODULE_KEY } from "@/lib/presupuestos/acceso";
import { ProductForm } from "../../product-form";
import { listarProveedores } from "@/lib/proveedores/repositorio";
import { toggleProductActiveAction } from "../../actions";
import { StoreSections } from "./store-sections";
import { ProduccionSection } from "./produccion-section";
import { asegurarConfiguracion, leerProduccion, listarSalidas } from "@/lib/impresion/configuracion";
import { RecetaSection } from "./receta-section";
import { leerReceta, listarInsumosParaReceta } from "@/lib/stock/receta-servidor";
import { piezasPorHojaSugeridas } from "@/lib/stock/receta";
import { PresupuestoSections } from "./presupuesto-sections";
import { ProveedorPorDefecto } from "./proveedor-por-defecto";
import { prisma } from "@repo/db";
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

  await asegurarConfiguracion(workspace.id);
  const [produccion, salidasImpresion] = await Promise.all([leerProduccion(workspace.id, producto.id), listarSalidas(workspace.id)]);

  // Receta de consumo: un insumo no lleva receta. La sugerencia sólo aparece si el producto se produce en el local.
  const receta =
    producto.kind !== "INSUMO"
      ? await Promise.all([leerReceta(workspace.id, producto.id), listarInsumosParaReceta(workspace.id)])
      : null;
  const tamanoHoja = produccion
    ? salidasImpresion.flatMap((s) => s.tamanos).find((t) => t.id === produccion.tamanoHojaId)?.nombre ?? ""
    : "";
  const piezasSugeridas = produccion
    ? piezasPorHojaSugeridas({ tipoPieza: produccion.tipoPieza, unidad: produccion.unidad, tamanoHoja })
    : 1;

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

      <ProductForm
        product={producto}
        categories={categorias}
        error={query.error}
        proveedores={(await listarProveedores(workspace.id, { soloActivos: true })).map((p) => ({ id: p.id, name: p.name }))}
      />

      <ProduccionSection productId={producto.id} produccion={produccion} salidas={salidasImpresion} />

      {receta ? (
        <RecetaSection
          productId={producto.id}
          receta={receta[0].map(({ insumoId, quantity, porCada }) => ({ insumoId, quantity, porCada }))}
          insumos={receta[1]}
          sugerencia={produccion ? { pideCuantasPorHoja: produccion.unidad === "PIEZA", piezasPorHoja: piezasSugeridas } : null}
        />
      ) : null}

      {proyectos ? (
        <ProveedorPorDefecto
          productId={producto.id}
          actual={(() => {
            const ids = [...new Set(proyectos.reglas.map((r) => r.proveedorId ?? ""))];
            return ids.length > 1 ? "varios" : ids[0] || null;
          })()}
          proveedores={await prisma.fotofficeProveedor.findMany({
            where: { workspaceId: workspace.id, active: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true, email: true },
          })}
          generaTrabajo={proyectos.reglas.length > 0}
        />
      ) : null}

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

      {/* Un insumo no se vende: no se ofrece publicarlo en la tienda. */}
      {producto.kind !== "INSUMO" ? (
        <StoreSections product={producto} publicSlug={publicSlug} storeEnabled={storeEnabled} />
      ) : null}
    </div>
  );
}
