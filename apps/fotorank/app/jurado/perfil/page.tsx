import { requireJudgeAuth } from "../../lib/judge-auth";
import { prisma } from "@repo/db";
import { JuradoPerfilProfesionalForm } from "./JuradoPerfilProfesionalForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function JuradoPerfilProfesionalPage() {
  const judge = await requireJudgeAuth();
  const profile = await prisma.fotorankJudgeProfile.findUnique({
    where: { judgeAccountId: judge.id },
  });
  if (!profile) {
    return (
      <div className="min-h-screen bg-fr-bg p-8 text-fr-primary">
        <p className="text-sm text-fr-muted">No se encontró perfil.</p>
        <Link href="/jurado/panel" className="fr-btn fr-btn-secondary mt-6 inline-flex">
          Volver al panel
        </Link>
      </div>
    );
  }

  const specialtiesText = Array.isArray(profile.specialtiesJson)
    ? (profile.specialtiesJson as string[]).join(", ")
    : "";
  const languagesText = Array.isArray(profile.languagesJson)
    ? (profile.languagesJson as string[]).join(", ")
    : "";

  return (
    <div className="min-h-screen bg-fr-bg px-4 py-10 text-fr-primary md:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-sans text-2xl font-semibold tracking-tight">Perfil profesional</h1>
            <p className="mt-2 text-sm text-fr-muted">
              Directorio opt-in: solo los organizadores ven tu ficha si activás la visibilidad pública.
            </p>
          </div>
          <Link href="/jurado/panel" className="fr-btn fr-btn-secondary text-sm self-start">
            Volver al panel
          </Link>
        </div>

        <JuradoPerfilProfesionalForm
          initial={{
            displayNameOverride: profile.displayNameOverride,
            professionalHeadline: profile.professionalHeadline,
            shortBio: profile.shortBio,
            specialtiesText,
            experienceYears: profile.experienceYears,
            languagesText,
            region: profile.region,
            city: profile.city,
            country: profile.country,
            portfolioUrl: profile.portfolioUrl,
            isAvailableForJuryWork: profile.isAvailableForJuryWork,
            availabilityNotes: profile.availabilityNotes,
            availableRemote: profile.availableRemote,
            availableInPerson: profile.availableInPerson,
            preferredContestScopes: profile.preferredContestScopes,
            compensationMode: profile.compensationMode,
            pricingMode: profile.pricingMode,
            priceAmount: profile.priceAmount,
            priceCurrency: profile.priceCurrency,
            priceNotes: profile.priceNotes,
            priceUnit: profile.priceUnit,
            isListedInProfessionalDirectory: profile.isListedInProfessionalDirectory,
            showPricingPublicly: profile.showPricingPublicly,
            showLocationPublicly: profile.showLocationPublicly,
            showWebsitePublicly: profile.showWebsitePublicly,
            showInstagramPublicly: profile.showInstagramPublicly,
          }}
        />
      </div>
    </div>
  );
}
