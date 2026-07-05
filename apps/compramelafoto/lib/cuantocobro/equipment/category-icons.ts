import {
  Aperture,
  Battery,
  Camera,
  HardDrive,
  Laptop,
  Lightbulb,
  MemoryStick,
  Monitor,
  Package,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { EquipmentRenewalCategoryId } from "./types";

/** Todas las categorías de renovación — útil para tests de cobertura de íconos. */
export const EQUIPMENT_RENEWAL_CATEGORY_IDS: EquipmentRenewalCategoryId[] = [
  "camera",
  "lenses",
  "memory-cards",
  "computer",
  "monitor",
  "storage-disks",
  "speedlight",
  "studio-flash",
  "aa-batteries",
];

const CATEGORY_ICONS: Record<EquipmentRenewalCategoryId, LucideIcon> = {
  camera: Camera,
  lenses: Aperture,
  "memory-cards": MemoryStick,
  computer: Laptop,
  monitor: Monitor,
  "storage-disks": HardDrive,
  speedlight: Zap,
  "studio-flash": Lightbulb,
  "aa-batteries": Battery,
};

const FALLBACK_ICON: LucideIcon = Package;

/** Ícono Lucide para una categoría de renovación. Nunca devuelve undefined. */
export function getEquipmentCategoryIcon(categoryId: EquipmentRenewalCategoryId): LucideIcon {
  return CATEGORY_ICONS[categoryId] ?? FALLBACK_ICON;
}

export { FALLBACK_ICON as EQUIPMENT_CATEGORY_FALLBACK_ICON };
