"use client";

import { useRef, useState, DragEvent } from "react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onFilesSelected: (files: FileList) => void;
  uploading?: boolean;
  accentColor?: string;
  disabled?: boolean;
  uploadedCount?: number;
  totalCount?: number;
  className?: string;
}

export default function UploadZone({
  onFilesSelected,
  uploading = false,
  accentColor = "#c27b3d",
  disabled = false,
  uploadedCount = 0,
  totalCount = 0,
  className,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled || uploading) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || uploading) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleClick = () => {
    if (disabled || uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
    e.target.value = "";
  };

  const getBorderColor = () => {
    if (disabled) return "#e5e7eb";
    if (isDragging) return accentColor;
    if (isHovering && !uploading) return accentColor;
    return "#e5e7eb";
  };

  const getBackgroundColor = () => {
    if (disabled) return "#f8f9fa";
    if (isDragging) return `${accentColor}08`;
    if (isHovering && !uploading) return "#fdf8f3";
    return "#fafafa";
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onMouseEnter={() => !uploading && !disabled && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        "ds-upload-zone rounded-xl border-2 border-dashed px-6 py-10 sm:px-10 sm:py-14 cursor-pointer transition-all duration-200",
        (uploading || disabled) && "opacity-60 cursor-not-allowed",
        !disabled && !uploading && "hover:shadow-md",
        className
      )}
      style={{
        borderColor: getBorderColor(),
        backgroundColor: getBackgroundColor(),
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={uploading || disabled}
      />

      {uploading ? (
        <div className="ds-upload-zone__inner">
          <div
            className="ds-stack-anchor h-14 w-14 shrink-0 animate-spin rounded-full border-4 border-t-transparent"
            style={{ borderColor: accentColor }}
            aria-hidden
          />
          <div className="ds-upload-zone__copy space-y-3">
            <p className="ds-upload-zone__title">
              Subiendo fotos{totalCount > 0 ? ` ${Math.min(uploadedCount, totalCount)}/${totalCount}` : "..."}
            </p>
            {totalCount > 0 && (
              <div className="w-full min-w-0">
                <div className="h-4 w-full rounded-full bg-[#e5e7eb] overflow-hidden shadow-inner">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                    style={{
                      width: `${Math.min(100, Math.round((Math.min(uploadedCount, totalCount) / totalCount) * 100))}%`,
                      backgroundColor: accentColor,
                    }}
                  >
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                      style={{
                        animation: "shimmer 1.5s infinite",
                        backgroundSize: "200% 100%",
                      }}
                    />
                  </div>
                </div>
                <p className="ds-upload-zone__hint mt-3">
                  {Math.min(100, Math.round((Math.min(uploadedCount, totalCount) / totalCount) * 100))}% completado
                </p>
              </div>
            )}
          </div>
        </div>
      ) : disabled ? (
        <div className="ds-upload-zone__inner">
          <svg
            className="ds-stack-anchor h-14 w-14 shrink-0 text-[#9ca3af]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z"
            />
          </svg>
          <div className="ds-upload-zone__copy space-y-2">
            <p className="ds-upload-zone__title">Conectá Mercado Pago para subir fotos</p>
            <p className="ds-upload-zone__hint">
              Podés crear el álbum, pero no subir fotos hasta vincular tu cuenta.
            </p>
          </div>
        </div>
      ) : (
        <div className="ds-upload-zone__inner">
          <div
            className="ds-stack-anchor flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#e5e7eb] bg-white shadow-sm"
            aria-hidden
          >
            <svg
              className="h-8 w-8 text-[#c27b3d]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div className="ds-upload-zone__copy space-y-2">
            <p className="ds-upload-zone__title">
              Arrastrá tus fotos aquí o hacé click para elegir
            </p>
            <p className="ds-upload-zone__hint">
              Podés seleccionar todas las fotos de una vez. Mantené la pestaña abierta hasta que termine. JPG, PNG, HEIC.
            </p>
          </div>
          <p className="ds-upload-zone__cta">Clic o soltar archivos</p>
        </div>
      )}
    </div>
  );
}
