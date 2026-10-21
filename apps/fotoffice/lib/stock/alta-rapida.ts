import "server-only";
import { prisma } from "@repo/db";
import { minorToDecimalString } from "@/lib/membership/money";
import { normalizeBarcode } from "@/lib/sales/barcode";
import { upsertGlobalProduct } from "@/lib/sales/global-catalog";
import { parseInsumoForm } from "./insumo-form";
import { guardarInsumo } from "./insumo-guardas";
import { agregarProductoALaRecepcion, enBorrador } from "./recepcion-servidor";

/**
 * Alta rápida desde la recepción: se escaneó un código que no está en el catálogo y se da de
 * alta ahí mismo, sin salir de la pantalla. Todo en una transacción (producto, ficha global,
 * ficha de insumo y línea), con la recepción bloqueada y en BORRADOR (`enBorrador`).
 *
 * Si el negocio ya tiene un producto activo con ese código de barras (otra pestaña lo dio de
 * alta un instante antes, o el lector lo leyó distinto), se USA ese: no se crea un duplicado.
 */

export type AltaRapida = {
  codigo: string | null;
  nombre: string;
  kind: "PRODUCTO" | "INSUMO";
  precioMinor: number | null;
  unidad: string | null;
  unidadCompra: string | null;
  unidadesPorCompra: number | null;
};

const ERROR_DADO_DE_BAJA = "Ese código ya es de un producto dado de baja: reactivalo desde el catálogo.";

function formDeInsumo(d: AltaRapida): FormData {
  const fd = new FormData();
  fd.set("unidad", d.unidad ?? "");
  fd.set("unidadCompra", d.unidadCompra ?? "");
  fd.set("unidadesPorCompra", d.unidadesPorCompra === null ? "" : String(d.unidadesPorCompra));
  return fd;
}

export function validarAltaRapida(d: AltaRapida): { ok: true } | { ok: false; error: string } {
  if (d.nombre.trim() === "") return { ok: false, error: "Escribí el nombre." };
  if (d.kind !== "PRODUCTO" && d.kind !== "INSUMO") return { ok: false, error: "Elegí si es producto o insumo." };

  const unidadCompra = (d.unidadCompra ?? "").trim();
  if (unidadCompra !== "" && d.unidadesPorCompra === null) {
    return { ok: false, error: `Decí cuántas unidades trae cada ${unidadCompra}.` };
  }

  if (d.kind === "PRODUCTO") {
    if (d.precioMinor === null || !Number.isInteger(d.precioMinor) || d.precioMinor < 0) {
      return { ok: false, error: "Poné el precio de venta." };
    }
    return { ok: true };
  }

  const insumo = parseInsumoForm(formDeInsumo(d));
  return insumo.ok ? { ok: true } : insumo;
}

export async function crearDesdeRecepcion(
  workspaceId: string,
  userId: number | null,
  recepcionId: string,
  d: AltaRapida,
): Promise<{ ok: true; productId: string; reutilizado: boolean } | { ok: false; error: string }> {
  const valido = validarAltaRapida(d);
  if (!valido.ok) return valido;

  const nombre = d.nombre.trim();
  const texto = (d.codigo ?? "").trim();
  const hayCodigo = texto !== "";
  const barras = hayCodigo ? normalizeBarcode(texto) : null;
  // Un código que no es numérico (uno interno) no es código de barras: va como código interno.
  const sku = hayCodigo && barras === null ? texto : null;

  return enBorrador(workspaceId, recepcionId, async (tx) => {
    // Un producto del negocio que ya tenga ese código se reutiliza; si está dado de baja no se
    // crea otro (chocaría con el código interno único y duplicaría el barcode).
    let productId: string | null = null;
    let reutilizado = false;
    const donde = barras !== null ? { barcode: barras } : sku !== null ? { sku } : null;
    if (donde !== null) {
      const activo = await tx.product.findFirst({
        where: { workspaceId, isActive: true, ...donde },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (activo) {
        productId = activo.id;
        reutilizado = true;
      } else {
        const baja = await tx.product.findFirst({ where: { workspaceId, ...donde }, select: { id: true } });
        if (baja) return { ok: false as const, error: ERROR_DADO_DE_BAJA };
      }
    }

    if (productId === null) {
      const globalProductId =
        barras === null
          ? null
          : (
              await upsertGlobalProduct(tx, {
                barcode: barras,
                name: nombre,
                brand: null,
                description: null,
                imageUrl: null,
                workspaceId,
                userId,
              })
            ).id;

      const creado = await tx.product.create({
        data: {
          workspaceId,
          kind: d.kind,
          name: nombre,
          priceArs: minorToDecimalString(d.kind === "INSUMO" ? 0 : (d.precioMinor as number)),
          tracksStock: true,
          barcode: barras,
          sku,
          globalProductId,
          isActive: true,
          createdByUserId: userId,
        },
        select: { id: true },
      });
      productId = creado.id;

      if (d.kind === "INSUMO") {
        const insumo = parseInsumoForm(formDeInsumo(d));
        if (!insumo.ok) return insumo;
        await guardarInsumo(tx, { workspaceId, productId, values: insumo.values });
      }
    }

    const linea = await agregarProductoALaRecepcion(tx, {
      workspaceId,
      recepcionId,
      productId,
      codigo: barras,
      origen: hayCodigo ? "LECTOR" : "MANUAL",
    });
    if (!linea.ok) return linea;
    return { ok: true as const, productId, reutilizado };
  });
}
