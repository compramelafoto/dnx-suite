import { redirect } from "next/navigation";
import { adminRoutes } from "@/config/admin/navigation";

/** Hub: assets se gestionan en el CRM central de Sponsors. */
export default function AdminSponsorsAssetsHubPage() {
  redirect(adminRoutes.sponsors);
}
