"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import type { JSONContent } from "@tiptap/core";
import { createEmptyContentJson, slugifyFromName } from "@repo/content";
import type { ContentMediaAdapter } from "../adapters";
import { ContentEditor, type ContentEditorProps } from "../editor/ContentEditor";
import { toContentFormError } from "../errors";
import {
  DEFAULT_CONTENT_TYPE_LABELS,
  mergeContentUiLabels,
  type ContentUiLabels,
} from "../labels";
import { ContentHeroImageField } from "../media/ContentHeroImageField";
import { ContentMediaPicker } from "../media/ContentMediaPicker";
import { ContentAuthorSelect } from "../selectors/ContentAuthorSelect";
import { ContentTagMultiSelect } from "../selectors/ContentTagMultiSelect";
import { ContentTaxonomySelect } from "../selectors/ContentTaxonomySelect";
import type {
  ContentFormCapabilities,
  ContentFormError,
  ContentOption,
  ContentPostFormSubmitPayload,
  ContentPostFormValue,
  ContentPostSubmitResult,
} from "../types";
import { buildContentPostSubmitPayload, toDatetimeLocal } from "./buildSubmitPayload";
import { syncContentPostImageFields } from "./syncImages";

export type ContentPostFormProps = {
  mode: "create" | "edit";
  postId?: number;
  initialValue?: Partial<ContentPostFormValue>;
  options: {
    categories: ContentOption[];
    tags: ContentOption[];
    authors: ContentOption[];
  };
  labels?: Partial<ContentUiLabels>;
  typeLabels?: Record<string, string>;
  capabilities?: ContentFormCapabilities;
  onSubmit: (input: {
    statusOverride?: ContentPostFormValue["status"];
    data: ContentPostFormSubmitPayload;
  }) => Promise<ContentPostSubmitResult>;
  onDelete?: () => Promise<void>;
  onCreated?: (result: { id: number }) => void;
  onSaved?: (result: { status: string; slug: string }) => void;
  mediaAdapter: ContentMediaAdapter;
  slugify?: (name: string) => string;
  syncImages?: typeof syncContentPostImageFields;
  createEmptyContent?: () => JSONContent;
  EditorComponent?: ComponentType<ContentEditorProps>;
};

function defaultFormValue(
  createEmpty: () => JSONContent,
  initial?: Partial<ContentPostFormValue>
): ContentPostFormValue {
  return {
    title: "",
    slug: "",
    excerpt: "",
    contentJson: createEmpty(),
    heroImageUrl: "",
    status: "DRAFT",
    type: "BLOG",
    categoryId: "",
    authorId: "",
    tagIds: [],
    seoTitle: "",
    seoDescription: "",
    seoGoal: "",
    ogImageUrl: "",
    canonicalUrl: "",
    noIndex: false,
    lastReviewedAt: "",
    isFeatured: false,
    featuredUntil: "",
    ...initial,
  };
}

