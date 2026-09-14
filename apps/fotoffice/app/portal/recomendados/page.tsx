import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { getDuesSettings } from "@/lib/membership/settings";
import { ensureRecommendationCode } from "@/lib/membership/recommendation-store";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { chargePeriodLabel } from "@/lib/membership/charge-labels";
import { recommendationBenefitPhrase } from "@/lib/membership/recommendation-labels";
import { appUrl } from "@/lib/app-url";
import { RecommendationLinkCard } from "@/components/portal/recommendation-link-card";

export const dynamic = "force-dynamic";

/** `2026-09` → `septiembre de 2026`. Los períodos reservados vuelven tal cual. */
function fechaCorta(d: Date): string {
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Las recomendaciones del socio.
 *
 * Tres cosas y ninguna más: su enlace, quiénes se asociaron por él, y qué cuota le bonificó
 * cada uno. No hay saldo, ni puntos, ni nada que se parezca a dinero — el beneficio empieza
 * y termina en la cuota.
 */
export default async function RecomendadosPage() {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");

  const settings = await getDuesSettings(context.workspace.id);
  // Con el módulo apagado esta pantalla no existe: el menú ya la muestra como "Próximamente",
  // y quien llegue por la URL escrita a mano vuelve al inicio sin ver una promesa vacía.
  if (!settings.recommendationEnabled) redirect("/portal");

  const [branding, code, recomendados, bonificaciones] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: context.workspace.id },
      select: { publicSlug: true, commercialName: true },
    }),
    ensureRecommendationCode(context.member.id),
    prisma.member.findMany({
      where: { recommendedByMemberId: context.member.id },
      select: { id: true, firstName: true, lastName: true, memberNumber: true, joinedAt: true },
      orderBy: { joinedAt: "desc" },
    }),
    prisma.membershipRecommendationBenefit.findMany({
      where: { memberId: context.member.id },
      select: {
        id: true,
        status: true,
        appliedAmountArs: true,
        appliedCharge: { select: { period: true } },
        originMember: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const institution = branding?.commercialName?.trim() || context.workspace.name;
  const base = appUrl();
  const enlace =
    base && branding?.publicSlug ? `${base}/w/${branding.publicSlug}/asociarse?rec=${code}` : null;

  const beneficio = recommendationBenefitPhrase(settings.recommendationBenefitPercent);

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <div className="space-y-1">
          <Link href="/portal" className="text-xs text-[var(--fo-muted)] hover:underline">
            ← Volver
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Recomendá a un colega</h1>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Por cada colega que se asocie con tu enlace y termine de pagar su ingreso, ganás{" "}
            {beneficio}.
          </p>
        </div>

        {enlace ? (
          <RecommendationLinkCard url={enlace} institution={institution} />
        ) : (
          <section className="fo-card space-y-2 p-5">
            <h2 className="text-sm font-semibold">Tu enlace todavía no está disponible</h2>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              {institution} todavía no tiene publicado su formulario de asociación. Escribile a
              la Secretaría y te lo habilitan.
            </p>
          </section>
        )}

        <section className="fo-card space-y-3 p-5">
          <h2 className="text-sm font-semibold">Se asociaron gracias a vos</h2>
          {recomendados.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Todavía nadie. Cuando alguien se asocie con tu enlace, lo vas a ver acá.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--fo-border)]">
              {recomendados.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <p className="text-sm">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-xs text-[var(--fo-muted-soft)] tabular-nums">
                    Socio N° {r.memberNumber} · {fechaCorta(r.joinedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {bonificaciones.length > 0 ? (
          <section className="fo-card space-y-3 p-5">
            <h2 className="text-sm font-semibold">Tus cuotas bonificadas</h2>
            <ul className="divide-y divide-[var(--fo-border)]">
              {bonificaciones.map((b) => (
                <li key={b.id} className="space-y-0.5 py-2.5">
                  <p className="text-sm">
                    Por {b.originMember.firstName} {b.originMember.lastName}
                  </p>
                  <p className="text-xs text-[var(--fo-muted-soft)]">
                    {b.status === "PENDIENTE"
                      ? "Se aplica sola sobre tu próxima cuota."
                      : b.status === "ANULADA"
                        ? "Anulada por la Secretaría."
                        : `Aplicada a la cuota de ${chargePeriodLabel(
                            b.appliedCharge?.period ?? "",
                          )} · −${formatMinorArs(decimalArsToMinor(b.appliedAmountArs ?? 0))}`}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
