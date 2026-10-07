import type { Metadata } from "next";
import { SponsorLogo } from "@/components/sponsors/sponsor-logo";
import { findSelfSignup } from "@/lib/sponsors/self-signup";
import { AutoaltaForm } from "./autoalta-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Datos de tu marca",
  // Un enlace privado no se indexa. Es una credencial, no una página.
  robots: { index: false, follow: false },
};

/**
 * Donde el sponsor carga sus datos, sin cuenta: el token del enlace es la credencial.
 *
 * Un enlace inexistente, vencido o ya usado muestran el MISMO mensaje.
 */
export default async function AutoaltaSponsorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const vista = await findSelfSignup(token).catch((error) => {
    console.error("[fotoffice][sponsors] autoalta: no se pudo leer el enlace", {
      detalle: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  if (!vista) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-[var(--fo-bg)] px-5 py-12 text-[var(--fo-text)]">
        <div className="fo-card space-y-2 p-6 text-center">
          <p className="text-base font-semibold">Este enlace ya no está disponible</p>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            Puede haber vencido o ya se usó. Pedile uno nuevo a la institución que te lo mandó.
          </p>
        </div>
      </main>
    );
  }

  const { institution, current } = vista;

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
        <header className="space-y-3">
          {institution.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo de la institución, ya optimizado
            <img src={institution.logoUrl} alt={institution.name} className="h-12 w-auto object-contain" />
          ) : null}
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">{institution.name}</p>
            <h1 className="text-xl font-semibold tracking-tight">Los datos de tu marca</h1>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              Gracias por acompañar a {institution.name}. Completá lo que quieras que vean los socios: tu logo, tus
              redes y, si ofrecés uno, el beneficio para ellos. Te lleva un par de minutos.
            </p>
          </div>
        </header>

        <div className="flex items-center gap-3">
          <SponsorLogo name={current.name} src={current.logoSrc} className="size-14" />
          <p className="text-sm text-[var(--fo-muted)]">
            {current.logoSrc ? "Este es el logo que tenemos. Si querés, subí otro." : "Todavía no tenemos tu logo."}
          </p>
        </div>

        <AutoaltaForm token={token} institucion={institution.name} actual={current} />
      </main>
    </div>
  );
}
