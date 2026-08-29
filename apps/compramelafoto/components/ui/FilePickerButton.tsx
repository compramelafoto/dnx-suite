"use client";

import { useEffect, useId, useRef } from "react";
import { ImagePlus } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type FilePickerButtonProps = {
  /** Archivo elegido. El padre lo mantiene en su estado. */
  file: File | null;
  onSelect: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
  /** Texto del botón. */
  label?: string;
  /** Texto cuando todavía no se eligió nada. */
  emptyLabel?: string;
  /** Nombre del archivo ya guardado en el servidor, cuando no hay uno nuevo elegido. */
  currentName?: string | null;
  size?: "sm" | "md";
  /** El botón ocupa todo el ancho disponible. */
  fullWidth?: boolean;
  className?: string;
};

/**
 * Reemplaza al `<input type="file">` nativo, que el navegador dibuja como
 * "Seleccionar archivo — Ningún archivo seleccionado" y no sigue el design
 * system. Muestra un botón del DS y debajo el nombre del archivo elegido.
 */
export default function FilePickerButton({
  file,
  onSelect,
  accept,
  disabled = false,
  label = "Cargar imagen",
  emptyLabel = "Ningún archivo seleccionado",
  currentName = null,
  size = "md",
  fullWidth = false,
  className,
}: FilePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  // Sin archivo elegido, el input queda vacío: así se puede volver a elegir el
  // mismo archivo (el evento `change` no dispara si el valor no cambió).
  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = "";
  }, [file]);

  const detail = file?.name ?? currentName ?? emptyLabel;

  return (
    <div className={cn("flex w-full min-w-0 flex-col items-start gap-1.5", className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="secondary"
        size={size}
        disabled={disabled}
        className={cn(fullWidth && "w-full")}
        aria-describedby={`${inputId}-detail`}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </Button>
      <p
        id={`${inputId}-detail`}
        title={detail}
        className={cn(
          "m-0 w-full min-w-0 truncate text-xs",
          file ? "text-[#374151]" : "text-[#6b7280]",
        )}
      >
        {detail}
      </p>
    </div>
  );
}
