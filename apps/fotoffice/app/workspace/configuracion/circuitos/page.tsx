import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { leerConfiguracion } from "@/lib/circuitos/configuracion";
import { asegurarCircuitos } from "@/lib/circuitos/semillas/asegurar";
import { prisma } from "@repo/db";
import { CircuitosLista } from "./circuitos-lista";
import { EditorEtapas } from "./editor-etapas";
import { Motivos } from "./motivos";

export const dynamic = "force-dynamic";

export default async function ConfiguracionCircuitosPage({
  searchParams,
}: {
  searchParams: Promise<{ circuito?: string }>;
}) {
  const { workspace, role } = await requireActiveWorkspaceRole();

  // El permiso va antes que cualquier lectura de circuitos.
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Circuitos" />
        <p className="text-sm text-[var(--fo-muted)]">
          Sólo el dueño o un administrador pueden cambiar los circuitos, sus etapas y los motivos de pérdida.
        </p>
      </div>
    );
  }

  // Un workspace que todavía no tiene circuitos arranca con los iniciales.
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: { publicSlug: true },
  });
  await asegurarCircuitos(workspace.id, branding?.publicSlug ?? "");
  const conf = await leerConfiguracion({ workspaceId: workspace.id, role });
  if (!conf) return null;

  const { circuito: pedido } = await searchParams;
  const elegido =
    conf.circuitos.find((c) => c.id === pedido) ??
    conf.circuitos.find((c) => c.kind === "VENTA" && c.isDefault) ??
    conf.circuitos[0] ??
    null;

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        title="Circuitos"
        description="Las etapas por las que pasa cada consulta o trabajo, sus vencimientos, las tareas que se crean solas y los motivos para cerrar como perdido."
      />
      <CircuitosLista circuitos={conf.circuitos} elegidoId={elegido?.id ?? null} />
      {elegido ? <EditorEtapas key={elegido.id} circuito={elegido} /> : null}
      <Motivos motivos={conf.motivos} />
    </div>
  );
}
