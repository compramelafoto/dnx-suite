/**
 * Catálogo de fechas de saludo que trae FOTOFFICE. Módulo puro.
 *
 * Es el punto de partida: la institución enciende las que quiere y cambia fecha, asunto, texto,
 * imagen y a quién van (`FotofficeMailingOccasion`). Todo viene apagado.
 *
 * Las fechas del oficio que tienen versiones distintas según la fuente (Día del Fotógrafo, del
 * Reportero Gráfico, del Camarógrafo, del Trabajador de Prensa) vienen SIN fecha: no se pueden
 * encender hasta que la institución confirme la suya. Inventar un día sería peor que no saludar.
 *
 * Variables del texto: {nombre} (nombre de pila), {institucion} y, en el aniversario, {años}.
 */

export const OCCASION_KINDS = {
  EFEMERIDE: "EFEMERIDE",
  BIRTHDAY: "BIRTHDAY",
  ANNIVERSARY: "ANNIVERSARY",
  LIFECYCLE: "LIFECYCLE",
} as const;
export type OccasionKind = (typeof OCCASION_KINDS)[keyof typeof OCCASION_KINDS];

export type OccasionConfig = {
  key: string;
  kind: OccasionKind;
  enabled: boolean;
  month: number | null;
  day: number | null;
  title: string;
  subject: string;
  message: string;
  imageUrl: string | null;
  specialties: string[];
  milestonesOnly: boolean;
  /** Ciclo del socio: días después del hecho que lo dispara (ingreso, baja, último ingreso al portal). */
  offsetDays: number | null;
  /** Ciclo del socio: botón fijo del correo. Lo define el catálogo, no se edita. */
  cta?: { label: string; target: "portal" | "sitio" };
  /** Ciclo del socio: qué dispara el correo, para explicarlo en pantalla. */
  trigger?: "JOINED" | "LEFT" | "NO_LOGIN";
  /** Viene del catálogo (no se puede borrar) o la agregó la institución. */
  builtIn: boolean;
  /** Nota para quien la configura («Confirmá la fecha con la comisión»). */
  hint?: string;
};

type Semilla = Omit<OccasionConfig, "enabled" | "imageUrl" | "builtIn" | "milestonesOnly" | "specialties" | "offsetDays"> & {
  specialties?: string[];
  milestonesOnly?: boolean;
  offsetDays?: number;
  hint?: string;
};

const SIN_FECHA = "Hay versiones distintas de esta fecha según la fuente: confirmala con la comisión y cargala antes de encenderla.";

