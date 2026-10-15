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

  // Acá NO se puede envolver un `create` en un `try/catch` que atrape `P2002` (como sí hacen
  // `openShiftAction` y `saveAccountAction` en `caja/actions.ts`, con el cliente `prisma` de
  // nivel superior): `tx` es una transacción interactiva, y en PostgreSQL CUALQUIER error
  // dentro de un `BEGIN…COMMIT` deja la transacción abortada — la sentencia siguiente no se
  // ejecuta, falla con `25P02` ("current transaction is aborted") y todo termina en
  // `ROLLBACK`. La relectura que un `catch` quisiera hacer ahí adentro nunca llegaría a
  // correr: reemplazaría el `P2002` limpio por un error de base incomprensible, y de paso se
  // perdería toda la transacción del alta del producto. Prisma tampoco salva la situación:
  // una transacción interactiva no envuelve cada sentencia en su propio `SAVEPOINT`. Por eso
  // se inserta con `createMany` + `skipDuplicates`, que en Postgres compila a
  // `ON CONFLICT DO NOTHING`: un choque de unicidad deja de ser un error de SQL, la
  // transacción sigue viva, y la relectura de abajo sí puede correr. Si en algún momento
  // "simplificás" esto de vuelta a un `create` con `catch`, va a volver a romperse apenas dos
  // cajas escaneen el mismo código nuevo al mismo tiempo — y va a ser más difícil de ver
  // porque las pruebas con un solo llamador nunca disparan la carrera.
  const resultado = await tx.globalProduct.createMany({
    data: [
      {
        barcode: codigo,
        ...campos,
        createdByWorkspaceId: input.workspaceId,
        createdByUserId: input.userId,
      },
    ],
    skipDuplicates: true,
  });

  // `resultado.count` es 1 si el INSERT de este llamador entró, y 0 si `ON CONFLICT DO
  // NOTHING` lo descartó porque otra caja ya había creado la fila un instante antes. Con eso
  // alcanza para saber quién ganó la carrera, sin adivinar: no hace falta comparar contra la
  // relectura.
  const fila = await tx.globalProduct.findUnique({ where: { barcode: codigo }, select: { id: true } });
  if (!fila) {
    // No debería poder pasar: `barcode` es `@unique` y acabamos de intentar crear esa fila,
    // así que después del `createMany` tiene que existir la nuestra o la de otra caja. Si
    // esto se dispara, el problema es otro (la tabla cambió por afuera de esta política).
    throw new Error("No se pudo crear ni encontrar la ficha del catálogo maestro.");
  }
  return { id: fila.id, created: resultado.count === 1 };
}
