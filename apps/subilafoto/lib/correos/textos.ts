import type { Aviso } from "./calendario";

/**
 * Qué le decimos al cliente en cada aviso.
 *
 * Cinco correos que hacen dos cosas: contarle que su álbum está listo y ofrecerle la
 * descarga si compró sin ella. El último avisa que se borra.
 *
 * **Quien ya tiene la descarga recibe otra cosa.** Insistirle con que compre algo que ya
 * compró es la forma más rápida de que marque el correo como spam — y de que deje de
 * abrir los que sí importan.
 *
 * El texto va sin marca de Subí la Foto: para el cliente el servicio es de quien se lo
 * vendió. La única marca que aparece es la del vendedor.
 */

export type DatosDelAviso = {
  aviso: Aviso;
  nombreDelEvento: string;
  vendedor: string;
  /** A dónde entra el cliente. Enlace con su token. */
  panelUrl: string;
  /** Verdadero si ya tiene la descarga: comprada al inicio o después. */
  yaTieneLaDescarga: boolean;
  /** Cuándo se borra todo. */
  seBorraEl: string;
  precioDeLaDescarga: string;
};

export type Correo = { asunto: string; texto: string };

export function textoDelAviso(d: DatosDelAviso): Correo {
  return d.yaTieneLaDescarga ? conDescarga(d) : sinDescarga(d);
}

/** Para quien ya la tiene: sólo se le recuerda que baje antes del borrado. */
function conDescarga(d: DatosDelAviso): Correo {
  if (d.aviso === "dia-1") {
    return {
      asunto: `Las fotos de ${d.nombreDelEvento} ya están`,
      texto: cuerpo(d, [
        `Ya podés ver el álbum de ${d.nombreDelEvento} y descargar todas las fotos en su calidad original.`,
        `El álbum queda disponible hasta el ${d.seBorraEl}. Lo que descargues es tuyo y no se borra.`,
      ]),
    };
  }

  if (d.aviso === "dia-30") {
    return {
      asunto: `Hoy se borra el álbum de ${d.nombreDelEvento}`,
      texto: cuerpo(d, [
        `Hoy es el último día para descargar las fotos de ${d.nombreDelEvento}.`,
        "Si ya las bajaste, no tenés que hacer nada: lo que descargaste es tuyo.",
      ]),
    };
  }

  return {
    asunto: `¿Ya bajaste las fotos de ${d.nombreDelEvento}?`,
    texto: cuerpo(d, [
      `El álbum de ${d.nombreDelEvento} se borra el ${d.seBorraEl}.`,
      "Si todavía no descargaste las fotos, este es un buen momento.",
    ]),
  };
}

/** Para quien compró sin descarga: se le ofrece, sin repetir siempre lo mismo. */
function sinDescarga(d: DatosDelAviso): Correo {
  switch (d.aviso) {
    case "dia-1":
      return {
        asunto: `Las fotos de ${d.nombreDelEvento} ya están`,
        texto: cuerpo(d, [
          `Ya podés ver el álbum de ${d.nombreDelEvento} con todo lo que subieron los invitados.`,
          `Si querés llevarte todas las fotos en su calidad original, podés sumar la descarga por ${d.precioDeLaDescarga}.`,
          `El álbum queda disponible hasta el ${d.seBorraEl}.`,
        ]),
      };

    case "dia-3":
      return {
        asunto: `Las fotos de ${d.nombreDelEvento}, en calidad original`,
        texto: cuerpo(d, [
          "Las fotos del álbum se ven bien en pantalla, pero están reducidas.",
          `Con la descarga te llevás los archivos originales, los que sirven para imprimir o para guardar. Son ${d.precioDeLaDescarga}.`,
          `El álbum se borra el ${d.seBorraEl}.`,
        ]),
      };

    case "dia-7":
      return {
        asunto: `Pasó una semana de ${d.nombreDelEvento}`,
        texto: cuerpo(d, [
          "Ya pasó una semana y el álbum sigue ahí.",
          `Te queda hasta el ${d.seBorraEl} para llevarte las fotos. Después se borra y no hay forma de recuperarlo.`,
          `La descarga de todo el material cuesta ${d.precioDeLaDescarga}.`,
        ]),
      };

    case "dia-15":
      return {
        asunto: `Quedan quince días de ${d.nombreDelEvento}`,
        texto: cuerpo(d, [
          `El álbum de ${d.nombreDelEvento} se borra el ${d.seBorraEl}. Faltan quince días.`,
          `Si querés guardar las fotos, la descarga cuesta ${d.precioDeLaDescarga} y te llega en el momento.`,
        ]),
      };

    case "dia-30":
      return {
        asunto: `Hoy se borra el álbum de ${d.nombreDelEvento}`,
        texto: cuerpo(d, [
          `Hoy es el último día. Después de hoy las fotos de ${d.nombreDelEvento} se borran y no se pueden recuperar.`,
          `Si querés guardarlas, la descarga cuesta ${d.precioDeLaDescarga}.`,
        ]),
      };
  }
}

function cuerpo(d: DatosDelAviso, parrafos: string[]): string {
  return [...parrafos, "", d.panelUrl, "", `— ${d.vendedor}`].join("\n");
}
