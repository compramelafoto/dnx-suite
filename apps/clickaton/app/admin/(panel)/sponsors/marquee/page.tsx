import { redirect } from "next/navigation";
import { adminRoutes } from "@/config/admin/navigation";

/** Hub: slider de marcas se gestiona en el CRM central de Sponsors. */
export default function AdminSponsorsMarqueeHubPage() {
  redirect(adminRoutes.sponsors);
}
