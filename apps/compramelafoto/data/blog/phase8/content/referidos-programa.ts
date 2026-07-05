import type { Phase8ArticleContent } from "@/data/blog/phase8/types";
import { resolveCtaAudience } from "@/data/blog/phase8/cta";
import { h2, h3, p, pr, ul } from "@/data/blog/phase8/editorial-nodes";

export const REFERIDOS_PROGRAMA_PHASE8: Record<string, Phase8ArticleContent> = {
  "programa-referidos-compramelafoto": {
    seoTitle: "Programa de Referidos de ComprameLaFoto",
    seoDescription:
      "Conocé cómo ganar comisiones recomendando fotógrafos, organizadores y escuelas a ComprameLaFoto. Una oportunidad para generar ingresos conectando personas con la plataforma.",
    excerpt:
      "ComprameLaFoto permite ganar comisiones recomendando fotógrafos, organizadores y próximamente escuelas. Conocé cómo funciona el programa de referidos y cómo una simple recomendación puede generar ingresos durante meses.",
    blocks: [
      p(
        "Uno de los mayores desafíos en el mundo de la fotografía de eventos es conectar a las personas correctas."
      ),
      p(
        "Fotógrafos que buscan más oportunidades de trabajo. Organizadores que necesitan cobertura fotográfica para sus eventos. Escuelas que quieren una solución simple, segura y profesional para vender fotografías a las familias. Clubes, instituciones, laboratorios y clientes que conocen personas que podrían beneficiarse utilizando ComprameLaFoto."
      ),
      p(
        "Por eso creamos el Programa de Referidos de ComprameLaFoto: una forma simple de ganar comisiones recomendando la plataforma a nuevos usuarios."
      ),
      h2("¿Quién puede participar?"),
      p("La respuesta es simple: cualquier persona."),
      p("No hace falta ser fotógrafo ni organizador de eventos. Podés participar si sos:"),
      ul([
        "Fotógrafo.",
        "Organizador de eventos.",
        "Escuela.",
        "Cliente.",
        "Laboratorio fotográfico.",
        "Familiar o amigo de un fotógrafo.",
        "Usuario de ComprameLaFoto.",
        "Parte de un club, institución o comunidad educativa.",
      ]),
      p(
        "Si conocés a alguien que puede vender fotografías, organizar eventos o incorporar una solución fotográfica para su institución, podés recomendar ComprameLaFoto."
      ),
      h2("¿A quién puedo recomendar?"),
      p(
        "El programa está pensado para que cualquier persona pueda generar conexiones útiles dentro de la comunidad."
      ),
      h3("Fotógrafos que recomiendan fotógrafos"),
      p(
        "Un fotógrafo deportivo puede recomendar a colegas que cubren otras disciplinas. Un fotógrafo escolar puede invitar a fotógrafos sociales. Un fotógrafo de bodas puede recomendar a fotógrafos que trabajan en clubes, torneos o eventos masivos."
      ),
      p(
        "Cada nuevo fotógrafo que comienza a vender a través de ComprameLaFoto puede generar comisiones para quien lo recomendó."
      ),
      h3("Fotógrafos que recomiendan organizadores"),
      p(
        "Muchos fotógrafos tienen contacto directo con clubes, escuelas, municipios, federaciones deportivas, productoras y empresas. Si esos organizadores comienzan a utilizar ComprameLaFoto para gestionar eventos, publicar galerías y vender fotografías, el fotógrafo que realizó la recomendación también puede generar comisiones."
      ),
      h3("Organizadores que recomiendan organizadores"),
      p(
        "Si organizás carreras, torneos, encuentros deportivos, actos, competencias o eventos masivos, seguramente conocés a otros organizadores. Cada recomendación puede transformarse en una nueva oportunidad para que más eventos tengan cobertura fotográfica profesional y para que vos generes ingresos adicionales."
      ),
      h3("Organizadores que recomiendan fotógrafos"),
      p(
        "Los organizadores también pueden invitar fotógrafos a sumarse a la plataforma. Esto ayuda a ampliar la comunidad, mejorar la cobertura de eventos y generar nuevas oportunidades laborales para fotógrafos de distintas ciudades."
      ),
      h3("Clientes, familias, laboratorios e instituciones"),
      p(
        "Las recomendaciones no están limitadas a profesionales. Muchas veces los propios clientes conocen fotógrafos que podrían beneficiarse utilizando ComprameLaFoto."
      ),
      p(
        "Lo mismo ocurre con laboratorios fotográficos, escuelas, clubes, asociaciones civiles, familias e instituciones que tienen contacto frecuente con fotógrafos u organizadores."
      ),
      h2("Las escuelas también serán una gran oportunidad"),
      p(
        "ComprameLaFoto también está desarrollando herramientas pensadas especialmente para escuelas e instituciones educativas. Las escuelas pueden utilizar la plataforma para preventas, actos escolares, eventos deportivos, fotografías grupales, galerías privadas y venta posterior a los eventos."
      ),
      p(
        "Por eso, las recomendaciones de escuelas tendrán un enorme potencial dentro del programa. La idea es que recomendar una escuela también pueda generar comisiones bajo una modalidad similar a la recomendación de organizadores."
      ),
      p("Una sola escuela puede realizar múltiples actividades durante el año:"),
      ul([
        "Actos escolares.",
        "Día de la Bandera.",
        "Fotografías institucionales.",
        "Eventos deportivos.",
        "Muestras.",
        "Egresos.",
        "Jornadas especiales.",
        "Campañas de recaudación.",
      ]),
      p(
        "Cada una de esas actividades puede transformarse en una nueva oportunidad de venta de fotografías."
      ),
      h2("¿Cómo funcionan las comisiones?"),
      p(
        "Cuando una persona se registra utilizando tu enlace de referido y comienza a vender a través de ComprameLaFoto, vos podés recibir comisiones por la actividad que genera dentro de la plataforma."
      ),
      p("Actualmente, las recomendaciones de:"),
      ul(["Fotógrafos.", "Organizadores de eventos."]),
      p("pueden generar comisiones durante 12 meses."),
      p("Y próximamente, las recomendaciones de:"),
      ul(["Escuelas.", "Instituciones educativas."]),
      p("también podrán generar comisiones bajo una modalidad similar."),
      p(
        "Las comisiones se calculan automáticamente y pueden consultarse desde el panel de referidos."
      ),
      pr(
        { type: "text", text: "Para el detalle técnico del cálculo y los plazos, consultá " },
        {
          type: "link",
          text: "cómo funciona el sistema de referidos",
          href: "/blog/como-funciona-sistema-referidos",
        },
        { type: "text", text: " y la " },
        {
          type: "link",
          text: "guía completa para generar ingresos recomendando ComprameLaFoto",
          href: "/blog/como-generar-ingresos-recomendando-compramelafoto",
        },
        { type: "text", text: "." }
      ),
      h2("Ejemplo real de ganancias"),
      p("Imaginemos que recomendás a un fotógrafo deportivo."),
      p(
        "Ese fotógrafo empieza a utilizar ComprameLaFoto y durante el primer año vende fotografías por un total de $10.000.000."
      ),
      p(
        "En ese caso, podrías generar aproximadamente $750.000 en comisiones simplemente por haber realizado la recomendación inicial."
      ),
      p("No necesitás cubrir eventos."),
      p("No necesitás editar fotografías."),
      p("No necesitás publicar galerías."),
      p("No necesitás brindar soporte."),
      p("Solo conectaste a una persona con una herramienta que le permitió vender más."),
      h2("Cuanto mejor le va al referido, mejor te puede ir a vos"),
      p(
        "El programa está pensado para que todos los participantes crezcan juntos. Si el fotógrafo vende más, gana más dinero. Si el organizador realiza más eventos, genera más oportunidades. Si una escuela incorpora la plataforma, puede ofrecer una mejor experiencia a las familias."
      ),
      p(
        "Y si vos fuiste quien hizo esa conexión, podés recibir una recompensa por haber ayudado a que eso suceda."
      ),
      h2("Un ecosistema que se potencia con recomendaciones"),
      p("La fotografía de eventos funciona gracias a las relaciones."),
      p("Los fotógrafos conocen organizadores."),
      p("Los organizadores conocen clubes."),
      p("Los clubes conocen escuelas."),
      p("Las escuelas conocen familias."),
      p("Las familias conocen otros fotógrafos."),
      p("Los laboratorios conocen a cientos de profesionales."),
      p(
        "ComprameLaFoto busca aprovechar esa red natural de contactos para que todos puedan beneficiarse del crecimiento de la comunidad."
      ),
      h2("Una oportunidad para generar ingresos adicionales"),
      p(
        "Muchas personas ya tienen una red de contactos construida durante años. Fotógrafos, clientes, escuelas, clubes, laboratorios, productoras y organizadores forman parte de un mismo ecosistema."
      ),
      p(
        "El Programa de Referidos permite transformar esas conexiones en una oportunidad concreta de ingresos."
      ),
      p(
        "Si conocés fotógrafos, organizadores, escuelas, clubes o instituciones que todavía no utilizan ComprameLaFoto, podés recomendarles la plataforma y participar del crecimiento que generen."
      ),
      p(
        "A veces una simple recomendación puede convertirse en una relación comercial que produzca beneficios durante mucho tiempo."
      ),
      h2("Cómo empezar"),
      p("Dentro de tu cuenta de ComprameLaFoto podés encontrar tu enlace personal de referidos."),
      p(
        "Compartilo con fotógrafos, organizadores, escuelas, clubes, laboratorios o cualquier persona que pueda beneficiarse utilizando la plataforma."
      ),
      p(
        "Cada nuevo usuario que se registre mediante tu enlace quedará asociado a tu cuenta y podrás seguir la evolución de tus comisiones desde el panel de referidos."
      ),
      p(
        "ComprameLaFoto no busca únicamente sumar usuarios. Busca construir una comunidad donde fotógrafos, organizadores, escuelas, familias e instituciones puedan crecer juntos."
      ),
      p(
        "El Programa de Referidos es una forma de recompensar a quienes ayudan a generar esas conexiones."
      ),
      h2("¿Qué pasa después de compartir tu link?"),
      p(
        "Cuando alguien se registra con tu enlace, queda vinculado a tu cuenta de referidor. Desde el panel de referidos podés ver quién se sumó y, a medida que esa persona vende en la plataforma, cómo se acumulan tus comisiones. No tenés que facturar ni cobrarle al referido: el flujo de venta y el cálculo ocurren dentro de ComprameLaFoto."
      ),
      p(
        "Tu rol es conectar personas con una herramienta que les sirve. Si el fotógrafo publica galerías, cobra con Mercado Pago y entrega automáticamente, tiene más chances de repetir eventos y de que vos sigas generando comisiones durante la ventana activa."
      ),
      h2("Perfiles que suelen generar referidos exitosos"),
      ul([
        "Fotógrafos con agenda de fines de semana que conocen colegas en otras disciplinas o ciudades.",
        "Organizadores de torneos o carreras con red de clubes y productoras.",
        "Laboratorios que atienden estudios escolares y deportivos.",
        "Coordinadores institucionales que interactúan con varias escuelas del mismo distrito.",
        "Clientes satisfechos que recomiendan la plataforma a su fotógrafo habitual.",
      ]),
      p(
        "En todos los casos, la recomendación funciona mejor cuando explicás con honestidad qué problema resolvió ComprameLaFoto para vos: cobro ordenado, entrega sin WhatsApp, galerías para eventos masivos o preventa escolar. Esa claridad ayuda a que el referido active su cuenta y publique, que es cuando el programa empieza a generar valor para todos."
      ),
      h2("Recomendaciones responsables al compartir tu enlace"),
      p(
        "El programa premia conexiones reales, no spam masivo. Compartí tu link donde tenga sentido: con un colega que cubre el torneo del fin de semana, con el organizador que te convocó el año pasado o con la escuela que busca una forma más ordenada de vender a las familias."
      ),
      p(
        "Evitá prometer montos que no controlás: las comisiones dependen de las ventas del referido y del fee vigente en cada transacción. Lo que sí podés transmitir con seguridad es que una recomendación bien hecha puede acompañar a alguien durante meses de actividad comercial sin que vos tengas que operar cada venta."
      ),
      p(
        "Si sos fotógrafo y ya usás la plataforma, tu experiencia concreta —cómo publicás después de una maratón, cómo cobrás con Mercado Pago, cómo organizás una preventa escolar— es el mejor argumento. Si sos organizador o cliente, contá por qué te resultó simple comprar o coordinar fotógrafos desde un solo link de evento."
      ),
      p(
        "Cada perfil aporta algo distinto a la red: un laboratorio conoce decenas de estudios, un club deportivo cruza fotógrafos y escuelas, una familia puede recomendar al fotógrafo del acto escolar. El Programa de Referidos está diseñado para que esas conversaciones cotidianas tengan un retorno cuando la persona recomendada empieza a vender en serio."
      ),
      h2("El programa en el contexto del negocio fotográfico argentino"),
      p(
        "En Argentina, muchos fotógrafos y organizadores todavía coordinan ventas por mensajes, transferencias y carpetas compartidas. ComprameLaFoto centraliza cobro, entrega y galerías para eventos deportivos, escolares y sociales. Recomendar esa solución no es empujar un producto abstracto: es ofrecer una herramienta que ya resuelve problemas concretos en el mercado local."
      ),
      p(
        "Por eso el Programa de Referidos encaja con la forma en que ya trabaja la industria: boca a boca entre colegas, presentaciones en clubes, charlas en escuelas y contactos de laboratorios. La plataforma formaliza esa dinámica y agrega una recompensa cuando la recomendación se traduce en ventas reales."
      ),
    ],
    faq: [
      {
        q: "¿Quién puede participar del Programa de Referidos?",
        a: "Cualquier persona: fotógrafos, organizadores, escuelas, clientes, laboratorios, familiares o usuarios de la plataforma. No hace falta ser fotógrafo ni organizador para tener un enlace de referidos.",
      },
      {
        q: "¿Cuánto tiempo generan comisiones las recomendaciones?",
        a: "Las recomendaciones de fotógrafos y organizadores de eventos pueden generar comisiones durante 12 meses desde el registro del referido. Las condiciones exactas se consultan en el panel de referidos y en la documentación vigente del programa.",
      },
      {
        q: "¿Ya puedo referir escuelas y recibir comisiones?",
        a: "Las herramientas para escuelas están en desarrollo y las recomendaciones de instituciones educativas podrán generar comisiones bajo una modalidad similar en una etapa próxima. Mientras tanto, podés recomendar fotógrafos y organizadores activos.",
      },
      {
        q: "¿Necesito vender fotos yo mismo para recomendar la plataforma?",
        a: "No. Podés participar solo como referidor si conocés fotógrafos, organizadores o escuelas que se beneficiarían de ComprameLaFoto. Tu ingreso proviene de las comisiones por la actividad que generen tus referidos, no de cubrir eventos.",
      },
      {
        q: "¿Dónde veo mis comisiones acumuladas?",
        a: "En tu cuenta de ComprameLaFoto, en la sección de referidos. Ahí encontrás tu enlace personal, el seguimiento de referidos y el saldo de comisiones según las ventas que cumplan las reglas del programa.",
      },
    ],
    conclusion:
      "El Programa de Referidos de ComprameLaFoto convierte tu red de contactos en una oportunidad concreta: recomendá fotógrafos, organizadores y —próximamente— escuelas, seguí tus comisiones desde el panel y participá del crecimiento de la comunidad fotográfica argentina.",
    ctaAudience: resolveCtaAudience(["fotografos", "organizadores", "escuelas", "clientes"]),
    imageScene:
      "Diverse group of photographers, school coordinator and event organizer networking at community fair, sharing referral link on phone, warm documentary photography",
    imageAltSubject: "Personas recomendando ComprameLaFoto en un evento comunitario",
    imageCaption:
      "Una recomendación genuina puede generar comisiones durante meses dentro del programa de referidos.",
  },
};
