import { redirect } from "next/navigation";

/** Redirige a /concursos con modal abierto — el wizard corre en ventana emergente */
export default function NuevoConcursoPage() {
  redirect("/concursos?crear=1");
}
