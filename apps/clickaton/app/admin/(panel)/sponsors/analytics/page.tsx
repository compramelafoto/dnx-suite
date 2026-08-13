import { redirect } from "next/navigation";
import { adminRoutes } from "@/config/admin/navigation";

/** Hub: analytics globales en el panel de estado (sin duplicar CRM). */
export default function AdminSponsorsAnalyticsHubPage() {
  redirect(`${adminRoutes.sponsorsGlobalStatus}#analytics`);
}
