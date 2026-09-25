import type { ShellSection } from "./shell-nav";

/**
 * El menú de FotoRank, organizado por rol.
 *
 * Una misma persona puede ser fotógrafo, jurado y organizador a la vez: un
 * jurado casi siempre también concursa, y quien organiza también puede ser
 * jurado en un concurso ajeno. Mostrar todo junto daba un menú de veinte
 * entradas donde no se sabía qué era para qué (hasta el 2026-09-25).
 *
 * Ahora hay un **selector de rol** arriba de la barra y el menú muestra sólo
 * lo de ese rol. El rol activo no se guarda en ningún lado: sale de la
 * pantalla en la que está la persona (`rolDeLaRuta`). Elegir otro rol lleva a
 * su inicio. Así el selector y el menú no pueden quedar desfasados, ni siquiera
 * si la persona llega por un enlace directo.
 *
 * El **super admin** no tiene selector: es sólo super admin. Su menú es la
 * administración de la plataforma y las herramientas de concursos, con las que
 * opera sobre la organización que elige con "Actuar como".
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

export type Rol = "fotografo" | "jurado" | "organizador";

export type RolDisponible = {
  rol: Rol;
  etiqueta: string;
  /** A dónde lleva elegir este rol en el selector. */
  inicio: string;
  sections: ShellSection[];
};

/** Lo que recibe el marco: o roles para elegir, o el menú fijo del super admin. */
export type MenuDeLaCuenta =
  | { tipo: "roles"; roles: RolDisponible[] }
  | { tipo: "superAdmin"; sections: ShellSection[] };

/** Títulos de sección. Exportados para que los tests no dependan de la ortografía. */
export const SECCION = {
  fotografo: "Fotógrafo",
  jurado: "Jurado",
  concursos: "Concursos",
  jurados: "Jurados",
  resultados: "Resultados",
  organizacion: "Organización",
  plataforma: "Plataforma",
} as const;

export const COLA_DE_REVISION_HREF = "/super-admin/jurados";
export const CONEXION_CLICKATON_HREF = "/super-admin/clickaton";

export const INICIO_DEL_ROL: Record<Rol, string> = {
  fotografo: "/mi-actividad",
  jurado: "/jurado/panel",
  organizador: "/dashboard",
};

function menuDelFotografo(esOrganizador: boolean): ShellSection[] {
  return [
    {
      title: SECCION.fotografo,
      items: [
        { label: "Inicio", href: INICIO_DEL_ROL.fotografo, icon: "home" },
        { label: "Mis participaciones", href: "/participaciones", icon: "gallery" },
        { label: "Explorar concursos", href: "/", icon: "search" },
        // Quien todavía no organiza tiene por dónde empezar; quien ya organiza
        // tiene su propio rol.
        ...(esOrganizador
          ? []
          : [{ label: "Organizar un concurso", href: "/onboarding", icon: "plus" }]),
      ],
    },
  ];
}

const MENU_DEL_JURADO: ShellSection[] = [
  {
    title: SECCION.jurado,
    items: [
      { label: "Concursos a calificar", href: INICIO_DEL_ROL.jurado, icon: "favorite" },
      { label: "Invitaciones recibidas", href: "/jurado/invitaciones", icon: "email" },
      { label: "Mi ficha de jurado", href: "/jurado/perfil", icon: "user" },
    ],
  },
];

/*
 * Las herramientas de concursos, por tarea y no por tabla: armar el concurso,
 * conseguir y asignar jurados, y al final publicar resultados.
 */
const HERRAMIENTAS_DE_CONCURSOS: ShellSection[] = [
  {
    title: SECCION.concursos,
    items: [
      { label: "Resumen", href: INICIO_DEL_ROL.organizador, icon: "dashboard" },
      { label: "Mis concursos", href: "/concursos", icon: "camera" },
      { label: "Categorías", href: "/categorias", icon: "album" },
    ],
  },
  {
    title: SECCION.jurados,
    items: [
      // El circuito en orden: buscar, invitar, ver quién aceptó, repartir.
      // Las invitaciones por correo y el historial se abren desde "Mis jurados".
      { label: "Buscar jurados", href: "/jurados/directorio", icon: "search" },
      { label: "Invitaciones", href: "/jurados/directorio/invitaciones", icon: "send" },
      { label: "Mis jurados", href: "/jurados", icon: "user" },
      { label: "Asignaciones", href: "/jurados/asignaciones", icon: "plus" },
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

/** Los roles de una persona, en orden fijo. Fotógrafo lo es cualquiera con cuenta. */
export function rolesDeLaCuenta(perfiles: Omit<PerfilesDeLaCuenta, "esSuperAdmin" | "juradosPorRevisar">): RolDisponible[] {
  const roles: RolDisponible[] = [
    {
      rol: "fotografo",
      etiqueta: "Fotógrafo",
      inicio: INICIO_DEL_ROL.fotografo,
      sections: menuDelFotografo(perfiles.esOrganizador),
    },
  ];
  if (perfiles.esJurado) {
    roles.push({
      rol: "jurado",
      etiqueta: "Jurado",
      inicio: INICIO_DEL_ROL.jurado,
      sections: MENU_DEL_JURADO,
    });
  }
  if (perfiles.esOrganizador) {
    roles.push({
      rol: "organizador",
      etiqueta: "Organizador",
      inicio: INICIO_DEL_ROL.organizador,
      sections: HERRAMIENTAS_DE_CONCURSOS,
    });
  }
  return roles;
}

export function menuDeLaCuenta(perfiles: PerfilesDeLaCuenta): MenuDeLaCuenta {
  if (perfiles.esSuperAdmin) {
    return {
      tipo: "superAdmin",
      sections: [plataforma(perfiles.juradosPorRevisar), ...HERRAMIENTAS_DE_CONCURSOS],
    };
  }
  return { tipo: "roles", roles: rolesDeLaCuenta(perfiles) };
}

/** Prefijos de ruta de cada rol. El orden importa: `/jurados` es del organizador y `/jurado` del jurado. */
const RUTAS_DEL_ROL: Array<[Rol, string[]]> = [
  ["organizador", ["/dashboard", "/concursos", "/categorias", "/jurados", "/ranking", "/diplomas"]],
  ["jurado", ["/jurado"]],
  ["fotografo", ["/mi-actividad", "/participaciones", "/onboarding"]],
];

function empiezaCon(pathname: string, prefijo: string): boolean {
  return pathname === prefijo || pathname.startsWith(`${prefijo}/`);
}

/** A qué rol pertenece una pantalla. `null` si es de ninguno en particular. */
export function rolDeLaRuta(pathname: string): Rol | null {
  for (const [rol, prefijos] of RUTAS_DEL_ROL) {
    if (prefijos.some((p) => empiezaCon(pathname, p))) return rol;
  }
  return null;
}

/**
 * El rol que corresponde mostrar: el de la pantalla, si la persona lo tiene;
 * si no, el primero (fotógrafo).
 */
export function rolActivo(roles: RolDisponible[], pathname: string): RolDisponible | null {
  const deLaRuta = rolDeLaRuta(pathname);
  return roles.find((r) => r.rol === deLaRuta) ?? roles[0] ?? null;
}

/**
 * El menú de quien entró sólo con la clave de jurado, sin cuenta del sitio:
 * sin cuenta no tiene rol de fotógrafo.
 */
export function menuDelJuradoSinCuenta(): MenuDeLaCuenta {
  return {
    tipo: "roles",
    roles: [
      { rol: "jurado", etiqueta: "Jurado", inicio: INICIO_DEL_ROL.jurado, sections: MENU_DEL_JURADO },
    ],
  };
}
