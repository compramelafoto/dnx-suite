import type { Phase8ArticleContent } from "@/data/blog/phase8/types";
import { p, h2, h3, ul } from "@/data/blog/phase8/editorial-nodes";

/** Artículo destacado del programa de referidos (guía completa). */
export const REFERIDOS_DESTACADO_PHASE8: Record<string, Phase8ArticleContent> = {
  "como-generar-ingresos-recomendando-compramelafoto": {
    seoTitle: "Ganar dinero recomendando ComprameLaFoto: guía referidos",
    seoDescription:
      "Programa de referidos de ComprameLaFoto: link único, 50% del fee por 12 meses, ejemplos de comisión y cómo cobrar tus ganancias.",
    excerpt:
      "Guía completa del programa de referidos: link, comisiones del 50% del fee durante 12 meses, ejemplos y preguntas frecuentes.",
    blocks: [
      p(
        "Si ya usás ComprameLaFoto o conocés fotógrafos que podrían vender acá, el programa de referidos te permite generar ingresos recomendando la plataforma. No se trata de un esquema de marketing agresivo: es un beneficio para quien comparte una herramienta que realmente le sirve a colegas que recién empiezan a vender online o que buscan centralizar cobros y entregas. En esta guía repasamos el funcionamiento completo: cómo obtener tu link, qué condiciones generan comisión, cómo se calcula el 50% del fee de marketplace, ejemplos en pesos argentinos y el flujo para cobrar lo acumulado."
      ),
      h2("Cómo funciona el sistema de referidos"),
      p(
        "Cualquier usuario registrado en ComprameLaFoto —fotógrafo, organizador, laboratorio o cliente— puede tener un link de referido y recomendar la plataforma. La atribución ocurre cuando alguien se registra usando tu URL con el parámetro de referido. A partir de ahí, esa persona queda asociada a tu código mientras dure la ventana de comisiones."
      ),
      p(
        "Las comisiones se generan únicamente cuando el referido es un fotógrafo que vende en la plataforma. Si referís a un organizador, laboratorio o cliente que no opera como fotógrafo vendedor, no hay comisión por sus actividades. El modelo está pensado para premiar a quien trae fotógrafos activos que generan ventas reales."
      ),
      ul([
        "Atribución: quien se registra con tu link queda vinculado a tu código de referido.",
        "Ventana: cobrás comisión durante 12 meses desde el alta del fotógrafo referido.",
        "Base: el 50% del fee de marketplace que cobra ComprameLaFoto en cada venta del referido.",
        "Requisito: necesitás Mercado Pago conectado al momento de la venta para que la comisión se registre.",
      ]),
      h2("Cómo obtener tu link de referido"),
      h3("Si sos fotógrafo"),
      p(
        "Ingresá a Configuración → Referidos en tu panel. Con Mercado Pago conectado podés generar o copiar tu link único. Sin MP conectado, las ventas de tus referidos no generarán comisión acumulable: el sistema necesita tu cuenta vinculada para registrar correctamente tu parte."
      ),
      h3("Si sos organizador, laboratorio o cliente"),
      p(
        "También podés participar del programa. Si tu perfil aún no muestra la sección de referidos, contactá a soporte de ComprameLaFoto para activar tu link. Una vez habilitado, funciona igual para atribuir fotógrafos que se registren con tu código."
      ),
      h2("Registro mediante referido"),
      p(
        "Cuando compartís tu link, el fotógrafo debe completar el registro desde esa URL, no desde la página genérica sin parámetro. Si acortás el enlace, verificá que el código de referido no se pierda en el camino. Un registro sin atribución no se puede asociar retroactivamente a tu cuenta."
      ),
      p(
        "El referido no paga extra por usar tu link: accede a las condiciones estándar de la plataforma. Tu beneficio viene del lado de las comisiones que generan sus ventas, no de cargarle un costo adicional al colega que recomendás."
      ),
      h2("Cómo compartir tu link con criterio"),
      ul([
        "WhatsApp: grupos de fotógrafos, colegas de eventos o escuelas donde la recomendación sea contextual.",
        "Instagram o LinkedIn: bio, historias o posts explicando por qué te sirve la plataforma, sin spam.",
        "Email: a fotógrafos que recién empiezan a vender online y necesitan un flujo de cobro claro.",
        "Charlas y capacitaciones: QR o link en materiales cuando presentás tu experiencia con la herramienta.",
        "Siempre usá tu URL con el parámetro de referido; evitá acortadores que eliminen el código.",
      ]),
      h2("Cómo se calculan las comisiones"),
      p(
        "En cada venta aprobada del fotógrafo referido, ComprameLaFoto cobra un fee de marketplace. El 50% de ese fee se asigna al referidor y el 50% restante a la plataforma. Si hubo descuentos de fee por saldo referido del vendedor, el cálculo se hace sobre el fee efectivo de esa transacción, no sobre un valor teórico."
      ),
      ul([
        "Comisión referidor = 50% del fee efectivo de la plataforma en esa venta.",
        "Duración: 12 meses desde la fecha de registro del fotógrafo referido.",
        "Devoluciones o contracargos revierten la comisión asociada.",
        "No hay comisión si el referido no vende como fotógrafo en la plataforma.",
      ]),
      h2("Ejemplos ilustrativos de ganancias"),
      p(
        "Los montos reales dependen del fee vigente en cada venta y del volumen del fotógrafo referido. Estos ejemplos son simplificados, en pesos argentinos, para entender la lógica:"
      ),
      ul([
        "Venta de $10.000 con fee de plataforma de $500 → tu comisión: $250.",
        "Si ese fotógrafo vende $200.000 en un mes con fee promedio efectivo de $8.000 → tu comisión del mes: $4.000.",
        "Durante los 12 meses, cada venta nueva del mismo referido sigue generando comisión mientras la atribución esté activa.",
        "Un referidor con cinco fotógrafos activos que facturan en conjunto $1.000.000 al mes puede acumular comisiones significativas sin operar cada venta.",
      ]),
      h2("Casos de uso del programa"),
      p(
        "Un fotógrafo veterano recomienda la plataforma a colegas de maratones que todavía cobran por transferencia. Un organizador de torneos sugiere ComprameLaFoto a los fotógrafos que convoca. Un laboratorio que atiende escuelas comparte su link con estudios que recién incorporan venta online. En todos los casos, el patrón es el mismo: recomendar donde hay fit real, no donde la herramienta no encaja."
      ),
      h2("Cómo cobrás tus comisiones"),
      p(
        "Desde Configuración → Referidos ves tu saldo acumulado. Cuando alcanzás el mínimo habilitado, usás «Solicitar cobro». El equipo procesa el pago por Mercado Pago o transferencia según el flujo vigente. El fee de la venta original ingresa a la cuenta de la plataforma; tu parte se liquida mediante este proceso de solicitud y pago."
      ),
      p(
        "Es importante entender que la comisión se registra en el momento de la venta aprobada, pero el cobro sigue un flujo de solicitud y liquidación. Esto se debe a las limitaciones técnicas del split de Mercado Pago, que solo permite repartir entre dos partes en una misma transacción: el vendedor y el marketplace. Por eso tu parte queda contabilizada y se paga cuando solicitás el retiro."
      ),
      h2("Errores frecuentes que anulan comisiones"),
      p(
        "El error más común es recomendar sin tener Mercado Pago conectado cuando el referido empieza a vender. Si tu cuenta no está vinculada en ese momento, la comisión no se acumula ni se recupera después. Conectá MP antes de compartir el link activamente."
      ),
      p(
        "Otro error es compartir un enlace sin el parámetro de referido o usar acortadores que eliminan el código. Si el fotógrafo se registra por la página genérica, no hay atribución posible. Guardá tu link oficial desde el panel y copialo directamente."
      ),
      ul([
        "No referir cuentas duplicadas o auto-referidos: están prohibidos y pueden bloquear tu código.",
        "No prometer condiciones comerciales distintas a las de la plataforma: el referido accede a las mismas condiciones estándar.",
        "No spam en grupos: una recomendación contextual convierte más que diez mensajes idénticos.",
      ]),
      h2("Estrategia para maximizar ingresos"),
      p(
        "Enfocate en fotógrafos que realmente van a operar: colegas que cubren eventos cada fin de semana, estudios escolares con varios colegios en cartera o fotógrafos deportivos con calendario lleno. Un referido que se registra y nunca publica un álbum no genera comisión."
      ),
      p(
        "Acompañá la recomendación con contexto: explicá cómo resolviste el cobro con Mercado Pago, cómo publicás después de una maratón o cómo organizás una preventa escolar. Esa cercanía aumenta la probabilidad de que el referido active la cuenta y venda."
      ),
      p(
        "Revisá tu panel de referidos periódicamente. Identificá qué referidos venden más y mantené contacto profesional con ellos. No es gestión de su negocio, sino estar disponible para dudas iniciales que desbloqueen su primera publicación."
      ),
      h2("Relación con otros artículos del blog"),
      p(
        "Si querés profundizar en el funcionamiento técnico del programa, leé también «Cómo funciona el sistema de referidos» en la sección de funcionalidades. Para una mirada orientada a ingresos pasivos y perfiles de referidor, consultá el artículo complementario sobre ingresos pasivos por referidos en negocio fotográfico."
      ),
      h2("Preguntas que recibimos con frecuencia en soporte"),
      p(
        "Muchos referidores preguntan si pueden cambiar el link después de creado. En general, tu código de referido es estable: lo importante es no mezclar varios códigos en la misma campaña porque dificulta medir qué canal funciona mejor."
      ),
      p(
        "Otra consulta habitual es si las comisiones se ven en tiempo real. Tras cada venta aprobada del referido, el movimiento debería reflejarse en tu saldo acumulado. Si no ves cambios, verificá primero que el referido vendió con pago aprobado y que tenías Mercado Pago conectado en ese momento."
      ),
      p(
        "Por último, organizadores y laboratorios preguntan si conviene referir solo a su red cerrada. La respuesta depende de tu relación con esos fotógrafos: si confiás en que van a operar activamente, tu red cercana suele ser el mejor lugar para empezar antes de ampliar a comunidades más grandes."
      ),
      h2("Checklist antes de recomendar"),
      ul([
        "Mercado Pago conectado en tu cuenta de referidor.",
        "Link copiado desde Configuración → Referidos (no inventar URLs).",
        "Mensaje con contexto: qué problema resuelve la plataforma para ese colega.",
        "Confirmación de que el referido es fotógrafo que planea vender, no solo curioso.",
        "Seguimiento amable a los siete días del registro para desbloquear primera publicación.",
      ]),
      p(
        "Con ese checklist cubierto, cada recomendación tiene más chances de convertirse en ventas reales y, por extensión, en comisiones durante los doce meses de ventana. El programa premia consistencia y fit, no volumen de registros vacíos."
      ),
    ],
    faq: [
      {
        q: "¿Puedo referirme a mí mismo?",
        a: "No. Los auto-referidos y cuentas duplicadas están prohibidos y pueden bloquear el código de referido.",
      },
      {
        q: "¿Qué pasa si no tengo Mercado Pago conectado cuando mi referido vende?",
        a: "Esa comisión no se acumula ni se paga retroactivamente. Conectá MP antes de que tu referido empiece a vender.",
      },
      {
        q: "¿El referido tiene algún beneficio especial?",
        a: "Accede a las condiciones estándar de ComprameLaFoto. El beneficio principal del referidor son las comisiones por las ventas del fotógrafo referido.",
      },
      {
        q: "¿Puedo referir organizadores de eventos?",
        a: "Podés compartir tu link, pero las comisiones solo aplican si el referido es fotógrafo con ventas en la plataforma.",
      },
      {
        q: "¿Hay límite de referidos?",
        a: "No hay un límite publicado de cantidad de fotógrafos referidos; sí aplican políticas anti-abuso y revisión de patrones sospechosos.",
      },
    ],
    conclusion:
      "El programa de referidos de ComprameLaFoto premia a quien recomienda fotógrafos que venden de verdad: 50% del fee de marketplace durante 12 meses, con atribución por link y cobro desde tu panel. Si ya confiás en la plataforma para tus eventos o escuelas, compartirla con colegas puede convertirse en un ingreso complementario sin cambiar tu trabajo principal.",
    ctaAudience: "fotografos",
    imageScene:
      "Professional photographer recommending app to two colleagues at coffee shop, laptops and cameras on table, warm documentary photo",
    imageAltSubject: "Fotógrafo recomendando ComprameLaFoto a colegas",
    imageCaption: "Recomendar con contexto real genera mejores resultados que el spam de links.",
  },
};
