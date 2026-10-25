import type { InsumoFormValues } from "./insumo-form";

/**
 * Reglas de alta y edición de un insumo que necesitan la base. Reciben el cliente de
 * transacción (o el normal) por parámetro, con sólo lo que usan, para poder probarlas con
 * un cliente falso en memoria.
 */

type Contador = { count(args: { where: Record<string, unknown> }): Promise<number> };

export type TxGuardas = {
  fotofficeRecetaInsumo: Contador;
  fotofficeConsumoTamano: Contador;
};

export const ERROR_INSUMO_EN_RECETAS =
  "Ese insumo está en recetas: sacalo de ellas antes de cambiarle el tipo.";
export const ERROR_PRODUCTO_CON_RECETA =
  "Ese producto tiene receta de consumo: sacala antes de convertirlo en insumo.";

/**
 * Cambiar el tipo de un producto existente puede dejar recetas apuntando a algo que ya no es
 * insumo (o un insumo con receta propia, que no tiene sentido). Devuelve el mensaje de error,
 * o `null` si el cambio es seguro. Un alta (`kindAnterior = null`) nunca tiene usos.
 */
export async function validarCambioDeTipo(
  tx: TxGuardas,
  args: { workspaceId: string; productId: string; kindAnterior: string | null; kindNuevo: string },
): Promise<string | null> {
  const { workspaceId, productId, kindAnterior, kindNuevo } = args;
  if (kindAnterior === null || kindAnterior === kindNuevo) return null;

  if (kindAnterior === "INSUMO") {
    const [enRecetas, enConsumos] = await Promise.all([
      tx.fotofficeRecetaInsumo.count({ where: { workspaceId, insumoId: productId } }),
      tx.fotofficeConsumoTamano.count({ where: { workspaceId, insumoId: productId } }),
    ]);
    if (enRecetas > 0 || enConsumos > 0) return ERROR_INSUMO_EN_RECETAS;
  }

  if (kindNuevo === "INSUMO") {
    const recetaPropia = await tx.fotofficeRecetaInsumo.count({ where: { workspaceId, productId } });
    if (recetaPropia > 0) return ERROR_PRODUCTO_CON_RECETA;
  }

  return null;
}

/** Crea o actualiza la ficha de insumo del producto. Va en la misma transacción que el producto. */
export async function guardarInsumo(
  tx: { fotofficeInsumo: { upsert(args: any): Promise<unknown> } }, // eslint-disable-line @typescript-eslint/no-explicit-any
  args: { workspaceId: string; productId: string; values: InsumoFormValues },
): Promise<void> {
  const { workspaceId, productId, values } = args;
  await tx.fotofficeInsumo.upsert({
    where: { productId },
    create: { workspaceId, productId, ...values },
    update: values,
  });
}
