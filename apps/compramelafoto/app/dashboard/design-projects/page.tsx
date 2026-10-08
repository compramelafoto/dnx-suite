import { redirect } from "next/navigation";

/** La revisión de diseños se mudó al panel del fotógrafo (diseñador nuevo). */
export default function LegacyDesignProjectsPage() {
  redirect("/fotografo/disenos");
}
