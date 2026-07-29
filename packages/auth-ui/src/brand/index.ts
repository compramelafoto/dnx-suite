import type { DnxAuthApplicationId, DnxAuthBrandConfig } from "../types";
import { clickatonAuthBrand } from "./clickaton";
import { compramelafotoAuthBrand } from "./compramelafoto";
import { fotofficeAuthBrand } from "./fotoffice";
import { fotorankAuthBrand } from "./fotorank";
import { infospotAuthBrand } from "./infospot";

export {
  clickatonAuthBrand,
  compramelafotoAuthBrand,
  fotofficeAuthBrand,
  fotorankAuthBrand,
  infospotAuthBrand,
};

const BRANDS: Record<string, DnxAuthBrandConfig> = {
  clickaton: clickatonAuthBrand,
  compramelafoto: compramelafotoAuthBrand,
  fotorank: fotorankAuthBrand,
  infospot: infospotAuthBrand,
  fotoffice: fotofficeAuthBrand,
};

export function getAuthBrandConfig(applicationId: DnxAuthApplicationId): DnxAuthBrandConfig {
  const brand = BRANDS[applicationId];
  if (!brand) {
    throw new Error(`No hay DnxAuthBrandConfig para applicationId=${applicationId}`);
  }
  return brand;
}

export function listAuthBrandConfigs(): DnxAuthBrandConfig[] {
  return Object.values(BRANDS);
}
