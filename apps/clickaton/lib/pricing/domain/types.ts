export type PricePhaseRecord = {
  id: string;
  editionId: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  priority: number;
  isActive: boolean;
};

export type PricePhaseInput = {
  name: string;
  description?: string | null;
  amount: number;
  currency?: string;
  startsAt: Date;
  endsAt: Date;
  capacity?: number | null;
  priority?: number;
  isActive?: boolean;
};

export type ResolvedPricePhase = {
  phase: PricePhaseRecord;
  /** Próxima fase activa con startsAt > now, si existe. */
  nextPhase: PricePhaseRecord | null;
};

export type PricePhaseOverlap = {
  aId: string;
  bId: string;
  aName: string;
  bName: string;
};
