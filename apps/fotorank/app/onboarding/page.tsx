import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { requireAuth } from "../lib/auth";
import { bootstrapFotorankProfile } from "../lib/fotorank/profile";
import { getUserOrganizations } from "../lib/fotorank/organizations";
import { CreateOrganizationForm } from "./CreateOrganizationForm";

export default async function OnboardingPage() {
  const user = await requireAuth();
  await bootstrapFotorankProfile(user);

  const orgs = await getUserOrganizations(user.id);
  if (orgs.length > 0) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-fr-bg font-sans">
      <header className="border-b border-[#1a1a1a] bg-[#050505]/90 py-4 backdrop-blur-md">
        <div className="fr-container-wide mx-auto flex items-center justify-between px-8">
          <Link href="/" className="flex items-center" aria-label="FotoRank">
            <Image
              src="/fotorank-logo.png"
              alt="FotoRank"
              width={288}
              height={96}
              className="h-20 w-auto md:h-24"
            />
          </Link>
        </div>
      </header>

      <main className="fr-container-narrow mx-auto py-16 md:py-24">
        <div className="fr-title-to-content mb-12">
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-fr-primary md:text-4xl">
            Creá tu organización
          </h1>
          <p className="mt-4 fr-body leading-relaxed text-fr-muted">
            Para organizar concursos en FotoRank necesitás una organización: asociación, escuela, comunidad o institución.
          </p>
        </div>

        <div className="fr-form-window max-w-2xl rounded-xl border border-[#262626] bg-[#141414] p-8 md:p-10">
          <CreateOrganizationForm />
        </div>
      </main>
    </div>
  );
}
