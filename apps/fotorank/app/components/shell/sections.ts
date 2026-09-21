import type { ShellSection } from "./shell-nav";

/**
 * Los menús de las cuatro áreas del panel, en un solo archivo.
 *
 * Están escritos **por tarea, no por tabla**: el criterio es qué viene a hacer la persona,
 * no qué modelo de datos existe detrás. Por eso las seis pantallas de jurados viven juntas
 * bajo "Jurados" en vez de ocupar seis lugares del mismo nivel, como pasaba hasta el
 * 2026-09-21.
 *
 * Ninguna ruta cambia: esto reordena y renombra, no muda pantallas.
 */

/** Organizador: el panel de quien publica concursos. */
export const SECCIONES_ORGANIZADOR: ShellSection[] = [
  {
    title: "Concursos",
    items: [
      { label: "Panel", href: "/dashboard", icon: "dashboard" },
      { label: "Mis concursos", href: "/concursos", icon: "camera" },
      { label: "Categorías", href: "/categorias", icon: "album" },
    ],
  },
  {
    title: "Jurados",
    items: [
      {
        label: "Jurados del concurso",
        href: "/jurados",
        icon: "user",
        roles: ["admin", "manager"],
      },
      {
        label: "Directorio",
        href: "/jurados/directorio",
        icon: "search",
        roles: ["admin", "manager"],
      },
      {
        label: "Invitaciones",
        href: "/jurados/invitaciones",
        icon: "email",
        roles: ["admin", "manager"],
      },
      {
        // Antes decía "Invit. directorio": una abreviatura que delataba que el nombre no
        // entraba. El nombre entra; lo que no entraba era la cantidad de ítems sueltos.
        label: "Invitaciones del directorio",
        href: "/jurados/directorio/invitaciones",
        icon: "email",
        roles: ["admin", "manager"],
      },
      {
        label: "Asignaciones",
        href: "/jurados/asignaciones",
        icon: "plus",
        roles: ["admin", "manager"],
      },
      {
        label: "Auditoría",
        href: "/jurados/auditoria",
        icon: "search",
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    title: "Resultados",
    items: [
      { label: "Ranking", href: "/ranking", icon: "sort" },
      { label: "Diplomas", href: "/diplomas", icon: "invoice" },
    ],
  },
  {
    title: "Mi actividad",
    items: [
      { label: "Como participante", href: "/mi-actividad", icon: "gallery" },
      { label: "Mis participaciones", href: "/participaciones", icon: "photo" },
    ],
  },
  {
    title: "Configuración",
    items: [
      {
        label: "Datos de la organización",
        href: "/dashboard/settings",
        icon: "settings",
      },
    ],
  },
];

/**
 * Participante: hasta el 2026-09-21 no tenía menú — sólo un encabezado con dos enlaces de
 * texto y el correo al lado. Es el área con más gente adentro.
 */
export const SECCIONES_PARTICIPANTE: ShellSection[] = [
  {
    title: "Mi actividad",
    items: [
      { label: "Inicio", href: "/mi-actividad", icon: "dashboard" },
      { label: "Mis participaciones", href: "/participaciones", icon: "photo" },
    ],
  },
  {
    title: "Mi cuenta",
    items: [{ label: "Mis datos", href: "/cuenta", icon: "user" }],
  },
];

/** Jurado: no tenía layout propio. Cada pantalla se dibujaba su encabezado. */
export const SECCIONES_JURADO: ShellSection[] = [
  {
    title: "Evaluación",
    items: [
      { label: "Panel", href: "/jurado/panel", icon: "dashboard" },
      {
        label: "Concursos asignados",
        href: "/jurado/concursos",
        icon: "camera",
      },
    ],
  },
  {
    title: "Mi cuenta",
    items: [
      { label: "Mi perfil", href: "/jurado/perfil", icon: "user" },
      { label: "Invitaciones", href: "/jurado/invitaciones", icon: "email" },
    ],
  },
];
