import Link from "next/link";
import { requirePortalGovernance } from "@/lib/governance/portal-access";
import { ProposalForm } from "@/components/governance/proposal-form";

export const dynamic = "force-dynamic";

export default async function ProponerPage() {
  await requirePortalGovernance();
  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/portal/proyectos" className="text-sm text-[var(--fo-muted)] hover:underline">
        ← Mis proyectos
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Proponer un proyecto</h1>
        <p className="text-sm text-[var(--fo-muted)]">
          Llega a la comisión directiva. Si la acepta, entra al temario de la próxima reunión; si no, te cuenta por qué.
        </p>
      </header>
      <ProposalForm />
    </div>
  );
}
