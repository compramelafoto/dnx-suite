"use client";

import { useRef } from "react";
import Button from "@/components/ui/Button";

export default function Uploader({
  onFiles,
  buttonLabel = "Subir fotos",
  helperText = "Podés subir todas las fotos que quieras.",
  buttonClassName,
  wrapperClassName,
}: {
  onFiles: (files: FileList) => void;
  buttonLabel?: string;
  helperText?: string | null;
  buttonClassName?: string;
  wrapperClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className={`space-y-2 ${wrapperClassName ?? ""}`.trim()}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (!files || files.length === 0) {
            if (inputRef.current) inputRef.current.value = "";
            return;
          }
          const maxBytes = 10 * 1024 * 1024; // 10 MB
          const valid: File[] = [];
          const tooLarge: string[] = [];
          for (let i = 0; i < files.length; i++) {
            if (files[i].size <= maxBytes) valid.push(files[i]);
            else tooLarge.push(files[i].name);
          }
          if (tooLarge.length > 0) {
            alert(`Algunas fotos superan 10 MB y no se subirán: ${tooLarge.slice(0, 3).join(", ")}${tooLarge.length > 3 ? "…" : ""}`);
          }
          if (valid.length > 0) {
            const dt = new DataTransfer();
            valid.forEach((f) => dt.items.add(f));
            onFiles(dt.files);
          }
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <Button
        variant="secondary"
        type="button"
        onClick={() => inputRef.current?.click()}
        className={buttonClassName}
      >
        {buttonLabel}
      </Button>
      {helperText ? <p className="text-xs text-[#6b7280]">{helperText}</p> : null}
    </div>
  );
}
