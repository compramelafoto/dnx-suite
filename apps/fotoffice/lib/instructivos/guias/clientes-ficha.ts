import type { Instructivo } from "../tipos";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";

export const guia: Instructivo = {
  slug: "clientes-ficha",
  titulo: "La ficha del cliente, de punta a punta",
  resumen:
    "Todo lo que se hace desde la ficha de un cliente sin salir de ella: contactarlo, editar sus datos, ver y trabajar sus consultas, cotizaciones, pedidos, contratos y proyectos, mandarle un cuestionario, anotar, guardar archivos y leer su historia.",
  seccion: "Clientes y pedidos",
  moduleKey: CLIENTS_MODULE_KEY,
  minutos: 10,
  pasos: [
    {
      titulo: "Cómo llegar a la ficha",
      texto: [
        "Desde Clientes → «Padrón», tocá el nombre del cliente.",
        "En cualquier otra pantalla del panel (una cotización, un pedido, la Caja, la Bandeja de WhatsApp, la agenda, los informes), tocar el nombre de un cliente siempre lleva a su ficha.",
      ],
    },
    {
      titulo: "Arriba: el nombre y los botones de contacto",
      texto: [
        "Debajo del nombre están el número de cliente, el tipo (Persona o Empresa) y su categoría (Contacto, Cliente, Proveedor o Colaborador).",
        "Al lado hay una fila de botones redondos con un ícono. Si pasás el mouse por encima de cada uno, aparece qué hace:",
        "• El teléfono: llamar al cliente (en el celular abre la llamada).",
        "• El globo verde, «Enviar WhatsApp»: si el cliente te escribió por WhatsApp hace menos de 24 horas, abre su chat en la Bandeja de WhatsApp de FOTOFFICE para responderle desde ahí. Si pasaron más de 24 horas (o nunca escribió), abre WhatsApp Web con su número.",
        "• El sobre, «Enviar correo desde FOTOFFICE»: escribís el correo en el panel, con o sin plantilla, y sale desde el sistema.",
        "• «WhatsApp con plantilla»: elegís una plantilla, se completa con los datos del cliente y se abre WhatsApp con el texto listo.",
        "• «Pedir testimonio»: le manda al cliente el enlace para que deje su opinión en el sitio del estudio.",
        "• «Enviar cuestionario»: el cuestionario de XV, de bodas u otro (ver el paso «Mandarle un cuestionario»).",
      ],
      imagen: "/instructivos/clientes-ficha/01-encabezado.jpg",
      imagenAlt:
        "Ficha de un cliente de prueba: el nombre con el lápiz al lado, la fila de botones redondos (llamar, WhatsApp en verde con su leyenda «Enviar WhatsApp», correo, plantilla, testimonio y cuestionario), los siete cuadros de colores y los accesos directos de la historia.",
      sistema: [
        "Los correos y los WhatsApp que salen de estos botones quedan anotados en la historia del cliente, con la fecha y quién los mandó.",
        "El número no hace falta cargarlo con +54: FOTOFFICE entiende los números argentinos escritos como los dicta la gente (3415551234, 0341 15 555-1234).",
      ],
      nota: "Si un botón aparece apagado, al pasar el mouse dice por qué (por ejemplo, que el cliente no tiene correo cargado).",
    },
    {
      titulo: "El lápiz: todos los datos del cliente",
      texto: [
        "Al lado del nombre hay un lápiz. Al tocarlo se abre una ventana con todo lo que se puede editar del cliente:",
        "• «Datos»: tipo, nombre y apellido (o razón social), documento, condición frente al IVA, correo, teléfono, dirección y ciudad. Cambiá lo que haga falta y tocá «Guardar cambios».",
        "• «Datos de contacto»: categoría, celular, segundo correo, cumpleaños, sitio web, provincia, país, código postal y una nota «Sobre» la persona. Se cambian con «Editar».",
        "• «Más datos»: los campos propios del estudio (por ejemplo, «Archivos del cliente»). Se cambian con «Editar».",
        "• «¿Es socio?»: si la persona también es socio de la institución, elegilo y tocá «Guardar enlace» para unir las dos fichas.",
        "• «Personas relacionadas»: la mamá que paga el álbum, el novio, la empresa que factura. Tocá «+ Agregar», buscá a la otra persona (o creala) y elegí qué es para este cliente.",
        "Para cerrar la ventana, tocá la cruz o fuera de ella.",
      ],
      imagen: "/instructivos/clientes-ficha/02-ventana-datos.jpg",
      imagenAlt:
        "Ventana «Datos de» con el formulario de identidad y datos fiscales a la izquierda y, a la derecha, las tarjetas Datos de contacto y Más datos con su botón Editar.",
      nota: "Si al guardar falta un dato o hay un error, la ventana se vuelve a abrir sola mostrando el aviso.",
    },
    {
      titulo: "Etiquetas",
      texto: [
        "Debajo de los botones está «+ Etiqueta». Sirve para agrupar clientes («colegio», «casamiento 2026», «VIP») y después filtrarlos en el Padrón.",
      ],
    },
    {
      titulo: "Los cuadros de colores: el resumen del cliente",
      texto: [
        "Cada cuadro tiene el color de su tipo, el mismo en todo el panel: Consultas (verde azulado), Cotizaciones (ámbar), Pedidos (violeta), Contratos (azul), Proyectos (fucsia), Cobrado (verde) y Por cobrar (rojo).",
        "Cada uno muestra cuántos hay o cuánto dinero suma. En «Por cobrar» se ve además si hay algo vencido.",
        "Tocá un cuadro y se despliega debajo su lista. Tocalo de nuevo y se cierra. Así la ficha queda limpia y ves sólo lo que pediste.",
        "Desde cada lista se crea uno nuevo para este cliente: «Nueva consulta para este contacto», «Nueva cotización» o «Nuevo pedido».",
      ],
      imagen: "/instructivos/clientes-ficha/03-cuadro-desplegado.jpg",
      imagenAlt:
        "El cuadro Consultas tocado, con su borde marcado y la flecha hacia arriba, y debajo su lista desplegada con el botón «Nueva consulta para este contacto».",
    },
    {
      titulo: "Abrir una consulta, cotización o pedido sin salir de la ficha",
      texto: [
        "Dentro de la lista desplegada, tocá una consulta, una cotización, un pedido, un contrato o un proyecto. Se abre debajo, en la misma pantalla, con una franja de su color.",
        "Ahí se hace todo lo de siempre. En una consulta, por ejemplo: mover el recorrido de etapa, elegir responsable, marcar «Ganada» o «Perdida», tildar las tareas y editar los datos. Lo menos usado (cotizaciones y pedidos de esa consulta, participantes, contacto y mensaje, más datos, historial) está plegado: tocá el título para abrirlo.",
        "En la franja de arriba: «Abrir completa» lleva a la pantalla propia de ese elemento, y «Cerrar» lo cierra y te deja en la ficha.",
      ],
      nota: "El enlace de la barra del navegador incluye lo que tenés abierto: si lo copiás y se lo pasás a un compañero, le abre la ficha con lo mismo desplegado.",
    },
    {
      titulo: "Mandarle un cuestionario",
      texto: [
        "Los cuestionarios reemplazan a los formularios de Google: sirven para conocer al cliente y los detalles del evento (la familia, la temática, la música, los proveedores de la fiesta…). Vienen dos listos: «Cuestionario para quinceañeras» y «Cuestionario para bodas».",
        "Tocá el botón «Enviar cuestionario» (el portapapeles, al lado del nombre) y elegí cuál.",
        "Después elegí cómo mandárselo: «Enviar por WhatsApp» (se abre el chat con el mensaje y el enlace listos), «Enviar por correo» o «Copiar enlace» para pegarlo donde quieras.",
        "El cliente lo completa desde el celular, sin crear ninguna cuenta. Puede volver a entrar con el mismo enlace para corregir sus respuestas.",
      ],
      imagen: "/instructivos/clientes-ficha/04-enviar-cuestionario.jpg",
      imagenAlt:
        "Ventana «Enviar cuestionario» con los botones Cuestionario para quinceañeras y Cuestionario para bodas, y el botón Cerrar.",
      sistema: [
        "Si ya le habías mandado ese cuestionario y no lo respondió, FOTOFFICE reutiliza el mismo enlace en lugar de crear otro.",
        "Cuando el cliente lo envía, las respuestas aparecen solas en «Información adicional» de su ficha.",
      ],
    },
    {
      titulo: "La historia y sus accesos directos",
      texto: [
        "Debajo de los cuadros está la historia del cliente: todo lo que pasó, de lo más nuevo a lo más viejo (alta, ventas, pedidos, mensajes, cambios de datos). Tocá «Ver más» para lo anterior.",
        "Arriba de la historia hay botones para ver sólo una parte: «Todo», «Notas», «Cambios», «Mensajes», «Plata» (sólo para quien ve dinero), «Portal», «Carnets», «Archivos» e «Información adicional».",
      ],
    },
    {
      titulo: "Notas",
      texto: [
        "Tocá «Notas»: aparece la caja para escribir una nota nueva. Elegí la «Categoría» (por ejemplo, URGENTE u Observaciones), escribí lo que haya que recordar («prefiere que le escriban a la tarde») y tocá «Guardar nota». Hasta 4.000 caracteres.",
        "Debajo quedan todas las notas. En cada una podés «Editar», «Borrar» o «Fijar arriba» (hasta 3 fijadas, que se ven siempre primero).",
      ],
      imagen: "/instructivos/clientes-ficha/05-notas.jpg",
      imagenAlt:
        "Acceso directo Notas elegido: la caja para escribir una nota con Categoría, el texto de la nota y el botón Guardar nota.",
      sistema: ["Cada nota guarda quién la escribió y cuándo; si se borra, queda registrado quién la borró."],
    },
    {
      titulo: "Archivos",
      texto: [
        "Tocá «Archivos» para ver y subir documentos o fotos del cliente: un comprobante, la foto carnet, el contrato firmado.",
        "Tocá «Elegir archivos» o arrastralos al recuadro. Sirven PDF, imágenes, Word o Excel, de hasta 10 MB cada uno. Cada archivo se puede «Descargar» o «Borrar».",
      ],
      imagen: "/instructivos/clientes-ficha/06-archivos.jpg",
      imagenAlt:
        "Acceso directo Archivos elegido: el recuadro para arrastrar archivos con el botón Elegir archivos, que acepta PDF, imágenes, Word o Excel de hasta 10 MB.",
    },
    {
      titulo: "Información adicional",
      texto: [
        "Tocá «Información adicional» para leer todo lo que el cliente respondió en los cuestionarios, ordenado por cuestionario y por sección (cada pregunta en gris y la respuesta debajo).",
        "Abajo aparecen los cuestionarios enviados que todavía no respondió, con «Reenviar» y «Copiar enlace» para recordárselo.",
        "Si todavía no respondió ninguno, dice «Todavía no respondió ningún cuestionario» y tiene el botón para mandarle uno.",
      ],
      imagen: "/instructivos/clientes-ficha/07-informacion-adicional.jpg",
      imagenAlt:
        "Acceso directo Información adicional elegido, todavía sin respuestas: dice «Todavía no respondió ningún cuestionario» y ofrece el botón Enviar cuestionario.",
    },
    {
      titulo: "Consumo",
      texto: [
        "Si la Caja está encendida, en «Consumo» (plegado, arriba de la historia) están los movimientos de caja del cliente: qué compró, cuándo y cómo pagó. Tocá el título para desplegarlo.",
      ],
    },
  ],
};
