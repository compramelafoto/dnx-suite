import type { DateRange } from "../window/day-window";

/** Espeja el enum `OrderOrigin` del esquema: son exactamente estos tres. */
export type OrderOriginKey = "STANDARD_CHECKOUT" | "PACK_REDEMPTION" | "PREVENTA_PACK";

/**
 * Fila de pedido pagado, ya normalizada.
 *
 * `totalArs` está en PESOS ENTEROS. En la base la columna se llama
 * `Order.totalCents` por compatibilidad histórica, pero no son centavos.
 * El adaptador es responsable de no dividir por cien.
 */
export type PaidOrderRow = {
  orderId: number;
  totalArs: number;
  photographerId: number;
  photographerName: string;
  albumId: number;
  albumTitle: string;
  itemCount: number;
  origin: OrderOriginKey;
};

export interface ClfSalesPort {
  /** Pedidos pagados en el rango, excluyendo los marcados como prueba. */
  paidOrders(range: DateRange): Promise<PaidOrderRow[]>;
  countPendingOrders(range: DateRange): Promise<number>;
  countNewUsers(range: DateRange): Promise<number>;
  countNewAlbums(range: DateRange): Promise<number>;
  countUploadedPhotos(range: DateRange): Promise<number>;
}

export type QueueHealth = {
  pending: number;
  failed: number;
  oldestPendingAt: Date | null;
};

export type JobHealth = {
  label: string;
  pending: number;
  failed: number;
  stuck: number;
  oldestPendingAt: Date | null;
};

export interface IncidentsPort {
  emailQueue(): Promise<QueueHealth>;
  unreconciledPaidOrders(olderThanHours: number): Promise<{ count: number; oldestAt: Date | null }>;
  openFraudAlerts(): Promise<{ count: number; oldestAt: Date | null }>;
  jobHealth(): Promise<JobHealth[]>;
}

export type FaceRecognitionStats = {
  photosAnalyzedDone: number;
  photosAnalyzedPending: number;
  photosAnalyzedError: number;
  facesDetected: number;
  matchEvents: number;
  interestsWithSearch: number;
  interestsWithAnyMatch: number;
  oldestPendingAt: Date | null;
};

export interface FaceRecognitionPort {
  stats(range: DateRange): Promise<FaceRecognitionStats>;
}
