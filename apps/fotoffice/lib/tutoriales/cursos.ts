import type { CursoTutorial } from "./curso";
import { DETALLES } from "./detalles";

/**
 * Los cursos de /tutoriales, en el orden en que se muestran. Las clases salen del plan de cada
 * serie en docs/demos/tutoriales (fotoffice-negocio, fotoffice-sociedad y presupuestos). Una
 * clase sin link de YouTube se muestra como «Próximamente».
 */
export const CURSOS_TUTORIALES: CursoTutorial[] = [
  {
    slug: "negocio-de-fotografia",
    claveAjuste: "fotoffice_tutoriales_negocio",
    titulo: "FOTOFFICE para tu negocio de fotografía",
    lema: "La caja, el stock, la tienda, los pedidos y tu equipo, todo en un mismo lugar",
    intro:
      "grabadas sobre las pantallas reales de FOTOFFICE con un negocio de demo: el Estudio Demo, sus clientes y sus ventas son inventados.",
    bloques: [
      {
        titulo: "Empezar",
        clases: [
          { clave: "1", etiqueta: "1", titulo: "Todo lo que hace FOTOFFICE por tu negocio", resumen: "El recorrido general por el panel de un local que vende fotos al público." },
          { clave: "1b", etiqueta: "1-B", titulo: "¿Cuánto cuesta FOTOFFICE?", resumen: "Un 5 % de lo que facturás, sin monto fijo, o un plan mensual a convenir." },
        ],
      },
      {
        titulo: "La administración del negocio",
        clases: [
          { clave: "2", etiqueta: "2", titulo: "La caja del día", resumen: "Turnos, ingresos, gastos y el cierre de cada día." },
          { clave: "3", etiqueta: "3", titulo: "Proveedores y cuentas a pagar", resumen: "Lo que le debés a cada proveedor y sus listas de precios." },
          { clave: "4", etiqueta: "4", titulo: "Stock de insumos y de productos", resumen: "Lo que tenés, lo que se gasta y cuánto te cuesta cada producto." },
        ],
      },
      {
        titulo: "Vender en internet",
        clases: [
          { clave: "5", etiqueta: "5", titulo: "Tu página web", resumen: "El sitio de tu negocio, armado desde el panel." },
          { clave: "6", etiqueta: "6", titulo: "La tienda online", resumen: "Tus productos a la venta en tu página, con cobro por Mercado Pago." },
        ],
      },
      {
        titulo: "Los productos del mostrador",
        clases: [
          { clave: "7", etiqueta: "7", titulo: "Foto carnet en el mostrador", resumen: "La foto, el recorte a medida y la hoja lista para imprimir." },
          { clave: "8", etiqueta: "8", titulo: "Polaroids", resumen: "El diseño de las polaroids para imprimir en el local." },
          { clave: "9", etiqueta: "9", titulo: "Fotolibros", resumen: "Los diseña el cliente desde su casa o el vendedor en el mostrador." },
          { clave: "10", etiqueta: "10", titulo: "Cuadros con el probador 3D", resumen: "El cliente ve cómo queda su foto en el cuadro antes de comprarlo." },
          { clave: "11", etiqueta: "11", titulo: "Digitalización de videos analógicos", resumen: "Cassettes y DVD pasados a digital, con cada etapa a la vista." },
        ],
      },
      {
        titulo: "Tu equipo",
        clases: [
          { clave: "12", etiqueta: "12", titulo: "Comisiones por venta", resumen: "Lo que gana cada vendedor por lo que vende." },
          { clave: "13", etiqueta: "13", titulo: "Sueldos y jornadas del equipo", resumen: "Horarios, jornadas trabajadas y sueldos de quienes atienden." },
        ],
      },
      {
        titulo: "Clientes, reservas y pedidos",
        clases: [
          { clave: "14", etiqueta: "14", titulo: "Alquiler del estudio y reservas", resumen: "La agenda del estudio y las reservas de sesiones." },
          { clave: "15", etiqueta: "15", titulo: "El bot de atención y los pedidos de impresión", resumen: "WhatsApp atiende, cotiza y toma pedidos de impresión." },
          { clave: "16", etiqueta: "16", titulo: "Consultas, cotizaciones, pedidos y clientes", resumen: "Del primer mensaje del cliente al pedido entregado." },
          { clave: "17", etiqueta: "17", titulo: "Los informes de tu negocio", resumen: "Cuánto vendés, qué se vende más y cómo viene el mes." },
          { clave: "18", etiqueta: "18", titulo: "Tu gestor comercial", resumen: "El embudo de ventas, la cotización con tres opciones y los proyectos." },
        ],
      },
    ],
    detalles: DETALLES["negocio-de-fotografia"],
    portada: {
      src: "/tutoriales/negocio-de-fotografia.jpg",
      alt: "La caja del Estudio Demo en el panel de FOTOFFICE",
    },
    cierre: {
      titulo: "Probalo en tu negocio",
      texto: "Entrá a FOTOFFICE, encendé los módulos que usás y empezá por la caja del día.",
    },
  },
  {
    slug: "sociedad-o-fotoclub",
    claveAjuste: "fotoffice_tutoriales_sociedad",
    titulo: "FOTOFFICE para tu sociedad o fotoclub",
    lema: "Socios, cuotas, carnets, sorteos y cursos de tu institución, en un mismo lugar",
    intro:
      "grabadas sobre las pantallas reales de FOTOFFICE con una institución de demo: el Fotoclub Demo del Litoral y sus socios son inventados.",
    bloques: [
      {
        titulo: "Empezar",
        clases: [
          { clave: "1", etiqueta: "1", titulo: "FOTOFFICE para tu sociedad o fotoclub", resumen: "El recorrido general por el panel de una institución." },
          { clave: "1b", etiqueta: "1-B", titulo: "¿Cuánto cuesta FOTOFFICE para una institución?", resumen: "Cero pesos por mes: un 5 % de cada cuota que cobra la institución." },
        ],
      },
      {
        titulo: "Los socios",
        clases: [
          { clave: "2", etiqueta: "2", titulo: "Socios y categorías", resumen: "El padrón, las categorías, la importación y las solicitudes." },
          { clave: "3", etiqueta: "3", titulo: "La cuota mensual", resumen: "Avisos automáticos y descuentos opcionales." },
          { clave: "4", etiqueta: "4", titulo: "El carnet de socio", resumen: "El carnet impreso y el digital, en el celular del socio." },
          { clave: "5", etiqueta: "5", titulo: "Recordatorios a los socios", resumen: "Correos con fecha y plantillas listas." },
          { clave: "6", etiqueta: "6", titulo: "Beneficios y sponsors", resumen: "Los descuentos de los sponsors para los socios." },
          { clave: "7", etiqueta: "7", titulo: "Sorteos y entrega de premios", resumen: "El sorteo en vivo y la entrega de cada premio." },
        ],
      },
      {
        titulo: "Vender y comunicar",
        clases: [
          { clave: "8", etiqueta: "8", titulo: "Venta de merchandising", resumen: "La tienda de la institución." },
          { clave: "9", etiqueta: "9", titulo: "Página web y venta online", resumen: "El sitio de la institución." },
          { clave: "10", etiqueta: "10", titulo: "El blog de la institución", resumen: "Artículos, novedades y publicaciones programadas." },
        ],
      },
      {
        titulo: "Cursos, espacios y comisión directiva",
        clases: [
          { clave: "11", etiqueta: "11", titulo: "Cursos presenciales, virtuales y grabados", resumen: "Armar un curso y venderlo." },
          { clave: "12", etiqueta: "12", titulo: "Gestión de alumnos", resumen: "Interesados, inscriptos y seguimiento." },
          { clave: "13", etiqueta: "13", titulo: "Alquiler de espacios", resumen: "Reservas de la sala o del estudio de la institución." },
          { clave: "14", etiqueta: "14", titulo: "La comisión directiva", resumen: "Proyectos, reuniones y tareas." },
          { clave: "15", etiqueta: "15", titulo: "El portal del socio", resumen: "Lo que ve cada socio cuando entra." },
        ],
      },
    ],
    detalles: DETALLES["sociedad-o-fotoclub"],
    portada: {
      src: "/tutoriales/sociedad-o-fotoclub.jpg",
      alt: "Ejemplo de una cuota de 10.000 pesos: con el 5 %, a la institución le quedan 9.500",
    },
    cierre: {
      titulo: "Probalo en tu institución",
      texto: "Entrá a FOTOFFICE, cargá a tus socios y mandá el primer aviso de cuota.",
    },
  },
  {
    slug: "cuanto-cobrar",
    claveAjuste: "fotoffice_tutoriales_cuanto_cobrar",
    titulo: "Cuánto cobrar como fotógrafo",
    lema: "Armá tu precio a partir de lo que necesitás para vivir, tus costos y tu mercado",
    intro:
      "con la herramienta ¿Cuánto Cobro? de FOTOFFICE: mientras mirás cada clase, cargás tu perfil y al final tenés tu cotización.",
    bloques: [
      {
        titulo: "Tu vida y tu tiempo",
        clases: [
          { clave: "1", etiqueta: "1", titulo: "¿Cuánto necesitás ganar por mes?", resumen: "Qué es tu presupuesto de vida y qué vida querés darte." },
          { clave: "2", etiqueta: "2", titulo: "¿Y si no vivís solo de la fotografía?", resumen: "Otro trabajo te da otro ingreso, pero menos horas para la fotografía." },
          { clave: "3", etiqueta: "3", titulo: "No todos tenemos los mismos gastos", resumen: "Freelancer, estudio con alquiler o empresa con empleados." },
        ],
      },
      {
        titulo: "Tus costos, uno por uno",
        clases: [
          { clave: "4", etiqueta: "4", titulo: "Gastos fijos del negocio", resumen: "Alquiler, servicios, programas, publicidad, contador y sueldos." },
          { clave: "5", etiqueta: "5", titulo: "Los gastos variables de cada evento", resumen: "Traslado, viáticos, segundo fotógrafo, comida e impresiones." },
          { clave: "6", etiqueta: "6", titulo: "Lo que vale tu hora de trabajo", resumen: "La hora de trabajo y las horas que no se ven." },
          { clave: "7", etiqueta: "7", titulo: "Insumos y equipos", resumen: "Pilas y tarjetas frente a cuerpos, lentes y flashes." },
          { clave: "8", etiqueta: "8", titulo: "Tu cámara se gasta", resumen: "La vida del obturador y cuándo renovar el equipo." },
          { clave: "9", etiqueta: "9", titulo: "Impresiones: nunca menos del 100 %", resumen: "Se cobra al menos el doble de lo que cuesta imprimir." },
          { clave: "10", etiqueta: "10", titulo: "Vacaciones y emergencias también se cobran", resumen: "El ahorro va dentro del precio." },
        ],
      },
      {
        titulo: "El mercado",
        clases: [
          { clave: "11", etiqueta: "11", titulo: "Oferta y demanda", resumen: "Con más consultas, el precio sube." },
          { clave: "12", etiqueta: "12", titulo: "¿En qué momento está tu negocio?", resumen: "De «estoy comenzando» a «tengo alta demanda»." },
          { clave: "13", etiqueta: "13", titulo: "Filtrar por precio", resumen: "Cuando sobran consultas, el precio elige a los clientes." },
          { clave: "14", etiqueta: "14", titulo: "«En mi pueblo hay muchos fotógrafos»", resumen: "La cantidad de fotógrafos va en proporción a los habitantes." },
          { clave: "15", etiqueta: "15", titulo: "Precio y valor", resumen: "El valor que percibe el cliente decide si sos caro o barato." },
          { clave: "16", etiqueta: "16", titulo: "Especializate en un nicho", resumen: "El especialista cobra mejor; fuera de tu nicho sos uno más." },
          { clave: "17", etiqueta: "17", titulo: "¿Por qué algunos cobran barato?", resumen: "Las causas de cobrar barato y cómo cambiarlas." },
          { clave: "18", etiqueta: "18", titulo: "Cuánto cobrar tus fotos en ComprameLaFoto", resumen: "Precio por foto, packs e impresiones en fotos de eventos." },
        ],
      },
      {
        titulo: "Conseguir consultas",
        clases: [
          { clave: "19", etiqueta: "19", titulo: "Más allá del boca en boca", resumen: "Redes y marketing digital, también para los que llevan años." },
          { clave: "20", etiqueta: "20", titulo: "El portfolio vende por vos", resumen: "Pocas fotos y muy buenas, ordenadas por nicho." },
        ],
      },
      {
        titulo: "Vender con FOTOFFICE",
        clases: [
          { clave: "21", etiqueta: "21", titulo: "Tu primera cotización con ¿Cuánto Cobro?", resumen: "La cotización mínima y la recomendada, en un renglón." },
          { clave: "22", etiqueta: "22", titulo: "El PDF de presentación", resumen: "Lo que acompaña a tu cotización para mostrar el valor." },
          { clave: "23", etiqueta: "23", titulo: "La entrevista", resumen: "Dónde se cierran los trabajos: preguntar, responder objeciones y cerrar." },
          { clave: "24", etiqueta: "24", titulo: "Ninguna consulta sin respuesta", resumen: "Las consultas y las cotizaciones, ordenadas en FOTOFFICE." },
          { clave: "25", etiqueta: "25", titulo: "Te escribieron «info»", resumen: "Cotización directa o entrevista, según cómo llega el cliente." },
          { clave: "26", etiqueta: "26", titulo: "Que tu WhatsApp cotice solo", resumen: "El bot cotiza con tu perfil y vos aprobás antes de que salga." },
        ],
      },
    ],
    detalles: DETALLES["cuanto-cobrar"],
    portada: {
      src: "/tutoriales/cuanto-cobrar.jpg",
      alt: "Presupuesto y cotización: la cotización sale del presupuesto, nunca al revés",
    },
    cierre: {
      titulo: "Cargá tu perfil de ¿Cuánto Cobro?",
      texto: "Entrá a FOTOFFICE y completá tu perfil mientras mirás el curso: al final tenés tu cotización.",
    },
  },
];

export function cursoTutorial(slug: string): CursoTutorial | null {
  return CURSOS_TUTORIALES.find((c) => c.slug === slug) ?? null;
}
