"use client";

import EquipmentRenewalCategoryForm, {
  clearRenewalCategory,
} from "@/components/cuantocobro/equipment/EquipmentRenewalCategoryForm";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import AppModal from "@/components/ui/AppModal";
import { RENEWAL_CATEGORY_META } from "@/lib/cuantocobro/equipment/constants";
import { cameraFromLegacyProfile } from "@/lib/cuantocobro/equipment/normalize";
import { cn } from "@/lib/utils";
import type { CuantoCobroEquipmentRenewal, EquipmentRenewalCategoryId } from "@/lib/cuantocobro/equipment/types";
import type { CuantoCobroProfileInput } from "@/lib/cuantocobro/types";

type Props = {
  open: boolean;
  categoryId: EquipmentRenewalCategoryId | null;
  profile: CuantoCobroProfileInput;
  renewal: CuantoCobroEquipmentRenewal;
  onClose: () => void;
  onProfileChange: <K extends keyof CuantoCobroProfileInput>(
    key: K,
    value: CuantoCobroProfileInput[K],
  ) => void;
  onRenewalChange: (renewal: CuantoCobroEquipmentRenewal) => void;
};

export default function EquipmentCategoryModal({
  open,
  categoryId,
  profile,
  renewal,
  onClose,
  onProfileChange,
  onRenewalChange,
}: Props) {
  if (!categoryId) return null;

  const meta = RENEWAL_CATEGORY_META[categoryId];

  const handleProfileChange = <K extends keyof CuantoCobroProfileInput>(
    key: K,
    value: CuantoCobroProfileInput[K],
  ) => {
    onProfileChange(key, value);
    if (categoryId === "camera") {
      const nextProfile = { ...profile, [key]: value };
      const camera = cameraFromLegacyProfile(nextProfile);
      if (camera) {
        onRenewalChange({
          ...renewal,
          camera: {
            ...camera,
            resaleValue: renewal.camera?.resaleValue ?? "",
          },
        });
      }
    }
  };

  const handleClear = () => {
    onRenewalChange(clearRenewalCategory(categoryId, renewal));
    onClose();
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={meta.title}
      description={categoryId === "camera" ? undefined : meta.description}

      maxWidthCapRem="42rem"
      panelClassName={cn("cc-equipment-modal", categoryId === "camera" && "cc-equipment-modal--fit")}
      contentClassName="!p-0"
      zIndexClass="z-[95]"
    >
      {categoryId === "camera" ? (
        <div className="cc-equipment-modal__body">
          <EquipmentRenewalCategoryForm
            categoryId={categoryId}
            profile={profile}
            renewal={renewal}
            compact
            onProfileChange={handleProfileChange}
            onRenewalChange={onRenewalChange}
          />
        </div>
      ) : (
        <div className="cc-equipment-modal__scroll">
          <div className="cc-equipment-modal__body">
            <EquipmentRenewalCategoryForm
              categoryId={categoryId}
              profile={profile}
              renewal={renewal}
              onProfileChange={handleProfileChange}
              onRenewalChange={onRenewalChange}
            />
          </div>
        </div>
      )}
      <footer className="cc-equipment-modal__footer">
        {categoryId !== "camera" ? (
          <CuantoCobroButton
            type="button"
            variant="outline"

            className="min-h-[44px] w-full sm:w-auto"
            onClick={handleClear}
          >
            Vaciar categoría
          </CuantoCobroButton>
        ) : null}
        <div className="cc-equipment-modal__footer-primary">
          <CuantoCobroButton
            type="button"
            variant="outline"

            className="min-h-[44px] w-full sm:w-auto sm:min-w-[7rem]"
            onClick={onClose}
          >
            Cerrar
          </CuantoCobroButton>
          <CuantoCobroButton
            type="button"
            variant="primary"


            className="min-h-[44px] w-full sm:w-auto sm:min-w-[10rem]"
            onClick={onClose}
          >
            Listo
          </CuantoCobroButton>
        </div>
      </footer>
    </AppModal>
  );
}
