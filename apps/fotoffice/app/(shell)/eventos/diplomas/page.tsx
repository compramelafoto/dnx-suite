import { redirect } from "next/navigation";

/** El "volver" del diseñador de diplomas: los diplomas se manejan desde cada evento. */
export default function DiplomasPage() {
  redirect("/eventos");
}
