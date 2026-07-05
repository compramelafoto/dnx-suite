"use client";

import AppModal from "@/components/ui/AppModal";
import PreventaPackBenefitsEditor from "./PreventaPackBenefitsEditor";
import type { PackRow } from "./types";

export default function PreventaPackBenefitsModal({
  albumId,
  pack,
  onClose,
  onPacksChanged,
}: {
  albumId: number;
  pack: PackRow;
  onClose: () => void;
  onPacksChanged: () => void;
}) {
  return (
    <AppModal
      open
      onClose={onClose}
      size="xl"
      title="Productos incluidos"
      description={
        <div className="ds-stack-section w-full gap-1">
          <p className="text-sm font-medium text-[#1a1a1a]">{pack.name}</p>
          <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-gray-600 m-0">
            Lo que el cliente recibe con este pack. Podés mezclar digitales e impresos; al publicar
            las fotos, la familia elige imágenes según estas reglas.
          </p>
        </div>
      }
      titleId="preventa-pack-benefits-title"
      panelClassName="max-h-[min(92vh,900px)]"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
        <PreventaPackBenefitsEditor
          albumId={albumId}
          pack={pack}
          onPacksChanged={onPacksChanged}
        />
      </div>
    </AppModal>
  );
}
