import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { findClaimableMembership } from "@/lib/portal/claim";
import { ClaimMembershipForm } from "@/components/portal/claim-membership-form";

export const dynamic = "force-dynamic";

/**
 * "Ya sos socio de esta institución."
 *
 * A quien tiene cuenta por otra aplicación del ecosistema y además figura en el padrón, se le
 * ofrece unir las dos cosas en vez de tratarlo como alguien que recién llega. Antes caía en el
 * alta de un negocio propio, que es lo contrario de lo que necesita.
 */
export default async function SoySocioPage() {
  const user = await requireAuth();
  const candidato = await findClaimableMembership({ userId: user.id, email: user.email });
  if (!candidato) redirect("/portal");

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-md px-4 py-16">
        <section className="fo-card space-y-5 p-6">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">Te encontramos en el padrón</h1>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Figurás como socio de <strong>{candidato.workspaceName}</strong> con este mismo
              email. Si sos vos, unimos tu cuenta a tu ficha y entrás a tu portal.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--fo-border)] p-4 text-sm">
            <p className="font-medium">
              {candidato.firstName} {candidato.lastName}
            </p>
            <p className="text-xs text-[var(--fo-muted)]">
              Socio N° <span className="tabular-nums">{candidato.memberNumber}</span>
            </p>
          </div>

          <ClaimMembershipForm memberId={candidato.memberId} />

          <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
            Si no sos vos, no confirmes y escribile a la Secretaría: puede haber un email
            repetido en el padrón.
          </p>
        </section>
      </main>
    </div>
  );
}
