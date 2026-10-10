/**
 * El menú del panel del fotógrafo.
 *
 * Hasta el 2026-10-09 no había ninguno: trece pantallas sueltas, cada una un callejón
 * sin salida del que se volvía con el botón "atrás" del navegador.
 *
 * Las secciones de un evento están agrupadas **por el momento del trabajo** y no por
 * parecido técnico: lo que se prepara antes, lo que se usa durante la fiesta y lo que se
 * hace después. Es el orden en que el fotógrafo las necesita, y hace que durante el
 * evento —parado, apurado, de noche— las tres que importan estén juntas.
 */

export type Seccion = {
  href: string;
  texto: string;
  /** Una línea de qué se hace ahí. */
  ayuda?: string;
};

export type Grupo = {
  titulo: string;
  items: Seccion[];
};

export function gruposDelPanel(): Grupo[] {
  return [
    {
      titulo: "Mi cuenta",
      items: [
        { href: "/panel", texto: "Mis eventos", ayuda: "Todos los que creaste" },
        { href: "/panel/perfil", texto: "Perfil y precios", ayuda: "Tu marca y cuánto cobrás" },
        {
          href: "/panel/arrepentimientos",
          texto: "Arrepentimientos",
          ayuda: "Pedidos de baja de compras",
        },
      ],
    },
  ];
}

export function gruposDelEvento(eventoId: string): Grupo[] {
  const en = (sufijo = "") => `/panel/eventos/${eventoId}${sufijo}`;

  return [
    {
      titulo: "Antes",
      items: [
        { href: en(), texto: "Resumen", ayuda: "Horarios y código" },
        { href: en("/portada"), texto: "Portada y nombre", ayuda: "La foto y de quién es" },
        { href: en("/plantilla"), texto: "Estilo", ayuda: "Colores, letra y textura" },
        { href: en("/qr"), texto: "QR y materiales", ayuda: "Para imprimir" },
        /*
          Proveedores va en "Antes", no en un grupo "Después".

          A los que trabajaron esa noche —el DJ, el salón, el catering— se los invita
          antes o durante la fiesta, que es cuando el fotógrafo los tiene enfrente.
          Terminada la fiesta todos se fueron a su casa y conseguir que completen una
          ficha es mucho más difícil.
        */
        {
          href: en("/proveedores"),
          texto: "Proveedores",
          ayuda: "Invitá a quienes trabajan con vos",
        },
      ],
    },
    {
      titulo: "Durante la fiesta",
      items: [
        { href: en("/pantalla"), texto: "Pantalla y proyección", ayuda: "El enlace para el DJ" },
        { href: en("/control"), texto: "Control en vivo", ayuda: "Sacar algo al toque" },
        { href: en("/moderacion"), texto: "Moderación", ayuda: "Revisar lo retenido" },
      ],
    },
    ...gruposDelPanel(),
  ];
}

/** Sin la barra final, para que `/panel/perfil` y `/panel/perfil/` sean lo mismo. */
const normalizar = (ruta: string) => (ruta.length > 1 ? ruta.replace(/\/+$/, "") : ruta);

/**
 * Si este ítem del menú corresponde a la pantalla en la que estoy.
 *
 * **No alcanza con comparar por prefijo.** `/panel` es prefijo de las trece pantallas y
 * quedaría marcado siempre; `/panel/eventos/abc` es prefijo de todas las secciones del
 * evento y pasaría lo mismo un nivel más abajo.
 *
 * Por eso los dos resúmenes piden coincidencia exacta y el resto acepta que la ruta siga
 * más abajo: si mañana hay `/moderacion/bloqueadas`, "Moderación" sigue marcada.
 *
 * El prefijo se compara con la barra incluida para que `/q` no marque a `/qr`.
 */
export function estaActivo(href: string, rutaActual: string): boolean {
  const item = normalizar(href);
  const actual = normalizar(rutaActual);

  if (item === actual) return true;

  const esResumen = item === "/panel" || /^\/panel\/eventos\/[^/]+$/.test(item);
  if (esResumen) return false;

  return actual.startsWith(`${item}/`);
}

/** Sin acentos y en minúscula, para que "moderacion" encuentre "Moderación". */
function plano(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Filtra el menú por lo que se escribe en el buscador.
 *
 * Busca en el nombre **y en la ayuda**: quien no se acuerda de que se llama "Estilo"
 * igual escribe "colores", y tiene que encontrarlo. Los grupos que quedan vacíos se van,
 * para que no sobren títulos sin nada debajo.
 */
export function filtrarGrupos(grupos: Grupo[], busqueda: string): Grupo[] {
  const q = plano(busqueda.trim());
  if (!q) return grupos;

  return grupos
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => plano(i.texto).includes(q) || plano(i.ayuda ?? "").includes(q),
      ),
    }))
    .filter((g) => g.items.length > 0);
}
