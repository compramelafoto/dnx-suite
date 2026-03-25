"use client";

import { useRouter } from "next/navigation";
import { createJudgeAccount } from "../../../actions/judges";
import { JudgeForm } from "../../../components/judges/JudgeForm";
import { JUDGE_BIO_DOCUMENT_VERSION, type JudgeBioDocument } from "../../../lib/fotorank/judges/judgeBioRich";

const e2eInitialFullBio: JudgeBioDocument | undefined =
  process.env.NEXT_PUBLIC_E2E_JUDGE_BIO === "1"
    ? { version: JUDGE_BIO_DOCUMENT_VERSION, blocks: [{ type: "paragraph", text: "" }] }
    : undefined;

export function NewJudgePageClient() {
  const router = useRouter();

  return (
    <JudgeForm
      showPassword
      submitLabel="Crear jurado"
      initialFullBioRichJson={e2eInitialFullBio}
      onSubmit={async (values) => {
        const result = await createJudgeAccount({
          email: values.email,
          password: values.password || "",
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
