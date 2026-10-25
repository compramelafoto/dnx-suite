import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import type { Instructivo } from "../tipos";

export const guia: Instructivo = {
  slug: "campanas-de-correo",
  titulo: "Mandar una campaña de correo a los socios",
  resumen:
    "Redactar un correo propio, elegir a qué socios les llega, probarlo, enviarlo o programarlo y ver cuántos lo abrieron.",
  seccion: "Comunicación",
  moduleKey: COMMUNICATIONS_MODULE_KEY,
  minutos: 10,
  pasos: [
    {
      titulo: "Creá la campaña",
      texto: [
        "En el menú, dentro de «Comunicación», tocá «Campañas» y después «Nueva campaña».",
        "Se abre un borrador vacío. Nada sale hasta que vos lo mandes.",
      ],
    },
    {
      titulo: "Escribí el correo",
      texto: [
        "Completá «Nombre interno» (sólo para reconocerla en la lista; los socios no lo ven), «Asunto» y «Texto».",
        "En el texto dejá una línea en blanco para separar párrafos. Si escribís {nombre}, a cada socio le aparece su nombre; {institucion} pone el nombre de la sociedad.",
        "Si querés, sumá una imagen y un botón: «Botón: texto» (por ejemplo «Inscribirme») y «Botón: dirección», el enlace al que lleva.",
      ],
    },
    {
      titulo: "Elegí a quién le llega",
      texto: [
        "En «¿A quién le llega?» podés marcar categorías de socio y especialidades. Sin marcar nada, le llega a todos los socios activos.",
        "Si marcás categorías y especialidades a la vez, el socio tiene que cumplir las dos cosas.",
      ],
      nota: "La cantidad de socios que aparece en ese recuadro se actualiza cuando guardás. Tocá «Guardar borrador» para ver el número con tu elección.",
    },
    {
      titulo: "Guardá y mandate una prueba",
      texto: [
        "Tocá «Guardar borrador». A la derecha, en «Así lo recibe el socio», ves cómo queda el correo.",
        "Después tocá «Enviarme una prueba»: te llega a tu propio correo, con lo último que guardaste. Revisalo en el teléfono y en la computadora.",
      ],
    },
    {
      titulo: "Si querés, programala",
      texto: [
        "En «Programar (opcional, hora argentina)» elegí día y hora. Si lo dejás vacío, sale en el momento en que la enviás (o la aprueban).",
      ],
    },
    {
      titulo: "Enviala o pedí aprobación",
      texto: [
        "Marcá la casilla «Revisé la prueba». Sin esa marca el sistema no deja enviar.",
        "Tocá el botón principal. Según cómo esté configurado dice «Guardar y enviar (o programar)» o «Guardar y pedir aprobación».",
      ],
      nota: "Si arriba aparece «Los envíos a socios están apagados», podés redactar y probar, pero no enviar hasta que se enciendan en Comunicación → Correo.",
    },
    {
      titulo: "Aprobar la campaña de otra persona",
      texto: [
        "Si la institución pide aprobación, la campaña queda «Esperando aprobación». La tiene que aprobar otra persona que gestione Comunicación, no quien la escribió.",
        "Quien aprueba abre la campaña y toca «Aprobar y enviar» (o «Aprobar», si estaba programada). Si hay algo para corregir, toca «Devolver a borrador».",
      ],
    },
    {
      titulo: "Cancelar una campaña programada",
      texto: [
        "Mientras no salió, una campaña «Programada» se puede frenar: abrila y tocá «Cancelar programación». Vuelve a borrador y la podés editar.",
      ],
    },
    {
      titulo: "Mirá cuántos la abrieron",
      texto: [
        "En la lista de «Campañas» cada una muestra Enviados, Abiertos y Clics. Al abrir una campaña enviada ves además Entregados y Rebotes (correos que no llegaron).",
      ],
      nota: "Las aperturas y los clics son aproximados: algunos programas de correo no avisan cuando se abre un mensaje.",
    },
  ],
};
