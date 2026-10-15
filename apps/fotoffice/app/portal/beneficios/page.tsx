import { redirect } from "next/navigation";
import { Gift } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { SPONSORS_MODULE_KEY } from "@/lib/sponsors/constants";
import { loadPortalBenefits } from "@/lib/sponsors/benefits-server";
import { SponsorLogo } from "@/components/sponsors/sponsor-logo";

export const dynamic = "force-dynamic";

/**
 * Los convenios de la institución, todos juntos.
 *
 * Sale de los sponsors vinculados que tienen cargado su beneficio (ver `lib/sponsors/benefits.ts`).
 * La institución no tiene que armar nada aparte: lo que carga en la ficha del sponsor, o lo que
 * carga la marca desde su enlace, aparece acá.
 */
export default async function PortalBeneficiosPage() {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");
  if (!(await isModuleEnabledForWorkspace(context.workspace.id, SPONSORS_MODULE_KEY))) {
    redirect("/portal");
  }

  const beneficios = await loadPortalBenefits(context.workspace.id);

  return (
    <div className="space-y-8">
      <header className="fo-card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
          <Gift className="size-7" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-semibold">Beneficios</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--fo-muted)]">
            Descuentos y convenios que las marcas aliadas ofrecen a los socios de {context.workspace.name}. Para
            usarlos, mostrá tu carnet: desde «Mi carnet» se comprueba que sos socio y que estás al día.
          </p>
        </div>
      </header>

      {!beneficios.ok ? (
        <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">
          No pudimos cargar los beneficios en este momento. Probá de nuevo en un rato.
        </p>
      ) : beneficios.items.length === 0 ? (
        <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">
          Por ahora no hay beneficios cargados. Cuando la institución sume un convenio, va a aparecer acá.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {beneficios.items.map((b) => (
            <li key={b.partnerId} className="fo-card flex h-full flex-col gap-4 p-5">
              <div className="flex items-center gap-4">
                <SponsorLogo name={b.name} src={b.logoSrc} className="size-14" />
                <p className="min-w-0 font-medium">{b.name}</p>
              </div>
              {b.title ? <p className="text-lg font-semibold leading-snug">{b.title}</p> : null}
              {b.description ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--fo-text-secondary)]">
                  {b.description}
                </p>
              ) : null}
              {b.href ? (
                <a
                  href={b.href}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="fo-btn fo-btn-secondary mt-auto self-start text-sm"
                >
                  Ver la marca
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
