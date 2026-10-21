import type { Instructivo } from "../tipos";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";

export const guia: Instructivo = {
  slug: "clientes-buscar-y-alta",
  titulo: "Buscar un cliente, darlo de alta y usar su ficha",
  resumen:
    "Encontrar a un cliente por cualquier dato, cargar uno nuevo sin duplicarlo y usar su ficha: mensajes, notas, adjuntos y todo lo que hizo con el estudio.",
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
      titulo: "Leé la ficha",
      texto: [
        "Arriba está el número y la categoría (Contacto, Cliente, Proveedor o Colaborador).",
        "Al costado están sus Consultas, Presupuestos, Pedidos, Proyectos y Contratos, cada uno con su botón para crear uno nuevo para esta persona.",
        "En el centro, la línea de tiempo con todo lo que pasó (altas, ventas, pedidos, mensajes). Tocá «Ver más» para lo más viejo.",
      ],
    },
    {
      titulo: "Mandale un mensaje",
      texto: [
        "En la tarjeta «Mensaje» elegí Correo o WhatsApp y una plantilla (o «Sin plantilla» para escribirlo).",
        "Tocá «Enviar» (correo) o «Abrir WhatsApp» (se abre el chat con el texto listo y lo mandás vos).",
      ],
      sistema: ["El mensaje queda registrado en la ficha, con la fecha y quién lo mandó."],
    },
    {
      titulo: "Notas, etiquetas y adjuntos",
      texto: [
        "En las notas escribí lo que haya que recordar («prefiere que le escriban a la tarde») y tocá «Guardar nota».",
        "Las etiquetas sirven para agrupar (por ejemplo «colegio», «casamiento 2026») y después filtrar.",
        "En «Adjuntos», «Elegir archivos» guarda documentos o fotos en la ficha: un comprobante, la foto carnet, el contrato firmado. Hasta 10 MB cada uno.",
      ],
    },
    {
      titulo: "Corregí sus datos",
      texto: [
        "En «Datos» cambiá lo que haga falta y tocá «Guardar cambios». En «Perfil del contacto» están el celular, un segundo correo, el cumpleaños y la dirección completa.",
      ],
    },
  ],
};
