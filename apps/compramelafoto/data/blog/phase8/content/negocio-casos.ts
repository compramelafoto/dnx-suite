import type { Phase8ArticleContent } from "@/data/blog/phase8/types";
import { resolveCtaAudience } from "@/data/blog/phase8/cta";
import { h2, h3, p, ul } from "@/data/blog/phase8/editorial-nodes";
import { CLF_KNOWLEDGE } from "@/data/blog/phase8/knowledge";

export const NEGOCIO_CASOS_PHASE8: Record<string, Phase8ArticleContent> = {
  "como-generar-ingresos-pasivos-recomendando-compramelafoto": {
    seoTitle: "Cómo generar ingresos pasivos recomendando ComprameLaFoto",
    seoDescription:
      "Programa de referidos: link único, 50% del fee durante 12 meses, ejemplos de ganancias y cómo compartirlo sin spam.",
    excerpt:
      "Introducción al programa de referidos como fuente de ingresos recurrentes para quien recomienda fotógrafos.",
    blocks: [
      p(
        "Recomendar una herramienta que otros fotógrafos usan de verdad puede convertirse en ingreso recurrente si existe un programa de referidos bien diseñado. En ComprameLaFoto, cualquier usuario — fotógrafo, organizador, laboratorio o cliente — puede obtener un link de referido y ganar comisiones cuando un fotógrafo referido vende en la plataforma. Esta guía explica cómo funciona, qué significa «pasivo» en este contexto y cómo evitar errores que anulan comisiones.",
      ),
      h2("Qué significa ingreso pasivo en referidos"),
      p(
        "Ingreso pasivo aquí no es dinero sin trabajo previo: es dinero que sigue llegando mientras el fotógrafo referido vende, sin que rehagas la venta en cada pedido. Tu trabajo inicial es recomendar con criterio, ayudar al referido a arrancar y mantener tu cuenta en regla (Mercado Pago conectado). Después, cada venta del referido durante doce meses puede generar comisión automática.",
      ),
      p(
        "La comisión es el 50% del fee de marketplace, durante 12 meses desde el alta del fotógrafo referido. Solo generan comisión los fotógrafos referidos que venden; referir organizadores o clientes que no operan como fotógrafos vendedores no produce ese ingreso.",
      ),
      h2("Perfil ideal de referidor"),
      ul([
        "Fotógrafos con red de colegas que recién empiezan a vender online.",
        "Organizadores de eventos que conocen varios fotógrafos de su circuito.",
        "Laboratorios o proveedores del rubro con contacto diario con estudios.",
        "Clientes satisfechos con amplia red en clubes, escuelas o running.",
        "Quien ya usa ComprameLaFoto y puede mostrar resultados reales.",
      ]),
      p(
        "El mejor referidor no es el que spamea links: es quien entiende el dolor del fotógrafo (WhatsApp saturado, cobros desordenados) y conecta la herramienta con una solución concreta.",
      ),
      h2("Cómo empezar"),
      h3("Si sos fotógrafo"),
      p(
        "Ingresá a Configuración → Referidos con Mercado Pago conectado. Generá o copiá tu link único. Sin MP conectado al momento de las ventas de tu referido, las comisiones no se acumulan ni se pagan retroactivamente.",
      ),
      h3("Si sos organizador, laboratorio o cliente"),
      p(
        "Podés solicitar tu link a soporte de ComprameLaFoto. Una vez activo, funciona igual para atribuir fotógrafos que se registren con tu código.",
      ),
      h2("Dónde compartir tu link"),
      ul([
        "Grupos de fotógrafos en WhatsApp o Telegram con contexto, no solo el link.",
        "Charlas, talleres o congresos del rubro con QR en diapositivas.",
        "Instagram o LinkedIn contando tu experiencia, no copiando texto genérico.",
        "Email directo a colegas que sabés que cubren eventos compatibles.",
        "Después de un evento exitoso, cuando el organizador pregunta cómo vendiste.",
      ]),
      p(
        "Siempre usá tu URL con el parámetro de referido intacto. Acortadores opacos que pierden el código anulan la atribución.",
      ),
      h2("Métricas a seguir"),
      ul([
        "Cantidad de fotógrafos referidos activos (que subieron y vendieron).",
        "Ventas del referido por mes y fee efectivo de plataforma.",
        "Tu comisión acumulada en Configuración → Referidos.",
        "Tasa de registro→primera venta del referido (indica si ayudaste bien al inicio).",
        "Tiempo restante de ventana de 12 meses por referido.",
      ]),
      h2("Ejemplos ilustrativos de ganancias"),
      p(
        "Los montos dependen del fee vigente en cada venta. Ejemplos simplificados en pesos argentinos, solo ilustrativos:",
      ),
      ul([
        "Venta de $10.000 con fee de plataforma de $500 → tu comisión: $250.",
        "Si ese fotógrafo vende $200.000 en un mes con fee efectivo total de $8.000 → tu comisión del mes: $4.000.",
        "Cinco fotógrafos referidos con ventas similares multiplican ese flujo sin multiplicar tu tiempo de edición.",
      ]),
      p(
        "El ingreso es pasivo respecto a cada venta individual, pero escalar referidos de calidad sigue requiriendo relaciones y seguimiento inicial.",
      ),
      h2("Artículo relacionado: guía completa de referidos"),
      p(
        "Para el detalle de cobros, devoluciones, auto-referidos prohibidos y solicitud de pago, consultá la guía destacada de referidos en el blog. Este artículo es la puerta de entrada; aquella es el manual operativo.",
      ),
      p(
        "Evitá prometer ingresos garantizados a quien referís: el programa premia ventas reales del fotógrafo referido, no el registro vacío. Tu reputación mejora si ayudás al referido a configurar su primer álbum y Mercado Pago antes de la primera fecha grande.",
      ),
      p(
        "Organizadores con buena red pueden referir varios fotógrafos del mismo circuito sin conflicto si cada uno cubre eventos distintos. El error es referir competidores directos en el mismo nicho sin transparencia; eso erosiona confianza en todos lados.",
      ),
      p(
        "Revisá tu saldo con periodicidad mensual y anotá qué canal de difusión trajo referidos que efectivamente vendieron. Así optimizás esfuerzo: charlas y contactos directos suelen superar posts genéricos sin contexto.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Sin métrica, no sabés si mejoraste.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro.",
      ),
      p(
        "El programa de referidos de ComprameLaFoto paga el 50% del fee de marketplace durante 12 meses desde el alta del fotógrafo referido, siempre que tengas Mercado Pago conectado al momento de sus ventas. Ese detalle operativo es crítico: sin MP vinculado, las comisiones no se acumulan ni se pagan retroactivamente cuando lo conectes después.",
      ),
      p(
        "Cualquier usuario puede referir — fotógrafo, organizador, laboratorio o cliente — pero solo generan comisión los fotógrafos referidos que efectivamente venden en la plataforma. Referir organizadores o clientes que no operan como vendedores no produce ese ingreso. Enfocá tu red en colegas que cubren eventos compatibles y están dispuestos a publicar.",
      ),
      p(
        "Ejemplo ilustrativo: una venta de $10.000 con fee de plataforma de $500 deja $250 de comisión para el referidor. Si ese fotógrafo vende $200.000 en un mes con fee efectivo total de $8.000, tu comisión del mes sería $4.000 sin rehacer la venta en cada pedido. Cinco fotógrafos referidos activos con ventas similares multiplican ese flujo sin multiplicar tu tiempo de edición.",
      ),
      p(
        "Compartí tu link en contexto, no en spam: grupos de colegas con una explicación honesta de por qué te ahorró WhatsApp, charlas del rubro con QR en diapositivas, email directo a fotógrafos que sabés que cubren torneos o escuelas. Acortadores que pierden el parámetro de referido anulan la atribución.",
      ),
      p(
        "Evitá prometer ingresos garantizados: el programa premia ventas reales, no registros vacíos. Tu reputación mejora si ayudás al referido a configurar su primer álbum y Mercado Pago antes de la primera fecha grande. El ingreso es «pasivo» respecto a cada venta individual, pero escalar referidos de calidad sigue requiriendo relaciones y seguimiento inicial.",
      ),
      p(
        "Revisá saldo en Configuración → Referidos con periodicidad mensual y anotá qué canal trajo referidos que efectivamente vendieron. Charlas y contactos directos suelen superar posts genéricos sin contexto. Solicitá cobro cuando alcanzás el mínimo según el proceso vigente.",
      ),
      p(
        "Auto-referidos y cuentas duplicadas están prohibidos y pueden bloquear tu código. Leé la guía completa de referidos del blog para devoluciones, solicitud de pago y casos borde; este artículo es la puerta de entrada operativa.",
      ),
      p(
        "Si sos organizador o laboratorio sin cuenta de fotógrafo vendedor, podés solicitar tu link a soporte. Una vez activo, funciona igual para atribuir fotógrafos que se registren con tu código, siempre que cumplan las condiciones del programa.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "El programa de referidos de ComprameLaFoto paga el 50% del fee de marketplace durante 12 meses desde el alta del fotógrafo referido, siempre que tengas Mercado Pago conectado al momento de sus ventas. Ese detalle operativo es crítico: sin MP vinculado, las comisiones no se acumulan ni se pagan retroactivamente cuando lo conectes después.",
      ),
      p(
        "Cualquier usuario puede referir — fotógrafo, organizador, laboratorio o cliente — pero solo generan comisión los fotógrafos referidos que efectivamente venden en la plataforma. Referir organizadores o clientes que no operan como vendedores no produce ese ingreso. Enfocá tu red en colegas que cubren eventos compatibles y están dispuestos a publicar.",
      ),
      p(
        "Ejemplo ilustrativo: una venta de $10.000 con fee de plataforma de $500 deja $250 de comisión para el referidor. Si ese fotógrafo vende $200.000 en un mes con fee efectivo total de $8.000, tu comisión del mes sería $4.000 sin rehacer la venta en cada pedido. Cinco fotógrafos referidos activos con ventas similares multiplican ese flujo sin multiplicar tu tiempo de edición.",
      ),
      p(
        "Compartí tu link en contexto, no en spam: grupos de colegas con una explicación honesta de por qué te ahorró WhatsApp, charlas del rubro con QR en diapositivas, email directo a fotógrafos que sabés que cubren torneos o escuelas. Acortadores que pierden el parámetro de referido anulan la atribución.",
      ),
      p(
        "Evitá prometer ingresos garantizados: el programa premia ventas reales, no registros vacíos. Tu reputación mejora si ayudás al referido a configurar su primer álbum y Mercado Pago antes de la primera fecha grande. El ingreso es «pasivo» respecto a cada venta individual, pero escalar referidos de calidad sigue requiriendo relaciones y seguimiento inicial.",
      ),
    ],
    faq: [
      {
        q: "¿Puedo referirme a mí mismo?",
        a: "No. Auto-referidos y cuentas duplicadas están prohibidos y pueden bloquear el código.",
      },
      {
        q: "¿El referido paga menos?",
        a: "No necesariamente. El beneficio del referido es usar la plataforma; las condiciones comerciales del vendedor son las estándar.",
      },
      {
        q: "¿Cómo cobro?",
        a: "Desde Configuración → Referidos, cuando alcanzás el mínimo, solicitás cobro por Mercado Pago o transferencia según el proceso vigente.",
      },
      {
        q: "¿Cuántos referidos necesito para que valga la pena?",
        a: "Un solo fotógrafo activo con ventas recurrentes ya puede generar comisiones útiles. La clave es calidad y volumen del referido, no cantidad de registros sin ventas.",
      },
    ],
    conclusion:
      "Generar ingresos recomendando ComprameLaFoto es realista si referís fotógrafos que efectivamente van a vender, mantenés Mercado Pago conectado y compartís tu link con criterio. No es magia ni spam: es monetizar confianza profesional. Durante doce meses por cada fotógrafo referido, el 50% del fee de marketplace de sus ventas puede convertirse en un flujo complementario a tu propio trabajo de shooting.",
    ctaAudience: "fotografos",
    imageScene:
      "Photographer networking at industry meetup, sharing business cards and phone screen casually",
    imageAltSubject:
      "Fotógrafo compartiendo su link de referidos en un encuentro del rubro",
  },

  "como-vender-mas-fotografias-eventos": {
    seoTitle: "Cómo vender más fotografías de eventos",
    seoDescription:
      "Estrategias comerciales y operativas para aumentar ventas en maratones, torneos, fiestas y eventos sociales en Argentina.",
    excerpt:
      "Estrategias comerciales y operativas para aumentar ventas en maratones, torneos y fiestas.",
    blocks: [
      p(
        "Vender más en eventos no es solo «sacar mejores fotos». Es la combinación de cobertura útil, precio claro, publicación rápida y comunicación en el momento correcto. Si el participante te encuentra tarde, paga mal o no entiende el valor, la mejor imagen del día no se convierte en venta. Esta guía ordena palancas que podés mover en la próxima fecha del calendario.",
      ),
      h2("Cobertura y calidad"),
      p(
        "Cubrí puntos donde el participante realmente quiere verse: meta, podio, llegada con emoción, grupos de amigos, momentos de acción legibles. En fiestas, priorizá entradas, pista y momentos de grupo. Calidad no es solo nitidez: es reconocibilidad rápida.",
      ),
      ul([
        "Más cobertura en zonas de alto tráfico emocional que en rincones vacíos.",
        "Exposición consistente para no perder horas corrigiendo en post.",
        "Backup de tarjetas y baterías: perder tomas es perder ventas irrecuperables.",
      ]),
      p(
        "Antes del evento, caminá el circuito o el salón con ojo comercial: no solo fotográfico. En una maratón, un punto con fondo limpio y luz pareja puede rendir más que tres ubicaciones caóticas. En un torneo, acordá con el organizador qué canchas tienen más público familiar. En egresados, identificá momentos de pico emocional — ingreso, coreografía central, cotillón — y asegurá presencia ahí. La cobertura inteligente reduce archivos inútiles y acelera la publicación.",
      ),
      p(
        "La calidad percibida también incluye consistencia entre fotógrafos si trabajás en equipo. Brief unificado de estilo, hora de entrega de tarjetas y nomenclatura de carpetas evita que un álbum parezca armado por cuatro estudios distintos. Eso impacta directamente en la confianza del comprador y en la probabilidad de pack completo.",
      ),
      h2("Pricing y packs"),
      p(
        "Un precio unitario alto sin packs frena compras múltiples. Un precio demasiado bajo erosiona margen en eventos costosos de cubrir. Probá packs por cantidad (3, 5, 10 fotos) y ofertas de ventana corta post-evento.",
      ),
      ul([
        "Pack «todas mis fotos del evento» para egresados y fiestas.",
        "Descuento por compra en las primeras 48 horas.",
        "Precio diferenciado digital vs impresión si ofrecés ambos.",
      ]),
      p(
        "Testeá precios en eventos comparables antes de subir demasiado el ticket. Un error común es copiar el precio de una maratón de diez mil corredores en un torneo de trescientos familiares. Llevá registro de conversión por evento y ajustá en la siguiente fecha. Los packs deben ser fáciles de entender en el celular: nombres claros («Pack podio», «Pack fiesta completa») superan jerga interna del estudio.",
      ),
      p(
        "Considerá el costo total de tu presencia en el evento — traslado, peaje, ayudantes, edición — al fijar mínimos. Vender más no siempre es vender barato; a veces es vender al precio correcto con menos fricción. Un pack bien diseñado sube ticket promedio sin que el cliente sienta presión agresiva.",
      ),
      h2("Comunicación post-evento"),
      p(
        "El organizador es tu amplificador: pedí mención en redes, mailing o cartel con QR al álbum. En deporte, avisá en la fan page del torneo apenas publiques. Mensaje claro: cómo encontrarse (selfie, dorsal, navegación) y cómo pagar.",
      ),
      p(
        "Armá un kit de comunicación reutilizable: texto corto para Instagram del organizador, asunto de email sugerido, imagen con QR y horario estimado de publicación. Cuanto menos dependa del organizador improvisar, más probable es que el mensaje salga en el momento correcto. Coordiná también con cronograma de premiación o cierre del torneo: publicar cuando el público aún está en el predio multiplica visitas iniciales.",
      ),
      p(
        "En eventos sociales, los grupos de WhatsApp de participantes son canales válidos si el admin permite un mensaje único con link oficial. Evitá spam en diez grupos distintos sin permiso: quema confianza. Mejor un mensaje bien puesto en el grupo principal del evento o de la promoción.",
      ),
      h2("Selfie y búsqueda rápida"),
      p(
        "En eventos masivos, cada minuto sin búsqueda fácil es abandono. Si la plataforma ofrece búsqueda por selfie, promocionalo en todos los touchpoints. Entrená al público antes del evento cuando el organizador lo permita.",
      ),
      p(
        "Hacé prueba de selfie con personas de distintas edades y tonos de piel antes del evento masivo para validar resultados razonables. Comunicá instrucciones simples: foto frontal, sin anteojos de sol, buena luz. En torneos con dorsal visible, combiná ambos métodos en la FAQ del álbum para cubrir más casos sin soporte manual.",
      ),
      p(
        "Si el evento no es masivo, la navegación por carpetas hora/cancha puede alcanzar; no fuerces selfie donde el volumen no lo justifica. La herramienta correcta depende del tamaño del público comprador potencial, no del hype tecnológico.",
      ),
      h2("Urgencia y plazos"),
      p(
        "La urgencia ética funciona: «álbum disponible por tiempo limitado» concentra compras. Plazos muy largos diluyen la decisión. Comunicá fecha de cierre con antelación y un recordatorio 24 horas antes.",
      ),
      p(
        "Plazos distintos por tipo de evento: maratón y egresados premian ventanas de veinticuatro a setenta y dos horas; escuela puede extenderse dos semanas con recordatorios. Lo importante es que el plazo sea creíble y se cumpla. Extender el cierre cada semana sin aviso erosiona confianza.",
      ),
      p(
        "Ofertas de cierre pueden ser descuento moderado o bonus (una foto extra en pack) en lugar de solo amenaza de borrado. El cliente debe sentir beneficio real, no presión artificial. Documentá qué oferta funcionó mejor para repetirla.",
      ),
      h2("Medición de resultados"),
      ul([
        "Visitas al álbum vs órdenes (conversión).",
        "Ingreso por participante potencial (asistentes estimados).",
        "Tiempo desde fin del evento hasta primera venta.",
        "Ticket promedio y mix pack vs unidad.",
        "Reclamos o consultas de soporte por cada 100 ventas.",
      ]),
      p(
        "Después de cada evento, anotá qué funcionó. La temporada siguiente mejora por datos, no por intuición sola.",
      ),
      p(
        "Creá una planilla simple por fecha: asistentes estimados, visitas al álbum, órdenes, ingreso bruto, horas de edición y horas de soporte. En tres o cuatro eventos vas a ver patrones claros — por ejemplo, que el recordatorio del organizador duplica visitas o que un pack de diez fotos convierte mejor que descuento lineal del veinte por ciento.",
      ),
      p(
        "Compartí resultados agregados con organizadores que repiten: demostrar ventas y satisfacción facilita renovar contrato y mejorar ubicación en el próximo evento. El dato convence más que promesas genéricas de «cobertura profesional».",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Sin métrica, no sabés si mejoraste.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro.",
      ),
      p(
        "La cobertura inteligente reduce archivos inútiles y acelera publicación. En maratón, un punto con fondo limpio y luz pareja puede rendir más que tres ubicaciones caóticas. En torneo, acordá con el organizador qué canchas tienen más público familiar. En egresados, identificá momentos de pico emocional — ingreso, coreografía central, cotillón — y asegurá presencia ahí.",
      ),
      p(
        "Testeá precios en eventos comparables antes de subir demasiado el ticket. Un error común es copiar el precio de una maratón de diez mil corredores en un torneo de trescientos familiares. Llevá registro de conversión por evento. Los packs deben entenderse en el celular: nombres claros («Pack podio», «Pack fiesta completa») superan jerga interna del estudio.",
      ),
      p(
        "Armá kit de comunicación reutilizable: texto para Instagram del organizador, asunto de email sugerido, imagen con QR y horario estimado de publicación. Coordiná con cronograma de premiación: publicar cuando el público aún está en el predio multiplica visitas iniciales.",
      ),
      p(
        "En eventos sociales, un mensaje único en el grupo principal del evento — con permiso del admin — supera spam en diez grupos distintos. La confianza del organizador es activo comercial.",
      ),
      p(
        "Hacé prueba de selfie con personas de distintas edades y tonos de piel antes del evento masivo. Comunicá instrucciones simples: foto frontal, sin anteojos de sol, buena luz. En torneos con dorsal visible, combiná ambos métodos en la FAQ del álbum.",
      ),
      p(
        "Plazos distintos por tipo de evento: maratón y egresados premian ventanas de 24 a 72 horas; escuela puede extenderse dos semanas con recordatorios. Extender el cierre cada semana sin aviso erosiona confianza.",
      ),
      p(
        "Creá planilla por fecha: asistentes estimados, visitas, órdenes, ingreso bruto, horas de edición y soporte. En tres o cuatro eventos verás patrones — por ejemplo, que el recordatorio del organizador duplica visitas o que un pack de diez fotos convierte mejor que descuento lineal del veinte por ciento.",
      ),
      p(
        "Compartí resultados agregados con organizadores que repiten: demostrar ventas y satisfacción facilita renovar contrato y mejorar ubicación. El dato convence más que promesas genéricas de cobertura profesional.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
    ],
    faq: [
      {
        q: "¿Publicar más fotos siempre vende más?",
        a: "No si el comprador no puede encontrarse. Priorizá descubrimiento y calidad útil sobre volumen bruto sin curar.",
      },
      {
        q: "¿Debo regalar una foto para enganchar?",
        a: "Podés regalar una muestra con watermark o una promoción limitada, pero evitá entregar altas sin pago: devalúa el resto.",
      },
      {
        q: "¿Cuánto tardo en publicar?",
        a: "Idealmente el mismo día en deporte y egresados. Cada día de demora reduce conversión de forma medible.",
      },
      {
        q: "¿Conviene bajar precio si no vendo?",
        a: "Antes de bajar, revisá difusión, plazo y facilidad de búsqueda. A veces el problema es visibilidad, no precio.",
      },
    ],
    conclusion:
      "Vender más fotografías en eventos es un problema de operación comercial tanto como de técnica fotográfica. Cobertura útil, packs inteligentes, publicación rápida, búsqueda fácil y comunicación con el organizador forman un sistema. Medí cada fecha, ajustá precios y repetí lo que escala. La plataforma ordena el checkout; tu estrategia define el volumen.",
    ctaAudience: "fotografos",
    imageScene:
      "Photographer selling photos at outdoor festival booth, customers browsing on tablet",
    imageAltSubject:
      "Fotógrafo vendiendo fotos en un stand de festival al aire libre",
  },

  "como-aumentar-ventas-fotografias-escolares": {
    seoTitle: "Cómo aumentar las ventas de fotografías escolares",
    seoDescription:
      "Tácticas para mejorar conversión en colegios: preventa, comunicación con padres, bundles familiares y calendario escolar.",
    excerpt:
      "Tácticas para mejorar conversión en colegios: preventa, comunicación con padres y bundles.",
    blocks: [
      p(
        "La fotografía escolar tiene ventanas cortas, decisores múltiples (padres, institución) y sensibilidad alta en privacidad y precio. Vender más no es presionar: es alinear calendario, oferta y comunicación para que comprar sea simple y oportuno. Esta guía recorre tácticas probadas en el rubro.",
      ),
      h2("Calendario escolar"),
      p(
        "Coordiná con dirección y preceptores fechas de shooting, entrega de muestras y cierre de venta sin choques con exámenes o viajes. Un calendario compartido evita sorpresas que comprimen la ventana.",
      ),
      ul([
        "Inicio de año: foto individual y grupal.",
        "Egresados: sesiones y evento de fiesta por separado.",
        "Actos: ventana corta post-acto con comunicación institucional.",
      ]),
      h2("Preventa efectiva"),
      p(
        "La preventa escolar concentra pedidos antes del shooting o con compromiso temprano. Ofrecé incentivo claro (precio, pack extra o prioridad de entrega) y plazos simples. Menos «lo pienso» en el aula significa más conversión.",
      ),
      h2("Bundles familiares"),
      p(
        "Paquetes hermanos, combo individual + grupal + credencial, o digital + impresión para abuelos. El bundle debe sentirse como ahorro real, no como truco para subir ticket sin valor.",
      ),
      h2("Comunicación institucional"),
      p(
        "Un mail o nota de la escuela pesa más que diez stories tuyos. Pedí que la institución comunique fechas, link y beneficios de preventa. Respetá tono institucional y normas de imagen de menores.",
      ),
      h2("Recordatorios"),
      p(
        "Secuencia breve: apertura, mitad de plazo, último día. Tres toques suelen bastar. Incluí FAQ: cómo pagar, cómo recibir digitales, plazos de impresión.",
      ),
      h2("Post-mortem por colegio"),
      ul([
        "Tasa de compra por curso y por nivel.",
        "Mix preventa vs venta post-shooting.",
        "Consultas repetidas (señal de fricción en la web).",
        "Devoluciones o cambios de pedido.",
        "Feedback del coordinador escolar para el año siguiente.",
      ]),
      p(
        "Compará colegios con perfil socioeconómico similar: si uno compra el doble, investigá si la diferencia fue comunicación institucional, precio o timing. A veces un recordatorio de dirección vale más que un descuento agresivo.",
      ),
      p(
        "Documentá plantillas de mail y FAQ que funcionaron para reutilizar el ciclo siguiente. La fotografía escolar es repetible; quien sistematiza comunicación gana margen sin subir precios.",
      ),
      p(
        "Involucrá a preceptores solo si el colegio lo autoriza: un aviso en el grupo de padres del curso en el momento correcto puede duplicar visitas al álbum en cuarenta y ocho horas.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Sin métrica, no sabés si mejoraste.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro.",
      ),
      p(
        "Ofrecé ejemplos visuales de packs en la reunión con dirección: padres compran más cuando entienden tamaños de impresión y qué incluye cada opción digital. Evitá listas de precios con siglas internas del laboratorio.",
      ),
      p(
        "Segmentá recordatorios por curso si el colegio lo permite: un mail genérico pierde atención. Personalización mínima —«familias de 3º A»— aumenta apertura.",
      ),
      p(
        "Prepará respuestas tipo para objeciones frecuentes: «es caro», «saco foto con el celular», «no tengo Mercado Pago». Cada objeción tiene contraargumento operativo sin pelear.",
      ),
      p(
        "Negociá con dirección ventana sin competencia de otros fotógrafos el mismo mes si es posible. Dos links distintos confunden a padres y devalúan ambos.",
      ),
      p(
        "Después del cierre, enviá resumen al coordinador con tasa de compra. Eso vende la renovación del contrato anual mejor que regalar sesiones extra.",
      ),
      p(
        "Usá preventa para financiar impresión si tu flujo lo requiere, pero comunicá plazos de entrega física con margen real. Incumplir en papel destruye confianza más que retraso en digital.",
      ),
      p(
        "Incluí opción económica digital-only sin parecer «plan pobre»: mismo respeto en copy para todos los packs.",
      ),
      p(
        "Revisá en mobile cómo se ve el álbum: la mayoría de madres compra desde el teléfono entre actividades.",
      ),
      p(
        "Coordiná con dirección fechas de shooting, entrega de muestras y cierre sin choques con exámenes o viajes. Un calendario compartido evita sorpresas que comprimen la ventana de compra a tres días imposibles para padres trabajadores.",
      ),
      p(
        "La preventa concentra pedidos antes del shooting o con compromiso temprano. Ofrecé incentivo claro — precio, pack extra o prioridad de entrega — y plazos simples. Menos «lo pienso» en el aula significa más conversión y mejor planificación de impresión.",
      ),
      p(
        "Un mail o nota de la escuela pesa más que diez stories tuyos. Pedí que la institución comunique fechas, link y beneficios de preventa con tono institucional y respeto a normas de imagen de menores.",
      ),
      p(
        "Secuencia breve de recordatorios: apertura, mitad de plazo, último día. Tres toques suelen bastar. Incluí FAQ: cómo pagar con Mercado Pago, cómo recibir digitales, plazos de impresión.",
      ),
      p(
        "Compará colegios con perfil socioeconómico similar: si uno compra el doble, investigá si la diferencia fue comunicación institucional, precio o timing. A veces un recordatorio de dirección vale más que un descuento agresivo.",
      ),
      p(
        "Ofrecé ejemplos visuales de packs en reunión con dirección: padres compran más cuando entienden tamaños de impresión y qué incluye cada opción digital. Evitá listas con siglas internas del laboratorio.",
      ),
      p(
        "Revisá en mobile cómo se ve el álbum: la mayoría de madres compra desde el teléfono entre actividades. Si el checkout tiene fricción, el problema no es la calidad del retrato.",
      ),
      p(
        "Negociá ventana sin competencia de otros fotógrafos el mismo mes si es posible. Dos links distintos confunden a padres y devalúan ambos. Después del cierre, enviá resumen al coordinador con tasa de compra: eso vende la renovación anual.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Coordiná con dirección fechas de shooting, entrega de muestras y cierre sin choques con exámenes o viajes. Un calendario compartido evita sorpresas que comprimen la ventana de compra a tres días imposibles para padres trabajadores.",
      ),
      p(
        "La preventa concentra pedidos antes del shooting o con compromiso temprano. Ofrecé incentivo claro — precio, pack extra o prioridad de entrega — y plazos simples. Menos «lo pienso» en el aula significa más conversión y mejor planificación de impresión.",
      ),
      p(
        "Un mail o nota de la escuela pesa más que diez stories tuyos. Pedí que la institución comunique fechas, link y beneficios de preventa con tono institucional y respeto a normas de imagen de menores.",
      ),
      p(
        "Secuencia breve de recordatorios: apertura, mitad de plazo, último día. Tres toques suelen bastar. Incluí FAQ: cómo pagar con Mercado Pago, cómo recibir digitales, plazos de impresión.",
      ),
      p(
        "Compará colegios con perfil socioeconómico similar: si uno compra el doble, investigá si la diferencia fue comunicación institucional, precio o timing. A veces un recordatorio de dirección vale más que un descuento agresivo.",
      ),
      p(
        "Ofrecé ejemplos visuales de packs en reunión con dirección: padres compran más cuando entienden tamaños de impresión y qué incluye cada opción digital. Evitá listas con siglas internas del laboratorio.",
      ),
      p(
        "Revisá en mobile cómo se ve el álbum: la mayoría de madres compra desde el teléfono entre actividades. Si el checkout tiene fricción, el problema no es la calidad del retrato.",
      ),
      p(
        "Negociá ventana sin competencia de otros fotógrafos el mismo mes si es posible. Dos links distintos confunden a padres y devalúan ambos. Después del cierre, enviá resumen al coordinador con tasa de compra: eso vende la renovación anual.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
    ],
    faq: [
      {
        q: "¿Cómo manejo privacidad?",
        a: "Seguí políticas del colegio, permisos firmados y configuración de álbumes que limite visibilidad según lo acordado.",
      },
      {
        q: "¿Preventa sin ver la foto funciona?",
        a: "Sí si hay confianza con el estudio y el incentivo es claro. Comunicá qué incluye exactamente el pack.",
      },
      {
        q: "¿Qué pasa si un curso compra poco?",
        a: "Analizá precio, comunicación y competencia con celulares de padres. A veces el problema es timing, no calidad.",
      },
      {
        q: "¿Conviene ofrecer cuotas en preventa?",
        a: "Depende del acuerdo con el colegio y tu flujo de cobro. Si Mercado Pago ofrece cuotas en checkout, comunicarlo puede subir conversión en familias sensibles al precio.",
      },
    ],
    conclusion:
      "Aumentar ventas escolares es disciplina de calendario y comunicación tanto como de shooting. Preventa, bundles familiares, respaldo institucional y recordatorios ordenados convierten un día de fotos en un proyecto comercial predecible. Medí por colegio y mejorá el playbook cada ciclo lectivo.",
    ctaAudience: "escuelas",
    imageScene:
      "School photographer presenting sales plan to school coordinator in principal office",
    imageAltSubject:
      "Fotógrafo escolar presentando plan de ventas en dirección de colegio",
  },

  "como-vender-fotografias-deportivas-online": {
    seoTitle: "Cómo vender fotografías deportivas online",
    seoDescription:
      "Guía de negocio para running, ciclismo y deportes de equipo vendiendo online en Argentina con publicación rápida y búsqueda fácil.",
    excerpt:
      "Guía de negocio para running, ciclismo y deportes de equipo vendiendo online en Argentina.",
    blocks: [
      p(
        "El deporte online premia velocidad: el atleta quiere la foto del podio hoy, no la semana próxima. Vender fotografías deportivas en internet combina cobertura técnica, publicación inmediata, descubrimiento por dorsal o selfie y alianzas con organizadores. Esta guía está orientada al mercado argentino y a operaciones recurrentes de fin de semana.",
      ),
      h2("Nichos deportivos"),
      ul([
        "Running y trail: alto volumen, búsqueda por selfie crítica.",
        "Ciclismo: velocidad y puntos fijos en ruta.",
        "Deportes de equipo: torneos juveniles y federados, múltiples canchas.",
        "Artes marciales y crossfit: comunidades muy activas en redes.",
      ]),
      p(
        "Especializar un nicho te permite precios, packs y marketing repetibles.",
      ),
      h2("Publicar rápido después del evento"),
      p(
        "Definí flujo de ingestión: tarjetas, backup, selección mínima, export con watermark, subida. Objetivo: mismo día en carreras grandes. Cada hora de retraso regala ventas a competidores o al olvido del atleta.",
      ),
      h2("Dorsal y selfie"),
      p(
        "Donde haya dorsal visible, ayuda en soporte y SEO del álbum. Donde no, la búsqueda por selfie es palanca principal. Comunicá ambos métodos en cartelería y redes del evento.",
      ),
      h2("Pricing en deporte"),
      p(
        "Ticket unitario moderado con packs por cantidad suele superar precio alto por foto suelta. Oferta de «todas mis fotos de la carrera» funciona en trail y OCR. En torneos, pack por partido o por día.",
      ),
      h2("Alianzas con organizadores"),
      p(
        "Propuesta clara de valor: cobertura profesional, comisión o beneficio para el club, facilidad para participantes. Eventos colaborativos en plataforma alinean incentivos sin pelear por el link de venta.",
      ),
      h2("Fidelización"),
      p(
        "Base de datos con consentimiento, descuento en próxima carrera del circuito, código para compañeros de equipo. El costo de adquisición en deporte baja cuando el corredor te reconoce temporada tras temporada.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Sin métrica, no sabés si mejoraste.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro.",
      ),
      p(
        "Especializar un nicho — running, ciclismo, hockey, artes marciales — te permite precios, packs y marketing repetibles. El deporte online premia velocidad: el atleta quiere la foto del podio hoy, no la semana próxima.",
      ),
      p(
        "Definí flujo de ingestión: tarjetas, backup, selección mínima, export con watermark, subida. Objetivo: mismo día en carreras grandes. Cada hora de retraso regala ventas a competidores o al olvido del atleta.",
      ),
      p(
        "Donde haya dorsal visible, ayuda en soporte y en la navegación del álbum. Donde no, la búsqueda por selfie es palanca principal. Comunicá ambos métodos en cartelería y redes del evento antes de la largada.",
      ),
      p(
        "Ticket unitario moderado con packs por cantidad suele superar precio alto por foto suelta. Oferta «todas mis fotos de la carrera» funciona en trail y OCR. En torneos, pack por partido o por día.",
      ),
      p(
        "Propuesta clara al organizador: cobertura profesional, comisión o beneficio para el club, facilidad para participantes. Eventos colaborativos alinean incentivos sin pelear por el link de venta.",
      ),
      p(
        "Base de datos con consentimiento, descuento en próxima carrera del circuito, código para compañeros de equipo. El costo de adquisición baja cuando el corredor te reconoce temporada tras temporada.",
      ),
      p(
        "No compitas solo en precio cero con fotos de espectadores: importan calidad, ángulo profesional, publicación rápida y facilidad de pago. En eventos grandes, un solo operador deja huecos de cobertura que son ventas perdidas.",
      ),
      p(
        "Integrar Mercado Pago al checkout reduce abandono en audiencia argentina. Dirigí al cliente al link oficial; cobros por fuera rompen trazabilidad y automatización de entrega.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Especializar un nicho — running, ciclismo, hockey, artes marciales — te permite precios, packs y marketing repetibles. El deporte online premia velocidad: el atleta quiere la foto del podio hoy, no la semana próxima.",
      ),
      p(
        "Definí flujo de ingestión: tarjetas, backup, selección mínima, export con watermark, subida. Objetivo: mismo día en carreras grandes. Cada hora de retraso regala ventas a competidores o al olvido del atleta.",
      ),
      p(
        "Donde haya dorsal visible, ayuda en soporte y en la navegación del álbum. Donde no, la búsqueda por selfie es palanca principal. Comunicá ambos métodos en cartelería y redes del evento antes de la largada.",
      ),
      p(
        "Ticket unitario moderado con packs por cantidad suele superar precio alto por foto suelta. Oferta «todas mis fotos de la carrera» funciona en trail y OCR. En torneos, pack por partido o por día.",
      ),
      p(
        "Propuesta clara al organizador: cobertura profesional, comisión o beneficio para el club, facilidad para participantes. Eventos colaborativos alinean incentivos sin pelear por el link de venta.",
      ),
      p(
        "Base de datos con consentimiento, descuento en próxima carrera del circuito, código para compañeros de equipo. El costo de adquisición baja cuando el corredor te reconoce temporada tras temporada.",
      ),
      p(
        "No compitas solo en precio cero con fotos de espectadores: importan calidad, ángulo profesional, publicación rápida y facilidad de pago. En eventos grandes, un solo operador deja huecos de cobertura que son ventas perdidas.",
      ),
      p(
        "Integrar Mercado Pago al checkout reduce abandono en audiencia argentina. Dirigí al cliente al link oficial; cobros por fuera rompen trazabilidad y automatización de entrega.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Especializar un nicho — running, ciclismo, hockey, artes marciales — te permite precios, packs y marketing repetibles. El deporte online premia velocidad: el atleta quiere la foto del podio hoy, no la semana próxima.",
      ),
      p(
        "Definí flujo de ingestión: tarjetas, backup, selección mínima, export con watermark, subida. Objetivo: mismo día en carreras grandes. Cada hora de retraso regala ventas a competidores o al olvido del atleta.",
      ),
      p(
        "Donde haya dorsal visible, ayuda en soporte y en la navegación del álbum. Donde no, la búsqueda por selfie es palanca principal. Comunicá ambos métodos en cartelería y redes del evento antes de la largada.",
      ),
      p(
        "Ticket unitario moderado con packs por cantidad suele superar precio alto por foto suelta. Oferta «todas mis fotos de la carrera» funciona en trail y OCR. En torneos, pack por partido o por día.",
      ),
      p(
        "Propuesta clara al organizador: cobertura profesional, comisión o beneficio para el club, facilidad para participantes. Eventos colaborativos alinean incentivos sin pelear por el link de venta.",
      ),
      p(
        "Base de datos con consentimiento, descuento en próxima carrera del circuito, código para compañeros de equipo. El costo de adquisición baja cuando el corredor te reconoce temporada tras temporada.",
      ),
      p(
        "No compitas solo en precio cero con fotos de espectadores: importan calidad, ángulo profesional, publicación rápida y facilidad de pago. En eventos grandes, un solo operador deja huecos de cobertura que son ventas perdidas.",
      ),
    ],
    faq: [
      {
        q: "¿Compito con fotos gratis de espectadores?",
        a: "Sí, por eso importan calidad, ángulo profesional, publicación rápida y facilidad de pago. No compitas solo en precio cero.",
      },
      {
        q: "¿Necesito varios fotógrafos?",
        a: "En eventos grandes, sí. Un solo operador deja huecos de cobertura que son ventas perdidas.",
      },
      {
        q: "¿Mercado Pago es suficiente?",
        a: "Para audiencia argentina, es el estándar esperado. Integrarlo al checkout reduce abandono.",
      },
      {
        q: "¿Debo publicar en redes antes que en la plataforma?",
        a: "Las redes generan expectativa, pero la venta debe centralizarse en el link oficial. Usá Instagram para avisar que las fotos están disponibles, no para entregar previews sin watermark.",
      },
    ],
    conclusion:
      "Vender fotografía deportiva online es carrera contra el reloj y contra la fricción. Nicho claro, publicación el mismo día, búsqueda por selfie o dorsal, packs razonables y alianzas con organizadores forman la base. Optimizá cada fin de semana con datos y construí circuito de clientes que te buscan por nombre en la próxima fecha.",
    ctaAudience: "fotografos",
    imageScene:
      "Sports photographer editing marathon shots trackside on laptop immediately after race",
    imageAltSubject:
      "Fotógrafo deportivo editando fotos de maratón junto a la pista",
  },

  "como-automatizar-entrega-fotografias": {
    seoTitle: "Cómo automatizar la entrega de fotografías",
    seoDescription:
      "Reducí trabajo manual con entrega digital automática, notificaciones y flujos integrados en ComprameLaFoto.",
    excerpt:
      "Reducí trabajo manual con entrega digital automática, notificaciones y flujos en ComprameLaFoto.",
    blocks: [
      p(
        "Cada minuto enviando archivos por WhatsApp es un minuto que no editás, no vendés en otro evento ni descansás. Automatizar la entrega no es lujo: es el límite entre un hobby rentable y un negocio escalable. Esta guía describe cómo armar el flujo con entrega digital automática tras el pago.",
      ),
      h2("Entrega digital automática"),
      p(
        "Configurá tus productos digitales para que, al confirmarse el pago, el comprador reciba acceso a descarga sin intervención tuya. Eso implica naming consistente de archivos, uploads completos antes de abrir ventas y prueba de compra de prueba.",
      ),
      ul([
        "Checklist pre-apertura: álbum completo, precios, packs, MP conectado.",
        "Compra test con monto bajo o modo prueba si está disponible.",
        "Verificar descarga en móvil, no solo en desktop.",
      ]),
      h2("Emails transaccionales"),
      p(
        "El cliente debe recibir confirmación clara: qué compró, cómo descargar, hasta cuándo tiene acceso si aplica plazo. Menos «¿me lo reenviás?» en tu bandeja.",
      ),
      h2("Menos WhatsApp manual"),
      p(
        "Usá WhatsApp para avisar que el álbum está listo con link a la tienda, no para ser servidor de archivos. Plantilla: link + cómo buscarse + horario de soporte limitado.",
      ),
      h2("Integración con pagos"),
      p(
        "Con Mercado Pago integrado, el disparador de entrega es el pago aprobado. Evitá cobros por fuera «para ayudar»: rompen automatización y trazabilidad.",
      ),
      h2("Errores a evitar"),
      ul([
        "Abrir ventas con carga al 80 %: genera órdenes de fotos aún no subidas.",
        "Cambiar precios sin aviso en medio de campaña escolar.",
        "Múltiples links de carpetas paralelos a la tienda oficial.",
        "No probar flujo en Android de gama media.",
      ]),
      h2("Checklist de automatización"),
      ul([
        "Productos digitales mapeados a archivos correctos.",
        "Packs configurados sin solapamientos confusos.",
        "Texto de ayuda en el álbum (selfie, dorsal, soporte).",
        "Compra de prueba realizada.",
        "Organizador informado del link único oficial.",
      ]),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Sin métrica, no sabés si mejoraste.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro.",
      ),
      p(
        "Configurá productos digitales para que, al confirmarse el pago, el comprador reciba acceso a descarga sin intervención tuya. Eso implica naming consistente de archivos, uploads completos antes de abrir ventas y compra de prueba en móvil.",
      ),
      p(
        "Checklist pre-apertura: álbum completo, precios, packs, Mercado Pago conectado, texto de ayuda en galería (selfie, dorsal, soporte). Abrir ventas con carga al ochenta por ciento genera órdenes de fotos aún no subidas.",
      ),
      p(
        "El cliente debe recibir confirmación clara: qué compró, cómo descargar, hasta cuándo tiene acceso si aplica plazo. Menos «¿me lo reenviás?» en tu bandeja.",
      ),
      p(
        "Usá WhatsApp para avisar que el álbum está listo con link a la tienda, no para ser servidor de archivos. Plantilla: link + cómo buscarse + horario de soporte limitado.",
      ),
      p(
        "Evitá cobros por fuera «para ayudar»: rompen automatización y trazabilidad. Con Mercado Pago integrado, el disparador de entrega es el pago aprobado.",
      ),
      p(
        "Probá flujo en Android de gama media antes de cada temporada alta. Muchos compradores no tienen el último iPhone.",
      ),
      p(
        "Múltiples links de carpetas paralelos a la tienda oficial confunden y duplican soporte. Un solo canal de compra.",
      ),
      p(
        "Reservá soporte manual para casos excepcionales documentados. Revisá estado de pago en panel antes de enviar manualmente; lo manual debe ser excepción, no regla.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Configurá productos digitales para que, al confirmarse el pago, el comprador reciba acceso a descarga sin intervención tuya. Eso implica naming consistente de archivos, uploads completos antes de abrir ventas y compra de prueba en móvil.",
      ),
      p(
        "Checklist pre-apertura: álbum completo, precios, packs, Mercado Pago conectado, texto de ayuda en galería (selfie, dorsal, soporte). Abrir ventas con carga al ochenta por ciento genera órdenes de fotos aún no subidas.",
      ),
      p(
        "El cliente debe recibir confirmación clara: qué compró, cómo descargar, hasta cuándo tiene acceso si aplica plazo. Menos «¿me lo reenviás?» en tu bandeja.",
      ),
      p(
        "Usá WhatsApp para avisar que el álbum está listo con link a la tienda, no para ser servidor de archivos. Plantilla: link + cómo buscarse + horario de soporte limitado.",
      ),
      p(
        "Evitá cobros por fuera «para ayudar»: rompen automatización y trazabilidad. Con Mercado Pago integrado, el disparador de entrega es el pago aprobado.",
      ),
      p(
        "Probá flujo en Android de gama media antes de cada temporada alta. Muchos compradores no tienen el último iPhone.",
      ),
      p(
        "Múltiples links de carpetas paralelos a la tienda oficial confunden y duplican soporte. Un solo canal de compra.",
      ),
      p(
        "Reservá soporte manual para casos excepcionales documentados. Revisá estado de pago en panel antes de enviar manualmente; lo manual debe ser excepción, no regla.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Configurá productos digitales para que, al confirmarse el pago, el comprador reciba acceso a descarga sin intervención tuya. Eso implica naming consistente de archivos, uploads completos antes de abrir ventas y compra de prueba en móvil.",
      ),
      p(
        "Checklist pre-apertura: álbum completo, precios, packs, Mercado Pago conectado, texto de ayuda en galería (selfie, dorsal, soporte). Abrir ventas con carga al ochenta por ciento genera órdenes de fotos aún no subidas.",
      ),
      p(
        "El cliente debe recibir confirmación clara: qué compró, cómo descargar, hasta cuándo tiene acceso si aplica plazo. Menos «¿me lo reenviás?» en tu bandeja.",
      ),
      p(
        "Usá WhatsApp para avisar que el álbum está listo con link a la tienda, no para ser servidor de archivos. Plantilla: link + cómo buscarse + horario de soporte limitado.",
      ),
      p(
        "Evitá cobros por fuera «para ayudar»: rompen automatización y trazabilidad. Con Mercado Pago integrado, el disparador de entrega es el pago aprobado.",
      ),
      p(
        "Probá flujo en Android de gama media antes de cada temporada alta. Muchos compradores no tienen el último iPhone.",
      ),
      p(
        "Múltiples links de carpetas paralelos a la tienda oficial confunden y duplican soporte. Un solo canal de compra.",
      ),
      p(
        "Reservá soporte manual para casos excepcionales documentados. Revisá estado de pago en panel antes de enviar manualmente; lo manual debe ser excepción, no regla.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
    ],
    faq: [
      {
        q: "¿Y si el cliente no sabe descargar?",
        a: "Incluí instrucciones breves en el email y una FAQ en el álbum. Reservá soporte manual para casos excepcionales.",
      },
      {
        q: "¿Puedo automatizar impresiones?",
        a: "Depende de tu laboratorio y flujo. Las digitales son el primer salto de automatización; impresión suele llevar producción física aparte.",
      },
      {
        q: "¿Qué hago con pedidos fallidos?",
        a: "Revisá estado de pago en panel antes de enviar manualmente. Manual debe ser excepción documentada.",
      },
      {
        q: "¿Puedo seguir atendiendo consultas por WhatsApp?",
        a: "Sí para dudas puntuales, pero redirigí siempre al link de compra oficial. No envíes archivos por chat si el pago no pasó por la plataforma.",
      },
    ],
    conclusion:
      "Automatizar entrega es delegar en el sistema lo repetitivo y reservarte para lo que solo vos podés hacer: fotografiar y decidir estrategia. Entrega digital al pago, emails claros y un solo canal de compra oficial liberan horas por evento y mejoran la experiencia del cliente. Hacé la compra de prueba antes de cada temporada alta.",
    ctaAudience: "fotografos",
    imageScene:
      "Photographer relaxing while automated order confirmation emails send, studio sunset light",
    imageAltSubject:
      "Fotógrafo mientras se envían confirmaciones automáticas de pedidos",
  },

  "como-evitar-perder-ventas-por-whatsapp": {
    seoTitle: "Cómo evitar perder ventas por WhatsApp",
    seoDescription:
      "Por qué centralizar la venta en la plataforma reduce fricción, errores y ventas perdidas. Flujo recomendado y plantillas.",
    excerpt:
      "Por qué centralizar la venta en la plataforma reduce fricción, errores y ventas perdidas.",
    blocks: [
      p(
        "WhatsApp es excelente para avisar, coordinar y responder dudas puntuales. Es terrible como única caja registradora y servidor de archivos en eventos con decenas o cientos de compradores. Ahí aparecen pagos sin comprobante, fotos enviadas dos veces, clientes que abandonan porque «ya es tarde» y noches interminables de «¿me pasás la 234?». Esta guía propone un flujo que usa el chat sin dejar que se coma el margen.",
      ),
      h2("Riesgos de vender solo por chat"),
      ul([
        "Cola de mensajes: quien escribe primero compra; el resto se frustra.",
        "Sin trazabilidad de qué se pagó y qué se entregó.",
        "Reenvío de archivos y filtración de material en alta.",
        "Errores de monto, CBU o alias.",
        "Imagen poco profesional frente a competidores con checkout.",
      ]),
      h2("Pagos y comprobantes"),
      p(
        "Transferencias screenshot-by-screenshot no escalan. Integrar Mercado Pago en la plataforma vincula pago y derecho a descarga. Si alguien insiste en transferir, es excepción con plantilla de «usá el link para activar descarga automática».",
      ),
      h2("Entrega desordenada"),
      p(
        "Enviar ZIP por WhatsApp tiene límites de tamaño y calidad. El cliente pierde el hilo. Centralizá entrega en la cuenta post-compra; WhatsApp solo orienta al link.",
      ),
      h2("Profesionalismo percibido"),
      p(
        "Un link de tienda con packs y pago seguro comunica seriedad. Padres, empresas y clubes lo notan, aunque no lo digan.",
      ),
      h2("Flujo recomendado"),
      ul([
        "1. Publicás álbum en plataforma.",
        "2. Difundís un solo link oficial (organizador + tus redes).",
        "3. WhatsApp responde dudas con FAQ y redirección al link.",
        "4. Pago y descarga ocurren en la tienda.",
        "5. Soporte manual solo para casos borde documentados.",
      ]),
      h2("Plantillas de mensaje con link"),
      p(
        "«¡Las fotos ya están! Entrá a [link], buscate con selfie o navegá el álbum, elegí pack y pagá con Mercado Pago. La descarga es automática. Dudas frecuentes: [breve].»",
      ),
      p(
        "Evitá iniciar negociación de precio por chat salvo contratos B2B previos. El precio público en tienda protege margen y tiempo.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Sin métrica, no sabés si mejoraste.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro.",
      ),
      p(
        "WhatsApp es excelente para avisar y coordinar; es terrible como única caja registradora en eventos con decenas o cientos de compradores. Ahí aparecen pagos sin comprobante, fotos enviadas dos veces y clientes que abandonan porque «ya es tarde».",
      ),
      p(
        "Transferencias screenshot-by-screenshot no escalan. Integrar Mercado Pago en la plataforma vincula pago y derecho a descarga. Si alguien insiste en transferir, es excepción con plantilla que redirige al link oficial.",
      ),
      p(
        "Enviar ZIP por WhatsApp tiene límites de tamaño; el cliente pierde el hilo. Centralizá entrega en la cuenta post-compra; WhatsApp solo orienta al link.",
      ),
      p(
        "Un link de tienda con packs y pago seguro comunica seriedad. Padres, empresas y clubes lo notan aunque no lo digan.",
      ),
      p(
        "Flujo recomendado: publicás álbum, difundís un solo link oficial, WhatsApp responde dudas con FAQ y redirección, pago y descarga en tienda, soporte manual solo para casos borde.",
      ),
      p(
        "Plantilla: «¡Las fotos ya están! Entrá a [link], buscate con selfie o navegá el álbum, elegí pack y pagá con Mercado Pago. La descarga es automática.» Evitá negociar precio por chat salvo contratos B2B previos.",
      ),
      p(
        "Migrá clientes habituados al chat con primera venta en tienda e instrucciones claras. En el segundo evento ya esperan el link.",
      ),
      p(
        "MP acepta múltiples medios según configuración. Dirigí al checkout: ahí están las opciones vigentes sin que vos actúes de banco.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "WhatsApp es excelente para avisar y coordinar; es terrible como única caja registradora en eventos con decenas o cientos de compradores. Ahí aparecen pagos sin comprobante, fotos enviadas dos veces y clientes que abandonan porque «ya es tarde».",
      ),
      p(
        "Transferencias screenshot-by-screenshot no escalan. Integrar Mercado Pago en la plataforma vincula pago y derecho a descarga. Si alguien insiste en transferir, es excepción con plantilla que redirige al link oficial.",
      ),
      p(
        "Enviar ZIP por WhatsApp tiene límites de tamaño; el cliente pierde el hilo. Centralizá entrega en la cuenta post-compra; WhatsApp solo orienta al link.",
      ),
      p(
        "Un link de tienda con packs y pago seguro comunica seriedad. Padres, empresas y clubes lo notan aunque no lo digan.",
      ),
      p(
        "Flujo recomendado: publicás álbum, difundís un solo link oficial, WhatsApp responde dudas con FAQ y redirección, pago y descarga en tienda, soporte manual solo para casos borde.",
      ),
      p(
        "Plantilla: «¡Las fotos ya están! Entrá a [link], buscate con selfie o navegá el álbum, elegí pack y pagá con Mercado Pago. La descarga es automática.» Evitá negociar precio por chat salvo contratos B2B previos.",
      ),
      p(
        "Migrá clientes habituados al chat con primera venta en tienda e instrucciones claras. En el segundo evento ya esperan el link.",
      ),
      p(
        "MP acepta múltiples medios según configuración. Dirigí al checkout: ahí están las opciones vigentes sin que vos actúes de banco.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "WhatsApp es excelente para avisar y coordinar; es terrible como única caja registradora en eventos con decenas o cientos de compradores. Ahí aparecen pagos sin comprobante, fotos enviadas dos veces y clientes que abandonan porque «ya es tarde».",
      ),
      p(
        "Transferencias screenshot-by-screenshot no escalan. Integrar Mercado Pago en la plataforma vincula pago y derecho a descarga. Si alguien insiste en transferir, es excepción con plantilla que redirige al link oficial.",
      ),
      p(
        "Enviar ZIP por WhatsApp tiene límites de tamaño; el cliente pierde el hilo. Centralizá entrega en la cuenta post-compra; WhatsApp solo orienta al link.",
      ),
      p(
        "Un link de tienda con packs y pago seguro comunica seriedad. Padres, empresas y clubes lo notan aunque no lo digan.",
      ),
      p(
        "Flujo recomendado: publicás álbum, difundís un solo link oficial, WhatsApp responde dudas con FAQ y redirección, pago y descarga en tienda, soporte manual solo para casos borde.",
      ),
      p(
        "Plantilla: «¡Las fotos ya están! Entrá a [link], buscate con selfie o navegá el álbum, elegí pack y pagá con Mercado Pago. La descarga es automática.» Evitá negociar precio por chat salvo contratos B2B previos.",
      ),
      p(
        "Migrá clientes habituados al chat con primera venta en tienda e instrucciones claras. En el segundo evento ya esperan el link.",
      ),
      p(
        "MP acepta múltiples medios según configuración. Dirigí al checkout: ahí están las opciones vigentes sin que vos actúes de banco.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
    ],
    faq: [
      {
        q: "¿Y si el cliente no tiene Mercado Pago?",
        a: "MP acepta múltiples medios según configuración. Dirigí al checkout: ahí están las opciones vigentes sin que vos actúes de banco.",
      },
      {
        q: "¿Pierdo cercanía con el cliente?",
        a: "Ganás rapidez y claridad. La cercanía puede estar en el shooting y en mensajes cortos de ayuda, no en mandar archivos a mano.",
      },
      {
        q: "¿Cómo migro clientes habituados al chat?",
        a: "Primera venta con descuento en tienda + instrucciones claras. En el segundo evento ya esperan el link.",
      },
      {
        q: "¿Qué hago si un cliente insiste en transferencia?",
        a: "Explicá que el checkout integrado protege a ambos con comprobante y entrega automática. Si hacés excepciones, documentalas y no las conviertas en norma.",
      },
    ],
    conclusion:
      "WhatsApp es aliado de la comunicación, no el núcleo de tu operación comercial. Centralizar venta y entrega en la plataforma reduce ventas perdidas por demora, error humano y fricción de pago. Usá plantillas, un link oficial y soporte acotado. Recuperás horas y vendés más con el mismo número de fotos.",
    ctaAudience: "fotografos",
    imageScene:
      "Photographer overwhelmed by WhatsApp notifications while proper checkout link ready on laptop",
    imageAltSubject:
      "Fotógrafo saturado de WhatsApp con link de checkout listo en notebook",
  },

  "como-vender-fotografias-maraton": {
    seoTitle: "Cómo vender fotografías de una maratón",
    seoDescription:
      "Caso de uso: venta de fotos en maratones y carreras de running con selfie, dorsal y publicación el mismo día.",
    excerpt:
      "Caso de uso: venta de fotos en maratones y carreras de running con selfie y dorsal.",
    blocks: [
      p(
        "Una maratón concentra miles de corredores con alta intención de compra en las primeras horas post-meta. El caso de uso exitoso combina cobertura en puntos clave, publicación rápida, búsqueda por selfie y comunicación coordinada con la producción del evento. Esta guía recorre el playbook operativo.",
      ),
      h2("Contexto del evento"),
      p(
        "Carrera urbana o trail con miles de participantes, llegada escalonada, familia y amigos buscando fotos en redes el mismo día. Clima, horario y permisos de la producción definen dónde podés posicionarte.",
      ),
      h2("Desafíos habituales"),
      ul([
        "Volumen masivo de archivos en pocas horas.",
        "Corredores que abandonan si no se encuentran en minutos.",
        "Competencia con otros fotógrafos y fotos espontáneas.",
        "Conectividad y energía en campo para backup y upload.",
      ]),
      h2("Configuración recomendada en ComprameLaFoto"),
      p(
        "Álbum por carrera con fecha clara, productos digitales con packs por cantidad, búsqueda por selfie activa y comunicada, Mercado Pago conectado antes de la largada. Si hay acuerdo con producción, evento colaborativo con comisión para alinear difusión del link único.",
      ),
      h2("Estrategia de cobertura"),
      ul([
        "Meta y recta final con emoción.",
        "Km icónicos si la logística lo permite.",
        "Zona post-meta con grupos y medallas.",
        "Evitar duplicar ángulos infinitos sin valor comercial.",
      ]),
      h2("Comunicación a participantes"),
      p(
        "Cartel en kit del corredor, mención en briefing de producción, post en Instagram del evento al publicar. Mensaje: «Buscate por selfie en [link]». Horario estimado de publicación genera expectativa.",
      ),
      h2("Pricing sugerido"),
      p(
        "Precio por foto suelta accesible + pack 5–10 fotos + opción «todas mis fotos» con techo razonable. Promoción 24–48 h post-carrera. Evitá precio único alto que frena compra impulsiva post-meta.",
      ),
      h2("Métricas de éxito"),
      ul([
        "Conversión visitantes→compradores.",
        "Tiempo fin de carrera → álbum live.",
        "Ticket promedio y mix de packs.",
        "Consultas de soporte por 100 ventas.",
      ]),
      h2("Lecciones aprendidas"),
      p(
        "Quien publica primero con búsqueda fácil gana mercado ese domingo. Invertí en flujo de carga y prueba de selfie antes de la temporada. Alianza con producción vale más que un ángulo extra en km 30 sin corredores.",
      ),
      p(
        "Llevá registro por carrera: clima, demora de publicación, conversión y reclamos. Las maratones del mismo organizador se parecen; los datos de un año mejoran el pitch del siguiente.",
      ),
      p(
        "No subestimes soporte: una FAQ clara en el álbum («cómo buscarme», «cómo pago», «cuándo cierre») reduce mensajes a la mitad. Ese tiempo recuperado es edición o descanso.",
      ),
      p(
        "Si competís con otros fotógrafos en la misma carrera, diferenciá por velocidad y facilidad de pago, no solo por precio bajo. Guerra de precios destruye margen en un evento ya costoso de cubrir.",
      ),
      p(
        "Cada caso de uso mejora cuando documentás configuración de álbum, packs y comunicación que funcionó. El segundo año del mismo evento debería ser más rentable con menos horas.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión.",
      ),
      p(
        "Coordiná con organizador un único mensaje oficial con link. Links duplicados confunden y reducen conversión.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras.",
      ),
      p(
        "Carrera urbana o trail con miles de participantes, llegada escalonada, familia buscando fotos en redes el mismo día. Clima, horario y permisos de producción definen dónde posicionarte.",
      ),
      p(
        "Configurá álbum por carrera con packs por cantidad, búsqueda por selfie activa y comunicada, Mercado Pago conectado antes de la largada. Evento colaborativo con comisión alinea difusión del link único con la producción.",
      ),
      p(
        "Cobertura: meta y recta final con emoción, km icónicos si la logística lo permite, zona post-meta con grupos y medallas. Evitá duplicar ángulos infinitos sin valor comercial.",
      ),
      p(
        "Cartel en kit del corredor, mención en briefing de producción, post del evento al publicar. Mensaje: «Buscate por selfie en [link]». Horario estimado de publicación genera expectativa.",
      ),
      p(
        "Precio por foto suelta accesible + pack 5–10 fotos + opción «todas mis fotos» con techo razonable. Promoción 24–48 h post-carrera captura compra impulsiva.",
      ),
      p(
        "Quien publica primero con búsqueda fácil gana mercado ese domingo. Invertí en flujo de carga y prueba de selfie antes de la temporada.",
      ),
      p(
        "FAQ clara en el álbum reduce mensajes a la mitad: cómo buscarme, cómo pago, cuándo cierre. Si competís con otros fotógrafos, diferenciá por velocidad y facilidad de pago, no solo por precio bajo.",
      ),
      p(
        "Llevá registro por carrera: clima, demora de publicación, conversión y reclamos. Las maratones del mismo organizador se parecen; los datos de un año mejoran el pitch del siguiente.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Carrera urbana o trail con miles de participantes, llegada escalonada, familia buscando fotos en redes el mismo día. Clima, horario y permisos de producción definen dónde posicionarte.",
      ),
      p(
        "Configurá álbum por carrera con packs por cantidad, búsqueda por selfie activa y comunicada, Mercado Pago conectado antes de la largada. Evento colaborativo con comisión alinea difusión del link único con la producción.",
      ),
      p(
        "Cobertura: meta y recta final con emoción, km icónicos si la logística lo permite, zona post-meta con grupos y medallas. Evitá duplicar ángulos infinitos sin valor comercial.",
      ),
      p(
        "Cartel en kit del corredor, mención en briefing de producción, post del evento al publicar. Mensaje: «Buscate por selfie en [link]». Horario estimado de publicación genera expectativa.",
      ),
      p(
        "Precio por foto suelta accesible + pack 5–10 fotos + opción «todas mis fotos» con techo razonable. Promoción 24–48 h post-carrera captura compra impulsiva.",
      ),
      p(
        "Quien publica primero con búsqueda fácil gana mercado ese domingo. Invertí en flujo de carga y prueba de selfie antes de la temporada.",
      ),
      p(
        "FAQ clara en el álbum reduce mensajes a la mitad: cómo buscarme, cómo pago, cuándo cierre. Si competís con otros fotógrafos, diferenciá por velocidad y facilidad de pago, no solo por precio bajo.",
      ),
      p(
        "Llevá registro por carrera: clima, demora de publicación, conversión y reclamos. Las maratones del mismo organizador se parecen; los datos de un año mejoran el pitch del siguiente.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
    ],
    faq: [
      {
        q: "¿Cuántos fotógrafos necesito?",
        a: "Depende de kilómetros y puntos. Una maratón grande suele requerir equipo para meta y puntos sin huecos.",
      },
      {
        q: "¿Subo todas las fotos?",
        a: "Subí lo suficiente para cubrir a cada corredor reconocible; curación extrema puede dejar fuera compradores.",
      },
      {
        q: "¿Y si llueve?",
        a: "Protegé equipo y ajustá puntos. Comunicá demora realista si afecta publicación.",
      },
      {
        q: "¿Conviene vender packs por kilómetro?",
        a: "Los corredores suelen comprar momentos clave (meta, llegada personal). Packs por tramo funcionan si la cobertura es homogénea en esos puntos.",
      },
    ],
    conclusion:
      "Vender fotos de maratón es operación de velocidad y descubrimiento. Configurá álbum, selfie y packs antes de la largada, publicá el mismo día y apoyate en la producción para un solo link oficial. Medí conversión y afiná precios carrera por carrera.",
    ctaAudience: "fotografos",
    imageScene:
      "Marathon photographers capturing runners at km marker, city street race, realistic crowd density",
    imageAltSubject: "Fotógrafos capturando corredores en una maratón urbana",
  },

  "como-vender-fotografias-torneo-deportivo": {
    seoTitle: "Cómo vender fotografías de un torneo deportivo",
    seoDescription:
      "Caso de uso: torneos de fútbol, hockey o básquet con múltiples canchas, categorías y venta online organizada.",
    excerpt:
      "Caso de uso: torneos de fútbol, hockey o básquet con múltiples canchas y categorías.",
    blocks: [
      p(
        "Un torneo juvenil o federado multiplica canchas, horarios y categorías. Sin estructura, el padre no encuentra el partido de su hijo y no compra. Este caso de uso muestra cómo organizar cobertura, álbumes y comunicación para fin de semana completo.",
      ),
      h2("Contexto del evento"),
      p(
        "Varias canchas en club o complejo, categorías por edad, partidos simultáneos y público principalmente familiar. Duración de uno a tres días.",
      ),
      h2("Desafíos habituales"),
      ul([
        "Identificar jugadores sin dorsal legible en todas las tomas.",
        "Organizar miles de fotos por cancha y horario.",
        "Evitar links distintos por cancha que confundan.",
        "Coordinar varios fotógrafos freelance.",
      ]),
      h2("Configuración recomendada en ComprameLaFoto"),
      p(
        "Estructura de álbumes por categoría o por cancha-día, packs por partido o por día, evento colaborativo con club si aplica comisión, checkout con Mercado Pago. Naming de carpetas coherente antes de subir.",
      ),
      h2("Estrategia de cobertura"),
      ul([
        "Asignar fotógrafo por cancha en horarios pico.",
        "Priorizar momentos de gol, festejo y retrato grupal post-partido.",
        "Brief común de estilo y exposición entre operadores.",
      ]),
      h2("Comunicación a participantes"),
      p(
        "El club envía mail único con link y explicación: elegir categoría, buscar por número o navegar galería del partido. Cartel en secretaría del torneo con QR.",
      ),
      h2("Pricing sugerido"),
      p(
        "Pack partido (3–5 fotos) + pack torneo completo con descuento. Precio familiar si hay hermanos en categorías distintas mediante bundle manual o pack amplio.",
      ),
      h2("Métricas de éxito"),
      ul([
        "Ventas por categoría y por cancha.",
        "Porcentaje de consultas «no encuentro a mi hijo».",
        "Tiempo de publicación fin de jornada.",
      ]),
      h2("Lecciones aprendidas"),
      p(
        "La estructura del álbum importa más que una foto espectacular en cancha equivocada. Acordá con el club un solo canal oficial y cerrá ventas con plazo claro para concentrar compras.",
      ),
      p(
        "Cada caso de uso mejora cuando documentás configuración de álbum, packs y comunicación que funcionó. El segundo año del mismo evento debería ser más rentable con menos horas.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión.",
      ),
      p(
        "Coordiná con organizador un único mensaje oficial con link. Links duplicados confunden y reducen conversión.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras.",
      ),
      p(
        "Asigná nombres de carpeta antes del torneo: categoría, cancha, horario. Editar nombres después con mil archivos es error costoso.",
      ),
      p(
        "Brief a fotógrafos sobre no bloquear jugadas con flash si el club lo prohíbe; mejor perder una toma que un contrato.",
      ),
      p(
        "Ofrecé al club reporte simple post-torneo: ventas totales y satisfacción. Datos cierran renovación.",
      ),
      p(
        "En torneos de dos días, comunicá si el álbum se actualiza por jornada para que familias vuelvan a comprar.",
      ),
      p(
        "Pack hermanos en distintas categorías simplifica compra familiar con un solo checkout cuando sea posible.",
      ),
      p(
        "Cartel físico en secretaría con QR sigue funcionando en público menos digital.",
      ),
      p(
        "Evitá abrir ventas antes de tener al menos la jornada del sábado completa si prometiste fin de día.",
      ),
      p(
        "Medí consultas «no encuentro a mi hijo»: si superan el diez por ciento de visitas, mejorá estructura antes que bajar precio.",
      ),
      p(
        "Varias canchas, categorías por edad, partidos simultáneos y público familiar. Sin estructura, el padre no encuentra el partido de su hijo y no compra.",
      ),
      p(
        "Álbumes por categoría o cancha-día, packs por partido o por día, evento colaborativo con club si aplica comisión. Naming de carpetas coherente antes de subir.",
      ),
      p(
        "Asigná fotógrafo por cancha en horarios pico. Priorizá gol, festejo y retrato grupal post-partido. Brief común de estilo entre operadores.",
      ),
      p(
        "Mail único del club con link: elegir categoría, buscar por número o navegar galería del partido. QR en secretaría del torneo.",
      ),
      p(
        "Pack partido (3–5 fotos) + pack torneo completo con descuento. Pack familiar si hay hermanos en categorías distintas.",
      ),
      p(
        "La estructura del álbum importa más que una foto espectacular en cancha equivocada. Acordá un solo canal oficial con el club.",
      ),
      p(
        "En torneos de dos días, comunicá si el álbum se actualiza por jornada para que familias vuelvan a comprar.",
      ),
      p(
        "Medí consultas «no encuentro a mi hijo»: si superan el diez por ciento de visitas, mejorá estructura antes que bajar precio.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Varias canchas, categorías por edad, partidos simultáneos y público familiar. Sin estructura, el padre no encuentra el partido de su hijo y no compra.",
      ),
      p(
        "Álbumes por categoría o cancha-día, packs por partido o por día, evento colaborativo con club si aplica comisión. Naming de carpetas coherente antes de subir.",
      ),
      p(
        "Asigná fotógrafo por cancha en horarios pico. Priorizá gol, festejo y retrato grupal post-partido. Brief común de estilo entre operadores.",
      ),
      p(
        "Mail único del club con link: elegir categoría, buscar por número o navegar galería del partido. QR en secretaría del torneo.",
      ),
      p(
        "Pack partido (3–5 fotos) + pack torneo completo con descuento. Pack familiar si hay hermanos en categorías distintas.",
      ),
      p(
        "La estructura del álbum importa más que una foto espectacular en cancha equivocada. Acordá un solo canal oficial con el club.",
      ),
      p(
        "En torneos de dos días, comunicá si el álbum se actualiza por jornada para que familias vuelvan a comprar.",
      ),
      p(
        "Medí consultas «no encuentro a mi hijo»: si superan el diez por ciento de visitas, mejorá estructura antes que bajar precio.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
    ],
    faq: [
      {
        q: "¿Separo por equipo o por cancha?",
        a: "Por cómo busca el padre: categoría/edad suele ser más intuitivo que cancha 4.",
      },
      {
        q: "¿Vendo en el club con QR?",
        a: "Sí en pausas y fin de jornada; el checkout sigue siendo online para trazabilidad.",
      },
      {
        q: "¿Varios estudios en el mismo torneo?",
        a: "Definilo con el organizador para no saturar familias con links contradictorios.",
      },
      {
        q: "¿Cómo manejo partidos simultáneos?",
        a: "Asigná fotógrafos por cancha y unificá publicación bajo el mismo evento colaborativo si el organizador lo gestiona. Evitá que cada operador publique su link por separado.",
      },
    ],
    conclusion:
      "Torneos deportivos exigen orden antes que hero shots aislados. Álbumes por categoría, cobertura asignada, link único del club y packs por partido simplifican la compra familiar. Replicá la estructura en cada fecha del calendario federativo.",
    ctaAudience: "organizadores",
    imageScene:
      "Youth football tournament with photographers along sideline, parents watching from stands",
    imageAltSubject: "Fotógrafos en la banda de un torneo juvenil de fútbol",
  },

  "como-vender-fotografias-escolares-caso-de-uso": {
    seoTitle: "Cómo vender fotografías escolares: caso de uso completo",
    seoDescription:
      "Proyecto anual de fotografía escolar con preventa, privacidad, bundles y comunicación institucional paso a paso.",
    excerpt:
      "Caso de uso completo: proyecto anual de fotografía escolar con preventa y privacidad.",
    blocks: [
      p(
        "Un proyecto escolar anual involucra múltiples cursos, actos, egresados y restricciones de imagen de menores. Este caso de uso describe un ciclo completo desde acuerdo con dirección hasta post-mortem de ventas, usando preventa y bundles como palancas principales.",
      ),
      h2("Contexto del evento"),
      p(
        "Colegio privado o público con 300–1500 alumnos, fotos individuales, grupales, actos y posible sección de egresados. Decisor institucional + padres como compradores.",
      ),
      h2("Desafíos habituales"),
      ul([
        "Ventanas de compra cortas entre actividades académicas.",
        "Sensibilidad privacy y permisos firmados.",
        "Padres que comparan con celular.",
        "Logística de retoques y reclamos por «ojos cerrados».",
      ]),
      h2("Configuración recomendada en ComprameLaFoto"),
      p(
        "Álbumes por curso con acceso acorde a política acordada, preventa escolar con plazos claros, packs individuales + grupal + hermanos, Mercado Pago para pagos familiares, entrega digital automática de aprobados.",
      ),
      h2("Estrategia de cobertura"),
      ul([
        "Flujo de líneas por curso para individuales.",
        "Grupales con escalera y organización de filas.",
        "Acto: tomas institucionales + primeras filas para familias.",
      ]),
      h2("Comunicación a participantes"),
      p(
        "Tres oleadas: preventa con nota de dirección, apertura de galería post-shooting, recordatorio de cierre. FAQ en PDF del colegio: cómo pagar, plazos de impresión, contacto soporte.",
      ),
      h2("Pricing sugerido"),
      p(
        "Preventa 10–15 % debajo de lista. Bundle hermanos y combo digital + impresión abuelos. Evitá lista de precios confusa con demasiados SKUs.",
      ),
      h2("Métricas de éxito"),
      ul([
        "% alumnos con al menos una compra.",
        "Mix preventa vs postventa.",
        "Ticket promedio por familia.",
        "Tiempo de resolución de reclamos.",
      ]),
      h2("Lecciones aprendidas"),
      p(
        "El coordinador escolar es socio, no trámite. Un año bien documentado vende el siguiente contrato. Privacidad bien explicada reduce fricción más que cualquier descuento last-minute.",
      ),
      p(
        "Cada caso de uso mejora cuando documentás configuración de álbum, packs y comunicación que funcionó. El segundo año del mismo evento debería ser más rentable con menos horas.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión.",
      ),
      p(
        "Coordiná con organizador un único mensaje oficial con link. Links duplicados confunden y reducen conversión.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras.",
      ),
      p(
        "Colegio con 300–1500 alumnos, individuales, grupales, actos y posible egresados. Decisor institucional más padres como compradores.",
      ),
      p(
        "Álbumes por curso según política acordada, preventa con plazos claros, packs individuales + grupal + hermanos, entrega digital automática de aprobados.",
      ),
      p(
        "Flujo de líneas por curso para individuales; grupales con escalera organizada; acto con tomas institucionales y primeras filas para familias.",
      ),
      p(
        "Tres oleadas de comunicación: preventa con nota de dirección, apertura post-shooting, recordatorio de cierre. FAQ en PDF del colegio.",
      ),
      p(
        "Preventa 10–15 % debajo de lista. Bundle hermanos y combo digital + impresión para abuelos. Evitá lista confusa con demasiados SKUs.",
      ),
      p(
        "El coordinador escolar es socio, no trámite. Un año bien documentado vende el siguiente contrato. Privacidad bien explicada reduce fricción más que descuento last-minute.",
      ),
      p(
        "Fotos de menores: seguí lo acordado — álbumes restringidos, códigos por familia o publicación solo de aprobados.",
      ),
      p(
        "Egresados como línea aparte con packs de fiesta y estudio; misma plataforma, otra campaña con calendario propio.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Colegio con 300–1500 alumnos, individuales, grupales, actos y posible egresados. Decisor institucional más padres como compradores.",
      ),
      p(
        "Álbumes por curso según política acordada, preventa con plazos claros, packs individuales + grupal + hermanos, entrega digital automática de aprobados.",
      ),
      p(
        "Flujo de líneas por curso para individuales; grupales con escalera organizada; acto con tomas institucionales y primeras filas para familias.",
      ),
      p(
        "Tres oleadas de comunicación: preventa con nota de dirección, apertura post-shooting, recordatorio de cierre. FAQ en PDF del colegio.",
      ),
      p(
        "Preventa 10–15 % debajo de lista. Bundle hermanos y combo digital + impresión para abuelos. Evitá lista confusa con demasiados SKUs.",
      ),
      p(
        "El coordinador escolar es socio, no trámite. Un año bien documentado vende el siguiente contrato. Privacidad bien explicada reduce fricción más que descuento last-minute.",
      ),
      p(
        "Fotos de menores: seguí lo acordado — álbumes restringidos, códigos por familia o publicación solo de aprobados.",
      ),
      p(
        "Egresados como línea aparte con packs de fiesta y estudio; misma plataforma, otra campaña con calendario propio.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Colegio con 300–1500 alumnos, individuales, grupales, actos y posible egresados. Decisor institucional más padres como compradores.",
      ),
      p(
        "Álbumes por curso según política acordada, preventa con plazos claros, packs individuales + grupal + hermanos, entrega digital automática de aprobados.",
      ),
      p(
        "Flujo de líneas por curso para individuales; grupales con escalera organizada; acto con tomas institucionales y primeras filas para familias.",
      ),
      p(
        "Tres oleadas de comunicación: preventa con nota de dirección, apertura post-shooting, recordatorio de cierre. FAQ en PDF del colegio.",
      ),
      p(
        "Preventa 10–15 % debajo de lista. Bundle hermanos y combo digital + impresión para abuelos. Evitá lista confusa con demasiados SKUs.",
      ),
      p(
        "El coordinador escolar es socio, no trámite. Un año bien documentado vende el siguiente contrato. Privacidad bien explicada reduce fricción más que descuento last-minute.",
      ),
      p(
        "Fotos de menores: seguí lo acordado — álbumes restringidos, códigos por familia o publicación solo de aprobados.",
      ),
      p(
        "Egresados como línea aparte con packs de fiesta y estudio; misma plataforma, otra campaña con calendario propio.",
      ),
    ],
    faq: [
      {
        q: "¿Fotos de menores en álbum abierto?",
        a: "Seguí lo acordado con el colegio: álbumes restringidos, códigos por familia o publicación solo de aprobados.",
      },
      {
        q: "¿Cuánto dura la preventa?",
        a: "Dos a tres semanas suele ser suficiente si hay incentivo claro y recordatorios.",
      },
      {
        q: "¿Qué hago con egresados?",
        a: "Tratalo como línea aparte con packs de fiesta y estudio; misma plataforma, otra campaña.",
      },
      {
        q: "¿Cómo involucro a los preceptores?",
        a: "Un email del preceptor con el link oficial y fecha límite suele convertir mejor que solo un flyer en la mochila del alumno.",
      },
    ],
    conclusion:
      "El caso escolar exitoso es un proyecto de comunicación institucional con cámara en mano. Preventa, bundles familiares, permisos claros y un solo link oficial convierten el ciclo lectivo en negocio predecible. Medí por colegio y refiná cada temporada.",
    ctaAudience: "escuelas",
    imageScene:
      "School photo day with orderly lines of students, photographer with step ladder in gymnasium",
    imageAltSubject:
      "Día de fotos escolares con filas ordenadas en un gimnasio",
  },

  "como-vender-fotografias-fiesta-egresados": {
    seoTitle: "Cómo vender fotografías de una fiesta de egresados",
    seoDescription:
      "Caso de uso: fiestas de egresados, cotillón y entrega rápida para estudiantes y familias.",
    excerpt:
      "Caso de uso: fiestas de egresados, cotillón y entrega rápida a estudiantes y familias.",
    blocks: [
      p(
        "Las fiestas de egresados combinan baja luz, energía alta y deseo inmediato de compartir en redes. El caso de uso rentable publica rápido, facilita packs «todas mis fotos» y aprovecha el impulso social de la madrugada del evento.",
      ),
      h2("Contexto del evento"),
      p(
        "Salón o boliche, hundreds de egresados, familias en entrada y pista, cotillón y momentos grupales. Horario nocturno hasta madrugada.",
      ),
      h2("Desafíos habituales"),
      ul([
        "ISO alto y variabilidad de luz.",
        "Publicar antes de que pase el hype de Instagram.",
        "Grupos grandes difíciles de etiquetar manualmente.",
        "Ventas impulsivas que caen si demorás días.",
      ]),
      h2("Configuración recomendada en ComprameLaFoto"),
      p(
        "Álbum del evento con subsecciones si hay previa en estudio, pack «fiesta completa» digital, pago con Mercado Pago, entrega automática, comunicación de link en pantallas del salón si el organizador permite.",
      ),
      h2("Estrategia de cobertura"),
      ul([
        "Entrada, pista, cotillón, brindis, salida de humo.",
        "Fotos de grupo espontáneas post-coreografía.",
        "Flash controlado para reconocimiento facial en pista.",
      ]),
      h2("Comunicación a participantes"),
      p(
        "Coordiná con la empresa organizadora cartel con QR en mesas y mención del fotógrafo en animación. Story del fotógrafo al publicar: «Buscate en el link, pack promocional 48 h».",
      ),
      h2("Pricing sugerido"),
      p(
        "Foto suelta para prueba + pack medio + pack completo ilimitado del evento con precio ancla. Descuento madrugada si publicás antes de las 10 h del día siguiente.",
      ),
      h2("Métricas de éxito"),
      ul([
        "Ventas en primeras 24 h vs total.",
        "Mix pack completo vs unidades.",
        "Tráfico desde Instagram.",
      ]),
      h2("Lecciones aprendidas"),
      p(
        "La ventana emocional es cortísima. Equipo de edición mínima en locación o pipeline express. Mejor publicar subset curado temprano que álbum completo tarde.",
      ),
      p(
        "Cada caso de uso mejora cuando documentás configuración de álbum, packs y comunicación que funcionó. El segundo año del mismo evento debería ser más rentable con menos horas.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión.",
      ),
      p(
        "Coordiná con organizador un único mensaje oficial con link. Links duplicados confunden y reducen conversión.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras.",
      ),
      p(
        "Salón o boliche, cientos de egresados, familias en entrada y pista, cotillón y momentos grupales. Horario nocturno hasta madrugada.",
      ),
      p(
        "ISO alto y variabilidad de luz; publicar antes de que pase el hype de Instagram; grupos grandes difíciles de etiquetar manualmente.",
      ),
      p(
        "Álbum con subsecciones si hay previa en estudio, pack «fiesta completa» digital, entrega automática, QR en mesas si el organizador permite.",
      ),
      p(
        "Cobertura: entrada, pista, cotillón, brindis; grupos post-coreografía; flash controlado para reconocimiento facial.",
      ),
      p(
        "Coordiná con empresa organizadora cartel con QR y mención en animación. Story al publicar: pack promocional 48 h.",
      ),
      p(
        "Foto suelta + pack medio + pack completo del evento. Descuento madrugada si publicás antes de las 10 h del día siguiente.",
      ),
      p(
        "La ventana emocional es cortísima. Mejor publicar subset curado temprano que álbum completo tarde.",
      ),
      p(
        "Watermark en previews; altas solo post-pago. Checkout online evita cobrar en efectivo de madrugada en el salón.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Salón o boliche, cientos de egresados, familias en entrada y pista, cotillón y momentos grupales. Horario nocturno hasta madrugada.",
      ),
      p(
        "ISO alto y variabilidad de luz; publicar antes de que pase el hype de Instagram; grupos grandes difíciles de etiquetar manualmente.",
      ),
      p(
        "Álbum con subsecciones si hay previa en estudio, pack «fiesta completa» digital, entrega automática, QR en mesas si el organizador permite.",
      ),
      p(
        "Cobertura: entrada, pista, cotillón, brindis; grupos post-coreografía; flash controlado para reconocimiento facial.",
      ),
      p(
        "Coordiná con empresa organizadora cartel con QR y mención en animación. Story al publicar: pack promocional 48 h.",
      ),
      p(
        "Foto suelta + pack medio + pack completo del evento. Descuento madrugada si publicás antes de las 10 h del día siguiente.",
      ),
      p(
        "La ventana emocional es cortísima. Mejor publicar subset curado temprano que álbum completo tarde.",
      ),
      p(
        "Watermark en previews; altas solo post-pago. Checkout online evita cobrar en efectivo de madrugada en el salón.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Salón o boliche, cientos de egresados, familias en entrada y pista, cotillón y momentos grupales. Horario nocturno hasta madrugada.",
      ),
      p(
        "ISO alto y variabilidad de luz; publicar antes de que pase el hype de Instagram; grupos grandes difíciles de etiquetar manualmente.",
      ),
      p(
        "Álbum con subsecciones si hay previa en estudio, pack «fiesta completa» digital, entrega automática, QR en mesas si el organizador permite.",
      ),
      p(
        "Cobertura: entrada, pista, cotillón, brindis; grupos post-coreografía; flash controlado para reconocimiento facial.",
      ),
      p(
        "Coordiná con empresa organizadora cartel con QR y mención en animación. Story al publicar: pack promocional 48 h.",
      ),
      p(
        "Foto suelta + pack medio + pack completo del evento. Descuento madrugada si publicás antes de las 10 h del día siguiente.",
      ),
      p(
        "La ventana emocional es cortísima. Mejor publicar subset curado temprano que álbum completo tarde.",
      ),
      p(
        "Watermark en previews; altas solo post-pago. Checkout online evita cobrar en efectivo de madrugada en el salón.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
    ],
    faq: [
      {
        q: "¿Puedo vender en el salón?",
        a: "QR en mesas ayuda, pero el checkout online evita cobrar en efectivo de madrugada.",
      },
      {
        q: "¿Watermark fuerte?",
        a: "Sí en previews; altas solo post-pago para evitar filtración antes de compra.",
      },
      {
        q: "¿Sesión de estudio aparte?",
        a: "Muchos contratos incluyen estudio + fiesta; usá álbumes separados o secciones claras.",
      },
      {
        q: "¿Hasta cuándo dejo abierta la galería?",
        a: "Dos a cuatro semanas con recordatorio de cierre suele equilibrar urgencia y ventas tardías. Comunicá la fecha límite desde el primer aviso.",
      },
    ],
    conclusion:
      "Egresados es venta impulsiva y social. Publicá rápido, ofrecé pack completo claro y apoyate en el organizador para QR masivo. Quien captura la emoción de la noche y la monetiza en 24 horas gana el caso de uso.",
    ctaAudience: "fotografos",
    imageScene:
      "Graduation party photographer with on-camera flash, students in formal attire, ballroom venue",
    imageAltSubject:
      "Fotógrafo en fiesta de egresados con flash en salón de fiestas",
  },

  "como-vender-fotografias-recital": {
    seoTitle: "Cómo vender fotografías de un recital",
    seoDescription:
      "Caso de uso: recitales de danza o música con baja luz, venta post-show y comunicación a familias.",
    excerpt:
      "Caso de uso: recitales de danza o música con baja luz y necesidad de venta post-show.",
    blocks: [
      p(
        "Recitales de danza o música presentan luz escénica difícil y familias que quieren recuerdo del número específico. El caso de uso equilibra técnica en plateau, publicación post-función y álbumes por función o por escuela.",
      ),
      h2("Contexto del evento"),
      p(
        "Teatro o salón comunitario, varias funciones, alumnos por disciplina y edad, público familiar con permiso de grabación limitado según escuela.",
      ),
      h2("Desafíos habituales"),
      ul([
        "Luz contrastada y backlit.",
        "Ventas concentradas post-show en el hall.",
        "Identificar número y bailarín sin confundir coreografías.",
        "Restricciones de flash o posición de cámara.",
      ]),
      h2("Configuración recomendada en ComprameLaFoto"),
      p(
        "Álbum por función (sábado 18 h / domingo 20 h) y carpetas por número o nivel, packs por número o pack recital completo, checkout mobile-first, entrega digital automática.",
      ),
      h2("Estrategia de cobertura"),
      ul([
        "Ensayo general si está permitido para pruebas de luz.",
        "Posiciones fijas en plateau acordadas con producción.",
        "Retratos post-show en hall si hay espacio.",
      ]),
      h2("Comunicación a participantes"),
      p(
        "Escuela de danza o música envía link post-función. Cartel en hall con QR y plazo de venta. Mensaje: «Buscá tu número en la carpeta correspondiente».",
      ),
      h2("Pricing sugerido"),
      p(
        "Pack por número (todas las fotos de esa coreografía) + pack recital. Precio early bird 72 h post-función.",
      ),
      h2("Métricas de éxito"),
      ul([
        "Conversión familias asistentes.",
        "Ventas por número vs pack completo.",
        "Reclamos por motion blur (señal de expectativa vs técnica).",
      ]),
      h2("Lecciones aprendidas"),
      p(
        "Acordá con la escuela expectativas de luz y enfoque. Mejor educar en preview que pelear post-venta. Publicar la noche misma captura ventas en el hall.",
      ),
      p(
        "Cada caso de uso mejora cuando documentás configuración de álbum, packs y comunicación que funcionó. El segundo año del mismo evento debería ser más rentable con menos horas.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión.",
      ),
      p(
        "Coordiná con organizador un único mensaje oficial con link. Links duplicados confunden y reducen conversión.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras.",
      ),
      p(
        "Teatro o salón comunitario, varias funciones, alumnos por disciplina y edad, público familiar. Permisos de grabación según escuela.",
      ),
      p(
        "Luz contrastada y backlit; ventas concentradas post-show en el hall; identificar número y bailarín sin confundir coreografías.",
      ),
      p(
        "Álbum por función y carpetas por número o nivel; packs por número o recital completo; checkout mobile-first.",
      ),
      p(
        "Ensayo general si está permitido para pruebas de luz; posiciones fijas acordadas con producción; retratos post-show en hall.",
      ),
      p(
        "Escuela envía link post-función; cartel en hall con QR y plazo de venta. «Buscá tu número en la carpeta correspondiente».",
      ),
      p(
        "Pack por número (todas las fotos de esa coreografía) + pack recital. Early bird 72 h post-función.",
      ),
      p(
        "Acordá expectativas de luz y enfoque con la escuela. Publicar la noche misma captura ventas en el hall.",
      ),
      p(
        "Varias funciones del mismo elenco: álbumes separados evitan mezclar vestuario o variaciones entre fechas.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Teatro o salón comunitario, varias funciones, alumnos por disciplina y edad, público familiar. Permisos de grabación según escuela.",
      ),
      p(
        "Luz contrastada y backlit; ventas concentradas post-show en el hall; identificar número y bailarín sin confundir coreografías.",
      ),
      p(
        "Álbum por función y carpetas por número o nivel; packs por número o recital completo; checkout mobile-first.",
      ),
      p(
        "Ensayo general si está permitido para pruebas de luz; posiciones fijas acordadas con producción; retratos post-show en hall.",
      ),
      p(
        "Escuela envía link post-función; cartel en hall con QR y plazo de venta. «Buscá tu número en la carpeta correspondiente».",
      ),
      p(
        "Pack por número (todas las fotos de esa coreografía) + pack recital. Early bird 72 h post-función.",
      ),
      p(
        "Acordá expectativas de luz y enfoque con la escuela. Publicar la noche misma captura ventas en el hall.",
      ),
      p(
        "Varias funciones del mismo elenco: álbumes separados evitan mezclar vestuario o variaciones entre fechas.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Teatro o salón comunitario, varias funciones, alumnos por disciplina y edad, público familiar. Permisos de grabación según escuela.",
      ),
      p(
        "Luz contrastada y backlit; ventas concentradas post-show en el hall; identificar número y bailarín sin confundir coreografías.",
      ),
      p(
        "Álbum por función y carpetas por número o nivel; packs por número o recital completo; checkout mobile-first.",
      ),
      p(
        "Ensayo general si está permitido para pruebas de luz; posiciones fijas acordadas con producción; retratos post-show en hall.",
      ),
      p(
        "Escuela envía link post-función; cartel en hall con QR y plazo de venta. «Buscá tu número en la carpeta correspondiente».",
      ),
      p(
        "Pack por número (todas las fotos de esa coreografía) + pack recital. Early bird 72 h post-función.",
      ),
      p(
        "Acordá expectativas de luz y enfoque con la escuela. Publicar la noche misma captura ventas en el hall.",
      ),
      p(
        "Varias funciones del mismo elenco: álbumes separados evitan mezclar vestuario o variaciones entre fechas.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
    ],
    faq: [
      {
        q: "¿Grabación de video compite?",
        a: "La foto fija sigue teniendo valor para imprimir y álbum. Diferenciá por calidad y selección.",
      },
      {
        q: "¿Varias funciones mismo elenco?",
        a: "Álbumes separados evitan mezclar vestuario o variaciones.",
      },
      {
        q: "¿Impresiones?",
        a: "Ofrecé bundle digital + print para abuelos si tu lab lo soporta.",
      },
      {
        q: "¿Cómo etiqueto fotos por bailarín?",
        a: "Usá números de función y agrupación por coreografía. Si hay muchos elencos, el buscador por selfie ayuda a familias que no recuerdan el número exacto.",
      },
    ],
    conclusion:
      "Recitales requieren técnica en escena y comercialización inmediata post-cortina. Estructurá álbumes por función y número, comunicá con la escuela un solo link y vendé packs por coreografía. La familia compra emoción del número que vio esa noche.",
    ctaAudience: "fotografos",
    imageScene:
      "Dance recital photographer backstage, performers in costumes, soft theater lighting realistic",
    imageAltSubject:
      "Fotógrafo en backstage de recital de danza con iluminación teatral",
  },

  "como-vender-fotografias-evento-corporativo": {
    seoTitle: "Cómo vender fotografías de un evento corporativo",
    seoDescription:
      "Caso de uso: conferencias, team building y lanzamientos con entrega a empresas y asistentes.",
    excerpt:
      "Caso de uso: conferencias, team building y lanzamientos con entrega a empresas y asistentes.",
    blocks: [
      p(
        "Eventos corporativos priorizan imagen de marca, permisos de uso y entrega controlada. El caso de uso puede combinar contrato B2B con la empresa y venta opcional a asistentes de fotos personales en momentos sociales del evento.",
      ),
      h2("Contexto del evento"),
      p(
        "Conferencia, lanzamiento de producto o team building en hotel o centro de convenciones. Asistentes con credencial, marca visible, código de vestimenta.",
      ),
      h2("Desafíos habituales"),
      ul([
        "Derechos de imagen y uso comercial por empresa.",
        "Mezcla de tomas institucionales vs espontáneas vendibles.",
        "Plazos de entrega exigentes para prensa interna.",
        "Facturación B2B aparte de checkout individual.",
      ]),
      h2("Configuración recomendada en ComprameLaFoto"),
      p(
        "Álbum privado para asistentes en momentos networking o cena, separado de entrega B2B acordada por contrato. Packs individuales digitales, Mercado Pago para asistentes, plazo de venta acotado post-evento.",
      ),
      h2("Estrategia de cobertura"),
      ul([
        "Keynote, paneles, networking, espacio foto marca.",
        "Evitar imágenes que la empresa no quiera publicar.",
        "Tomas grupales de equipo con logo legible.",
      ]),
      h2("Comunicación a participantes"),
      p(
        "Email post-evento de la empresa con link opcional a galería social del encuentro. Mensaje alineado con RR.HH.: recuerdo personal, no material oficial de prensa.",
      ),
      h2("Pricing sugerido"),
      p(
        "Precio unitario moderado o pack pequeño; empresa puede subsidiar parte como beneficio. Contrato B2B por cobertura y entrega de banco de imágenes es ingreso principal; venta individual es complemento.",
      ),
      h2("Métricas de éxito"),
      ul([
        "Cumplimiento SLA de entrega B2B.",
        "Ventas individuales opcionales.",
        "Renovación de contrato con la empresa.",
      ]),
      h2("Lecciones aprendidas"),
      p(
        "Definí por escrito qué se vende a asistentes y qué es solo para la empresa. Un solo contacto en marketing interno evita contradicciones. Profesionalismo en factura y entrega pesa más que volumen masivo.",
      ),
      p(
        "Cada caso de uso mejora cuando documentás configuración de álbum, packs y comunicación que funcionó. El segundo año del mismo evento debería ser más rentable con menos horas.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión.",
      ),
      p(
        "Coordiná con organizador un único mensaje oficial con link. Links duplicados confunden y reducen conversión.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras.",
      ),
      p(
        "Conferencia, lanzamiento o team building en hotel o centro de convenciones. Asistentes con credencial y código de vestimenta.",
      ),
      p(
        "Derechos de imagen y uso comercial por empresa; mezcla de tomas institucionales vs espontáneas vendibles; plazos exigentes para prensa interna.",
      ),
      p(
        "Álbum privado para asistentes en networking o cena, separado de entrega B2B por contrato. Packs individuales digitales; plazo acotado post-evento.",
      ),
      p(
        "Keynote, paneles, networking, espacio foto marca. Evitá imágenes que la empresa no quiera publicar.",
      ),
      p(
        "Email post-evento de la empresa con link opcional a galería social. Mensaje alineado con RR.HH.: recuerdo personal, no material oficial de prensa.",
      ),
      p(
        "Precio unitario moderado o pack pequeño; empresa puede subsidiar como beneficio. Contrato B2B por cobertura e ingreso principal; venta individual complemento.",
      ),
      p(
        "Definí por escrito qué se vende a asistentes y qué es solo para la empresa. Un contacto en marketing interno evita contradicciones.",
      ),
      p(
        "La renovación del contrato corporativo es la métrica que importa más que volumen masivo de ventas individuales opcionales.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Conferencia, lanzamiento o team building en hotel o centro de convenciones. Asistentes con credencial y código de vestimenta.",
      ),
      p(
        "Derechos de imagen y uso comercial por empresa; mezcla de tomas institucionales vs espontáneas vendibles; plazos exigentes para prensa interna.",
      ),
      p(
        "Álbum privado para asistentes en networking o cena, separado de entrega B2B por contrato. Packs individuales digitales; plazo acotado post-evento.",
      ),
      p(
        "Keynote, paneles, networking, espacio foto marca. Evitá imágenes que la empresa no quiera publicar.",
      ),
      p(
        "Email post-evento de la empresa con link opcional a galería social. Mensaje alineado con RR.HH.: recuerdo personal, no material oficial de prensa.",
      ),
      p(
        "Precio unitario moderado o pack pequeño; empresa puede subsidiar como beneficio. Contrato B2B por cobertura e ingreso principal; venta individual complemento.",
      ),
      p(
        "Definí por escrito qué se vende a asistentes y qué es solo para la empresa. Un contacto en marketing interno evita contradicciones.",
      ),
      p(
        "La renovación del contrato corporativo es la métrica que importa más que volumen masivo de ventas individuales opcionales.",
      ),
      p(
        "Medí cada evento con las mismas variables: visitas, órdenes, ticket promedio, horas de edición y horas de soporte. Sin métrica no sabés si mejoraste; solo tenés sensaciones después de dormir poco.",
      ),
      p(
        "Involucrá al organizador o institución como aliado de difusión, no solo como cliente de cobertura. Un mail institucional o un cartel en secretaría multiplica visitas más que un story adicional tuyo.",
      ),
      p(
        "Automatizá lo repetitivo para liberar tiempo en lo que solo vos hacés bien: fotografiar y relacionarte en el evento. Cada hora liberada es otra fecha que podés cubrir o descansar sin perder ingreso.",
      ),
      p(
        "Evitá prometer plazos de entrega que tu flujo de carga no puede cumplir. Mejor publicar antes con subset curado que tarde con todo el catálogo y una audiencia ya enfriada.",
      ),
      p(
        "Revisá precios una vez por trimestre con datos reales, no con miedo o intuición del foro. Subir o bajar diez por ciento sin datos es apostar; ajustar con conversión medida es gestión.",
      ),
      p(
        "Hacé compra de prueba con un colega antes de abrir al público: detectás fricción de pago o descarga sin presión. Ese ritual de quince minutos evita cien mensajes de soporte el fin de semana.",
      ),
      p(
        "Coordiná un único mensaje oficial con link. Links duplicados o carpetas paralelas confunden y reducen conversión aunque las fotos sean las mismas.",
      ),
      p(
        "Prepará FAQ en el álbum para las tres preguntas que siempre llegan por chat. Eso escala mejor que responder una por una cuando ya estás editando la semana siguiente.",
      ),
      p(
        "Cerrá ventas con plazo claro cuando el hype del evento es máximo; extender indefinidamente diluye compras y te deja soporte abierto sin beneficio comercial.",
      ),
      p(
        "La mejora comercial es acumulativa: pequeños cambios en comunicación, precio y publicación se suman evento tras evento. Llevá registro escrito para no confiar en memoria post-temporada.",
      ),
      p(
        "Definí métricas simples antes de la temporada: conversión, ticket promedio, horas de soporte. Compartilas con tu equipo si trabajás con asistentes para alinear expectativas.",
      ),
      p(
        "Un pack bien nombrado y fácil de entender en el celular supera un descuento confuso que el cliente no puede calcular en dos segundos. Simplicidad comercial es conversión.",
      ),
      p(
        "Conferencia, lanzamiento o team building en hotel o centro de convenciones. Asistentes con credencial y código de vestimenta.",
      ),
      p(
        "Derechos de imagen y uso comercial por empresa; mezcla de tomas institucionales vs espontáneas vendibles; plazos exigentes para prensa interna.",
      ),
      p(
        "Álbum privado para asistentes en networking o cena, separado de entrega B2B por contrato. Packs individuales digitales; plazo acotado post-evento.",
      ),
      p(
        "Keynote, paneles, networking, espacio foto marca. Evitá imágenes que la empresa no quiera publicar.",
      ),
      p(
        "Email post-evento de la empresa con link opcional a galería social. Mensaje alineado con RR.HH.: recuerdo personal, no material oficial de prensa.",
      ),
      p(
        "Precio unitario moderado o pack pequeño; empresa puede subsidiar como beneficio. Contrato B2B por cobertura e ingreso principal; venta individual complemento.",
      ),
      p(
        "Definí por escrito qué se vende a asistentes y qué es solo para la empresa. Un contacto en marketing interno evita contradicciones.",
      ),
      p(
        "La renovación del contrato corporativo es la métrica que importa más que volumen masivo de ventas individuales opcionales.",
      ),
    ],
    faq: [
      {
        q: "¿La empresa puede prohibir venta a asistentes?",
        a: "Sí. Respetá contrato. Muchas veces solo aplica a tomas en plenario, no a cocktail.",
      },
      {
        q: "¿Necesito plataforma si ya entrego por contrato?",
        a: "Para venta individual opcional, sí simplifica cobro; el banco B2B puede ir por canal acordado.",
      },
      {
        q: "¿Watermark corporativo?",
        a: "Según brand guidelines. Previews con marca acordada.",
      },
      {
        q: "¿Facturo a la empresa o al asistente?",
        a: "El contrato B2B va por canal acordado con RR.HH. La venta opcional a asistentes usa checkout individual con comprobante automático.",
      },
    ],
    conclusion:
      "Corporativos combinan entrega B2B seria con venta opcional a asistentes en momentos sociales. Separá flujos, aclarar derechos de imagen y usá checkout online solo donde la empresa lo permita. La renovación del contrato es la métrica que importa.",
    ctaAudience: "organizadores",
    imageScene:
      "Corporate conference photographer capturing keynote speaker, attendees with badges, hotel ballroom",
    imageAltSubject: "Fotógrafo en conferencia corporativa capturando keynote",
  },
};
