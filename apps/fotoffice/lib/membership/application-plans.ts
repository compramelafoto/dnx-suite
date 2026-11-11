import { z } from "zod";

/**
 * Elección de plan en el alta corta del sitio — la parte pura.
 *
 * Los planes son categorías del padrón: la de `MembershipDuesSettings.applicationCategoryId`
 * (la que ya existía, el VIP de Gus Barbers) más las marcadas con
 * `MemberCategory.offeredInOnlineApplication`. Con una sola, el alta se ve y funciona como
 * siempre; con varias, la persona elige. Si el plan incluye la BOX mensual, se pide el
 * domicilio de envío.
 */

export type ApplicationPlan = {
  id: string;
  name: string;
  description: string | null;
  order: number;
  selfRenew: boolean;
  includesMonthlyBox: boolean;
  bookingCreditsPerPayment: number;
  bookingCreditLabel: string | null;
};

export type ApplicationPlanCandidate = ApplicationPlan & {
  isActive: boolean;
  offeredInOnlineApplication: boolean;
};

/**
 * Qué planes se ofrecen: activos, y marcados o configurados como la categoría de las altas.
 * En el orden de la categoría (y por nombre ante un empate), que es como se ven en el padrón.
 */
export function offeredPlans(
  categories: ApplicationPlanCandidate[],
  applicationCategoryId: string | null,
): ApplicationPlan[] {
  return categories
    .filter((c) => c.isActive && (c.offeredInOnlineApplication || c.id === applicationCategoryId))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "es"))
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      order: c.order,
      selfRenew: c.selfRenew,
      includesMonthlyBox: c.includesMonthlyBox,
      bookingCreditsPerPayment: c.bookingCreditsPerPayment,
      bookingCreditLabel: c.bookingCreditLabel,
    }));
}

/**
 * El plan que aparece marcado al entrar: el de `?plan=` si se ofrece (los botones del sitio
 * enlazan así), si no la categoría de las altas, si no el primero.
 */
export function defaultPlanId(
  plans: ApplicationPlan[],
  applicationCategoryId: string | null,
  requested: string | null | undefined,
): string | null {
  const pedido = requested?.trim();
  if (pedido && plans.some((p) => p.id === pedido)) return pedido;
  if (applicationCategoryId && plans.some((p) => p.id === applicationCategoryId)) return applicationCategoryId;
  return plans[0]?.id ?? null;
}

export type PlanChoice = { ok: true; plan: ApplicationPlan | null } | { ok: false; error: string };

/**
 * El plan que mandó el formulario, contra lo que de verdad se ofrece. El id llega del navegador
 * y es editable: sólo vale si está en la lista que armó el servidor (activa, ofrecida y de esta
 * institución). Con un solo plan no hace falta elegir; sin planes, el alta entra sin categoría,
 * como siempre.
 */
export function choosePlan(plans: ApplicationPlan[], rawId: string | null | undefined): PlanChoice {
  if (plans.length === 0) return { ok: true, plan: null };
  const id = rawId?.trim();
  if (!id) {
    if (plans.length === 1) return { ok: true, plan: plans[0]! };
    return { ok: false, error: "Elegí un plan." };
  }
  const plan = plans.find((p) => p.id === id);
  if (!plan) return { ok: false, error: "Ese plan no está disponible. Elegí otro." };
  return { ok: true, plan };
}

const texto = (max: number) => z.string().trim().max(max);

/** El domicilio de envío de la BOX: todo obligatorio, sin él la caja no llega. */
const boxAddressSchema = z.object({
  address: texto(240).min(1, "Falta la calle y el número."),
  city: texto(120).min(1, "Falta la localidad."),
  province: texto(120).min(1, "Falta la provincia."),
  postalCode: texto(20).min(1, "Falta el código postal."),
});

export type BoxAddress = z.infer<typeof boxAddressSchema>;

export function parseBoxAddress(
  raw: Record<string, string | undefined>,
): { ok: true; data: BoxAddress } | { ok: false; error: string; field?: string } {
  const r = boxAddressSchema.safeParse({
    address: raw.address ?? "",
    city: raw.city ?? "",
    province: raw.province ?? "",
    postalCode: raw.postalCode ?? "",
  });
  if (!r.success) {
    const issue = r.error.issues[0];
    return { ok: false, error: issue?.message ?? "Revisá el domicilio.", field: issue?.path?.[0]?.toString() };
  }
  return { ok: true, data: r.data };
}

const CAMPOS_DOMICILIO = ["address", "noticeAddress", "city", "province", "postalCode"] as const;

/**
 * Prepara lo que mandó el formulario corto según el plan elegido, antes de la validación común
 * (`parseApplication`).
 *
 * Con BOX, el domicilio se valida y va a `noticeAddress` / `city` / `province` / `postalCode`
 * de la solicitud, que la aprobación copia tal cual a `Member.address` y compañía. Sin BOX, el
 * domicilio no se pide y se descarta lo que llegue: el alta queda igual que siempre.
 */
export function applyPlanToSimpleForm(
  raw: Record<string, string>,
  plan: ApplicationPlan | null,
): { ok: true; raw: Record<string, string> } | { ok: false; error: string } {
  const limpio: Record<string, string> = { ...raw };
  for (const k of CAMPOS_DOMICILIO) delete limpio[k];
  delete limpio.planId;
  if (!plan?.includesMonthlyBox) return { ok: true, raw: limpio };

  const domicilio = parseBoxAddress(raw);
  if (!domicilio.ok) return { ok: false, error: domicilio.error };
  return {
    ok: true,
    raw: {
      ...limpio,
      noticeAddress: domicilio.data.address,
      city: domicilio.data.city,
      province: domicilio.data.province,
      postalCode: domicilio.data.postalCode,
    },
  };
}

/** Cómo se llaman los turnos incluidos del plan, o null si no incluye. */
export function includedCreditsLabel(
  plan: Pick<ApplicationPlan, "bookingCreditsPerPayment" | "bookingCreditLabel"> | null,
): string | null {
  if (!plan || plan.bookingCreditsPerPayment <= 0) return null;
  return plan.bookingCreditLabel?.trim() || "turnos";
}

/**
 * Qué encuentra en el portal: sus turnos si el plan los incluye y la renovación si se renueva
 * sola. Para el VIP de la barbería sigue diciendo "donde ves tus cortes y renovás".
 */
export function portalAccessText(
  plan: Pick<ApplicationPlan, "bookingCreditsPerPayment" | "bookingCreditLabel" | "selfRenew"> | null,
): string {
  const partes: string[] = [];
  const turnos = includedCreditsLabel(plan);
  if (turnos) partes.push(`ves tus ${turnos}`);
  if (plan?.selfRenew) partes.push("renovás");
  return partes.length > 0
    ? `el acceso a tu portal, donde ${partes.join(" y ")}`
    : "el acceso a tu portal";
}
