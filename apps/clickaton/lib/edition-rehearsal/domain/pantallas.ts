/**
 * La pantalla real que corresponde a cada paso del ensayo.
 *
 * El ensayo dice qué pasaría; estos enlaces dejan ir a verlo con los propios
 * ojos y tocar los botones. Los pasos que dependen de una inscripción sólo
 * ofrecen enlace cuando el ensayo completo creó una de verdad.
 */

export type PantallaDePaso = {
  numero: number;
  etiqueta: string;
  url: string;
  /** Quién ve normalmente esa pantalla. */
  publico: "PARTICIPANTE" | "ORGANIZADOR";
  /** Qué se puede probar ahí. */
  queProbar: string;
};

export type ContextoDePantallas = {
  editionId: string;
  editionSlug: string;
  /** Inscripción ficticia del ensayo completo, si existe. */
  registrationId?: string | null;
};

export function pantallaDelPaso(
  numero: number,
  ctx: ContextoDePantallas,
): PantallaDePaso | null {
  const reg = ctx.registrationId ?? null;

  switch (numero) {
    case 1:
      return {
        numero,
        etiqueta: "Ver la página de la maratón",
        url: `/maratones/${ctx.editionSlug}`,
        publico: "PARTICIPANTE",
        queProbar: "Mirá qué dice el botón de inscripción y si la información está completa.",
      };
    case 2:
      return {
        numero,
        etiqueta: "Ver el formulario de inscripción",
        url: `/maratones/${ctx.editionSlug}/inscripcion`,
        publico: "PARTICIPANTE",
        queProbar:
          "Recorré el formulario como si te anotaras: los precios, los talles, lo que pide.",
      };
    case 5:
      return reg
        ? {
            numero,
            etiqueta: "Ver la credencial con el QR",
            url: `/mi-cuenta/inscripciones/${reg}`,
            publico: "PARTICIPANTE",
            queProbar: "Mirá la credencial que le queda a la persona y el código para la puerta.",
          }
        : null;
    case 6:
      return {
        numero,
        etiqueta: "Abrir el escáner de acreditación",
        url: `/admin/ediciones/${ctx.editionId}/acreditacion/escanear`,
        publico: "ORGANIZADOR",
        queProbar: "Probá escanear el QR de la credencial y ver el semáforo del ingreso.",
      };
    case 7:
    case 8:
      return reg
        ? {
            numero,
            etiqueta:
              numero === 7
                ? "Ver la pantalla del participante"
                : "Ver las consignas como las ve el participante",
            url: `/en-vivo/${reg}`,
            publico: "PARTICIPANTE",
            queProbar:
              numero === 7
                ? "Mirá la cuenta regresiva y el estado de la acreditación."
                : "Mirá las consignas liberadas, sus indicaciones y sus horarios.",
          }
        : null;
    case 9:
      return reg
        ? {
            numero,
            etiqueta: "Probar la subida de una foto",
            url: `/en-vivo/${reg}`,
            publico: "PARTICIPANTE",
            queProbar:
              "Desde la misma pantalla, elegí una consigna y probá subir una foto de verdad.",
          }
        : null;
    case 10:
      return {
        numero,
        etiqueta: "Abrir la admisión técnica",
        url: `/admin/ediciones/${ctx.editionId}/admision`,
        publico: "ORGANIZADOR",
        queProbar: "Mirá cómo quedan las fotos revisadas y qué motivo les puso el sistema.",
      };
    default:
      return null;
  }
}

/** Todas las pantallas disponibles del recorrido, en orden. */
export function pantallasDelRecorrido(ctx: ContextoDePantallas): PantallaDePaso[] {
  const salida: PantallaDePaso[] = [];
  for (let numero = 1; numero <= 10; numero += 1) {
    const pantalla = pantallaDelPaso(numero, ctx);
    if (pantalla) salida.push(pantalla);
  }
  return salida;
}
