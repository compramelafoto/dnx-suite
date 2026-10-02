import { redirect } from "next/navigation";

/** La bandeja de consultas pasó al panel: Captación vive en `/captacion`. */
export default function ServiceLeadsPage() {
  redirect("/captacion");
}
