import type { Guion } from "@/lib/demos/guiones/tipos";

/**
 * Guion de la charla «Vendé fotografía escolar sin listados ni cobros a mano».
 * `texto` es lo que se ve en pantalla; `puntos` y `puente` son el hilo del presentador (solo en la
 * guía abierta en otra ventana); `aclaracion` es la tarjeta grande para el público.
 * Los nombres de pestañas y botones citados son los que muestra cada pantalla.
 */
export const GUION_ESCOLAR: Guion = {
  id: "escolar",
  titulo: "Venta escolar de punta a punta",
  pasos: [
    // ── Introducción ──────────────────────────────────────────────────────────────────────
    {
      id: "inicio",
      etapa: "Introducción",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas",
      titulo: "De qué se trata",
      texto: "El módulo «Escolar» del fotógrafo: desde acá se maneja todo lo del colegio.",
      puntos: [
        "Presentate y contá en una frase qué es lo que más trabajo da hoy en la foto escolar: listados en papel, cobrar en efectivo, armar sobres a mano.",
        "Lo que van a ver es una venta escolar completa, de punta a punta, en las pantallas reales.",
        "Todo es una demo: escuela, alumnos y familias inventados, pagos simulados. Nada de lo que toquemos se rompe.",
        "Señalá el título «Escolar» y la frase de abajo: instituciones, alumnos, preventas y producción en un solo lugar.",
      ],
      aclaracion: {
        titulo: "Todo lo que van a ver es una demo",
        texto:
          "La escuela, los alumnos y las familias son inventados, y los pagos son simulados. Las pantallas son las reales: es exactamente lo que vas a usar con tus colegios.",
      },
      puente: "Antes de entrar en pantallas, mostrá el mapa del recorrido para que todos sepan dónde estamos.",
    },
    {
      id: "recorrido",
      etapa: "Introducción",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas",
      titulo: "El recorrido en siete etapas",
      texto: "La tarjeta para el público muestra las siete etapas; la pantalla de fondo sigue siendo «Escolar».",
      puntos: [
        "1, conseguir el colegio. 2, acordar con el colegio. 3, preparar qué vas a vender.",
        "4, la preventa: las familias pagan antes de la sesión. 5, el día de la toma.",
        "6, la familia busca sus fotos con una selfie y arma su librito. 7, producción y entrega con sobres con QR.",
        "Remarcá el orden: primero se vende y se cobra, después se saca la foto.",
        "Cerramos viendo cómo el colegio sigue su parte de la venta.",
      ],
      aclaracion: {
        titulo: "El recorrido",
        texto:
          "1 Conseguir el colegio · 2 Acordar con el colegio · 3 Preparar la venta · 4 Preventa · 5 Día de la toma · 6 La familia elige · 7 Producción y entrega.",
      },
      puente: "Arrancamos por el principio: ¿cómo llega un colegio a trabajar con vos?",
    },

    // ── 1 · Conseguir el colegio ──────────────────────────────────────────────────────────
    {
      id: "landing",
      etapa: "1 · Conseguir el colegio",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas/landing",
      titulo: "Tu landing escolar",
      texto: "«Mi landing escolar»: la dirección de tu página, el QR, lo que le falta y las consultas de colegios.",
      puntos: [
        "Cada fotógrafo tiene una página propia para ofrecerle el servicio a los colegios, con su marca.",
        "Arriba, «Dirección de tu landing»: la copiás para mandar por WhatsApp o descargás el QR para imprimirlo en un folleto.",
        "«Qué le falta a tu landing» es una lista de tareas: te dice qué completar para que se vea bien.",
        "Abajo, «Consultas de colegios»: cuando un directivo pide una propuesta, llega acá con sus datos y la cantidad de alumnos.",
      ],
      bot: "Pedile al bot: «mostrame cómo vengo con la configuración escolar».",
      puente: "Veamos ahora qué ve el directivo cuando abre ese link.",
    },
    {
      id: "landing-publica",
      etapa: "1 · Conseguir el colegio",
      vista: "familia",
      ruta: (c) => `/${c.handler}/escolar`,
      titulo: "Lo que ve el colegio",
      texto: "La landing pública del estudio: «Fotografía escolar sin gestionar cobros ni pedidos».",
      puntos: [
        "Arriba, el logo y el nombre del estudio: es tu página, no la de la plataforma.",
        "Bajá despacio: «Cómo funciona» explica la preventa, «Qué cambia para el colegio», «Quién se queda con qué».",
        "Detenete en «Privacidad»: es lo primero que pregunta un directivo.",
        "Al final, «Contanos sobre tu colegio»: el formulario que te llega como consulta en la pantalla anterior.",
        "La idea: el colegio entiende solo cómo trabajás y te pide la propuesta.",
      ],
      puente: "El colegio dijo que sí. Ahora hay que darlo de alta y acordar las condiciones.",
    },

    // ── 2 · Acordar con el colegio ────────────────────────────────────────────────────────
    {
      id: "colegio-alta",
      etapa: "2 · Acordar con el colegio",
      vista: "fotografo",
      ruta: (c) => `/fotografo/escuelas/${c.schoolId}`,
      titulo: "El colegio se suma",
      texto: "La ficha de la Escuela Demo Los Aromos, con sus pestañas: Institución, Administradores, Gestión escolar, Álbumes…",
      puntos: [
        "Pestaña «Institución»: logo, nombre y contacto del colegio.",
        "Pestaña «Gestión escolar»: los cursos y el listado de alumnos. El listado se importa desde un Excel que te pasa el colegio.",
        "Pestaña «Álbumes»: cada colegio tiene su álbum; ahí va a pasar toda la venta.",
        "Pestaña «Administradores»: le creás un usuario al colegio para que siga sus ventas sin pedirte planillas.",
      ],
      aclaracion: {
        titulo: "No hace falta tocar nada de esto a mano",
        texto:
          "Todo lo que ven en estas pantallas se puede configurar hablando con el bot: «creá la escuela Los Aromos, con sala de 5 y 6º A, y cargá este Excel». El bot hace cada paso y te pide confirmación.",
      },
      bot: "«Creá un curso 5º grado B en la Escuela Demo Los Aromos».",
      puente: "Con el colegio cargado, falta lo que más le importa al colegio: qué parte de la venta le toca.",
    },
    {
      id: "colegio-comision",
      etapa: "2 · Acordar con el colegio",
      vista: "fotografo",
      ruta: (c) => `/dashboard/albums/${c.albumId}`,
      titulo: "El porcentaje del colegio",
      texto: "El álbum del colegio. La comisión está en la pestaña «Venta» → «Comisión escolar».",
      puntos: [
        "El álbum abre en «Resumen»: tocá «Venta» y después «Comisión escolar».",
        "Ahí cargás el porcentaje que acordaste con el colegio: en la demo, 10 %.",
        "Elegís a qué se aplica: solo la preventa, las ventas posteriores, los extras.",
        "El sistema la calcula sola en cada compra: nadie hace cuentas a fin de mes.",
        "La comisión es un acuerdo entre vos y el colegio; la plataforma no se mete.",
      ],
      bot: "«Poné la comisión del colegio en 10 % para la preventa».",
      puente: "Veamos cómo lo ve el colegio desde su propio usuario.",
    },
    {
      id: "colegio-panel",
      etapa: "2 · Acordar con el colegio",
      vista: "colegio",
      ruta: (c) => `/escuela/${c.schoolId}`,
      titulo: "El panel del colegio",
      texto: "«Panel Escuela»: lo que ve la dirección del colegio con su usuario.",
      puntos: [
        "Cambiamos de persona: ahora somos el colegio (botón «Colegio» de la guía).",
        "Arriba, «Editar perfil»: el colegio mantiene su logo y sus datos.",
        "«Fotógrafo responsable»: sabe con quién trabaja.",
        "«Ventas generadas por la escuela»: hoy está todo en cero, porque todavía no se vendió nada.",
        "Más abajo, sus alumnos. Volvemos a este panel al final, cuando ya haya ventas.",
      ],
      puente: "El colegio está listo. Ahora, antes de abrir la venta, el fotógrafo decide qué va a vender.",
    },

    // ── 3 · Preparar la venta ─────────────────────────────────────────────────────────────
    {
      id: "pack",
      etapa: "3 · Preparar la venta",
      vista: "fotografo",
      ruta: (c) => `/dashboard/albums/${c.albumId}`,
      titulo: "Qué vendés: los packs de preventa",
      texto: "El álbum del colegio, pestaña «Venta» → «Packs de preventa».",
      puntos: [
        "Volvemos al fotógrafo. Explicá la lógica: la familia compra antes de la sesión, entonces primero hay que definir qué compra.",
        "Tocá «Venta» → «Packs de preventa». Leé la frase de arriba: el cliente compra primero y elige las imágenes después.",
        "En la demo hay dos packs: un librito impreso con 5 fotos digitales, y uno solo digital de 10 fotos.",
        "Precios: 38.000 pesos el pack con librito y 18.000 pesos el digital.",
        "El pack con librito es un producto impreso, y para imprimirlo necesita un diseño. Eso es lo que vemos ahora.",
      ],
      bot: "«Creá un pack de 10 digitales a 18.000 pesos».",
      puente: "El librito necesita un diseño: veamos de dónde sale, sin que tengas que diseñar uno por chico.",
    },
    {
      id: "plantilla-catalogo",
      etapa: "3 · Preparar la venta",
      vista: "fotografo",
      ruta: () => "/dashboard/designs",
      titulo: "El diseño del librito: plantillas",
      texto: "«Diseños»: arriba tus plantillas, abajo las «Plantillas del sistema» con filtros.",
      puntos: [
        "Conectá con lo anterior: el librito del pack sale de una plantilla.",
        "En «Plantillas del sistema» hay decenas de libritos listos: jardín, primaria, egresados.",
        "Mostrá los filtros: nivel, cantidad de fotos, si lleva el listado del curso o el mosaico de compañeros.",
        "«Ver en 3D» para mostrar cómo queda; «Usar y personalizar» hace una copia tuya que podés cambiar.",
        "En la demo ya está copiada y ligada al pack con librito: está en «Mis plantillas».",
      ],
      aclaracion: {
        titulo: "El diseño se arma solo",
        texto:
          "Cuando la familia elige sus fotos, el librito se arma automáticamente con el nombre del alumno, el curso, el colegio y el mosaico de todo el grado. Ustedes solo revisan y mandan a imprimir.",
      },
      puente: "¿Cómo sé que la plantilla funciona con mi colegio? La pruebo con el listado real.",
    },
    {
      id: "plantilla-editor",
      etapa: "3 · Preparar la venta",
      vista: "fotografo",
      ruta: (c) => (c.plantillaId ? `/fotografo/diseno/plantillas/v2/${c.plantillaId}/probar` : "/fotografo/diseno/plantillas/v2"),
      titulo: "Probar la plantilla con el listado",
      texto: "«Probar … con fotos»: elegís fotos de un álbum y el curso, y ves el librito armado.",
      puntos: [
        "Elegí el álbum de la demo y unas fotos, como lo haría una familia.",
        "En «Listado de alumnos» elegí la escuela y el curso: el mosaico se llena con los 20 nombres reales.",
        "Con «‹ Anterior» y «Siguiente ›» pasás de alumno: cada uno tiene su tapa con su nombre.",
        "«Ver librito en 3D» para mostrarlo como lo va a ver la familia.",
        "Remarcá: esto lo hacés una vez por colegio, no una vez por chico.",
      ],
      puente: "Ya está todo listo para vender. Abramos la preventa como si fuéramos una familia.",
    },

    // ── 4 · Preventa ──────────────────────────────────────────────────────────────────────
    {
      id: "preventa",
      etapa: "4 · Preventa",
      vista: "familia",
      // Con el link que comparte el colegio (`?ref=school_<id>`): así la venta le suma comisión.
      ruta: (c) => `/album/${c.albumSlug}?ref=school_${c.schoolId}`,
      titulo: "La familia compra en preventa",
      texto: "La página de preventa del álbum, abierta con el link que comparte el colegio.",
      puntos: [
        "Ahora somos una familia (botón «Familia»). Entramos con el link que mandó el colegio por WhatsApp.",
        "Arriba: «Elegí tu opción». Elegí el pack con librito.",
        "Mostrá «¿Cómo funciona?»: comprás ahora, se hace la sesión, te avisamos, elegís tus fotos.",
        "En «Datos del alumno» buscá a un chico por nombre: sale del listado que cargó el colegio. Nada de escribir nombres mal.",
        "Completá «Tus datos» y tocá pagar: el pago es simulado y sigue igual que un pago real.",
        "Remarcá que el colegio no maneja efectivo y vos no armás listas de quién pagó.",
      ],
      aclaracion: {
        titulo: "Cobrás antes de sacar la foto",
        texto:
          "El dinero entra por Mercado Pago directo a tu cuenta, el colegio no maneja efectivo y vos no armás listados de quién pagó: el sistema ya sabe qué compró cada familia.",
      },
      puente: "La familia ya pagó. Llega el día de la sesión de fotos.",
    },

    // ── 5 · Día de la toma ────────────────────────────────────────────────────────────────
    {
      id: "subida",
      etapa: "5 · Día de la toma",
      vista: "fotografo",
      ruta: (c) => `/dashboard/albums/${c.albumId}`,
      titulo: "Subís las fotos",
      texto: "El álbum, pestaña «Contenido» → «Fotos»: la zona para subir archivos o una carpeta completa.",
      puntos: [
        "Volvemos al fotógrafo. Tocá «Contenido».",
        "Mostrá «Subir carpeta completa»: subís todo lo de la jornada de una vez, sin separar por chico.",
        "El sistema reconoce las caras de cada foto en segundo plano.",
        "En la demo las fotos ya están cargadas: tocá «Publicar las fotos de la toma» en esta guía y aparecen.",
        "Si querés, subí alguna foto más a mano para mostrar la subida.",
      ],
      accion: {
        etiqueta: "Publicar las fotos de la toma",
        endpoint: "/api/demo/fotos",
        hecho: "Listo: fotos publicadas y analizadas.",
      },
      puente: "Las fotos están arriba. ¿Cómo encuentra cada familia las de su hijo entre cientos?",
    },

    // ── 6 · La familia elige ──────────────────────────────────────────────────────────────
    {
      id: "selfie",
      etapa: "6 · La familia elige",
      vista: "familia",
      ruta: (c) => `/album/${c.albumSlug}`,
      titulo: "Se encuentra con una selfie",
      texto: "«Galería con fotos ocultas»: nadie ve todas las fotos; cada uno se busca con una selfie.",
      puntos: [
        "Somos la familia de nuevo. La galería no muestra nada hasta que te identificás.",
        "Aceptá el consentimiento y sacate una selfie (en la computadora aparece un QR para hacerlo con el celular).",
        "Hacelo en vivo con tu cara: sos el profesor de 6º A y vas a aparecer en tus fotos.",
        "Mostrá que solo aparecen las fotos donde estás vos, más las grupales.",
        "Mencioná «Borrar mi selfie ahora»: la familia controla su dato.",
      ],
      aclaracion: {
        titulo: "Privacidad de los chicos",
        texto:
          "Nadie ve las fotos de otros chicos. La selfie se usa solo para buscar, con consentimiento, y se borra según el plazo que fije el fotógrafo.",
      },
      puente: "Ya encontró sus fotos. Ahora usa lo que compró en la preventa.",
    },
    {
      id: "canje",
      etapa: "6 · La familia elige",
      vista: "familia",
      // El link del correo de la familia (que en la demo no sale): lo genera el servidor.
      ruta: () => "/api/demo/canje",
      titulo: "Elige sus fotos y aprueba el librito",
      texto: "El pack de la familia: «Elegir las fotos de mi pack», el librito armado y «Confirmar mi pack».",
      puntos: [
        "Este es el link que le llega a la familia cuando avisás que están las fotos.",
        "Tocá «Elegir las fotos de mi pack» y elegí las fotos: el contador dice cuántas faltan.",
        "Aparece el librito ya armado con el nombre del chico. «Ver en 3D» y pasá las hojas.",
        "Mostrá «Cambiar foto» y «Acomodar»: la familia corrige sola, sin escribirte.",
        "Pasá a la hoja de adentro: el mosaico «Mis compañeros» ya está armado con todo el grado, cada chico con su foto y su nombre.",
        "Explicá de dónde sale: cada chico del padrón del colegio tiene un retrato oficial. La familia que compra lo elige al canjear (es la foto de su carpeta, encuadrada en la cara).",
        "¿Y el que no compró? Aparece igual en el mosaico de todos: ningún chico queda afuera. Su retrato lo pone el fotógrafo desde las fotos de la toma.",
        "¿Cómo se sabe qué nombre va con qué cara? El nombre nunca se adivina: sale del padrón. El retrato de quien compró queda atado a su alumno al canjear; los que nadie reclamó los nombra el colegio con un enlace, eligiendo de la lista del curso, y el fotógrafo revisa.",
        "Antes de imprimir el fotógrafo cierra el curso: desde ahí el mosaico no cambia y todas las carpetas del grado salen iguales.",
        "Al final marca «Revisé todos los datos y autorizo la impresión» y toca «Confirmar mi pack».",
        "Remarcá: la familia aprobó el diseño; no hay reclamos después de imprimir.",
      ],
      aclaracion: {
        titulo: "El mosaico del curso",
        texto:
          "Están todos los chicos del grado, hayan comprado o no. Los nombres salen del padrón del colegio: el retrato de quien compró queda atado a su alumno al canjear, y los que nadie reclamó los nombra el colegio con un enlace. Ningún nombre se pone a ojo.",
      },
      puente: "Del lado del fotógrafo, ese pedido aprobado ya está esperando.",
    },

    // ── 7 · Producción y entrega ──────────────────────────────────────────────────────────
    {
      id: "pedidos",
      etapa: "7 · Producción y entrega",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas/pedidos",
      titulo: "Te llega el pedido",
      texto: "«Pedidos escolares»: la línea de producción con sus siete etapas y la tabla de pedidos.",
      puntos: [
        "Volvemos al fotógrafo. Leé las etapas de izquierda a derecha: Por canjear, Revisar diseño, Cambios pedidos, Para imprimir, En imprenta, Para entregar, Entregado.",
        "Cada pedido está en una etapa y la tabla dice «Qué hacer» con cada uno.",
        "Filtrá por escuela y curso si tenés varios colegios.",
        "Abrí el diseño del pedido que acabamos de hacer y aprobalo.",
      ],
      puente: "Con los diseños aprobados, los mandamos a imprimir todos juntos.",
    },
    {
      id: "imprenta",
      etapa: "7 · Producción y entrega",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas/pedidos",
      titulo: "Todo a la imprenta",
      texto: "Misma pantalla: «Crear lote de impresión» y «Descargar para la imprenta».",
      puntos: [
        "En «Para imprimir», tocá «Crear lote de impresión»: junta todos los pedidos aprobados.",
        "«Descargar para la imprenta»: un ZIP listo para mandar, en PDF o en JPG, ya ordenado.",
        "Cuando vuelve de la imprenta, «Marcar lote impreso» y los pedidos avanzan solos de etapa.",
      ],
      puente: "Llegaron los libritos impresos. Falta lo más tedioso de siempre: los sobres.",
    },
    {
      id: "sobres",
      etapa: "7 · Producción y entrega",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas/pedidos",
      titulo: "Los sobres con QR",
      texto: "Misma pantalla, etapa «Para entregar»: «Imprimir etiquetas».",
      puntos: [
        "Tocá «Imprimir etiquetas»: sale un PDF en hoja A4, 24 etiquetas por hoja.",
        "Cada etiqueta lleva alumno, curso, colegio, número de pedido y un QR.",
        "En el colegio escaneás el QR y ves la ficha de entrega de ese chico.",
        "«Marcar entregados» cierra el pedido.",
      ],
      aclaracion: {
        titulo: "Entregar sin listas en papel",
        texto: "Cada sobre sabe de quién es. En el colegio escaneás el QR y marcás la entrega.",
      },
      puente: "Y para tener todo esto a la vista en el estudio, hay una pantalla especial.",
    },
    {
      id: "pantalla",
      etapa: "7 · Producción y entrega",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas/pedidos/pantalla",
      titulo: "La pantalla de pedidos",
      texto: "La «Pantalla de pedidos»: fondo oscuro, las siete etapas y las tarjetas de cada pedido.",
      puntos: [
        "Pensada para el televisor del estudio: tocá «Pantalla completa».",
        "Se actualiza sola (mirá «Actualizado» arriba).",
        "Tu equipo ve de un vistazo qué hay en cada etapa sin preguntarte.",
        "También sirve para compartir en una reunión con el colegio.",
      ],
      puente: "Cerramos el círculo: volvamos al colegio para ver qué cambió.",
    },

    // ── Cierre ────────────────────────────────────────────────────────────────────────────
    {
      id: "colegio-ventas",
      etapa: "Cierre",
      vista: "colegio",
      ruta: (c) => `/escuela/${c.schoolId}`,
      titulo: "El colegio ve su venta",
      texto: "El «Panel Escuela» otra vez, ahora con la venta y su comisión.",
      puntos: [
        "Somos el colegio otra vez. Antes estaba en cero.",
        "En «Ventas generadas por la escuela» aparece la compra de la preventa y la comisión que le toca.",
        "La tabla muestra fecha, pedido, monto y estado de cada comisión.",
        "Con «Solicitar cobro» el colegio te pide su parte; vos la ves y la marcás pagada.",
        "Nadie le pasó una planilla al colegio: lo ve solo.",
      ],
      puente: "Repasá el recorrido completo y abrí preguntas.",
    },
    {
      id: "cierre",
      etapa: "Cierre",
      vista: "fotografo",
      ruta: () => "/fotografo/escuelas",
      titulo: "Cierre",
      texto: "Volvemos a «Escolar», el punto de partida.",
      puntos: [
        "Repasá las siete etapas en una frase cada una.",
        "Lo más importante: cobrás antes, la familia se encuentra sola y el librito se arma solo.",
        "Todo lo que vimos se puede configurar conversando con el bot.",
        "Abrí preguntas. Si alguien quiere ver algo de nuevo, saltá a ese paso desde la lista de la derecha.",
      ],
      aclaracion: {
        titulo: "Sin listados ni cobros a mano",
        texto:
          "Landing para conseguir colegios, preventa cobrada por Mercado Pago, búsqueda por selfie, librito que se arma solo, imprenta y sobres con QR. Y todo se configura conversando con el bot.",
      },
    },
  ],
};
