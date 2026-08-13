import { redirect } from "next/navigation";
import { adminRoutes } from "@/config/admin/navigation";

/** Hub: campañas se gestionan en el CRM central de Sponsors. */
export default function AdminSponsorsCampanasHubPage() {
  redirect(adminRoutes.sponsors);
}
