import type { Instructivo } from "../tipos";
import { GALLERY_MODULE_KEY } from "@/lib/galerias/acceso";

export const guia: Instructivo = {
  slug: "galerias-compartir-y-seleccion",
  titulo: "Compartir la galería y recibir la selección del cliente",
  resumen:
    "Mandarle a cada cliente su enlace, ver qué fotos eligió, pasar la selección a Lightroom, cerrarla y entregar las fotos en alta.",
  seccion: "Galerías",
  moduleKey: GALLERY_MODULE_KEY,
  minutos: 8,
  pasos: [
    {
      titulo: "Sumá al cliente",
      texto: [
        "En la pestaña «Clientes» aparece sugerido el contacto del trabajo: tocá «Agregar».",
        "Para otra persona (los novios por separado, la familia) usá «Otro contacto» o «Alta rápida» con Nombre, Correo y «Teléfono (WhatsApp, con código de país)». Hace falta un correo o un teléfono.",
      ],
    },
    {
      titulo: "Mandale su enlace",
      texto: [
        "Cada cliente tiene un enlace propio. Usá «Enviar por correo», «WhatsApp» (abre el chat con el mensaje armado) o «Copiar enlace».",
        "Quien tenga el enlace puede ver y descargar: mandáselo sólo a esa persona.",
        "Si se compartió de más, «Generar enlace nuevo» deja inútil el anterior. «Anular» le corta el acceso sin perder lo que ya eligió.",
      ],
      sistema: ["El envío por correo queda anotado en el «Historial» de la galería."],
      nota: "Si dice «Publicá la galería para poder compartir los enlaces.», falta publicarla.",
    },
    {
      titulo: "Qué hace el cliente",
      texto: [
        "Abre el enlace, toca el círculo de cada foto que quiere y termina con «Enviar selección» (o «Pagar fotos extra» si eligió más de las incluidas).",
        "En la lista de clientes vas a ver su estado: «Eligiendo», «Esperando tu revisión» o «Finalizada».",
      ],
    },
    {
      titulo: "Revisá la selección",
      texto: [
        "Cuando alguien envía, la galería avisa «N clientes enviaron su selección y están esperando tu revisión.». Tocá «Ver clientes» y después «Revisar la selección».",
        "Vas a ver cuándo entró, cuándo envió, el mensaje que dejó y las fotos elegidas. Filtrá por elegidas o por comentarios y respondé con «Responder».",
      ],
    },
    {
      titulo: "Pasala a Lightroom",
      texto: [
        "Tocá «Exportar la selección» y elegí «Lightroom» (o «Windows / Finder»).",
        "Copiá el texto y pegalo en Lightroom: Biblioteca → Filtro de biblioteca → Texto → Nombre de archivo → Contiene. Quedan a la vista sólo las fotos elegidas.",
      ],
    },
    {
      titulo: "Cerrá la selección",
      texto: [
        "Cuando ya trabajaste con esa selección, tocá «Finalizar selección». Queda cerrada: el cliente ya no puede cambiarla.",
        "Si el cliente pide cambiar algo, «Reactivar para que siga eligiendo».",
      ],
    },
    {
      titulo: "Fotos extra que compró",
      texto: [
        "En «Compras de fotos extra» están sus compras con fecha, fotos, total, estado y medio.",
        "Si te pagó en efectivo o por transferencia, tocá «Marcar pagada a mano» y elegí «Cómo pagó».",
      ],
      sistema: ["El pago queda anotado en Caja."],
    },
    {
      titulo: "Entregá todo en alta",
      texto: [
        "En una galería de Entrega, pestaña «Descargas», tocá «Preparar descarga».",
      ],
      sistema: ["Arma un ZIP en partes de hasta 1 GB, avisa por correo cuando está listo y las partes duran 7 días."],
    },
    {
      titulo: "Aprobación de un álbum",
      texto: [
        "En una galería de Álbum el cliente revisa las láminas por «Rondas» y responde «Aprobó el álbum» o «Pidió cambios».",
        "Con los cambios hechos, subí las láminas nuevas y abrí una ronda nueva. Las rondas anteriores quedan de sólo lectura.",
      ],
    },
  ],
};
