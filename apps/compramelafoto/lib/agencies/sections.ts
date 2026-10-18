/** Las tres secciones del menú Agencias, con la explicación que se muestra adentro. */
export const AGENCY_SECTIONS = [
  {
    id: "mi-agencia",
    label: "Mi agencia",
    path: "/fotografo/agencias/mi-agencia",
    help: "Armá tu equipo de fotógrafos, decidí cuánto cobra cada uno y vendé todo desde un solo álbum.",
  },
  {
    id: "directorio",
    label: "Directorio de agencias",
    path: "/fotografo/agencias/directorio",
    help: "Encontrá agencias cerca tuyo y mandales una solicitud para sumarte a su equipo.",
  },
  {
    id: "mis-agencias",
    label: "Mis agencias",
    path: "/fotografo/agencias/mis-agencias",
    help: "Las agencias para las que trabajás, lo que subiste y lo que te pagaron.",
  },
] as const;
