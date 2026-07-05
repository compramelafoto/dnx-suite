"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";

type BlogHeroImageUploadProps = {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
};

export default function BlogHeroImageUpload({ value, onChange, disabled }: BlogHeroImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/blog/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error subiendo imagen");
      onChange(data.heroImageUrl || data.url || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error subiendo imagen");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative aspect-[21/9] w-full max-w-2xl overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          <Image src={value} alt="Imagen destacada" fill className="object-cover" unoptimized />
        </div>
      ) : (
        <div className="flex aspect-[21/9] w-full max-w-2xl items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
          Sin imagen destacada
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
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Subiendo..." : value ? "Cambiar imagen" : "Subir imagen"}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => onChange("")}
          >
            Quitar
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
