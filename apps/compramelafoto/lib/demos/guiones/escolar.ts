import type { Guion } from "@/lib/demos/guiones/tipos";

/**
 * Guion de la charla «Vendé fotografía escolar sin listados ni cobros a mano».
 * `texto` es lo que ve el presentador; `aclaracion` es la tarjeta grande para el público.
 */
export const GUION_ESCOLAR: Guion = {
  id: "escolar",
  titulo: "Venta escolar de punta a punta",
  pasos: [
    {
      id: "inicio",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas",
      titulo: "Lo que vamos a ver",
      texto:
        "Recorremos una venta escolar completa: cómo se la ofrecés al colegio, cómo compran las familias, cómo se encuentran en las fotos con una selfie, y cómo imprimís y entregás los sobres.",
      aclaracion: {
        titulo: "Todo lo que van a ver es una demo",
        texto:
          "La escuela, los alumnos y las familias son inventados, y los pagos son simulados. Las pantallas son las reales: es exactamente lo que vas a usar con tus colegios.",
      },
    },
    {
      id: "landing",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas/landing",
      titulo: "1 · Tu landing escolar",
      texto:
        "Cada fotógrafo tiene su propia página para ofrecerle el servicio a los colegios: link para compartir, QR para imprimir y una lista de lo que te falta configurar. Las consultas que dejan los colegios llegan acá.",
      bot: "Pedile al bot: «mostrame cómo vengo con la configuración escolar».",
    },
    {
      id: "landing-publica",
      vista: "familia",
      ruta: (c) => `/${c.handler}/escolar`,
      titulo: "1 · Lo que ve el colegio",
      texto:
        "Así ve tu landing un directivo: tu marca, cómo trabajás, el cuidado de los datos de los chicos y un formulario para pedirte una propuesta.",
    },
    {
      id: "colegio-alta",
      vista: "fotografo",
      ruta: (c) => `/fotografo/escuelas/${c.schoolId}`,
      titulo: "2 · El colegio se suma",
      texto:
        "Das de alta el colegio, cargás los cursos y el listado de alumnos (se importa desde Excel) y le creás un usuario al colegio para que siga las ventas.",
      aclaracion: {
        titulo: "No hace falta tocar nada de esto a mano",
        texto:
          "Todo lo que ven en estas pantallas se puede configurar hablando con el bot: «creá la escuela Los Aromos, con sala de 5 y 6º A, y cargá este Excel». El bot hace cada paso y te pide confirmación.",
      },
      bot: "«Creá un curso 5º grado B en la Escuela Demo Los Aromos».",
    },
    {
      id: "colegio-comision",
      vista: "fotografo",
      ruta: (c) => `/dashboard/albums/${c.albumId}?tab=preventa`,
      titulo: "2 · El porcentaje del colegio",
      texto:
        "Acordás con el colegio qué parte de cada venta se lleva (en la demo, 10 %) y lo cargás en el álbum. El sistema la calcula sola en cada compra.",
      bot: "«Poné la comisión del colegio en 10 % para la preventa».",
    },
    {
      id: "colegio-panel",
      vista: "colegio",
      ruta: (c) => `/escuela/${c.schoolId}`,
      titulo: "3 · Lo que ve el colegio",
      texto:
        "El colegio entra con su usuario: ve su perfil (y lo puede editar), sus alumnos, el porcentaje acordado y las ventas que va generando. Por ahora está en cero.",
    },
    {
      id: "plantilla-catalogo",
      vista: "fotografo",
      ruta: () => "/dashboard/designs",
      titulo: "4 · La plantilla del librito",
      texto:
        "Elegís una plantilla de sistema (hay decenas de libritos para jardín, primaria y egresados) y la tocás «Usar y personalizar»: queda una copia tuya.",
      aclaracion: {
        titulo: "El diseño se arma solo",
        texto:
          "Cuando la familia elige sus fotos, el librito se arma automáticamente con el nombre del alumno, el curso, el colegio y el mosaico de todo el grado. Ustedes solo revisan y mandan a imprimir.",
      },
    },
    {
      id: "plantilla-editor",
      vista: "fotografo",
      ruta: (c) => (c.plantillaId ? `/fotografo/diseno/plantillas/v2/${c.plantillaId}/probar` : "/fotografo/diseno/plantillas/v2"),
      titulo: "4 · Probarla con el listado real",
      texto:
        "En «Probar», elegís el colegio y el curso, y la plantilla se completa con los alumnos reales: el mosaico con los 20 nombres y la tapa de cada chico. Pasás de alumno con las flechas.",
    },
    {
      id: "pack",
      vista: "fotografo",
      ruta: (c) => `/dashboard/albums/${c.albumId}?tab=preventa`,
      titulo: "5 · Los packs de preventa",
      texto:
        "Armás qué vendés antes de sacar las fotos: el librito con 5 digitales y un pack solo digital. La plantilla queda ligada al pack con librito.",
      bot: "«Creá un pack de 10 digitales a 18.000 pesos».",
    },
    {
      id: "preventa",
      vista: "familia",
      ruta: (c) => `/album/${c.albumSlug}/preventa`,
      titulo: "6 · La familia compra en preventa",
      texto:
        "La familia entra con el link que le pasa el colegio, elige el pack, busca a su hijo en el listado del curso y paga. Acá el pago es simulado: apretás «Pagar» y sigue como un pago real.",
      aclaracion: {
        titulo: "Cobrás antes de sacar la foto",
        texto:
          "La plata entra por Mercado Pago directo a tu cuenta, el colegio no maneja efectivo y vos no armás listados de quién pagó: el sistema ya sabe qué compró cada familia.",
      },
    },
    {
      id: "subida",
      vista: "fotografo",
      ruta: (c) => `/dashboard/albums/${c.albumId}?tab=fotos`,
      titulo: "7 · Subís las fotos",
      texto:
        "El día de la toma subís todo junto al álbum. El sistema reconoce las caras de cada foto en segundo plano. En la demo las fotos de la toma ya están cargadas: publicalas con el botón (y si querés, subí alguna más a mano).",
      accion: {
        etiqueta: "Publicar las fotos de la toma",
        endpoint: "/api/demo/fotos",
        hecho: "Listo: fotos publicadas y analizadas.",
      },
    },
    {
      id: "selfie",
      vista: "familia",
      ruta: (c) => `/album/${c.albumSlug}`,
      titulo: "8 · La familia se encuentra con una selfie",
      texto:
        "La galería está oculta: cada familia se saca una selfie (o sube una foto de su hijo) y ve solo las fotos donde aparece, más las grupales. Probalo con tu cara: sos el profesor de 6º A.",
      aclaracion: {
        titulo: "Privacidad de los chicos",
        texto:
          "Nadie ve las fotos de otros chicos. La selfie se usa solo para buscar, con consentimiento, y se borra según el plazo que fije el fotógrafo.",
      },
    },
    {
      id: "canje",
      vista: "familia",
      ruta: (c) => (c.ultimoPedidoId ? `/cliente/pack/${c.ultimoPedidoId}` : `/album/${c.albumSlug}`),
      titulo: "9 · Canjea y aprueba su librito",
      texto:
        "Con el link de su compra, la familia elige las fotos, ve el librito armado en 3D, puede cambiar una foto o reencuadrarla, y lo aprueba.",
    },
    {
      id: "pedidos",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas/pedidos",
      titulo: "10 · Te llega el pedido",
      texto:
        "Todos los pedidos del colegio en una línea de producción: por canjear, revisar diseño, para imprimir, en imprenta, para entregar y entregado. Revisás cada diseño y lo aprobás.",
    },
    {
      id: "imprenta",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas/pedidos",
      titulo: "11 · Todo a la imprenta",
      texto:
        "Seleccionás los pedidos aprobados, armás un lote y descargás un ZIP de JPG a 300 dpi, ya ordenado para la imprenta.",
    },
    {
      id: "sobres",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas/pedidos",
      titulo: "12 · Los sobres con QR",
      texto:
        "Imprimís las etiquetas de los sobres: alumno, curso, colegio, número de pedido y un QR. Al escanearlo ves la ficha de entrega de ese chico.",
      aclaracion: {
        titulo: "Entregar sin listas en papel",
        texto: "Cada sobre sabe de quién es. En el colegio escaneás el QR y marcás la entrega.",
      },
    },
    {
      id: "pantalla",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas/pedidos/pantalla",
      titulo: "13 · La pantalla de pedidos",
      texto:
        "Una vista para el televisor del estudio (o para compartir en una reunión con el colegio): cuántos pedidos hay en cada etapa y cuáles son.",
    },
    {
      id: "colegio-ventas",
      vista: "colegio",
      ruta: (c) => `/escuela/${c.schoolId}`,
      titulo: "14 · El colegio ve su venta",
      texto:
        "De vuelta en el panel del colegio: ahora aparece la venta y la comisión que le corresponde, sin que nadie le pase una planilla.",
    },
    {
      id: "cierre",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas",
      titulo: "Cierre",
      texto: "Repasá el recorrido y abrí preguntas.",
      aclaracion: {
        titulo: "Sin listados ni cobros a mano",
        texto:
          "Landing para conseguir colegios, preventa cobrada por Mercado Pago, búsqueda por selfie, librito que se arma solo, imprenta y sobres con QR. Y todo se configura conversando con el bot.",
      },
    },
  ],
};
