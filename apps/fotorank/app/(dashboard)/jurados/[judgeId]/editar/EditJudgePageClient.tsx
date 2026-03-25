"use client";

import { useRouter } from "next/navigation";
import { updateJudgeProfileByAdmin } from "../../../../actions/judges";
import { JudgeForm } from "../../../../components/judges/JudgeForm";

interface EditJudgePageClientProps {
  judgeId: string;
  initial: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    avatarUrl?: string;
    shortBio?: string;
    city?: string;
    country?: string;
    website?: string;
    instagram?: string;
    isPublic?: boolean;
  };
  initialFullBioRichJson?: unknown;
  initialOtherLinksJson?: unknown;
}

export function EditJudgePageClient({ judgeId, initial, initialFullBioRichJson, initialOtherLinksJson }: EditJudgePageClientProps) {
  const router = useRouter();

  return (
    <JudgeForm
      initialValues={initial}
      initialFullBioRichJson={initialFullBioRichJson}
      initialOtherLinksJson={initialOtherLinksJson}
      submitLabel="Guardar cambios"
      onSubmit={async (values) => {
        const result = await updateJudgeProfileByAdmin(judgeId, {
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone,
          avatarUrl: values.avatarUrl,
          shortBio: values.shortBio,
          fullBioRichJson: values.fullBioRichJson,
          city: values.city,
          country: values.country,
          website: values.website,
          instagram: values.instagram,
          otherLinksJson: values.otherLinksJson,
          isPublic: values.isPublic,
        });
        if (result.ok) {
          router.push("/jurados");
          router.refresh();
          return { ok: true };
        }
        return { ok: false, error: result.error };
      }}
    />
  );
}
