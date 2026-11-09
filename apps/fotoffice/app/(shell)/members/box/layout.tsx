import { requireMembersManageContext } from "@/lib/members/access";
import { PageHeader } from "@/components/page-header";
import { PestanasBox } from "@/components/box-mensual/pestanas";

/**
 * BOX mensual: a quién le toca qué caja, qué hay que preparar, qué se envió y el catálogo.
 * Sólo para quien gestiona Socios (el layout de `/members` ya exige el módulo encendido).
 */
export default async function BoxLayout({ children }: { children: React.ReactNode }) {
  await requireMembersManageContext();
  return (
    <div className="space-y-8">
      <PageHeader
        title="BOX mensual"
        description="Cada persona socia recibe una caja por cada mes pagado, en orden desde la BOX N°1. Acá ves a quién le toca qué caja, qué hay que preparar y qué ya se envió."
      />
      <PestanasBox />
      {children}
    </div>
  );
}
