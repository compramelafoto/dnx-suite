import "server-only";
import { Prisma, prisma } from "@repo/db";
import { normalizeBarcode } from "./barcode";
import { globalFieldsFromProduct, type GlobalFields } from "./global-catalog-fields";

/**
 * El catálogo maestro de productos (§3.4). La única tabla de todo FotoOffice que NO está
 * aislada por workspace, y a propósito: el código de barras de un portarretratos es el mismo
 * en cualquier negocio, así que la identidad del producto —nombre, marca, descripción, foto—
 * se comparte. El precio, el costo, la existencia, el proveedor y el código interno son del
 * negocio y nunca llegan hasta acá; ver `global-catalog-fields.ts`.
 */

/**
 * Busca la ficha global por código de barras.
 *
 * Deliberadamente SIN `workspaceId`: esta tabla es global a propósito (§3.4), y el código de
 * barras ya es único en todo el sistema (`GlobalProduct.barcode` tiene `@unique`). Filtrar
 * también por workspace no protegería nada — no hay nada privado en esta fila — y le
 * escondería a un negocio la ficha que otro ya cargó, que es exactamente lo que el catálogo
 * compartido existe para evitar. No es un olvido: no lo agregues en una futura revisión.
 */
export async function findGlobalByBarcode(
  barcode: string,
): Promise<(GlobalFields & { id: string }) | null> {
  const codigo = normalizeBarcode(barcode);
  if (codigo === null) return null;

  const global = await prisma.globalProduct.findUnique({
    where: { barcode: codigo },
    select: { id: true, name: true, brand: true, description: true, imageUrl: true },
  });
  if (!global) return null;

  return { id: global.id, ...globalFieldsFromProduct(global) };
}

/**
 * Crea la ficha global la primera vez que alguien carga un código, o la deja como está si ya
 * existe.
 *
 * Política de §3.4: el primero que carga un código de barras crea la ficha; todos los que
 * vengan después la leen, nunca la pisan. Si un negocio pudiera reescribirla, un error suyo
 * le renombraría el producto a otro en su propio formulario. Quien quiera corregir algo lo
 * corrige en su propio producto, que es el que de verdad usa.
 *
 * Los cuatro campos que se graban salen exclusivamente de `globalFieldsFromProduct`: nunca se
 * arma el objeto a mano acá, para no reabrir la puerta que esa función existe para cerrar.
 */
export async function upsertGlobalProduct(
  tx: Prisma.TransactionClient,
  input: {
    barcode: string;
    name: string;
    brand: string | null;
    description: string | null;
    imageUrl: string | null;
    workspaceId: string;
    userId: number | null;
  },
): Promise<{ id: string; created: boolean }> {
  const codigo = normalizeBarcode(input.barcode);
  if (codigo === null) {
    throw new Error("Código de barras inválido para el catálogo maestro.");
  }

  const existente = await tx.globalProduct.findUnique({
    where: { barcode: codigo },
    select: { id: true },
  });
  if (existente) return { id: existente.id, created: false };

  const campos = globalFieldsFromProduct(input);
  try {
    const creado = await tx.globalProduct.create({
      data: {
        barcode: codigo,
        ...campos,
        createdByWorkspaceId: input.workspaceId,
        createdByUserId: input.userId,
      },
      select: { id: true },
    });
    return { id: creado.id, created: true };
  } catch (e) {
    // Dos cajas escaneando el mismo código nuevo a la vez: la segunda choca contra el
    // `@unique` de `barcode`. No es un error, es la misma política de "el primero crea, el
    // resto lee" resuelta a nivel de base en vez de en memoria.
    const choque = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
    if (!choque) throw e;
    const yaCreado = await tx.globalProduct.findUnique({ where: { barcode: codigo }, select: { id: true } });
    if (!yaCreado) throw e;
    return { id: yaCreado.id, created: false };
  }
}
