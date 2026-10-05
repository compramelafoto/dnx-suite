import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { ProfileTabs } from "@/components/portal/profile-tabs";
import { AboutMeForm } from "@/components/portal/about-me-form";
import { loadAboutMeScreen } from "@/lib/spotlight/about-store";

export const metadata = { title: "Más sobre mí" };
export const dynamic = "force-dynamic";

/**
 * «Más sobre mí»: lo que el socio cuenta para que los colegas lo conozcan cuando sea el Socio de
 * la semana. Todo opcional.
 */
export default async function SobreMiPage() {
  const user = await requireAuth();
  const pantalla = await loadAboutMeScreen(user.id);
  if (!pantalla) redirect("/portal");

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Mi perfil</h1>
        <p className="text-sm text-[var(--fo-muted)]">
          Contale a tus colegas quién sos. Se muestra cuando te toca ser el Socio de la semana.
        </p>
      </header>
      <ProfileTabs active="sobre-mi" />
      <AboutMeForm
        about={pantalla.about}
        phone={pantalla.phone}
        institution={pantalla.institution}
        portfolioPhotos={pantalla.portfolioPhotos}
      />
    </div>
  );
}
