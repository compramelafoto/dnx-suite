/**
 * Si el evento está listo para la noche.
 *
 * Nace de una fiesta que no se hizo: el 10/10/2026 el salón no tenía pantalla y el
 * sistema no se usó. No fue un error de programación —y justamente por eso importa—.
 * El producto depende de cosas del mundo físico que nadie le preguntó a nadie.
 *
 * La división es a propósito:
 *
 * - **Lo que el sistema puede ver solo** no se pregunta, se comprueba. Pedirle al
 *   fotógrafo que tilde "cargué la portada" cuando la portada está en la base es hacerle
 *   perder el tiempo y enseñarle a tildar sin leer.
 * - **Lo que pasa en el salón** sólo lo sabe él, y por eso se confirma a mano. Se guarda
 *   la fecha y no un sí: una confirmación sobre el salón hecha hace tres semanas vale
 *   menos que una de ayer, y verla con fecha deja decidir si hay que volver a preguntar.
 */

export type Importancia = "IMPRESCINDIBLE" | "RECOMENDADO";

export type Punto = {
  clave: string;
  texto: string;
  ayuda: string;
  importancia: Importancia;
  listo: boolean;
  /** Dónde se resuelve, si lo resuelve el sistema. */
  href?: string;
  /** Cuándo lo confirmó el fotógrafo, para los puntos del salón. */
  confirmadoEl?: string;
};

/** Lo que sólo sabe quien habló con el salón. Se confirma a mano. */
export const PUNTOS_DEL_SALON = [
  {
    clave: "pantalla",
    texto: "Hay pantalla en el salón y alguien que la maneje",
    ayuda:
      "Televisor o proyector, con una computadora conectada. Preguntalo en el salón, no lo supongas: es lo que hizo que la primera fiesta no se usara.",
  },
  {
    clave: "enlace-probado",
    texto: "Probé el enlace de la pantalla en esa computadora",
    ayuda: "Que abra, que se vea a pantalla completa y que el teclado responda.",
  },
  {
    clave: "impresos",
    texto: "Imprimí los centros de mesa y los llevo",
    ayuda:
      "Es el único camino del invitado al QR si la pantalla falla o si llega tarde. Se bajan en QR y materiales.",
  },
  {
    clave: "conexion",
    texto: "Hay wifi o señal de datos en el salón",
    ayuda: "Sin conexión no sube nadie. Probalo parado donde van a estar las mesas.",
  },
] as const;

export type EstadoDelEvento = {
  tieneHorario: boolean;
  tienePlantilla: boolean;
  tienePortada: boolean;
  tieneAnfitriones: boolean;
  tieneLogo: boolean;
  tieneBanner: boolean;
  /** `{ [clave]: fechaISO }` de lo que el fotógrafo ya confirmó. */
  confirmado: Record<string, string>;
};

export function puntosDePreparacion(e: EstadoDelEvento, eventoId: string): Punto[] {
  const en = (sufijo: string) => `/panel/eventos/${eventoId}${sufijo}`;

  const automaticos: Punto[] = [
    {
      clave: "horario",
      texto: "El horario está puesto",
      ayuda: "Sin hora de apertura el evento no abre solo.",
      importancia: "IMPRESCINDIBLE",
      listo: e.tieneHorario,
      href: en(""),
    },
    {
      clave: "portada",
      texto: "La portada del evento",
      ayuda: "La foto que ve el invitado al escanear. Sin ella la puerta se ve vacía.",
      importancia: "RECOMENDADO",
      listo: e.tienePortada,
      href: en("/portada"),
    },
    {
      clave: "anfitriones",
      texto: "De quién es la fiesta",
      ayuda: "Aparece debajo del nombre, en la puerta y en la pantalla.",
      importancia: "RECOMENDADO",
      listo: e.tieneAnfitriones,
      href: en("/portada"),
    },
    {
      clave: "plantilla",
      texto: "El estilo elegido",
      ayuda: "Sin plantilla se ve con los colores de SubiLaFoto, no con los de la fiesta.",
      importancia: "RECOMENDADO",
      listo: e.tienePlantilla,
      href: en("/plantilla"),
    },
    {
      clave: "logo",
      texto: "Tu logo",
      ayuda: "Va arriba de todo en el teléfono del invitado. Se carga una vez y vale para todos tus eventos.",
      importancia: "RECOMENDADO",
      listo: e.tieneLogo,
      href: "/panel/perfil",
    },
    {
      clave: "banner",
      texto: "Tu banner de publicidad",
      ayuda: "Al pie del teléfono del invitado, en todos tus eventos.",
      importancia: "RECOMENDADO",
      listo: e.tieneBanner,
      href: "/panel/perfil",
    },
  ];

  const delSalon: Punto[] = PUNTOS_DEL_SALON.map((p) => ({
    clave: p.clave,
    texto: p.texto,
    ayuda: p.ayuda,
    // Las cuatro son imprescindibles: cada una, sola, deja la fiesta sin sistema.
    importancia: "IMPRESCINDIBLE" as const,
    listo: Boolean(e.confirmado[p.clave]),
    confirmadoEl: e.confirmado[p.clave],
  }));

  return [...automaticos, ...delSalon];
}

/** Cuántos faltan de los que no se pueden saltear. */
export function faltanImprescindibles(puntos: Punto[]): number {
  return puntos.filter((p) => p.importancia === "IMPRESCINDIBLE" && !p.listo).length;
}

/** Sólo acepta las claves que existen: lo que manda el navegador no entra crudo. */
export function esPuntoDelSalon(clave: string): boolean {
  return PUNTOS_DEL_SALON.some((p) => p.clave === clave);
}
