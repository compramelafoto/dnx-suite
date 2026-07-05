"use client";

import { useRef } from "react";
import Button from "@/components/ui/Button";

export default function UploadSingle({
  imageSrc,
  onUpload,
  onClear,
}: {
  imageSrc: string | null;
  onUpload: (file: File, previewUrl: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-4">
      <input
        id="carnet-upload"
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        ref={inputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const maxBytes = 10 * 1024 * 1024; // 10 MB
          if (file.size > maxBytes) {
            alert(`La imagen supera el límite de 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
            e.currentTarget.value = "";
            return;
          }
          const previewUrl = URL.createObjectURL(file);
          onUpload(file, previewUrl);
          e.currentTarget.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          Subir foto
        </Button>
        {imageSrc && (
          <Button variant="secondary" type="button" onClick={onClear}>
            Quitar foto
          </Button>
        )}
      </div>
      {imageSrc && (
        <div className="w-full max-w-2xl rounded-lg overflow-hidden border border-[#e5e7eb] bg-black/5">
          <img
            src={imageSrc}
            alt="Vista previa"
            className="w-full h-auto object-contain"
          />
        </div>
      )}
    </div>
  );
}
