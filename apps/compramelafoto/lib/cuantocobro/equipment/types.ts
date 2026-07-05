/** Propósito del ítem de equipamiento en el inventario. */
export type EquipmentPurpose = "RENEWAL_CURRENT_EQUIPMENT" | "FUTURE_EXPANSION_EQUIPMENT";

export type EquipmentRenewalCategoryId =
  | "camera"
  | "lenses"
  | "memory-cards"
  | "computer"
  | "monitor"
  | "storage-disks"
  | "speedlight"
  | "studio-flash"
  | "aa-batteries";

export type FutureEquipmentCategoryId =
  | EquipmentRenewalCategoryId
  | "drone"
  | "other";

export type FutureEquipmentTimeline = "" | "1" | "2" | "3" | "none";

export type RenewalCameraData = {
  presetId: string;
  customName: string;
  shutterRating: string;
  currentShutterCount: string;
  replacementValue: string;
  resaleValue: string;
  estimatedAnnualShots: string;
};

export type RenewalLensItem = {
  id: string;
  model: string;
  replacementValue: string;
  yearsOwned: string;
  resaleValue: string;
};

export type RenewalMemoryCardsData = {
  quantity: string;
  averagePrice: string;
};

export type RenewalComputerData = {
  replacementValue: string;
  yearsOwned: string;
};

export type RenewalMonitorData = RenewalComputerData;

export type RenewalStorageDisksData = {
  currentCapacityTb: string;
  replacementPrice: string;
};

export type RenewalSpeedlightData = {
  quantity: string;
  averagePrice: string;
  lifespanYears: string;
  usesAABatteries: "" | "yes" | "no";
};

export type RenewalStudioFlashData = {
  quantity: string;
  averagePrice: string;
  lifespanYears: string;
};

export type RenewalAABatteriesData = {
  monthlyCost: string;
};

export type FutureEquipmentItem = {
  id: string;
  purpose: "FUTURE_EXPANSION_EQUIPMENT";
  category: FutureEquipmentCategoryId;
  name: string;
  estimatedPrice: string;
  desiredTimeline: FutureEquipmentTimeline;
  note: string;
};

export type CuantoCobroEquipmentRenewal = {
  camera: RenewalCameraData | null;
  lenses: RenewalLensItem[];
  memoryCards: RenewalMemoryCardsData | null;
  computer: RenewalComputerData | null;
  monitor: RenewalMonitorData | null;
  storageDisks: RenewalStorageDisksData | null;
  speedlight: RenewalSpeedlightData | null;
  studioFlash: RenewalStudioFlashData | null;
  aaBatteries: RenewalAABatteriesData | null;
};

export type CuantoCobroEquipmentInventory = {
  renewal: CuantoCobroEquipmentRenewal;
  futureEquipment: FutureEquipmentItem[];
};

export type EquipmentCategoryStatus = "pending" | "configured";

export type EquipmentCategoryCardMeta = {
  id: EquipmentRenewalCategoryId;
  title: string;
  description: string;
  status: EquipmentCategoryStatus;
  itemCount: number;
  monthlyContribution: number | null;
};

export type EquipmentSavingsBreakdown = {
  renewalMonthly: number;
  expansionMonthly: number;
  totalMonthly: number;
  renewalByCategory: Partial<Record<EquipmentRenewalCategoryId, number>>;
  expansionByItem: Array<{ id: string; name: string; monthly: number }>;
  usesLegacyRenewalFallback: boolean;
};
