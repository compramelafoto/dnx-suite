import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { verifyRegistrationAccessToken } from "@/lib/public-registration/domain/access-token";
import { maskEmail } from "@/lib/public-registration/domain/pii";
import {
  ensurePostConfirmActivation,
  resolveActivationFlags,
} from "@/lib/registration/application/post-confirm-activation";
import { ActivateAccountClient } from "./ActivateAccountClient";

type Props = {
  params: Promise<{ slug: string; registrationId: string }>;
  searchParams: Promise<{ t?: string }>;
};

function appBaseUrl(): string {
  return (
    process.env.CLICKATON_PUBLIC_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3005"
  );
}

export default async function ActivateRegistrationAccountPage({ params, searchParams }: Props) {
  const { slug, registrationId } = await params;
  const { t: accessToken } = await searchParams;
  if (!accessToken) notFound();

  const token = verifyRegistrationAccessToken({
    registrationId,
    editionSlug: slug,
    token: accessToken,
  });
  if (!token.ok) notFound();

  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: {
      status: true,
      email: true,
      edition: { select: { slug: true } },
    },
  });
  if (!reg || reg.edition.slug !== slug || reg.status !== "CONFIRMED") {
    notFound();
  }

  await ensurePostConfirmActivation({
    registrationId,
    appBaseUrl: appBaseUrl(),
  });

  const flags = await resolveActivationFlags(registrationId);
  const nextPath = `/mi-cuenta/inscripciones/${registrationId}`;
  const googleHref = `/api/auth/google?next=${encodeURIComponent(nextPath)}`;
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;
  const recoverHref = `/recuperar?email=${encodeURIComponent(reg.email)}`;

  return (
    <Section>
      <Container className="py-12 md:py-16">
        <ActivateAccountClient
          editionSlug={slug}
          registrationId={registrationId}
          accessToken={accessToken}
          emailMasked={maskEmail(reg.email)}
          googleHref={googleHref}
          loginHref={loginHref}
          recoverHref={recoverHref}
          dashboardHref={nextPath}
          activationRequired={flags.activationRequired}
          existingUserWithCredentials={flags.existingUserWithCredentials}
        />
      </Container>
    </Section>
  );
}
