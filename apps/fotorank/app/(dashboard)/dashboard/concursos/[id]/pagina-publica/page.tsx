import { notFound, redirect } from "next/navigation";
import { PageContainer } from "../../../../../components/PageContainer";
import { requireAuth } from "../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../lib/fotorank/registration";
import {
  DEFAULT_CONTEST_VISUAL_THEME,
  isSantaFeEnFocoSlug,
  parsePublicPageVisualJson,
  SANTA_FE_EN_FOCO_VISUAL_THEME,
} from "../../../../../lib/fotorank/contest-visual";
import { prisma } from "@repo/db";
import { PublicPageVisualForm } from "./PublicPageVisualForm";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ContestPublicPageVisualPage({ params }: Props) {
  const user = await requireAuth();
  const { id: contestId } = await params;

  try {
    await assertOrganizerCanAccessContest(contestId, user.id);
  } catch (err) {
    if (err instanceof RegistrationError && err.code === "FORBIDDEN") redirect("/dashboard");
    if (err instanceof RegistrationError && err.code === "CONTEST_NOT_FOUND") notFound();
    throw err;
  }

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: {
      id: true,
      title: true,
      slug: true,
      coverImageUrl: true,
      publicPageVisualJson: true,
    },
  });
  if (!contest) notFound();

  const preset = isSantaFeEnFocoSlug(contest.slug)
    ? SANTA_FE_EN_FOCO_VISUAL_THEME
    : DEFAULT_CONTEST_VISUAL_THEME;

  return (
    <PageContainer>
      <PublicPageVisualForm
        contestId={contest.id}
        contestTitle={contest.title}
        contestSlug={contest.slug}
        initialConfig={parsePublicPageVisualJson(contest.publicPageVisualJson)}
        coverImageUrl={contest.coverImageUrl}
        defaultColors={{
          primaryColor: preset.primaryColor,
          accentColor: preset.focusColor,
          backgroundColor: preset.backgroundColor,
          foregroundColor: preset.foregroundColor,
        }}
      />
    </PageContainer>
  );
}
