import type { Cuestionario, Opcion } from "../tipos";

/**
 * Cuestionario para una fotógrafa o fotógrafo que enseña y produce: escuela, productora o
 * estudio con cursos. Lo estrenó F64 Productora (Andrea Defagot), con sus cuatro cursos grabados
 * ya cargados en borrador. Sirve para el próximo cliente del mismo tipo cambiando sólo la
 * sección de cursos ya cargados (`cursosCargados`).
 */

const SI_NO_TAL_VEZ: Opcion[] = [
  { valor: "si", etiqueta: "Sí, lo quiero" },
  { valor: "mas_adelante", etiqueta: "Más adelante" },
  { valor: "no", etiqueta: "No, por ahora no" },
];

const ACCESO: Opcion[] = [
  { valor: "0", etiqueta: "Sin vencimiento (para siempre)" },
  { valor: "12", etiqueta: "12 meses desde la compra" },
  { valor: "6", etiqueta: "6 meses desde la compra" },
  { valor: "3", etiqueta: "3 meses desde la compra" },
  { valor: "otro", etiqueta: "Otro plazo (lo aclaro abajo)" },
];

type CursoCargado = { id: string; nombre: string; clases: string };

function preguntasDeCurso(c: CursoCargado) {
  return [
    {
      id: `${c.id}_vender`,
      titulo: `«${c.nombre}»: ¿lo publicamos a la venta?`,
      ayuda: c.clases,
      tipo: "opcion" as const,
      obligatoria: true,
      opciones: [
        { valor: "si", etiqueta: "Sí, publicarlo" },
        { valor: "cambios", etiqueta: "Sí, pero antes quiero cambiar algo" },
        { valor: "no", etiqueta: "No lo quiero vender todavía" },
      ],
    },
    {
      id: `${c.id}_precio`,
      titulo: `Precio de «${c.nombre}» (en pesos)`,
      ayuda: "El precio que paga la persona. Si no sabés qué cobrar, dejalo vacío y te ayudamos a calcularlo.",
      tipo: "dinero" as const,
      mostrarSi: { pregunta: `${c.id}_vender`, distintoDe: "no" },
    },
    {
      id: `${c.id}_acceso`,
      titulo: `¿Por cuánto tiempo puede ver «${c.nombre}» quien lo compra?`,
      tipo: "opcion" as const,
      opciones: ACCESO,
    },
    {
      id: `${c.id}_muestra`,
      titulo: `¿Alguna clase de «${c.nombre}» se puede ver gratis como muestra?`,
      ayuda: "Una clase de muestra es la mejor herramienta para vender un curso grabado. Escribí cuál (por ejemplo «la 1») o dejalo vacío.",
      tipo: "texto" as const,
    },
    {
      id: `${c.id}_requisitos`,
      titulo: `¿Qué necesita tener o saber quien hace «${c.nombre}»?`,
      ayuda: "Por ejemplo: cámara réflex o mirrorless, sólo un celular, haber hecho el curso inicial…",
      tipo: "texto" as const,
    },
    {
      id: `${c.id}_cambios`,
      titulo: `¿Qué querés cambiar de «${c.nombre}»?`,
      ayuda: "Título, descripción, nombres de las clases, la portada, lo que sea.",
      tipo: "parrafo" as const,
      mostrarSi: { pregunta: `${c.id}_vender`, igualA: "cambios" },
    },
  ];
}

const CURSOS_F64: CursoCargado[] = [
  { id: "curso_inicial", nombre: "Fotografía Inicial · Nivel 1", clases: "10 clases grabadas (2 h 49 min) con su PDF cada una." },
  { id: "curso_iluminacion", nombre: "Iluminación: uso técnico y creativo de la luz", clases: "8 clases grabadas (3 h 41 min) con su PDF cada una." },
  {
    id: "curso_productos",
    nombre: "Fotografía de productos con celular",
    clases: "3 módulos (54 min) y el PDF completo. Ojo: el video del Módulo 2 que está en Drive dura 4 segundos; hay que volver a subirlo.",
  },
  { id: "curso_boudoir", nombre: "Workshop Boudoir", clases: "1 clase grabada (1 h 02 min) con el PDF del workshop." },
];

function cursosCargados(cursos: CursoCargado[]) {
  return cursos.flatMap(preguntasDeCurso);
}

