import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { puede } from "@/lib/access/policy";
import { requireAuth } from "@/lib/auth";
import { requireOwnWorkspace } from "@/lib/entrada/require-own-workspace";
import { TIPOS, tipoPorId } from "@/lib/landing/tipos";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { FAMILY_LABELS, getModuleDefinition, listModules } from "@/lib/modules/registry";
import { ordenDeFamilias, paqueteSugerido } from "@/lib/modules/suggested";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { aplicarVocabulario } from "@/lib/vocabulario/plantilla";
import { getOrganizationType } from "@/lib/workspace-type";
import { ModulosClient, type FamiliaVista, type TipoVista } from "./modulos-client";

export const dynamic = "force-dynamic";

export default async function ModulosPage() {
  const user = await requireAuth();
  const ensured = await requireOwnWorkspace(user);
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: ensured.workspaceId } },
    select: { role: true },
  });
  const role = membership?.role ?? null;

  if (!role || !puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Módulos" />
        <p className="text-sm text-[var(--fo-muted)]">
          Sólo el dueño o un administrador pueden cambiar los módulos.
        </p>
      </div>
    );
  }

  const [tipoActual, encendidos, vocabulario] = await Promise.all([
    getOrganizationType(ensured.workspaceId),
    getEnabledModuleKeysForWorkspace(ensured.workspaceId),
    loadPersonVocabulary(ensured.workspaceId),
  ]);
  const v = (t: string) => aplicarVocabulario(t, vocabulario);
  const tipo = tipoPorId(tipoActual);
  const modulos = listModules();

  const nombres: Record<string, string> = Object.fromEntries(modulos.map((m) => [m.key, v(m.label)]));
  const tipos: TipoVista[] = TIPOS.map((t) => ({
    id: t.id,
    label: t.label,
    resumen: t.resumen,
    paquete: paqueteSugerido(t.id).map((k) => nombres[k] ?? getModuleDefinition(k)?.label ?? k),
  }));
  const familias: FamiliaVista[] = ordenDeFamilias(tipoActual)
    .map((f) => ({
      id: f,
      label: FAMILY_LABELS[f],
      modulos: modulos
        .filter((m) => m.family === f)
        .map((m) => ({
          key: m.key,
          label: v(m.label),
          porque: v(tipo?.destacados.find((d) => d.key === m.key)?.porque ?? m.description),
          planned: m.status !== "AVAILABLE",
          platformFee: !!m.platformFee,
          enabled: encendidos.has(m.key),
        })),
    }))
    .filter((f) => f.modulos.length > 0);

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        title="Módulos"
        description="Encendé o apagá lo que usa tu organización. Apagar un módulo no borra sus datos."
      />
      <ModulosClient tipos={tipos} tipoActual={tipoActual} familias={familias} nombres={nombres} />
    </div>
  );
}
