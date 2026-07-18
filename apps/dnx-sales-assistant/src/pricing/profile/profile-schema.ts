import { z } from "zod";

const commercialPositioningIdSchema = z.enum([
  "starting",
  "growing",
  "stable",
  "established",
  "high-demand",
  "",
]);

export const pricingExpenseLineSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  monthlyAmount: z.number(),
  enabled: z.boolean(),
  category: z.string().optional(),
});

export const pricingTimeDistributionSchema = z.object({
  coverage: z.number(),
  editing: z.number(),
  administration: z.number(),
  sales: z.number(),
  marketing: z.number(),
  training: z.number(),
});

export const pricingAvailabilitySchema = z.object({
  weeklyHours: z.number(),
  timeDistribution: pricingTimeDistributionSchema,
  billableHoursWeekly: z.number().optional(),
  vacationWeeksPerYear: z.number().optional(),
  nonWorkingWeeksPerYear: z.number().optional(),
});

export const pricingReservesSchema = z.object({
  equipmentRenewalMonthly: z.number(),
  emergencyFundMonthly: z.number(),
  savingsGoalsMonthly: z.number(),
  vacationReserveMonthly: z.number(),
});

export const pricingEquipmentItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: z.enum([
    "CAMERA",
    "LENS",
    "FLASH",
    "COMPUTER",
    "DISK",
    "MEMORY",
    "OTHER",
  ]),
  enabled: z.boolean(),
  replacementValue: z.number().optional(),
  usefulLifeYears: z.number().optional(),
  ageYears: z.number().optional(),
  shutterRating: z.number().optional(),
  currentShutterCount: z.number().optional(),
  estimatedAnnualShots: z.number().optional(),
  quantity: z.number().optional(),
});

export const pricingProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  configured: z.boolean(),
  profileVersion: z.string().min(1),
  formulaVersion: z.string().min(1),
  currency: z.string(),
  commercialPositioningId: commercialPositioningIdSchema,
  source: z.literal("DNX_STUDIO_CONFIG"),
  updatedAt: z.string().min(1),
  notes: z.string().optional(),
  income: z.object({
    livesOnlyFromPhotography: z.enum(["yes", "no"]),
    externalMonthlyIncome: z.number(),
  }),
  personalExpenses: z.array(pricingExpenseLineSchema),
  businessExpenses: z.array(pricingExpenseLineSchema),
  availability: pricingAvailabilitySchema,
  reserves: pricingReservesSchema,
  equipment: z.array(pricingEquipmentItemSchema),
});

export type PricingProfileParsed = z.infer<typeof pricingProfileSchema>;
