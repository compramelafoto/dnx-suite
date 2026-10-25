import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import type { Instructivo } from "../tipos";

export const guia: Instructivo = {
  slug: "placas-bienvenida-y-socio-de-la-semana",
  titulo: "Placas de bienvenida y del socio de la semana",
  resumen:
    "Descargar la placa de un socio nuevo y la del socio de la semana, con el texto listo para publicar en redes.",
  seccion: "Comunicación",
  moduleKey: COMMUNICATIONS_MODULE_KEY,
  minutos: 5,
  pasos: [
    {
      titulo: "Entrá a Bienvenidas",
      texto: [
        "En el menú de la izquierda, dentro de «Comunicación», tocá «Bienvenidas».",
        "Cada socio nuevo aparece solo en la lista «Para publicar» cuando paga su primera cuota. No hace falta cargarlo.",
      ],
    },
    {
      titulo: "Mirá la placa y el texto antes de bajarla",
      texto: [
        "En la tarjeta del socio tocá «Ver placa y texto». Se despliegan las dos versiones de la placa (cuadrada y para historias) y el texto sugerido.",
        "Si dice «No tiene foto de perfil», la placa sale con sus iniciales. Conviene pedirle la foto antes de publicar.",
      ],
    },
    {
      titulo: "Descargá la placa y copiá el texto",
      texto: [
        "Tocá «Descargar cuadrada» para el posteo del feed y «Descargar historia» para la historia de Instagram.",
        "Después tocá «Copiar texto sugerido»: el botón cambia a «¡Copiado!» y ya lo podés pegar en la publicación.",
      ],
    },
    {
      titulo: "Marcala como publicada",
      texto: [
        "Una vez que la subiste a las redes, volvé y tocá «Marcar como publicada». La tarjeta pasa a «Ya publicadas» y queda anotado quién y cuándo la publicó.",
        "Si te equivocaste, en esa misma tarjeta está «Marcar como no publicada».",
      ],
    },
    {
      titulo: "Si falta alguien, sumalo a mano",
      texto: [
        "Sólo entran solos quienes se asociaron con la solicitud y pagaron. Si a un socio lo dieron de alta a mano, al pie de la pantalla está «Sumar una bienvenida a mano».",
        "Elegí al socio en la lista y tocá «Sumar a la lista».",
      ],
      nota: "Esta parte sólo la ve quien gestiona Comunicación.",
    },
    {
      titulo: "Entrá a Socio de la semana",
      texto: [
        "En el menú, dentro de «Comunicación», tocá «Socio de la semana».",
        "Cada viernes a las 00:00 el sistema elige un socio al azar, sin repetir hasta que salieron todos. Arriba ves al de esta semana con su placa y su texto.",
      ],
    },
    {
      titulo: "Descargá, copiá y marcá como publicada",
      texto: [
        "Funciona igual que la bienvenida: «Descargar cuadrada», «Descargar historia», «Copiar texto sugerido» y, después de publicar, «Marcar como publicada».",
        "Si aparece «A su tarjeta le falta:», el socio no completó su perfil. El sistema le avisa solo por correo; si querés insistir, tocá «Mandarle el aviso ahora» o «Volver a mandarle el aviso».",
      ],
    },
    {
      titulo: "Si no corresponde, salteá al socio",
      texto: [
        "Si el socio pidió no salir o ya no está activo, abrí «Saltear a este socio», escribí el motivo si querés y tocá «Saltear y elegir otro».",
        "Se elige otro socio al azar para esta semana. El salteado no vuelve a salir en esta vuelta.",
      ],
      nota: "En «Historial» quedan todas las semanas anteriores, con los enlaces «Cuadrada» e «Historia» para volver a bajar cualquier placa.",
    },
  ],
};