export const CUESTIONARIO_PRODUCTORA_DOCENTE: Cuestionario = {
  clave: "productora-docente-v1",
  titulo: "Alta en FOTOFFICE",
  bienvenida:
    "Con estas respuestas armamos tu espacio en FOTOFFICE: tu sitio, tus cursos a la venta y, si querés, tu agenda de sesiones y tu comunidad paga. Se guarda solo mientras escribís, así que podés completarlo en varias veces desde el mismo enlace. Lo que no sepas, dejalo vacío: lo charlamos después.",
  secciones: [
    {
      id: "persona",
      titulo: "Tus datos",
      intro: "Para crear tu cuenta y que puedas entrar a administrar todo.",
      preguntas: [
        { id: "nombre_completo", titulo: "Nombre y apellido", tipo: "texto", obligatoria: true },
        {
          id: "email_acceso",
          titulo: "Correo con el que vas a entrar a FOTOFFICE",
          ayuda: "Con este correo te creamos el usuario. Puede ser de Gmail.",
          tipo: "email",
          obligatoria: true,
        },
        { id: "whatsapp_personal", titulo: "Tu WhatsApp (para hablar con vos)", tipo: "telefono", obligatoria: true },
        { id: "dni", titulo: "DNI", tipo: "texto" },
        { id: "fecha_nacimiento", titulo: "Fecha de nacimiento", ayuda: "Opcional.", tipo: "fecha" },
        { id: "ciudad", titulo: "Ciudad donde vivís y trabajás", tipo: "texto", placeholder: "Rafaela, Susana…" },
      ],
    },
    {
      id: "productora",
      titulo: "La productora",
      intro: "Cómo se muestra F64 al público.",
      preguntas: [
        { id: "nombre_comercial", titulo: "Nombre comercial exacto", tipo: "texto", placeholder: "F64 Productora", obligatoria: true },
        {
          id: "lineas",
          titulo: "¿Qué hace F64? Marcá todo lo que corresponda",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            { valor: "cursos_grabados", etiqueta: "Cursos grabados" },
            { valor: "cursos_presenciales", etiqueta: "Cursos y talleres presenciales" },
            { valor: "cursos_vivo_online", etiqueta: "Clases en vivo por internet" },
            { valor: "workshops", etiqueta: "Workshops y salidas fotográficas" },
            { valor: "mentorias", etiqueta: "Mentorías individuales" },
            { valor: "sesiones", etiqueta: "Sesiones de fotos (boudoir, retratos, 15, maternidad…)" },
            { valor: "marcas", etiqueta: "Producción de fotos para marcas e instituciones" },
            { valor: "eventos", etiqueta: "Coberturas de eventos sociales e institucionales" },
            { valor: "congresos", etiqueta: "Congresos, festivales y muestras (Rafaela en Foco, F64FEST)" },
            { valor: "comunicacion", etiqueta: "Comunicación, redes y diseño" },
          ],
        },
        {
          id: "bio_corta",
          titulo: "Presentate en una o dos frases",
          ayuda: "Va en la portada del sitio. Por ejemplo: «Artista visual, fotógrafa y retratista de mujeres. Directora creativa de F64 Productora».",
          tipo: "parrafo",
        },
        {
          id: "bio_larga",
          titulo: "Tu historia (para la página «Sobre mí»)",
          ayuda: "Desde cuándo fotografiás, desde cuándo enseñás, tu especialidad, lo que te importa transmitir. Escribilo como te salga: lo ordenamos nosotros.",
          tipo: "parrafo",
        },
        {
          id: "lema",
          titulo: "¿Usamos «Una forma de mirar. Un lugar para compartir» como lema?",
          tipo: "opcion",
          conOtro: true,
          opciones: [
            { valor: "si", etiqueta: "Sí" },
            { valor: "otro", etiqueta: "Prefiero otro (lo escribo en «Otro»)" },
          ],
        },
        { id: "direccion", titulo: "Dirección del estudio o de donde das clases", ayuda: "Si no querés que se publique, aclaralo.", tipo: "texto" },
        { id: "horarios", titulo: "Días y horarios de atención", tipo: "texto", placeholder: "Lunes a viernes de 9 a 18" },
        { id: "email_publico", titulo: "Correo público de contacto", tipo: "email", placeholder: "hola@andreadefagot.ar" },
        { id: "whatsapp_publico", titulo: "WhatsApp público de contacto", ayuda: "El que aparece en el sitio. Si es el mismo de arriba, repetilo.", tipo: "telefono" },
        {
          id: "redes",
          titulo: "Redes sociales que querés mostrar",
          ayuda: "Encontramos @andrea_defagot y @f64productora en Instagram, y las páginas de Facebook. Pegá las que quieras mostrar y sumá las que falten (TikTok, YouTube…).",
          tipo: "parrafo",
        },
        {
          id: "sitio_actual",
          titulo: "Hoy tenés andreadefagot.ar. ¿Qué hacemos con ese sitio?",
          tipo: "opcion",
          conOtro: true,
          opciones: [
            { valor: "reemplazar", etiqueta: "Reemplazarlo por el sitio nuevo de FOTOFFICE" },
            { valor: "convivir", etiqueta: "Que siga como portfolio personal y F64 tenga su propio sitio" },
            { valor: "no_se", etiqueta: "No sé, recomiéndenme" },
          ],
        },
        {
          id: "dominio",
          titulo: "¿Qué dirección web querés para F64?",
          ayuda: "Por ejemplo f64productora.com.ar. Si ya compraste una, decinos dónde (Nic.ar, DonWeb…). Si no, te recomendamos una.",
          tipo: "texto",
        },
      ],
    },
    {
      id: "fiscal",
      titulo: "Facturación y cobros",
      intro: "Para que el dinero de cada venta llegue directo a tu cuenta.",
      preguntas: [
        {
          id: "mp_tiene",
          titulo: "¿Tenés cuenta de Mercado Pago para cobrar?",
          ayuda: "FOTOFFICE cobra con tu propia cuenta de Mercado Pago: el dinero va directo a vos. Para conectarla te mandamos un enlace y aceptás desde tu celular.",
          tipo: "opcion",
          obligatoria: true,
          opciones: [
            { valor: "si", etiqueta: "Sí" },
            { valor: "no", etiqueta: "No, tengo que abrir una" },
            { valor: "otra_persona", etiqueta: "Sí, pero está a nombre de otra persona o empresa" },
          ],
        },
        { id: "mp_titular", titulo: "¿A nombre de quién está la cuenta de Mercado Pago?", tipo: "texto", mostrarSi: { pregunta: "mp_tiene", igualA: "otra_persona" } },
        {
          id: "transferencia",
          titulo: "¿Aceptás también transferencia bancaria?",
          ayuda: "Si es así, pasanos el alias. Las transferencias se confirman a mano desde el panel.",
          tipo: "texto",
          placeholder: "Alias o «no»",
        },
        {
          id: "condicion_fiscal",
          titulo: "Condición ante ARCA (ex AFIP)",
          tipo: "opcion",
          opciones: [
            { valor: "monotributo", etiqueta: "Monotributo" },
            { valor: "responsable_inscripto", etiqueta: "Responsable inscripto" },
            { valor: "no_inscripta", etiqueta: "No estoy inscripta" },
            { valor: "no_se", etiqueta: "No sé" },
          ],
        },
        { id: "cuit", titulo: "CUIT", tipo: "texto" },
        {
          id: "facturar",
          titulo: "¿Querés que FOTOFFICE haga la factura electrónica de cada venta?",
          ayuda: "FOTOFFICE puede emitir la factura sola cuando alguien compra. Necesitamos un certificado de ARCA que te ayudamos a sacar.",
          tipo: "opcion",
          opciones: SI_NO_TAL_VEZ,
        },
        {
          id: "precio_internacional",
          titulo: "¿Te compran cursos desde otros países?",
          ayuda: "Si es así, podemos sumar un precio en dólares más adelante.",
          tipo: "opcion",
          opciones: [
            { valor: "si", etiqueta: "Sí, seguido" },
            { valor: "a_veces", etiqueta: "A veces" },
            { valor: "no", etiqueta: "No" },
          ],
        },
      ],
    },
    {
      id: "grabados",
      titulo: "Tus cursos grabados",
      intro:
        "Ya cargamos tus cuatro cursos con sus clases, los PDF y una portada con tu marca. Están en borrador, sin precio: nadie los ve todavía. Contanos cómo los querés vender. FOTOFFICE se queda con un 5 % de cada venta.",
      preguntas: [
        ...cursosCargados(CURSOS_F64),
        {
          id: "grabados_pack",
          titulo: "¿Querés ofrecer un precio especial por comprar varios cursos juntos?",
          ayuda: "Por ejemplo, Inicial + Iluminación con descuento. Contanos cuáles y a qué precio.",
          tipo: "parrafo",
        },
        {
          id: "grabados_lanzamiento",
          titulo: "¿Hacemos un precio o cupón de lanzamiento?",
          ayuda: "Por ejemplo, 20 % menos la primera semana para tus seguidores.",
          tipo: "parrafo",
        },
        {
          id: "grabados_certificado",
          titulo: "¿Querés que al terminar un curso la persona reciba un certificado con tu firma?",
          tipo: "opcion",
          opciones: SI_NO_TAL_VEZ,
        },
        {
          id: "grabados_mas",
          titulo: "¿Tenés más cursos grabados para sumar?",
          ayuda: "Uno por fila. Si ya están en Drive, pegá el enlace de la carpeta.",
          tipo: "lista",
          textoAgregar: "Agregar otro curso",
          campos: [
            { id: "nombre", titulo: "Nombre del curso", tipo: "texto" },
            { id: "enlace", titulo: "Carpeta de Drive", tipo: "enlace" },
            { id: "precio", titulo: "Precio (pesos)", tipo: "dinero" },
          ],
        },
        {
          id: "reventa",
          titulo: "¿Querés que otras escuelas o fotógrafos de FOTOFFICE puedan vender tus cursos, quedándose con una parte?",
          ayuda: "Es el «Mercado de cursos»: vos ponés el porcentaje que le dejás a quien vende. Llegás a más gente sin hacer nada.",
          tipo: "opcion",
          opciones: SI_NO_TAL_VEZ,
        },
        {
          id: "reventa_porcentaje",
          titulo: "¿Qué porcentaje le dejarías a quien revende?",
          tipo: "texto",
          placeholder: "Por ejemplo 25 %",
          mostrarSi: { pregunta: "reventa", igualA: "si" },
        },
        {
          id: "alumnos_previos",
          titulo: "¿Hay alumnos que ya pagaron alguno de estos cursos y tienen que entrar gratis?",
          ayuda: "Pegá un correo por renglón (o «Nombre, correo»), o el enlace a una planilla. Les mandamos el acceso.",
          tipo: "parrafo",
        },
      ],
    },
    {
      id: "presenciales",
      titulo: "Cursos presenciales y en vivo",
      intro: "Sos fotógrafa y docente: FOTOFFICE también vende cursos con fecha, lugar y cupo, y cobra la inscripción.",
      preguntas: [
        { id: "presenciales_quiere", titulo: "¿Querés vender cursos o talleres presenciales desde FOTOFFICE?", tipo: "opcion", obligatoria: true, opciones: SI_NO_TAL_VEZ },
        {
          id: "presenciales_lista",
          titulo: "¿Qué cursos presenciales das?",
          ayuda: "Uno por fila. Si todavía no tienen fecha, dejala vacía.",
          tipo: "lista",
          textoAgregar: "Agregar otro curso presencial",
          mostrarSi: { pregunta: "presenciales_quiere", igualA: "si" },
          campos: [
            { id: "nombre", titulo: "Nombre", tipo: "texto" },
            { id: "fechas", titulo: "Fechas y horario", tipo: "texto" },
            { id: "clases", titulo: "Cantidad de clases y duración", tipo: "texto" },
            { id: "lugar", titulo: "Lugar", tipo: "texto" },
            { id: "cupo", titulo: "Cupo", tipo: "numero" },
            { id: "precio", titulo: "Precio (pesos)", tipo: "dinero" },
            { id: "temario", titulo: "Temario o descripción", tipo: "parrafo" },
          ],
        },
        {
          id: "presenciales_pago",
          titulo: "¿Cómo se paga un curso presencial?",
          tipo: "opciones",
          conOtro: true,
          mostrarSi: { pregunta: "presenciales_quiere", igualA: "si" },
          opciones: [
            { valor: "total", etiqueta: "Todo al inscribirse" },
            { valor: "sena", etiqueta: "Una seña para reservar el lugar y el resto después" },
            { valor: "cuotas_mensuales", etiqueta: "Cuota mensual (cursos largos o carreras)" },
          ],
        },
        {
          id: "vivo_quiere",
          titulo: "¿Querés dar clases en vivo por internet desde FOTOFFICE?",
          ayuda: "FOTOFFICE puede transmitir la clase en vivo sólo para quienes pagaron, y dejarla grabada en el aula.",
          tipo: "opcion",
          opciones: SI_NO_TAL_VEZ,
        },
        { id: "vivo_detalle", titulo: "Contanos cómo serían (frecuencia, día, horario, precio)", tipo: "parrafo", mostrarSi: { pregunta: "vivo_quiere", igualA: "si" } },
        {
          id: "mentorias_quiere",
          titulo: "¿Querés ofrecer mentorías o clases individuales con turno?",
          tipo: "opcion",
          opciones: SI_NO_TAL_VEZ,
        },
        {
          id: "mentorias_detalle",
          titulo: "Duración, precio y modalidad de la mentoría",
          tipo: "parrafo",
          placeholder: "1 hora por videollamada, $…",
          mostrarSi: { pregunta: "mentorias_quiere", igualA: "si" },
        },
        {
          id: "evaluaciones",
          titulo: "¿Tomás exámenes o trabajos prácticos y querés llevarlos desde FOTOFFICE?",
          tipo: "opcion",
          opciones: SI_NO_TAL_VEZ,
        },
      ],
    },
    {
      id: "sesiones",
      titulo: "Agenda de sesiones de fotos",
      intro: "Tus clientas pueden ver los días libres, reservar su sesión y pagar la seña online, sin idas y vueltas por WhatsApp.",
      preguntas: [
        { id: "sesiones_quiere", titulo: "¿Querés una agenda online para reservar sesiones de fotos?", tipo: "opcion", obligatoria: true, opciones: SI_NO_TAL_VEZ },
        {
          id: "sesiones_tipos",
          titulo: "¿Qué sesiones ofrecés?",
          ayuda: "Una por fila: boudoir, retrato, book de 15, maternidad, producto…",
          tipo: "lista",
          textoAgregar: "Agregar otro tipo de sesión",
          mostrarSi: { pregunta: "sesiones_quiere", igualA: "si" },
          filasIniciales: [{ nombre: "Sesión boudoir" }, { nombre: "Retrato" }, { nombre: "Book de 15" }],
          campos: [
            { id: "nombre", titulo: "Sesión", tipo: "texto" },
            { id: "duracion", titulo: "Duración", tipo: "texto" },
            { id: "precio", titulo: "Precio (pesos)", tipo: "dinero" },
            { id: "sena", titulo: "Seña para reservar (pesos o %)", tipo: "texto" },
            { id: "incluye", titulo: "Qué incluye (fotos editadas, impresas…)", tipo: "parrafo" },
            { id: "lugar", titulo: "Dónde (estudio, exterior, a domicilio)", tipo: "texto" },
          ],
        },
        {
          id: "sesiones_horarios",
          titulo: "¿Qué días y horarios tomás sesiones?",
          tipo: "parrafo",
          placeholder: "Martes y jueves de 10 a 18, sábados a la mañana…",
          mostrarSi: { pregunta: "sesiones_quiere", igualA: "si" },
        },
        {
          id: "sesiones_anticipacion",
          titulo: "¿Con cuánta anticipación mínima se puede reservar?",
          tipo: "texto",
          placeholder: "48 horas",
          mostrarSi: { pregunta: "sesiones_quiere", igualA: "si" },
        },
        {
          id: "sesiones_cancelacion",
          titulo: "¿Qué pasa si la clienta cancela o quiere cambiar la fecha?",
          tipo: "parrafo",
          mostrarSi: { pregunta: "sesiones_quiere", igualA: "si" },
        },
        {
          id: "estudio_extra",
          titulo: "Además de la agenda, ¿qué te serviría para las sesiones?",
          tipo: "opciones",
          opciones: [
            { valor: "galeria", etiqueta: "Galería online para que la clienta elija sus fotos" },
            { valor: "contratos", etiqueta: "Contrato con firma electrónica" },
            { valor: "presupuestos", etiqueta: "Presupuestos que se aceptan y pagan online" },
            { valor: "impresiones", etiqueta: "Que la clienta pida copias impresas desde su galería" },
            { valor: "clientes", etiqueta: "Ficha de cada clienta con su historial" },
            { valor: "caja", etiqueta: "Caja: lo que entra y sale del estudio" },
          ],
        },
      ],
    },
    {
      id: "comunidad",
      titulo: "Comunidad paga por suscripción",
      intro:
        "Una membresía mensual: tus alumnos pagan una cuota y, mientras la paguen, tienen acceso a vos y a tu contenido. Es la forma de tener un ingreso fijo todos los meses.",
      preguntas: [
        { id: "comunidad_quiere", titulo: "¿Querés armar una comunidad paga con cuota mensual?", tipo: "opcion", obligatoria: true, opciones: SI_NO_TAL_VEZ },
        {
          id: "comunidad_nombre",
          titulo: "¿Cómo se llamaría?",
          tipo: "texto",
          placeholder: "Comunidad F64, Club F64…",
          mostrarSi: { pregunta: "comunidad_quiere", igualA: "si" },
        },
        {
          id: "comunidad_incluye",
          titulo: "¿Qué recibiría quien paga la cuota?",
          tipo: "opciones",
          conOtro: true,
          mostrarSi: { pregunta: "comunidad_quiere", igualA: "si" },
          opciones: [
            { valor: "todos_grabados", etiqueta: "Todos los cursos grabados mientras pague" },
            { valor: "algunos_grabados", etiqueta: "Algunos cursos grabados" },
            { valor: "vivo_mensual", etiqueta: "Encuentros en vivo todos los meses" },
            { valor: "consultas", etiqueta: "Consultas directas con vos" },
            { valor: "revision", etiqueta: "Revisión de sus fotos o portfolio" },
            { valor: "whatsapp", etiqueta: "Grupo privado de WhatsApp" },
            { valor: "descuentos", etiqueta: "Descuentos en workshops, sesiones o congresos" },
            { valor: "sorteos", etiqueta: "Sorteos con premios de sponsors" },
            { valor: "salidas", etiqueta: "Salidas fotográficas" },
          ],
        },
        {
          id: "comunidad_planes",
          titulo: "Planes y precios",
          ayuda: "Si querés un solo plan, completá una sola fila. Si querés dos (por ejemplo uno básico y uno completo), una por plan.",
          tipo: "lista",
          textoAgregar: "Agregar otro plan",
          mostrarSi: { pregunta: "comunidad_quiere", igualA: "si" },
          campos: [
            { id: "nombre", titulo: "Nombre del plan", tipo: "texto" },
            { id: "precio", titulo: "Precio por mes (pesos)", tipo: "dinero" },
            { id: "incluye", titulo: "Qué incluye", tipo: "parrafo" },
          ],
        },
        {
          id: "comunidad_vivo",
          titulo: "¿Cuántos encuentros en vivo por mes y en qué día y horario?",
          tipo: "texto",
          placeholder: "Dos por mes, los jueves a las 19",
          mostrarSi: { pregunta: "comunidad_quiere", igualA: "si" },
        },
        {
          id: "comunidad_consultas",
          titulo: "¿Cómo serían las consultas con vos?",
          ayuda: "Por ejemplo: una consulta por mes por WhatsApp, o preguntas en el encuentro en vivo.",
          tipo: "parrafo",
          mostrarSi: { pregunta: "comunidad_quiere", igualA: "si" },
        },
        {
          id: "comunidad_gratis",
          titulo: "¿Darías algo gratis como puerta de entrada?",
          ayuda: "Por ejemplo una clase gratuita por semana en Instagram que invite a sumarse.",
          tipo: "parrafo",
          mostrarSi: { pregunta: "comunidad_quiere", igualA: "si" },
        },
        {
          id: "comunidad_whatsapp",
          titulo: "Si ya tenés grupos de WhatsApp con alumnos, pegá los enlaces",
          tipo: "parrafo",
          mostrarSi: { pregunta: "comunidad_quiere", igualA: "si" },
        },
        {
          id: "alumnos_cantidad",
          titulo: "¿Cuántos alumnos y exalumnos tenés aproximadamente?",
          ayuda: "Para saber a cuánta gente le podemos avisar del lanzamiento.",
          tipo: "numero",
        },
        {
          id: "alumnos_planilla",
          titulo: "¿Tenés una lista de alumnos y exalumnos con correo o WhatsApp?",
          ayuda: "Si la tenés en una planilla de Google o Excel, pegá el enlace. Sólo les escribimos si vos querés.",
          tipo: "enlace",
        },
      ],
    },
    {
      id: "eventos",
      titulo: "Eventos, concursos y comunidad",
      preguntas: [
        {
          id: "rafaela_en_foco",
          titulo: "Rafaela en Foco ya está en FOTOFFICE. ¿Querés que aparezca en el sitio de F64?",
          tipo: "opcion",
          opciones: [
            { valor: "si", etiqueta: "Sí, con un enlace a su sitio" },
            { valor: "no", etiqueta: "No, que vayan separados" },
          ],
        },
        {
          id: "eventos_propios",
          titulo: "¿Organizás otros eventos con inscripción? (F64FEST, salidas, muestras…)",
          ayuda: "FOTOFFICE vende las entradas, acredita en la puerta con QR y entrega diplomas.",
          tipo: "lista",
          textoAgregar: "Agregar otro evento",
          campos: [
            { id: "nombre", titulo: "Evento", tipo: "texto" },
            { id: "fecha", titulo: "Fecha aproximada", tipo: "texto" },
            { id: "precio", titulo: "Precio de la entrada", tipo: "dinero" },
          ],
        },
        {
          id: "concursos",
          titulo: "¿Querés organizar concursos de fotografía para tus alumnos o seguidores?",
          tipo: "opcion",
          opciones: SI_NO_TAL_VEZ,
        },
        {
          id: "sorteos_sponsors",
          titulo: "¿Tenés marcas que te acompañan y te gustaría mostrarlas o hacer sorteos con sus premios?",
          ayuda: "Por ejemplo Laboratorios Alpha. Escribí cuáles.",
          tipo: "parrafo",
        },
        {
          id: "tienda",
          titulo: "¿Querés vender productos en una tienda online?",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            { valor: "impresiones", etiqueta: "Impresiones o copias de tus fotos" },
            { valor: "gift", etiqueta: "Tarjetas de regalo de sesiones" },
            { valor: "merch", etiqueta: "Merchandising de F64" },
            { valor: "presets", etiqueta: "Presets o material descargable" },
            { valor: "no", etiqueta: "No, por ahora no" },
          ],
        },
      ],
    },
    {
      id: "comunicacion",
      titulo: "Comunicación",
      preguntas: [
        {
          id: "correos_alumnos",
          titulo: "¿Querés mandar novedades por correo a tus alumnos desde FOTOFFICE?",
          ayuda: "Lanzamientos, fechas de cursos nuevos, recordatorios.",
          tipo: "opcion",
          opciones: SI_NO_TAL_VEZ,
        },
        {
          id: "blog",
          titulo: "¿Te gustaría publicar notas o consejos en un blog dentro del sitio?",
          tipo: "opcion",
          opciones: SI_NO_TAL_VEZ,
        },
        {
          id: "whatsapp_bot",
          titulo: "¿Te serviría que un asistente responda solo las preguntas frecuentes por WhatsApp?",
          ayuda: "Precios, fechas, cómo comprar. Cuando no sabe, te pasa la conversación.",
          tipo: "opcion",
          opciones: SI_NO_TAL_VEZ,
        },
        {
          id: "preguntas_frecuentes",
          titulo: "¿Qué te preguntan siempre tus alumnos o clientas?",
          ayuda: "Con esto armamos las preguntas frecuentes de cada curso.",
          tipo: "parrafo",
        },
        {
          id: "tono",
          titulo: "¿Cómo querés que suenen los textos?",
          tipo: "opcion",
          conOtro: true,
          opciones: [
            { valor: "calido_vos", etiqueta: "Cálido y cercano, tuteando (vos)" },
            { valor: "inspirador", etiqueta: "Inspirador y poético" },
            { valor: "profesional", etiqueta: "Profesional y directo" },
          ],
        },
        {
          id: "palabras",
          titulo: "¿Hay palabras que usás siempre o que no querés que aparezcan?",
          tipo: "parrafo",
        },
      ],
    },
    {
      id: "material",
      titulo: "Fotos y material",
      intro: "Para el sitio y las portadas. Lo más cómodo es una carpeta de Google Drive compartida con «cualquier persona con el enlace».",
      preguntas: [
        { id: "fotos_vos", titulo: "Fotos tuyas (retrato, dando clase, en el estudio)", tipo: "enlace", placeholder: "Enlace a la carpeta de Drive" },
        { id: "fotos_trabajos", titulo: "Tus mejores trabajos, para mostrar en el sitio", ayuda: "Avisanos si alguna foto de boudoir no se puede publicar.", tipo: "enlace" },
        { id: "fotos_clases", titulo: "Fotos o videos de tus clases y workshops", tipo: "enlace" },
        { id: "manual_marca", titulo: "Cuando termines el manual de marca, pegá el enlace", tipo: "enlace" },
        {
          id: "logo_ok",
          titulo: "¿El logo dorado sobre carbón es el principal para el sitio?",
          tipo: "opcion",
          conOtro: true,
          opciones: [
            { valor: "si", etiqueta: "Sí" },
            { valor: "otro", etiqueta: "Prefiero otra versión" },
          ],
        },
        {
          id: "testimonios_alumnos",
          titulo: "Copiá varios testimonios de tus alumnos",
          ayuda:
            "Los que te mandaron por WhatsApp, Instagram o correo: copiá el texto tal cual, uno por fila. Cuantos más, mejor (con tres o cuatro ya se arma la sección). Si es una captura, pegá el enlace a la imagen.",
          tipo: "lista",
          textoAgregar: "Agregar otro testimonio",
          filasIniciales: [{}, {}, {}],
          campos: [
            { id: "nombre", titulo: "Nombre de quien lo dijo", tipo: "texto" },
            { id: "curso", titulo: "Qué curso, taller o sesión hizo", tipo: "texto" },
            { id: "texto", titulo: "Lo que dijo", tipo: "parrafo" },
            { id: "enlace", titulo: "Captura o foto (opcional)", tipo: "enlace" },
          ],
        },
        {
          id: "testimonios_permiso",
          titulo: "¿Esas personas están de acuerdo con que se publique su comentario con su nombre?",
          tipo: "opcion",
          opciones: [
            { valor: "si", etiqueta: "Sí" },
            { valor: "solo_nombre", etiqueta: "Sí, pero sólo con el nombre de pila" },
            { valor: "consultar", etiqueta: "Tengo que preguntarles" },
          ],
        },
        { id: "video_productos_2", titulo: "Enlace nuevo del video del Módulo 2 de Fotografía de productos", ayuda: "El que está en Drive dura 4 segundos.", tipo: "enlace" },
      ],
    },
    {
      id: "equipo",
      titulo: "Equipo",
      preguntas: [
        {
          id: "equipo_lista",
          titulo: "¿Alguien más tiene que entrar al panel? (docentes, asistentes, community manager)",
          ayuda: "Uno por fila. Cada persona ve sólo lo que le habilites.",
          tipo: "lista",
          textoAgregar: "Agregar otra persona",
          campos: [
            { id: "nombre", titulo: "Nombre", tipo: "texto" },
            { id: "email", titulo: "Correo", tipo: "texto" },
            { id: "rol", titulo: "Qué hace", tipo: "texto" },
          ],
        },
        {
          id: "docentes_invitados",
          titulo: "¿Hay otros docentes que dan cursos en F64 y cobran una parte?",
          ayuda: "FOTOFFICE puede repartir lo cobrado entre vos y el docente. Contanos quiénes y qué porcentaje.",
          tipo: "parrafo",
        },
      ],
    },
    {
      id: "cierre",
      titulo: "Para terminar",
      preguntas: [
        {
          id: "prioridad",
          titulo: "¿Qué querés tener funcionando primero?",
          tipo: "opcion",
          obligatoria: true,
          conOtro: true,
          opciones: [
            { valor: "grabados", etiqueta: "La venta de cursos grabados" },
            { valor: "comunidad", etiqueta: "La comunidad paga" },
            { valor: "agenda", etiqueta: "La agenda de sesiones" },
            { valor: "presenciales", etiqueta: "Los cursos presenciales" },
            { valor: "sitio", etiqueta: "El sitio web completo" },
          ],
        },
        { id: "fecha_lanzamiento", titulo: "¿Para cuándo te gustaría lanzarlo?", tipo: "fecha" },
        {
          id: "publicar_datos",
          titulo: "¿Nos autorizás a publicar en tu sitio los datos, fotos y textos que nos pasaste?",
          tipo: "si_no",
          obligatoria: true,
        },
        { id: "comentarios", titulo: "¿Algo más que quieras contarnos?", tipo: "parrafo" },
      ],
    },
  ],
};
