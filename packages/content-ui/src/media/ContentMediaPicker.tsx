"use client";

import { useEffect } from "react";
import type { ContentMediaAdapter } from "../adapters";
import { mergeContentUiLabels, type ContentUiLabels } from "../labels";
import type { ContentMediaItem } from "../types";
import { ContentMediaLibrary } from "./ContentMediaLibrary";

export type ContentMediaPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (item: ContentMediaItem) => void;
  mediaAdapter: ContentMediaAdapter;
  labels?: Partial<ContentUiLabels>;
};

export function ContentMediaPicker({
  open,
  onClose,
  onSelect,
  mediaAdapter,
  labels: labelsPartial,
}: ContentMediaPickerProps) {
  const labels = mergeContentUiLabels(labelsPartial);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">{labels.mediaLibraryTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            {labels.mediaClose}
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <ContentMediaLibrary
            mediaAdapter={mediaAdapter}
            mode="picker"
            labels={labels}
            onSelect={(item) => {
              onSelect(item);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
