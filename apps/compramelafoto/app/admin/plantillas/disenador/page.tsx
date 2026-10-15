import { redirect } from "next/navigation";

/**
 * El diseñador clásico (fotolibros y plantillas viejas) se retiró: las plantillas se diseñan en
 * el diseñador nuevo. Lo que quedó del viejo se migra desde /admin/plantillas.
 */
export default function DisenadorClasicoPage() {
  redirect("/dashboard/designs");
}
