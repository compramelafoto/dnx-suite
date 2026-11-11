import "server-only";
import { prisma } from "@repo/db";
import { faseDeEtapaEn } from "@/lib/proyectos/en-curso-puro";
import { copiasInstantaneas, quedaPorImprimir } from "./estado-pedido";

/**
 * Las instantáneas pedidas por WhatsApp o por la web que ya se pagaron y todavía no se imprimieron (su
 * trabajo no llegó a «Listo»). Se imprimen en el estudio: las fotos quedan en un ZIP en el trabajo.
 */

const DIA_MS = 86_400_000;
const PAGADOS = ["PAGADO", "PREPARANDO", "ENVIADO", "PAGADO_SIN_ENVIAR"];

export type InstantaneaPorImprimir = {
  proyectoId: string;
  numero: number;
  cliente: string;
  pagadoEl: Date | null;
  copias: { tamano: string; papel: string; cantidad: number }[];
  /** El ZIP con las fotos ya está en el trabajo (lo arma el cron a los pocos minutos del pago). */
  zipListo: boolean;
};

export async function instantaneasPorImprimir(workspaceId: string, ahora: Date): Promise<InstantaneaPorImprimir[]> {
  const pedidos = await prisma.fotofficePrintOrder.findMany({
    where: { workspaceId, status: { in: PAGADOS }, paidAt: { gte: new Date(ahora.getTime() - 30 * DIA_MS) }, items: { some: { plazo: "INSTANTANEA" } } },
    orderBy: [{ paidAt: "asc" }, { number: "asc" }],
    take: 50,
    select: { number: true, nombre: true, paidAt: true, paper: true, items: { select: { widthCm: true, heightCm: true, quantity: true, paper: true, plazo: true, proyectoId: true } } },
  });
  const salida: InstantaneaPorImprimir[] = [];
  for (const p of pedidos) {
    const trabajos = [...new Set(p.items.filter((i) => i.plazo === "INSTANTANEA" && i.proyectoId).map((i) => i.proyectoId!))];
    for (const proyectoId of trabajos) {
      const [j, zip] = await Promise.all([
        prisma.fotofficeJourney.findFirst({ where: { workspaceId, subjectType: "PROYECTO", subjectId: proyectoId }, select: { circuitId: true, stageId: true, closedAt: true } }),
        prisma.fotofficeArchivoTrabajo.count({ where: { workspaceId, proyectoId, nombre: `Pedido-${p.number}-instantaneas.zip` } }),
      ]);
      let fase: string | null = null;
      if (j?.stageId) {
        const etapas = await prisma.fotofficeStage.findMany({ where: { circuitId: j.circuitId, archivedAt: null }, select: { id: true, name: true, color: true, order: true } });
        fase = faseDeEtapaEn(etapas, j.stageId);
      }
      if (!quedaPorImprimir(fase, j?.closedAt != null)) continue;
      const items = p.items
        .filter((i) => i.proyectoId === proyectoId)
        .map((i) => ({ ...i, widthCm: Number(String(i.widthCm)), heightCm: Number(String(i.heightCm)) }));
      salida.push({ proyectoId, numero: p.number, cliente: p.nombre, pagadoEl: p.paidAt, copias: copiasInstantaneas(items, p.paper), zipListo: zip > 0 });
    }
  }
  return salida;
}
