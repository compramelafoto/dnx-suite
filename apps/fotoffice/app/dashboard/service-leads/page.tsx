import { redirect } from "next/navigation";
import { requireServiceLeadsContext } from "@/lib/workspace";

/**
 * La bandeja de consultas pasó al panel: el módulo Consultas (antes Captación) vive en `/consultas`. La puerta del módulo
 * (encendido + nivel Ver) corre igual antes de redirigir, como en el resto de Consultas.
 */
export default async function ServiceLeadsPage() {
  await requireServiceLeadsContext();
  redirect("/consultas");
}
