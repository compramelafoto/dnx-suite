"use client";

import { useEffect } from "react";
import BlogMediaLibrary, { type BlogMediaItem } from "@/components/blog/admin/BlogMediaLibrary";
import Button from "@/components/ui/Button";

type BlogMediaPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (item: BlogMediaItem) => void;
};

export default function BlogMediaPicker({ open, onClose, onSelect }: BlogMediaPickerProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Biblioteca multimedia</h2>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        <div className="overflow-y-auto p-4">
          <BlogMediaLibrary
            mode="picker"
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
