import { CommunicationError } from "../../shared/errors";
import type { CommunicationBrand, RegisterBrandOptions } from "./types";

export class CommunicationBrandRegistry {
  private readonly brands = new Map<string, CommunicationBrand>();

  registerBrand(brand: CommunicationBrand, options: RegisterBrandOptions = {}): void {
    const id = brand.id?.trim();
    if (!id) {
      throw new CommunicationError("INVALID_REQUEST", "Brand.id es obligatorio.");
    }
    if (this.brands.has(id) && !options.replace) {
      throw new CommunicationError(
        "INVALID_REQUEST",
        `Brand "${id}" ya registrado. Usá { replace: true }.`,
        { brandId: id },
      );
    }
    this.brands.set(id, { ...brand, id });
  }

  getBrand(id: string): CommunicationBrand {
    const brand = this.brands.get(id);
    if (!brand) {
      throw new CommunicationError(
        "BRAND_NOT_FOUND",
        `Brand inexistente: "${id}".`,
        { brandId: id },
      );
    }
    return brand;
  }

  tryGetBrand(id: string): CommunicationBrand | undefined {
    return this.brands.get(id);
  }

  hasBrand(id: string): boolean {
    return this.brands.has(id);
  }

  removeBrand(id: string): boolean {
    return this.brands.delete(id);
  }

  clearBrands(): void {
    this.brands.clear();
  }

  listBrands(): CommunicationBrand[] {
    return [...this.brands.values()];
  }
}

export function createBrandRegistry(
  seed: CommunicationBrand[] = [],
): CommunicationBrandRegistry {
  const registry = new CommunicationBrandRegistry();
  for (const brand of seed) {
    registry.registerBrand(brand);
  }
  return registry;
}
