/**
 * Cupos públicos — globales y por categoría.
 */

export type CapacityVisibility = "hidden" | "summary" | "detailed";

/**
 * Capacidad global de la edición.
 * No asumir que siempre se publica el conteo exacto.
 */
export type PublicCapacity = {
  marathonId: string;
  participantLimit?: number;
  registeredCount?: number;
  remainingPlaces?: number;
  waitlistEnabled: boolean;
  waitlistCount?: number;
  visibility: CapacityVisibility;
  updatedAt: string;
};

/**
 * Cupo por categoría. Opcional: no todas las categorías tienen cupo.
 */
export type PublicCategoryCapacity = {
  marathonId: string;
  categoryId: string;
  participantLimit?: number;
  registeredCount?: number;
  remainingPlaces?: number;
  waitlistEnabled?: boolean;
  waitlistCount?: number;
  visibility: CapacityVisibility;
  updatedAt: string;
};
