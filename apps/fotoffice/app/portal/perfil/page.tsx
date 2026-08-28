import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";

export const metadata = { title: "Mi perfil profesional" };

/**
 * El socio edita su presencia profesional.
 *
 * Se resuelve la misma ficha que muestra el portal (la más antigua): quien sea socio de dos
 * instituciones edita la que está viendo, no todas a la vez.
 */
export default async function PerfilProfesionalPage() {
  const user = await requireAuth();

  const socio = await prisma.member.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: {
      businessName: true,
      bio: true,
      specialties: true,
      website: true,
      instagram: true,
      tiktok: true,
      facebook: true,
      youtube: true,
      linkedin: true,
      directoryOptIn: true,
      workspace: { select: { name: true } },
    },
  });
  if (!socio) redirect("/portal");

  const { ProfessionalProfileForm } = await import(
    "@/components/portal/professional-profile-form"
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 space-y-1">
        <h1 className="text-xl font-semibold">Mi perfil profesional</h1>
        <p className="text-sm text-[var(--fo-muted)]">
          Estos datos son tuyos. Se publican solo si lo autorizás.
        </p>
      </header>
      <ProfessionalProfileForm
        institutionName={socio.workspace.name}
        defaults={{
          businessName: socio.businessName,
          bio: socio.bio,
          specialties: socio.specialties,
          website: socio.website,
          instagram: socio.instagram,
          tiktok: socio.tiktok,
          facebook: socio.facebook,
          youtube: socio.youtube,
          linkedin: socio.linkedin,
          directoryOptIn: socio.directoryOptIn,
        }}
      />
    </div>
  );
}
