import "server-only";
import { prisma } from "@repo/db";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import type { BeneficiarioRegistrado } from "./beneficiarios";

export async function nombresDeNegocios(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const [marcas, workspaces] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findMany({ where: { workspaceId: { in: ids } }, select: { workspaceId: true, commercialName: true } }),
    prisma.workspace.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
  ]);
  const m = new Map(workspaces.map((w) => [w.id, w.name]));
  for (const b of marcas) if (b.commercialName?.trim()) m.set(b.workspaceId, b.commercialName.trim());
  return m;
}

export async function cargarDueno(workspaceId: string): Promise<{ workspaceId: string; nombre: string }> {
  const nombres = await nombresDeNegocios([workspaceId]);
  return { workspaceId, nombre: nombres.get(workspaceId) ?? "El dueño" };
}

export async function cargarBeneficiarios(courseId: string): Promise<BeneficiarioRegistrado[]> {
  const filas = await prisma.courseBeneficiary.findMany({
    where: { courseId },
    orderBy: { createdAt: "asc" },
  });
  const ids = filas.map((f) => f.workspaceId).filter((x): x is string => Boolean(x));
  const nombres = await nombresDeNegocios(ids);
  const conectados = new Map(
    await Promise.all(ids.map(async (id) => [id, (await resolveWorkspaceCollector(id)).ok] as const)),
  );
  return filas.map((f) => ({
    id: f.id,
    workspaceId: f.workspaceId,
    invitedEmail: f.invitedEmail,
    nombre: f.workspaceId ? nombres.get(f.workspaceId) ?? "Negocio" : f.invitedEmail ?? "Invitado",
    role: f.role,
    shareBps: f.shareBps,
    absorbsProcessorFee: f.absorbsProcessorFee,
    status: f.status,
    mpConectado: f.workspaceId ? conectados.get(f.workspaceId) === true : false,
  }));
}