const SEMILLAS: Semilla[] = [
  {
    key: "bienvenida-semana",
    kind: "LIFECYCLE",
    month: null,
    day: null,
    title: "Bienvenida: completá tu perfil",
    trigger: "JOINED",
    offsetDays: 7,
    cta: { label: "Entrar al portal", target: "portal" },
    subject: "{nombre}, ¿ya armaste tu perfil en {institucion}?",
    message:
      "¡Hola, {nombre}!\n\nHace unos días te sumaste a {institucion} y queremos que aproveches todo desde el principio.\n\nEn el portal de socios podés completar tu perfil con tu foto, tus especialidades y tus redes: así tus colegas te conocen, te recomiendan y te pueden contactar. También vas a encontrar tu carnet, tus cuotas y las actividades de la institución.\n\nLleva unos minutos. ¡Te esperamos!",
  },
  {
    key: "bienvenida-mes",
    kind: "LIFECYCLE",
    month: null,
    day: null,
    title: "Bienvenida: tus beneficios",
    trigger: "JOINED",
    offsetDays: 30,
    cta: { label: "Ver mis beneficios", target: "portal" },
    subject: "Tu primer mes en {institucion}: todo lo que tenés como socio",
    message:
      "¡Hola, {nombre}!\n\nYa cumpliste tu primer mes en {institucion}. Gracias por sumarte.\n\nTe recordamos lo que tenés como socio: los descuentos de nuestros aliados, los sorteos, los cursos y actividades, la reserva del estudio y, sobre todo, una comunidad de colegas con quienes compartir trabajo, consejos y oportunidades.\n\nSi tenés una idea, una propuesta o necesitás una mano, respondé este correo: nos llega directo.",
  },
  {
    key: "sin-portal",
    kind: "LIFECYCLE",
    month: null,
    day: null,
    title: "Hace tiempo que no entrás",
    trigger: "NO_LOGIN",
    offsetDays: 60,
    cta: { label: "Entrar al portal", target: "portal" },
    subject: "{nombre}, te extrañamos en el portal de {institucion}",
    message:
      "¡Hola, {nombre}!\n\nHace un tiempo que no pasás por el portal de socios de {institucion}, y hay novedades: actividades, sorteos, beneficios de nuestros aliados y colegas que se sumaron.\n\nEntrá cuando quieras para ponerte al día. Y si algo no te funciona o no te resulta útil, contanos respondiendo este correo: nos ayuda a mejorar.",
  },
  {
    key: "ex-socio",
    kind: "LIFECYCLE",
    month: null,
    day: null,
    title: "Te extrañamos (ex socios)",
    trigger: "LEFT",
    offsetDays: 60,
    cta: { label: "Volver a asociarme", target: "sitio" },
    subject: "{nombre}, en {institucion} te extrañamos",
    message:
      "¡Hola, {nombre}!\n\nHace un tiempo dejaste de ser socio de {institucion} y queríamos decirte que la puerta sigue abierta.\n\nSeguimos creciendo: hay actividades nuevas, beneficios con nuestros aliados y una comunidad de colegas que se acompaña. Si querés volver, desde el sitio podés hacerlo en unos minutos.\n\nY si te fuiste por algo que podemos mejorar, nos encantaría saberlo: respondé este correo, lo lee la comisión.",
    hint: "Nunca se manda a quienes se dio de baja por sanción. Sale una sola vez por persona, el día en que se cumplen los días elegidos desde la baja.",
  },
  {
    key: "birthday",
    kind: "BIRTHDAY",
    month: null,
    day: null,
    title: "Cumpleaños",
    subject: "¡Feliz cumpleaños, {nombre}!",
    message:
      "¡Feliz cumpleaños, {nombre}!\n\nDesde {institucion} te deseamos un día hermoso, rodeado de la gente que querés, y un año lleno de buenas fotos, proyectos que te entusiasmen y momentos que valga la pena guardar.\n\nGracias por ser parte de esta comunidad. ¡Que lo disfrutes!",
  },
  {
    key: "anniversary",
    kind: "ANNIVERSARY",
    month: null,
    day: null,
    title: "Aniversario de ingreso",
    subject: "¡Hoy cumplís {años} en {institucion}!",
    message:
      "¡Hola, {nombre}!\n\nUn día como hoy te sumaste a {institucion}, y hoy se cumplen {años} desde entonces.\n\nQueremos agradecerte por acompañarnos todo este tiempo: la institución es lo que es gracias a socios como vos, que comparten su oficio, su tiempo y sus ganas.\n\n¡Por muchos años más juntos!",
    milestonesOnly: false,
  },
  {
    key: "anio-nuevo",
    kind: "EFEMERIDE",
    month: 1,
    day: 1,
    title: "Año Nuevo",
    subject: "¡Feliz año nuevo, {nombre}!",
    message:
      "¡Feliz año nuevo, {nombre}!\n\nEmpieza un año nuevo y desde {institucion} te deseamos que venga cargado de trabajo, de proyectos propios y de muchas fotos de las que te enorgullezcas.\n\nGracias por ser parte. ¡Nos vemos en este nuevo año!",
  },
  {
    key: "dia-memoria",
    kind: "EFEMERIDE",
    month: 3,
    day: 24,
    title: "Día Nacional de la Memoria por la Verdad y la Justicia",
    subject: "24 de marzo: Memoria, Verdad y Justicia",
    message:
      "Hola, {nombre}.\n\nHoy, 24 de marzo, recordamos a las víctimas de la última dictadura cívico-militar.\n\nLa fotografía fue y sigue siendo una herramienta de la memoria: las imágenes de quienes ya no están, sostenidas por sus familias y por toda la sociedad, nos recuerdan cada día por qué no hay que olvidar.\n\nDesde {institucion} nos sumamos a ese compromiso: Memoria, Verdad y Justicia.",
  },
  {
    key: "malvinas",
    kind: "EFEMERIDE",
    month: 4,
    day: 2,
    title: "Día del Veterano y de los Caídos en la Guerra de Malvinas",
    subject: "2 de abril: homenaje a los veteranos y caídos en Malvinas",
    message:
      "Hola, {nombre}.\n\nHoy, 2 de abril, {institucion} rinde homenaje a los veteranos y a los caídos en la Guerra de Malvinas.\n\nLas Malvinas fueron, son y serán argentinas.",
  },
  {
    key: "dia-trabajador",
    kind: "EFEMERIDE",
    month: 5,
    day: 1,
    title: "Día del Trabajador",
    subject: "Feliz Día del Trabajador, {nombre}",
    message:
      "¡Hola, {nombre}!\n\nEn el Día del Trabajador queremos saludar a todos los que hacen de la fotografía y del audiovisual su oficio: el que está en cada evento, en cada redacción, en cada estudio y en cada calle.\n\nDesde {institucion}, ¡feliz día!",
  },
  {
    key: "revolucion-mayo",
    kind: "EFEMERIDE",
    month: 5,
    day: 25,
    title: "Revolución de Mayo",
    subject: "¡Feliz 25 de Mayo!",
    message: "¡Hola, {nombre}!\n\nEn un nuevo aniversario de la Revolución de Mayo, {institucion} te saluda. ¡Feliz día de la Patria!",
  },
  {
    key: "dia-periodista",
    kind: "EFEMERIDE",
    month: 6,
    day: 7,
    title: "Día del Periodista",
    subject: "Feliz Día del Periodista, {nombre}",
    message:
      "¡Hola, {nombre}!\n\nHoy es el Día del Periodista, y queremos saludar especialmente a quienes cuentan la realidad con su cámara: reporteros gráficos, camarógrafos y todos los trabajadores de prensa.\n\nSu trabajo es fundamental para que estemos informados. Desde {institucion}, ¡feliz día!",
    specialties: ["PRENSA", "VIDEO"],
  },
  {
    key: "dia-bandera",
    kind: "EFEMERIDE",
    month: 6,
    day: 20,
    title: "Día de la Bandera",
    subject: "20 de junio: Día de la Bandera",
    message:
      "¡Hola, {nombre}!\n\nHoy celebramos el Día de la Bandera, creada por Manuel Belgrano a orillas del Paraná. {institucion} te saluda en este día tan nuestro.",
  },
  {
    key: "independencia",
    kind: "EFEMERIDE",
    month: 7,
    day: 9,
    title: "Día de la Independencia",
    subject: "¡Feliz Día de la Independencia!",
    message: "¡Hola, {nombre}!\n\nEn un nuevo aniversario de la Declaración de la Independencia, {institucion} te saluda. ¡Feliz 9 de Julio!",
  },
  {
    key: "dia-amigo",
    kind: "EFEMERIDE",
    month: 7,
    day: 20,
    title: "Día del Amigo",
    subject: "¡Feliz Día del Amigo, {nombre}!",
    message:
      "¡Feliz Día del Amigo, {nombre}!\n\nMuchas amistades nacieron detrás de una cámara: en una cobertura compartida, en una salida fotográfica, en un curso o en una charla entre colegas.\n\nDesde {institucion} celebramos esa red que armamos entre todos. ¡Feliz día!",
  },
  {
    key: "san-martin",
    kind: "EFEMERIDE",
    month: 8,
    day: 17,
    title: "Paso a la Inmortalidad del General San Martín",
    subject: "17 de agosto: homenaje al General San Martín",
    message: "Hola, {nombre}.\n\nHoy recordamos al General José de San Martín, Libertador de América. {institucion} se suma al homenaje.",
  },
  {
    key: "dia-fotografia",
    kind: "EFEMERIDE",
    month: 8,
    day: 19,
    title: "Día Mundial de la Fotografía",
    subject: "¡Feliz Día Mundial de la Fotografía, {nombre}!",
    message:
      "¡Feliz Día Mundial de la Fotografía, {nombre}!\n\nHoy celebramos lo que nos une: la pasión por la imagen, por mirar distinto y por guardar lo que importa.\n\nGracias por hacer de la fotografía tu oficio y por compartirlo con esta comunidad. Desde {institucion}, ¡feliz día!",
  },
  {
    key: "dia-fotografo",
    kind: "EFEMERIDE",
    month: null,
    day: null,
    title: "Día del Fotógrafo",
    subject: "¡Feliz Día del Fotógrafo, {nombre}!",
    message:
      "¡Feliz día, {nombre}!\n\nHoy es tu día. Gracias por cada foto, por cada evento cubierto, por cada historia contada con luz.\n\nDesde {institucion} celebramos tu oficio y tu pasión. ¡Feliz Día del Fotógrafo!",
    hint: SIN_FECHA,
  },
  {
    key: "dia-reportero-grafico",
    kind: "EFEMERIDE",
    month: null,
    day: null,
    title: "Día del Reportero Gráfico",
    subject: "¡Feliz Día del Reportero Gráfico, {nombre}!",
    message:
      "¡Feliz día, {nombre}!\n\nHoy saludamos a quienes salen a la calle a contar la realidad con su cámara, muchas veces en condiciones difíciles.\n\nSu trabajo es memoria y es información. Desde {institucion}, ¡feliz Día del Reportero Gráfico!",
    specialties: ["PRENSA"],
    hint: SIN_FECHA,
  },
  {
    key: "dia-camarografo",
    kind: "EFEMERIDE",
    month: null,
    day: null,
    title: "Día del Camarógrafo",
    subject: "¡Feliz Día del Camarógrafo, {nombre}!",
    message:
      "¡Feliz día, {nombre}!\n\nHoy saludamos a quienes cuentan historias en movimiento: camarógrafos, videógrafos y realizadores audiovisuales.\n\nDesde {institucion}, ¡feliz Día del Camarógrafo!",
    specialties: ["VIDEO"],
    hint: SIN_FECHA,
  },
  {
    key: "dia-trabajador-prensa",
    kind: "EFEMERIDE",
    month: null,
    day: null,
    title: "Día del Trabajador de Prensa",
    subject: "¡Feliz Día del Trabajador de Prensa, {nombre}!",
    message:
      "¡Feliz día, {nombre}!\n\nHoy saludamos a todos los trabajadores de prensa: los que informan, los que registran y los que hacen posible que la noticia llegue.\n\nDesde {institucion}, ¡feliz día!",
    specialties: ["PRENSA", "VIDEO"],
    hint: SIN_FECHA,
  },
  {
    key: "navidad",
    kind: "EFEMERIDE",
    month: 12,
    day: 24,
    title: "Navidad",
    subject: "¡Feliz Navidad, {nombre}!",
    message:
      "¡Feliz Navidad, {nombre}!\n\nDesde {institucion} te deseamos una Navidad en paz, compartida con los que más querés.\n\nGracias por acompañarnos este año. ¡Que tengas una muy feliz Navidad!",
  },
  {
    key: "fin-de-anio",
    kind: "EFEMERIDE",
    month: 12,
    day: 31,
    title: "Fin de año",
    subject: "¡Felices fiestas, {nombre}! Gracias por este año",
    message:
      "¡Hola, {nombre}!\n\nTermina el año y desde {institucion} queremos darte las gracias por ser parte: por cada actividad, cada encuentro y cada foto compartida.\n\nTe deseamos un muy feliz año nuevo. ¡Nos reencontramos en el que viene!",
  },
];

