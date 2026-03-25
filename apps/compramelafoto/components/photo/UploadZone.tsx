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
}

export default function UploadZone({
  onFilesSelected,
  uploading = false,
  accentColor = "#c27b3d",
  disabled = false,
  uploadedCount = 0,
  totalCount = 0,
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
    e.target.value = ""; // Permitir volver a elegir las mismas u otras fotos
  };

  // Determinar el color del borde según el estado
  const getBorderColor = () => {
    if (disabled) return "#e5e7eb";
    if (isDragging) return accentColor;
    if (isHovering && !uploading) return accentColor;
    return "#e5e7eb";
  };

  // Determinar el color de fondo según el estado
  const getBackgroundColor = () => {
    if (disabled) return "#f8f9fa";
    if (isDragging) return `${accentColor}08`;
    if (isHovering && !uploading) return "#f8f9fa";
    return undefined;
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
        "border-2 border-dashed rounded-lg p-12 md:p-16 text-center cursor-pointer transition-all duration-200",
        (uploading || disabled) && "opacity-50 cursor-not-allowed"
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
        <div className="space-y-6">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent mx-auto"
            style={{ borderColor: accentColor }}
          ></div>
          <div className="space-y-3">
            <p className="text-lg font-medium text-[#1a1a1a]">
              Subiendo fotos{totalCount > 0 ? ` ${Math.min(uploadedCount, totalCount)}/${totalCount}` : "..."}
            </p>
            {totalCount > 0 && (
              <div className="w-full max-w-lg mx-auto min-w-0">
                {/* Barra de progreso horizontal más grande y visible */}
                <div className="h-4 w-full rounded-full bg-[#e5e7eb] overflow-hidden shadow-inner">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                    style={{
                      width: `${Math.min(100, Math.round((Math.min(uploadedCount, totalCount) / totalCount) * 100))}%`,
                      backgroundColor: accentColor,
                    }}
                  >
                    {/* Efecto de brillo animado */}
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                      style={{ 
                        animation: "shimmer 1.5s infinite",
                        backgroundSize: "200% 100%",
                      }}
                    />
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium text-[#6b7280] text-center">
                  {Math.min(100, Math.round((Math.min(uploadedCount, totalCount) / totalCount) * 100))}% completado
                </p>
              </div>
            )}
          </div>
        </div>
      ) : disabled ? (
        <div className="space-y-4">
          <svg
            className="mx-auto h-12 w-12 text-[#6b7280]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z"
            />
          </svg>
          <div>
            <p className="text-lg font-medium text-[#1a1a1a]">
              Conectá Mercado Pago para subir fotos
            </p>
            <p className="text-sm text-[#6b7280] mt-2">
              Podés crear el álbum, pero no subir fotos hasta vincular tu cuenta.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <svg
            className="mx-auto h-12 w-12 text-[#6b7280]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <div>
            <p className="text-lg font-medium text-[#1a1a1a]">
              Arrastrá tus fotos aquí o hacé click para seleccionar
            </p>
            <p className="text-sm text-[#6b7280] mt-2">
              Podés elegir varias fotos a la vez (varias en el diálogo o arrastrando varias). JPG, PNG, HEIC.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
