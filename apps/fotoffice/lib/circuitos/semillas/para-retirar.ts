import type { Prisma } from "@repo/db";
import type { EtapaDelFlujo } from "@/lib/proyectos/crear";
import type { SemillaCircuito } from "./dnx";

type Tx = Prisma.TransactionClient;

/** Clave con la que se marca el flujo estándar de los pedidos «para retirar» (`FotofficeCircuit.systemKey`). */
export const CLAVE_PARA_RETIRAR = "PARA_RETIRAR";

const NOMBRE = "Para retirar";
/** Si el estudio ya tiene otro flujo con el nombre y no sirve, el nuestro lleva este. */
const NOMBRE_ALTERNATIVO = "Para retirar (FOTOFFICE)";

/**
 * Flujo que usa un producto «para retirar» sin regla propia. Los colores fijan la fase en el
 * tablero (gris RECIBIDO, azul EN_PROCESO, amarillo LISTO, verde ENTREGADO) y la última etapa,
 * verde, es la que el candado del saldo trata como entrega.
 */
export const FLUJO_PARA_RETIRAR: SemillaCircuito = {
  name: NOMBRE,
  kind: "TRABAJO",
  stages: [
    { name: "Recibido", days: 0, color: "gris" },
    { name: "En preparación", days: 1, color: "azul" },
    { name: "Listo para retirar", days: 0, color: "amarillo" },
    { name: "Entregado", days: 0, color: "verde" },
  ],
};

type FilaCircuito = { id: string; kind: string; isActive: boolean; systemKey: string | null };

/** Crea las etapas por defecto a continuación de las que ya haya (archivadas incluidas). */
async function crearEtapas(tx: Tx, circuitId: string): Promise<void> {
  const ultima = await tx.fotofficeStage.findFirst({ where: { circuitId }, orderBy: { order: "desc" }, select: { order: true } });
  const desde = ultima ? ultima.order + 1 : 0;
  for (const [i, s] of FLUJO_PARA_RETIRAR.stages.entries()) {
    await tx.fotofficeStage.create({ data: { circuitId, name: s.name, order: desde + i, days: s.days, color: s.color ?? "gris" } });
  }
}

/** Deja el flujo usable: activo, de trabajo, marcado y con al menos una etapa activa. */
async function dejarUsable(tx: Tx, c: FilaCircuito): Promise<void> {
  if (!c.isActive || c.kind !== "TRABAJO" || c.systemKey !== CLAVE_PARA_RETIRAR) {
    await tx.fotofficeCircuit.update({ where: { id: c.id }, data: { isActive: true, kind: "TRABAJO", systemKey: CLAVE_PARA_RETIRAR } });
  }
  if ((await tx.fotofficeStage.count({ where: { circuitId: c.id, archivedAt: null } })) === 0) await crearEtapas(tx, c.id);
}

/**
 * Devuelve el flujo estándar «Para retirar» del estudio, creándolo la primera vez que hace falta.
 *
 * Corre dentro de la transacción del pedido, así que NO puede apoyarse en capturar un P2002
 * (en Postgres aborta la transacción entera): primero mira y recién después inserta. Busca por
 * la marca, después por el nombre (si el estudio ya tenía uno de trabajo, activo y con etapas lo
 * adopta marcándolo) y recién entonces crea. Si el nombre está tomado por algo que no sirve
 * (archivado, de venta o sin etapas), crea el suyo como «Para retirar (FOTOFFICE)».
 */
export async function asegurarFlujoParaRetirar(tx: Tx, workspaceId: string): Promise<{ circuitId: string; etapas: EtapaDelFlujo[] }> {
  const campos = { id: true, kind: true, isActive: true, systemKey: true } as const;
  let circuito: FilaCircuito | null = await tx.fotofficeCircuit.findFirst({ where: { workspaceId, systemKey: CLAVE_PARA_RETIRAR }, select: campos });

  if (!circuito) {
    const homonimo: FilaCircuito | null = await tx.fotofficeCircuit.findFirst({ where: { workspaceId, name: NOMBRE }, select: campos });
    const sirve =
      homonimo !== null &&
      homonimo.kind === "TRABAJO" &&
      homonimo.isActive &&
      homonimo.systemKey === null &&
      (await tx.fotofficeStage.count({ where: { circuitId: homonimo.id, archivedAt: null } })) > 0;
    if (sirve) {
      circuito = homonimo;
    } else {
      const propio: FilaCircuito | null = await tx.fotofficeCircuit.findFirst({
        where: { workspaceId, name: homonimo ? NOMBRE_ALTERNATIVO : NOMBRE },
        select: campos,
      });
      // Un «Para retirar (FOTOFFICE)» de un intento anterior sin marca se adopta en vez de chocar.
      circuito =
        propio ??
        (await tx.fotofficeCircuit.create({
          data: { workspaceId, name: homonimo ? NOMBRE_ALTERNATIVO : NOMBRE, kind: "TRABAJO", systemKey: CLAVE_PARA_RETIRAR },
          select: campos,
        }));
    }
  }

  await dejarUsable(tx, circuito);
  const etapas = await tx.fotofficeStage.findMany({
    where: { circuitId: circuito.id, archivedAt: null },
    orderBy: { order: "asc" },
    select: { id: true, days: true },
  });
  return { circuitId: circuito.id, etapas };
}
