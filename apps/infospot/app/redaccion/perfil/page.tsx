import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@repo/db";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { EditorialProfileForm } from "@/components/redaccion/editorial-profile-form";
import { requireInfoSpotRedaccionAccess } from "@/lib/infospot-access";

export const metadata: Metadata = {
  title: "Mi perfil",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ ok?: string }>;
};

export default async function RedaccionPerfilPage({ searchParams }: Props) {
  const access = await requireInfoSpotRedaccionAccess();
  const params = await searchParams;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: access.user.id },
    select: {
      name: true,
      email: true,
      bio: true,
      city: true,
      province: true,
      website: true,
      instagram: true,
      facebook: true,
      tiktok: true,
      whatsapp: true,
      logoUrl: true,
    },
  });

  return (
    <RedaccionShell
      title="Mi perfil"
      description="Estos datos alimentan tu firma en las notas y tu ficha pública de autor."
      actions={
        <Link
          href={`/autores/${access.user.id}`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--is-accent)] underline-offset-2 hover:underline"
        >
          Ver ficha pública
        </Link>
      }
    >
      <FlashBanner ok={params.ok === "1" ? "Perfil guardado." : undefined} />
      <div className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white p-6 sm:p-8">
        <EditorialProfileForm
          initialValues={{
            name: user.name?.trim() || "",
            email: user.email,
            bio: user.bio?.trim() || "",
            city: user.city?.trim() || "",
            province: user.province?.trim() || "",
            website: user.website?.trim() || "",
            instagram: user.instagram?.trim() || "",
            facebook: user.facebook?.trim() || "",
            tiktok: user.tiktok?.trim() || "",
            whatsapp: user.whatsapp?.trim() || "",
            logoUrl: user.logoUrl?.trim() || null,
          }}
        />
      </div>
    </RedaccionShell>
  );
}
