import type { Phase8ArticleContent } from "@/data/blog/phase8/types";
import { h2, h3, p, pr, ul } from "@/data/blog/phase8/editorial-nodes";

export const CONVOCATORIAS_FOTOGRAFO_PHASE8: Record<string, Phase8ArticleContent> = {
  "como-conseguir-eventos-y-clientes-como-fotografo": {
    seoTitle:
      "Conseguir eventos y clientes como fotógrafo con ComprameLaFoto",
    seoDescription:
      "Configurá tu perfil para recibir convocatorias cerca de tu ubicación, evaluar oportunidades y conseguir nuevos clientes para tu negocio fotográfico en Argentina.",
    excerpt:
      "ComprameLaFoto conecta fotógrafos con organizadores mediante geolocalización y convocatorias: descubrí oportunidades cerca, evaluá si rinden y convertí coberturas en ventas online.",
    blocks: [
      p(
        "Muchos fotógrafos pasan más tiempo buscando clientes que haciendo fotografías. Llamadas, mensajes, presupuestos, reuniones y publicaciones en redes consumen horas que podrías dedicar a producir o a editar. ComprameLaFoto no reemplaza tu trabajo comercial, pero simplifica una parte clave del proceso: permitir que organizadores y fotógrafos se encuentren dentro de una misma plataforma, con herramientas para convocar cobertura, inscribirse a eventos y vender las fotos después del encuentro."
      ),
      p(
        "Gracias al sistema de geolocalización y a las convocatorias de eventos colaborativos, podés descubrir oportunidades cerca de tu zona y los organizadores pueden encontrar profesionales disponibles para cubrir torneos, actos escolares, carreras, festivales o eventos corporativos. La plataforma no es solo un canal de venta: también es una vía para ampliar tu red, sumar fechas al calendario y construir relaciones con clubes, escuelas y productoras que repiten año tras año."
      ),
      pr(
        { type: "text", text: "Si todavía no tenés cuenta, el primer paso es " },
        {
          type: "link",
          text: "registrarte como fotógrafo en ComprameLaFoto",
          href: "/blog/como-registrarte-en-compramelafoto",
        },
        { type: "text", text: ". Si querés entender el panorama general de la herramienta, leé también " },
        {
          type: "link",
          text: "qué es ComprameLaFoto",
          href: "/blog/que-es-compramelafoto",
        },
        { type: "text", text: "." }
      ),
      h2("¿Qué tipo de oportunidades puedo recibir?"),
      p(
        "Las convocatorias no se limitan a un solo rubro. Cualquier organizador registrado puede crear un evento colaborativo, definir ubicación y fecha, y buscar fotógrafos para cubrirlo. En la práctica, las oportunidades suelen aparecer en contextos muy variados:"
      ),
      ul([
        "Torneos deportivos, maratones, running y pruebas de calle.",
        "Hockey, rugby, fútbol, patín, natación y otras disciplinas con mucho público en cancha o tribuna.",
        "Automovilismo y eventos con movimiento en pista.",
        "Escuelas, actos escolares, entregas de diplomas y viajes educativos.",
        "Eventos corporativos, ferias, congresos y conferencias.",
        "Festivales, recitales, eventos culturales y municipales.",
        "Eventos privados, organizaciones sin fines de lucro y clubes deportivos.",
      ]),
      p(
        "El tipo de evento queda registrado en la ficha —deportivo, escolar, corporativo, recital, festival, entre otros— para que puedas filtrar mentalmente si encaja con tu experiencia y tu equipo. No necesitás ser especialista en todos: conviene priorizar los formatos donde ya tenés flujo de edición, precios probados y buena tasa de compra."
      ),
      pr(
        { type: "text", text: "Para ver cómo un organizador arma la convocatoria desde su lado, podés consultar " },
        {
          type: "link",
          text: "cómo crear tu primer evento",
          href: "/blog/como-crear-tu-primer-evento",
        },
        { type: "text", text: " y " },
        {
          type: "link",
          text: "cómo convocar fotógrafos",
          href: "/blog/como-convocar-fotografos",
        },
        { type: "text", text: ". Entender ese proceso te ayuda a responder mejor cuando te llega una invitación." }
      ),
      h2("Cómo configurar tu perfil para recibir convocatorias"),
      p(
        "La geolocalización funciona sobre los datos de tu perfil de fotógrafo. Si tu ubicación o tu radio de cobertura no están bien cargados, el sistema no puede proponerte eventos cercanos ni incluirte en las notificaciones automáticas. Configurar el perfil no es un trámite: es lo que determina si vas a enterarte de las oportunidades relevantes."
      ),
      h3("Datos que conviene tener siempre actualizados"),
      ul([
        "Nombre y datos de contacto visibles para el organizador.",
        "Correo electrónico activo: ahí llegan las invitaciones a eventos cercanos.",
        "Ubicación principal (coordenadas o ciudad) en tu configuración de fotógrafo.",
        "Radio de cobertura laboral: podés elegir distancias como 5, 10, 25, 50, 100 o 250 km, o marcar «sin límite» si estás dispuesto a viajar sin tope.",
        "Perfil completo y cuenta activa, con Mercado Pago conectado si vas a vender después del evento.",
      ]),
      p(
        "Cuanto más precisa sea tu ubicación y el radio que elijas, más útil será el listado de eventos cerca de vos. Si dejás el radio muy chico, verás pocas convocatorias; si lo ampliás demasiado sin criterio, recibirás propuestas lejanas que quizá no te convienen. La configuración ideal suele ser honesta: la distancia máxima a la que realmente irías un fin de semana por un evento pagado en potencial ventas."
      ),
      p(
        "Revisá tu perfil cada vez que te mudás de zona o cuando cambiás tu disponibilidad para viajar. Un fotógrafo que actualizó su ciudad pero no su mapa puede quedar fuera de búsquedas que sí le servirían."
      ),
      h2("Cómo funciona el sistema de geolocalización"),
      p(
        "El flujo es más simple de lo que parece. Un organizador crea un evento colaborativo en ComprameLaFoto, carga título, tipo, fecha de inicio —y, si corresponde, fecha de finalización—, define el lugar con coordenadas o al menos la ciudad, y puede indicar la cantidad estimada de asistentes, el cupo de fotógrafos, condiciones comerciales y el modo de convocatoria (abierta, con aprobación o solo por invitación)."
      ),
      p(
        "Cuando el evento es público y está listo para convocar, la plataforma puede identificar fotógrafos cercanos comparando la ubicación del evento con la de cada perfil y el radio de cobertura configurado. Si vos estás dentro de ese radio —o compartís ciudad cuando no hay coordenadas precisas— podés aparecer en el listado de eventos cercanos y recibir una notificación por correo y en tu panel."
      ),
      h3("Ejemplo práctico"),
      p(
        "Imaginá un torneo de hockey en un predio a 18 km de tu estudio. Configuraste un radio de 25 km. El organizador publica el evento con geolocalización correcta y convocatoria abierta. Entrás a la sección de eventos del fotógrafo, ves el torneo en «cerca de mi ubicación», leés condiciones y cupo, y te inscribís desde el link del evento. Tras la jornada, subís las fotos a tu álbum vinculado y compartís la venta con el link unificado del encuentro."
      ),
      pr(
        { type: "text", text: "El modelo completo de eventos colaborativos —landing única, varios fotógrafos, venta centralizada— está explicado en " },
        {
          type: "link",
          text: "cómo funcionan los eventos colaborativos",
          href: "/blog/como-funcionan-eventos-colaborativos",
        },
        { type: "text", text: "." }
      ),
      h2("¿Cómo me entero de que hay una oportunidad cerca mío?"),
      p(
        "Hay varios canales complementarios. No dependés de un solo aviso: conviene revisarlos todos durante la temporada alta."
      ),
      ul([
        "Correo electrónico: en eventos públicos, la plataforma puede enviarte invitación con título, fecha, lugar, cupo y link para inscribirte.",
        "Notificaciones en el panel del fotógrafo: tipo invitación a evento, con acceso directo al detalle.",
        "Listado de eventos cercanos: en tu espacio de fotógrafo podés ver encuentros activos filtrados por distancia según tu radio.",
        "Invitación directa: si el organizador elige convocatoria solo por invitación, recibirás el acceso al link privado o no listado del evento.",
        "Solicitud con aprobación: en algunos eventos debés postularte y el organizador aprueba antes de que quedes activo.",
      ]),
      h3("Qué información suele ver el fotógrafo antes de decidir"),
      ul([
        "Nombre y descripción del evento.",
        "Fecha y horario de inicio (y cierre estimado si el organizador lo cargó).",
        "Lugar, ciudad y referencia del predio.",
        "Organizador y tipo de evento.",
        "Cantidad estimada de asistentes, cuando el organizador la informó.",
        "Cupo máximo de fotógrafos, si existe.",
        "Condiciones comerciales: precios orientativos, reglas de venta digital o comisión del organizador, según lo configurado.",
        "Instrucciones de acreditación o notas para ingresar al predio.",
      ]),
      p(
        "Leé esa información completa antes de confirmar asistencia. Inscribirte es un compromiso operativo para el organizador y para otros colegas que planifican cupos y accesos."
      ),
      h2("Cómo analizar si una convocatoria realmente vale la pena"),
      p(
        "No todos los eventos tienen el mismo potencial comercial. Aceptar por impulso —«algo es algo»— puede dejarte un fin de semana cargado de edición y gastos de viaje con ventas flojas. Antes de confirmar, conviene hacer un análisis rápido pero honesto."
      ),
      h3("Cantidad de participantes"),
      p(
        "Un evento con cincuenta personas no se comporta igual que uno con mil. Más participantes suele significar más compradores potenciales, más variedad de rostros en la galería y más margen para packs. Eso no garantiza ventas —depende del público y de tu cobertura— pero cambia el techo razonable. Si el organizador cargó asistentes estimados, usalo como primera señal."
      ),
      h3("Duración del evento"),
      ul([
        "Encuentro de dos horas: menos material, menos cansancio, a veces menos ingreso total.",
        "Media jornada o jornada completa: más fotos, más edición, más tiempo de acreditación y desplazamiento.",
        "Varios días: evaluá si el pago potencial compensa hotel, comidas y desgaste de equipo.",
      ]),
      h3("Distancia y horario"),
      p(
        "Sumá combustible, peajes, estacionamiento y horas de viaje. Un evento lejano a las tres de la mañana puede pagar mal aunque tenga muchos corredores si llegás exhausto y publicás tarde. Los horarios laborales incómodos también afectan tu ritmo de edición al día siguiente."
      ),
      h3("Tipo de público"),
      p(
        "No todos compran igual. El deporte amateur con familia en tribuna suele convertir distinto a un congreso corporativo. La escuela puede rendir muy bien en preventa y packs familiares; un festival masivo puede necesitar búsqueda por selfie y publicación ultrarrápida. Contrastá con tu historial: repetí formatos donde ya mediste conversión."
      ),
      pr(
        { type: "text", text: "Para estrategias de venta post-evento, revisá " },
        {
          type: "link",
          text: "cómo vender más fotografías de eventos",
          href: "/blog/como-vender-mas-fotografias-eventos",
        },
        { type: "text", text: " y " },
        {
          type: "link",
          text: "cómo vender fotografías deportivas online",
          href: "/blog/como-vender-fotografias-deportivas-online",
        },
        { type: "text", text: "." }
      ),
      h2("Comprender las comisiones del organizador"),
      p(
        "En eventos colaborativos, el organizador puede configurar una comisión sobre las ventas como reconocimiento por convocar público, gestionar acreditaciones y promocionar el link de fotos. Esa comisión se informa en las condiciones del evento antes de que te inscribas: no es un cargo sorpresa al final del fin de semana."
      ),
      p(
        "La comisión del organizador se distribuye dentro del esquema de precios y fees del checkout; no siempre implica un extra visible aparte para el comprador final, pero sí reduce el neto que queda para el fotógrafo respecto de un evento propio sin organizador. Por eso debés leer la ficha comercial antes de aceptar."
      ),
      p(
        "Que exista comisión no vuelve automáticamente malo un evento. Muchas veces un torneo bien promocionado por un club —con miles de familias enteradas del link— factura más que una cobertura solitaria sin difusión, aunque compartas un porcentaje con quien coordinó. La pregunta no es «¿hay comisión?», sino «¿el volumen y la difusión compensan mi neto?»."
      ),
      pr(
        { type: "text", text: "El detalle del modelo está en " },
        {
          type: "link",
          text: "cómo funcionan las comisiones de organizadores",
          href: "/blog/como-funcionan-comisiones-organizadores",
        },
        { type: "text", text: " y en " },
        {
          type: "link",
          text: "cómo generar ingresos con comisiones si sos organizador",
          href: "/blog/como-generar-ingresos-comisiones-organizadores",
        },
        { type: "text", text: " (útil para entender la lógica del otro lado de la mesa)." }
      ),
      h2("Cómo calcular rápidamente si un evento puede ser rentable"),
      p(
        "No hace falta una planilla compleja para la primera decisión. Respondé estas preguntas en cinco minutos:"
      ),
      ul([
        "¿Cuántos participantes o espectadores habrá?",
        "¿Cuántas horas estaré en el predio y cuántas editando después?",
        "¿Cuántos kilómetros y cuánto tiempo de viaje sumo?",
        "¿Cuál es mi precio promedio por foto digital y cuántas ventas realistas espero?",
        "¿Hay comisión del organizador y cuál es el porcentaje?",
        "¿Ya cubrí algo similar y sé cuánto vendí a las 48 horas?",
        "¿El público de este rubro suele comprar o solo mirar?",
      ]),
      h3("Ejemplo numérico simple"),
      p(
        "Suponé un torneo con quinientos jugadores y familias en tribuna. Estimás vender quince fotos digitales a $8.000 cada una ($120.000 bruto de venta). El organizador retiene el 10 % acordado sobre la venta ($12.000). Te quedan $108.000 antes de fees de plataforma y Mercado Pago. Si el viaje y dos comidas te consumen $15.000 y dedicás seis horas de cobertura más cuatro de edición, podés comparar ese resultado con otro fin de semana libre. No es una promesa de ingreso: es aritmética para decidir si aceptás."
      ),
      p(
        "Si el mismo evento estuviera a trescientos kilómetros, repetí el cálculo con peajes, combustible y una noche de hotel. A veces el mismo porcentaje de ventas deja de cerrar aunque el cartel sea atractivo."
      ),
      h2("Cómo postularse y conseguir más oportunidades"),
      ul([
        "Revisá con regularidad eventos cercanos y notificaciones del panel.",
        "Mantené ubicación, radio y email actualizados.",
        "Respondé rápido cuando te interesa una convocatoria con cupo limitado.",
        "Cumplí horarios de publicación acordados: quien entrega tarde pierde ventas y reputación.",
        "Tratá al organizador con claridad profesional: condiciones, accesos, imprevistos.",
        "Entregá un servicio ordenado el día del evento y una galería prolija después.",
      ]),
      p(
        "Tu perfil público en el marketplace o directorio de fotógrafos también ayuda a que clientes y organizadores te encuentren fuera de la geolocalización automática. Completar especialidad, ciudad y página pública suma visibilidad cuando alguien busca «fotógrafo deportivo en…» sin evento creado todavía."
      ),
      pr(
        { type: "text", text: "Para aparecer en el directorio y optimizar tu ficha, consultá " },
        {
          type: "link",
          text: "cómo funciona el marketplace de fotógrafos",
          href: "/blog/como-funciona-marketplace-fotografos",
        },
        { type: "text", text: "." }
      ),
      h2("Cómo convertir una cobertura en ingresos reales"),
      p(
        "Conseguir el evento es la mitad del camino. La otra mitad es vender bien después. En ComprameLaFoto definís tus precios, subís las fotografías a un álbum vinculado al evento, compartís el link y los clientes compran online con Mercado Pago. La entrega digital puede automatizarse; no tenés que enviar archivo por archivo por mensaje privado."
      ),
      ul([
        "Configurás venta digital e impresiones según lo que ofrezcas en ese álbum.",
        "Publicás con rapidez mientras el interés del público está alto.",
        "Aprovechás packs, descuentos por cantidad o búsqueda por selfie cuando el evento lo permita.",
        "Conciliás cobros en tu cuenta según los plazos habituales del medio de pago.",
      ]),
      pr(
        { type: "text", text: "Si necesitás repasar el flujo de venta, leé " },
        {
          type: "link",
          text: "cómo vender fotos digitales",
          href: "/blog/como-vender-fotos-digitales",
        },
        { type: "text", text: ", " },
        {
          type: "link",
          text: "cómo publicar una galería",
          href: "/blog/como-publicar-una-galeria",
        },
        { type: "text", text: " y " },
        {
          type: "link",
          text: "vendé tus fotos sin pagar suscripción mensual",
          href: "/blog/vende-fotos-sin-suscripcion-mensual",
        },
        { type: "text", text: " para entender el modelo de costos de la plataforma." }
      ),
      h3("Palabras clave y posicionamiento"),
      p(
        "Este artículo apunta a fotógrafos que buscan en Google o en redes respuestas como: cómo conseguir clientes fotografía, convocatorias fotógrafos Argentina, eventos cerca fotógrafo, trabajar cubriendo eventos deportivos, vender fotos después del torneo, plataforma para fotógrafos y organizadores, geolocalización fotógrafos ComprameLaFoto. La idea no es repetir eslogans vacíos, sino que encuentres una guía accionable alineada con lo que la herramienta realmente ofrece hoy."
      ),
    ],
    faq: [
      {
        q: "¿Necesito pagar para recibir convocatorias de eventos?",
        a: "Crear tu cuenta de fotógrafo y configurar tu perfil no implica un abono mensual fijo por recibir avisos. ComprameLaFoto cobra comisión cuando vendés fotografías, según la configuración vigente de tu cuenta.",
      },
      {
        q: "¿Cómo configuro el radio de cobertura?",
        a: "En la configuración de tu perfil de fotógrafo podés elegir un radio en kilómetros (por ejemplo 25 o 50 km) o marcar sin límite. Ese valor define qué tan lejos del evento podés aparecer en búsquedas de cercanía.",
      },
      {
        q: "¿Qué pasa si no cargo mi ubicación?",
        a: "Sin ubicación en el perfil, el listado de eventos cercanos no puede filtrarte correctamente y es posible que no recibas invitaciones automáticas por proximidad. Conviene completar ciudad o coordenadas.",
      },
      {
        q: "¿Cómo me llegan las invitaciones?",
        a: "En eventos públicos, la plataforma puede enviarte correo electrónico y una notificación en tu panel cuando hay un encuentro cerca que aún no te notificó. También podés descubrir eventos en la sección de eventos del fotógrafo.",
      },
      {
        q: "¿Todos los eventos son de convocatoria abierta?",
        a: "No. El organizador puede elegir convocatoria abierta, con aprobación previa o solo por invitación. En invitación directa necesitás el link o la invitación del organizador.",
      },
      {
        q: "¿Puedo ver la comisión del organizador antes de inscribirme?",
        a: "Sí. Las condiciones comerciales del evento —incluida la comisión del organizador cuando está activa— deben revisarse en la ficha del evento antes de confirmar tu participación.",
      },
      {
        q: "¿Qué es la cantidad estimada de asistentes?",
        a: "Es un dato opcional que el organizador carga para indicar si el evento es chico o multitudinario. Te ayuda a evaluar potencial de venta, aunque no garantiza resultados.",
      },
      {
        q: "¿Puedo rechazar o cancelar una convocatoria aceptada?",
        a: "Podés desinscribirte según las reglas del evento. Inscribirte implica compromiso de asistencia; si no podés ir, avisá con anticipación para no afectar al organizador ni a otros fotógrafos.",
      },
      {
        q: "¿Solo recibo oportunidades deportivas?",
        a: "No. Los organizadores crean eventos de muchos tipos: escolares, corporativos, culturales, recitales, festivales y más. Tu radio y tu perfil determinan cuáles ves cerca.",
      },
      {
        q: "¿ComprameLaFoto me consigue clientes sin que yo venda fotos?",
        a: "La plataforma conecta y facilita convocatorias y venta online, pero tu resultado depende de la calidad de tu cobertura, precios, velocidad de publicación y comunicación. No sustituye tu criterio comercial.",
      },
      {
        q: "¿Cómo me ayuda el marketplace además de las convocatorias?",
        a: "El directorio de fotógrafos permite que organizadores y clientes te descubran por especialidad y zona, incluso cuando no hay un evento geolocalizado activo en ese momento.",
      },
      {
        q: "¿Debo conectar Mercado Pago para participar en eventos?",
        a: "Para cobrar ventas de fotografías después del evento necesitás Mercado Pago conectado en tu cuenta de fotógrafo. Sin eso, no podrás monetizar la cobertura dentro de la plataforma.",
      },
    ],
    conclusion:
      "ComprameLaFoto no es solamente una plataforma para vender fotografías: también es una herramienta para descubrir convocatorias, evaluar oportunidades con criterio y ampliar tu red profesional. Configurá bien tu ubicación y tu radio de cobertura, leé las condiciones de cada evento —incluidas las comisiones del organizador— y transformá las coberturas en ingresos reales con venta online automatizada. Si todavía no configuraste tu perfil, completá tu cuenta en ComprameLaFoto, definí tu zona de trabajo y empezá a revisar las oportunidades que aparecen cerca de vos.",
    ctaAudience: "fotografos",
    imageScene:
      "Professional photographer at desk reviewing event invitation on laptop, DSLR camera and paper calendar on wooden table, natural window light, documentary realistic photography, horizontal 16:9, no readable screen text, strategic planning mood",
    imageAltSubject:
      "Fotógrafo profesional analizando una convocatoria de evento en su notebook",
    imageCaption:
      "Evaluar fecha, lugar, público y condiciones antes de aceptar una cobertura es parte del negocio fotográfico.",
  },
};
