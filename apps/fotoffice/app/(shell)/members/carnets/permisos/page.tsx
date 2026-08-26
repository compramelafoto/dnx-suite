import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { listOperatorCandidates } from "@/lib/carnet/operator-admin";
import { OperatorRow } from "./operator-row";

export const dynamic = "force-dynamic";

/**
 * Quién puede operar los carnets.
 *
 * Dos permisos separados porque son dos trabajos distintos: el impresor imprime y no
 * entrega; quien atiende el mostrador entrega y no imprime.
 */
export default async function PermisosCarnetsPage() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const puede = await canManageWorkspaceCollection(user.id, workspace.id);
  if (!puede) redirect("/members/carnets");

  const gente = await listOperatorCandidates(workspace.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Permisos de carnets"
        description="Quién puede mandar a imprimir y quién puede entregar."
      />

      <Link href="/members/carnets" className="text-xs text-[var(--fo-muted)] hover:underline">
        ← Volver al tablero
      </Link>

      <section className="fo-card divide-y divide-[var(--fo-border)] p-0">
        {gente.map((persona) => (
          <div
            key={persona.userId}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{persona.label}</p>
              {persona.email ? (
                <p className="text-xs text-[var(--fo-muted-soft)]">{persona.email}</p>
              ) : null}
            </div>
            {persona.isAdmin ? (
              <p className="text-xs text-[var(--fo-muted)]">
                {/* No se le ofrecen casillas: quitárselas no le sacaría nada, porque puede
                    todo por su rol, y mostrarlas desmarcadas haría creer lo contrario. */}
                Administra la institución: puede todo
              </p>
            ) : (
              <OperatorRow
                userId={persona.userId}
                canProduce={persona.canProduce}
                canDeliver={persona.canDeliver}
              />
            )}
          </div>
        ))}
      </section>

      <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
        Solo aparece gente que ya pertenece a la institución. Si el impresor es de afuera,
        todavía no hay forma de sumarlo: un permiso para alguien que no puede entrar al panel
        quedaría escrito y sin efecto.
      </p>
    </div>
  );
}
