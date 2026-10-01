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

/**
 * Inscripción de Clickatón, ya normalizada.
 *
 * OJO: al revés que ComprameLaFoto, en Clickatón los importes de la base SÍ
 * están en centavos ("minor units"). El adaptador los convierte a pesos antes
 * de llegar acá, así el colector trabaja siempre con la misma unidad.
 */
export type ClickatonRegistrationRow = {
  registrationId: string;
  editionId: string;
  editionName: string;
  ticketTypeName: string;
  /** CONFIRMED, PENDING_PAYMENT, EXPIRED, CANCELLED, … */
  status: string;
  paymentStatus: string;
  totalArs: number;
};

export type ClickatonStoreOrderRow = {
  orderId: string;
  editionId: string | null;
  editionName: string | null;
  totalArs: number;
  items: Array<{ productName: string; quantity: number; subtotalArs: number }>;
};

export type ClickatonActivity = {
  photoSubmissions: number;
  photoSubmissionsByStatus: Record<string, number>;
  checkIns: number;
};

export interface ClickatonPort {
  /** Inscripciones creadas en el rango, excluyendo las de modo test. */
  registrations(range: DateRange): Promise<ClickatonRegistrationRow[]>;
  /** Pedidos de tienda pagados en el rango. */
  storeOrders(range: DateRange): Promise<ClickatonStoreOrderRow[]>;
  activity(range: DateRange): Promise<ClickatonActivity>;
}

/** Inscripción a un concurso de FotoRank. Importes ya convertidos a pesos. */
export type FotorankRegistrationRow = {
  registrationId: string;
  contestId: string;
  contestTitle: string;
  /** CONFIRMED, PENDING_PAYMENT, DRAFT, CANCELLED, … */
  status: string;
  priceArs: number;
};

export type FotorankActivity = {
  /** Concursos con inscripción abierta al momento de generar el informe. */
  activeContests: number;
  /** Obras enviadas en el rango. */
  entriesSubmitted: number;
  entriesByStatus: Record<string, number>;
  /** Obras esperando revisión manual, sin importar cuándo llegaron. */
  entriesAwaitingReview: number;
  /** Votos o evaluaciones de jurado registrados en el rango. */
  juryVotes: number;
  activeJudges: number;
  diplomasIssued: number;
};

export interface FotorankPort {
  registrations(range: DateRange): Promise<FotorankRegistrationRow[]>;
  activity(range: DateRange): Promise<FotorankActivity>;
}

export type InfoSpotTopArticle = {
  title: string;
  views: number;
};

export type InfoSpotStats = {
  articlesPublished: number;
  articlesInReview: number;
  articleViews: number;
  topArticles: InfoSpotTopArticle[];
  newCoverages: number;
  /** Clics que derivan tráfico a ComprameLaFoto. */
  clicksToClf: number;
};

export interface InfoSpotPort {
  stats(range: DateRange): Promise<InfoSpotStats>;
}

export type FotofficeStats = {
  newWorkspaces: number;
  totalWorkspaces: number;
  newMembers: number;
  totalMembers: number;
  newServiceLeads: number;
  newCourseLeads: number;
  /** Consultas todavía sin atender, sin importar cuándo llegaron. */
  pendingLeads: number;
  publishedWebsites: number;
  enabledModules: Record<string, number>;
};

export interface FotofficePort {
  stats(range: DateRange): Promise<FotofficeStats>;
}

/**
 * Factura de un proveedor de Finanzas DNX, vencida y todavía sin pagar
 * (`RECHAZADO` o `IMPAGO`). Es el caso que pasó cuatro meses sin que nadie lo
 * viera: Neon rechazando facturas desde mayo, descubierto en septiembre.
 */
export type FinanceOverdueInvoice = {
  vendorKey: string;
  vendorName: string;
  /** Mes de la factura (el período que se cargó), 1-12. */
  periodMonth: number;
  /**
   * RECHAZADO = la tarjeta rechazó el cobro: la acción es revisar el medio
   * de pago, no volver a pagar. IMPAGO = nunca se pagó: la acción es pagarla.
   */
  status: "RECHAZADO" | "IMPAGO";
  /** Importe en pesos, ya convertido (Decimal → number en el borde). */
  amountArs: number;
  /** Importe en la moneda original de la factura. */
  amountOriginal: number;
  currency: "USD" | "ARS";
  daysOverdue: number;
  /** Fecha de vencimiento en ISO-8601, para saber cuál es la más vieja. */
  dueDate: string;
};

export type FinanceMissingVendor = {
  vendorKey: string;
  vendorName: string;
};

/**
 * `null` cuando todavía no corresponde reclamar (antes del día 5 del mes:
 * las facturas de algunos proveedores todavía pueden no haber llegado).
 */
export type FinanceMissingVendorsCheck = {
  vendors: FinanceMissingVendor[];
  /** Mes que se está reclamando: el actual, el que todavía no tiene nada cargado. */
  period: { year: number; month: number };
  /** Mes en el que estos proveedores sí tuvieron gasto: la evidencia de que están activos. */
  evidencePeriod: { year: number; month: number };
} | null;

export type FinanceMonthTotals = {
  billedArs: number;
  paidArs: number;
  /** Todas las facturas rechazadas o impagas, de cualquier mes, no sólo éste. */
  accumulatedDebtArs: number;
};

export interface FinancePort {
  /** Facturas RECHAZADO/IMPAGO con vencimiento pasado, de cualquier período. */
  overdueInvoices(): Promise<FinanceOverdueInvoice[]>;
  missingVendors(): Promise<FinanceMissingVendorsCheck>;
  monthTotals(): Promise<FinanceMonthTotals>;
}
