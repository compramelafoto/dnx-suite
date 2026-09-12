import type { ExpenseVendor, VendorAllocation } from "@prisma/client";

type VendorConReparto = ExpenseVendor & { allocations: VendorAllocation[] };

export type VendorAllocationJson = Omit<VendorAllocation, "sharePercent"> & {
  sharePercent: number;
};

export type VendorJson = Omit<VendorConReparto, "allocations"> & {
  allocations: VendorAllocationJson[];
};

// Prisma devuelve sharePercent como Decimal; NextResponse.json() lo serializa
// como string y le come los decimales (60.00 -> "60"), así que acá lo pasamos
// a number antes de que la respuesta salga de la API.
export function toVendorJson(vendor: VendorConReparto): VendorJson {
  return {
    ...vendor,
    allocations: vendor.allocations.map((asignacion) => ({
      ...asignacion,
      sharePercent: asignacion.sharePercent.toNumber(),
    })),
  };
}
