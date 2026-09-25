import type { ShellSection } from "./shell-nav";

/**
 * El menú de FotoRank: uno solo, armado según quién es la persona.
 *
 * Hasta el 2026-09-24 cada área tenía el suyo. Al entrar, el hub personal mostraba
 * un menú; "Organizaciones" llevaba al panel del organizador, que tenía otro —con
 * otras secciones y otros nombres—; el participante tenía un encabezado con tres
 * enlaces sueltos y el jurado no tenía ninguno. Una misma persona veía cuatro
 * productos distintos según la pantalla, y cada vez que cambiaba de área el menú
 * se reordenaba bajo sus pies.
 *
 * Ahora hay una sola regla: **las secciones dependen de la persona, no de la
 * pantalla**. Se agregan por perfil y siempre en el mismo orden, así que lo que
 * ve en el hub es exactamente lo que ve en el panel del jurado o en el del
 * organizador.
 *
 * Una persona puede tener varios perfiles a la vez: un jurado también puede
 * inscribirse en otro concurso, y un organizador también puede ser jurado. Por
 * eso "Mi actividad" —participar— está siempre, para cualquiera con cuenta.
 */

export type PerfilesDeLaCuenta = {
  /** Tiene una cuenta de jurado utilizable (ver `cuentaDeJuradoAbreElPanel`). */
  esJurado: boolean;
  /** Puede entrar al panel del organizador. */
  esOrganizador: boolean;
  esSuperAdmin: boolean;
  /** Fichas de jurado esperando revisión. Sólo cuenta para el super admin. */
  juradosPorRevisar: number;
};

/** Títulos de sección. Exportados para que los tests no dependan de la ortografía. */
export const SECCION = {
  actividad: "Mi actividad",
  jurado: "Como jurado",
  concursos: "Mis concursos",
  jurados: "Jurados de mis concursos",
  resultados: "Resultados",
  organizacion: "Mi organización",
  superAdmin: "Super administración",
} as const;

const MI_ACTIVIDAD: ShellSection = {
  title: SECCION.actividad,
  items: [
    { label: "Inicio", href: "/mi-actividad", icon: "home" },
    { label: "Mis participaciones", href: "/participaciones", icon: "gallery" },
  ],
};

const COMO_JURADO: ShellSection = {
  title: SECCION.jurado,
  items: [
    { label: "Concursos a calificar", href: "/jurado/panel", icon: "favorite" },
    { label: "Invitaciones recibidas", href: "/jurado/invitaciones", icon: "email" },
    { label: "Mi ficha de jurado", href: "/jurado/perfil", icon: "user" },
  ],
};

/*
 * El organizador, por tarea y no por tabla: las seis pantallas de jurados viven
 * juntas, y los resultados aparte, porque se usan al final del concurso.
 */
const ORGANIZADOR: ShellSection[] = [
  {
    title: SECCION.concursos,
    items: [
      { label: "Resumen", href: "/dashboard", icon: "dashboard" },
      { label: "Concursos", href: "/concursos", icon: "camera" },
      { label: "Categorías", href: "/categorias", icon: "album" },
    ],
  },
  {
    title: SECCION.jurados,
    items: [
      { label: "Jurados", href: "/jurados", icon: "user" },
      { label: "Buscar en el directorio", href: "/jurados/directorio", icon: "search" },
      { label: "Invitaciones enviadas", href: "/jurados/invitaciones", icon: "email" },
      { label: "Invitaciones del directorio", href: "/jurados/directorio/invitaciones", icon: "send" },
      { label: "Asignaciones", href: "/jurados/asignaciones", icon: "plus" },
      { label: "Auditoría", href: "/jurados/auditoria", icon: "security" },
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

export const COLA_DE_REVISION_HREF = "/super-admin/jurados";

function superAdmin(juradosPorRevisar: number): ShellSection {
  return {
    title: SECCION.superAdmin,
    items: [
      { label: "Panorama general", href: "/super-admin", icon: "dashboard" },
      {
        label: "Jurados por revisar",
        href: COLA_DE_REVISION_HREF,
        icon: "success",
        // El número es la razón para entrar; con la cola vacía no se muestra.
        ...(juradosPorRevisar > 0 ? { badge: juradosPorRevisar } : {}),
      },
    ],
  };
}

/**
 * El orden es fijo: lo propio primero, después lo que la persona hace para
 * otros (calificar, organizar) y al final la administración de la plataforma.
 */
export function menuDeLaCuenta(perfiles: PerfilesDeLaCuenta): ShellSection[] {
  const secciones: ShellSection[] = [MI_ACTIVIDAD];
  if (perfiles.esJurado) secciones.push(COMO_JURADO);
  if (perfiles.esOrganizador) secciones.push(...ORGANIZADOR);
  if (perfiles.esSuperAdmin) secciones.push(superAdmin(perfiles.juradosPorRevisar));
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