export function ContentPostForm({
  mode,
  postId,
  initialValue,
  options,
  labels: labelsPartial,
  typeLabels = DEFAULT_CONTENT_TYPE_LABELS,
  capabilities,
  onSubmit,
  onDelete,
  onCreated,
  onSaved,
  mediaAdapter,
  slugify = slugifyFromName,
  createEmptyContent = createEmptyContentJson,
  EditorComponent = ContentEditor,
}: ContentPostFormProps) {
  const labels = mergeContentUiLabels(labelsPartial);
  const canPublish = capabilities?.canPublish !== false;
  const canArchive = capabilities?.canArchive !== false;
  const canDelete = capabilities?.canDelete !== false;
  const canManageMedia = capabilities?.canManageMedia !== false;

  const [form, setForm] = useState<ContentPostFormValue>(() =>
    defaultFormValue(createEmptyContent, initialValue)
  );
  const [slugManual, setSlugManual] = useState(Boolean(initialValue?.slug));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ContentFormError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ url: string; alt: string } | null>(null);
  const pendingImageKey = useRef(0);

  useEffect(() => {
    if (!initialValue) return;
    setForm((prev) => ({
      ...prev,
      ...initialValue,
      contentJson: initialValue.contentJson ?? prev.contentJson,
      lastReviewedAt: initialValue.lastReviewedAt
        ? toDatetimeLocal(initialValue.lastReviewedAt)
        : prev.lastReviewedAt,
      featuredUntil: initialValue.featuredUntil
        ? toDatetimeLocal(initialValue.featuredUntil)
        : prev.featuredUntil,
    }));
  }, [initialValue]);

  const canFeature = form.status === "PUBLISHED";

  useEffect(() => {
    if (form.status !== "PUBLISHED" && form.isFeatured) {
      setForm((f) => ({ ...f, isFeatured: false }));
    }
  }, [form.status, form.isFeatured]);

  const save = useCallback(
    async (statusOverride?: ContentPostFormValue["status"]) => {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const data = buildContentPostSubmitPayload(form, statusOverride);
      try {
        const result = await onSubmit({ statusOverride, data });
        if (mode === "create") {
          if (result.id != null) {
            onCreated?.({ id: result.id });
          }
          return;
        }
        onSaved?.({ status: result.status, slug: result.slug });
        setSuccess(labels.savedSuccess);
        if (statusOverride) {
          setForm((f) => ({ ...f, status: statusOverride, isFeatured: data.isFeatured }));
        }
      } catch (e) {
        setError(toContentFormError(e, labels.saveError));
      } finally {
        setSaving(false);
      }
    },
    [form, labels.saveError, labels.savedSuccess, mode, onCreated, onSaved, onSubmit]
  );

  async function handleDelete() {
    if (!postId || !onDelete) return;
    if (!window.confirm(labels.deleteConfirm)) return;
    setSaving(true);
    setError(null);
    try {
      await onDelete();
    } catch (e) {
      setError(toContentFormError(e, labels.deleteError));
      setSaving(false);
    }
  }

  function toggleTag(id: number) {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(id) ? f.tagIds.filter((t) => t !== id) : [...f.tagIds, id],
    }));
  }

  function handleImageFromLibrary(url: string, alt: string) {
    pendingImageKey.current += 1;
    setPendingImage({ url, alt });
  }

  const btnPrimary =
    "rounded-lg border border-[var(--content-ui-accent,#525252)] bg-[var(--content-ui-accent,#525252)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
  const btnSecondary =
    "rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";

  return (
    <div className="max-w-4xl space-y-6">
      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</div>
      ) : null}
      {success ? (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>
      ) : null}

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold text-gray-900">{labels.mainContentTitle}</h2>
        <input
          value={form.title}
          onChange={(e) => {
            const title = e.target.value;
            setForm((f) => ({
              ...f,
              title,
              slug: slugManual ? f.slug : slugify(title),
            }));
          }}
          placeholder={labels.titlePlaceholder}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <div>
          <label className="mb-1 block text-sm text-gray-600">{labels.slugLabel}</label>
          <input
            value={form.slug}
            onChange={(e) => {
              setSlugManual(true);
              setForm((f) => ({ ...f, slug: e.target.value }));
            }}
            placeholder={labels.slugPlaceholder}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={form.excerpt}
          onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
          placeholder={labels.excerptPlaceholder}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <ContentTaxonomySelect
            label={labels.categoryLabel}
            emptyLabel={labels.categoryEmpty}
            value={form.categoryId}
            options={options.categories}
            onChange={(categoryId) => setForm((f) => ({ ...f, categoryId }))}
            disabled={saving}
          />
          <ContentAuthorSelect
            label={labels.authorLabel}
            emptyLabel={labels.authorEmpty}
            value={form.authorId}
            options={options.authors}
            onChange={(authorId) => setForm((f) => ({ ...f, authorId }))}
            disabled={saving}
          />
          <div>
            <label className="mb-1 block text-sm text-gray-600">{labels.typeLabel}</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as ContentPostFormValue["type"],
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ContentTagMultiSelect
          label={labels.tagsLabel}
          options={options.tags}
          value={form.tagIds}
          onToggle={toggleTag}
          disabled={saving}
        />
        <div>
          <label className="mb-2 block text-sm text-gray-600">{labels.heroLabel}</label>
          <p className="mb-3 text-xs leading-relaxed text-gray-500">{labels.heroHelp}</p>
          <ContentHeroImageField
            value={form.heroImageUrl}
            onChange={(url) =>
              setForm((f) => ({
                ...f,
                heroImageUrl: url,
                ogImageUrl: url,
              }))
            }
            disabled={saving}
            mediaAdapter={mediaAdapter}
            labels={labels}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm text-gray-600">{labels.bodyLabel}</label>
          <EditorComponent
            value={form.contentJson}
            onChange={(contentJson) => setForm((f) => ({ ...f, contentJson }))}
            onPickImage={canManageMedia ? () => setMediaPickerOpen(true) : undefined}
            disabled={saving}
            insertImage={pendingImage}
            insertImageKey={pendingImageKey.current}
            onImageInserted={() => setPendingImage(null)}
            labels={labels}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold text-gray-900">{labels.seoTitle}</h2>
        <input
          value={form.seoTitle}
          onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
          placeholder={labels.seoTitlePlaceholder}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <textarea
          value={form.seoDescription}
          onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
          placeholder={labels.seoDescriptionPlaceholder}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <textarea
          value={form.seoGoal}
          onChange={(e) => setForm((f) => ({ ...f, seoGoal: e.target.value }))}
          placeholder={labels.seoGoalPlaceholder}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        {form.heroImageUrl ? (
          <p className="text-sm text-gray-600">{labels.sharePreviewWithHero}</p>
        ) : (
          <p className="text-sm text-amber-800">{labels.fallbackShareNote}</p>
        )}
        <input
          value={form.canonicalUrl}
          onChange={(e) => setForm((f) => ({ ...f, canonicalUrl: e.target.value }))}
          placeholder={labels.canonicalPlaceholder}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.noIndex}
            onChange={(e) => setForm((f) => ({ ...f, noIndex: e.target.checked }))}
          />
          {labels.noIndexLabel}
        </label>
        <div>
          <label className="mb-1 block text-sm text-gray-600">{labels.lastReviewedLabel}</label>
          <input
            type="datetime-local"
            value={form.lastReviewedAt}
            onChange={(e) => setForm((f) => ({ ...f, lastReviewedAt: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold text-gray-900">{labels.publishSectionTitle}</h2>
        {!canFeature && form.isFeatured ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {labels.featureUncheckedNote}
          </div>
        ) : null}
        {!canFeature ? <p className="text-sm text-amber-700">{labels.featurePublishFirst}</p> : null}
        <label className={`flex items-center gap-2 text-sm text-gray-700 ${!canFeature ? "opacity-50" : ""}`}>
          <input
            type="checkbox"
            checked={form.isFeatured && canFeature}
            disabled={!canFeature}
            onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
          />
          {labels.featureCheckbox}
        </label>
        <div>
          <label className="mb-1 block text-sm text-gray-600">{labels.featuredUntilLabel}</label>
          <input
            type="datetime-local"
            value={form.featuredUntil}
            disabled={!canFeature || !form.isFeatured}
            onChange={(e) => setForm((f) => ({ ...f, featuredUntil: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={saving} onClick={() => void save("DRAFT")} className={btnPrimary}>
          {saving ? labels.saving : labels.saveDraft}
        </button>
        {canPublish ? (
          <button type="button" disabled={saving} onClick={() => void save("PUBLISHED")} className={btnPrimary}>
            {labels.publish}
          </button>
        ) : null}
        {mode === "edit" ? (
          <>
            {canArchive ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save("ARCHIVED")}
                className={btnSecondary}
              >
                {labels.archive}
              </button>
            ) : null}
            <button type="button" disabled={saving} onClick={() => void save()} className={btnSecondary}>
              {labels.saveChanges}
            </button>
            {canDelete && onDelete ? (
              <button type="button" disabled={saving} onClick={() => void handleDelete()} className={btnSecondary}>
                {labels.delete}
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {canManageMedia ? (
        <ContentMediaPicker
          open={mediaPickerOpen}
          onClose={() => setMediaPickerOpen(false)}
          mediaAdapter={mediaAdapter}
          labels={labels}
          onSelect={(item) => handleImageFromLibrary(item.url, item.altText || item.title || "")}
        />
      ) : null}
    </div>
  );
}
