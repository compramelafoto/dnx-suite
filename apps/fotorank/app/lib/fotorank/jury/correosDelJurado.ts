/**
 * Lo que recibe un jurado cuando se abre el juzgamiento.
 *
 * Existía una plantilla llamada "Evaluación abierta" que nunca le llegó a
 * nadie: de los ocho avisos del jurado sólo dos mandaban correo, ése no estaba
 * entre ellos, y encima se pedía sin destinatario. El resultado fue que en la
 * primera Clickatón tres de los cuatro jurados no se enteraron de que ya
 * podían entrar, y las 270 obras quedaron sin calificar.
 *
 * El otro problema era el cuerpo. El envío armaba el texto volcando las
 * variables del evento, así que un jurado hubiera recibido "Evento:
 * JURY_INVITATION" y abajo la lista. Acá el correo está escrito para una
 * persona: qué le toca, cuánto es y dónde entra.
 */

export type DatosDelAviso = {
  /** Cómo se llama el concurso, tal como lo va a reconocer. */
  concurso: string;
  /** Cuántas obras le tocan a este jurado. */
  obras: number;
  /** En cuántas consignas o categorías están repartidas. */
  consignas: number;
  /** Cuántos criterios tiene que puntuar por obra. */
  criterios: number;
  /** Dónde entra. Absoluta, porque se lee fuera del sitio. */
  enlace: string;
  /** Hasta cuándo hay tiempo, ya escrito para leer. Vacío si no hay fecha. */
  cierre?: string;
};

export type CorreoArmado = {
  asunto: string;
  texto: string;
  html: string;
};

function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}

/**
 * El nombre del concurso, limpio de espacios de más.
 *
 * El de la primera Clickatón tiene un espacio doble guardado en la base, y en
 * un asunto de correo eso se ve. Se corrige al escribir y no en la base: el
 * título es de quien lo cargó, y un correo prolijo no justifica editárselo.
 */
function limpio(nombre: string): string {
  return nombre.replace(/\s+/g, " ").trim();
}

/**
 * Las frases que comparten el aviso y el recordatorio.
 *
 * `repetirElTotal` en falso saltea el recuento: en el recordatorio de alguien
 * que no empezó, la primera línea ya dijo el mismo número y repetirlo sonaba a
 * borrador sin revisar.
 */
function cuerpo(d: DatosDelAviso, { repetirElTotal = true } = {}): string[] {
  const lineas: string[] = [];
  if (repetirElTotal) {
    lineas.push(
      `Te tocaron ${plural(d.obras, "obra", "obras")}, repartidas en ` +
        `${plural(d.consignas, "consigna", "consignas")}.`,
    );
  } else {
    lineas.push(
      `Están repartidas en ${plural(d.consignas, "consigna", "consignas")}.`,
    );
  }
  lineas.push(
    `Cada fotografía se califica con ${plural(d.criterios, "criterio", "criterios")}, del 1 al 10.`,
    "Las obras se muestran sin el nombre de quien las tomó.",
  );
  if (d.cierre) lineas.push(`Hay tiempo hasta el ${d.cierre}.`);
  return lineas;
}

const COMO_ENTRAR =
  "Entrás con el mismo correo y la contraseña que elegiste cuando te registraste " +
  "como jurado. Si no te acordás, la podés recuperar desde la misma pantalla.";

const SE_GUARDA =
  "No hace falta que termines de una sentada: cada calificación se guarda sola y " +
  "podés volver cuando quieras.";

/**
 * "Ya podés calificar", que es la única novedad que importa.
 *
 * El asunto nombra el concurso porque un jurado puede estar en varios, y no
 * dice "evaluación" ni "sesión", que son palabras del sistema y no suyas.
 */
export function avisoDeJuzgamientoAbierto(
  entrada: DatosDelAviso,
): CorreoArmado {
  const d = { ...entrada, concurso: limpio(entrada.concurso) };
  const parrafos = [
    `Ya podés empezar a calificar las obras de ${d.concurso}.`,
    cuerpo(d).join(" "),
    COMO_ENTRAR,
    SE_GUARDA,
  ];
  return armar({
    asunto: `Ya podés calificar — ${d.concurso}`,
    saludo: "Hola,",
    parrafos,
    boton: { texto: "Empezar a calificar", enlace: d.enlace },
    cierre:
      "Si algo no funciona o reconocés alguna de las fotografías, escribinos antes de " +
      "seguir.",
  });
}

/**
 * El recordatorio, para quien todavía no entró.
 *
 * Dice cuántas le faltan y no cuántas lleva: a quien no empezó, "0 de 170" le
 * suena a reproche.
 */
export function recordatorioDeJuzgamiento(
  entrada: DatosDelAviso & { faltan: number },
): CorreoArmado {
  const d = { ...entrada, concurso: limpio(entrada.concurso) };
  const parrafos = [
    `Todavía quedan ${plural(d.faltan, "obra", "obras")} esperando tu calificación en ` +
      `${d.concurso}.`,
    cuerpo(d, { repetirElTotal: d.faltan !== d.obras }).join(" "),
    COMO_ENTRAR,
    SE_GUARDA,
  ];
  return armar({
    asunto: `Te esperan ${plural(d.faltan, "obra", "obras")} — ${d.concurso}`,
    saludo: "Hola,",
    parrafos,
    boton: { texto: "Seguir calificando", enlace: d.enlace },
    cierre:
      "Si no vas a poder participar del jurado, avisanos así reacomodamos el reparto.",
  });
}

/* ---------- el armado ---------- */

function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function armar(x: {
  asunto: string;
  saludo: string;
  parrafos: string[];
  boton: { texto: string; enlace: string };
  cierre: string;
}): CorreoArmado {
  const texto = [
    x.saludo,
    "",
    ...x.parrafos.flatMap((p) => [p, ""]),
    `${x.boton.texto}: ${x.boton.enlace}`,
    "",
    x.cierre,
  ].join("\n");

  // Sin hojas de estilo ni imágenes: el correo se lee igual en cualquier lado,
  // y lo que importa --el enlace-- no depende de que algo cargue.
  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#1b1917;max-width:34rem">',
    `<p>${escapar(x.saludo)}</p>`,
    ...x.parrafos.map((p) => `<p>${escapar(p)}</p>`),
    `<p><a href="${escapar(x.boton.enlace)}" style="display:inline-block;background:#e0a061;color:#1b1917;padding:12px 20px;text-decoration:none;font-weight:600">${escapar(x.boton.texto)}</a></p>`,
    `<p style="color:#5f594f;font-size:13px">${escapar(x.cierre)}</p>`,
    `<p style="color:#5f594f;font-size:13px">Si el botón no funciona, copiá esta dirección: ${escapar(x.boton.enlace)}</p>`,
    "</div>",
  ].join("\n");

  return { asunto: x.asunto, texto, html };
}
