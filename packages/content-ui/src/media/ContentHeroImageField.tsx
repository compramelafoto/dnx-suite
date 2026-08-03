"use client";

import { useRef, useState } from "react";
import type { ContentMediaAdapter } from "../adapters";
import { DEFAULT_CONTENT_UI_LABELS, type ContentUiLabels } from "../labels";

export type ContentHeroImageFieldProps = {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  mediaAdapter: ContentMediaAdapter;
  labels?: Partial<
    Pick<
      ContentUiLabels,
      "heroEmpty" | "heroUpload" | "heroChange" | "heroRemove" | "heroUploading" | "mediaUploadError"
    >
  >;
};

export function ContentHeroImageField({
  value,
  onChange,
  disabled,
  mediaAdapter,
  labels: labelsPartial,
}: ContentHeroImageFieldProps) {
  const labels = { ...DEFAULT_CONTENT_UI_LABELS, ...labelsPartial };
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      if (mediaAdapter.uploadHero) {
        const result = await mediaAdapter.uploadHero(file);
        onChange(result.url || "");
      } else {
        const item = await mediaAdapter.uploadMedia(file);
        onChange(item.url || "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : labels.mediaUploadError);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative aspect-[21/9] w-full max-w-2xl overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          <img src={value} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[21/9] w-full max-w-2xl items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
          {labels.heroEmpty}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {uploading ? labels.heroUploading : value ? labels.heroChange : labels.heroUpload}
        </button>
        {value ? (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => onChange("")}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {labels.heroRemove}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
