"use client";

import EquipmentStep from "@/components/cuantocobro/equipment/EquipmentStep";
import type { CuantoCobroProfileInput } from "@/lib/cuantocobro/types";

type Props = {
  profile: CuantoCobroProfileInput;
  onProfileChange: <K extends keyof CuantoCobroProfileInput>(
    key: K,
    value: CuantoCobroProfileInput[K],
  ) => void;
  onProfilePatch?: (patch: Partial<CuantoCobroProfileInput>) => void;
};

export default function InvestmentStep({ profile, onProfileChange, onProfilePatch }: Props) {
  return (
    <EquipmentStep
      profile={profile}
      onProfileChange={onProfileChange}
      onProfilePatch={onProfilePatch}
    />
  );
}
