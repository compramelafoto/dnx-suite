import type { ShellSection } from "./shell-nav";

/**
 * El menú de FotoRank: uno solo, armado según quién es la persona.
 *
 * Hasta el 2026-09-24 cada área tenía el suyo. Al entrar, el hub personal mostraba
 * un menú; "Organizaciones" llevaba al panel del organizador, que tenía otro —con
 * otras secciones y otros nombres—; el participante tenía un encabezado con tres
 * enlaces sueltos y el jurado no tenía ninguno. Una misma persona veía cuatro
 * productos distintos según la pantalla.
 *
 * La regla ahora: **las secciones dependen de la persona, no de la pantalla**.
 *
 * Hay dos clases de cuenta y no se mezclan:
 *
 * - **Fotógrafo.** Cualquiera con cuenta. Siempre ve "Mi actividad" (participar);
 *   si además es jurado suma "Como jurado", y si organiza concursos suma las
 *   secciones del organizador. Un jurado casi siempre es también fotógrafo y
 *   puede inscribirse en otro concurso: por eso no pierde sus participaciones.
 *
 * - **Super admin.** Administra la plataforma. No participa ni califica: su menú
 *   no tiene "Mi actividad" ni "Como jurado", aunque la base diga que también
 *   tiene inscripciones o cuenta de jurado. Tiene la administración de la
 *   plataforma y, debajo, las herramientas de concursos, porque opera sobre la
 *   organización que elige con "Actuar como".
 */

export type PerfilesDeLaCuenta = {
  /** Tiene una cuenta de jurado utilizable (ver `cuentaDeJuradoAbreElPanel`). */
  esJurado: boolean;
  /** Es miembro activo de al menos una organización. */
  esOrganizador: boolean;
  esSuperAdmin: boolean;
  /** Fichas de jurado esperando revisión. Sólo cuenta para el super admin. */
  juradosPorRevisar: number;
};

/** Títulos de sección. Exportados para que los tests no dependan de la ortografía. */
export const SECCION = {
  actividad: "Mi actividad",
  jurado: "Como jurado",
  concursos: "Concursos",
  jurados: "Jurados",
  resultados: "Resultados",
  organizacion: "Organización",
  plataforma: "Plataforma",
} as const;

export const COLA_DE_REVISION_HREF = "/super-admin/jurados";
export const CONEXION_CLICKATON_HREF = "/super-admin/clickaton";

function miActividad(esOrganizador: boolean): ShellSection {
  return {
    title: SECCION.actividad,
    items: [
      { label: "Inicio", href: "/mi-actividad", icon: "home" },
      { label: "Mis participaciones", href: "/participaciones", icon: "gallery" },
      // Quien todavía no organiza tiene por dónde empezar; quien ya organiza lo
      // hace desde su sección.
      ...(esOrganizador
        ? []
        : [{ label: "Organizar un concurso", href: "/onboarding", icon: "plus" }]),
    ],
  };
}

const COMO_JURADO: ShellSection = {
  title: SECCION.jurado,
  items: [
    { label: "Concursos a calificar", href: "/jurado/panel", icon: "favorite" },
    { label: "Invitaciones recibidas", href: "/jurado/invitaciones", icon: "email" },
    { label: "Mi ficha de jurado", href: "/jurado/perfil", icon: "user" },
  ],
};

/*
 * Las herramientas de concursos, por tarea y no por tabla: armar el concurso,
 * conseguir y asignar jurados, y al final publicar resultados.
 */
const HERRAMIENTAS_DE_CONCURSOS: ShellSection[] = [
  {
    title: SECCION.concursos,
    items: [
      { label: "Resumen", href: "/dashboard", icon: "dashboard" },
      { label: "Mis concursos", href: "/concursos", icon: "camera" },
      { label: "Categorías", href: "/categorias", icon: "album" },
    ],
  },
  {
    title: SECCION.jurados,
    items: [
      { label: "Mis jurados", href: "/jurados", icon: "user" },
      { label: "Buscar en el directorio", href: "/jurados/directorio", icon: "search" },
      { label: "Invitaciones enviadas", href: "/jurados/invitaciones", icon: "email" },
      { label: "Invitaciones del directorio", href: "/jurados/directorio/invitaciones", icon: "send" },
      { label: "Asignaciones", href: "/jurados/asignaciones", icon: "plus" },
      { label: "Historial de cambios", href: "/jurados/auditoria", icon: "clock" },
    ],
  },
  {
    title: SECCION.resultados,
    items: [
      { label: "Ranking", href: "/ranking", icon: "sort" },
      { label: "Diplomas", href: "/diplomas", icon: "invoice" },
    ],
  },
  {
    title: SECCION.organizacion,
    items: [{ label: "Datos de la organización", href: "/dashboard/settings", icon: "settings" }],
  },
];

function plataforma(juradosPorRevisar: number): ShellSection {
  return {
    title: SECCION.plataforma,
    items: [
      { label: "Panorama general", href: "/super-admin", icon: "dashboard" },
      { label: "Organizaciones", href: "/super-admin#organizaciones", icon: "home" },
      { label: "Todos los concursos", href: "/super-admin#concursos", icon: "camera" },
      { label: "Usuarios", href: "/super-admin#usuarios", icon: "user" },
      {
        label: "Jurados por revisar",
        href: COLA_DE_REVISION_HREF,
        icon: "success",
        // El número es la razón para entrar; con la cola vacía no se muestra.
        ...(juradosPorRevisar > 0 ? { badge: juradosPorRevisar } : {}),
      },
      { label: "Conexión con Clickatón", href: CONEXION_CLICKATON_HREF, icon: "sync" },
      { label: "Auditoría", href: "/super-admin#logs", icon: "security" },
    ],
  };
}

export function menuDeLaCuenta(perfiles: PerfilesDeLaCuenta): ShellSection[] {
  if (perfiles.esSuperAdmin) {
    return [plataforma(perfiles.juradosPorRevisar), ...HERRAMIENTAS_DE_CONCURSOS];
  }

  // Orden fijo: lo propio primero, después lo que se hace para otros.
  const secciones: ShellSection[] = [miActividad(perfiles.esOrganizador)];
  if (perfiles.esJurado) secciones.push(COMO_JURADO);
  if (perfiles.esOrganizador) secciones.push(...HERRAMIENTAS_DE_CONCURSOS);
  return secciones;
}

/**
 * El menú de quien entró sólo con la clave de jurado, sin cuenta del sitio.
 *
 * No tiene "Mi actividad": sin cuenta del sitio no hay inscripciones que mirar,
 * y ofrecerle "Mis participaciones" lo mandaría al login del sitio.
 */
export function menuDelJuradoSinCuenta(): ShellSection[] {
  return [COMO_JURADO];
}
