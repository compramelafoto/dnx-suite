"use client";

import Cropper from "react-easy-crop";

import type { CropAreaPixels } from "./export";

export default function CropperPanel({
  imageSrc,
  crop,
  zoom,
  rotation,
  onCropChange,
  onZoomChange,
  onRotationChange,
  onCropComplete,
  aspect,
}: {
  imageSrc: string | null;
  crop: { x: number; y: number };
  zoom: number;
  rotation: number;
  aspect: number;
  onCropChange: (crop: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onRotationChange: (rotation: number) => void;
  onCropComplete: (area: CropAreaPixels) => void;
}) {
  if (!imageSrc) {
    return (
      <div className="text-sm text-[#6b7280]">
        Subí una foto para habilitar el recorte.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
      <div className="relative w-full aspect-square bg-black/10 rounded-2xl overflow-hidden">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          cropShape="rect"
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={(_, areaPixels) => onCropComplete(areaPixels as CropAreaPixels)}
          objectFit="contain"
          showGrid={true}
          minZoom={0.5}
          maxZoom={6}
        />
      </div>
      <div className="w-full">
        <label className="block text-sm text-[#6b7280] mb-3">Zoom</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(0.5, Number((zoom - 0.1).toFixed(2))))}
            className="h-8 w-8 rounded-md border border-[#e5e7eb] text-sm"
          >
            -
          </button>
          <input
            type="range"
            min="0.5"
            max="6"
            step="0.05"
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="w-full"
          />
          <button
            type="button"
            onClick={() => onZoomChange(Math.min(6, Number((zoom + 0.1).toFixed(2))))}
            className="h-8 w-8 rounded-md border border-[#e5e7eb] text-sm"
          >
            +
          </button>
        </div>
        <label className="block text-sm text-[#6b7280] mt-4 mb-3">Rotación</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRotationChange(Math.max(-45, rotation - 1))}
            className="h-8 w-8 rounded-md border border-[#e5e7eb] text-sm"
          >
            -
          </button>
          <input
            type="range"
            min="-45"
            max="45"
            step="1"
            value={rotation}
            onChange={(e) => onRotationChange(Number(e.target.value))}
            className="w-full"
          />
          <button
            type="button"
            onClick={() => onRotationChange(Math.min(45, rotation + 1))}
            className="h-8 w-8 rounded-md border border-[#e5e7eb] text-sm"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
