import type { Phase8ArticleContent } from "@/data/blog/phase8/types";
import { resolveCtaAudience } from "@/data/blog/phase8/cta";
import { blockquote, h2, h3, p, pr, ul } from "@/data/blog/phase8/editorial-nodes";

const PROMO_CTA = {
  title: "¿Listo para dejar de adivinar tus precios?",
  paragraphs: [
    "Descubrí cuánto deberías cobrar según tus propios costos, objetivos y forma de trabajar.",
    "Creá presupuestos profesionales, guardá todos tus clientes y administrá tu negocio fotográfico desde un solo lugar.",
  ],
  buttonLabel: "Comenzar gratis",
  buttonHref: "/cuantocobro",
};

export const CUANTO_COBRAR_FOTOGRAFIA_PHASE8: Record<string, Phase8ArticleContent> = {
  "cuanto-cobrar-fotografia": {
    seoTitle: "¿Cuánto cobrar por una sesión de fotos | Guía para fotógrafos",
    seoDescription:
      "Aprendé cómo calcular cuánto cobrar por una sesión de fotos o un evento utilizando una calculadora profesional basada en costos reales.",
    excerpt:
      "Aprendé a calcular cuánto cobrar por una sesión de fotos o un evento con un método basado en costos reales, horas de trabajo y objetivos de rentabilidad — sin adivinar precios.",
    blocks: [
      p(
        "«¿Cuánto cobro por este trabajo?» Es una de las preguntas que más angustia a fotógrafos en cualquier etapa de su carrera. Si respondés muy bajo, trabajás mucho y ganás poco. Si respondés muy alto sin sustento, perdés el encargo o generás fricción con el cliente. La salida no es adivinar ni copiar tarifas de internet: es armar presupuestos con números propios."
      ),
      p(
        "En esta guía vas a ver cómo calcular un presupuesto fotográfico profesional, qué costos no podés ignorar y cómo transformar horas, equipos y objetivos en un precio defendible. Al final, también te mostramos cómo una calculadora como ¿Cuánto Cobro? puede ayudarte a dejar de improvisar."
      ),
      h2("Por qué adivinar precios te hace perder dinero"),
      p(
        "Muchos fotógrafos fijan precios mirando el mercado o lo que «cree el cliente que vale». Ese enfoque ignora algo esencial: dos estudios con los mismos equipos pueden tener costos de vida, disponibilidad y ambición comercial muy distintos. Lo que le sirve a uno puede fundir a otro."
      ),
      blockquote(
        "Cobrar no es poner un número atractivo: es cubrir tu operación, pagarte un salario razonable y dejar margen para crecer."
      ),
      p(
        "Cuando presupuestás sin calcular, suele pasar lo siguiente: subestimás las horas invisibles (reuniones, coordinación, backup, facturación), no amortizás la renovación de cámaras y lentes, y mezclás gastos personales con los del negocio. El resultado es un precio que parece alto para el cliente pero bajo para vos."
      ),
      h2("Los tres errores más comunes al presupuestar"),
      h3("1. Presupuestar solo el día del evento"),
      p(
        "Una boda, un acto escolar o una sesión de producto no son «X horas con la cámara en la mano». Antes hay venta, planificación y logística; después, selección, edición, entrega y seguimiento. Si esas horas no entran al presupuesto, tu tarifa por hora real cae sin que lo notes."
      ),
      h3("2. Olvidar el desgaste del equipo"),
      p(
        "Cada disparo acerca la renovación de tu cuerpo de cámara. Cada viaje desgasta el auto, las baterías y los accesorios. Un presupuesto serio contempla el costo de reponer herramientas, no solo el alquiler imaginario del día."
      ),
      h3("3. Confundir facturación con ganancia"),
      p(
        "Facturar $500.000 no significa ganar eso. Del total salen impuestos, comisiones de medios de pago, laboratorio, asistentes, combustible, software y tiempo no remunerado. La pregunta correcta no es «¿cuánto cobro?» sino «¿cuánto me queda y me alcanza para vivir y reinvertir?»."
      ),
      h2("Qué debe incluir un presupuesto fotográfico profesional"),
      p("Un presupuesto completo no es una cifra suelta: es la suma ordenada de varios bloques."),
      ul([
        "Horas de producción en locación o estudio.",
        "Horas de postproducción, selección y retoque.",
        "Horas comerciales: venta, reuniones, coordinación y seguimiento.",
        "Costos directos del trabajo: traslados, peajes, estacionamiento, permisos, props, alquileres.",
        "Costos fijos prorrateados: seguros, contador, software, hosting, marketing.",
        "Amortización y desgaste de equipos.",
        "Margen de ganancia y contingencia.",
      ]),
      blockquote(
        "Si un ítem no está en el presupuesto, lo estás subsidiando con tu bolsillo o con tu tiempo no pago."
      ),
      p(
        "Separar «horas del cliente» de «horas del trabajo» ayuda a explicar el valor al contratante y a comparar encargos distintos con criterio. Una sesión de retrato de dos horas no se presupuesta igual que un evento de ocho horas con tres días de edición."
      ),
      h2("Cómo calcular tu tarifa por hora real"),
      p(
        "Un método útil es partir de cuántas horas facturables podés vender al mes y qué necesitás ganar para cubrir vida y negocio. La fórmula base es simple: dividí tu objetivo mensual —costos fijos + costos variables estimados + sueldo deseado— entre las horas que realmente podés dedicar a trabajos pagos."
      ),
      p(
        "Ese número es tu piso, no tu techo. Después ajustás por complejidad, urgencia, derechos de uso, exclusividad y riesgo. Pero sin ese piso, cada descuento te acerca al rojo."
      ),
      h3("Ejemplo simplificado"),
      ul([
        "Costos fijos del mes: alquiler de estudio, software, seguros, contador.",
        "Costos variables estimados: combustible, impresiones, comisiones.",
        "Sueldo objetivo: lo que necesitás retirar para vivir.",
        "Horas facturables realistas: no las del calendario ideal, sino las que vendés en la práctica.",
      ]),
      p(
        "Si necesitás $1.200.000 netos al mes y podés facturar 80 horas productivas, tu tarifa horaria mínima ronda los $15.000 antes de margen y antes de sumar equipos o gastos puntuales del encargo. Ese ejercicio evita que aceptes trabajos «por visibilidad» que en realidad te cuestan plata."
      ),
      h2("Costos fijos, variables y renovación de equipos"),
      p(
        "Los costos fijos existen aunque no dispares el obturador: seguro de equipos, cuota de edición, internet, celular, contador, publicidad. Deben prorratearse en cada presupuesto según tu volumen de trabajos."
      ),
      p(
        "Los costos variables aparecen trabajo a trabajo: peajes, comidas en locación, asistente, impresión de pruebas, envío de archivos en disco. Cuanto más lejos o más largo el evento, más pesan."
      ),
      h3("Renovación y desgaste"),
      p(
        "Una cámara profesional tiene vida útil limitada en disparos y en años. Lo mismo aplica a laptops, discos y luces. Incluir una partida de renovación —aunque sea estimada— evita que un día te quedes sin herramientas y sin fondos para reemplazarlas."
      ),
      pr(
        { type: "text", text: "Si todavía estás definiendo tu estructura de costos, complementá esta guía con " },
        {
          type: "link",
          text: "cómo configurar los precios de tus fotografías",
          href: "/blog/como-configurar-precios-fotografias",
        },
        { type: "text", text: " cuando vendés online en galerías digitales." }
      ),
      h2("Cuánto cobrar según el tipo de trabajo"),
      p(
        "No existe una tabla universal válida para todos los países y nichos, pero sí criterios repetibles. Lo que cambia entre una sesión de fotos, un evento social y una campaña comercial es la mezcla de horas, riesgo y derechos de uso."
      ),
      h3("Sesión de fotos (retrato, maternidad, newborn, pareja)"),
      ul([
        "Menos horas en locación, más peso en postproducción y dirección.",
        "Definí cantidad de fotos entregadas y si incluye maquillaje o vestuario.",
        "Aclará si el cliente recibe uso personal o comercial de las imágenes.",
      ]),
      h3("Eventos (bodas, cumpleaños, corporativos)"),
      ul([
        "Sumá cobertura, segundo fotógrafo, backup de archivos y tiempos de entrega.",
        "Contemplá desplazamientos y jornadas extendidas.",
        "Incluí horas de coordinación previa con el cliente o el organizador.",
      ]),
      h3("Fotografía escolar y deportiva"),
      ul([
        "El volumen de imágenes y la velocidad de publicación impactan en el precio.",
        "Si vendés por unidad, calculá cuántas familias necesitás convertir para cubrir la jornada.",
        "La logística de varios colegios o categorías en un mismo día debe estar presupuestada.",
      ]),
      h3("Producto, gastronomía y publicidad"),
      ul([
        "Mayor exigencia de iluminación, styling y retoque.",
        "Licencias de uso para redes, web o campañas amplían el valor del trabajo.",
        "A veces conviene presupuestar por imagen final además de por jornada.",
      ]),
      blockquote(
        "Comparar tu presupuesto solo con «cuánto cobra otro» sin conocer su estructura de costos es como copiar la receta sin los ingredientes."
      ),
      h2("Margen, impuestos y objetivo de ganancia"),
      p(
        "Después de cubrir horas y gastos, necesitás margen: para imprevistos, para invertir en capacitación, para equipos nuevos y para no vivir al límite cada mes. Un margen del 15 % al 30 % sobre costos totales es un rango habitual en servicios creativos, según tu mercado y posicionamiento."
      ),
      p(
        "Los impuestos y retenciones dependen de tu situación fiscal. Lo importante es que el presupuesto al cliente sea coherente con lo que te queda en mano después de tributar y pagar comisiones. Muchos fotógrafos descubren tarde que su «precio caro» en realidad era un precio justo mal calculado."
      ),
      h2("Cómo presentar el presupuesto al cliente"),
      p(
        "Un presupuesto claro genera confianza. En lugar de un número misterioso, mostrá ítems comprensibles: cobertura, entregables, plazos, revisiones incluidas y qué pasa si hay cambios de fecha o horas extra."
      ),
      ul([
        "Usá un documento ordenado con tu marca y datos de contacto.",
        "Separá honorarios, gastos reembolsables y opcionales.",
        "Indicá forma de pago y seña para reservar fecha.",
        "Definí validez del presupuesto para evitar sorpresas meses después.",
        "Explicá qué incluye y qué no —archivos, impresiones, álbum, derechos.",
      ]),
      p(
        "Cuando el cliente entiende el trabajo detrás del precio, negociás menos desde el pánico y más desde el valor. Eso no significa no hacer descuentos estratégicos; significa saber cuánto podés ceder sin trabajar gratis."
      ),
      h2("De la planilla al presupuesto profesional en minutos"),
      p(
        "Hacer estos cálculos en una hoja de cálculo es posible, pero lleva tiempo y es fácil olvidar variables. Por eso creamos ¿Cuánto Cobro?, la calculadora de presupuestos para fotógrafos de ComprameLaFoto: centraliza costos personales, gastos del negocio, horas por tipo de trabajo, desgaste de equipos y margen, y te devuelve un precio sustentado en tus números."
      ),
      pr(
        { type: "text", text: "Podés " },
        {
          type: "link",
          text: "comenzar gratis en ¿Cuánto Cobro?",
          href: "/cuantocobro",
        },
        {
          type: "text",
          text: ", armar presupuestos por producto o servicio, guardar clientes y revisar la rentabilidad antes de enviar la propuesta. Es la forma más directa de pasar de «¿cuánto cobro fotógrafo?» a un número que podés defender.",
        }
      ),
    ],
    faq: [
      {
        q: "¿Cuánto cobrar por una sesión de fotos en Argentina?",
        a: "Depende de tus costos, horas totales (incluida postproducción), nivel de entrega y derechos de uso. No hay un valor único: calculá tu tarifa horaria mínima y multiplicá por el tiempo real del encargo más gastos y margen.",
      },
      {
        q: "¿Qué diferencia hay entre precio y presupuesto fotográfico?",
        a: "El precio puede ser una referencia genérica; el presupuesto es una propuesta cerrada para un trabajo concreto, con alcance, plazos, entregables y condiciones. Un presupuesto profesional evita malentendidos.",
      },
      {
        q: "¿Debo cobrar por hora o por paquete?",
        a: "Ambos modelos funcionan. Muchos fotógrafos comercializan paquetes al cliente pero los arman internamente con un cálculo por horas y costos. Lo importante es que el paquete cubra tu operación.",
      },
      {
        q: "¿Cómo calcular cuánto cobrar por un evento?",
        a: "Sumá horas de cobertura, desplazamiento, preparación, edición, entrega y gestión comercial. Agregá costos variables del día, amortización de equipos y margen. Los eventos largos o con segundo shooter requieren más horas de coordinación.",
      },
      {
        q: "¿Sirve una calculadora de presupuesto para fotógrafos?",
        a: "Sí, si incorpora costos reales y no solo un multiplicador arbitrario. ¿Cuánto Cobro? está pensada para fotógrafos que quieren presupuestos repetibles, con clientes, ítems y vista previa comercial.",
      },
      {
        q: "¿Qué hago si el cliente dice que es caro?",
        a: "Revisá si el alcance puede reducirse (menos horas, menos fotos, entrega más simple) en lugar de bajar el precio sin quitar servicios. Si el número es correcto según tus costos, regalar trabajo erosiona tu negocio.",
      },
    ],
    conclusion:
      "Dejar de adivinar precios es un paso decisivo para profesionalizar tu fotografía. Cuando conocés tus costos, tus horas y el margen que necesitás, podés cotizar sesiones, eventos y campañas con seguridad —y explicar tu valor con claridad. Usá esta guía como mapa y apoyate en herramientas como ¿Cuánto Cobro? para transformar esos números en presupuestos listos para enviar.",
    ctaAudience: resolveCtaAudience(["fotografos"]),
    promoCta: PROMO_CTA,
    imageScene:
      "Professional photographer reviewing pricing spreadsheet on laptop with camera gear on desk, soft window light, trustworthy editorial workspace",
    imageAltSubject: "Calculadora de presupuestos para fotógrafos - Cuánto Cobro",
    imageCaption:
      "Un presupuesto fotográfico profesional parte de tus costos reales, no de lo que «parece» cobrar el mercado.",
  },
};