export const OCCASION_CATALOG: OccasionConfig[] = SEMILLAS.map((s) => ({
  ...s,
  enabled: false,
  imageUrl: null,
  specialties: s.specialties ?? [],
  milestonesOnly: s.milestonesOnly ?? false,
  offsetDays: s.offsetDays ?? null,
  builtIn: true,
}));

export const CUSTOM_OCCASION_PREFIX = "propia-";

export type OccasionRow = Omit<OccasionConfig, "builtIn" | "hint" | "cta" | "trigger">;

/** Une el catálogo con lo que guardó la institución, más sus fechas propias. */
export function mergeOccasions(rows: OccasionRow[]): OccasionConfig[] {
  const porClave = new Map(rows.map((r) => [r.key, r]));
  const delCatalogo = OCCASION_CATALOG.map((c) => {
    const r = porClave.get(c.key);
    return r
      ? { ...c, ...r, kind: c.kind, builtIn: true, hint: c.hint, cta: c.cta, trigger: c.trigger, offsetDays: r.offsetDays ?? c.offsetDays }
      : c;
  });
  const propias = rows
    .filter((r) => r.key.startsWith(CUSTOM_OCCASION_PREFIX))
    .map((r) => ({ ...r, kind: OCCASION_KINDS.EFEMERIDE, builtIn: false }));
  return [...delCatalogo, ...propias];
}

export function topicForOccasion(kind: OccasionKind): "efemerides" | "saludos" | "novedades" {
  if (kind === "LIFECYCLE") return "novedades";
  return kind === "EFEMERIDE" ? "efemerides" : "saludos";
}
