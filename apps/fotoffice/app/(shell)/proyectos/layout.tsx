import { requireProyectos } from "@/lib/proyectos/pagina";

/** Guarda de toda la sección: módulo `projects` encendido y "Ver". Cada pantalla la vuelve a pedir. */
export default async function ProyectosLayout({ children }: { children: React.ReactNode }) {
  await requireProyectos("ver");
  return <>{children}</>;
}
