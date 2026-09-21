import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@repo/db";

import { requireAuth } from "../../../lib/auth";
import { userIsFotorankSuperAdmin } from "../../../lib/fotorank/access/super-admin";
import { judgeAvatarSrc } from "../../../lib/fotorank/judges/judgeAvatarSrc";
import { ColaDeRevisionClient, type FichaPendiente } from "./ColaDeRevisionClient";

export const dynamic = "force-dynamic";

const ORIGEN: Record<string, string> = {
  PUBLIC_SIGNUP: "se postuló solo",
  ORGANIZER_INVITATION: "lo invitó un organizador",
  ORGANIZER_CREATED: "lo cargó un organizador",
};

function lista(json: unknown): string[] {
  return Array.isArray(json) ? (json as string[]) : [];
}

export default async function ColaDeJuradosPage() {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) redirect("/mi-actividad");

  const perfiles = await prisma.fotorankJudgeProfile.findMany({
    where: {
      directoryReviewStatus: "PENDING",
      judgeAccount: { emailVerifiedAt: { not: null } },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      professionalHeadline: true,
      shortBio: true,
      specialtiesJson: true,
      experienceYears: true,
      city: true,
      country: true,
      avatarUrl: true,
      website: true,
      instagram: true,
      portfolioUrl: true,
      wantsDirectoryListing: true,
      signupSource: true,
      createdAt: true,
      judgeAccount: { select: { id: true, email: true } },
    },
  });

  const esperandoElCorreo = await prisma.fotorankJudgeProfile.count({
    where: {
      directoryReviewStatus: "PENDING",
      judgeAccount: { emailVerifiedAt: null },
      signupSource: "PUBLIC_SIGNUP",
    },
  });

  const fichas: FichaPendiente[] = perfiles.map((p) => ({
    judgeProfileId: p.id,
    judgeAccountId: p.judgeAccount.id,
    nombre: `${p.firstName} ${p.lastName}`.trim(),
    email: p.judgeAccount.email,
    titular: p.professionalHeadline,
    bio: p.shortBio,
    especialidades: lista(p.specialtiesJson),
    aniosDeExperiencia: p.experienceYears,
    lugar: [p.city, p.country].filter(Boolean).join(", "),
    avatarSrc: judgeAvatarSrc({ id: p.id, avatarUrl: p.avatarUrl }),
    website: p.website,
    instagram: p.instagram,
    portfolioUrl: p.portfolioUrl,
    quiereEstarEnElDirectorio: p.wantsDirectoryListing,
    origen: ORIGEN[p.signupSource] ?? "sin indicar",
    sePostuloEl: p.createdAt.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <header className="space-y-3">
        <Link href="/super-admin" className="text-sm text-fr-muted underline underline-offset-2">
          ← Volver a Super Admin
        </Link>
        <h1 className="font-sans text-3xl font-semibold tracking-tight">Jurados por revisar</h1>
        <p className="text-sm text-fr-muted">
          El directorio es común a todos los organizadores de FotoRank. Aprobar una ficha la
          publica para toda la plataforma.
        </p>
        {esperandoElCorreo > 0 ? (
          <p className="text-sm text-fr-muted">
            Además hay {esperandoElCorreo}{" "}
            {esperandoElCorreo === 1 ? "postulación que todavía no confirmó" : "postulaciones que todavía no confirmaron"}{" "}
            el correo. No se pueden revisar hasta que lo hagan.
          </p>
        ) : null}
      </header>

      <ColaDeRevisionClient fichas={fichas} />
    </div>
  );
}
