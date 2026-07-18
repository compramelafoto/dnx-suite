import { z } from "zod";

const serviceTypeSchema = z.enum([
  "WEDDING",
  "FIFTEENTH_BIRTHDAY",
  "BIRTHDAY",
  "CORPORATE_EVENT",
  "SOCIAL_EVENT",
  "PORTRAIT_SESSION",
  "FAMILY_SESSION",
  "PRODUCT_PHOTOGRAPHY",
  "SCHOOL_PHOTOGRAPHY",
  "SPORTS_EVENT",
  "OTHER",
]);

export const pricingConceptTemplateSchema = z.object({
  id: z.string().min(1),
  configured: z.boolean(),
  type: z.enum(["OWN_SERVICE", "PRODUCT", "OUTSOURCED", "EXPENSE"]),
  label: z.string().min(1),
  calculationMode: z.enum(["FIXED", "PER_COVERAGE_HOUR", "PER_UNIT", "MANUAL"]),
  hours: z.number().optional(),
  hoursPerCoverageHour: z.number().optional(),
  directCost: z.number().optional(),
  marginPercent: z.number().optional(),
  quantity: z.number().optional(),
  includeEquipmentWear: z.boolean().optional(),
});

export const pricingServiceTemplateSchema = z.object({
  id: z.string().min(1),
  configured: z.boolean(),
  serviceType: serviceTypeSchema,
  templateVersion: z.string().min(1),
  formulaVersion: z.string().min(1),
  coverage: z.object({
    minimumHours: z.number(),
    maximumHours: z.number(),
    defaultHours: z.number().optional(),
  }),
  editing: z.object({
    mode: z.enum(["FIXED_HOURS", "HOURS_PER_COVERAGE_HOUR", "MANUAL"]),
    fixedHours: z.number().optional(),
    hoursPerCoverageHour: z.number().optional(),
  }),
  generalClientHours: z.object({
    sales: z.number(),
    meetings: z.number(),
    preparation: z.number(),
    coordination: z.number(),
    billing: z.number(),
    followUp: z.number(),
    deliveryAdministration: z.number(),
  }),
  concepts: z.array(pricingConceptTemplateSchema),
  requiredQuestions: z.array(z.string()),
  notes: z.string().optional(),
});

export const pricingServiceTemplateCatalogSchema = z.object({
  configured: z.boolean(),
  catalogVersion: z.string().min(1),
  formulaVersion: z.string().min(1),
  templates: z.array(pricingServiceTemplateSchema),
});
