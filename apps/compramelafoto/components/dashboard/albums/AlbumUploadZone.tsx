"use client";

import { useRef, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";

export type AlbumUploadSelection = {
  files: FileList;
  /** true cuando el usuario eligió una carpeta completa (webkitdirectory). */
  isDirectoryUpload: boolean;
};

export type AlbumUploadZoneProps = {
  onFilesSelected: (selection: AlbumUploadSelection) => void;
  uploading?: boolean;
  accentColor?: string;
  disabled?: boolean;
  uploadedCount?: number;
  totalCount?: number;
  className?: string;
};

export default function AlbumUploadZone({
  onFilesSelected,
  uploading = false,
  accentColor = "#c27b3d",
  disabled = false,
  uploadedCount = 0,
  totalCount = 0,
  className,
}: AlbumUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const isBusy = uploading || disabled;

  const emitFiles = (files: FileList, isDirectoryUpload: boolean) => {
    if (files.length > 0) {
      onFilesSelected({ files, isDirectoryUpload });
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isBusy) return;
    emitFiles(e.dataTransfer.files, false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isDirectoryUpload: boolean) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      emitFiles(files, isDirectoryUpload);
    }
    e.target.value = "";
  };

  return (
    <div
      className={cn("space-y-4 min-w-0", className)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className={cn(
          "ds-upload-zone rounded-xl border-2 border-dashed px-6 py-8 sm:px-10 sm:py-10 transition-all duration-200 min-w-0",
          isBusy && "opacity-60",
          !isBusy && "hover:shadow-md"
        )}
        style={{
          borderColor: isBusy ? "#e5e7eb" : "#e5e7eb",
          backgroundColor: isBusy ? "#f8f9fa" : "#fafafa",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileChange(e, false)}
          className="hidden"
          disabled={isBusy}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory no está en los tipos estándar de React
          webkitdirectory=""
          multiple
          onChange={(e) => handleFileChange(e, true)}
          className="hidden"
          disabled={isBusy}
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
                Subiendo fotos
                {totalCount > 0
                  ? ` ${Math.min(uploadedCount, totalCount)}/${totalCount}`
                  : "..."}
              </p>
              {totalCount > 0 ? (
                <div className="w-full min-w-0">
                  <div className="h-4 w-full rounded-full bg-[#e5e7eb] overflow-hidden shadow-inner">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${Math.min(100, Math.round((Math.min(uploadedCount, totalCount) / totalCount) * 100))}%`,
                        backgroundColor: accentColor,
                      }}
                    />
                  </div>
                  <p className="ds-upload-zone__hint mt-3">
                    {Math.min(
                      100,
                      Math.round((Math.min(uploadedCount, totalCount) / totalCount) * 100)
                    )}
                    % completado
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : disabled ? (
          <div className="ds-upload-zone__inner">
            <p className="ds-upload-zone__title">Conectá Mercado Pago para subir fotos</p>
            <p className="ds-upload-zone__hint">
              Podés crear el álbum, pero no subir fotos hasta vincular tu cuenta.
            </p>
          </div>
        ) : (
          <div className="ds-upload-zone__inner space-y-5">
            <div className="space-y-2 text-center sm:text-left">
              <p className="ds-upload-zone__title m-0">Subí fotos al álbum</p>
              <p className="ds-upload-zone__hint m-0">
                Elegí archivos sueltos o una carpeta completa para conservar la estructura. También
                podés arrastrar archivos aquí. JPG, PNG, HEIC.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full">
              <Button
                type="button"
                variant="primary"
                size="md"
                className="w-full sm:w-auto min-h-[44px]"
                onClick={() => fileInputRef.current?.click()}
              >
                Elegir archivos
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                className="w-full sm:w-auto min-h-[44px]"
                onClick={() => folderInputRef.current?.click()}
              >
                Subir carpeta completa
              </Button>
            </div>
            <p className="ds-upload-zone__hint text-center sm:text-left m-0">
              Con carpeta completa, las subcarpetas se crean automáticamente en álbumes propios. En
              eventos colaborativos deben existir previamente (creadas por el organizador).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
