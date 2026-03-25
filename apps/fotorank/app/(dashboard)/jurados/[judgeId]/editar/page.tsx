import { notFound } from "next/navigation";
import { getJudgeByIdForOrg } from "../../../../actions/judges";
import { EditJudgePageClient } from "./EditJudgePageClient";

export default async function EditJudgePage({ params }: { params: Promise<{ judgeId: string }> }) {
  const { judgeId } = await params;
  const result = await getJudgeByIdForOrg(judgeId);
  if (!result.ok || !result.data) return notFound();

  const data = result.data as {
    email: string;
    profile: {
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      avatarUrl?: string | null;
      shortBio?: string | null;
      fullBioRichJson?: unknown;
      city?: string | null;
      country?: string | null;
      website?: string | null;
      instagram?: string | null;
      otherLinksJson?: unknown;
      isPublic?: boolean | null;
    } | null;
  };

  const profile = data.profile;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-fr-primary">Editar jurado</h1>
      <EditJudgePageClient
        judgeId={judgeId}
        initial={{
          email: String(data.email),
          firstName: String(profile?.firstName ?? ""),
          lastName: String(profile?.lastName ?? ""),
          phone: profile?.phone ?? "",
          avatarUrl: profile?.avatarUrl ?? "",
          shortBio: profile?.shortBio ?? "",
          city: profile?.city ?? "",
          country: profile?.country ?? "",
          website: profile?.website ?? "",
          instagram: profile?.instagram ?? "",
          isPublic: Boolean(profile?.isPublic ?? true),
        }}
        initialFullBioRichJson={profile?.fullBioRichJson ?? null}
        initialOtherLinksJson={profile?.otherLinksJson ?? null}
      />
    </div>
  );
}
