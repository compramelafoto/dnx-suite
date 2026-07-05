"use client";

import EquipmentCategoryCard from "@/components/cuantocobro/equipment/EquipmentCategoryCard";
import EquipmentCategoryModal from "@/components/cuantocobro/equipment/EquipmentCategoryModal";
import EquipmentFutureSection from "@/components/cuantocobro/equipment/EquipmentFutureSection";
import EquipmentSavingsSummary from "@/components/cuantocobro/equipment/EquipmentSavingsSummary";
import EquipmentSectionHelp from "@/components/cuantocobro/equipment/EquipmentSectionHelp";
import {
  buildRenewalCategoryCards,
  computeEquipmentSavings,
} from "@/lib/cuantocobro/equipment/calculations";
import {
  CC_EQUIPMENT_EXPANSION_HELP,
  CC_EQUIPMENT_EXPANSION_INTRO,
  CC_EQUIPMENT_RENEWAL_HELP,
  CC_EQUIPMENT_RENEWAL_INTRO,
} from "@/lib/cuantocobro/equipment/constants";
import {
  applyEquipmentInventory,
  getProfileEquipmentInventory,
} from "@/lib/cuantocobro/equipment/profile-updates";
import type { EquipmentRenewalCategoryId } from "@/lib/cuantocobro/equipment/types";
import type { CuantoCobroProfileInput } from "@/lib/cuantocobro/types";
import { useState } from "react";

type Props = {
  profile: CuantoCobroProfileInput;
  onProfileChange: <K extends keyof CuantoCobroProfileInput>(
    key: K,
    value: CuantoCobroProfileInput[K],
  ) => void;
  onProfilePatch?: (patch: Partial<CuantoCobroProfileInput>) => void;
};

export default function EquipmentStep({ profile, onProfileChange, onProfilePatch }: Props) {
  const [activeCategory, setActiveCategory] = useState<EquipmentRenewalCategoryId | null>(null);
  const inventory = getProfileEquipmentInventory(profile);
  const savings = computeEquipmentSavings(profile);
  const renewalCards = buildRenewalCategoryCards(profile);
  const configuredCount = renewalCards.filter((card) => card.status === "configured").length;

  const handleInventoryChange = (nextInventory: typeof inventory) => {
    const nextProfile = applyEquipmentInventory(profile, nextInventory);
    if (onProfilePatch) {
      onProfilePatch({
        equipmentInventory: nextProfile.equipmentInventory,
        equipmentRenewalMonthly: nextProfile.equipmentRenewalMonthly,
        primaryCameraPresetId: nextProfile.primaryCameraPresetId,
        primaryCameraCustomName: nextProfile.primaryCameraCustomName,
        primaryCameraShutterRating: nextProfile.primaryCameraShutterRating,
        primaryCameraCurrentShutterCount: nextProfile.primaryCameraCurrentShutterCount,
        primaryCameraReplacementValue: nextProfile.primaryCameraReplacementValue,
        estimatedAnnualShots: nextProfile.estimatedAnnualShots,
      });
      return;
    }
    onProfileChange("equipmentInventory", nextProfile.equipmentInventory);
  };

  const handleRenewalChange = (renewal: typeof inventory.renewal) => {
    handleInventoryChange({ ...inventory, renewal });
  };

  return (
    <div className="ds-stack-section cc-equipment-step">
      <EquipmentSavingsSummary savings={savings} currency={profile.currency} />

      <section className="cc-equipment-section" aria-labelledby="cc-equipment-renewal">
        <div className="cc-equipment-section__header">
          <h4 id="cc-equipment-renewal" className="cc-equipment-section__title m-0">
            Renovación de mi equipamiento
          </h4>
          {configuredCount > 0 ? (
            <span className="cc-equipment-section__badge" aria-live="polite">
              {configuredCount} de {renewalCards.length}
            </span>
          ) : null}
        </div>
        <p className="cc-equipment-section__intro m-0">{CC_EQUIPMENT_RENEWAL_INTRO}</p>
        <EquipmentSectionHelp summary="¿Qué va en esta sección?">
          {CC_EQUIPMENT_RENEWAL_HELP}
        </EquipmentSectionHelp>
        <div className="cc-equipment-cards-grid">
          {renewalCards.map((card) => (
            <EquipmentCategoryCard
              key={card.id}
              card={card}
              currency={profile.currency}
              onConfigure={() => setActiveCategory(card.id)}
            />
          ))}
        </div>
      </section>

      <section className="cc-equipment-section" aria-labelledby="cc-equipment-expansion">
        <div className="cc-equipment-section__header">
          <h4 id="cc-equipment-expansion" className="cc-equipment-section__title m-0">
            Equipos que deseo comprar
          </h4>
          {inventory.futureEquipment.length > 0 ? (
            <span className="cc-equipment-section__badge" aria-live="polite">
              {inventory.futureEquipment.length}
            </span>
          ) : null}
        </div>
        <p className="cc-equipment-section__intro m-0">{CC_EQUIPMENT_EXPANSION_INTRO}</p>
        <EquipmentSectionHelp summary="¿En qué se diferencia de renovación?">
          {CC_EQUIPMENT_EXPANSION_HELP}
        </EquipmentSectionHelp>
        <EquipmentFutureSection
          profile={profile}
          inventory={inventory}
          onInventoryChange={handleInventoryChange}
        />
      </section>

      <EquipmentCategoryModal
        open={activeCategory !== null}
        categoryId={activeCategory}
        profile={profile}
        renewal={inventory.renewal}
        onClose={() => setActiveCategory(null)}
        onProfileChange={onProfileChange}
        onRenewalChange={handleRenewalChange}
      />
    </div>
  );
}
