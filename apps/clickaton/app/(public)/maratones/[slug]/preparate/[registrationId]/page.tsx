import type { Metadata } from "next";

import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { CameraGpsInstructions } from "@/components/readiness/CameraGpsInstructions";
import { LocationPermissionCard } from "@/components/readiness/LocationPermissionCard";
import { ReadinessCheckCard } from "@/components/readiness/ReadinessCheckCard";
import { Button } from "@/components/ui/Button";
import { marathonPath, routes } from "@/config/navigation";
import { prisma, withClickatonDb } from "@/lib/admin/db";
import { verifyRegistrationAccessToken } from "@/lib/public-registration/domain/access-token";
import { readinessCopy } from "@/lib/readiness/content/readiness-copy";
import type { ReadinessResult } from "@/lib/readiness/domain/readiness";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; registrationId: string }>;
  searchParams: Promise<{ t?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPageMetadata({
    title: readinessCopy.title,
    description: readinessCopy.intro,
    path: `/maratones/${slug}/preparate`,
    noIndex: true,
  });
}

/**
 * La pantalla de "acá no hay chequeo", con las dos salidas de siempre.
 *
 * El enlace llega por mail meses antes del evento (`READINESS_TOKEN_TTL_MS`),
 * así que cuando vence no corresponde un 404 pelado: hay que explicar qué
 * pasó y ofrecer una salida real. El motivo lo pone quien la usa, porque no
 * es lo mismo "venció tu enlace" que "la base no respondió": lo segundo no
 * es culpa del participante y decirle que venció sería mentirle.
 */
function SinChequeo({
  slug,
  title,
  whatToDo,
}: {
  slug: string;
  title: string;
  whatToDo: string;
}) {
  return (
    <Section>
      <Container className="space-y-6 py-12">
        <h1 className="ck-display-md">{title}</h1>
        <p className="max-w-2xl text-ck-text-secondary leading-relaxed">{whatToDo}</p>
        <div className="flex flex-wrap gap-3">
          <Button href={routes.account} variant="primary" className="min-h-11">
            {readinessCopy.expiredLink.goToAccountLabel}
          </Button>
          <Button href={marathonPath(slug)} variant="secondary" className="min-h-11">
            {readinessCopy.expiredLink.backToEditionLabel}
          </Button>
        </div>
      </Container>
    </Section>
  );
}

export default async function ReadinessCheckPage({ params, searchParams }: Props) {
  const { slug, registrationId } = await params;
  const { t: accessToken } = await searchParams;

  // El propósito va explícito acá también (y en la server action): sin
  // `purpose: "readiness"`, la verificación por default cae en "summary" y un
  // enlace filtrado del resumen de la inscripción abriría este chequeo.
  const verification = verifyRegistrationAccessToken({
    registrationId,
    editionSlug: slug,
    token: accessToken,
    purpose: "readiness",
  });

  if (!verification.ok || !accessToken) {
    return (
      <SinChequeo
        slug={slug}
        title={readinessCopy.expiredLink.title}
        whatToDo={readinessCopy.expiredLink.whatToDo}
      />
    );
  }

  // Ninguna de las dos migraciones de esta etapa está aplicada todavía, y el
  // mail ya reparte este enlace desde el primer despliegue. Sin este
  // envoltorio, `clickatonReadinessCheck` ausente (P2021) o
  // `locationConsentAt` ausente (P2022) revientan la página entera en la cara
  // del participante. `withClickatonDb` ya sabe reconocer las dos cosas.
  const datos = await withClickatonDb(async () => {
    const registration = await prisma.clickatonRegistration.findUnique({
      where: { id: registrationId },
      select: {
        locationConsentAt: true,
        edition: {
          select: {
            slug: true,
            name: true,
            timezone: true,
          },
        },
      },
    });

    if (!registration || registration.edition.slug !== slug) return null;

    const lastCheck = await prisma.clickatonReadinessCheck.findFirst({
      where: { registrationId },
      orderBy: { checkedAt: "desc" },
      select: { result: true, clockDeltaMinutes: true },
    });

    return { registration, lastCheck };
  });

  if (!datos.ok) {
    return (
      <SinChequeo
        slug={slug}
        title={readinessCopy.unavailable.title}
        whatToDo={readinessCopy.unavailable.whatToDo}
      />
    );
  }

  if (!datos.data) {
    return (
      <SinChequeo
        slug={slug}
        title={readinessCopy.expiredLink.title}
        whatToDo={readinessCopy.expiredLink.whatToDo}
      />
    );
  }

  const { registration, lastCheck } = datos.data;

  return (
    <Section>
      <SimpleBreadcrumb
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Maratones", href: routes.marathons },
          { label: registration.edition.name, href: marathonPath(slug) },
          { label: "Preparate" },
        ]}
      />
      <Container className="space-y-8 py-10 md:py-14">
        <header className="space-y-3">
          <p className="ck-label text-ck-yellow">Preparate</p>
          <h1 className="ck-display-md">{readinessCopy.title}</h1>
          <p className="max-w-2xl text-ck-text-secondary leading-relaxed">
            {readinessCopy.intro}
          </p>
        </header>

        <CameraGpsInstructions />

        <ReadinessCheckCard
          registrationId={registrationId}
          editionSlug={slug}
          accessToken={accessToken}
          editionTimeZone={registration.edition.timezone ?? "America/Argentina/Cordoba"}
          initialVerdict={
            lastCheck
              ? {
                  result: lastCheck.result as ReadinessResult,
                  clockDeltaMinutes: lastCheck.clockDeltaMinutes,
                }
              : null
          }
        />

        <LocationPermissionCard
          registrationId={registrationId}
          locationConsentAt={registration.locationConsentAt}
        />
      </Container>
    </Section>
  );
}
