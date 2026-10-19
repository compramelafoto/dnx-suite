import type { Instructivo } from "../tipos";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";

export const guia: Instructivo = {
  slug: "trabajos-tablero-en-curso",
  titulo: "Organizar los trabajos en el tablero «En curso»",
  resumen:
    "Ver en una sola pantalla todos los trabajos del estudio, mandarlos al laboratorio, marcar cuándo llegan, avisarle al cliente y entregarlos.",
  seccion: "Trabajos y entregas",
  moduleKey: PROJECTS_MODULE_KEY,
  minutos: 7,
  pasos: [
    {
      titulo: "Abrí el tablero",
      texto: [
        "En el menú abrí «Proyectos». Arriba hay tres pestañas: «Tablero», «Lista» y «En curso». Elegí «En curso».",
        "Arriba de todo hay cuatro números: «En curso», «Vencidos» (en rojo), «Listos para retirar» y «Saldo por cobrar». Tocá «Vencidos» para ver sólo los atrasados.",
      ],
    },
    {
      titulo: "Entendé las cinco columnas",
      texto: [
        "«Recibido»: entró el trabajo y todavía no se empezó.",
        "«En proceso»: se está haciendo en el estudio (editar, diseñar, copiar).",
        "«En el proveedor»: está en el laboratorio o en la imprenta.",
        "«Listo para retirar»: ya está en el estudio. Hay que avisarle al cliente.",
        "«Entregado»: el cliente se lo llevó. Quedan visibles los últimos 7 días.",
      ],
      sistema: [
        "Cada trabajo tiene sus etapas propias (las de un fotolibro no son las de unas copias). El tablero agrupa esas etapas en estas cinco columnas para que se lean todas juntas.",
      ],
    },
    {
      titulo: "Leé una tarjeta",
      texto: [
        "Cada tarjeta muestra el cliente, «Debe $…» o «Pagado», el producto y el proveedor, y la fecha: «Entrega dd/mm», «Vencido dd/mm» (con borde rojo) o «Sin fecha».",
        "La barrita de arriba muestra cuántas etapas lleva hechas.",
        "Tocá el nombre para abrir la ficha completa del trabajo.",
      ],
    },
    {
      titulo: "Buscá y filtrá",
      texto: [
        "En «Buscar cliente, trabajo o número» escribí lo que tengas: un apellido, «fotolibro» o el número.",
        "«Todos los proveedores» filtra por laboratorio. «Sólo vencidos» deja los atrasados.",
        "Las pestañas de arriba («Todos» y una por tipo de trabajo) muestran un solo tipo, por ejemplo sólo impresiones.",
      ],
    },
    {
      titulo: "Mandalo al laboratorio",
      texto: [
        "Si el trabajo tiene proveedor asignado y todavía no se mandó, el botón de la tarjeta dice «Enviar a [proveedor]». Tocalo cuando lo mandes.",
        "Aparece «Marcado como enviado a …» y la tarjeta pasa a «En el proveedor».",
      ],
      sistema: [
        "Si el proveedor tiene correo cargado, le manda el pedido con las indicaciones del trabajo. Si no tiene, avisa «No tiene correo cargado: avisale por otro medio.».",
      ],
    },
    {
      titulo: "Marcá que llegó",
      texto: [
        "Cuando el trabajo vuelve del laboratorio, tocá «Llegó» en la tarjeta.",
        "La tarjeta pasa directo a «Listo para retirar».",
      ],
      sistema: [
        "Le manda al cliente el correo «Listo para retirar» con qué está listo, el saldo que debe, los datos para transferir, la dirección y el horario. Deja una nota en el trabajo con a quién se avisó.",
        "Si el cliente no tiene correo, avisa «El cliente no tiene correo cargado: avisale por WhatsApp.».",
      ],
    },
    {
      titulo: "Avisale por WhatsApp",
      texto: [
        "En «Listo para retirar» cada tarjeta tiene dos íconos: el de WhatsApp abre el chat con el mensaje ya escrito («Hola …! Tu pedido de … ya está listo para retirar. Queda un saldo de $…»); el del sobre reenvía el aviso por correo.",
        "En WhatsApp revisá el mensaje y tocá enviar. El sistema no lo manda solo.",
      ],
    },
    {
      titulo: "Avanzá un trabajo hecho en el estudio",
      texto: [
        "Si el trabajo no va al laboratorio, el botón de la tarjeta tiene el nombre de la etapa siguiente (por ejemplo «Diseño» o «Pedido listo para entregar»). Tocalo cuando termines cada paso.",
        "Para saltear un paso o corregir una tarjeta que quedó atrás, usá el ícono «Pasar a «etapa» a mano».",
      ],
      sistema: [
        "Cada vez que un trabajo entra en «Listo para retirar», por el botón o a mano, el aviso al cliente sale solo.",
        "En cada etapa nueva crea las tareas de esa etapa para el responsable.",
      ],
    },
    {
      titulo: "Entregá",
      texto: [
        "Cuando el cliente se lo lleva, tocá «Entregado». Mirá la guía «El cliente viene a retirar» para cobrar el saldo antes.",
      ],
    },
  ],
};
