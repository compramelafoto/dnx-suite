import { redirect } from "next/navigation";
import { adminRoutes } from "@/config/admin/navigation";

/** Hub: gráficas welcome se gestionan en el CRM central de Sponsors. */
export default function AdminSponsorsWelcomeGraphicsHubPage() {
  redirect(adminRoutes.sponsors);
}
