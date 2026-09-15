import "server-only";
import { Prisma } from "@repo/db";
import { matchExistingClient, soloDigitos } from "./match";
import { nextClientNumber } from "./client-number";

/**
 * La única puerta por la que los otros módulos consiguen un cliente.
 *
 * Recibe una transacción y no el cliente global: quien llama está creando una reserva o una
 * venta, y el cliente tiene que nacer o no nacer junto con eso. Un cliente creado y una
 * venta que falló deja basura en el padrón.
 *
 * Busca entre los candidatos que comparten algún dato de contacto y no entre todos los
 * clientes del workspace: con un padrón de miles, traerlos a todos para compararlos en
 * memoria sería absurdo.
 */
export async function findOrCreateClient(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    docNumber?: string | null;
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    businessName?: string | null;
    createdByUserId?: number | null;
  },
): Promise<{ id: string; created: boolean }> {
  const doc = input.docNumber?.replace(/[.\-\s]/g, "") || null;
  const mail = input.email?.trim().toLowerCase() || null;
  // Mismo criterio que `client-form.ts` al guardar: si acá se dejara el teléfono tal cual
  // llega, el `where` de abajo (comparación exacta contra la base) no encontraría a un
  // cliente guardado como "341 123-4567" al buscarlo como "3411234567", y se crearía una
  // ficha duplicada aunque `matchExistingClient` los reconoce como el mismo número.
  const tel = input.phone ? soloDigitos(input.phone) || null : null;

  if (doc || mail || tel) {
    const candidatos = await tx.client.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          ...(doc ? [{ docNumber: doc }] : []),
          ...(mail ? [{ email: mail }] : []),
          ...(tel ? [{ phone: tel }] : []),
        ],
      },
      select: { id: true, docNumber: true, email: true, phone: true },
      take: 50,
    });
    const encontrado = matchExistingClient(candidatos, { docNumber: doc, email: mail, phone: tel });
    if (encontrado) return { id: encontrado.id, created: false };
  }

  // Mismo reintento que `saveClientAction`: el número se calcula leyendo el último y sumando
  // uno, y dos altas simultáneas leen el mismo. Acá importa más que en el formulario, porque
  // por esta puerta entran las reservas y las ventas, que sí pueden llegar a la vez.
  const datos = {
    workspaceId: input.workspaceId,
    kind: input.businessName ? "EMPRESA" : "PERSONA",
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    businessName: input.businessName ?? null,
    docNumber: doc,
    docType: doc ? (doc.length === 11 ? "CUIT" : "DNI") : null,
    email: mail,
    phone: tel,
    createdByUserId: input.createdByUserId ?? null,
  };

  // CUARTA vez que este proyecto tropieza con la misma familia de bug: un `catch` de P2002
  // no puede vivir dentro de una transacción interactiva. `findOrCreateClient` siempre recibe
  // un `tx` —nunca abre el suyo propio (ver el comentario de cabecera)— y desde que
  // `record-sale.ts` empezó a llamarlo DENTRO de la transacción de la venta, el `catch` de
  // abajo quedó alcanzable de verdad: en PostgreSQL un error dentro de `BEGIN…COMMIT` deja la
  // transacción abortada, la sentencia siguiente revienta con "current transaction is
  // aborted" (25P02), y el reintento que este `for` promete nunca llega a correr — la venta
  // entera termina en `ROLLBACK` por un choque que debería haberse resuelto solo. Mismo
  // arreglo que ya se aplicó en `lib/sales/global-catalog.ts` y en `lib/sales/record-sale.ts`:
  // `createMany` + `skipDuplicates` compila a `ON CONFLICT DO NOTHING`, así que el choque del
  // índice único `(workspaceId, clientNumber)` deja de ser un error de SQL y la transacción
  // sigue viva para releer y reintentar con el próximo número.
  for (let intento = 0; intento < 3; intento++) {
    const ultimo = await tx.client.findFirst({
      where: { workspaceId: input.workspaceId },
      orderBy: { clientNumber: "desc" },
      select: { clientNumber: true },
    });
    const clientNumber = nextClientNumber(ultimo?.clientNumber ?? null);

    const resultado = await tx.client.createMany({
      data: [{ ...datos, clientNumber }],
      skipDuplicates: true,
    });

    if (resultado.count === 1) {
      // Ganamos la carrera con este número. `createMany` no devuelve el `id` que Prisma le
      // generó (a diferencia de `create`), así que se relee por el único compuesto que
      // acabamos de asegurar.
      const creado = await tx.client.findUniqueOrThrow({
        where: { workspaceId_clientNumber: { workspaceId: input.workspaceId, clientNumber } },
        select: { id: true },
      });
      return { id: creado.id, created: true };
    }
    // `count === 0`: otra alta tomó este número un instante antes (`ON CONFLICT DO NOTHING`
    // descartó la fila). Se reintenta con el próximo número, sin que esto haya sido un error.
  }

  throw new Error("No se pudo asignar un número de cliente después de tres intentos.");
}
