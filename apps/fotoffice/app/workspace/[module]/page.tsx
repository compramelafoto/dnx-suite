import Link from "next/link";

const LABELS: Record<string, string> = {
  clientes: "Clientes",
  trabajos: "Trabajos / eventos",
  presupuestos: "Presupuestos",
  agenda: "Agenda",
  finanzas: "Finanzas",
  equipo: "Equipo",
};

export default async function WorkspaceModuleStubPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const label = LABELS[module] ?? "Módulo";

  return (
    <div className="fo-card space-y-4 max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--fo-text)]">{label}</h1>
      <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
        Este módulo todavía no está implementado. La navegación queda lista para etapas
        siguientes.
      </p>
      <Link href="/workspace" className="fo-btn fo-btn-secondary inline-flex w-fit">
        Volver al inicio
      </Link>
    </div>
  );
}
