import { redirect } from "next/navigation";
import { requireServiceLeadsContext } from "@/lib/workspace";

/**
 * La bandeja de consultas pasó al panel: Captación vive en `/captacion`. La puerta del módulo
 * (encendido + nivel Ver) corre igual antes de redirigir, como en el resto de Captación.
 */
export default async function ServiceLeadsPage() {
  await requireServiceLeadsContext();
  redirect("/captacion");
}
