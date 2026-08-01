import type { CommunicationBrand } from "../branding/types";

export function EmailDivider(brand: CommunicationBrand): string {
  return `<hr style="border:0;border-top:1px solid ${brand.borderColor};margin:24px 0;" />`;
}
