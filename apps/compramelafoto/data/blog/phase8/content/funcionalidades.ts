import type { Phase8ArticleContent } from "@/data/blog/phase8/types";
import { resolveCtaAudience } from "@/data/blog/phase8/cta";
import { p, h2, h3, ul } from "@/data/blog/phase8/editorial-nodes";

export const FUNCIONALIDADES_PHASE8: Record<string, Phase8ArticleContent> = {
  "que-es-compramelafoto": {
    seoTitle: "Qué es ComprameLaFoto: plataforma de venta de fotos",
    seoDescription:
      "ComprameLaFoto conecta fotógrafos, organizadores y compradores en Argentina con galerías, Mercado Pago y entrega digital o impresa.",
    excerpt:
      "Conocé la plataforma argentina para vender fotografías de eventos, escuelas y sesiones con pagos integrados.",
    blocks: [
      p(
        "ComprameLaFoto es una plataforma argentina pensada para vender fotografías de forma profesional, sin depender de links sueltos, transferencias manuales ni mensajes interminables por WhatsApp. Conecta a tres actores que suelen aparecer en el mismo evento o proyecto escolar: el fotógrafo que produce las imágenes, el organizador que coordina la cobertura o la institución, y las familias o participantes que quieren comprar sus fotos. Todo ocurre en un entorno unificado: galerías por álbum o evento, precios configurables, packs, descuentos por cantidad, cobro con Mercado Pago y entrega automática de archivos digitales o pedidos de impresión. El objetivo no es reemplazar el oficio fotográfico, sino quitarle fricción administrativa para que puedas enfocarte en disparar, editar y atender mejor a tus clientes."
      ),
      h2("Para quién está pensada la plataforma"),
      p(
        "ComprameLaFoto sirve a fotógrafos independientes, estudios pequeños y equipos que cubren deportes, sociales, escuelas, recitales o sesiones privadas. También está diseñada para organizadores de eventos —clubes, productoras, asociaciones deportivas— que quieren convocar varios fotógrafos bajo una misma landing y, si corresponde, participar de las ventas mediante comisiones. Del otro lado están los compradores: corredores que buscan su foto en una maratón, padres que adquieren el retrato escolar o invitados que quieren un recuerdo digital o impreso. Cada perfil tiene herramientas acordes: el fotógrafo gestiona álbumes y precios; el organizador crea eventos colaborativos; el cliente navega, paga y descarga sin trámites extra."
      ),
      p(
        "La plataforma opera en el mercado argentino y utiliza Mercado Pago como medio de pago principal, lo que facilita que el dinero de las ventas se acredite en la cuenta configurada por quien vende, dentro del flujo habitual de cobros online en el país. Registrarse y crear álbumes no tiene costo fijo: ComprameLaFoto cobra comisión cuando se concreta una venta, alineando el éxito de la plataforma con el tuyo."
      ),
      h2("Qué problemas resuelve en el día a día"),
      p(
        "Antes de centralizar la venta, muchos fotógrafos repartían carpetas en Drive, pedían comprobantes por mensaje y enviaban archivos a mano una vez verificado el pago. Ese modelo funciona con pocos pedidos, pero se rompe en eventos masivos o campañas escolares con cientos de familias. ComprameLaFoto reduce errores de cobro, evita que se pierdan ventas por demora en responder y ofrece al cliente una experiencia clara: entrar a un link, elegir fotos, pagar y recibir lo comprado sin depender de que alguien esté online en ese momento."
      ),
      ul([
        "Galerías públicas o privadas con control de acceso según tu estrategia comercial.",
        "Carrito unificado para digitales, impresiones y packs en una sola compra cuando está habilitado.",
        "Entrega digital automática tras el pago aprobado, con enlaces de descarga para el comprador.",
        "Herramientas para eventos con varios fotógrafos y landing compartida del organizador.",
        "Búsqueda por selfie en eventos masivos para que el participante encuentre sus fotos más rápido.",
        "Preventa escolar para cobrar antes de la entrega final y organizar pedidos por alumno o familia.",
      ]),
      h2("Ventas digitales e impresiones en un mismo ecosistema"),
      p(
        "El corazón del negocio suele ser la fotografía digital: el cliente paga, descarga en alta resolución y usa la imagen para redes o impresión personal. ComprameLaFoto protege las vistas previas, muestra marcas de agua cuando corresponde y libera el archivo completo solo después del pago. En paralelo, podés ofrecer impresiones en distintos tamaños y acabados, conectadas con flujos de laboratorio y seguimiento de pedido. Los packs permiten combinar digital más impresa o varias fotos con precio promocional, simplificando la decisión de compra y aumentando el ticket promedio sin que tengas que negociar caso por caso."
      ),
      p(
        "También existen flujos donde el cliente sube sus propias imágenes para pedir impresiones, útil para quien ya tiene el archivo y solo necesita producción. En todos los casos, la plataforma documenta estados del pedido —pendiente, en producción, listo, enviado— para que comprador y vendedor compartan la misma información."
      ),
      h2("Eventos colaborativos y rol del organizador"),
      p(
        "En carreras, torneos o festivales suele haber más de un fotógrafo en cancha. Los eventos colaborativos de ComprameLaFoto permiten que un organizador cree el evento, defina condiciones, convoque fotógrafos y publique una landing única donde los participantes encuentran todas las galerías vinculadas. El organizador puede habilitar comisiones sobre las ventas, configurar reglas de precio orientativas y coordinar la acreditación. Para el fotógrafo, sumarse a un evento bien armado significa acceso a público calificado sin tener que construir solo toda la promoción."
      ),
      h2("Privacidad, derechos y confianza"),
      p(
        "Vos decidís si un álbum es público, privado o accesible solo con link. La plataforma no cambia la titularidad del derecho de autor: seguís siendo dueño de tus imágenes y definís qué licencia otorga cada compra. En contextos con menores o eventos en espacios privados, es importante que la cobertura y la venta estén autorizadas por quien corresponda; ComprameLaFoto ofrece canales para solicitar remoción de fotos cuando una persona no desea aparecer publicada. La confianza del comprador —pagos seguros, entrega clara, soporte— es parte del producto tanto como la cámara del fotógrafo."
      ),
      h2("Cómo empezar según tu perfil"),
      p(
        "Si sos fotógrafo, el camino habitual es registrarte, conectar Mercado Pago, crear tu primer álbum y publicar la galería con precios acordes a tu mercado. Si sos organizador, podés abrir una cuenta de organizador, crear un evento y convocar fotógrafos con cupos y condiciones visibles. Si sos comprador, no necesitás cuenta para muchas galerías públicas: buscás el evento o escuela, elegís fotos y pagás. La documentación del blog y los tutoriales paso a paso profundizan cada flujo; este artículo es la vista panorámica de qué es la plataforma y por qué existe."
      ),
      h2("Herramientas que completan la experiencia"),
      p(
        "Además de la venta directa, ComprameLaFoto incorpora packs y descuentos por cantidad para incentivar compras múltiples, cupones promocionales cuando están habilitados y extensiones de almacenamiento si querés mantener galerías activas más tiempo —con costos asociados al recurso consumido. El programa de referidos permite que quien recomienda fotógrafos que venden obtenga parte del fee de marketplace durante doce meses, con Mercado Pago conectado. El marketplace de fotógrafos funciona como directorio para nuevos clientes. La búsqueda por selfie y, en contextos escolares, el padrón de alumnos acortan el camino entre galería y compra. Ninguna herramienta sustituye la calidad de tu trabajo, pero en conjunto reducen fricción operativa."
      ),
      h2("Cómo se compara con métodos manuales"),
      p(
        "Vender por transferencia y carpetas compartidas puede funcionar con diez clientes; con quinientos, el modelo se vuelve frágil. ComprameLaFoto no elimina tu relación con el cliente, pero estandariza cobro, entrega y registro de pedidos. Eso facilita conciliación contable, resolución de reclamos con número de orden y escalabilidad cuando el organizador promociona un único link masivo. El costo es la comisión por venta y el tiempo de aprender el panel —inversión que muchos recuperan en el primer evento grande."
      ),
      h2("Casos de uso frecuentes en Argentina"),
      p(
        "Fotografía deportiva en running, ciclismo y triatlón con publicación el mismo día o al día siguiente. Cobertura escolar con preventa de carpeta y entrega en el colegio. Fiestas de egresados y sociales con galería privada por curso. Recitales y festivales con varios fotógrafos bajo un organizador. Sesiones temáticas con venta de digitales e impresiones en estudio. En todos los escenarios el patrón es el mismo: producir, publicar con reglas claras, cobrar con Mercado Pago y entregar sin cuellos de botella manuales."
      ),
      h2("Soporte, comunidad y evolución del producto"),
      p(
        "La plataforma evoluciona con feedback de fotógrafos y organizadores activos en el país. Nuevas funciones —como módulos en desarrollo— se documentan con transparencia para no prometer lo que aún no está en producción. El soporte atiende incidencias de pago, acceso a descargas y remoción de imágenes. Participar en charlas, tutoriales del blog y la comunidad de proveedores ayuda a adoptar buenas prácticas que otros ya validaron en eventos reales."
      ),
      p(
        "Si venís de cobrar en efectivo en la puerta del colegio o por transferencia después de la carrera, la curva de aprendizaje es sobre todo mental: confiar en que el cliente puede pagar solo y recibir su foto sin tu intervención. Los primeros eventos conviene testearlos con un álbum acotado, precios claros y un grupo de compradores que te den feedback. Después de dos o tres ciclos, el panel se vuelve tan natural como cargar tarjetas en Lightroom. ComprameLaFoto no te obliga a un único modelo de negocio: podés mezclar sesiones premium presenciales con venta masiva digital de deportes, o escuela con preventa más reventa de ampliaciones, todo bajo una misma cuenta y la misma pasarela de pagos."
      ),
      h2("Próximos pasos en tu operación"),
      p(
        "El valor de ComprameLaFoto se mide en horas ahorradas y ventas no perdidas más que en la cantidad de botones del panel. Un fotógrafo que publica el viernes a la noche y despierta con ventas acreditadas entiende el producto sin compararlo con alternativas que no integran Mercado Pago ni la dinámica de eventos argentinos. Un organizador que deja de perseguir a quince fotógrafos por links distintos concentra la promoción en un solo mensaje post-evento. Una familia que paga la carpeta escolar desde el celular evita llevar efectivo al colegio. Elegí un solo flujo para tu próximo trabajo —álbum propio, evento con organizador o preventa— y recorre el tutorial correspondiente del blog para implementarlo en la semana siguiente con objetivos medibles: tiempo hasta primera venta, ticket promedio y cantidad de consultas manuales que evitaste."
      ),
    ],
    faq: [
      {
        q: "¿ComprameLaFoto cobra mensualidad?",
        a: "No hay costo fijo por registrarte ni por crear álbumes. La plataforma aplica comisión cuando realizás una venta, según la configuración vigente de tu cuenta.",
      },
      {
        q: "¿Puedo vender solo digitales o solo impresiones?",
        a: "Sí. Podés habilitar venta digital, impresiones o ambas según tu negocio y las opciones activas en tu perfil.",
      },
      {
        q: "¿Funciona solo en Argentina?",
        a: "Está pensada para el mercado argentino, con Mercado Pago como medio de pago principal y flujos adaptados a la operación local.",
      },
      {
        q: "¿Necesito saber programar para usarla?",
        a: "No. La interfaz está orientada a fotógrafos y organizadores sin conocimientos técnicos; configurás precios, subís fotos y compartís links desde el panel.",
      },
      {
        q: "¿Qué diferencia hay entre un álbum simple y un evento colaborativo?",
        a: "Un álbum simple lo gestiona un fotógrafo de punta a punta. Un evento colaborativo agrupa varios fotógrafos bajo un organizador, con landing compartida y reglas comunes de participación y, opcionalmente, comisiones.",
      },
    ],
    conclusion:
      "ComprameLaFoto es la infraestructura comercial que muchos fotógrafos y organizadores necesitaban para escalar ventas online en Argentina: galerías, pagos, entrega y herramientas para eventos masivos o escuelas en un solo lugar. Entender qué es la plataforma es el primer paso para elegir el flujo —álbum propio, evento colaborativo o preventa escolar— que mejor se adapte a tu próximo trabajo.",
    ctaAudience: resolveCtaAudience(["fotografos", "organizadores", "clientes"]),
    imageScene:
      "Diverse team of photographers and event staff collaborating around laptop showing photo sales dashboard in modern coworking space, hyperrealistic documentary photography",
    imageAltSubject: "Equipo de fotógrafos y organizadores revisando ventas en ComprameLaFoto",
    imageCaption: "La plataforma une producción fotográfica, coordinación de eventos y compra online.",
  },

  "como-funciona-reconocimiento-por-selfie": {
    seoTitle: "Reconocimiento por selfie en ComprameLaFoto",
    seoDescription:
      "Cómo funciona la búsqueda por selfie en eventos masivos: flujo del cliente, privacidad, configuración para fotógrafos y buenas prácticas.",
    excerpt:
      "Explicación del buscador por selfie: privacidad, precisión y experiencia del cliente en eventos masivos.",
    blocks: [
      p(
        "En una maratón con miles de corredores o un torneo con decenas de canchas, encontrar la propia fotografía entre miles de archivos puede ser frustrante. El reconocimiento por selfie de ComprameLaFoto acelera ese paso: el participante sube una foto de su rostro —típicamente una selfie— y el sistema compara ese rostro con las caras detectadas en las imágenes del evento o álbum, devolviendo las fotos con mayor coincidencia. No reemplaza la navegación manual ni la búsqueda por número de dorsal cuando existe, pero reduce mucho el tiempo entre «llegué a la galería» y «encontré mis fotos». Este artículo explica cómo funciona por dentro, qué ve el cliente, qué debe configurar el fotógrafo y qué expectativas de privacidad y precisión son razonables."
      ),
      h2("El problema que resuelve en eventos masivos"),
      p(
        "Cuando hay cientos o miles de fotos publicadas, pedirle al comprador que recorra galería por galería no escala. Muchos abandonan antes de comprar. La búsqueda por selfie apunta a ese cuello de botella: acortar la búsqueda en segundos para quien ya está motivado a comprar. Es especialmente útil en deportes, fiestas de fin de curso con muchos alumnos en escena o cualquier cobertura donde varios fotógrafos suben material en paralelo y el evento publica una landing unificada."
      ),
      h2("Flujo para el cliente paso a paso"),
      p(
        "El participante entra a la landing del evento o al álbum habilitado y elige la opción de buscar por selfie. La interfaz solicita una imagen del rostro: puede ser una selfie reciente, bien iluminada y sin obstáculos que tapen la cara. Tras enviarla, el sistema procesa la comparación y muestra un listado de fotos ordenadas por grado de similitud, con vista previa protegida igual que en el resto de la galería. El cliente selecciona las que desea, las agrega al carrito y completa el pago habitual con Mercado Pago. La selfie usada para la búsqueda no sustituye el checkout ni otorga descargas gratuitas: solo filtra resultados."
      ),
      ul([
        "Acceder a la galería del evento o álbum con búsqueda facial habilitada.",
        "Subir una selfie clara, de frente y con buena luz.",
        "Revisar las coincidencias sugeridas y ampliar las que interesen.",
        "Comprar digitales o impresiones con el flujo estándar de la plataforma.",
      ]),
      h2("Qué hace el sistema técnicamente"),
      p(
        "Cuando las fotos del evento se procesan, el sistema puede detectar rostros en las imágenes e indexarlos para comparación posterior. Al recibir la selfie del cliente, se buscan coincidencias en ese índice y se devuelven las fotos cuyos rostros superan un umbral de similitud configurado para equilibrar precisión y recall. Si no hay coincidencias por encima del umbral, el resultado es un listado vacío: en ese caso conviene intentar otra selfie o buscar por dorsal, categoría o galería del fotógrafo si el evento lo ofrece. La búsqueda está sujeta a límites de uso para proteger la infraestructura y evitar abusos."
      ),
      h2("Privacidad y retención de datos"),
      p(
        "El reconocimiento facial es un tema sensible. ComprameLaFoto lo utiliza para facilitar la compra, no para crear perfiles publicitarios ajenos a ese fin. Las selfies enviadas para una búsqueda puntual se procesan en el contexto de esa consulta; no deben usarse como excusa para exponer datos personales más allá de lo necesario para mostrar fotos del evento. Si una persona no desea aparecer en las galerías, puede solicitar remoción por los canales de soporte. Los fotógrafos deben informar en sus comunicaciones que las imágenes del evento se publican para venta y que existe búsqueda por rostro cuando está activa, respetando las autorizaciones del organizador y la normativa aplicable en cada contexto."
      ),
      h2("Configuración y buenas prácticas para fotógrafos"),
      p(
        "Para que la búsqueda funcione bien, las fotos deben estar analizadas y los rostros detectables: perfiles muy cerrados, lentes oscuros o borrados extremos reducen coincidencias. Subir material en plazos razonables después del evento mejora la experiencia del cliente ansioso por comprar. En eventos colaborativos, coordinar con el organizador el momento en que se habilita la búsqueda evita frustraciones por galerías aún vacías. Comunicá en redes y en la landing del evento que podrán buscar por selfie, con tips breves —luz, frente a cámara, sin gorra— para mejorar resultados."
      ),
      h2("Limitaciones y expectativas realistas"),
      p(
        "Ningún sistema de reconocimiento facial es perfecto. Pueden aparecer falsos positivos —otra persona con rasgos parecidos— o falsos negativos —tu foto existe pero la cara no se detectó bien—. Por eso siempre conviene mantener métodos alternativos de búsqueda y atención humana para casos límite. En álbumes escolares con padrón, la identificación por alumno puede convivir con la selfie según el flujo configurado. La búsqueda por selfie es una herramienta de conversión y comodidad, no un reemplazo del criterio del fotógrafo ni de las políticas de imagen del evento."
      ),
      h2("Experiencia en eventos colaborativos"),
      p(
        "Cuando un organizador publica la landing de un evento con varios fotógrafos, la búsqueda por selfie puede cruzar galerías adheridas sin que el corredor deba entrar uno por uno a cada álbum. Eso multiplica el valor de la función: no solo ahorra tiempo, sino que expone material de distintos ángulos y autores en un mismo resultado. El organizador debería comunicar en el briefing a los fotógrafos que el análisis facial depende de la subida y procesamiento oportuno de archivos."
      ),
      h2("Tips para mejores coincidencias"),
      ul([
        "Selfie de frente, sin anteojos de sol ni barbijo que oculte rasgos.",
        "Luz uniforme; evitar contraluces extremos de fondo.",
        "No usar foto de grupo recortada: el sistema necesita un rostro dominante.",
        "Si falla, probá con otra imagen tuya reciente antes de contactar soporte.",
      ]),
      h2("Rol del comprador y del organizador"),
      p(
        "El comprador no necesita cuenta previa para buscar en muchas galerías públicas; paga con Mercado Pago como en cualquier compra digital. El organizador gana satisfacción de participantes que encuentran fotos rápido y menos consultas repetitivas por redes. El fotógrafo convierte más visitas en ventas cuando la búsqueda funciona. Todos ganan si las expectativas están bien comunicadas: la selfie ayuda, no garantiza el cien por ciento de los casos."
      ),
      h2("Marco legal y consentimiento"),
      p(
        "En eventos deportivos masivos suele existir autorización generalizada de cobertura; en contextos sensibles verificá con el organizador. ComprameLaFoto ofrece mecanismos de remoción para quien no desea aparecer. La búsqueda biométrica debe presentarse como facilitador de compra dentro de esas políticas, no como vigilancia. Mantené coherencia entre lo que prometés en redes y lo que el sistema puede entregar técnicamente."
      ),
      h2("Profundización operativa"),
      p(
        "En la práctica, la búsqueda por selfie funciona mejor cuando el evento concentra publicación de fotos en una ventana corta —por ejemplo, las primeras cuarenta y ocho horas post-meta— y el organizador refuerza el mensaje en redes con un video corto mostrando cómo subir la selfie. Los fotógrafos que etiquetan álbumes por punto kilométrico o por horario ayudan al cliente a acotar resultados aunque la coincidencia facial ya haya filtrado la mayoría. Si el evento mezcla público general y categorías élite, aclarar en la landing que la búsqueda cubre todas las galerías adheridas evita consultas repetidas."
      ),
      p(
        "Desde el lado del comprador, conviene intentar la búsqueda desde un dispositivo con cámara decente y conexión estable; no hace falta instalar aplicaciones adicionales si el flujo es web. Tras obtener resultados, el carrito y el pago son idénticos a una compra manual: misma protección de preview, mismos packs y misma entrega digital tras Mercado Pago aprobado. Si compartís el link del evento con familiares, cada uno puede buscar su propio rostro y comprar por separado sin compartir cuentas."
      ),
      p(
        "Para eventos con menores, el organizador y el fotógrafo deben alinear si la búsqueda facial está alineada con las autorizaciones firmadas por las familias. En algunos contextos escolares prima el padrón por alumno; en otros, la selfie acelera la compra de hermanos o grupos de amigos que comparten galería pero no lista institucional. La flexibilidad del producto no elimina la responsabilidad de comunicar qué datos biométricos se usan y con qué fin."
      ),
      p(
        "Finalmente, medí conversión: compará ventas en eventos con y sin búsqueda activa, tiempo medio hasta primera compra y consultas de soporte del tipo «no encuentro mi foto». Esos indicadores valen más que la percepción subjetiva de si «funciona bien». Ajustá iluminación en set, velocidad de subida y mensajes al público en función de datos reales de cada edición."
      ),
      h2("Próximos pasos en tu operación"),
      p(
        "Planificá la comunicación del buscador facial en el mismo cronograma en que planificás la subida de fotos: si prometés búsqueda por selfie a las ocho de la noche pero el primer fotógrafo sube a las once, la decepción es inevitable. Coordiná con el organizador un mensaje único de «fotos disponibles» solo cuando haya volumen mínimo indexado. En el próximo evento, incluí en el checklist un ítem explícito de «selfie probada con rostro de prueba» antes de anunciar en redes."
      ),
      h2("Checklist antes de anunciar búsqueda por selfie"),
      p(
        "Confirmá que un volumen representativo de fotos ya fue analizado; probá la búsqueda con una selfie interna; verificá que la landing del evento mencione el buscador; prepará respuesta tipo para «no encuentro mi foto» que incluya búsqueda por dorsal o contacto al fotógrafo. Ese checklist de cinco minutos evita horas de mensajes el día de mayor tráfico. Si algo falla en la prueba interna, retrasá el anuncio público: la primera impresión del comprador define si vuelve a comprar en la próxima edición."
      ),
    ],
    faq: [
      {
        q: "¿La selfie queda guardada para siempre?",
        a: "Se usa para procesar la búsqueda en ese contexto. Consultá las políticas de privacidad vigentes del sitio para detalle sobre retención; el objetivo operativo es facilitar la compra, no acumular biometría innecesaria.",
      },
      {
        q: "¿Puedo buscar sin subir selfie?",
        a: "Sí, siempre podés navegar galerías por fotógrafo, categoría o dorsal cuando el evento lo ofrezca. La selfie es un atajo opcional.",
      },
      {
        q: "¿Por qué no encuentro mis fotos?",
        a: "Puede que aún no estén subidas, que tu cara no sea visible en la toma, que la iluminación de la selfie sea mala o que no supere el umbral de coincidencia. Probá otra imagen o contactá al fotógrafo.",
      },
      {
        q: "¿Todos los álbumes tienen búsqueda por selfie?",
        a: "No. Depende del tipo de evento o álbum y de que las fotos hayan sido procesadas para detección facial.",
      },
      {
        q: "¿Es obligatorio para comprar?",
        a: "No. Es una opción de búsqueda. El proceso de compra y pago es el mismo una vez que encontrás tus fotos.",
      },
    ],
    conclusion:
      "El reconocimiento por selfie convierte una galería masiva en una experiencia personalizada en pocos segundos, siempre que fotógrafos y organizadores cuiden la calidad del material y la comunicación con el público. Entender su alcance y sus límites ayuda a usarlo como ventaja comercial sin prometer magia donde la tecnología tiene márgenes de error normales.",
    ctaAudience: resolveCtaAudience(["clientes", "fotografos"]),
    imageScene:
      "Athlete using selfie station at race photo booth, volunteer assistant nearby, realistic expo hall, hyperrealistic documentary photography",
    imageAltSubject: "Corredor usando búsqueda por selfie en cabina de fotos de carrera",
    imageCaption: "La selfie acorta el camino entre la galería del evento y la compra.",
  },

  "como-funcionan-eventos-colaborativos": {
    seoTitle: "Eventos colaborativos en ComprameLaFoto",
    seoDescription:
      "Varios fotógrafos, un organizador y una landing unificada: roles, convocatoria, ventas y comisiones en eventos colaborativos.",
    excerpt:
      "Varios fotógrafos, un organizador y una landing unificada: así operan los eventos colaborativos.",
    blocks: [
      p(
        "Los eventos colaborativos de ComprameLaFoto permiten escalar la cobertura fotográfica sin fragmentar la experiencia del comprador. Un organizador —club deportivo, productora, asociación— crea el evento, define lugar, fecha, condiciones para fotógrafos y, si lo desea, reglas comerciales como comisiones o precios orientativos. Varios fotógrafos se suman mediante convocatoria abierta, solicitud o invitación, suben sus galerías vinculadas al mismo evento y el público accede a una landing única donde puede descubrir todas las fotos disponibles, buscar por selfie o dorsal y comprar con un solo checkout cuando el flujo lo permite. Este modelo alinea incentivos: más cobertura para el organizador, más exposición para el fotógrafo y menos confusión para quien corre, juega o asiste."
      ),
      h2("Roles: organizador y fotógrafos"),
      p(
        "El organizador es quien crea el evento en su panel, configura visibilidad —público, no listado o privado— y política de ingreso de fotógrafos. Puede redactar indicaciones de acreditación —dónde retirar credencial, horarios de ingreso— que los fotógrafos ven al unirse. Los fotógrafos aceptan condiciones del evento, obtienen permiso de subida cuando el organizador la habilita y publican álbumes asociados. Cada fotógrafo mantiene control sobre su material y precios según las reglas comerciales del evento; el organizador no reemplaza el trabajo creativo, sino que coordina el marco en el que ocurre."
      ),
      h3("Qué ve el comprador"),
      p(
        "Desde la landing pública del evento —accesible por link o código compartido— el participante encuentra información del encuentro, acceso a galerías de los fotógrafos adheridos y herramientas de búsqueda cuando están activas. No necesita saber cuántos fotógrafos cubrieron: el evento se presenta como una experiencia unificada, aunque detrás haya múltiples autores y, en algunos casos, entregas o retiros separados por fotógrafo en productos físicos."
      ),
      h2("Convocatoria, cupos y aprobación"),
      p(
        "Según la política de unión, un fotógrafo puede inscribirse libremente, solicitar ingreso a la espera de aprobación o recibir invitación directa. El organizador gestiona solicitudes pendientes, rechaza perfiles que no cumplan requisitos y controla cuándo se habilitan las subidas para evitar publicaciones antes del evento. Los cupos y la comunicación previa —grupo de WhatsApp, mail con indicaciones— son buenas prácticas fuera de la plataforma pero complementan lo configurado en el panel."
      ),
      ul([
        "OPEN: el fotógrafo puede unirse sin aprobación manual si cumple requisitos.",
        "REQUEST: el organizador aprueba o rechaza cada solicitud.",
        "INVITE_ONLY: solo ingresan quienes reciben invitación del organizador.",
      ]),
      h2("Landing del evento y promoción"),
      p(
        "El link del evento es el activo principal de marketing post-carrera o post-torneo. El organizador lo comparte por WhatsApp, email, redes o QR en el predio. Cuanto antes se comunique —incluso en la inscripción al evento— más tráfico llegará cuando las fotos estén listas. La landing concentra autoridad SEO y marca del encuentro: el participante recuerda «entré al sitio de la maratón» en lugar de perseguir diez links de fotógrafos sueltos."
      ),
      h2("Ventas, reparto y entregas"),
      p(
        "Cada venta se atribuye al fotógrafo dueño de la foto y al evento según la configuración. En compras con varios fotógrafos, el carrito puede agrupar ítems y advertir al cliente si habrá entregas o retiros separados para impresiones. Los pagos se procesan con Mercado Pago; el fotógrafo recibe su parte según el split configurado y la plataforma aplica su fee de marketplace. El organizador, si activó comisiones, participa según el porcentaje definido sobre la base acordada —detalle en el artículo de comisiones para organizadores."
      ),
      h2("Casos típicos de uso"),
      p(
        "Maratones y carreras atléticas con fotógrafos en meta y puntos kilométricos; torneos de fútbol o rugby con varias canchas; festivales con múltiples escenarios; actividades municipales con cobertura descentralizada. En todos los casos el patrón es el mismo: un organizador credibiliza el evento, varios fotógrafos compiten por calidad y precio dentro de un marco común, y el comprador gana simplicidad."
      ),
      h2("Buenas prácticas para que funcione"),
      p(
        "Definí condiciones claras antes de abrir convocatoria: qué puede vender cada fotógrafo, si hay precio mínimo, cómo será la acreditación y cuándo se publican las fotos. Coordiná con los fotógrafos el uso de búsqueda por selfie y dorsal. Tras el evento, monitoreá ventas desde el panel del organizador y cerrá el evento cuando corresponda para evitar confusiones con álbumes abiertos indefinidamente."
      ),
      h2("Reglas de precio en el evento"),
      p(
        "El organizador puede dejar que cada fotógrafo fije precios, imponer un precio fijo orientativo o establecer un mínimo comercial. Esas reglas se comunican al unirse al evento para evitar sorpresas en checkout. No confundir reglas de precio con comisión del organizador: son capas distintas. Un fotógrafo puede aceptar mínimo de precio sin comisión para el club, o comisión con libertad de precios, según lo acordado."
      ),
      h2("Acreditación y operativa en cancha"),
      p(
        "El campo de indicaciones para acreditación —visible para fotógrafos adheridos— centraliza instrucciones que antes se perdían en cadenas de WhatsApp: horario de ingreso, color de pulsera, restricciones de zona. Completarlo bien reduce fotógrafos perdidos el día del evento y mejora cobertura. Después del evento, el mismo canal sirve para recordar plazos de subida y link de venta."
      ),
      h2("Métricas y aprendizaje entre ediciones"),
      p(
        "Compará ventas entre ediciones del mismo torneo o carrera. ¿Mejoró la conversión cuando activaste selfie? ¿Más fotógrafos significó más ventas totales o dispersión? Usá esos datos para ajustar cupos, comisiones y ventanas de publicación. Los eventos colaborativos exitosos suelen repetirse anualmente con la misma landing y marca acumulada."
      ),
      h2("Profundización operativa"),
      p(
        "Un error frecuente es crear el evento el día anterior sin condiciones escritas. Dedicá tiempo a redactar condiciones para fotógrafos: qué equipamiento se espera, si hay exclusividad de zona, cómo se comportan descuentos y qué pasa con material captado fuera del predio. Los fotógrafos profesionales valoran previsibilidad; los principiantes necesitan indicaciones explícitas de acreditación. Ambos perfiles pueden coexistir si el organizador segmenta cupos —por ejemplo, fotógrafos senior en meta y colaboradores en puntos intermedios."
      ),
      p(
        "La visibilidad del evento —público, no listado o privado— afecta si aparece en exploraciones internas o solo mediante link directo. Torneos cerrados de club suelen ser no listados; maratones abiertos buscan máximo alcance público. Elegí la opción acorde a contratos con sponsors y a si querés convocatoria abierta de fotógrafos externos."
      ),
      p(
        "Cuando varios fotógrafos comparten el mismo evento, la experiencia de checkout puede advertir entregas separadas de impresiones. Comunicá eso en la landing para que el comprador no espere un único paquete físico si compró a tres autores distintos. En digitales, la entrega es inmediata por autor sin fricción adicional."
      ),
      p(
        "Tras cerrar ventas, el organizador puede usar métricas del evento para negociar la próxima edición: más fotógrafos no siempre significa más ingresos si diluyen ventas por autor; a veces menos cupos con mejor promoción del link rinden más. Documentá aprendizajes en un brief interno para no repetir errores de cupo o de timing de publicación."
      ),
      p(
        "La integración con comisiones del organizador y con búsqueda por selfie convierte al evento colaborativo en hub comercial completo, no solo en directorio de links. Aprovechá esas piezas en conjunto en lugar de tratarlas como funciones aisladas."
      ),
      h2("Próximos pasos en tu operación"),
      p(
        "Pensá el evento colaborativo como producto de dos caras: hacia afuera, una landing simple para el comprador; hacia adentro, un acuerdo claro entre organizador y fotógrafos. Cuanto más explícitas sean las condiciones —comisiones, plazos, acreditación— menos energía gastarás mediando conflictos. Antes de la próxima convocatoria, redactá un documento de una página que puedas reutilizar en cada edición del torneo o carrera."
      ),
      p(
        "La tecnología no reemplaza la presencia en cancha: credenciales, señalética y zonas de seguridad siguen siendo responsabilidad humana. Mezclar logística física y venta online en un solo briefing pre-evento suele elevar la calidad percibida por el club contratante y la tasa de retorno de fotógrafos invitados."
      ),
      h2("Checklist del organizador"),
      p(
        "Antes de abrir convocatoria: condiciones escritas, comisión definida, política de ingreso elegida, indicaciones de acreditación completas. Durante el evento: canal de comunicación activo con fotógrafos. Después: link único promocionado, monitoreo de ventas a las setenta y dos horas, cierre ordenado. Repetir el mismo checklist en cada edición convierte al evento colaborativo en operación predecible, no en improvisación anual."
      ),
      p(
        "Si un fotógrafo incumple condiciones —subida fuera de plazo, precios fuera de reglas— documentá el incidente y aplicá las políticas del evento con transparencia. La reputación del organizador entre colegas depende de consistencia, no de favoritismos."
      ),
      h2("Errores que conviene evitar"),
      p(
        "Abrir convocatoria sin cupo ni condiciones; prometer comisión al club sin configurarla en el panel; publicar link de fotos antes de que haya material; no cerrar el evento y dejar galerías eternas; ignorar mensajes de fotógrafos con problemas de subida el día crítico. Cada error resta confianza para la próxima edición y hace que los mejores fotógrafos elijan otro torneo."
      ),
      h2("Síntesis"),
      p(
        "El evento colaborativo es la forma escalable de cubrir encuentros grandes sin sacrificar una experiencia de compra unificada. El organizador aporta marca y coordinación; los fotógrafos aportan producción; ComprameLaFoto aporta landing, pagos y herramientas como selfie o comisiones. Dominar convocatoria, condiciones y promoción del link es tan importante como dominar la cámara el día del evento."
      ),
      p(
        "Si todavía no participaste en uno, buscá un organizador con buena reputación o creá un evento piloto con pocos fotógrafos de confianza antes de abrir convocatoria masiva. La curva de aprendizaje es más suave con volumen acotado y métricas más fáciles de interpretar."
      ),
      p(
        "En resumen, el evento colaborativo concentra oferta fotográfica, simplifica la compra y reparte valor entre organizador y fotógrafos con reglas explícitas. Es la funcionalidad clave cuando un solo profesional no alcanza a cubrir la magnitud del encuentro."
      ),
    ],
    faq: [
      {
        q: "¿Un fotógrafo puede estar en varios eventos a la vez?",
        a: "Sí, puede participar en distintos eventos colaborativos si cumple las condiciones de cada uno y gestiona sus álbumes asociados.",
      },
      {
        q: "¿El organizador sube fotos?",
        a: "El organizador coordina; la subida habitual la realizan los fotógrafos miembros cuando las subidas están habilitadas.",
      },
      {
        q: "¿Puedo crear un evento sin comisión para el organizador?",
        a: "Sí. La comisión del organizador es opcional y se configura al crear o editar el evento.",
      },
      {
        q: "¿Qué pasa si dos fotógrafos captan la misma escena?",
        a: "Cada uno vende sus archivos. El comprador elige según calidad, precio o preferencia; no hay exclusividad automática salvo que el organizador la establezca en las condiciones.",
      },
      {
        q: "¿El evento tiene fecha de cierre?",
        a: "Los eventos pueden marcarse como cerrados para dejar de aceptar nuevas adhesiones o subidas según la política del organizador.",
      },
    ],
    conclusion:
      "Los eventos colaborativos transforman una red de fotógrafos sueltos en una oferta coherente para el público, con herramientas de coordinación y monetización para quien organiza. Dominar roles, convocatoria y landing es clave para que el modelo rinda en tu próxima carrera o torneo.",
    ctaAudience: resolveCtaAudience(["organizadores", "fotografos"]),
    imageScene:
      "Multiple photographers with cameras at marathon finish line coordinated by organizer with radio, hyperrealistic documentary photography",
    imageAltSubject: "Varios fotógrafos coordinados por un organizador en la meta de una maratón",
    imageCaption: "Un evento colaborativo une cobertura y una sola puerta de entrada para compradores.",
  },

  "como-funcionan-comisiones-organizadores": {
    seoTitle: "Comisiones para organizadores en ComprameLaFoto",
    seoDescription:
      "Cómo se definen, calculan y siguen las comisiones del organizador sobre ventas de fotos en eventos colaborativos.",
    excerpt:
      "Detalle del modelo de comisiones para organizadores de eventos en ComprameLaFoto.",
    blocks: [
      p(
        "Cuando un club, productora o asociación arma un evento colaborativo, muchas veces aporta marca, permisos, difusión y coordinación en cancha sin tomar la cámara. Las comisiones para organizadores alinean ese esfuerzo con un ingreso proporcional a las ventas de fotos del evento. En ComprameLaFoto el organizador puede habilitar una comisión expresada en porcentaje, visible en la configuración del evento, que se calcula sobre las ventas que cumplan las reglas definidas —típicamente fotos vendidas en álbumes vinculados a ese evento. Este artículo detalla cómo se configura, qué ventas computan, cómo se sigue en el panel y qué expectativas de liquidación son razonables."
      ),
      h2("Qué es la comisión del organizador"),
      p(
        "Es un porcentaje acordado —configurado por el organizador al crear o editar el evento— que retiene parte del valor de venta para quien coordinó el encuentro. No es un cargo extra obligatorio al comprador: se distribuye dentro del esquema de precios y fees ya existente, según la lógica financiera del checkout. La comisión reconoce el trabajo de convocatoria, acreditación, difusión del link y gestión post-evento. Puede activarse o dejarse deshabilitada en eventos donde el organizador solo busca facilitar cobertura sin participar económicamente."
      ),
      h2("Configuración por evento"),
      p(
        "Desde el panel del organizador, al crear un evento colaborativo podés activar «comisión del organizador» e indicar el porcentaje deseado dentro de los límites permitidos por la plataforma. El cambio queda registrado con fecha de actualización para transparencia ante fotógrafos que ya se adhirieron. Es buena práctica definir la comisión antes de abrir la convocatoria para que los fotógrafos decidan unirse con información completa. Si modificás el porcentaje después, los fotógrafos activos deberían ser notificados según las condiciones del evento."
      ),
      h3("Relación con precios del fotógrafo"),
      p(
        "El fotógrafo sigue definiendo sus precios base en la mayoría de los modos, salvo que el evento imponga precio fijo o mínimo como regla comercial orientativa. La comisión del organizador se aplica en la capa de distribución del pago, no necesariamente como un recargo visible aparte en el precio mostrado al cliente —el detalle exacto depende de la configuración vigente en checkout. Lo importante para el fotógrafo es entender qué porcentaje retiene el organizador y sobre qué base se calcula antes de confirmar su participación."
      ),
      h2("Ventas que computan"),
      p(
        "En general computan las ventas de fotografías digitales e impresiones realizadas en álbumes asociados al evento con comisión habilitada, una vez aprobadas por Mercado Pago. Devoluciones y contracargos revierten o ajustan los montos correspondientes. Ventas fuera del evento —álbumes personales del mismo fotógrafo no vinculados— no deberían generar comisión de ese organizador. Verificá en tu panel qué pedidos figuran atribuidos al evento para conciliar expectativas con los fotógrafos."
      ),
      h2("Panel de seguimiento"),
      p(
        "El organizador accede a resúmenes de actividad del evento: fotógrafos adheridos, álbumes, ventas agregadas y comisiones acumuladas según los reportes disponibles en el panel. Usá estos datos para decidir refuerzos de difusión —un mail extra al día siguiente de la carrera puede duplicar conversiones— o para planificar el próximo año. Los fotógrafos, por su lado, ven sus propias ventas en su dashboard; la transparencia entre partes evita disputas tardías."
      ),
      h2("Liquidación y cobro"),
      p(
        "La mecánica de liquidación al organizador sigue los flujos financieros de ComprameLaFoto y Mercado Pago: parte del pago del cliente se distribuye en el split de la transacción según reglas de marketplace y comisión de evento. Los plazos de acreditación observan las políticas de Mercado Pago. Si tenés dudas sobre un período concreto, contactá soporte con el identificador del evento y los pedidos en cuestión. Mantené tu cuenta de organizador y datos de cobro actualizados para evitar demoras."
      ),
      h2("Preguntas que conviene cerrar antes del evento"),
      p(
        "¿Qué porcentaje lleva el organizador? ¿Hay precio mínimo o fijo para las fotos? ¿Quién responde ante reclamos de compradores? ¿Cuándo se cierra la venta? Responder esto por escrito en las condiciones del evento reduce fricción. La comisión es una herramienta de partnership: cuando ambas partes entienden el reparto, el evento colaborativo escala con confianza."
      ),
      h2("Ejemplo ilustrativo de reparto"),
      p(
        "Imaginá un evento con comisión del organizador del diez por ciento sobre la base definida en la configuración, una venta de foto digital al público y el fee de marketplace de ComprameLaFoto descontado en el pago con Mercado Pago. El fotógrafo recibe su parte neta, el organizador su comisión acumulada en reportes del evento y la plataforma su fee por procesar la venta. Los porcentajes reales dependen de tu evento y del checkout vigente; usá el panel para ver pedidos concretos en lugar de extrapolar de memoria."
      ),
      h2("Errores comunes al configurar comisiones"),
      p(
        "Activar comisión sin comunicarla antes de la convocatoria genera desconfianza. Cambiar el porcentaje a mitad de ventas sin aviso produce conflictos. Prometer al organizador ingresos irreales sin promoción del link de fotos deja comisiones en cero. Asumir que la comisión se cobra aparte al comprador puede malinterpretar el precio final. La claridad documentada en condiciones del evento evita estos escenarios."
      ),
      h2("Relación con referidos y otros incentivos"),
      p(
        "Si un fotógrafo del evento fue referido por otro usuario, el programa de referidos opera sobre el fee de marketplace según sus reglas —independiente de la comisión del organizador del evento—. Cada capa financiera tiene su lógica; no mezclar conversaciones de «comisión del club» con «comisión de referido» sin leer los detalles de cada programa."
      ),
      h2("Profundización operativa"),
      p(
        "Transparencia con fotógrafos es la base: publicá en condiciones del evento el porcentaje exacto y si hay topes o categorías excluidas. Cuando un fotógrafo entiende el reparto antes de subir miles de archivos, las conversaciones post-evento son de crecimiento, no de desconfianza."
      ),
      p(
        "El panel del organizador debe revisarse periódicamente durante la ventana activa, no solo al final. Picos de ventas suelen ocurrir setenta y dos horas después del evento; un empujón de difusión del link en ese momento beneficia a fotógrafos y comisión del organizador por igual."
      ),
      p(
        "No confundas comisión de organizador con fee de ComprameLaFoto: la plataforma cobra su marketplace fee por procesar el pago; la comisión del organizador es una capa negociada dentro del ecosistema del evento. Tres conceptos —fotógrafo, organizador, plataforma— deben quedar claros en la reunión previa con el club o la productora."
      ),
      p(
        "Si el evento no vendió como esperabas, la comisión en pesos será baja pero el costo de oportunidad del organizador también; evaluá marketing conjunto antes de subir porcentajes. A veces el cuello de botella es difusión, no el split económico."
      ),
      p(
        "Guardá exportaciones o capturas de reportes por edición para comparar año a año y justificar renovación de contrato con la institución que te contrata como organizador."
      ),
      h2("Próximos pasos en tu operación"),
      p(
        "Negociá la comisión como parte del paquete de valor que ofrecés al club: difusión del link, acreditación de fotógrafos, cierre de ventas y reporte a directivos. Si sos fotógrafo adherido, calculá el porcentaje del organizador como costo de adquisición antes de aceptar; si el margen no cierra, negociá o decliná con transparencia."
      ),
      p(
        "Documentá acuerdos especiales —por ejemplo, comisión solo sobre digitales— por escrito si el panel aún no modela esa distinción, y reflejalo en condiciones visibles del evento para evitar interpretaciones divergentes al liquidar."
      ),
      h2("Checklist financiero"),
      p(
        "Al cerrar el evento, conciliá pedidos del panel con expectativas de fotógrafos y organizador. Preguntá: ¿hubo devoluciones? ¿ventas fuera del vínculo del evento que no debían comisionar? ¿el porcentaje configurado coincide con lo acordado verbalmente? Una reunión de treinta minutos post-carrera con los fotógrafos principales evita mails largos semanas después."
      ),
      p(
        "Presentá al club un resumen simple: ventas totales de fotos del evento, comisión del organizador en pesos, próximos pasos de promoción para la edición siguiente. Eso convierte la comisión en línea visible del presupuesto del torneo."
      ),
      h2("Errores que conviene evitar"),
      p(
        "Cambiar porcentaje sin avisar; prometer al club un ingreso fijo sin basarlo en ventas reales; no revisar el panel durante el pico post-evento; mezclar conversaciones de fee de plataforma con comisión del organizador frente a fotógrafos que recién empiezan. La transparencia temprana es más barata que la mediación tardía."
      ),
      p(
        "Si sos fotógrafo, aceptar eventos con comisión desconocida «porque es buen volumen» suele terminar en frustración. Preguntá antes de subir la primera foto."
      ),
      h2("Síntesis"),
      p(
        "Las comisiones del organizador alinean incentivos cuando el club o la productora invierte tiempo y marca en el evento. Configurarlas con claridad en el panel, monitorear ventas y comunicar con fotógrafos convierte un porcentaje abstracto en partnership sostenible. La plataforma registra pedidos; las relaciones humanas determinan si el mismo equipo vuelve el año próximo."
      ),
      p(
        "Revisá el artículo de eventos colaborativos si aún no configuraste tu primer torneo: comisión y landing funcionan mejor cuando el marco del evento ya está sólido. Un porcentaje bien negociado y visible desde el día uno evita fricción cuando las ventas crecen y el dinero en juego deja de ser simbólico."
      ),
      p(
        "La comisión del organizador no es un extra oculto para el comprador ni un reemplazo del fee de ComprameLaFoto: es el reparto acordado dentro del ecosistema del evento. Entender esa distinción te permite explicar el modelo a clubes, fotógrafos y sponsors sin mezclar conceptos financieros que generan desconfianza en la primera reunión."
      ),
      p(
        "Activá la comisión solo cuando tengas claro el valor que aportás en difusión y coordinación; un cero por ciento honesto supera un porcentaje mal explicado que nadie comprende al cobrar."
      ),
    ],
    faq: [
      {
        q: "¿La comisión la paga el comprador aparte?",
        a: "No se presenta como un ítem extra obligatorio al cliente; se distribuye dentro del esquema de precios y pagos del pedido según la configuración del evento y el checkout.",
      },
      {
        q: "¿Puedo cambiar el porcentaje después de empezar?",
        a: "Podés actualizar la configuración del evento, pero debés comunicar el cambio a los fotógrafos ya adheridos según las condiciones que aceptaron.",
      },
      {
        q: "¿El organizador cobra sobre impresiones y digitales?",
        a: "Las ventas elegibles del evento —digitales e impresiones vinculadas— suelen computar según las reglas del evento; confirmá en tu panel los pedidos atribuidos.",
      },
      {
        q: "¿Qué pasa si no activo comisión?",
        a: "El evento funciona igual como coordinación; simplemente no participás económicamente de las ventas de fotos.",
      },
      {
        q: "¿Necesito Mercado Pago como organizador?",
        a: "Para operar cobros en la plataforma se utiliza Mercado Pago en el flujo de ventas; asegurate de tener tu perfil de organizador completo y datos de contacto válidos.",
      },
    ],
    conclusion:
      "Las comisiones para organizadores permiten monetizar la coordinación de eventos fotográficos sin sacar la cámara, siempre que el porcentaje y las reglas queden claros desde el inicio. Configurar, monitorear y comunicar con transparencia convierte la comisión en un incentivo sostenible para todos.",
    ctaAudience: resolveCtaAudience(["organizadores"]),
    imageScene:
      "Event organizer reviewing sales split chart on tablet in sports club office, hyperrealistic documentary photography",
    imageAltSubject: "Organizador revisando gráfico de reparto de ventas en una tablet",
    imageCaption: "La comisión del organizador reconoce coordinación y difusión del evento.",
  },

  "como-funciona-preventa-escolar": {
    seoTitle: "Preventa escolar en ComprameLaFoto",
    seoDescription:
      "Cómo funciona la preventa escolar: cobro anticipado, flujo para familias y fotógrafos, plazos y vínculo con la galería.",
    excerpt:
      "Preventa escolar: cobro anticipado, plazos y entrega de fotografías a familias.",
    blocks: [
      p(
        "La preventa escolar organiza la venta de fotografía institucional antes de la entrega final del material impreso o digital. En lugar de esperar semanas con caja física y planillas en papel, las familias eligen pack o productos en una ventana de tiempo definida, pagan online con Mercado Pago y el fotógrafo o la institución obtiene un padrón de pedidos claro para producción. ComprameLaFoto integra este flujo con álbumes escolares, listas de alumnos cuando corresponde e identificación por curso o nombre para reducir errores de asignación. Este artículo explica qué es la preventa, cómo la viven padres y escuelas, qué hace el fotógrafo en cada etapa y cómo se conecta con la galería posterior."
      ),
      h2("Qué es la preventa y por qué usarla"),
      p(
        "En la fotografía escolar tradicional, el fotógrafo dispara en marzo, entrega muestras en abril y cobra en efectivo en mayo con filas de padres. La preventa invierte parte de ese orden: primero se acuerdan productos y precios, luego se abre un período de compra online y recién después se produce según lo vendido. Eso reduce stock impreso que no se vende, mejora el flujo de caja y da a la escuela una experiencia moderna alineada con otros pagos digitales que las familias ya usan."
      ),
      h2("Flujo para familias"),
      p(
        "La escuela o el fotógrafo comparte un link de preventa o acceso al álbum escolar. El padre o tutor identifica al alumno —por listado, curso o datos solicitados—, revisa las fotos disponibles o el diseño del pack contratado, elige tamaños y cantidades si hay opciones, y paga con Mercado Pago. Recibe confirmación del pedido y, según la campaña, acceso posterior a digitales o seguimiento del estado de impresión. La comunicación clara de fechas límite —«la preventa cierra el viernes 15»— es esencial para no recibir reclamos de quien llegó tarde."
      ),
      ul([
        "Acceder al link de preventa enviado por la escuela o el fotógrafo.",
        "Identificar al alumno para asignar correctamente el pedido.",
        "Elegir pack o productos habilitados en la campaña.",
        "Pagar online y guardar el comprobante.",
        "Canjear beneficios digitales o retirar impresas según el cronograma anunciado.",
      ]),
      h2("Flujo para el fotógrafo"),
      p(
        "Configurás el álbum escolar, definís packs —ejemplo: carpeta con retrato individual y grupal—, precios y ventana de preventa. Si usás padrón de alumnos, sincronizás cursos y nombres para que cada familia encuentre rápido su fila. Durante la preventa monitoreás pedidos en el panel, respondés consultas puntuales y cerrás la ventana a tiempo. Tras el cierre, exportás o gestionás la producción con laboratorio según lo vendido, no según estimaciones a ojo. Cuando las impresiones están listas, coordinás entrega en la escuela o retiro por familias, y liberás digitales si el pack los incluye."
      ),
      h2("Plazos, cierre y comunicación con la escuela"),
      p(
        "Acordá con la institución tres fechas: apertura de preventa, cierre y entrega estimada. La escuela suele ayudar con un mail a padres o un aviso en el grupo de curso; el fotógrafo provee el texto y el link. Después del cierre, evitá reabrir excepciones sin criterio para no desordenar producción. Si una familia no compró en preventa, podés definir una segunda ventana con recargo o venta solo digital según tu política comercial."
      ),
      h2("Integración con la galería escolar"),
      p(
        "La preventa no es un sistema aislado: se apoya en el álbum escolar de ComprameLaFoto, con modos de privacidad pensados para menores y datos institucionales. Tras la campaña, las fotos pueden seguir disponibles para compras adicionales —ampliaciones, hermanos, egresados— según lo que configures. El padrón ayuda a evitar que un pedido quede sin alumno asignado, un error costoso en tiradas impresas."
      ),
      h2("Buenas prácticas"),
      p(
        "Mostrá muestras de años anteriores a la escuela antes de definir packs. Ofrecé dos o tres opciones de precio, no diez. Usá fotos de identificación claras en el día de sesión para que cada alumno sea reconocible. Recordá en todos los canales que el pago es digital y que el plazo es firme. Documentá autorizaciones de imagen según lo que requiera la institución."
      ),
      h2("Privacidad y datos de alumnos"),
      p(
        "La preventa escolar puede solicitar datos para identificar alumnos y evitar duplicados entre álbumes de la misma institución. Esos datos se usan para operar la venta, no para fines ajenos al servicio. La escuela y el fotógrafo deben alinear comunicación a familias sobre uso de imágenes y datos personales según normativa aplicable y políticas de ComprameLaFoto para el módulo escolar."
      ),
      h2("Después de la preventa: venta abierta"),
      p(
        "Cerrada la preventa, podés mantener el álbum activo para compras adicionales —hermanos, egresados, ampliaciones— con precios distintos si lo definís así. El snapshot del pack preventa queda registrado en pedidos para producción; no mezcles pedidos cerrados con nuevas campañas sin conciliar en el panel."
      ),
      h2("Coordinación con laboratorio e impresión"),
      p(
        "La preventa anticipa volumen: sabés cuántas carpetas imprimir antes de enviar archivos al laboratorio. Eso reduce merma y mejora plazos de entrega en el colegio. Si el pack incluye digital, programá la liberación de descargas en el cronograma acordado con la institución —algunas escuelas prefieren entregar digitales solo después del acto de entrega física."
      ),
      h2("Profundización operativa"),
      p(
        "La preventa funciona mejor cuando la escuela compromete dos recordatorios oficiales: uno al abrir y otro cuarenta y ocho horas antes del cierre. El fotógrafo provee texto corto y link; la institución lo envía por su canal habitual. Esa dupla evita que solo los padres más activos entren en la primera semana."
      ),
      p(
        "Definí packs con nombres comprensibles —«Carpeta estándar», «Solo digital», «Hermanos»— en lugar de códigos internos. Las familias compran emocionalmente el recuerdo del ciclo lectivo; la claridad del pack reduce abandono de carrito."
      ),
      p(
        "Si usás padrón institucional, sincronizá cursos entre álbumes de la misma escuela para que un alumno no aparezca duplicado en dos listas incompatibles. La operativa de roster es tan importante como la sesión de fotos en sí."
      ),
      p(
        "Después del cierre, comunicá fecha de entrega física con margen realista de laboratorio. Prometer «la semana que viene» sin confirmar tirada puede generar oleadas de mensajes. Mejor una fecha firme con unos días de buffer."
      ),
      p(
        "La preventa puede convivir con venta posterior de ampliaciones o fotos individuales extra a precio distinto; dejá explícito qué quedó cubierto por el pack ya pagado para no generar sensación de doble cobro."
      ),
      h2("Próximos pasos en tu operación"),
      p(
        "Involucrá al preceptor o secretaría en una reunión breve antes de abrir la preventa: mostráles la pantalla de compra y la fecha de cierre. Cuando el personal institucional entiende el flujo, deriva menos consultas al fotógrafo. Llevá FAQ para familias con poca familiaridad digital."
      ),
      p(
        "La preventa exitosa repite instituciones cuando la entrega cumple lo prometido: carpetas por curso, nombres legibles, plazos respetados. Priorizá operación impecable en la primera escuela piloto antes de escalar a muchos colegios en paralelo."
      ),
      h2("Checklist de campaña escolar"),
      p(
        "Sesión fotográfica con identificación clara; packs definidos y aprobados por dirección; padrón sincronizado si aplica; apertura y cierre de preventa comunicados dos veces; monitoreo diario de pedidos; cierre sin excepciones caóticas; producción según vendido; entrega en fecha anunciada. Cada ítem fallido se convierte en diez mensajes de padres. La preventa digital magnifica eficiencia y también magnifica errores operativos."
      ),
      p(
        "Después de la entrega, ofrecé ventana corta de compras adicionales solo si podés cumplirla operativamente. Mejor cerrar bien una campaña que extenderla indefinidamente y perder foco del próximo colegio."
      ),
      h2("Errores que conviene evitar"),
      p(
        "Abrir preventa sin padrón cuando el colegio tiene cuatrocientos alumnos; packs demasiado complejos; reabrir cierre diez veces por excepciones; imprimir antes de cerrar ventas; no coordinar entrega con horarios escolares. La preventa digital castiga con el mismo volumen de mensajes que antes, pero en menos tiempo, si la operación no está lista."
      ),
      p(
        "Prometer digitales el mismo día de la sesión si tu flujo incluye retoque masivo: alineá expectativas de familias con plazos reales de edición y producción."
      ),
      h2("Síntesis"),
      p(
        "La preventa escolar ordena cobro, producción y entrega en un flujo digital que las familias ya entienden por otros pagos con Mercado Pago. Integrada al álbum escolar y, cuando corresponde, al padrón institucional, reduce errores y merma. El fotógrafo gana previsibilidad; la escuela gana modernidad; las familias ganan claridad de plazos y productos."
      ),
      p(
        "El tutorial «cómo crear una preventa» del blog complementa esta vista de funcionalidad con pasos tácticos de configuración en el panel del fotógrafo. Las escuelas que adoptan preventa digital suelen repetir el modelo al ver menos filas de padres y menos errores de cobro en efectivo."
      ),
      p(
        "La preventa escolar en ComprameLaFoto une álbum, padrón cuando aplica, cobro con Mercado Pago y producción según lo vendido. No elimina el trabajo creativo ni logístico del fotógrafo, pero sí convierte un proceso opaco en números claros antes de imprimir una sola carpeta."
      ),
      p(
        "Coordiná con dirección una fecha de cierre visible en cartelería del colegio; la preventa digital también necesita recordatorios físicos en el pasillo para llegar a familias menos conectadas. Un cartel con QR al link de preventa suele duplicar visitas la última semana de campaña en colegios donde el grupo de padres no lee todos los mails institucionales. Guardá captura del panel de pedidos al cierre como respaldo operativo ante consultas tardías de familias o de dirección. Ese hábito de cierre ordenado diferencia al fotógrafo escolar que escala a muchas instituciones sin perder control."
      ),
    ],
    faq: [
      {
        q: "¿La preventa obliga a comprar?",
        a: "No. Es una ventana opcional con condiciones y precios de campaña; quien no compra en preventa puede quedar fuera de ciertos packs o precios según lo defina el fotógrafo.",
      },
      {
        q: "¿Puedo pagar en efectivo?",
        a: "El flujo estándar de preventa en la plataforma es pago online con Mercado Pago; consultá con tu fotógrafo si hay excepciones acordadas con la escuela.",
      },
      {
        q: "¿Qué pasa si me equivoqué de alumno?",
        a: "Contactá de inmediato al fotógrafo o soporte con el número de pedido; antes del cierre es más fácil corregir asignaciones.",
      },
      {
        q: "¿Incluye fotos digitales?",
        a: "Depende del pack contratado. Algunos incluyen digitales, otros solo impresas; leé la descripción antes de pagar.",
      },
      {
        q: "¿La escuela necesita cuenta?",
        a: "La operación la lidera el fotógrafo; la escuela colabora en difusión y logística de entrega. Podés vincular perfiles institucionales según las opciones activas.",
      },
    ],
    conclusion:
      "La preventa escolar digitaliza el corazón del negocio escolar —pedido, cobro y producción— sin perder el vínculo con la institución. Bien planificada, reduce desperdicio, mejora la experiencia de las familias y deja al fotógrafo con números claros antes de imprimir.",
    ctaAudience: resolveCtaAudience(["fotografos", "escuelas"]),
    imageScene:
      "School parents paying for photo package at school office desk, photographer presenting samples, hyperrealistic documentary photography",
    imageAltSubject: "Padres revisando packs de fotos escolares con el fotógrafo en la institución",
    imageCaption: "La preventa ordena pedidos y pagos antes de la producción final.",
  },

  "como-funciona-marketplace-fotografos": {
    seoTitle: "Marketplace de fotógrafos en ComprameLaFoto",
    seoDescription:
      "Directorio público de fotógrafos: perfil, especialidades, ubicación y contacto para que nuevos clientes te encuentren.",
    excerpt:
      "Directorio y visibilidad de fotógrafos: perfil público, especialidades y contacto.",
    blocks: [
      p(
        "El marketplace de fotógrafos de ComprameLaFoto es el directorio público donde potenciales clientes descubren profesionales según especialidad, zona y estilo de trabajo. A diferencia de un álbum de evento —pensado para vender fotos de una fecha concreta— el marketplace muestra quién sos, qué tipo de trabajos hacés y cómo contactarte para encargos futuros. Es una capa de adquisición: quien quedó conforme con sus fotos de la maratón puede recomendarte, pero quien busca «fotógrafo de egresadas en Rosario» necesita encontrarte sin conocer tu link privado. Este artículo explica cómo funciona el perfil público, cómo aparecés en el directorio, qué datos conviene completar y en qué se diferencia de las galerías de venta por evento."
      ),
      h2("Perfil público del fotógrafo"),
      p(
        "Tu perfil agrupa nombre comercial o artístico, foto de presentación, descripción breve, especialidades —deportes, escuelas, bodas, producto— y datos de contacto o enlace a tu web. Es la carta de presentación ante quien no te conoce aún. Un perfil completo transmite seriedad: ortografía cuidada, portfolio representativo y expectativas claras sobre zonas de trabajo y plazos de entrega. El marketplace no reemplaza tu sitio propio, pero centraliza visibilidad dentro del ecosistema ComprameLaFoto, donde ya hay compradores habituados a pagar con Mercado Pago."
      ),
      h2("Especialidades y ubicación"),
      p(
        "Los filtros del directorio permiten al visitante acotar por tipo de fotografía y ubicación geográfica. Si etiquetás mal tus especialidades —por ejemplo, marcás «bodas» sin tener trabajos de ese rubro— generás leads de baja calidad y frustración. Mejor pocas etiquetas honestas que muchas genéricas. La ubicación ayuda a quien busca cobertura presencial; si viajás a todo el país, indicá las zonas donde aceptás trabajos sin costo de traslado y cómo cotizás desplazamientos adicionales."
      ),
      h2("Cómo aparecer en el directorio"),
      p(
        "Generalmente necesitás tener cuenta de fotógrafo activa, perfil completado según los requisitos del marketplace y aceptar las condiciones de publicación. No todos los campos son obligatorios el primer día, pero un perfil al 40% rara vez convierte. Completá bio, especialidades, zona y al menos un conjunto de imágenes representativas. Si el marketplace valida perfiles manualmente en algún tramo del proceso, respetá los plazos de revisión antes de promocionar tu URL pública."
      ),
      ul([
        "Completar datos de contacto y Mercado Pago conectado si ofrecés venta directa por la plataforma.",
        "Elegir especialidades alineadas a tu portfolio real.",
        "Subir imágenes que muestren calidad técnica y estilo reconocible.",
        "Mantener actualizada la zona de cobertura y disponibilidad.",
      ]),
      h2("Contacto y conversión"),
      p(
        "El marketplace suele terminar en un contacto: formulario, WhatsApp, mail o solicitud de presupuesto según la configuración. Tu velocidad de respuesta define la conversión tanto como el portfolio. Definí un mensaje tipo para consultas —qué incluye el servicio, seña, plazos— y derivá a álbumes de ComprameLaFoto cuando el trabajo sea de venta masiva post-evento. El directorio abre la puerta; el cierre comercial sigue siendo tuyo."
      ),
      h2("Diferencia con galerías de evento"),
      p(
        "Un álbum de carrera o escuela tiene audiencia captiva: quien corrió o tiene un hijo en el colegio ya está motivado a comprar. El marketplace compite por atención con otros fotógrafos listados. Por eso el posicionamiento importa: reseñas, trabajos previos visibles, claridad de precios orientativos y coherencia entre lo que prometés y lo que entregás. Muchos fotógrafos usan el marketplace para sesiones privadas y ComprameLaFoto para la venta self-service de eventos masivos."
      ),
      h2("Buenas prácticas de perfil"),
      p(
        "Actualizá el portfolio cada temporada. Eliminá imágenes débiles aunque te gusten personalmente. Pedí permiso para mostrar trabajos de clientes cuando la licencia lo permita. Enlazá desde tu Instagram o web al perfil del marketplace para reforzar autoridad. Medí de dónde vienen las consultas y ajustá especialidades según demanda real, no solo según lo que te gustaría fotografiar."
      ),
      h2("SEO y descubrimiento en el blog"),
      p(
        "El marketplace se complementa con tu presencia en el blog y tutoriales de ComprameLaFoto cuando participás en la comunidad. Un fotógrafo visible en directorio y con contenido educativo transmite más confianza que un perfil vacío. No es obligatorio, pero coherencia de marca entre galerías de evento y perfil público ayuda al cliente a recordarte."
      ),
      h2("Qué no esperar del directorio"),
      p(
        "El marketplace no garantiza volumen de consultas sin esfuerzo propio de promoción. No reemplaza boca a boca en eventos ni acuerdos con organizadores. No muestra automáticamente todas tus galerías privadas: el cliente que compró en la maratón sigue entrando por el link del evento. Pensalo como capa de adquisición para trabajos futuros, no como motor único de ventas del fin de semana."
      ),
      h2("Integración con ventas por álbum"),
      p(
        "Cuando cerrás un encargo nacido del marketplace, podés operar la venta masiva del evento en ComprameLaFoto y seguir cobrando con Mercado Pago en el mismo ecosistema. El comprador percibe continuidad; vos centralizás reportes. Evitá derivar a medios de pago fuera de la plataforma si querés mantener historial y protecciones del flujo integrado."
      ),
      h2("Profundización operativa"),
      p(
        "Pensá el marketplace como tarjeta de presentación permanente: la bio debe decir en dos párrafos qué problemas resolvés —«cobertura de rugby con entrega al día siguiente»— y en qué zonas. Evitá clichés vacíos del tipo «capturo emociones» sin contexto concreto."
      ),
      p(
        "Las imágenes del perfil deben mostrar variedad dentro de tu nicho: iluminación, encuadre y momento. Un solo estilo repetido diez veces no demuestra versatilidad; tres estilos distintos bien ejecutados sí transmiten profesionalismo."
      ),
      p(
        "Respondé consultas en menos de veinticuatro horas hábiles cuando sea posible. El directorio no cierra ventas por vos; la velocidad de respuesta es tu ventaja frente a perfiles inactivos."
      ),
      p(
        "Si también vendés en eventos masivos por ComprameLaFoto, mencioná en el perfil que tus clientes de eventos compran online con Mercado Pago: eso tranquiliza a quien nunca te contrató."
      ),
      p(
        "Revisá el perfil cada trimestre: fotos viejas de equipos que ya no existen o precios desactualizados restan credibilidad."
      ),
      h2("Próximos pasos en tu operación"),
      p(
        "Pedí testimonios breves de clientes satisfechos y sumalos a la descripción del perfil con permiso. La prueba social diferencia tu listing de perfiles sin historial. Actualizá la ubicación si cambiás tu zona de trabajo habitual."
      ),
      p(
        "Combiná marketplace con contenido educativo: si participás en el blog o compartís tutoriales, enlazá a tu perfil público para cerrar el círculo entre autoridad y contacto comercial. El directorio alimenta tu marca y tu marca alimenta el directorio."
      ),
      h2("Checklist de perfil público"),
      p(
        "Foto de perfil actualizada; bio con zona y especialidades reales; al menos ocho imágenes representativas; datos de contacto verificados; Mercado Pago conectado si vendés por la plataforma; revisión ortográfica; enlace desde tu web o Instagram. Completar el checklist no garantiza consultas, pero un perfil incompleto casi garantiza que te ignoren frente a un colega que sí lo completó."
      ),
      p(
        "Medí consultas por trimestre y ajustá especialidades según qué tipo de encargo te llega. El marketplace es experimento continuo, no configuración de una sola vez."
      ),
      h2("Errores que conviene evitar"),
      p(
        "Perfil vacío o con imágenes de baja calidad; especialidades que no coinciden con el portfolio; demorar respuestas a consultas; prometer en la bio servicios que no ofrecés por ComprameLaFoto ni por tu estudio. El directorio amplifica tu imagen profesional o tu amateurismo, según lo que publiques."
      ),
      p(
        "Copiar la misma bio que otros fotógrafos no diferencia; contá qué eventos cubriste, qué plazos cumplís y cómo cobrás. Especificidad genera confianza."
      ),
      h2("Síntesis"),
      p(
        "El marketplace de fotógrafos es la vitrina permanente de ComprameLaFoto para quien busca contratar, no solo comprar un recuerdo de un día. Un perfil completo, honesto y actualizado convierte búsquedas en consultas; las consultas en trabajos que luego podés vender por álbumes y eventos en la misma plataforma. Es complemento del negocio masivo, no sustituto."
      ),
      p(
        "Invertí tiempo trimestral en revisar especialidades, imágenes y tiempos de respuesta. El directorio premia consistencia más que cantidad de palabras clave."
      ),
      p(
        "Quien te encuentra en el marketplace y queda conforme con un encargo puede convertirse en comprador recurrente de tus galerías de evento: tratá ambos canales como un solo negocio con dos puertas de entrada. Invertir una tarde en fotos de perfil y redacción de la bio suele rendir más que meses de publicidad genérica sin portfolio detrás."
      ),
      p(
        "El marketplace no compite con tus álbumes de evento: los complementa. Un directorio sólido trae encargos futuros; una galería bien promocionada convierte al público caliente del día del evento. Usar ambos es la estrategia más común entre fotógrafos que crecieron con ComprameLaFoto en Argentina."
      ),
      p(
        "Actualizá el perfil después de cada temporada alta con nuevas imágenes representativas; un marketplace con fotos de hace cinco años comunica estancamiento aunque tu trabajo actual sea excelente. Respondé consultas con un presupuesto orientativo cuando sea posible: reduce idas y vueltas y filtra clientes que no encajan con tu zona o especialidad. Enlazá tu perfil desde la firma de mail y desde la bio de Instagram cada vez que publiques cobertura de un evento vendido por ComprameLaFoto; el tráfico cruzado entre compradores de un día y clientes de encargo futuro es uno de los usos menos explotados del directorio. El marketplace premia claridad y constancia más que perfección técnica absoluta en cada imagen publicada."
      ),
      p(
        "Si tu objetivo es llenar el calendario de encargos, tratá el directorio como canal de prospección serio: revisión mensual del perfil, respuesta rápida y coherencia entre lo que mostrás y lo que entregás en el primer trabajo contratado. Pequeños gestos de mantenimiento suman visibilidad con el tiempo."
      ),
    ],
    faq: [
      {
        q: "¿El marketplace tiene costo extra?",
        a: "La publicación en el directorio sigue las condiciones generales de la plataforma; no hay un modelo separado publicado de suscripción solo por listarse, pero las ventas que proceses por ComprameLaFoto aplican el fee habitual.",
      },
      {
        q: "¿Puedo ocultar mi perfil temporalmente?",
        a: "Según las opciones de tu cuenta, podés pausar visibilidad si estás sin cupo; consultá en configuración o soporte.",
      },
      {
        q: "¿Los clientes compran directo desde el marketplace?",
        a: "El foco es descubrimiento y contacto. Las ventas de eventos masivos suelen ocurrir en álbumes o landings de evento vinculados a tu cuenta.",
      },
      {
        q: "¿Qué pasa si tengo varias especialidades?",
        a: "Podés marcar más de una si tu portfolio lo respalda; priorizá las que mejor convierten para no diluir tu mensaje.",
      },
      {
        q: "¿Aparecen mis precios de álbum privado?",
        a: "El marketplace muestra información de perfil; los precios de cada galería se configuran en el álbum correspondiente.",
      },
    ],
    conclusion:
      "El marketplace convierte ComprameLaFoto en vitrina permanente de tu trabajo, más allá del pico de ventas post-evento. Un perfil honesto, completo y actualizado atrae consultas calificadas y complementa tus galerías de venta directa.",
    ctaAudience: resolveCtaAudience(["fotografos", "clientes"]),
    imageScene:
      "Photographer portfolio wall and laptop showing public profile page, studio environment, hyperrealistic documentary photography",
    imageAltSubject: "Fotógrafo con portfolio físico y perfil público abierto en la notebook",
    imageCaption: "El marketplace muestra tu trabajo a quien busca un fotógrafo nuevo.",
  },

  "como-funciona-venta-impresiones": {
    seoTitle: "Venta de impresiones en ComprameLaFoto",
    seoDescription:
      "Catálogo, pedido, producción en laboratorio, envío o retiro y estados del pedido en la venta de impresiones.",
    excerpt:
      "Producción, laboratorio y entrega de impresiones vendidas a través de la plataforma.",
    blocks: [
      p(
        "La venta de impresiones en ComprameLaFoto conecta tu galería —o el flujo de pedido directo del cliente— con producción en laboratorio, seguimiento de estado y cobro integrado con Mercado Pago. Mientras la venta digital entrega un archivo en minutos, la impresión implica tamaños, papeles, recortes, control de color y logística de entrega o retiro. La plataforma estandariza ese recorrido para que el comprador elija productos con precios visibles, pague una vez y reciba actualizaciones sin coordinar por mensaje cada cambio de estado. Para el fotógrafo, habilitar impresiones amplía el ticket promedio y atiende a quien prefiere un recuerdo físico sin abandonar el canal online."
      ),
      h2("Catálogo de productos"),
      p(
        "El catálogo define qué puede comprarse impreso: tamaños clásicos —10×15, 13×18, formatos poster—, acabados mate o brillo, polaroids o productos especiales según integración con laboratorio. Cada ítem tiene precio configurado por el fotógrafo o heredado de lista preferida del laboratorio asociado. Mostrar pocas opciones bien explicadas reduce abandono del carrito; demasiadas variantes confunden en eventos masivos. Los packs que combinan digital más impresa simplifican la decisión y suelen ser los más vendidos en escuelas y deportes."
      ),
      h2("Pedido del cliente"),
      p(
        "El comprador navega la galería, selecciona fotos y elige «impresión» en el tamaño deseado o agrega un pack que ya incluye copias físicas. En pedidos de impresión sin galería —el cliente sube sus propios archivos— el flujo guía carga de imágenes, validación básica de resolución y selección de cantidades. Antes de pagar, el carrito resume ítems, dirección de envío o punto de retiro y total con Mercado Pago. Si hay varios fotógrafos en un mismo checkout colaborativo, puede mostrarse advertencia de entregas separadas."
      ),
      h2("Producción en laboratorio"),
      p(
        "Una vez aprobado el pago, el pedido pasa a cola de producción según el laboratorio vinculado. Los archivos se envían con perfiles de color y recorte acordes al producto. El laboratorio imprime, controla calidad y marca el pedido como en producción o listo. El fotógrafo puede hacer de intermediario comercial —define precio al público— mientras la producción la ejecuta el lab integrado, o producir localmente si su operación lo permite y la plataforma lo soporta en su modalidad."
      ),
      h2("Envío o retiro"),
      p(
        "Según configuración, el cliente elige envío a domicilio con correo o cadena logística asociada, o retiro en punto definido —estudio del fotógrafo, escuela, club—. Los plazos deben comunicarse con honestidad: una impresión el mismo día del evento rara vez es viable a escala. En preventas escolares, la entrega suele concentrarse en un día en la institución para reducir costos logísticos."
      ),
      h2("Estados del pedido y soporte"),
      p(
        "Típicos estados: pendiente de pago, pagado, en producción, listo para retiro, enviado, entregado. Tanto cliente como fotógrafo ven el avance en el panel, lo que reduce consultas repetitivas por WhatsApp. Si hay problema de calidad —corte mal hecho, manchas— el canal de soporte y el fotógrafo coordinan reimpresión según políticas. Documentar condiciones de reclamo en la galería evita malentendidos."
      ),
      h2("Recomendaciones técnicas"),
      p(
        "Avisá al comprador que la calidad de impresión depende del archivo original. Si vendés digital en resolución alta, la impresión rinde mejor. Para uploads del cliente, sugerí tamaños mínimos por producto. En eventos, disparar con margen de recorte para formatos verticales evita sorpresas en polaroids o cuadrados de Instagram mal adaptados a 10×15."
      ),
      h2("Impresiones en preventa escolar"),
      p(
        "En campañas escolares, la impresión suele concentrarse en packs cerrados —carpeta, individual, grupo— vendidos en preventa. El laboratorio recibe tirada conocida; el fotógrafo no imprime de más. Comunicá en la descripción del pack qué tamaños y acabados incluye para que no haya reclamos por expectativas distintas."
      ),
      h2("Packs digital más impresa"),
      p(
        "Ofrecer «digital + impresa» en un solo ítem simplifica la compra emocional post-evento: el cliente se lleva archivo y recuerdo físico. Definí si la digital se libera al instante o al retirar la impresa para no contradecir tu logística. El precio del pack debe contemplar fee de plataforma y costo de lab."
      ),
      h2("Gestión de reclamos y reproducción"),
      p(
        "Guardá trazabilidad del pedido: número, producto, fecha de producción. Si hay defecto de lab, gestioná reimpresión con evidencia fotográfica. Si el error fue archivo enviado, definí política clara de costos. La plataforma documenta estados; la resolución humana sigue siendo clave en impresión física."
      ),
      h2("Profundización operativa"),
      p(
        "El catálogo de impresiones debe alinearse con lo que tu laboratorio realmente produce sin demoras excepcionales. Ofrecer tamaños exóticos que tardan el triple puede generar reclamos aunque el margen sea alto."
      ),
      p(
        "En eventos deportivos, la impresión en sitio —si tu operación lo permite— puede convivir con venta online para entrega posterior; dejá claro en la galería qué modalidad aplica para no mezclar expectativas de retiro inmediato con envío por correo."
      ),
      p(
        "Los pedidos con archivos subidos por el cliente requieren validación de derechos: el comprador declara que puede imprimir esas imágenes. Como fotógrafo o lab, documentá el flujo de pedido ante reclamos."
      ),
      p(
        "Controlá estados de pedido diariamente en campañas escolares concentradas: un lote grande a producción mal cargado afecta a decenas de familias a la vez."
      ),
      p(
        "Combiná impresión con digital en pack para subir ticket promedio sin obligar a quien solo quiere archivo."
      ),
      h2("Próximos pasos en tu operación"),
      p(
        "Antes de abrir venta de impresiones en un evento grande, hacé una prueba de color con el laboratorio usando archivos representativos de ese set. Documentá en la galería el tipo de papel para alinear expectativas de familias exigentes."
      ),
      p(
        "En campañas con alto volumen, asigná un día fijo de revisión de pedidos en producción para interceptar errores antes del envío masivo al colegio. Si ofrecés retiro en estudio, publicá horario y dirección exacta en la confirmación de pedido."
      ),
      p(
        "La impresión falla más a menudo por logística de última milla que por defecto de archivo: una hora de control de calidad a mitad de tirada puede ahorrar días de reimpresiones y mensajes de padres o clientes corporativos."
      ),
      h2("Checklist de impresión"),
      p(
        "Catálogo alineado al lab; prueba de color; textos de plazo en galería; estados de pedido revisados cada mañana en campañas activas; política de reclamo visible; packs digital más impresa probados en checkout antes de anunciar. Saltear la prueba de checkout es la causa más común de «el cliente no vio la opción de tamaño X» en eventos escolares."
      ),
      p(
        "Si usás retiro en escuela, coordiná con dirección un espacio y horario que no interrumpa actividades; la logística institucional es tan importante como el papel fotográfico."
      ),
      h2("Errores que conviene evitar"),
      p(
        "Ofrecer tamaños que el lab no produce a tiempo; no indicar plazos; mezclar pedidos de eventos distintos en una misma tirada sin control; ignorar estados «en producción» estancados. Cada pedido impreso es tangible: el cliente recuerda el mal resultado años."
      ),
      p(
        "Vender impresión de archivos con resolución insuficiente sin advertir al comprador genera reclamos legítimos. Mejor bloquear tamaños incompatibles o mostrar advertencia en checkout."
      ),
      h2("Síntesis"),
      p(
        "La venta de impresiones conecta tu galería o el upload del cliente con laboratorio, estados de pedido y logística. Es el complemento físico del negocio digital: mismo checkout, misma pasarela, distinta cadena de valor después del pago. Catálogo honesto, plazos realistas y control de calidad miden si la impresión es rentable o fuente de estrés."
      ),
      p(
        "En escuelas y eventos, la impresión suele concentrarse en packs preventa; en deportes, en compras impulsivas post-carrera. Adaptá catálogo y mensajes a cada contexto sin duplicar la misma oferta en todos lados."
      ),
      p(
        "Consultá el tutorial de venta de impresiones para el paso a paso de habilitación en tu cuenta y las opciones de laboratorio disponibles según tu perfil. La impresión bien operada suele tener menor volumen que la digital pero mayor lealtad del cliente que quiere objeto físico en la mesa de living."
      ),
      p(
        "Desde la funcionalidad de impresiones, el comprador vive un flujo similar al de la digital hasta el pago; después se abre la cadena de producción y entrega. Estados visibles y expectativas de plazo honestas convierten la impresión en ingreso complementario estable, no en fuente permanente de reclamos."
      ),
      p(
        "Habilitá impresiones solo cuando tu lab o logística puedan cumplir plazos prometidos; es mejor ofrecer pocos formatos bien servidos que un catálogo amplio mal cumplido en temporada pico escolar o post-maratón. Incluí en la galería una línea de texto con plazo estimado de entrega; reduce consultas repetitivas del tipo «cuándo llega mi pedido». Si combinás digital e impresa en pack, verificá en una compra test que el cliente entienda qué recibe en cada canal y en qué orden llegan descarga y físico. La venta de impresiones cierra el círculo entre recuerdo digital inmediato y objeto físico para quien valora ambos en el mismo pedido."
      ),
      p(
        "Documentá tiempos reales de lab en tu primera temporada con impresiones habilitadas; esos datos te permiten prometer plazos creíbles en la segunda sin adivinar. La confianza del comprador en el físico se construye cumpliendo dos o tres campañas seguidas sin retrasos sistemáticos. Un solo reclamo masivo de calidad en escuela puede dañar la preventa del año siguiente; por eso el control de tirada importa tanto como el precio del pack. La impresión es inversión en reputación, no solo en margen unitario. Revisá también estados de pedido con la misma disciplina con la que revisás ventas digitales cada mañana en temporada alta de escuelas o deportes masivos."
      ),
    ],
    faq: [
      {
        q: "¿Puedo vender solo impresiones sin digital?",
        a: "Sí, si tu álbum o flujo de pedido tiene habilitadas impresiones y no obligás digital en el pack.",
      },
      {
        q: "¿Cuánto tarda la producción?",
        a: "Depende del laboratorio, volumen y modalidad de entrega; consultá los plazos indicados en el pedido o con tu fotógrafo.",
      },
      {
        q: "¿Puedo pedir impresiones de fotos que no compré en la galería?",
        a: "Sí existe flujo de pedido de impresión con archivos propios del cliente, sujeto a permisos sobre esas imágenes.",
      },
      {
        q: "¿Hay envío a todo el país?",
        a: "La cobertura depende de la configuración logística del fotógrafo o laboratorio asociado al pedido.",
      },
      {
        q: "¿Qué pasa si el paquete llega dañado?",
        a: "Contactá soporte con fotos del embalaje y el producto; se gestiona según políticas de reclamo y reimpresión.",
      },
    ],
    conclusion:
      "La venta de impresiones suma valor físico al negocio online sin volver a la libreta de pedidos. Catálogo claro, estados visibles y expectativas realistas de plazo convierten la impresión en ingreso recurrente, no en fuente de reclamos.",
    ctaAudience: resolveCtaAudience(["fotografos", "clientes"]),
    imageScene:
      "Photo lab technician inspecting prints under color calibrated light, realistic workflow, hyperrealistic documentary photography",
    imageAltSubject: "Técnico de laboratorio revisando impresiones bajo luz calibrada",
    imageCaption: "Las impresiones pasan por producción y seguimiento de estado hasta la entrega.",
  },

  "como-funciona-venta-fotografias-digitales": {
    seoTitle: "Venta de fotos digitales en ComprameLaFoto",
    seoDescription:
      "Vista previa protegida, carrito, Mercado Pago, entrega automática y formatos en la venta de fotografías digitales.",
    excerpt:
      "Flujo completo de venta digital: vista previa, pago, entrega y descarga.",
    blocks: [
      p(
        "La venta de fotografías digitales es el núcleo de ComprameLaFoto para eventos, escuelas y sesiones: el cliente ve previews, elige las imágenes, paga con Mercado Pago y recibe acceso de descarga sin que intervengas manualmente en cada archivo. Ese automatismo escala cuando hay cientos de compradores el mismo fin de semana post-maratón. Este artículo recorre el flujo completo —desde la vista previa protegida hasta la seguridad del archivo entregado— para fotógrafos que quieren optimizar conversión y para compradores que quieren entender qué están adquiriendo."
      ),
      h2("Vista previa protegida"),
      p(
        "Las galerías muestran versiones en baja resolución o con marca de agua para que el cliente evalúe encuadre y expresión sin obtener el archivo útil gratis. Solo tras el pago se libera la versión en alta resolución acorde al producto vendido. Esta barrera protege tu trabajo y es estándar en la industria de fotografía de eventos. Configurar precios demasiado bajos con previews muy grandes puede incentivar capturas de pantalla; equilibrá calidad de preview con incentivo a comprar."
      ),
      h2("Carrito y checkout"),
      p(
        "El comprador agrega una o varias fotos al carrito, aplica cupones o descuentos por cantidad si están activos —por ejemplo, tres fotos al precio de dos— y procede al checkout. Puede combinar digitales con impresiones en una sola transacción cuando el álbum lo permite. Antes de pagar, revisa email de contacto: ahí llegará la confirmación y el acceso. En eventos colaborativos, el carrito puede agrupar fotos de distintos fotógrafos con una experiencia de pago unificada."
      ),
      h2("Mercado Pago y acreditación"),
      p(
        "El pago se procesa con Mercado Pago, medio habitual en Argentina para confianza del comprador y acreditación en la cuenta del vendedor según plazos de la pasarela. ComprameLaFoto aplica su fee de marketplace en cada venta aprobada; el fotógrafo ve el detalle en su panel de ventas. Hasta que el pago no está aprobado, no se libera la descarga, lo que reduce fraudes y pedidos fantasma."
      ),
      h2("Entrega automática"),
      p(
        "Tras la aprobación, el sistema genera o habilita enlaces de descarga para el comprador —por mail y/o pantalla de confirmación— con los archivos en la resolución y formato configurados. No necesitás enviar WeTransfer a las tres de la mañana: la plataforma hace el trabajo repetitivo. Si el cliente no encuentra el mail, puede recuperar acceso desde flujos de cuenta o soporte con comprobante de pago."
      ),
      h3("Formatos y licencia de uso"),
      p(
        "Lo habitual es entregar JPEG en alta resolución optimizado para impresión doméstica y redes. La compra de una copia digital no transfiere el derecho de autor: el cliente adquiere uso personal salvo contrato distinto. Dejá eso claro en la galería para evitar usos comerciales no autorizados de tus imágenes."
      ),
      h2("Seguridad y buenas prácticas"),
      p(
        "Los enlaces de descarga pueden tener expiración o límite de intentos según configuración, para reducir compartir masivo del link. Monitoreá ventas anómalas —misma tarjeta, muchas descargas en segundos— y contactá soporte si detectás abuso. Mantené tus álbumes con fecha de cierre si querés urgencia de compra. Backup de originales siempre fuera de la plataforma: ComprameLaFoto distribuye, no reemplaza tu archivo maestro en disco."
      ),
      h2("Optimizar conversión"),
      p(
        "Publicá rápido después del evento, compartí el link en canales del organizador, habilitá packs y buscá por selfie cuando aplique. Precios redondos y pocas opciones superan menús interminables. Un mail de recordatorio antes de cerrar el álbum recupera ventas de quien procrastina."
      ),
      h2("Descuentos, cupones y promos por volumen"),
      p(
        "Las reglas de descuento por cantidad —tres fotos al precio de dos, por ejemplo— se aplican en el carrito digital según configuración del álbum. Los cupones permiten campañas puntuales con el organizador. Verificá que el precio base siga siendo sostenible después del descuento y del fee de marketplace."
      ),
      h2("Álbumes privados y control de acceso"),
      p(
        "No todo álbum digital es público indexable: podés restringir acceso por link o credenciales según estrategia. Eso afecta cómo promocionás la venta pero no el mecanismo de entrega tras pago. Sesiones privadas y corporativas suelen usar acceso restringido; maratones buscan máximo alcance."
      ),
      h2("Qué recibe exactamente el comprador"),
      p(
        "Tras pagar, el comprador accede a archivos en la resolución vendida —no necesariamente al RAW ni a ediciones alternativas no publicadas en galería. Si ofrecés retoque premium como upsell, debe figurar como producto distinto. Claridad previene disputas sobre «la foto editada distinto a la preview» cuando la preview es la misma versión con marca de agua."
      ),
      h2("Profundización operativa"),
      p(
        "La venta digital escala cuando el precio por unidad es psicológicamente simple y los descuentos por volumen están preconfigurados. El cliente que duda entre dos y tres fotos suele llevarse tres si el salto de precio es razonable."
      ),
      p(
        "El email de entrega es crítico: pedí al comprador que revise spam la primera vez. Incluí en comunicaciones del organizador un recordatorio de buscar correo de ComprameLaFoto tras pagar."
      ),
      p(
        "Álbumes con fecha de cierre generan urgencia honesta; no abuses de cierres que reabren cada semana sin aviso, porque erosiona confianza del organizador que promociona tu link."
      ),
      p(
        "Las devoluciones y contracargos en digitales son sensibles porque el archivo ya pudo descargarse; la plataforma vincula liberación a pago aprobado según políticas vigentes."
      ),
      p(
        "Si vendés en evento colaborativo, tu digital compite con el de colegas en la misma landing: calidad de captura y precio siguen siendo diferenciadores que ningún checkout automatiza por vos."
      ),
      h2("Próximos pasos en tu operación"),
      p(
        "Configurá precios y descuentos antes de subir las primeras fotos públicas: cambiar reglas con ventas en curso confunde a quien ya tenía el carrito abierto. Alineá con el organizador el mail masivo post-evento con la hora real de publicación."
      ),
      p(
        "Analizá qué fotos convierten más y priorizá su visibilidad en la galería o en packs destacados. La entrega automática no sustituye curaduría comercial de qué se muestra primero al comprador abrumado por cientos de miniaturas."
      ),
      p(
        "Para clientes institucionales, confirmá por mail el uso permitido de las digitales vendidas; la licencia por defecto suele ser personal y eso evita malentendidos si el comprador quería uso publicitario amplio."
      ),
      h2("Checklist de venta digital"),
      p(
        "Precios y descuentos definidos antes de publicar; previews protegidas; Mercado Pago conectado; mail de prueba de compra en álbum test; fecha de cierre comunicada; link listo para el organizador. Publicar sin checklist es abrir el grifo sin saber si el desagüe funciona."
      ),
      p(
        "Después del pico inicial de ventas, un recordatorio cuarenta y ocho horas antes del cierre recupera entre un diez y un veinte por ciento adicional en muchos eventos deportivos —dato orientativo que debés contrastar con tus propias ediciones."
      ),
      h2("Errores que conviene evitar"),
      p(
        "Subir previews demasiado grandes; cambiar precios con carritos abiertos; no verificar email de entrega en prueba; cerrar álbum sin aviso y perder ventas de último momento sin estrategia. La venta digital escala hasta que un detalle de configuración rompe la confianza del comprador en el primer pedido."
      ),
      p(
        "Prometer «alta resolución» sin definir qué significa en píxeles o megabytes invita a disputas. Sé concreto en la descripción del producto digital."
      ),
      h2("Síntesis"),
      p(
        "La venta digital automatiza lo que antes te robaba horas: cobrar, liberar archivo y registrar pedido. Preview protegida, Mercado Pago y entrega inmediata forman el núcleo del valor de ComprameLaFoto para eventos y escuelas. Optimizar precios, descuentos y velocidad de publicación impacta más en ingresos que cualquier ajuste marginal del panel una vez que lo dominás."
      ),
      p(
        "Tratá cada álbum como producto con ciclo de vida: apertura, pico, cierre. La disciplina comercial en esas fases define si la plataforma «funciona» para vos o solo almacena fotos."
      ),
      p(
        "Para la experiencia del comprador, el tutorial «cómo comprar fotografías digitales» resume el recorrido desde la galería hasta la descarga sin repetir aquí cada clic del checkout. Del lado del fotógrafo, la métrica que más importa suele ser tiempo entre publicación y primera venta, no cantidad de fotos subidas."
      ),
      p(
        "La venta digital es la funcionalidad que más escala en deportes y escuelas porque elimina la entrega manual archivo por archivo. Dominar preview, precios, packs y cierre de álbum es el núcleo del retorno de inversión en ComprameLaFoto para la mayoría de los fotógrafos argentinos."
      ),
      p(
        "Probá el flujo completo con una compra test antes de anunciar la galería al público: detectar un error de email o de liberación de archivos antes del pico de tráfico ahorra horas de soporte. Publicá en horarios de mayor tráfico del público objetivo —tarde-noche post-evento deportivo, mañana en campañas escolares— para capturar la primera ola de compras impulsivas. Revisá que Mercado Pago esté conectado y sin alertas pendientes antes de abrir la galería; un problema de cobro en el pico es el escenario más costoso de la venta digital. La venta digital es el motor de ingresos recurrentes post-evento para la mayoría de los fotógrafos en Argentina con ComprameLaFoto."
      ),
      p(
        "Compará en tus propias ediciones el ticket promedio con y sin descuentos por volumen; muchos fotógrafos encuentran el punto óptimo entre tres y cinco fotos por comprador sin regalar margen. Ajustar esa palanca tiene más impacto que subir precio unitario en aislamiento. La venta digital bien afinada suele ser la primera funcionalidad que rentabiliza por completo la adopción de ComprameLaFoto en deportes y escuelas. Dominar este flujo es prioridad antes de optimizar impresiones o marketplace. Cada minuto ahorrado en entrega manual es un minuto para editar o capturar en el próximo evento."
      ),
    ],
    faq: [
      {
        q: "¿Cuándo puedo descargar después de pagar?",
        a: "En general, en minutos una vez que Mercado Pago aprueba el pago. Revisá spam si no ves el correo.",
      },
      {
        q: "¿Puedo descargar desde el celular?",
        a: "Sí, los enlaces suelen funcionar en navegador móvil; para archivos pesados, Wi-Fi estable ayuda.",
      },
      {
        q: "¿La foto incluye marca de agua en la versión pagada?",
        a: "No. La versión entregada tras el pago es la digital limpia en la calidad vendida.",
      },
      {
        q: "¿Puedo regalar una foto a otra persona?",
        a: "Podés usar el flujo de regalo o comprar con el mail del destinatario según opciones del álbum.",
      },
      {
        q: "¿Qué pasa si pierdo el link de descarga?",
        a: "Contactá soporte o accedé desde tu cuenta de cliente con el comprobante para reenviar acceso.",
      },
    ],
    conclusion:
      "La venta digital bien configurada convierte tu cobertura en ingresos mientras dormís: preview protegida, pago confiable y entrega automática. Es la funcionalidad que más tiempo ahorra al fotógrafo moderno en Argentina.",
    ctaAudience: resolveCtaAudience(["fotografos", "clientes"]),
    imageScene:
      "Customer receiving digital download notification on phone after buying race photos, hyperrealistic documentary photography",
    imageAltSubject: "Cliente recibiendo notificación de descarga de fotos en el celular",
    imageCaption: "Tras el pago, la entrega digital es automática.",
  },

  "como-funciona-sistema-referidos": {
    seoTitle: "Sistema de referidos de ComprameLaFoto",
    seoDescription:
      "Programa de referidos: link único, 50% del fee de marketplace por 12 meses, requisitos de Mercado Pago y cómo cobrar.",
    excerpt:
      "Resumen del programa de referidos: quién puede referir, comisiones del 50% del fee y duración de 12 meses.",
    blocks: [
      p(
        "El sistema de referidos de ComprameLaFoto premia a quien recomienda fotógrafos que efectivamente venden en la plataforma. No es un esquema de multi-nivel ni un ingreso por registrarse: la comisión existe cuando un fotógrafo referido genera ventas aprobadas y vos cumplís los requisitos de cobro. Cualquier usuario —fotógrafo, organizador, laboratorio o cliente— puede tener link de referido; las comisiones, en cambio, solo se generan si quien se registró con tu código es fotógrafo y realiza ventas. Durante doce meses desde el alta de ese fotógrafo cobrás el cincuenta por ciento del fee de marketplace que ComprameLaFoto retiene en cada una de sus ventas, con Mercado Pago conectado en tu cuenta al momento de la transacción. Esta guía de funcionalidad resume link, atribución, cálculo, ejemplos y cobro."
      ),
      h2("Quién puede participar y quién genera comisiones"),
      p(
        "Podés recomendar la plataforma sea cual sea tu rol en el ecosistema. El registro con tu parámetro de referido atribuye al nuevo fotógrafo a tu código. Si referís a un laboratorio, organizador o cliente que no vende como fotógrafo, no hay comisiones —aunque el registro con link pueda estar limitado al alta de fotógrafos según el flujo de registro. El diseño incentiva traer colegas que producirán ventas reales, no cuentas vacías."
      ),
      h2("Cómo se atribuye un referido"),
      p(
        "La atribución ocurre cuando el fotógrafo se registra usando tu URL con el código de referido —parámetro ref en el link—. Esa asociación queda en el sistema y marca el inicio de la ventana de doce meses. Es importante compartir el link completo sin acortadores que eliminen el parámetro. Los auto-referidos y cuentas duplicadas están prohibidos y pueden bloquear el código."
      ),
      h2("Cómo obtener y compartir tu link"),
      h3("Si sos fotógrafo"),
      p(
        "Ingresá a Configuración → Referidos. Con Mercado Pago conectado podés generar o copiar tu link único. Sin Mercado Pago conectado, las ventas de tus referidos no generarán comisión acumulable en tu saldo: esa comisión se pierde y no se paga retroactivamente cuando conectes después."
      ),
      h3("Si sos organizador, laboratorio o cliente"),
      p(
        "Podés solicitar tu link de referidos a soporte de ComprameLaFoto. Una vez activo, funciona igual para atribuir fotógrafos que se registren con él."
      ),
      p(
        "Compartilo por WhatsApp en grupos de colegas, en historias de Instagram con contexto útil, en charlas de capacitación con QR o por mail a fotógrafos que recién empiezan a vender online. Evitá spam; la recomendación personal convierte mejor que el mensaje masivo sin relación."
      ),
      h2("Cálculo del 50% del fee"),
      p(
        "En cada venta aprobada del fotógrafo referido, ComprameLaFoto cobra un fee de marketplace al procesar el pago con Mercado Pago. El cincuenta por ciento de ese fee —calculado sobre el fee efectivo tras descuentos que apliquen al vendedor— se asigna al referidor y el resto a la plataforma. El dinero del fee ingresa a la cuenta de la plataforma en el split de Mercado Pago; tu parte queda registrada como saldo referido para liquidación cuando solicites cobro."
      ),
      ul([
        "Comisión referidor = 50% del fee efectivo de la plataforma en esa venta.",
        "Ventana: 12 meses desde la fecha de registro del fotógrafo referido.",
        "Requisito: Mercado Pago conectado en tu cuenta al momento de la venta.",
        "Devoluciones o contracargos revierten la comisión asociada.",
        "No hay comisión por referidos que no sean fotógrafos con ventas.",
      ]),
      h2("Ventana de 12 meses"),
      p(
        "El reloj arranca en el alta del fotógrafo referido, no en su primera venta. Durante un año calendario desde ese momento, cada venta nueva elegible genera comisión mientras la atribución siga activa y cumplas requisitos de MP. Pasados los doce meses, las ventas de ese mismo fotógrafo ya no suman comisión referida para vos, aunque él siga vendiendo en ComprameLaFoto."
      ),
      h2("Ejemplos ilustrativos"),
      p(
        "Los montos reales dependen del fee vigente en cada venta y del volumen del fotógrafo referido. Ejemplos simplificados en pesos argentinos, solo ilustrativos:"
      ),
      ul([
        "Venta de $10.000 con fee de plataforma de $500 → tu comisión: $250.",
        "Si ese fotógrafo vende $200.000 en un mes con fee promedio efectivo de $8.000 → tu comisión del mes: $4.000.",
        "Durante 12 meses, cada venta nueva del mismo referido sigue generando comisión mientras la atribución esté activa y tengas MP conectado.",
      ]),
      h2("Cómo cobrás tus comisiones"),
      p(
        "Desde Configuración → Referidos ves tu saldo acumulado. Cuando alcanzás el mínimo publicado, usás «Solicitar cobro». El equipo procesa el pago por Mercado Pago o transferencia según lo configurado. No esperes que el fee se divida en tres partes en el mismo instante del pago del cliente: Mercado Pago reparte entre vendedor y marketplace; tu comisión se liquida en este flujo posterior de referidos."
      ),
      h2("Descuentos de fee del vendedor referido"),
      p(
        "Si el fotógrafo referido usa saldo de referidos para descuentos en su propio fee de marketplace, el cálculo de tu comisión se hace sobre el fee efectivo después de ese descuento —no sobre un fee teórico mayor—. Es decir, la base es la que realmente retiene la plataforma en esa venta. Entender esto evita sorpresas al comparar ventas brutas con comisiones netas."
      ),
      h2("Estrategias para recomendar sin spam"),
      p(
        "Referí a colegas que realmente van a subir eventos y conectar Mercado Pago, no a contactos que solo «piensan registrarse algún día». Explicá tu experiencia concreta: menos tiempo enviando archivos, cobros con Mercado Pago, eventos colaborativos. Un mensaje honesto en un grupo de fotógrafos de confianza supera cien mensajes fríos."
      ),
      h2("Diferencia con la guía completa de referidos"),
      p(
        "Este artículo describe la funcionalidad del sistema. En el blog encontrás además una guía ampliada de negocio fotográfico sobre cómo generar ingresos recomendando ComprameLaFoto, con más ejemplos y enfoque estratégico. Ambos se complementan: acá el «cómo funciona»; allá el «cómo escalar recomendaciones»."
      ),
      h2("Profundización operativa"),
      p(
        "El programa tiene sentido económico cuando referís fotógrafos con calendario real de eventos —escuelas, running, clubes— no cuentas dormidas. Un referido que vende fuerte durante doce meses puede superar cualquier sesión suelta que hubieras cotizado por tu cuenta."
      ),
      p(
        "Organizadores y laboratorios con red amplia suelen ser referidores efectivos porque conocen fotógrafos que aún cobran manual. Explicales que solo fotógrafos con ventas generan comisión y que necesitan Mercado Pago conectado al momento de cada venta."
      ),
      p(
        "Llevá registro propio de a quién invitaste y cuándo se registró para hacer seguimiento amable si tardó en publicar su primer álbum. Tu recomendación puede incluir tips operativos que aceleren su primera venta —y tu comisión."
      ),
      p(
        "Ante devoluciones de pedidos del referido, asumí que la comisión asociada se revierte; no gastes el saldo pendiente como si fuera inamovible hasta confirmar estabilidad de ventas."
      ),
      p(
        "Leé los términos de referidos en la plataforma: anti-abuso, prohibición de auto-referido y bloqueo de códigos en casos extremos protegen al ecosistema completo."
      ),
      h2("Próximos pasos en tu operación"),
      p(
        "Revisá tu saldo en Configuración → Referidos con la misma periodicidad con la que revisás ventas propias. Solicitá cobro cuando superes el mínimo y tu Mercado Pago esté activo. Si referís activamente, fijate un objetivo trimestral de fotógrafos referidos con primer evento publicado, no solo registros vacíos."
      ),
      p(
        "No confundas referidos con descuento propio en fee: son mecanismos distintos que pueden convivir según reglas vigentes. Entender cada línea del panel evita sorpresas al cerrar el mes contable."
      ),
      h2("Checklist del referidor"),
      p(
        "Mercado Pago conectado antes de difundir el link; link copiado sin acortadores que rompan el código; mensaje personalizado al colega; seguimiento amable a los quince días si no publicó álbum; revisión de saldo mensual; solicitud de cobro al superar mínimo. El referidor profesional trata el programa como canal de ingresos, no como curiosidad del menú de configuración."
      ),
      p(
        "Recordá: solo fotógrafos con ventas generan comisión; referir organizadores o clientes no activa el cincuenta por ciento del fee. Enfocá energía en colegas que realmente subirán eventos."
      ),
      h2("Errores que conviene evitar"),
      p(
        "Difundir link sin Mercado Pago conectado; usar acortadores que pierden el código ref; spam en grupos; auto-referido; asumir comisión por registros sin ventas. El programa premia referencias de calidad, no volumen de clics vacíos."
      ),
      p(
        "Olvidar que devoluciones revierten comisión lleva a planificar gastos sobre saldo aún no consolidado. Revisá el panel después de picos de ventas de tus referidos."
      ),
      h2("Síntesis"),
      p(
        "El sistema de referidos reparte el cincuenta por ciento del fee de marketplace durante doce meses cuando referís fotógrafos que venden, con Mercado Pago conectado al momento de cada venta. Cualquiera puede recomendar; las comisiones nacen de ventas reales de fotógrafos referidos. Link en Configuración → Referidos, cobro por solicitud de saldo, reglas anti-abuso documentadas en términos de la plataforma."
      ),
      p(
        "Para estrategia comercial ampliada —cómo compartir el link, escalar recomendaciones y proyectar ingresos— consultá la guía destacada de referidos en la categoría negocio fotográfico del blog. Los ejemplos ilustrativos de comisión en pesos dependen del fee vigente en cada venta; usalos como orden de magnitud, no como promesa de ingreso fijo."
      ),
      p(
        "En una frase: link con ref al registrarse, doce meses de ventas del fotógrafo referido, cincuenta por ciento del fee efectivo de plataforma, Mercado Pago conectado al momento de la venta, cobro por solicitud en Configuración → Referidos. Esas cinco piezas resumen el sistema sin prometer ingresos que dependen del volumen real de tus referidos."
      ),
      p(
        "Compartí tu link con contexto útil —cómo te ahorró tiempo la plataforma— en lugar de mensajes genéricos; la conversión a fotógrafos activos mejora y protege la calidad del programa para todos."
      ),
    ],
    faq: [
      {
        q: "¿Puedo referirme a mí mismo?",
        a: "No. Los auto-referidos y cuentas duplicadas están prohibidos y pueden bloquear el código.",
      },
      {
        q: "¿Qué pasa si no tengo Mercado Pago conectado cuando mi referido vende?",
        a: "Esa comisión no se acumula ni se paga retroactivamente. Conectá MP antes de que tu referido empiece a vender.",
      },
      {
        q: "¿El referido tiene algún beneficio especial?",
        a: "El beneficio principal es usar la plataforma; las condiciones comerciales del referido son las estándar de ComprameLaFoto.",
      },
      {
        q: "¿Puedo referir organizadores de eventos?",
        a: "Podés compartir tu link, pero las comisiones solo aplican si el referido es fotógrafo con ventas.",
      },
      {
        q: "¿Hay límite de referidos?",
        a: "No hay un límite publicado de cantidad de fotógrafos referidos; sí aplican políticas anti-abuso.",
      },
    ],
    conclusion:
      "El sistema de referidos transforma tu red profesional en ingreso proporcional al éxito de los fotógrafos que traés, con reglas claras: 50% del fee, 12 meses, solo ventas de fotógrafos referidos y Mercado Pago conectado. Para el detalle comercial ampliado, consultá también la guía destacada de referidos en el blog.",
    ctaAudience: resolveCtaAudience(["fotografos", "organizadores", "clientes"]),
    imageScene:
      "Photographer showing referral link on phone to colleague at camera trade fair booth, hyperrealistic documentary photography",
    imageAltSubject: "Fotógrafo mostrando su link de referidos a un colega en una feria",
    imageCaption: "Recomendá fotógrafos que vendan y participá del fee de marketplace.",
  },

  "como-funciona-modulo-inscripciones-entradas": {
    seoTitle: "Módulo de inscripciones y entradas (vista previa)",
    seoDescription:
      "Estado del módulo de inscripciones y entradas para eventos en ComprameLaFoto: disponibilidad gradual y relación con fotos.",
    excerpt:
      "Vista previa del módulo de inscripciones y entradas para eventos (en desarrollo / disponibilidad gradual).",
    blocks: [
      p(
        "ComprameLaFoto está desarrollando un módulo de inscripciones y entradas pensado para organizadores que ya usan —o planean usar— la plataforma para vender fotos del mismo evento. La idea es reunir en un solo ecosistema la gestión de participantes —inscripción, pago de entrada o dorsal— y la posterior venta de imágenes, evitando que el corredor o asistente reciba tres mails de tres sistemas distintos. En el momento de redactar este artículo, el módulo está en desarrollo con disponibilidad gradual: algunas funciones pueden estar en prueba con organizadores seleccionados y otras aún en diseño. No prometemos fechas cerradas ni características que no estén publicadas en producción; lo que sigue es una vista honesta del problema que busca resolver y del estado actual."
      ),
      h2("Estado del módulo hoy"),
      p(
        "El módulo no está lanzado de forma general para todos los organizadores. Si ves referencias en el menú de producto o materiales de marketing, pueden corresponder a roadmap o pilotos limitados. Antes de planificar tu evento exclusivamente sobre inscripciones integradas, confirmá con soporte de ComprameLaFoto si tu cuenta tiene acceso a la función o si debés usar inscripciones externas y vincular solo la parte fotográfica —como ocurre hoy en la mayoría de los casos."
      ),
      h2("Problema que busca resolver"),
      p(
        "Hoy muchos organizadores cobran la inscripción en una plataforma, las fotos en ComprameLaFoto y la comunicación queda fragmentada. Eso duplica esfuerzo de soporte y hace que el participante no encuentre sus fotos porque perdió el mail de la galería. Un módulo unificado apuntaría a: registro del participante, cobro de entrada cuando corresponda, datos básicos —categoría, dorsal, mail— y un puente natural hacia la landing de fotos cuando la cobertura esté publicada."
      ),
      h2("Relación con eventos colaborativos"),
      p(
        "Los eventos colaborativos ya permiten landing única, varios fotógrafos y comisiones del organizador sobre ventas de fotos. El módulo de inscripciones —cuando esté disponible— se complementaría con ese modelo: el mismo organizador que convoca fotógrafos podría gestionar participantes sin exportar planillas manualmente entre sistemas. La integración exacta dependerá de la versión que se libere; no asumas que funciones de inscripción ya operan igual que un evento colaborativo publicado hoy."
      ),
      h2("Flujo esperado para organizadores"),
      p(
        "En la visión de producto, el organizador crearía o vincularía un evento, abriría inscripciones con cupo y precio, compartiría link de registro y cobraría con Mercado Pago en el mismo entorno que ya conocés para fotos. Los participantes recibirían confirmación y, tras el evento, comunicación hacia la galería. Hasta que esa experiencia esté en producción para tu cuenta, el flujo recomendado sigue siendo: inscripción en tu herramienta actual más link de fotos de ComprameLaFoto cuando las galerías estén listas."
      ),
      h2("Beneficios previstos para fotógrafos"),
      p(
        "Fotógrafos adheridos a un evento podrían recibir audiencia ya identificada —mails validados, dorsales coherentes— y menos fricción en búsqueda por número o selfie. Nada de esto reemplaza la necesidad de subir y etiquetar fotos con calidad; solo mejora el puente entre participante registrado y comprador. Si no tenés acceso al piloto, seguí operando con eventos colaborativos y búsqueda por selfie como hoy."
      ),
      h2("Cómo enterarte del lanzamiento"),
      p(
        "Suscribite al blog y novedades de ComprameLaFoto, seguí los canales oficiales y consultá a soporte si sos organizador con volumen alto que quiera participar de pruebas. Cuando el módulo avance a disponibilidad amplia, este artículo se actualizará con el flujo definitivo y se quitará el carácter de vista previa. Mientras tanto, tratá cualquier demo como sujeta a cambios."
      ),
      h2("Qué podés hacer hoy sin el módulo"),
      p(
        "Crear eventos colaborativos, publicar landing de fotos, convocar fotógrafos, activar comisiones, compartir link post-carrera y usar búsqueda por selfie son capacidades productivas actuales. Muchos organizadores exportan dorsales desde su sistema de inscripciones actual y los usan para comunicación; ComprameLaFoto cubre la monetización fotográfica del evento."
      ),
      h2("Riesgos de asumir funciones no lanzadas"),
      p(
        "No prometas a sponsors o clubes que «todo estará en ComprameLaFoto» —inscripción más fotos— hasta confirmar acceso al módulo. Firmar contratos basados en roadmap puede generar incumplimientos. Sé explícito: inscripciones en herramienta X, fotos en ComprameLaFoto, hasta integración oficial."
      ),
      h2("Feedback para el roadmap"),
      p(
        "Si participás de un piloto, tu retroalimentación sobre campos obligatorios, cupos, categorías y mails transaccionales ayuda a priorizar desarrollo. Los organizadores con eventos recurrentes —misma carrera cada año— son voces valiosas para diseño de flujos que escalen."
      ),
      h2("Profundización operativa"),
      p(
        "Mientras el módulo madura, documentá en tus propuestas comerciales qué parte está en ComprameLaFoto hoy —venta de fotos, eventos colaborativos— y qué parte sigue en tu proveedor de inscripciones habitual. Esa honestidad comercial evita malentendidos con clubes que leen marketing genérico de «todo en uno»."
      ),
      p(
        "Los organizadores que ya usan dorsales exportados pueden cruzar datos con comunicaciones post-evento sin esperar integración automática: mail de inscripción con «tus fotos estarán en…» sigue siendo buena práctica."
      ),
      p(
        "Fotógrafos adheridos no deben prometer funciones de ticketing que el organizador no tenga habilitadas; alineen mensaje público el día del evento."
      ),
      p(
        "Cuando el piloto esté disponible para tu cuenta, probá con un evento pequeño antes de migrar la maratón insignia del club."
      ),
      p(
        "Este artículo se actualizará al lanzamiento general; consultalo periódicamente si tu rol es organizador y querés adoptar la versión estable en cuanto esté disponible."
      ),
      h2("Próximos pasos en tu operación"),
      p(
        "Usá este período de desarrollo para ordenar tus procesos actuales: exportaciones de inscriptos, plantillas de mail y dorsales. Cuando la integración llegue, migrar será más fácil si hoy ya tenés datos limpios. No suspendas mejoras en venta de fotos esperando el módulo."
      ),
      p(
        "Seguí usando eventos colaborativos y landings de fotos como columna vertebral comercial. Cuando el módulo de entradas se integre, tu audiencia ya asociará el evento con ComprameLaFoto para imágenes; agregar inscripción será extensión natural."
      ),
      p(
        "Consultá periódicamente este artículo y la documentación oficial: al salir de vista previa, los flujos concretos —campos, precios, mails— se documentarán con el mismo nivel de detalle que el resto de funcionalidades de esta serie."
      ),
      h2("Checklist mientras el módulo madura"),
      p(
        "Inscripciones en tu herramienta actual funcionando; datos exportables; mail transaccional con link de fotos preparado; evento colaborativo creado en ComprameLaFoto; fotógrafos convocados; landing de fotos promocionada. Ese stack cubre hoy el noventa por ciento del valor comercial sin esperar entradas integradas."
      ),
      p(
        "Ante dudas de sponsors o clubes, mostrá resultados de venta de fotos de ediciones anteriores en ComprameLaFoto mientras explicás que inscripciones integradas están en roadmap. Honestidad comercial construye más confianza que prometer funciones que tu panel aún no muestra."
      ),
      h2("Errores que conviene evitar"),
      p(
        "Firmar contratos de ticketing solo sobre promesas de roadmap; dejar de invertir en venta de fotos actual; no preparar datos de inscriptos exportables; comunicar a fotógrafos funciones que no están habilitadas en tu cuenta. El módulo futuro no reemplaza la excelencia operativa de hoy."
      ),
      p(
        "Asumir que dorsal del sistema de inscripciones externo se cruzará automáticamente con fotos antes del lanzamiento oficial puede llevar a promesas de «encontrá tu foto por número» sin soporte técnico real."
      ),
      h2("Síntesis"),
      p(
        "El módulo de inscripciones y entradas está en desarrollo con disponibilidad gradual. Hoy la columna vertebral comercial sigue siendo eventos colaborativos, landings de fotos y venta con Mercado Pago. Prepará datos y procesos; no detengas lo que ya funciona esperando el lanzamiento. Este artículo se actualizará cuando las funciones estén en producción general."
      ),
      p(
        "Mientras tanto, la honestidad con clubes y fotógrafos sobre qué está activo y qué en roadmap protege tu reputación más que cualquier slide de ventas ambicioso."
      ),
      p(
        "Suscribite a novedades del blog y consultá soporte si querés participar de pilotos; no asumas acceso al módulo hasta recibir confirmación explícita para tu cuenta de organizador. Mientras tanto, eventos colaborativos y venta de fotos siguen siendo el camino probado para monetizar tu calendario deportivo o cultural."
      ),
      p(
        "Este artículo describe dirección de producto y estado actual sin inventar pantallas ni botones que tu panel no tenga. La venta de fotografías con Mercado Pago, hoy, es la pieza lista para organizar tu próximo evento mientras el módulo de entradas completa el rompecabezas en el futuro."
      ),
      p(
        "Revisá periódicamente si tu cuenta fue habilitada para pilotos antes de anunciar inscripciones integradas a sponsors; hasta entonces, vendé fotos con la landing de evento que ya conocés. Exportá inscriptos de tu herramienta actual en formato estable cada edición para estar listo cuando la integración nativa esté disponible sin reprocesar bases históricas a último momento. Comunicá a fotógrafos adheridos el mismo mensaje de honestidad sobre roadmap para que nadie prometa al público funciones que el panel aún no muestra. El módulo completará el viaje del participante cuando esté listo; hasta entonces, tu operación comercial no debe detenerse."
      ),
      p(
        "Priorizá hoy la landing de fotos y la coordinación con fotógrafos: es lo que ya genera ingresos. El módulo de entradas sumará cuando esté listo; no es prerequisito para un evento deportivo o cultural rentable en ComprameLaFoto. Mantené a sponsors y clubes informados con hechos verificables del panel, no con promesas de roadmap. La venta de fotografías con Mercado Pago sigue siendo el núcleo comercial disponible hoy para organizadores en Argentina. Actualizá este artículo cuando el lanzamiento oficial confirme flujos concretos en tu panel de organizador y elimine por completo el carácter de vista previa de este contenido editorial sobre inscripciones y entradas. Consultá soporte si querés participar de pilotos del módulo."
      ),
    ],
    faq: [
      {
        q: "¿Ya puedo vender entradas en ComprameLaFoto?",
        a: "En la mayoría de las cuentas, no de forma general. El módulo está en desarrollo con disponibilidad gradual; confirmá con soporte si tenés acceso a piloto.",
      },
      {
        q: "¿Debo postergar mi evento hasta que salga?",
        a: "No es necesario. Podés usar inscripciones externas y ComprameLaFoto para fotos, como hacen muchos organizadores hoy.",
      },
      {
        q: "¿Tendrá Mercado Pago?",
        a: "La plataforma utiliza Mercado Pago en sus flujos de cobro; la integración específica del módulo de entradas se anunciará al lanzar.",
      },
      {
        q: "¿Reemplaza al evento colaborativo?",
        a: "No. Lo complementaría. Los eventos colaborativos para fotos siguen siendo la funcionalidad activa para landings y fotógrafos.",
      },
      {
        q: "¿Este artículo describe funciones ya disponibles?",
        a: "Describe la dirección del producto y el estado de desarrollo. No inventes capacidades que tu panel aún no muestra.",
      },
    ],
    conclusion:
      "El módulo de inscripciones y entradas busca unificar participantes y fotos en una experiencia coherente, pero hoy está en desarrollo con rollout gradual. Organizadores y fotógrafos pueden seguir apoyándose en eventos colaborativos y galerías mientras se anuncia el lanzamiento oficial.",
    ctaAudience: resolveCtaAudience(["organizadores", "fotografos"]),
    imageScene:
      "Race registration desk with laptops and bib assignment, organizer helping runners, documentary style, hyperrealistic documentary photography",
    imageAltSubject: "Mesa de acreditación de una carrera con organizador asistiendo corredores",
    imageCaption: "Inscripciones y fotos en un solo ecosistema es el objetivo del módulo en desarrollo.",
  },
};


