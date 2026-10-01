import { assertSharesSumTo100, isPlatformKey } from "@repo/finance-control";

export type VendorForm = {
  key: string;
  name: string;
  category: string;
  billingCurrency: "USD" | "ARS";
  billingCycle: string;
  paymentMethod: string | null;
  notes: string | null;
  /** Si el proveedor sigue vigente. Por defecto `true` cuando no se informa. */
  active: boolean;
  allocations: Array<{ platformKey: string; sharePercent: number }>;
};

export type VendorFormResult =
  | { ok: true; value: VendorForm }
  | { ok: false; error: string };

const CATEGORIAS = new Set([
  "INFRA",
  "IA",
  "EMAIL",
  "DOMINIO",
  "PUBLICIDAD",
  "LEGAL_CONTABLE",
  "COBROS",
  "OTRO",
]);
const CICLOS = new Set(["MENSUAL", "ANUAL", "USO", "UNICO"]);

export function parseVendorForm(raw: unknown): VendorFormResult {
  const datos = raw as Partial<VendorForm> | null;
  if (!datos || typeof datos !== "object") {
    return { ok: false, error: "No llegaron datos del proveedor." };
  }

  const key = String(datos.key ?? "").trim();
  if (!key) return { ok: false, error: "Falta la clave del proveedor." };

  const name = String(datos.name ?? "").trim();
  if (!name) return { ok: false, error: "Falta el nombre del proveedor." };

  const category = String(datos.category ?? "");
  if (!CATEGORIAS.has(category)) {
    return { ok: false, error: `La categoría "${category}" no existe.` };
  }

  const billingCurrency = String(datos.billingCurrency ?? "");
  if (billingCurrency !== "USD" && billingCurrency !== "ARS") {
    return { ok: false, error: "La moneda tiene que ser USD o ARS." };
  }

  const billingCycle = String(datos.billingCycle ?? "");
  if (!CICLOS.has(billingCycle)) {
    return { ok: false, error: `El ciclo "${billingCycle}" no existe.` };
  }

  const allocations = Array.isArray(datos.allocations) ? datos.allocations : [];
  for (const parte of allocations) {
    if (!isPlatformKey(String(parte.platformKey))) {
      return { ok: false, error: `La plataforma "${parte.platformKey}" no existe.` };
    }
  }

  try {
    assertSharesSumTo100(allocations);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Reparto inválido." };
  }

  // Si no viene el estado, el proveedor queda activo (comportamiento previo
  // a que este campo se pudiera editar).
  const active = datos.active === undefined ? true : Boolean(datos.active);

  return {
    ok: true,
    value: {
      key,
      name,
      category,
      billingCurrency,
      billingCycle,
      paymentMethod: datos.paymentMethod ? String(datos.paymentMethod) : null,
      notes: datos.notes ? String(datos.notes) : null,
      active,
      allocations: allocations.map((parte) => ({
        platformKey: String(parte.platformKey),
        sharePercent: Number(parte.sharePercent),
      })),
    },
  };
}
