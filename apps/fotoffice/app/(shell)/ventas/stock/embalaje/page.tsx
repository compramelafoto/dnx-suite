import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireSalesStaff } from "@/lib/sales/access";
import { leerConfiguracionEmbalaje, type EnvoltorioEnPantalla } from "@/lib/stock/embalaje-config";
import { cargarEnvoltoriosDeEjemploAction, guardarEnvoltorioAction } from "./actions";
import { TablaEntregas } from "./tabla-entregas";

export const dynamic = "force-dynamic";

const cm = (n: number) => String(n).replace(".", ",");

/**
 * Embalaje: los sobres y bolsas del negocio y cómo se entrega cada producto. Con esto, cada venta,
 * pedido y pedido de impresión descuenta solo el embalaje que usa.
 */
export default async function EmbalajePage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; ejemplo?: string }> }) {
  const { workspace, canEditCatalog } = await requireSalesStaff();
  const sp = await searchParams;
  const { envoltorios, productos } = await leerConfiguracionEmbalaje(workspace.id);
  const faltan = productos.filter((p) => !p.entrega).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Embalaje"
        description="Los sobres y bolsas que se usan al entregar. El sistema los descuenta solo en cada venta y pedido."
        actions={
          <Link href="/ventas/stock" className="fo-btn text-sm">
            Volver a Stock
          </Link>
        }
      />

      {sp.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {sp.error}
        </p>
      ) : null}
      {sp.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p> : null}
      {sp.ejemplo ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">
          Listo. Arrancan en cero: contá cuántos tenés y cargalo en Stock con &quot;Ajustar por conteo&quot;.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Sobres y bolsas</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Cada uno dice qué es lo más grande que entra. Las fotos chicas van todas juntas en un sobre (uno más cada tantas, si
          lo indicás); lo grande va en una sola bolsa, la que corresponde a la pieza más grande.
        </p>

        {envoltorios.length === 0 && canEditCatalog ? (
          <div className="fo-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-medium text-[var(--fo-text)]">Empezá con los de un estudio de fotografía</p>
              <p className="text-sm text-[var(--fo-muted)]">Sobre de papel 19x24 (fotos hasta 15x21, uno más cada 100) y bolsas negras 20x30, 30x45 y 35x45. Después los corregís.</p>
            </div>
            <form action={cargarEnvoltoriosDeEjemploAction}>
              <button type="submit" className="fo-btn fo-btn-primary text-sm">
                Cargar sobre 19x24 y bolsas negras
              </button>
            </form>
          </div>
        ) : null}

        <div className="space-y-2">
          {envoltorios.map((e) => (
            <FormEnvoltorio key={e.filaId} e={e} editable={canEditCatalog} />
          ))}
          {canEditCatalog ? <FormEnvoltorio e={null} editable /> : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Cómo se entrega cada producto</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          {faltan > 0 ? `Faltan ${faltan} productos. ` : ""}
          Las fotos e impresiones son piezas sueltas con su medida. Los portarretratos llevan la bolsa siguiente a su medida, y la
          foto que va adentro no lleva sobre. Lo marcado «sugerido» se guarda recién al tocar «Guardar».
        </p>
        {canEditCatalog ? (
          <TablaEntregas productos={productos} envoltorios={envoltorios.filter((e) => e.activo).map((e) => ({ filaId: e.filaId, nombre: e.nombre }))} />
        ) : (
          <p className="fo-card p-4 text-sm text-[var(--fo-muted)]">Sólo quien edita el catálogo puede cambiar esto.</p>
        )}
      </section>
    </div>
  );
}

function FormEnvoltorio({ e, editable }: { e: EnvoltorioEnPantalla | null; editable: boolean }) {
  return (
    <form action={guardarEnvoltorioAction} className="fo-card flex flex-wrap items-end gap-3 p-3">
      <input type="hidden" name="insumoId" value={e?.insumoId ?? ""} />
      <label className="min-w-[180px] flex-1 text-sm">
        <span className="fo-label">{e ? "Nombre" : "Nuevo sobre o bolsa"}</span>
        <input name="nombre" className="fo-input w-full" defaultValue={e?.nombre ?? ""} placeholder="Bolsa negra 40x50" disabled={!editable} required />
      </label>
      <label className="text-sm">
        <span className="fo-label">Tipo</span>
        <select name="tipo" className="fo-input" defaultValue={e?.tipo ?? "BOLSA"} disabled={!editable}>
          <option value="SOBRE">Sobre</option>
          <option value="BOLSA">Bolsa</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="fo-label">Entra hasta (cm)</span>
        <span className="flex items-center gap-1">
          <input name="admiteAnchoCm" className="fo-input w-16" inputMode="decimal" defaultValue={e ? cm(e.admiteAnchoCm) : ""} disabled={!editable} required />
          <span className="text-[var(--fo-muted)]">x</span>
          <input name="admiteAltoCm" className="fo-input w-16" inputMode="decimal" defaultValue={e ? cm(e.admiteAltoCm) : ""} disabled={!editable} required />
        </span>
      </label>
      <label className="text-sm">
        <span className="fo-label">Uno más cada</span>
        <input name="piezasPorUnidad" className="fo-input w-20" inputMode="numeric" defaultValue={e?.piezasPorUnidad ?? ""} placeholder="—" disabled={!editable} />
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm text-[var(--fo-muted)]">
        <input type="checkbox" name="activo" defaultChecked={e?.activo ?? true} disabled={!editable} />
        Activo
      </label>
      {e ? <span className="pb-2 text-sm text-[var(--fo-muted)]">Quedan {e.stockQty}</span> : null}
      {editable ? (
        <button type="submit" className="fo-btn text-sm">
          {e ? "Guardar" : "Agregar"}
        </button>
      ) : null}
    </form>
  );
}
