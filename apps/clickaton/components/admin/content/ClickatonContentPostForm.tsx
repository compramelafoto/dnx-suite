"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ContentPostForm, type ContentOption, type ContentPostFormValue } from "@repo/content-ui";
import { adminRoutes } from "@/config/admin/navigation";
import {
  createClickatonContentMediaAdapter,
  deleteClickatonContentPost,
  loadClickatonContentTaxonomyOptions,
  submitClickatonContentPost,
} from "@/lib/content/clickaton-content-admin-adapter";
import {
  CLICKATON_CONTENT_LABELS,
  CLICKATON_CONTENT_TYPE_LABELS,
} from "@/lib/content/content-labels";

const ContentEditorClient = dynamic(
  () => import("@/components/admin/content/ContentEditorClient"),
  {
    ssr: false,
    loading: () => <p className="text-sm text-gray-500">Cargando editor...</p>,
  },
);

type Props = {
  mode: "create" | "edit";
  postId?: number;
  initialValues?: Partial<ContentPostFormValue>;
};

export default function ClickatonContentPostForm({ mode, postId, initialValues }: Props) {
  const router = useRouter();
  const mediaAdapter = useMemo(() => createClickatonContentMediaAdapter(), []);
  const [options, setOptions] = useState<{
    categories: ContentOption[];
    tags: ContentOption[];
    authors: ContentOption[];
  }>({ categories: [], tags: [], authors: [] });

  useEffect(() => {
    void loadClickatonContentTaxonomyOptions().then(setOptions);
  }, []);

  return (
    <ContentPostForm
      mode={mode}
      postId={postId}
      initialValue={initialValues}
      options={options}
      labels={CLICKATON_CONTENT_LABELS}
      typeLabels={CLICKATON_CONTENT_TYPE_LABELS}
      mediaAdapter={mediaAdapter}
      EditorComponent={ContentEditorClient}
      onSubmit={async ({ data }) => submitClickatonContentPost({ mode, postId, data })}
      onDelete={
        mode === "edit" && postId
          ? async () => {
              await deleteClickatonContentPost(postId);
              router.push(adminRoutes.contents);
            }
          : undefined
      }
      onCreated={({ id }) => {
        router.push(`${adminRoutes.contents}/${id}`);
      }}
      onSaved={() => {
        router.refresh();
      }}
    />
  );
}
