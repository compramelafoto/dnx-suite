/**
 * DTOs desacoplados — misma forma conceptual que CuantoCobroProfileInput / QuoteInput.
 * No importan ComprameLaFoto. Strings numéricos donde el motor real los exige.
 */

export type CompatibleCommercialPositioningId =
  | "starting"
  | "growing"
  | "stable"
  | "established"
  | "high-demand"
  | "";

export type CompatibleCommercialDisplayMode = "detailed" | "total-only" | "grouped";

export type CompatibleQuoteItemType =
  | "own-service"
  | "physical-product"
  | "outsourced"
  | "expense";

/** jobType estable del motor (valores de CC_CONSULTA_JOB_TYPE_OPTIONS). */
export type CompatibleJobTypeValue =
  | "boda"
  | "evento"
  | "retrato"
  | "producto"
  | "escolar"
  | "otro";

export type CompatibleMonthlyExpenseItem = {
  id: string;
  label: string;
  amount: string;
  isCustom: boolean;
};

export type CompatibleMonthlyExpenseGroup = {
  id: string;
  title: string;
  description?: string;
  items: CompatibleMonthlyExpenseItem[];
};

export type CompatibleTimeDistribution = {
  coverage: string;
  editing: string;
  administration: string;
  sales: string;
  marketing: string;
  training: string;
};

export type CompatibleRenewalCameraData = {
  presetId: string;
  customName: string;
  shutterRating: string;
  currentShutterCount: string;
  replacementValue: string;
  resaleValue: string;
  estimatedAnnualShots: string;
};

export type CompatibleRenewalLensItem = {
  id: string;
  model: string;
  replacementValue: string;
  yearsOwned: string;
  resaleValue: string;
};

export type CompatibleRenewalMemoryCardsData = {
  quantity: string;
  averagePrice: string;
};

export type CompatibleRenewalComputerData = {
  replacementValue: string;
  yearsOwned: string;
};

export type CompatibleRenewalStorageDisksData = {
  currentCapacityTb: string;
  replacementPrice: string;
};

export type CompatibleRenewalSpeedlightData = {
  quantity: string;
  averagePrice: string;
  lifespanYears: string;
  usesAABatteries: "" | "yes" | "no";
};

export type CompatibleEquipmentRenewal = {
  camera: CompatibleRenewalCameraData | null;
  lenses: CompatibleRenewalLensItem[];
  memoryCards: CompatibleRenewalMemoryCardsData | null;
  computer: CompatibleRenewalComputerData | null;
  monitor: CompatibleRenewalComputerData | null;
  storageDisks: CompatibleRenewalStorageDisksData | null;
  speedlight: CompatibleRenewalSpeedlightData | null;
  studioFlash: CompatibleRenewalSpeedlightData | null;
  aaBatteries: { monthlyCost: string } | null;
};

export type CompatibleEquipmentInventory = {
  renewal: CompatibleEquipmentRenewal;
  futureEquipment: [];
};

export type CuantoCobroCompatibleProfile = {
  currency: string;
  livesOnlyFromPhotography: "" | "yes" | "no";
  externalMonthlyIncome: string;
  personalExpenseGroups: CompatibleMonthlyExpenseGroup[];
  businessRent: string;
  businessSoftware: string;
  businessMarketing: string;
  employeesCount: string;
  employeeMonthlyCost: string;
  weeklyHours: string;
  timeDistribution: CompatibleTimeDistribution;
  daysPerWeek: string;
  externalWorkSituation: "";
  externalWorkWeeklyHours: string;
  equipmentRenewalMonthly: string;
  primaryCameraPresetId: string;
  primaryCameraCustomName: string;
  primaryCameraShutterRating: string;
  primaryCameraCurrentShutterCount: string;
  primaryCameraReplacementValue: string;
  estimatedAnnualShots: string;
  equipmentInventory: CompatibleEquipmentInventory;
  emergencyFundMonthly: string;
  savingsGoalsMonthly: string;
  commercialPositioningId: CompatibleCommercialPositioningId;
};

export type CompatibleClientHours = {
  salesHours: string;
  meetingsHours: string;
  generalPrepHours: string;
  coordinationHours: string;
  billingHours: string;
  followUpHours: string;
  administrativeDeliveryHours: string;
};

export type CompatibleClient = {
  name: string;
  company: string;
  email: string;
  phone: string;
  jobDate: string;
  jobLocation: string;
  jobLatitude: string;
  jobLongitude: string;
  jobType: CompatibleJobTypeValue | string;
  hours: CompatibleClientHours;
};

export type CompatibleQuoteItem = {
  id: string;
  name: string;
  description: string;
  quantity: string;
  itemType: CompatibleQuoteItemType;
  coverageHours: string;
  editingHours: string;
  selectionHours: string;
  deliveryHours: string;
  travelHours: string;
  administrationHours: string;
  salesHours: string;
  directCost: string;
  estimatedShots: string;
  supplierCost: string;
  productionHours: string;
  reviewHours: string;
  correctionHours: string;
  packagingCost: string;
  shippingCost: string;
  outsourcedLaborCost: string;
  managementHours: string;
  expenseCost: string;
  desiredMarginPercent: string;
};

export type CompatiblePaymentOptions = {
  cashEnabled: boolean;
  cashDiscountPercent: string;
  cashCommercialNote: string;
  installmentPlans: [];
};

export type CuantoCobroCompatibleQuote = {
  client: CompatibleClient;
  concepts: CompatibleQuoteItem[];
  internalNotes: string;
  commercialDisplayMode: CompatibleCommercialDisplayMode;
  commercialNote: string;
  chosenPrice: string;
  paymentOptions: CompatiblePaymentOptions;
  status: "draft";
};

export type CuantoCobroCompatibleCalculationInput = {
  profile: CuantoCobroCompatibleProfile;
  quote: CuantoCobroCompatibleQuote;
};

export const SYNTHETIC_CLIENT_NAME = "Cliente por confirmar";
export const ADAPTER_FORMULA_VERSION_EXPECTED = "clf-orchestrator-characterized";
