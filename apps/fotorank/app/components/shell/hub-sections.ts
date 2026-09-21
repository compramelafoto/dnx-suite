import type { ShellSection } from "./shell-nav";

/**
 * El menú del hub personal, armado según lo que cada persona puede hacer.
 *
 * Es la única navegación de FotoRank que ya era dinámica: el hub decide qué mostrar a
 * partir de las capacidades reales de la cuenta —si participa, si organiza, si es jurado,
 * si administra la plataforma—. Eso se conserva; lo que cambia es que ahora alimenta el
 * mismo armazón que el resto del panel, en vez de un tercer menú escrito a mano.
 *
 * Función PURA a propósito: las capacidades se resuelven contra la base en el layout, y acá
 * sólo se decide qué puertas se dibujan. Así se puede probar sin levantar nada.
 */

/** Lo que el hub necesita saber. Es un subconjunto de `HomeCapabilities`. */
export type CapacidadesDelHub = {
  isSuperAdmin: boolean;
  hasParticipations: boolean;
  hasOrganizations: boolean;
  hasJuryAccount: boolean;
  kinds: readonly string[];
};

export function seccionesDelHub(caps: CapacidadesDelHub): ShellSection[] {
  const miActividad: ShellSection = {
    title: "Mi actividad",
    items: [{ label: "Inicio", href: "/mi-actividad", icon: "dashboard" }],
  };

  // Sin ninguna capacidad todavía, se muestra igual: es la puerta para empezar a
  // participar, y dejar la pantalla con un solo ítem sería peor.
  if (caps.hasParticipations || caps.kinds.length === 0) {
    miActividad.items.push({
      label: "Mis participaciones",
      href: "/participaciones",
      icon: "photo",
    });
  }

  const secciones: ShellSection[] = [miActividad];

  const otrosPaneles: ShellSection = { title: "Otros paneles", items: [] };
  if (caps.hasOrganizations) {
    otrosPaneles.items.push({
      label: "Mi organización",
      href: "/dashboard",
      icon: "camera",
    });
  }
  if (caps.hasJuryAccount) {
    otrosPaneles.items.push({
      label: "Tareas de jurado",
      href: "/jurado/panel",
      icon: "user",
    });
  }
  if (otrosPaneles.items.length > 0) secciones.push(otrosPaneles);

  if (caps.isSuperAdmin) {
    secciones.push({
      title: "Plataforma",
      items: [
        { label: "Super administración", href: "/super-admin", icon: "settings" },
        { label: "Jurados de la plataforma", href: "/super-admin/jurados", icon: "user" },
      ],
    });
  }

  return secciones;
}
