import "server-only";
import { prisma } from "@repo/db";
import { asegurarConfiguracion } from "@/lib/impresion/configuracion";

/**
 * La Kodak 305 en un toque: el insumo del ribbon (el kit) y cuánto gasta cada hoja según el
 * tamaño. Las cifras son las del kit 6R de 640 copias de 10x15; una hoja de 13x18 o 15x20
 * gasta el doble.
 */
export const KODAK_305 = {
  salida: "Kodak 305",
  insumo: {
    nombre: "Kit Kodak 305 (copias 10x15)",
    unidad: "copias 10x15",
    unidadCompra: "Kit 305 6R",
    unidadesPorCompra: 640,
  },
  consumoPorTamano: { "10x15": 1, "13x18": 2, "15x20": 2 },
} as const;

export { entradaEnUnidades } from "./unidades";

export type ResultadoKodak305 =
  | { ok: true; insumoId: string; creado: boolean }
  | { ok: false; error: string };

/**
 * Deja lista la Kodak 305: el insumo y su consumo por tamaño. Idempotente: se puede apretar
 * dos veces (o dos personas a la vez) sin duplicar nada, porque todo va en una transacción
 * con un candado por negocio. Nunca escribe movimientos: la existencia arranca en cero y se
 * carga después con "Ajustar por conteo".
 */
export async function asegurarKodak305(workspaceId: string): Promise<ResultadoKodak305> {
  // Siembra la salida y los tamaños si es la primera vez que el negocio usa Impresión.
  await asegurarConfiguracion(workspaceId);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-kodak305:${workspaceId}`}))`;

    const salida = await tx.fotofficeSalidaImpresion.findFirst({
      where: { workspaceId, nombre: KODAK_305.salida },
      select: { id: true },
    });
    if (!salida) return { ok: false as const, error: "No encontramos la Kodak 305 en Impresión." };

    const puentes = await tx.fotofficeSalidaTamano.findMany({
      where: { salidaId: salida.id },
      select: { tamano: { select: { id: true, nombre: true } } },
    });
    const tamanoPorNombre = new Map(puentes.map((p) => [p.tamano.nombre, p.tamano.id]));

    const consumos = await tx.fotofficeConsumoTamano.findMany({
      where: { workspaceId, salidaId: salida.id },
      select: { tamanoId: true, insumoId: true },
    });

    let insumoId: string | null = consumos[0]?.insumoId ?? null;
    let creado = false;
    if (!insumoId) {
      const existente = await tx.product.findFirst({
        where: { workspaceId, kind: "INSUMO", name: KODAK_305.insumo.nombre },
        select: { id: true },
      });
      if (existente) {
        insumoId = existente.id;
      } else {
        const nuevo = await tx.product.create({
          data: {
            workspaceId,
            kind: "INSUMO",
            name: KODAK_305.insumo.nombre,
            priceArs: "0",
            tracksStock: true,
            stockQty: 0,
          },
          select: { id: true },
        });
        insumoId = nuevo.id;
        creado = true;
      }
    }

    // La ficha del insumo: si ya existía, no se pisa lo que el negocio haya cambiado.
    await tx.fotofficeInsumo.upsert({
      where: { productId: insumoId },
      create: {
        workspaceId,
        productId: insumoId,
        unidad: KODAK_305.insumo.unidad,
        unidadCompra: KODAK_305.insumo.unidadCompra,
        unidadesPorCompra: KODAK_305.insumo.unidadesPorCompra,
      },
      update: {},
    });

    const yaLigados = new Set(consumos.filter((c) => c.insumoId === insumoId).map((c) => c.tamanoId));
    for (const [nombre, quantity] of Object.entries(KODAK_305.consumoPorTamano)) {
      const tamanoId = tamanoPorNombre.get(nombre);
      if (!tamanoId || yaLigados.has(tamanoId)) continue;
      await tx.fotofficeConsumoTamano.create({
        data: { workspaceId, salidaId: salida.id, tamanoId, insumoId, quantity },
      });
    }

    return { ok: true as const, insumoId, creado };
  });
}

/**
 * Si hay que ofrecer "Configurar": el negocio tiene la salida Kodak 305 y todavía no tiene
 * consumos cargados para ella. No siembra nada: sólo mira.
 */
export async function kodak305Pendiente(workspaceId: string): Promise<boolean> {
  const salida = await prisma.fotofficeSalidaImpresion.findFirst({
    where: { workspaceId, nombre: KODAK_305.salida },
    select: { id: true },
  });
  if (!salida) return false;
  const consumos = await prisma.fotofficeConsumoTamano.count({ where: { workspaceId, salidaId: salida.id } });
  return consumos === 0;
}
