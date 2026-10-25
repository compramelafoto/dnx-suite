import { redirect } from "next/navigation";

/** Crear plantillas del diseñador viejo se retiró: las nuevas se crean en el diseñador nuevo. */
export default function NuevaPlantillaPage() {
  redirect("/fotografo/diseno/plantillas/v2");
}
