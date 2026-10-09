import { formatArDay } from "@repo/muestras";

/**
 * Los textos de los correos de convocatoria y curaduría. Puros, para poder probar el tono: a
 * quien no quedó seleccionado se le escribe con cuidado, sin "rechazada".
 */
export type Texto = { subject: string; parrafos: string[]; enlace: { texto: string; url: string } };

const hola = (nombre: string | null) => `¡Hola${nombre ? ` ${nombre}` : ""}!`;
const lista = (titulos: readonly string[]) =>
  titulos.length <= 1
    ? `“${titulos[0] ?? ""}”`
    : `${titulos.slice(0, -1).map((t) => `“${t}”`).join(", ")} y “${titulos[titulos.length - 1]}”`;

export function textoEnvioRecibido(p: { nombre: string | null; convocatoria: string; obras: number; cierre: Date; appUrl: string }): Texto {
  return {
    subject: `Recibimos tus obras para "${p.convocatoria}"`,
    parrafos: [
      hola(p.nombre),
      `Recibimos ${p.obras === 1 ? "tu obra" : `tus ${p.obras} obras`} para la convocatoria “${p.convocatoria}”.`,
      `Podés cambiarlas o retirar el envío hasta el ${formatArDay(p.cierre)} (hora argentina).`,
    ],
    enlace: { texto: "Ver mis envíos", url: `${p.appUrl}/panel/envios` },
  };
}

export function textoConvocatoriaCerrada(p: { nombre: string | null; convocatoria: string; appUrl: string }): Texto {
  return {
    subject: `Cerró la convocatoria "${p.convocatoria}"`,
    parrafos: [
      hola(p.nombre),
      `La convocatoria “${p.convocatoria}” ya no recibe obras. Ahora el equipo curatorial las mira sin ver los nombres de sus autores.`,
      "Te escribimos cuando termine la selección.",
    ],
    enlace: { texto: "Ver mis envíos", url: `${p.appUrl}/panel/envios` },
  };
}

export function textoSeleccionada(p: { nombre: string | null; convocatoria: string; titulos: readonly string[]; appUrl: string }): Texto {
  const una = p.titulos.length === 1;
  return {
    subject: una ? `Tu obra quedó seleccionada para "${p.convocatoria}"` : `Tus obras quedaron seleccionadas para "${p.convocatoria}"`,
    parrafos: [
      hola(p.nombre),
      `El equipo curatorial eligió ${lista(p.titulos)} para la muestra “${p.convocatoria}”. ¡Felicitaciones!`,
      "Quien organiza la muestra se va a comunicar con vos para los detalles del montaje.",
    ],
    enlace: { texto: "Ver mis envíos", url: `${p.appUrl}/panel/envios` },
  };
}

export function textoNoSeleccionada(p: { nombre: string | null; convocatoria: string; recibidas: number; elegidas: number; appUrl: string }): Texto {
  return {
    subject: `Gracias por participar en "${p.convocatoria}"`,
    parrafos: [
      hola(p.nombre),
      `Gracias por mandar tus obras a “${p.convocatoria}”. Esta vez no quedaron en la selección: se recibieron ${p.recibidas} obras y la muestra tiene lugar para ${p.elegidas}.`,
      "Fue una decisión difícil del equipo curatorial y no habla del valor de tu trabajo. Ojalá te encontremos en la próxima convocatoria.",
    ],
    enlace: { texto: "Ver otras convocatorias", url: `${p.appUrl}/convocatorias` },
  };
}

export function textoInvitacionCurador(p: { convocatoria: string; organizador: string; url: string; vence: Date }): Texto {
  return {
    subject: `Te invitan a curar "${p.convocatoria}"`,
    parrafos: [
      "¡Hola!",
      `${p.organizador} te invita a formar parte del equipo curatorial de la convocatoria “${p.convocatoria}” en Muestras Fotográficas.`,
      "Vas a ver las obras sin el nombre de sus autores y a puntuarlas de 1 a 5. Para aceptar, entrá con la cuenta de Google de este mail.",
      `La invitación vence el ${formatArDay(p.vence)}.`,
    ],
    enlace: { texto: "Aceptar la invitación", url: p.url },
  };
}
