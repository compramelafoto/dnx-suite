"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentMediaAdapter } from "../adapters";
import { mergeContentUiLabels, type ContentUiLabels } from "../labels";
import type { ContentMediaItem } from "../types";

export type ContentMediaLibraryProps = {
  mediaAdapter: ContentMediaAdapter;
  mode?: "page" | "picker";
  onSelect?: (item: ContentMediaItem) => void;
  labels?: Partial<ContentUiLabels>;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ContentMediaLibrary({
  mediaAdapter,
  mode = "page",
  onSelect,
  labels: labelsPartial,
}: ContentMediaLibraryProps) {
  const labels = mergeContentUiLabels(labelsPartial);
  const [items, setItems] = useState<ContentMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: "", altText: "", caption: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const media = await mediaAdapter.listMedia({
        q: query.trim() || undefined,
        limit: 100,
      });
      setItems(media);
    } catch (e) {
      setError(e instanceof Error ? e.message : labels.mediaLoadError);
    } finally {
      setLoading(false);
    }
  }, [labels.mediaLoadError, mediaAdapter, query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      await mediaAdapter.uploadMedia(file);
      setSuccess(labels.mediaUploadSuccess);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : labels.mediaUploadError);
    } finally {
      setUploading(false);
    }
  }

  function startEdit(item: ContentMediaItem) {
    setEditingId(item.id);
    setEditForm({
      title: item.title || "",
      altText: item.altText || "",
      caption: item.caption || "",
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      await mediaAdapter.updateMedia(editingId, editForm);
      setEditingId(null);
      setSuccess(labels.mediaMetaSuccess);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : labels.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setSuccess(labels.mediaCopySuccess);
    } catch {
      setError(labels.mediaCopyError);
    }
  }

  async function removeItem(id: number) {
    if (!window.confirm(labels.mediaDeleteConfirm)) return;
    setError(null);
    try {
      await mediaAdapter.deleteMedia(id);
      setSuccess(labels.mediaDeleteSuccess);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : labels.deleteError);
    }
  }

  const btnSecondary =
    "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50";
  const btnPrimary =
    "rounded-lg border border-[var(--content-ui-accent,#525252)] bg-[var(--content-ui-accent,#525252)] px-3 py-1.5 text-sm text-white disabled:opacity-50";

  return (
    <div className="space-y-4">
      {mode === "page" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className={btnPrimary}>
              {uploading ? labels.mediaUploading : labels.mediaUpload}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={labels.mediaSearchPlaceholder}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-56"
            />
            <button type="button" onClick={() => void load()} className={btnSecondary}>
              {labels.mediaSearch}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div> : null}

      {loading ? (
        <p className="text-sm text-gray-500">{labels.loadingLibrary}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">{labels.emptyLibrary}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="relative aspect-video bg-gray-100">
                <img
                  src={item.url}
                  alt={item.altText || item.filename}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-2 p-3">
                <p className="truncate text-sm font-medium text-gray-900">{item.title || item.filename}</p>
                <p className="text-xs text-gray-500">{formatBytes(item.sizeBytes)}</p>
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <input
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder={labels.mediaTitlePlaceholder}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={editForm.altText}
                      onChange={(e) => setEditForm((f) => ({ ...f, altText: e.target.value }))}
                      placeholder={labels.mediaAltPlaceholder}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <textarea
                      value={editForm.caption}
                      onChange={(e) => setEditForm((f) => ({ ...f, caption: e.target.value }))}
                      placeholder={labels.mediaCaptionPlaceholder}
                      rows={2}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button type="button" disabled={saving} onClick={() => void saveEdit()} className={btnPrimary}>
                        {saving ? labels.saving : labels.mediaSave}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className={btnSecondary}>
                        {labels.mediaCancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {mode === "picker" && onSelect ? (
                      <button type="button" onClick={() => onSelect(item)} className={btnPrimary}>
                        {labels.mediaInsert}
                      </button>
                    ) : null}
                    <button type="button" onClick={() => void copyUrl(item.url)} className={btnSecondary}>
                      {labels.mediaCopyUrl}
                    </button>
                    {mode === "page" ? (
                      <>
                        <button type="button" onClick={() => startEdit(item)} className={btnSecondary}>
                          {labels.mediaEdit}
                        </button>
                        <button type="button" onClick={() => void removeItem(item.id)} className={btnSecondary}>
                          {labels.mediaDelete}
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { ContentMediaItem };
