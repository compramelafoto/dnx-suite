import { redirect } from "next/navigation";

/** Las plantillas viven todas en el diseñador nuevo. El listado viejo se retiró. */
export default function PlantillasPage() {
  redirect("/fotografo/diseno/plantillas/v2");
}
