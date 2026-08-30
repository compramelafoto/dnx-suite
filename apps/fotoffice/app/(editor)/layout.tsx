import { requireFotofficePanelUser } from "@/lib/shell/require-fotoffice-access";

/**
 * Armazón del editor de plantillas: la ventana entera y nada más.
 *
 * El editor vivía dentro del panel, o sea dentro de un `<main>` con 40px de padding y
 * `max-w-6xl`. Encajonado ahí no podía ocupar la pantalla y había que scrollear para ver la
 * hoja completa. Por eso tiene grupo de ruta propio: la URL no cambia, pero el menú y la
 * cabecera de la aplicación no se montan.
 *
 * `overflow-hidden` es parte del trato: la página no scrollea, el editor se ajusta.
 */
export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  await requireFotofficePanelUser();
  return <div className="h-[100dvh] overflow-hidden bg-[var(--fo-bg)]">{children}</div>;
}
