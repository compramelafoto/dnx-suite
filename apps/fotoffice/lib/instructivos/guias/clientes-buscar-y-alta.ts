import type { Instructivo } from "../tipos";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";

export const guia: Instructivo = {
  slug: "clientes-buscar-y-alta",
  titulo: "Buscar un cliente y darlo de alta",
  resumen:
    "Encontrar a un cliente por cualquier dato y cargar uno nuevo sin duplicarlo. Lo que se hace después en su ficha está en «La ficha del cliente, de punta a punta».",
  seccion: "Clientes y pedidos",
  moduleKey: CLIENTS_MODULE_KEY,
  minutos: 6,
  pasos: [
    {
      titulo: "Buscá al cliente",
      texto: [
        "En el menú abrí Clientes y elegí «Padrón».",
        "Escribí en «Buscar por nombre, documento, correo o teléfono». Si escribís un número, también busca por número de cliente.",
        "Para achicar la lista usá los filtros: Tipo, Estado, Categoría de contacto, Cumpleaños, Etiqueta, Alta y Movimientos, y tocá «Aplicar». Si vas a repetir una búsqueda, guardala desde «Vistas» → «Guardar vista actual».",
      ],
      imagen: "/instructivos/clientes-buscar-y-alta/01-padron.jpg",
      imagenAlt:
        "Pantalla Clientes con los botones Importar y Nuevo cliente, el buscador, los botones Vistas y Exportar, los filtros y la tabla con número, nombre, documento, correo, teléfono y categoría.",
      nota: "Desde el Cobrador también se busca y se carga un cliente sin salir de la venta («Buscar cliente» y el botón +).",
    },
    {
      titulo: "Antes de cargar uno nuevo, buscalo",
      texto: [
        "Buscá por teléfono y por DNI antes de dar de alta. Así no quedan dos fichas de la misma persona con la historia repartida.",
      ],
    },
    {
      titulo: "Cargá un cliente nuevo",
      texto: [
        "Tocá «Nuevo cliente».",
        "Elegí el «Tipo»: Persona (pide Nombre y Apellido) o Empresa (pide Razón social).",
        "En «Datos fiscales» completá Tipo de documento, Número de documento y Condición frente al IVA. En «Contacto», Correo, Teléfono, Dirección y Ciudad.",
        "Tocá «Crear cliente». Te lleva a su ficha con «Listo, se guardó.».",
      ],
      imagen: "/instructivos/clientes-buscar-y-alta/02-nuevo-cliente.jpg",
      imagenAlt:
        "Formulario Nuevo cliente con Identidad (Tipo, Nombre, Apellido) y Datos fiscales (Tipo de documento, Número de documento, Condición frente al IVA).",
      sistema: ["Le da el número de cliente siguiente y deja anotado el alta en su historia."],
      nota: "Pedí siempre el correo y el WhatsApp: son los medios por donde le llegan el pedido, los recibos y el aviso de «listo para retirar».",
    },
    {
      titulo: "Si aparece un aviso",
      texto: [
        "«Poné al menos el nombre o el apellido.»: falta el nombre.",
        "«El DNI tiene que tener siete u ocho dígitos.»: revisá el número, sin puntos.",
        "«Un responsable inscripto necesita CUIT para poder facturarle.»: cambiá el tipo de documento a CUIT.",
      ],
    },
    {
      titulo: "Seguí en su ficha",
      texto: [
        "Todo lo que se hace con el cliente (llamarlo, escribirle, editar sus datos, ver sus consultas, cotizaciones y pedidos, mandarle un cuestionario, anotar y guardar archivos) está explicado en la guía «La ficha del cliente, de punta a punta».",
      ],
    },
  ],
};
