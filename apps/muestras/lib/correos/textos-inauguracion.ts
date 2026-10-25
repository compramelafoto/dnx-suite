import type { Texto } from "./textos-convocatoria";

/** Correos de la confirmación de asistencia (etapa 5, D23). Puros, para probar el tono. */
type Datos = { nombre: string; muestra: string; cuando: string; lugar: string; invitacion: string; ics: string };

const hola = (nombre: string) => `¡Hola${nombre ? ` ${nombre.split(" ")[0]}` : ""}!`;
const datos = (p: Datos) => [`Cuándo: ${p.cuando}.`, ...(p.lugar ? [`Dónde: ${p.lugar}.`] : []), `Para agendarla en tu calendario: ${p.ics}`];

export function textoAsistencia(p: Datos & { estado: "CONFIRMED" | "WAITLIST"; enlace: string }): Texto {
  const confirmada = p.estado === "CONFIRMED";
  return {
    subject: confirmada
      ? `Confirmaste tu asistencia a la inauguración de «${p.muestra}»`
      : `Quedaste en lista de espera para la inauguración de «${p.muestra}»`,
    parrafos: [
      hola(p.nombre),
      confirmada
        ? `Te esperamos en la inauguración de «${p.muestra}».`
        : `El cupo de la inauguración de «${p.muestra}» está completo: quedaste en lista de espera. Si se libera un lugar, pasás en orden de llegada y te avisamos.`,
      ...datos(p),
      "Con el enlace de abajo podés ver tu lugar o cancelarlo si no vas a poder ir. Guardalo: es sólo tuyo.",
    ],
    enlace: { texto: "Ver o cancelar mi lugar", url: p.enlace },
  };
}

export function textoLugarLiberado(p: Datos): Texto {
  return {
    subject: `Se liberó un lugar: te esperamos en la inauguración de «${p.muestra}»`,
    parrafos: [
      hola(p.nombre),
      `Se liberó un lugar y pasaste de la lista de espera a confirmada para la inauguración de «${p.muestra}».`,
      ...datos(p),
      "Si no vas a poder ir, cancelá con el enlace personal que te dimos al confirmar, así el lugar pasa a otra persona.",
    ],
    enlace: { texto: "Ver la invitación", url: p.invitacion },
  };
}
