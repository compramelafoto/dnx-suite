import type { Phase8ArticleContent } from "@/data/blog/phase8/types";
import { resolveCtaAudience } from "@/data/blog/phase8/cta";
import { p, h2, h3, ul } from "@/data/blog/phase8/editorial-nodes";

export const TUTORIALES_PHASE8: Record<string, Phase8ArticleContent> = {
  "como-registrarte-en-compramelafoto": {
    seoTitle: "Cómo registrarte en ComprameLaFoto: guía para fotógrafos",
    seoDescription:
      "Guía paso a paso para crear tu cuenta de fotógrafo en ComprameLaFoto, verificar tu email, completar tu perfil y conectar Mercado Pago para empezar a vender.",
    excerpt:
      "Guía paso a paso para crear tu cuenta de fotógrafo en ComprameLaFoto, verificar tu email y completar tu perfil.",
    blocks: [
      p(
        "Antes de subir una sola foto necesitás una cuenta activa, y ese primer trámite define buena parte de tu experiencia posterior con la plataforma. Registrarte en ComprameLaFoto no tiene costo: no pagás mensualidad por abrir el perfil ni por crear álbumes, porque la plataforma recién participa cuando concretás una venta. En esta guía recorremos el alta completa para fotógrafos en Argentina, desde lo que conviene tener a mano antes de empezar hasta la verificación del email, la carga del perfil y la conexión con Mercado Pago. La idea es que termines con una cuenta lista para publicar tu primer evento o galería escolar sin volver atrás a corregir datos."
      ),
      h2("Requisitos previos antes de empezar"),
      p(
        "Para abrir la cuenta solo necesitás un correo electrónico al que tengas acceso real, porque ahí llegará el enlace de verificación y, más adelante, las notificaciones de cada venta. Conviene usar el mail que revisás todos los días y no uno secundario que abrís una vez por mes, ya que los avisos de pedidos y descargas pasan por ese canal."
      ),
      p(
        "Tené a mano los datos con los que cobrás: tu cuenta de Mercado Pago activa a tu nombre o el de tu emprendimiento. Si todavía no la creaste, podés avanzar con el registro igual y vincularla después, pero no vas a poder recibir el dinero de las ventas hasta completar ese paso. Pensá también un nombre público de fotógrafo o estudio, porque es el que verán los compradores en tus galerías."
      ),
      p(
        "Por último, prepará material básico de perfil: una foto o logo, una breve descripción de qué cubrís —deportes, escuelas, sociales, sesiones— y, si tenés, enlaces a tus redes. No es obligatorio para registrarte, pero un perfil completo transmite seriedad y ayuda a que un cliente o un organizador te elija cuando compara opciones dentro del marketplace."
      ),
      h2("Crear tu cuenta desde el registro"),
      p(
        "Ingresá al sitio de ComprameLaFoto y buscá la opción de crear cuenta de fotógrafo. El formulario inicial es corto a propósito: nombre, email y contraseña. Elegí una contraseña que no uses en otros servicios y que combine letras, números y algún símbolo, porque esta cuenta va a manejar dinero de tus ventas y el acceso a tus archivos originales."
      ),
      p(
        "Al enviar el formulario, la plataforma crea tu cuenta en estado pendiente de verificación. Esto significa que ya existís en el sistema, pero todavía no podés operar al cien por ciento hasta confirmar que el correo es tuyo. Es un paso de seguridad estándar que evita registros falsos y protege tu identidad comercial frente a terceros."
      ),
      p(
        "Si el sistema te avisa que el email ya está registrado, probablemente abriste una cuenta antes o usaste ese correo como comprador. En ese caso conviene recuperar la contraseña en lugar de insistir con un alta nueva, así no terminás con dos perfiles separados y ventas dispersas entre ambos."
      ),
      h2("Verificar tu email"),
      p(
        "Apenas completás el registro, ComprameLaFoto envía un correo con un enlace de verificación. Abrilo desde la misma casilla que usaste y hacé clic en el botón o el link que figura en el mensaje. Ese gesto confirma que el email es válido y desbloquea el resto de las funciones de tu cuenta."
      ),
      p(
        "Si el correo no aparece en la bandeja principal en unos minutos, revisá las carpetas de spam, promociones o no deseados, donde suelen caer los mensajes automáticos. Marcar el remitente como contacto seguro ayuda a que los futuros avisos de ventas no terminen filtrados y te enteres de cada pedido a tiempo."
      ),
      p(
        "Cuando el enlace caducó o no funciona, la plataforma permite reenviar la verificación desde la pantalla de acceso. No abras varios pedidos seguidos: esperá el último correo, porque los anteriores quedan invalidados y podrías hacer clic en un enlace ya vencido pensando que es el vigente."
      ),
      p(
        "Tené en cuenta que la verificación se hace una sola vez por cuenta: una vez confirmado el correo, no vas a tener que repetir el paso en cada inicio de sesión. Si gestionás tu actividad desde el celular y desde la computadora, alcanza con verificar desde cualquiera de los dos dispositivos, porque el estado queda asociado a tu cuenta y no al equipo. Conviene completar este paso apenas te registrás y no dejarlo para el día en que necesitás publicar con urgencia, porque hasta no confirmar el email la cuenta permanece limitada. Pensá además que un correo verificado es la base de la recuperación de acceso: si alguna vez olvidás la contraseña, el sistema usará esa casilla para devolverte el control, así que mantené el acceso a ese email a lo largo del tiempo."
      ),
      h2("Completar tu perfil de fotógrafo"),
      p(
        "Con el email verificado, dedicá unos minutos a completar tu perfil público. Cargá tu nombre de fotógrafo o estudio, una imagen de presentación y una descripción honesta de tu especialidad. Este perfil es tu carta de presentación cuando un organizador evalúa a quién convocar o cuando un cliente entra a tu galería por primera vez."
      ),
      p(
        "Definí también cómo querés que te encuentren: zona de cobertura, tipo de eventos y, si corresponde, enlaces a redes o portfolio. Cuanta más claridad ofrezcas, menos consultas previas vas a recibir y mejor calificado llega el público que entra a comprar tus fotos."
      ),
      p(
        "Revisá la ortografía y la coherencia de los datos antes de guardar. Un perfil con información desactualizada —por ejemplo, una ciudad donde ya no trabajás— genera confusión y consultas que no se traducen en ventas. Tratá esta sección como tu vidriera permanente, no como un trámite que se completa una vez y se olvida."
      ),
      h2("Conectar Mercado Pago"),
      p(
        "El paso que transforma tu cuenta en una herramienta de venta real es la conexión con Mercado Pago. ComprameLaFoto usa esta pasarela como medio de cobro principal en Argentina, lo que permite que el dinero de cada venta se acredite en tu cuenta dentro del flujo habitual de pagos online del país."
      ),
      p(
        "Para vincularla, ingresá a la sección de pagos o cobros de tu panel y seguí el proceso de autorización con tus credenciales de Mercado Pago. No compartís tu contraseña con la plataforma: la conexión se hace mediante el sistema de permisos de la propia pasarela, que valida que sos el titular de la cuenta."
      ),
      p(
        "Si todavía no tenés Mercado Pago, creá la cuenta en su sitio, verificá tu identidad y volvé a ComprameLaFoto para completar la vinculación. Sin este enlace podés armar álbumes y previsualizar todo, pero las ventas quedarían sin un destino donde acreditar el dinero, así que conviene resolverlo antes de publicar."
      ),
      p(
        "Si dudás sobre qué tipo de cuenta de Mercado Pago usar, sabé que podés vincular tanto una cuenta personal como una asociada a tu actividad comercial; lo importante es que esté a tu nombre y verificada, porque ese es el dato que valida la pasarela al autorizar la conexión. Muchos fotógrafos que recién formalizan su emprendimiento aprovechan este momento para ordenar sus cobros y separar el dinero de las ventas del uso personal, una práctica que después facilita la contabilidad. Tené presente que la vinculación es reversible: si en algún momento necesitás cambiar la cuenta asociada, podés rehacer el proceso de autorización sin perder tus álbumes ni tu historial. Dejar este enlace resuelto desde el inicio evita que una venta quede sin destino justo cuando empezás a recibir a tus primeros compradores."
      ),
      h2("Primeros pasos después del alta"),
      p(
        "Con la cuenta verificada, el perfil cargado y Mercado Pago conectado, ya estás en condiciones de crear tu primer álbum. Te recomendamos empezar con un evento acotado o una sesión chica para familiarizarte con el flujo completo: subir fotos, configurar precios, publicar y compartir el link."
      ),
      p(
        "Hacé una compra de prueba con un monto bajo, idealmente desde otro dispositivo o pidiéndole a un conocido, para ver la experiencia tal como la vive el comprador. Así confirmás que el pago se procesa, que la descarga se libera y que el correo de confirmación llega correctamente antes de exponer una galería con cientos de clientes reales."
      ),
      p(
        "Aprovechá los tutoriales del blog para profundizar cada etapa: creación de álbumes, configuración de precios, packs y preventa escolar. El alta es solo la puerta de entrada; el valor aparece cuando publicás tu primer evento y ves la primera venta acreditada sin haber tenido que coordinar transferencias ni enviar archivos a mano."
      ),
      h3("Seguridad y cuidado de tu cuenta"),
      p(
        "Tu cuenta concentra el acceso a tus archivos originales y al dinero de tus ventas, así que cuidarla es parte del oficio. Usá una contraseña exclusiva, que no repitas en tus redes ni en tu correo, y cambiala apenas sospeches que alguien más la conoce. Evitá iniciar sesión en computadoras compartidas sin cerrar la sesión después, sobre todo en equipos prestados durante un evento. Un descuido en este punto puede exponer material privado de tus clientes, así que tratá tus credenciales con el mismo recaudo con el que cuidás la llave de tu estudio."
      ),
      p(
        "El correo asociado a tu cuenta es la llave de recuperación si alguna vez perdés el acceso, por eso conviene que sea una casilla a la que entres siempre y que esté bien protegida. Si tu proveedor de email ofrece verificación en dos pasos, activala: una capa extra de seguridad en el correo protege indirectamente tu cuenta de ComprameLaFoto. Mantené esos datos de contacto actualizados para que, ante cualquier inconveniente, puedas recuperar el acceso sin depender de información vieja que ya no controlás."
      ),
      p(
        "Revisá de tanto en tanto la actividad de tu cuenta, especialmente después de eventos grandes con muchas ventas. Detectar a tiempo algo que no cuadra —un movimiento que no reconocés, un cambio que no hiciste— te permite reaccionar rápido y pedir ayuda al soporte antes de que el problema crezca. La prevención cuesta unos minutos; resolver un acceso comprometido cuando ya hubo daño cuesta mucho más en tiempo y en la confianza de tus clientes."
      ),
      p(
        "Por último, ordená los roles si trabajás con otras personas. Si alguien te ayuda a cargar fotos o a atender consultas, definí con claridad qué tareas hace y evitá compartir tus credenciales principales más de lo necesario. Cuanto más prolijo sea el manejo de los accesos, menos riesgo de errores y de filtraciones. Una cuenta bien cuidada no solo protege tu negocio: también es parte del compromiso de privacidad que asumís con las familias y los clientes que confían sus imágenes a tu trabajo."
      ),
    ],
    faq: [
      {
        q: "¿Registrarme tiene algún costo?",
        a: "No. Crear la cuenta de fotógrafo y armar álbumes es gratuito. ComprameLaFoto cobra una comisión únicamente cuando concretás una venta, según la configuración vigente de tu cuenta.",
      },
      {
        q: "¿Puedo registrarme sin tener Mercado Pago todavía?",
        a: "Sí, podés completar el alta y armar tus galerías, pero necesitás vincular Mercado Pago antes de empezar a vender para que el dinero de cada venta tenga dónde acreditarse.",
      },
      {
        q: "No me llegó el correo de verificación, ¿qué hago?",
        a: "Revisá las carpetas de spam y promociones, agregá el remitente a tus contactos y, si no aparece, usá la opción de reenviar verificación desde la pantalla de acceso esperando solo el último correo.",
      },
      {
        q: "¿Puedo cambiar mi nombre de fotógrafo después?",
        a: "Sí. Los datos del perfil público se pueden editar desde tu panel cuando lo necesites, aunque conviene definir un nombre estable para que tus clientes te reconozcan entre eventos.",
      },
      {
        q: "Ya tenía cuenta como comprador, ¿sirve para vender?",
        a: "Conviene recuperar el acceso a ese correo en lugar de crear un alta nueva, así evitás tener dos perfiles separados y mantenés todas tus ventas y datos en una sola cuenta.",
      },
    ],
    conclusion:
      "Registrarte en ComprameLaFoto es un proceso breve pero decisivo: con el email verificado, el perfil completo y Mercado Pago conectado quedás listo para publicar tu primer álbum y cobrar sin trámites manuales. Tomate los minutos extra para dejar todo bien configurado desde el inicio y vas a evitar correcciones cuando ya tengas clientes comprando.",
    ctaAudience: resolveCtaAudience(["fotografos"]),
    imageScene:
      "Professional photographer at a laptop completing online registration in a bright home studio, notebook and camera on desk, hyperrealistic documentary photography style",
    imageAltSubject:
      "Fotógrafo completando el registro de su cuenta en ComprameLaFoto desde una notebook",
    imageCaption: "El alta gratuita es el primer paso para vender fotos online en Argentina.",
  },

  "como-crear-tu-primer-album": {
    seoTitle: "Cómo crear tu primer álbum en ComprameLaFoto",
    seoDescription:
      "Aprendé a crear tu primer álbum en ComprameLaFoto: subir fotos, ordenar la galería, elegir portada y dejar todo listo para vender sin errores comunes.",
    excerpt:
      "Aprendé a crear tu primer álbum en ComprameLaFoto: subir fotos, organizar la galería y prepararla para la venta.",
    blocks: [
      p(
        "El álbum es la unidad básica con la que trabajás en ComprameLaFoto: es el contenedor donde viven las fotografías de un evento, una jornada escolar o una sesión, y desde donde los clientes ven, eligen y compran. Crear bien tu primer álbum te ahorra retrabajo más adelante, porque define cómo se organiza la galería, qué portada muestra y cómo se prepara para la venta. En esta guía recorremos el proceso completo: qué es exactamente un álbum, cómo crear uno nuevo, subir y ordenar las fotos, configurar la portada y los datos básicos, y revisar todo antes de publicar para no arrastrar errores cuando ya haya compradores entrando."
      ),
      h2("Qué es un álbum en ComprameLaFoto"),
      p(
        "Un álbum agrupa las fotografías de un mismo trabajo bajo un título, una portada y una configuración de precios común. Pensalo como la carpeta que antes armabas para entregar un evento, solo que acá vive online, protegida, y con la lógica de compra ya incorporada. Cada foto dentro del álbum se puede vender en digital, impresión o ambas según lo que habilites."
      ),
      p(
        "A diferencia de subir imágenes sueltas a una nube, el álbum mantiene todo ordenado y vinculado a un mismo cliente o evento. Eso facilita compartir un único link, aplicar un mismo esquema de precios y, después, leer tus ventas por trabajo en lugar de perseguir archivos dispersos entre carpetas y mensajes."
      ),
      p(
        "Podés tener tantos álbumes como necesites: uno por carrera, uno por curso escolar, uno por sesión privada. Esta separación es la que después te permite analizar qué tipo de trabajo te deja más ingresos y replicar el formato que mejor funciona con tu público."
      ),
      h2("Crear un álbum nuevo"),
      p(
        "Desde tu panel de fotógrafo, buscá la opción de crear álbum. Lo primero que vas a definir es el nombre: usá algo claro y reconocible para el cliente, como «Maratón Ciudad 2026» o «Sala Verde - Acto de fin de año», en vez de códigos internos que solo entendés vos. Ese título aparece en la galería y en el link que vas a compartir."
      ),
      p(
        "Al crear el álbum, este nace en estado de borrador. Eso significa que podés trabajarlo con calma —subir, ordenar, configurar— sin que nadie lo vea todavía. Recién cuando lo publiques quedará accesible para los compradores, así que no hay apuro ni riesgo de exponer un trabajo a medio armar."
      ),
      p(
        "Si cubrís el mismo tipo de evento seguido, definí desde el inicio una convención de nombres y fechas. Mantener un criterio constante te facilita encontrar álbumes viejos, comparar temporadas y dar soporte cuando un cliente vuelve meses después buscando una foto puntual."
      ),
      h2("Subir y ordenar fotografías"),
      p(
        "Con el álbum creado, llega la carga de fotos. Subí las imágenes ya editadas y en la resolución que querés entregar, porque ese archivo es el que recibirá el cliente tras el pago. Trabajar con la selección final y no con el material en bruto evita que se filtre una toma descartada o una versión sin retoque."
      ),
      p(
        "La carga puede demorar según la cantidad de fotos y tu conexión, así que conviene hacerla desde un lugar con internet estable y no a último momento. Si el evento fue grande, subí por tandas y verificá que el total cargado coincida con lo que esperabas antes de seguir."
      ),
      p(
        "Una vez arriba, ordená la galería pensando en cómo navega el comprador: por horario, por categoría, por largada o por curso. Un orden lógico reduce el tiempo que tarda alguien en encontrarse y, en eventos masivos, complementa muy bien la búsqueda por dorsal o por selfie cuando están disponibles."
      ),
      p(
        "Conviene pensar el orden no solo para el día de la publicación, sino para las semanas siguientes, cuando un cliente vuelve buscando una foto puntual. Una galería ordenada por momentos claros del evento envejece bien: meses después seguís entendiendo dónde está cada cosa y respondés rápido cualquier consulta. Si trabajás con muchas imágenes, aprovechá esta etapa para descartar las tomas movidas, repetidas o con los ojos cerrados, en lugar de publicarlas y ensuciar la experiencia de compra. Cada foto de más que no aporta obliga al comprador a mirar otra pantalla antes de encontrar la suya. Un álbum curado, con las mejores tomas bien ordenadas, transmite más profesionalismo y vende mejor que uno enorme y desprolijo donde el cliente se pierde entre cientos de variantes casi idénticas del mismo instante."
      ),
      h2("Configurar portada y datos básicos"),
      p(
        "La portada es lo primero que ve quien abre tu link, así que elegí una imagen representativa, nítida y atractiva del evento. Una buena portada transmite calidad y anima a recorrer el resto; una imagen floja o poco clara hace que el cliente dude antes de invertir tiempo en buscar sus fotos."
      ),
      p(
        "Completá los datos básicos del álbum: fecha, descripción breve y cualquier referencia que ayude al comprador a confirmar que está en el lugar correcto. En contextos escolares, indicar curso o jornada evita confusiones; en deportes, mencionar la disciplina y la fecha orienta a quien llega desde un link compartido en un grupo."
      ),
      p(
        "Estos detalles parecen menores, pero son los que sostienen la experiencia de compra. Un álbum bien rotulado genera confianza, reduce las consultas de «¿estas son las fotos de tal evento?» y deja una imagen profesional que invita a volver para el próximo trabajo."
      ),
      h2("Revisar antes de publicar"),
      p(
        "Antes de pasar el álbum a publicado, hacé una revisión final como si fueras el cliente. Abrí la previsualización, confirmá que las fotos correctas están cargadas, que la portada se ve bien y que los precios configurados son los que querés cobrar. Es mucho más fácil corregir ahora que después de difundir el link."
      ),
      p(
        "Chequeá especialmente que no se haya colado una foto privada, una toma de otro evento o una imagen repetida. En trabajos con menores o galerías escolares, esta revisión también cumple un rol de cuidado: asegurate de publicar solo lo que corresponde y lo que está autorizado a mostrarse."
      ),
      p(
        "Si podés, hacé una compra de prueba con un monto bajo para ver el flujo completo de pago y descarga. Confirmar que todo funciona de punta a punta antes de la publicación masiva es la diferencia entre un lanzamiento tranquilo y una tarde respondiendo reclamos por algo que se podía haber detectado en cinco minutos."
      ),
      p(
        "Sumá a esa revisión una mirada desde el celular, porque buena parte de tus compradores va a entrar desde el teléfono y no desde una pantalla grande. Lo que en la computadora se ve perfecto a veces en el móvil queda incómodo: una portada que se recorta mal, un título demasiado largo o fotos que tardan en cargar con datos móviles. Comprobar la experiencia tal como la vive la mayoría te evita sorpresas y reclamos. Aprovechá también para verificar que el link se comparta correctamente y genere una vista previa clara cuando lo pegás en WhatsApp: ese pequeño detalle influye en cuántas personas se animan a abrirlo. Dedicarle unos minutos a estas pruebas finales es la diferencia entre una galería que inspira confianza desde el primer toque y una que genera dudas antes incluso de mostrar la primera foto."
      ),
      h2("Errores comunes al armar el primer álbum"),
      p(
        "El error más frecuente es subir el material sin editar o en baja resolución, lo que termina en clientes que reciben un archivo distinto al que esperaban. Definí desde el inicio qué versión entregás y cargá siempre ese archivo final, así no tenés que rehacer la galería ni atender reclamos por calidad."
      ),
      p(
        "Otro tropiezo habitual es publicar con precios provisorios o sin revisar, y después tener que modificarlos con ventas ya en curso. Dedicá unos minutos a configurar bien el esquema de precios antes de difundir; el tutorial específico de pricing te ayuda a decidir valores y descuentos acordes a cada tipo de evento."
      ),
      p(
        "Por último, evitá compartir el link antes de la revisión final. Mandar la galería al grupo de WhatsApp y darte cuenta después de que faltaba una tanda de fotos o de que la portada estaba mal genera una avalancha de mensajes. Publicá con todo listo y comunicá una sola vez, de forma clara."
      ),
      h3("Mantener tus álbumes ordenados en el tiempo"),
      p(
        "Cuando recién empezás, manejar uno o dos álbumes es simple, pero a medida que sumás eventos el orden se vuelve clave para no perderte. Definí desde el principio una convención de nombres que combine institución o evento, fecha y, si hace falta, alguna referencia interna. Mantener ese criterio constante te permite encontrar trabajos viejos en segundos cuando un cliente vuelve meses después buscando una foto puntual, en lugar de revolver una lista interminable de álbumes con nombres improvisados que ni vos recordás a qué corresponden."
      ),
      p(
        "Aprovechá los estados del álbum para distinguir lo que está en preparación, lo publicado y lo que ya cumplió su ciclo de venta. Un panel donde cada trabajo refleja su situación real te da una visión clara de tu operación y evita confusiones como difundir por error un álbum viejo o dejar uno a medio armar visible al público. Esa disciplina de mantener cada álbum en el estado correcto es lo que diferencia una gestión profesional de un acumulado caótico de carpetas."
      ),
      p(
        "Pensá también en tu respaldo personal. La plataforma aloja las fotos que publicás, pero la custodia última de tus originales editados es tuya: mantené siempre una copia propia bien guardada. Si alguna vez necesitás reconstruir un álbum, reenviar material por un inconveniente justificado o reutilizar tomas para una nueva propuesta, tener tus archivos organizados por evento te ahorra horas. El orden en tu disco y el orden en tu panel se complementan y son parte de cuidar tu trabajo."
      ),
      p(
        "Por último, revisá periódicamente qué álbumes siguen activos y cuáles conviene archivar. Cerrar de forma ordenada los trabajos que ya vendieron lo que tenían para vender mantiene tu panel liviano y te ayuda a enfocarte en lo que está generando ingresos hoy. Esa limpieza regular, además, te da una foto honesta de cuántos eventos manejás por temporada y te permite planificar mejor tu agenda y tu capacidad de producción para los meses siguientes."
      ),
    ],
    faq: [
      {
        q: "¿En qué resolución conviene subir las fotos?",
        a: "Subí las imágenes ya editadas en la resolución que querés entregar, porque ese mismo archivo es el que descarga el cliente tras pagar. Evitá cargar material en bruto o en baja calidad.",
      },
      {
        q: "¿Puedo crear el álbum y publicarlo más tarde?",
        a: "Sí. El álbum nace en estado de borrador y solo queda visible cuando lo publicás, así podés armarlo y revisarlo con calma sin que nadie lo vea antes de tiempo.",
      },
      {
        q: "¿Cuántas fotos puedo cargar en un álbum?",
        a: "Podés armar álbumes acordes al tamaño de tu evento. Para coberturas grandes conviene subir por tandas y verificar que el total cargado coincida con lo que esperabas.",
      },
      {
        q: "¿Conviene un álbum por evento o uno general?",
        a: "Un álbum por evento, curso o sesión mantiene todo ordenado, te deja compartir un link específico y facilita leer tus ventas por trabajo en lugar de mezclar todo en una sola galería.",
      },
      {
        q: "¿Cómo evito publicar una foto equivocada?",
        a: "Usá la previsualización y revisá la galería como si fueras el cliente antes de pasar a publicado, prestando atención a fotos de otros eventos, repetidas o que no deban mostrarse.",
      },
    ],
    conclusion:
      "Crear tu primer álbum en ComprameLaFoto es sencillo, pero hacerlo con criterio —fotos finales, orden lógico, portada cuidada y revisión previa— marca la diferencia entre una galería que vende sola y una que genera reclamos. Tratá este primer trabajo como tu plantilla: una vez que dominás el flujo, cada nuevo evento se publica en minutos y con la tranquilidad de que todo está bien configurado.",
    ctaAudience: resolveCtaAudience(["fotografos"]),
    imageScene:
      "Photographer uploading event photos to a laptop, camera memory cards on table, school sports event thumbnails on screen, hyperrealistic documentary photography style",
    imageAltSubject:
      "Fotógrafo subiendo fotos de un evento a un álbum nuevo en ComprameLaFoto",
    imageCaption: "Un álbum bien armado ordena la galería y la deja lista para vender.",
  },

  "como-configurar-precios-fotografias": {
    seoTitle: "Cómo configurar precios de fotografías en ComprameLaFoto",
    seoDescription:
      "Definí precios de fotos digitales e impresiones, descuentos por cantidad y bandas de precio en tus galerías de ComprameLaFoto con ejemplos por tipo de evento.",
    excerpt:
      "Definí precios de fotos digitales e impresiones, descuentos por cantidad y bandas de precio en tus galerías.",
    blocks: [
      p(
        "El precio es una de las decisiones que más impacta en tus ventas y, sin embargo, suele resolverse a las apuradas. En ComprameLaFoto tenés varias herramientas para ajustarlo a cada tipo de trabajo: precio digital uniforme, descuentos por cantidad, valores específicos para impresiones y combinaciones que incentivan compras más grandes. Configurarlo bien no es solo poner un número: es leer a tu público, entender cuánto está dispuesto a pagar y diseñar un esquema que aumente el ticket promedio sin espantar al comprador. En esta guía vemos los tipos de precio disponibles, cómo aplicarlos y ejemplos concretos según el evento que estés cubriendo."
      ),
      h2("Tipos de precio en la plataforma"),
      p(
        "ComprameLaFoto distingue principalmente entre el precio de la fotografía digital y el de las impresiones, y permite además sumar descuentos por cantidad y armar packs. Cada palanca responde a una intención distinta: el digital es tu producto base, las impresiones agregan un complemento físico y los descuentos empujan a llevar más de una foto en la misma compra."
      ),
      p(
        "Entender esta estructura antes de cargar valores te evita configuraciones contradictorias, como un descuento que termina haciendo que comprar diez fotos cueste casi lo mismo que comprar tres. Pensá primero la lógica comercial y después traducila a números dentro del panel."
      ),
      p(
        "La flexibilidad es útil, pero no te obliga a usar todo. Muchos fotógrafos empiezan con un precio digital uniforme y un descuento simple por cantidad, y recién suman impresiones y packs cuando dominan el flujo. No hay un único esquema correcto: hay uno que funciona para tu público y tu tipo de evento."
      ),
      h2("Precio digital uniforme"),
      p(
        "El esquema más común es asignar un mismo precio a cada foto digital del álbum. Es simple de comunicar —«cada foto sale tanto»— y fácil de entender para el comprador, que sabe de antemano cuánto va a gastar según cuántas elija. Esta claridad reduce dudas y acelera la decisión de compra."
      ),
      p(
        "Para definir ese valor, mirá tu mercado, el tipo de evento y el esfuerzo que implicó la producción. Un precio demasiado alto frena la compra impulsiva típica de eventos masivos; uno demasiado bajo deja dinero sobre la mesa y devalúa tu trabajo. Buscá el punto donde el cliente compre sin pensarlo demasiado y vos sientas que el valor es justo."
      ),
      p(
        "El precio uniforme funciona especialmente bien en deportes y eventos con muchos asistentes, donde cada persona suele llevar pocas fotos suyas. Al haber alto volumen de compradores, no necesitás un valor alto por unidad: la suma de muchas compras chicas termina siendo tu ingreso principal."
      ),
      h2("Descuentos por cantidad"),
      p(
        "Los descuentos por cantidad premian a quien compra varias fotos en la misma operación. Es una de las formas más efectivas de subir el ticket promedio: el cliente que iba a llevar dos fotos se anima a una tercera o cuarta cuando ve que el precio por unidad baja. Vos ganás en volumen lo que cedés en margen unitario."
      ),
      p(
        "Diseñá los tramos con cuidado para que cada salto tenga sentido. Un esquema típico ofrece un precio por foto suelta, uno mejor a partir de tres y uno aún más conveniente a partir de cinco o diez. El objetivo es que el comprador sienta que «por un poco más me llevo bastante más», no que el descuento canibalice tu ingreso."
      ),
      p(
        "En contextos escolares o familiares, donde una persona suele querer muchas fotos del mismo chico, los descuentos por cantidad son casi imprescindibles. Una familia que compra la jornada completa con un precio escalonado se va satisfecha y vos cerrás una venta mucho mayor que vendiendo foto por foto a valor pleno."
      ),
      p(
        "Un punto que muchos pasan por alto es comunicar el descuento de forma visible, porque un beneficio que el cliente no percibe no influye en su decisión. Si la persona no se entera de que llevando tres fotos paga bastante menos por cada una, va a comprar una sola y se irá. Dejar clara la escala —cuánto cuesta una, cuánto el conjunto de varias— en la galería y en los mensajes de difusión es tan importante como el descuento en sí. Pensá los tramos también en función del comportamiento real que observás evento tras evento: si notás que la mayoría compra de a dos, ubicá el salto atractivo justo en la tercera para empujar ese paso extra. Ajustar los umbrales con datos de tus propias ventas, en lugar de copiarlos de otro, es lo que vuelve el esquema verdaderamente rentable para tu público."
      ),
      h2("Precios de impresiones"),
      p(
        "Las impresiones se configuran aparte del digital, con valores según tamaño y acabado. Acá el costo de producción y el envío juegan un rol que no existe en lo digital, así que tu precio tiene que cubrir esos costos y aún así dejarte margen. No traslades el mismo razonamiento del archivo digital, que no tiene costo marginal de reproducción."
      ),
      p(
        "Definí pocos tamaños bien elegidos en lugar de una lista interminable que paraliza al comprador. Un par de formatos populares —por ejemplo, una medida estándar y una ampliación— suele cubrir la demanda real. Demasiadas opciones generan dudas y terminan reduciendo las ventas en vez de aumentarlas."
      ),
      p(
        "Las impresiones funcionan muy bien como complemento del digital: el cliente que ya compró el archivo a veces quiere además la copia física para enmarcar o regalar. Comunicar esa posibilidad en la galería, con precios claros, abre una segunda venta sobre la misma foto sin esfuerzo adicional de tu parte."
      ),
      p(
        "Al fijar el valor de cada impresión, sumá mentalmente todos los costos que la rodean: el material, la producción del laboratorio, el embalaje y el envío o la logística de entrega. Recién sobre ese piso conviene calcular tu margen, porque una impresión vendida a pérdida termina siendo trabajo que pagás de tu propio bolsillo. A diferencia del archivo digital, que podés reproducir infinitas veces sin costo, cada copia física consume recursos concretos cada vez que se produce. Por eso conviene reservar los precios más agresivos para lo digital y mantener las impresiones en un valor que respete ese piso de gasto. Si querés que la copia física resulte igual de atractiva, lográlo a través de packs que combinen digital e impresión, donde el cliente percibe el conjunto como una oportunidad sin que vos resignes el margen de la parte impresa."
      ),
      h2("Buenas prácticas de pricing"),
      p(
        "Definí tus precios antes de publicar y evitá cambiarlos con ventas ya en curso, porque genera percepción de improvisación y reclamos de quienes compraron a otro valor. Si vas a hacer una promoción por tiempo limitado, comunicá el plazo con claridad para que la urgencia juegue a favor en lugar de generar desconfianza."
      ),
      p(
        "Mantené coherencia entre eventos similares. Si cobrás un valor por una carrera y otro muy distinto por otra equivalente, los clientes que cruzan ambos eventos lo notan. La consistencia construye reputación de precios justos y te ahorra tener que justificar cada número."
      ),
      ul([
        "Pensá el precio por evento, no un único valor para todo tu catálogo.",
        "Usá descuentos por cantidad para subir el ticket sin frenar la compra inicial.",
        "Cubrí siempre el costo de producción y envío al fijar precios de impresiones.",
        "Ofrecé pocos tamaños bien elegidos en lugar de una lista que abruma.",
        "Cerrá la configuración antes de publicar para no cambiar valores con ventas activas.",
      ]),
      h2("Ejemplos por tipo de evento"),
      p(
        "En una maratón con miles de corredores, conviene un precio digital uniforme accesible y descuentos suaves por cantidad, apostando al volumen de compradores. Cada persona lleva pocas fotos suyas, así que el valor por unidad importa menos que la facilidad para comprar rápido desde el celular apenas termina la carrera."
      ),
      p(
        "En una sesión escolar o familiar, el esquema cambia: una sola persona quiere muchas fotos del mismo protagonista. Ahí los descuentos por cantidad y los packs son clave, y las impresiones suman bien porque las familias valoran la copia física. Un precio escalonado bien armado puede multiplicar el ticket frente a la venta unitaria."
      ),
      p(
        "En sociales y egresados con galerías privadas, podés sostener un valor digital algo más alto, porque la demanda es específica y emocional. El comprador busca su recuerdo concreto y está dispuesto a pagar por él. Combiná digital con impresiones de mayor tamaño para captar a quienes quieren un objeto físico del momento."
      ),
      h3("Ajustar precios según los resultados"),
      p(
        "El pricing no es una decisión que se toma una sola vez y queda grabada en piedra. Después de cada evento, mirá cómo se comportaron tus precios: cuántas fotos llevó en promedio cada comprador, si los descuentos por cantidad efectivamente empujaron compras más grandes y si las impresiones tuvieron salida. Esos datos, que encontrás en tu panel de ventas, son la materia prima para afinar tu esquema. Vender mucho a precios bajos o poco a precios altos te dicen cosas distintas sobre dónde está tu punto óptimo."
      ),
      p(
        "Si notás que casi nadie pasa de una foto, quizás tu descuento por cantidad no es lo suficientemente atractivo o no está bien comunicado. Si en cambio vendés volumen pero sentís que dejaste dinero sobre la mesa, probá subir levemente el valor unitario en el próximo evento equivalente y compará. Estos ajustes conviene hacerlos entre eventos, no con ventas en curso, para no generar reclamos de quienes compraron a otro precio y para poder medir el efecto de cada cambio de forma limpia."
      ),
      p(
        "Tené presente que el precio también comunica valor. Un evento de alto esfuerzo o de público específico tolera valores más altos que una cobertura masiva donde la compra es impulsiva. No tengas miedo de diferenciar: cobrar distinto según el tipo de trabajo no es incoherencia, es leer cada mercado. Lo que sí conviene mantener es la consistencia entre eventos parecidos, para que un cliente que cruza dos coberturas similares no perciba precios arbitrarios que erosionen su confianza."
      ),
      p(
        "Por último, considerá siempre tu ingreso neto y no solo el precio de vidriera. La comisión de la plataforma y la dinámica de Mercado Pago influyen en cuánto te queda efectivamente de cada venta, y los costos de producción pesan en las impresiones. Calcular hacia atrás —cuánto querés ganar por foto y qué precio implica eso— es más sólido que poner un número al azar. Un pricing pensado desde el resultado deseado te da control real sobre la rentabilidad de tu trabajo."
      ),
    ],
    faq: [
      {
        q: "¿Conviene un precio igual para todas las fotos?",
        a: "El precio digital uniforme es el esquema más simple de comunicar y funciona muy bien en eventos masivos. En contextos escolares o familiares conviene sumarle descuentos por cantidad para aprovechar que una persona compra muchas fotos.",
      },
      {
        q: "¿Cómo defino un buen valor de venta?",
        a: "Mirá tu mercado, el tipo de evento y el esfuerzo de producción. Buscá un precio que el cliente pague sin dudar demasiado y que a vos te parezca justo; ni tan alto que frene la compra ni tan bajo que devalúe tu trabajo.",
      },
      {
        q: "¿Los precios de impresiones se cargan aparte?",
        a: "Sí, las impresiones tienen su propia configuración según tamaño y acabado. Recordá que acá hay costo de producción y envío, así que el precio debe cubrir esos costos y dejarte margen.",
      },
      {
        q: "¿Puedo cambiar los precios después de publicar?",
        a: "Técnicamente sí, pero conviene evitarlo con ventas en curso porque genera reclamos de quienes compraron a otro valor. Definí el esquema antes de difundir el link.",
      },
      {
        q: "¿Para qué sirven los descuentos por cantidad?",
        a: "Incentivan que el cliente lleve más fotos en la misma compra, subiendo tu ticket promedio. Diseñá tramos con saltos que tengan sentido para que el comprador sienta que conviene agregar una foto más.",
      },
    ],
    conclusion:
      "Configurar precios en ComprameLaFoto es una decisión comercial, no un trámite: el digital uniforme da claridad, los descuentos por cantidad suben el ticket y las impresiones abren una segunda venta sobre la misma foto. Ajustá el esquema a cada tipo de evento, dejalo cerrado antes de publicar y revisá los resultados para afinarlo en tu próximo trabajo.",
    ctaAudience: resolveCtaAudience(["fotografos"]),
    imageScene:
      "Photographer reviewing pricing spreadsheet beside camera gear, natural window light, focused expression, hyperrealistic documentary photography style",
    imageAltSubject:
      "Fotógrafo analizando precios de fotos digitales e impresiones junto a su equipo",
    imageCaption: "Un esquema de precios bien pensado aumenta el ticket sin frenar la compra.",
  },

  "como-vender-fotos-digitales": {
    seoTitle: "Cómo vender fotos digitales en ComprameLaFoto",
    seoDescription:
      "Tutorial para activar y optimizar la venta de fotografías digitales en tus álbumes: formatos, marca de agua, flujo de compra, entrega automática y conversiones.",
    excerpt:
      "Tutorial para activar y optimizar la venta de fotografías digitales en tus álbumes y galerías.",
    blocks: [
      p(
        "La venta digital es el motor de ingresos de la mayoría de los fotógrafos en ComprameLaFoto: el cliente paga, descarga su foto en alta resolución y la usa para imprimir, compartir o guardar como recuerdo. A diferencia de las impresiones, no tiene costo de producción ni de envío, así que cada venta es casi pura ganancia una vez descontada la comisión. En esta guía vemos cómo activar la venta digital en tus álbumes, qué recibe el comprador, cómo proteger las vistas previas con marca de agua, cómo es el flujo de compra y la entrega automática, y qué pequeños ajustes ayudan a que más visitantes terminen comprando."
      ),
      h2("Activar venta digital en el álbum"),
      p(
        "El primer paso es habilitar la opción de venta digital dentro de la configuración del álbum. Una vez activada, cada fotografía queda disponible para comprarse en formato archivo, con el precio que definiste en tu esquema de pricing. Sin esta activación, la galería se ve pero no permite concretar la compra digital."
      ),
      p(
        "Revisá que el precio digital esté correctamente cargado antes de publicar. Es el dato que el comprador ve junto a cada foto y el que determina cuánto se acredita en tu Mercado Pago tras descontar la comisión de la plataforma. Un precio mal configurado se traduce directamente en ingresos por debajo de lo esperado."
      ),
      p(
        "Si el álbum combina digital con impresiones, confirmá que ambas opciones aparezcan claras para el cliente. La idea es que pueda elegir entre llevar solo el archivo, solo la copia física o ambos, sin que la interfaz lo confunda ni lo obligue a una opción que no quería."
      ),
      h2("Formatos y resolución entregada"),
      p(
        "El comprador recibe el archivo en la resolución que vos subiste, así que la calidad de entrega depende de cómo cargaste las fotos. Si subís en alta resolución, el cliente puede imprimir en buen tamaño; si subís liviano, limitás el uso posterior. Definí un estándar de entrega coherente con tu propuesta y mantenelo en todos los álbumes."
      ),
      p(
        "Entregá siempre la versión editada y final de cada imagen, no el archivo en bruto. Lo que el cliente descarga representa tu trabajo terminado: color corregido, recorte definido y retoque aplicado. Esa es la foto por la que paga y la que va a mostrar, así que es también tu mejor publicidad."
      ),
      p(
        "Pensá la resolución en función del uso típico de tu público. Para redes sociales alcanza con menos, pero muchos clientes quieren imprimir el recuerdo, y un archivo demasiado chico genera decepción y reclamos. Ante la duda, entregá calidad: el costo de almacenamiento es bajo comparado con la insatisfacción de una foto que no se puede ampliar."
      ),
      p(
        "Conviene mantener un criterio de entrega uniforme entre todos tus álbumes, porque la coherencia construye reputación: si un cliente recibe una foto excelente de una carrera y otra floja de un evento posterior, la diferencia se nota y resta confianza. Definí una vez tu estándar de resolución y respetalo en cada trabajo, salvo que un proyecto puntual pida algo distinto. Tené en cuenta también que el archivo que entregás puede terminar impreso en un cuadro grande o compartido en redes a pantalla completa, usos donde la calidad queda expuesta. Entregar siempre buena resolución no solo evita reclamos: convierte a cada foto vendida en una muestra de tu trabajo que circula y te consigue clientes nuevos. En digital, donde el costo de almacenar y entregar es marginal, no hay buenas razones para escatimar calidad y sí muchas para cuidarla."
      ),
      h2("Protección con marca de agua en vista previa"),
      p(
        "Mientras el cliente navega la galería sin haber pagado, ComprameLaFoto muestra las fotos con marca de agua y en una resolución de vista previa. Esto protege tu trabajo de descargas no autorizadas: cualquiera puede mirar y elegir, pero el archivo limpio en alta solo se libera después del pago aprobado."
      ),
      p(
        "Esta protección es lo que te permite exponer toda la galería sin miedo. El comprador ve exactamente qué fotos hay y cuáles son las suyas, lo que es imprescindible para que decida la compra, pero no puede quedarse con el archivo útil sin pasar por la caja. Es un equilibrio entre mostrar lo suficiente para vender y resguardar tu propiedad."
      ),
      p(
        "No veas la marca de agua como una molestia para el cliente, sino como la garantía que sostiene todo el modelo. Sin ella, no podrías mostrar las fotos abiertamente; con ella, podés compartir el link masivamente y dejar que cada persona explore con libertad sabiendo que tu material está protegido hasta el momento del pago."
      ),
      h2("Flujo de compra del cliente"),
      p(
        "Desde la galería, el cliente selecciona las fotos que quiere, las agrega al carrito y avanza al pago. El proceso está pensado para ser rápido y autoexplicativo, porque buena parte de las ventas ocurren por impulso poco después del evento, muchas veces desde el celular. Cuanto menos fricción, más compras se concretan."
      ),
      p(
        "El pago se realiza con Mercado Pago, el medio principal de la plataforma en Argentina. El comprador no necesita coordinar transferencias ni enviarte comprobantes: paga en el momento y el sistema confirma la operación automáticamente. Esto elimina el cuello de botella clásico de esperar que vos verifiques cada pago a mano."
      ),
      p(
        "Para muchas galerías públicas, el cliente puede comprar sin crear una cuenta compleja, lo que baja todavía más la barrera. Cuanto más directo sea el camino entre «encontré mi foto» y «ya la pagué», mejor convierte tu galería, sobre todo en eventos masivos donde la gente decide en caliente."
      ),
      p(
        "Para sostener ese impulso de compra conviene que la galería cargue rápido incluso con conexiones móviles imperfectas, que son las que usa la mayoría apenas termina un evento. Una galería pesada que tarda en mostrar las miniaturas pierde compradores antes de que lleguen al carrito, por más buenas que sean las fotos. También ayuda que el camino al pago sea corto y sin pasos innecesarios: cada formulario extra o decisión confusa es una oportunidad para que la persona abandone. Pensá el recorrido completo desde la mirada de alguien apurado, en la calle, con poca batería y muchas ganas de ver cómo salió. Cuanto menos le pidas y más directo sea llegar de la foto al pago aprobado, mayor será la proporción de visitantes que terminan comprando en lugar de prometerse volver más tarde y olvidarlo."
      ),
      h2("Entrega y descarga automática"),
      p(
        "Una vez aprobado el pago, la entrega es automática: el cliente accede a la descarga de sus fotos en alta resolución sin que vos tengas que intervenir. Esta es una de las grandes ventajas frente a vender por mensajería, donde cada entrega dependía de que estuvieras disponible para mandar los archivos."
      ),
      p(
        "El comprador recibe además la confirmación del pedido y el acceso a sus descargas, de modo que puede recuperarlas si cierra el navegador o cambia de dispositivo dentro de los plazos previstos. Esto reduce drásticamente las consultas de «pagué pero no me llegó», que suelen consumir mucho tiempo de soporte."
      ),
      p(
        "La automatización significa que tu galería vende incluso cuando dormís. Un cliente puede comprar a la madrugada del domingo y recibir sus fotos al instante, sin esperar a que vos abras el celular el lunes. Esa disponibilidad permanente es la que convierte la venta digital en un ingreso que escala sin sumar horas de trabajo manual."
      ),
      h2("Consejos para aumentar conversiones"),
      p(
        "Publicá rápido, idealmente el mismo día o al día siguiente del evento, mientras la emoción está fresca y la gente quiere ver cómo salió. Cuanto más tiempo pasa, más se enfría el interés y más caen las ventas. La velocidad de publicación es una de las palancas de conversión más subestimadas."
      ),
      p(
        "Facilitá que cada persona encuentre sus fotos: orden lógico, búsqueda por dorsal cuando corresponde y búsqueda por selfie en eventos masivos. Una galería donde es fácil encontrarse convierte mucho mejor que una donde el cliente tiene que recorrer miles de imágenes y abandona antes de llegar a las suyas."
      ),
      p(
        "Acompañá la difusión con un mensaje claro: dónde están las fotos, cómo buscarse y hasta cuándo estarán disponibles. Un plazo de venta comunicado con honestidad genera urgencia sana y empuja a decidir a quienes dejarían la compra para «después». La combinación de rapidez, facilidad de búsqueda y plazo claro es la receta de una galería que vende sola.",
      ),
      h3("Postventa y fidelización del cliente digital"),
      p(
        "La venta no termina con la descarga: un cliente satisfecho es la mejor fuente de nuevas ventas. Cuando alguien compra sus fotos digitales y queda contento con la calidad y la facilidad del proceso, es muy probable que te recomiende en su círculo o que vuelva a comprarte en el próximo evento. Cuidar esa experiencia de punta a punta —desde una galería bien organizada hasta una entrega sin fricciones— es una inversión en tu reputación que rinde mucho más que cualquier campaña de promoción."
      ),
      p(
        "Aprovechá cada compra como una oportunidad de ofrecer algo más. Quien ya pagó por una foto digital es el candidato natural a sumar una impresión para enmarcar o un pack con otras tomas del mismo evento. Comunicar estas opciones dentro de la galería, sin presionar, abre ventas adicionales sobre un cliente que ya demostró interés y confianza. El esfuerzo de captarlo ya está hecho; sumar valor a su compra es mucho más fácil que conseguir un comprador nuevo desde cero."
      ),
      p(
        "Atendé bien las consultas de postventa, aunque a veces parezcan menores. Una duda sobre cómo descargar, un pedido de ayuda con un archivo o una consulta sobre la calidad son momentos donde tu respuesta define la imagen que el cliente se lleva de tu trabajo. Resolver con rapidez y buena onda convierte un posible reclamo en una recomendación. En cambio, una consulta ignorada puede transformar a un cliente conforme en alguien que habla mal de tu servicio en su comunidad."
      ),
      p(
        "Pensá la fidelización a largo plazo, sobre todo si cubrís eventos recurrentes como ligas, escuelas o circuitos deportivos. Las mismas personas vuelven temporada tras temporada, y construir una relación donde saben que van a encontrar sus fotos rápido, a buen precio y con buena atención te asegura una base de compradores fieles. Esa recurrencia es uno de los activos más valiosos del negocio digital: ingresos previsibles que crecen con cada evento sin que tengas que reconquistar a tu público desde el principio."
      ),
    ],
    faq: [
      {
        q: "¿En qué resolución recibe el cliente la foto?",
        a: "En la resolución que vos subiste a la plataforma. Por eso conviene cargar las imágenes editadas en alta calidad: el archivo que entregás es el mismo que el cliente descarga tras pagar.",
      },
      {
        q: "¿Las fotos están protegidas antes del pago?",
        a: "Sí. Mientras el cliente navega, ve las fotos con marca de agua y en vista previa. El archivo limpio en alta resolución solo se libera después del pago aprobado.",
      },
      {
        q: "¿Tengo que enviar yo los archivos al comprador?",
        a: "No. La entrega es automática: una vez aprobado el pago, el cliente accede a la descarga sin que tengas que intervenir, incluso fuera de tu horario.",
      },
      {
        q: "¿Cómo paga el cliente?",
        a: "Con Mercado Pago, el medio de pago principal de ComprameLaFoto en Argentina. El sistema confirma la operación automáticamente, sin transferencias ni comprobantes manuales.",
      },
      {
        q: "¿Qué puedo hacer para vender más?",
        a: "Publicá rápido después del evento, facilitá la búsqueda de fotos con dorsal o selfie cuando corresponde y comunicá con claridad el plazo de venta para generar una urgencia sana.",
      },
    ],
    conclusion:
      "Vender fotos digitales en ComprameLaFoto combina lo mejor de la venta online: sin costo de producción, con entrega automática y pago seguro por Mercado Pago. Activá la opción, entregá calidad, confiá en la protección por marca de agua y enfocá tu energía en publicar rápido y facilitar la búsqueda. Esos detalles son los que transforman una galería en una fuente de ingresos que trabaja por vos las veinticuatro horas.",
    ctaAudience: resolveCtaAudience(["fotografos"]),
    imageScene:
      "Customer on smartphone browsing a photo gallery while photographer edits on desktop in background, hyperrealistic documentary photography style",
    imageAltSubject:
      "Cliente comprando fotos digitales desde el celular mientras el fotógrafo trabaja",
    imageCaption: "La venta digital entrega en alta resolución de forma automática tras el pago.",
  },

  "como-vender-impresiones": {
    seoTitle: "Cómo vender impresiones fotográficas en ComprameLaFoto",
    seoDescription:
      "Configurá la venta de impresiones: habilitá la galería, elegí tamaños y acabados, entendé la producción, el envío y el seguimiento de pedidos paso a paso.",
    excerpt:
      "Configurá la venta de impresiones fotográficas: tamaños, acabados y envío a través de ComprameLaFoto.",
    blocks: [
      p(
        "Las impresiones son un complemento de ingresos que muchos fotógrafos subestiman, sobre todo en eventos escolares, sociales y deportivos donde las familias todavía valoran tener la copia física en la mano. A diferencia del archivo digital, una impresión implica producción, costo de materiales y, en muchos casos, envío, así que su lógica comercial es distinta. En esta guía vemos cómo habilitar impresiones en tu galería, qué tamaños y productos ofrecer, cómo funciona la parte de laboratorio y producción, cómo vive el cliente la compra, cómo seguir cada pedido y qué recomendaciones comerciales ayudan a que esta línea sume sin complicarte la operación."
      ),
      h2("Habilitar impresiones en tu galería"),
      p(
        "El primer paso es activar la opción de impresiones dentro de la configuración del álbum, junto a —o en lugar de— la venta digital. Una vez habilitada, cada foto puede ofrecerse también como copia física, con los tamaños y precios que definas. Si no la activás, la galería solo permite la compra del archivo."
      ),
      p(
        "Conviene decidir desde el inicio qué álbumes tendrán impresiones y cuáles no. En una maratón con miles de corredores quizá te alcance con lo digital, mientras que en una sesión escolar o un casamiento la copia física puede ser la estrella. Adaptar la oferta al tipo de evento evita configurar de más y mantiene la galería simple."
      ),
      p(
        "Revisá que los precios de impresión estén bien cargados antes de publicar, recordando que acá sí hay costo de producción y envío. A diferencia del digital, donde el archivo se reproduce sin costo, cada copia física tiene un piso de gasto que tu precio tiene que cubrir para no terminar vendiendo a pérdida."
      ),
      h2("Tamaños y productos disponibles"),
      p(
        "Ofrecé pocos tamaños bien elegidos en lugar de una lista interminable que abruma al comprador. Una medida estándar para el uso cotidiano y una ampliación para enmarcar suelen cubrir la mayoría de la demanda. Cuando hay demasiadas opciones, el cliente duda, compara y muchas veces termina no comprando ninguna."
      ),
      p(
        "Pensá los formatos en función de tu público real. Las familias escolares suelen querer tamaños cómodos para llevar o regalar; quienes buscan un recuerdo deportivo destacado prefieren ampliaciones. Conocer ese comportamiento te permite ofrecer justo lo que la gente quiere comprar y no llenar la galería de productos que nadie pide."
      ),
      p(
        "Si tu propuesta incluye acabados distintos, comunicalos con claridad para que el cliente sepa qué está eligiendo. La diferencia entre un acabado y otro tiene que entenderse sin necesidad de que vos expliques cada caso por mensaje; una descripción breve y honesta evita reclamos y devoluciones por expectativas mal calibradas."
      ),
      p(
        "Una buena práctica es mostrar el mismo conjunto acotado de tamaños en todos tus álbumes que ofrecen impresión, para que tus clientes habituales ya sepan qué esperar y vos simplifiques la producción. Estandarizar los formatos reduce errores, agiliza el trabajo del laboratorio y te permite coordinar mejor cuando producís volumen. Pensá también en la proporción de las fotos al definir los tamaños: una imagen tomada en horizontal no siempre encaja bien en un formato pensado para vertical, y un recorte mal resuelto arruina una buena toma. Ofrecer medidas que respeten la proporción original de tus fotografías evita que el cliente reciba una copia con la cabeza cortada o con bordes vacíos. Cuanto más previsible y prolija sea tu oferta de impresión, menos dudas genera y más confianza transmite a la hora de sumar la copia física a la compra."
      ),
      h2("Laboratorio y producción"),
      p(
        "La parte de producción es lo que distingue a las impresiones de la venta digital. Una vez que el cliente paga, el pedido entra en un flujo de impresión que demora un tiempo determinado antes de estar listo. Es fundamental que conozcas esos plazos para comunicarlos con honestidad y no prometer entregas que no podés sostener."
      ),
      p(
        "Cuidá la calidad del material que enviás a imprimir: la copia física es un objeto que el cliente conserva y muestra, y una impresión floja daña tu reputación más que un archivo digital. Entregá a producción la versión final y correctamente preparada de cada foto, igual que harías con el archivo de descarga."
      ),
      p(
        "Tené presente que la producción agrega pasos que el digital no tiene, y por eso la operación requiere algo más de seguimiento. No es complejo, pero sí distinto: planificá tus tiempos sabiendo que entre el pago y la entrega física hay un proceso intermedio que conviene monitorear para que ningún pedido se quede trabado."
      ),
      h2("Experiencia de compra del cliente"),
      p(
        "Desde la galería, el cliente elige la foto, selecciona que la quiere impresa, define tamaño y cantidad y avanza al pago con Mercado Pago. El proceso es tan directo como el de la venta digital, con la diferencia de que después hay una producción y, si corresponde, un envío. Esa claridad inicial es clave para que la persona compre con confianza."
      ),
      p(
        "Si el pedido se envía, el cliente carga sus datos de entrega durante la compra. Asegurate de que ese paso sea claro, porque un dato de envío mal cargado genera demoras y reclamos. Cuanto más prolijo sea el formulario, menos problemas vas a tener al momento de despachar las copias."
      ),
      p(
        "Comunicá desde el principio que la impresión no es instantánea como la descarga digital. El cliente que entiende que su copia física llegará en unos días compra tranquilo; el que espera recibirla al toque se frustra. Manejar bien la expectativa al inicio es la mejor prevención de reclamos posteriores."
      ),
      p(
        "Reforzá esa expectativa en cada punto donde el cliente toma una decisión: al elegir el producto, en el carrito y en la confirmación. Repetir de forma amable que la impresión llega en unos días, y no al instante como la descarga digital, alinea lo que la persona imagina con lo que va a recibir. Una parte importante de los reclamos en impresiones no nace de un problema real de producción, sino de un malentendido sobre los tiempos que se podría haber evitado con una comunicación más clara desde el principio. Tené previsto también qué responder ante las consultas típicas —cuándo llega, cómo se envía, qué pasa si no está nadie para recibir— para resolverlas rápido y sin improvisar. Un comprador bien informado espera con paciencia; uno que se siente a oscuras escribe preocupado a los dos días de haber pagado."
      ),
      h2("Seguimiento de pedidos"),
      p(
        "Cada pedido de impresión atraviesa estados —pendiente, en producción, listo, enviado— que te permiten saber en qué etapa está cada copia. Revisar este seguimiento con regularidad te ayuda a detectar a tiempo cualquier pedido que se haya quedado trabado y a responder con precisión si un cliente consulta por el suyo."
      ),
      p(
        "Mantener el seguimiento al día también mejora la experiencia del comprador, que puede saber cuándo esperar su pedido sin tener que escribirte. Esta transparencia reduce la cantidad de mensajes de «¿cuándo llega?» y proyecta una imagen profesional que invita a volver a comprar."
      ),
      p(
        "Usá el panel de ventas para cruzar la información de impresiones con la de digitales y entender el peso real de cada línea en tus ingresos. Saber cuánto aportan las copias físicas te permite decidir si vale la pena potenciarlas en ciertos eventos o concentrarte en lo digital cuando la logística no compensa."
      ),
      h2("Recomendaciones comerciales"),
      p(
        "Ofrecé las impresiones como complemento del digital, no como reemplazo. El cliente que ya compró el archivo es el candidato natural a sumar una copia física para enmarcar o regalar. Comunicar esa posibilidad dentro de la galería abre una segunda venta sobre la misma foto sin esfuerzo extra de tu parte."
      ),
      p(
        "Usá los packs para combinar digital e impresión a un precio atractivo. Una foto en archivo más su copia ampliada, presentada como combo, suele convertir mejor que ofrecer ambas por separado a valor pleno. El cliente percibe que lleva más por un precio conveniente y vos subís el ticket promedio."
      ),
      p(
        "Reservá las impresiones para los eventos donde realmente aportan valor: escuelas, sociales, retratos y recuerdos que la gente quiere conservar físicamente. Forzar la copia física en contextos donde nadie la pide solo complica tu logística sin sumar ventas. La clave es leer a tu público y ofrecer impresiones donde haya demanda genuina."
      ),
      h3("Presentación y empaque de las impresiones"),
      p(
        "La impresión es un objeto físico que el cliente va a tocar, mostrar y conservar, así que la forma en que llega importa tanto como la foto misma. Una copia entregada con prolijidad —protegida, sin dobleces ni marcas— transmite cuidado y profesionalismo, mientras que una mal embalada arruina la percepción incluso de una gran imagen. Pensar la presentación como parte del producto, y no como un trámite final, es lo que hace que el cliente sienta que invirtió bien su dinero en un recuerdo de calidad."
      ),
      p(
        "Cuidá que la copia llegue en buenas condiciones, especialmente si hay envío de por medio. Un embalaje adecuado que evite que la impresión se arrugue o se dañe en el camino es clave para que la experiencia termine bien. En contextos donde la entrega es en mano, como en una escuela, una presentación ordenada por familia o por curso facilita la distribución y deja una imagen profesional ante toda la comunidad, que es justamente quien podría volver a contratarte."
      ),
      p(
        "Aprovechá la impresión como una vidriera de tu trabajo. Una copia física bien lograda circula: se cuelga en una pared, se regala, se muestra a familiares. Cada impresión de calidad es una recomendación silenciosa que puede traerte nuevos clientes que la vieron y preguntaron quién la hizo. Por eso conviene que cada copia que sale de tus manos represente lo mejor de tu trabajo, porque sigue hablando de vos mucho después de que la venta se concretó."
      ),
      p(
        "Pensá en pequeños detalles que agreguen valor sin complicarte la logística. Una entrega puntual, un mensaje cordial al avisar que el pedido está listo o una presentación cuidada son gestos que el cliente nota y agradece. En un mercado donde muchos compiten por precio, la experiencia alrededor de la impresión puede ser tu diferencial. No se trata de gastar de más, sino de tratar cada copia con el cuidado de quien sabe que está entregando un recuerdo importante para alguien."
      ),
    ],
    faq: [
      {
        q: "¿Cómo activo la venta de impresiones?",
        a: "Habilitá la opción de impresiones en la configuración del álbum, junto al digital o en lugar de él. Recordá cargar precios que cubran el costo de producción y envío antes de publicar.",
      },
      {
        q: "¿Cuántos tamaños conviene ofrecer?",
        a: "Pocos y bien elegidos. Una medida estándar y una ampliación suelen cubrir la mayor parte de la demanda; demasiadas opciones generan dudas y reducen las ventas.",
      },
      {
        q: "¿Cuánto tarda una impresión en estar lista?",
        a: "Depende del flujo de producción y, si hay envío, del despacho. Conocé esos plazos y comunicalos con honestidad para que el cliente compre con la expectativa correcta.",
      },
      {
        q: "¿Cómo sigo el estado de cada pedido impreso?",
        a: "Cada pedido pasa por estados como pendiente, en producción, listo y enviado. Revisá el seguimiento en tu panel para detectar trabas y responder consultas con precisión.",
      },
      {
        q: "¿Conviene vender impresiones en todos los eventos?",
        a: "No necesariamente. Funcionan mejor en escuelas, sociales y retratos, donde la gente valora la copia física. En eventos masivos a veces alcanza con lo digital.",
      },
    ],
    conclusion:
      "Las impresiones suman una línea de ingresos valiosa cuando las ofrecés en el evento adecuado y manejás bien producción, plazos y envío. Habilitalas en escuelas, sociales y retratos, ofrecé pocos tamaños claros, comunicá los tiempos con honestidad y usalas como complemento del digital para subir el ticket. Bien gestionadas, las copias físicas fidelizan a quienes valoran tener el recuerdo en la mano.",
    ctaAudience: resolveCtaAudience(["fotografos"]),
    imageScene:
      "Photographer holding printed photos over a light table, lab prints stacked neatly, warm studio lighting, hyperrealistic documentary photography style",
    imageAltSubject:
      "Fotógrafo revisando impresiones fotográficas sobre una mesa de luz en su estudio",
    imageCaption: "Las impresiones complementan la venta digital en escuelas y eventos sociales.",
  },

  "como-crear-packs-fotografias": {
    seoTitle: "Cómo crear packs de fotografías en ComprameLaFoto",
    seoDescription:
      "Armá packs y combos de fotos digitales o impresas para subir el ticket promedio: qué es un pack, cómo crearlo, combinarlo y comunicarlo con ejemplos efectivos.",
    excerpt:
      "Armá packs y combos de fotografías digitales o impresas para aumentar el ticket promedio de cada venta.",
    blocks: [
      p(
        "Un pack es una forma simple y efectiva de vender más en cada operación: en lugar de que el cliente compre una foto suelta, le ofrecés un conjunto a un precio conveniente y, casi sin notarlo, se lleva varias. Los packs funcionan porque combinan el deseo de la persona —llevar más recuerdos— con la sensación de estar haciendo un buen negocio. En ComprameLaFoto podés armarlos con fotos digitales, impresiones o ambas. En esta guía vemos qué es exactamente un pack, cómo crearlo, cómo combinar formatos, cómo definir precio y descuento, cómo comunicarlo al cliente y qué ejemplos suelen funcionar mejor según el evento."
      ),
      h2("Qué es un pack en ComprameLaFoto"),
      p(
        "Un pack agrupa varias fotografías —o una combinación de digital e impresión— bajo una sola oferta con precio diferenciado. En lugar de pagar cada foto a valor pleno, el cliente accede a un conjunto por un total más conveniente, lo que lo incentiva a llevar más de lo que pensaba inicialmente."
      ),
      p(
        "La diferencia con un descuento por cantidad es de presentación y de intención. El descuento se aplica solo a medida que el cliente agrega fotos al carrito; el pack es una propuesta cerrada y comunicada de antemano: «llevá este conjunto por este precio». Esa claridad lo vuelve más fácil de promocionar y de entender."
      ),
      p(
        "Los packs son especialmente útiles cuando una sola persona suele querer muchas fotos del mismo protagonista, como en sesiones escolares, familiares o sociales. En esos contextos, empujar a comprar el conjunto en lugar de fotos sueltas puede multiplicar tu ticket sin que el cliente sienta que gastó de más."
      ),
      h2("Crear un pack nuevo"),
      p(
        "Desde la configuración de tu álbum, buscá la opción de armar un pack y definí qué incluye: cantidad de fotos, formato y precio total. Ponele un nombre claro que comunique el beneficio, como «Pack 5 fotos digitales» o «Combo digital + ampliación», para que el cliente entienda de un vistazo qué está comprando."
      ),
      p(
        "Definí la cantidad pensando en el comportamiento real de tu público. Un pack demasiado grande puede asustar por el precio total; uno demasiado chico no genera suficiente incentivo frente a la compra unitaria. Buscá el número que represente «un poco más de lo que iba a llevar» para que el salto sea natural."
      ),
      p(
        "Antes de publicar, revisá que el precio del pack sea efectivamente más conveniente que comprar esas fotos por separado. Si el ahorro no es claro, el cliente no percibe el beneficio y el pack pierde su razón de ser. La oferta tiene que ser genuina para que funcione como incentivo de compra."
      ),
      p(
        "Conviene también ponerle un límite razonable a la cantidad de packs distintos que ofrecés en un mismo álbum. Si presentás demasiadas variantes —de tres, de cinco, de diez, con y sin impresión— el cliente se confunde y, ante la duda, muchas veces no elige ninguno. Dos o tres opciones bien pensadas convierten mejor que un menú interminable. Pensá cada pack como una respuesta a un perfil concreto de comprador: el que quiere solo un par de recuerdos, el que se lleva la jornada completa y el que busca además la copia física. Cuando cada paquete tiene un destinatario claro en tu cabeza, la oferta se vuelve más fácil de comunicar y de entender. Un catálogo de packs ordenado y acotado guía la decisión en lugar de paralizarla, que es justamente lo que buscás al armarlos."
      ),
      h2("Combinar digitales e impresiones"),
      p(
        "Una de las combinaciones más potentes es el pack que une el archivo digital con una copia impresa de la misma foto o del mismo evento. El cliente se lleva lo mejor de los dos mundos: la versión para compartir en redes y el objeto físico para enmarcar o regalar, todo en una sola compra."
      ),
      p(
        "Estos combos elevan el ticket porque suman el valor de la impresión sobre la base digital, y al cliente le resultan atractivos porque resuelven dos necesidades juntas. En vez de decidir entre archivo o copia, se queda con ambos a un precio pensado para que la decisión sea fácil."
      ),
      p(
        "Al armar combos mixtos, recordá que la parte impresa arrastra costos de producción y envío que el digital no tiene. Calculá el precio del pack para que el descuento sea atractivo sin comerse el margen de la impresión, que es la parte con piso de gasto. Un combo bien calibrado conviene a ambas partes."
      ),
      h2("Precio sugerido y descuentos"),
      p(
        "El precio del pack tiene que ubicarse en el punto donde el cliente sienta que ahorra y vos sigas ganando por volumen lo que cedés en margen unitario. Si el descuento es demasiado agresivo, regalás trabajo; si es insignificante, nadie elige el pack sobre la compra suelta. Buscá un equilibrio que premie llevar más sin devaluar tu fotografía."
      ),
      p(
        "Una buena referencia es mostrar implícitamente cuánto se ahorra: si comprar las fotos por separado costaría un total y el pack cuesta menos, esa diferencia es el motor de la decisión. No hace falta exagerar el descuento; alcanza con que el beneficio sea real y perceptible a primera vista."
      ),
      p(
        "Evitá superponer demasiados descuentos a la vez. Si ya tenés descuentos por cantidad y además packs, asegurate de que las reglas no se contradigan ni generen situaciones raras donde armar el carrito manualmente salga más barato que el pack. La coherencia del esquema sostiene la confianza del comprador."
      ),
      p(
        "Revisá tu esquema poniéndote en el lugar de un cliente que arma el carrito a mano: si comprando fotos sueltas con el descuento por cantidad llega a un total menor que el del pack, el pack pierde sentido y hasta puede parecer un intento de cobrar de más. Hacé esa cuenta antes de publicar para asegurarte de que el paquete siempre sea la opción más conveniente cuando el cliente quiere esa cantidad de fotos. También ayuda fijar el precio del pack en una cifra redonda y fácil de recordar, que comunica simplicidad y se difunde mejor de boca en boca. Un valor claro, percibido como justo y genuinamente ventajoso, es lo que hace que la gente lo elija sin calculadora en mano y se vaya con la sensación de haber hecho un buen negocio."
      ),
      h2("Comunicar el pack al cliente"),
      p(
        "Un pack que nadie ve no vende. Comunicalo con claridad dentro de la galería y reforzalo en los mensajes que enviás al difundir el álbum: «además de fotos sueltas, tenés packs que te convienen si querés varias». Muchas ventas adicionales surgen simplemente de que el cliente se entera de que la opción existe."
      ),
      p(
        "Al compartir el link por WhatsApp o redes, mencioná el beneficio del pack en lenguaje simple y orientado al cliente. No se trata de explicar tu lógica de pricing, sino de que la persona entienda rápido que llevando el conjunto gasta mejor su dinero y se lleva más recuerdos."
      ),
      p(
        "El momento de comunicar también importa. Un mensaje justo después del evento, cuando la emoción está fresca, rinde más que uno tardío. Combiná la novedad de que las fotos ya están publicadas con la mención del pack para captar a quien estaba dispuesto a comprar y solo necesitaba un pequeño empujón para llevar más."
      ),
      h2("Ejemplos de packs efectivos"),
      p(
        "En sesiones escolares, un pack que reúna las mejores fotos de la jornada del mismo chico suele ser un éxito: la familia quiere varias, no una sola, y agradece un precio cerrado que le evite ir sumando de a una. Es uno de los escenarios donde el pack más claramente multiplica el ticket."
      ),
      p(
        "En eventos sociales y de egresados, los combos digital más impresión funcionan muy bien, porque el cliente busca tanto compartir el recuerdo en redes como conservarlo físicamente. Un pack que resuelva ambas cosas a un precio amable convierte mejor que ofrecer cada formato por separado."
      ),
      p(
        "En deportes masivos, donde cada persona lleva pocas fotos suyas, un pack chico —por ejemplo, todas las fotos del corredor en la carrera— puede empujar a llevar el conjunto completo en lugar de elegir solo una. Adaptá siempre el tamaño y la composición del pack al comportamiento real del público de cada evento."
      ),
      h3("Errores a evitar al armar packs"),
      p(
        "El error más común es armar un pack cuyo precio no representa un ahorro real frente a comprar las fotos sueltas. Si el cliente hace la cuenta y descubre que el pack no le conviene, no solo no lo elige, sino que pierde confianza en toda tu oferta. Antes de publicar, verificá siempre que llevar el conjunto sea efectivamente más barato por unidad que armar el carrito a mano. El beneficio tiene que ser genuino y perceptible a primera vista, no una ilusión de descuento que no resiste el cálculo."
      ),
      p(
        "Otro tropiezo es ofrecer demasiados packs a la vez, lo que confunde en lugar de ayudar. Cuando el cliente se enfrenta a cinco combos distintos, duda, compara y muchas veces termina no eligiendo ninguno. Es preferible un par de packs bien pensados —uno chico y uno más completo, por ejemplo— que una lista que paraliza la decisión. La simplicidad vende: cuanto más fácil sea entender qué conviene, más rápido el comprador se decide a llevar el conjunto."
      ),
      p(
        "Cuidá también la coherencia entre packs y descuentos por cantidad. Si tenés ambos activos y las reglas se superponen mal, puede pasar que armar el carrito manualmente salga más barato que el pack, lo que vuelve absurda la oferta y genera desconfianza en quien lo nota. Revisá que todos tus incentivos jueguen en la misma dirección y que ninguna combinación deje al pack en ridículo. Un esquema de precios consistente es la base para que tus promociones sumen en lugar de restar."
      ),
      p(
        "Por último, no descuides la comunicación. Un pack genial que nadie ve no sirve de nada: muchas ventas perdidas no se deben a un mal armado, sino a que el cliente nunca se enteró de que existía. Mostralo con claridad en la galería y mencionalo en los mensajes de difusión, en lenguaje simple y orientado al beneficio. El momento ideal es justo después del evento, cuando la emoción está fresca y la gente está más dispuesta a llevar varios recuerdos en una sola compra."
      ),
    ],
    faq: [
      {
        q: "¿Qué diferencia hay entre un pack y un descuento por cantidad?",
        a: "El descuento se aplica a medida que el cliente suma fotos al carrito; el pack es una oferta cerrada y comunicada de antemano. El pack es más fácil de promocionar porque presenta un conjunto y un precio claros.",
      },
      {
        q: "¿Puedo combinar fotos digitales e impresiones en un pack?",
        a: "Sí, y suele ser una de las combinaciones más efectivas. Recordá que la parte impresa tiene costo de producción y envío, así que calculá el precio para que el descuento no se coma ese margen.",
      },
      {
        q: "¿Cómo defino el precio de un pack?",
        a: "Buscá un valor donde el cliente sienta que ahorra y vos ganes por volumen lo que cedés en margen unitario. El descuento debe ser real y perceptible, pero sin devaluar tu trabajo.",
      },
      {
        q: "¿Dónde ve el cliente los packs?",
        a: "Dentro de la galería, junto a las fotos. Conviene además mencionarlos en los mensajes de difusión, porque muchas ventas extra surgen simplemente de que el cliente se entera de que el pack existe.",
      },
      {
        q: "¿En qué eventos rinden más los packs?",
        a: "En escuelas, sociales y egresados, donde una persona quiere varias fotos del mismo protagonista. También en deportes con packs chicos que reúnan todas las fotos de un mismo corredor.",
      },
    ],
    conclusion:
      "Los packs son una de las formas más simples de subir el ticket promedio sin que el cliente sienta que gastó de más: ofrecen más recuerdos a un precio conveniente y son fáciles de comunicar. Armalos pensando en el comportamiento real de tu público, asegurá que el ahorro sea genuino y comunicalos justo cuando la emoción del evento está fresca para sacarles el máximo provecho.",
    ctaAudience: resolveCtaAudience(["fotografos"]),
    imageScene:
      "Photographer arranging a printed photo bundle for school parents, cheerful packaging on wooden desk, hyperrealistic documentary photography style",
    imageAltSubject:
      "Fotógrafo armando un pack de fotos para familias en su escritorio de trabajo",
    imageCaption: "Un pack bien armado multiplica el ticket ofreciendo más recuerdos por menos.",
  },

  "como-crear-una-preventa": {
    seoTitle: "Cómo crear una preventa en ComprameLaFoto",
    seoDescription:
      "Guía para configurar preventas escolares o de eventos: cuándo conviene, cómo crearla, definir plazos, compartir el link con familias y cerrar la entrega.",
    excerpt:
      "Guía para configurar preventas escolares o de eventos: fechas, precios anticipados y comunicación a familias.",
    blocks: [
      p(
        "La preventa te permite cobrar antes de la entrega final, una herramienta muy útil en contextos escolares y de eventos donde necesitás saber con anticipación cuántos pedidos vas a tener. En lugar de producir a ciegas y esperar que la gente compre después, recopilás compromisos de compra por adelantado y trabajás sobre demanda real. Esto reduce el riesgo, mejora tu flujo de caja y te da previsibilidad para organizar la producción. En esta guía vemos cuándo conviene una preventa, cómo crearla en el álbum, cómo definir plazos y condiciones, cómo compartir el link con padres o clientes, cómo seguir los pedidos y cómo cerrar la entrega."
      ),
      h2("Cuándo conviene una preventa"),
      p(
        "La preventa brilla cuando la producción tiene un costo o un esfuerzo que conviene confirmar antes de asumir. El caso típico es la fotografía escolar: en lugar de imprimir carpetas para todo el curso sin saber quién las quiere, cobrás por adelantado y producís solo lo vendido. Así evitás material que sobra y dinero inmovilizado."
      ),
      p(
        "También es útil en eventos donde querés asegurar un piso de ventas antes de comprometerte con la cobertura o la producción. Saber que ya tenés un número de pedidos confirmados te da tranquilidad para planificar y, en algunos casos, para negociar mejor con quien organiza el evento o la institución."
      ),
      p(
        "No toda venta necesita preventa. En eventos masivos con entrega digital instantánea, donde el costo marginal es bajo, muchas veces conviene la venta directa post-evento. La preventa aporta más valor cuando hay producción física, plazos de entrega o necesidad de anticipar la demanda antes de invertir tiempo y recursos."
      ),
      h2("Crear la preventa en el álbum"),
      p(
        "Desde la configuración del álbum, activá el modo de preventa y definí qué se ofrece por anticipado: fotos digitales, impresiones, carpetas o combos. La idea es que el cliente pueda comprometerse y pagar antes de que el material final esté disponible para descargar o producir."
      ),
      p(
        "Cargá precios anticipados claros. Muchas veces la preventa ofrece un valor más conveniente que la compra posterior, premiando a quien se decide temprano y ayudándote a vos a cerrar pedidos cuanto antes. Ese incentivo de precio es uno de los motores que hacen que la gente compre en preventa en lugar de esperar."
      ),
      p(
        "Dejá la configuración revisada antes de difundir, porque en preventa estás pidiendo a la gente que confíe y pague por algo que aún no recibió. Un esquema claro de qué incluye, cuánto cuesta y cuándo se entrega es la base de esa confianza y evita reclamos cuando llegue el momento de la entrega final."
      ),
      p(
        "Aprovechá la preventa para definir desde el inicio qué productos tendrán mejor precio anticipado y cuáles no, en lugar de aplicar un descuento parejo a todo. Por ejemplo, podés reservar el beneficio para las carpetas o los packs, que son los que más te interesa colocar por adelantado, y dejar las fotos sueltas a valor regular. Esa diferenciación orienta la compra hacia los productos que mejor te conviene producir en serie. Pensá también qué información mostrar en la preventa: aunque el material final todavía no esté disponible, conviene que las familias vean ejemplos o referencias claras de qué van a recibir, porque comprar a ciegas genera dudas. Cuanto más concreta sea la propuesta —qué incluye, cómo se ve, cuándo llega— más fácil le resulta a la persona decidirse a pagar antes de tener el producto en la mano."
      ),
      h2("Definir plazos y condiciones"),
      p(
        "Una preventa sin fecha de cierre pierde su fuerza. Definí hasta cuándo se puede comprar al precio anticipado y cuándo se entregará el material. Esos dos plazos —cierre y entrega— son la columna vertebral de la preventa y deben quedar comunicados desde el primer mensaje para que nadie se sienta sorprendido."
      ),
      p(
        "El plazo de cierre genera una urgencia sana: quien sabe que la preventa termina tal día tiende a decidirse en lugar de postergar. Esa es justamente la ventaja de trabajar con fechas claras frente a una venta abierta sin límite, donde la decisión se diluye y muchos compradores nunca terminan de concretar."
      ),
      p(
        "Sé honesto con el plazo de entrega y no prometas tiempos que no podés cumplir. En contextos escolares, las familias planifican alrededor de fechas concretas —un acto, un cierre de año— y un retraso genera mucha más fricción que en una venta común. Cumplir lo prometido en preventa construye una reputación que se traduce en futuras campañas."
      ),
      h2("Compartir el link con padres o clientes"),
      p(
        "Con la preventa configurada, compartí el link por los canales donde está tu público: grupos de WhatsApp de padres, comunicaciones de la institución, redes o email. En el mensaje, explicá con claridad qué se ofrece, hasta cuándo y cuándo se entrega, para que cada familia entienda la propuesta sin necesidad de preguntarte."
      ),
      p(
        "En contextos escolares, coordiná la difusión con la institución para que el mensaje llegue con respaldo y las familias confíen. Un comunicado avalado por la escuela convierte mucho mejor que un link suelto, porque despeja las dudas naturales que genera pagar por adelantado algo que todavía no se vio."
      ),
      p(
        "Aprovechá el plazo de cierre en la comunicación: un recordatorio cuando se acerca la fecha límite recupera a quienes lo dejaron pendiente. La combinación de un anuncio inicial claro y un recordatorio antes del cierre suele capturar la mayor parte de los pedidos posibles sin que tengas que insistir uno por uno."
      ),
      h2("Seguimiento de pedidos de preventa"),
      p(
        "Durante la preventa, revisá el panel para ver cuántos pedidos se acumulan y de qué tipo. Esta información es oro: te dice cuánto vas a tener que producir, te permite estimar tu ingreso y te ayuda a decidir si conviene extender o cerrar la campaña según cómo venga la respuesta."
      ),
      p(
        "El seguimiento también te permite detectar patrones, como qué producto se vende más o qué curso responde mejor. Con esos datos podés ajustar la comunicación sobre la marcha y enfocar el esfuerzo donde hay más potencial, en lugar de tratar a todos los grupos por igual."
      ),
      p(
        "Mantener el orden de los pedidos durante la preventa es lo que hace fluida la entrega posterior. Si llegás al cierre con todo prolijo —quién pidió qué y en qué formato— la producción y la distribución se vuelven un trámite. El descontrol en esta etapa es la causa más común de problemas en la entrega final."
      ),
      p(
        "Usá la información del seguimiento para tomar decisiones mientras la preventa sigue abierta, no solo para mirar números al final. Si ves que un curso o un producto responde por debajo de lo esperado, todavía estás a tiempo de reforzar la comunicación en ese frente o de coordinar con la institución un recordatorio dirigido. La preventa es dinámica: cuanto antes detectes una tendencia floja, más margen tenés para corregirla antes del cierre. Llevá también un registro claro de los datos de cada familia que pidió, porque esa información es la que vas a necesitar para coordinar la entrega y para resolver cualquier consulta posterior. Una preventa bien administrada, con los pedidos ordenados y los contactos a mano, convierte la etapa de cierre en un trámite simple en lugar de una carrera contra el reloj para reconstruir quién pidió qué."
      ),
      h2("Cierre y entrega"),
      p(
        "Al llegar la fecha de cierre, frená las compras anticipadas y consolidá la lista de pedidos confirmados. Ese listado es tu orden de producción: sabés exactamente qué imprimir, qué preparar y para quién, sin desperdiciar material ni quedarte corto. La preventa convierte la incertidumbre en una planificación concreta."
      ),
      p(
        "Producí y entregá según lo prometido, respetando el plazo comunicado. En el caso de impresiones o carpetas, coordiná la distribución —entrega en el colegio, retiro o envío— de la forma más simple para las familias. Una entrega ordenada y puntual es la mejor publicidad para tu próxima preventa en esa misma comunidad."
      ),
      p(
        "Después del cierre, podés mantener el álbum disponible para ventas posteriores, normalmente a precio regular, captando a quienes no llegaron a la preventa. Así combinás lo mejor de ambos mundos: la previsibilidad del cobro anticipado y la cola de ventas tardías de quienes se decidieron fuera de plazo."
      ),
      h3("Comunicar la preventa sin generar dudas"),
      p(
        "En una preventa le estás pidiendo a la gente que pague por algo que todavía no recibió, así que la comunicación tiene que despejar la desconfianza natural que eso provoca. Sé explícito en cada mensaje sobre tres cosas: qué incluye exactamente la preventa, cuánto cuesta y cuándo se entrega. Cuando las familias o los clientes tienen esa información clara desde el primer contacto, la decisión de comprar por adelantado se vuelve mucho más fácil, porque saben con precisión qué están comprando y qué pueden esperar a cambio de su pago anticipado."
      ),
      p(
        "El respaldo de un tercero confiable multiplica la efectividad. En el ámbito escolar, coordinar la difusión con la institución hace que el mensaje llegue avalado por el colegio, lo que disipa buena parte de las dudas. En eventos, el respaldo del organizador cumple un rol similar. Un comunicado que viene de una fuente que el público ya conoce y en la que confía convierte mucho mejor que un link suelto enviado por alguien con quien las familias no tienen una relación previa."
      ),
      p(
        "Usá el plazo de cierre como aliado, no como amenaza. Comunicar con claridad hasta cuándo dura el precio anticipado genera una urgencia sana que ayuda a decidir, pero conviene plantearlo de forma positiva: como una oportunidad de aprovechar mejores condiciones por comprar temprano, más que como una presión. Un recordatorio cordial cuando se acerca la fecha límite recupera a quienes lo dejaron pendiente y suele capturar una porción importante de las ventas de gente que tenía intención de comprar."
      ),
      p(
        "Anticipá las preguntas frecuentes en tu propia comunicación para reducir las consultas individuales. Aclarar de antemano cómo se paga, qué pasa si alguien no llega al cierre o cómo y cuándo se recibe el material evita una catarata de mensajes y transmite que el proyecto está bien organizado. Esa prolijidad comunicacional no solo facilita la operación: también construye la reputación que hace que la próxima preventa en esa misma comunidad arranque con mucha más confianza y mejores resultados desde el primer día."
      ),
    ],
    faq: [
      {
        q: "¿Qué es exactamente una preventa?",
        a: "Es un esquema donde cobrás antes de la entrega final. Recopilás pedidos y pagos por adelantado y producís sobre demanda real, lo que reduce el riesgo y mejora tu previsibilidad y flujo de caja.",
      },
      {
        q: "¿Para qué eventos conviene usarla?",
        a: "Sobre todo cuando hay producción física o plazos de entrega, como carpetas escolares. En eventos masivos con entrega digital instantánea suele convenir más la venta directa post-evento.",
      },
      {
        q: "¿Por qué poner una fecha de cierre?",
        a: "El plazo de cierre genera una urgencia sana que ayuda a que la gente se decida en lugar de postergar. Comunicá tanto la fecha de cierre como la de entrega desde el primer mensaje.",
      },
      {
        q: "¿Cómo logro que las familias confíen y paguen por adelantado?",
        a: "Con un esquema claro de qué incluye, cuánto cuesta y cuándo se entrega, y coordinando la difusión con la institución para que el mensaje llegue con respaldo y despeje dudas.",
      },
      {
        q: "¿Puedo seguir vendiendo después del cierre?",
        a: "Sí. Tras consolidar los pedidos de preventa podés mantener el álbum disponible para ventas posteriores, normalmente a precio regular, captando a quienes no llegaron a tiempo.",
      },
    ],
    conclusion:
      "La preventa transforma la incertidumbre en planificación: cobrás antes, producís solo lo vendido y ganás previsibilidad, algo especialmente valioso en el ámbito escolar. La clave está en plazos claros, comunicación coordinada con la institución y un seguimiento ordenado de los pedidos. Bien ejecutada, deja a las familias satisfechas y te construye una reputación que facilita cada campaña siguiente.",
    ctaAudience: resolveCtaAudience(["fotografos", "escuelas"]),
    imageScene:
      "School photographer showing presale flyer to parents at school entrance, morning natural light, hyperrealistic documentary photography style",
    imageAltSubject:
      "Fotógrafo escolar presentando una preventa a familias en la entrada del colegio",
    imageCaption: "La preventa permite cobrar antes y producir solo lo que realmente se vendió.",
  },

  "como-publicar-una-galeria": {
    seoTitle: "Cómo publicar una galería en ComprameLaFoto",
    seoDescription:
      "Publicá tu galería para que los clientes vean y compren tus fotos: revisión previa, estados del álbum, link público, privacidad, difusión y cómo despublicar.",
    excerpt:
      "Publicá tu galería para que los clientes puedan ver, buscar y comprar tus fotografías de forma segura.",
    blocks: [
      p(
        "Publicar es el momento en que tu trabajo deja de ser un borrador privado y se vuelve una galería accesible para compradores. Es un paso simple, pero tiene implicancias: a partir de ahí el link circula, la gente entra y empieza a comprar, así que conviene llegar con todo revisado. En esta guía vemos cómo hacer la revisión final antes de publicar, qué significan los estados de borrador y publicado, cómo funciona el link público y la privacidad, cómo difundir por WhatsApp y redes, qué pasa con la visibilidad y cómo despublicar o archivar un álbum cuando termina su ciclo de venta."
      ),
      h2("Revisión previa a la publicación"),
      p(
        "Antes de publicar, recorré la galería como si fueras el cliente. Confirmá que están todas las fotos que debían estar, que no se coló material de otro evento o una toma privada, y que la portada representa bien el trabajo. Es mucho más fácil corregir ahora que después de haber difundido el link a cientos de personas."
      ),
      p(
        "Verificá que los precios y las opciones de venta —digital, impresiones, packs— estén configurados como querés. Un álbum publicado con precios provisorios obliga a cambiarlos con ventas en curso, lo que genera reclamos. Cerrá esa configuración antes de dar el paso para evitar correcciones incómodas más adelante."
      ),
      p(
        "Si podés, hacé una compra de prueba con un monto bajo para ver el flujo completo de pago y descarga tal como lo vive el comprador. Confirmar que todo funciona de punta a punta —pago aprobado, archivo liberado, correo de confirmación— es la mejor garantía de un lanzamiento sin sorpresas."
      ),
      h2("Estados del álbum: borrador y publicado"),
      p(
        "Cada álbum vive en uno de dos estados principales. En borrador, solo vos lo ves: podés subir fotos, ordenar, configurar precios y revisar sin que nadie acceda. Es tu espacio de trabajo tranquilo, donde armás todo a tu ritmo sin riesgo de exponer un trabajo a medio terminar."
      ),
      p(
        "Cuando pasás el álbum a publicado, queda disponible para los compradores a través de su link. Ese cambio de estado es la línea que separa el armado de la venta: a partir de ahí, todo lo que esté cargado es visible para quien tenga el enlace, así que la revisión previa cobra su verdadera importancia."
      ),
      p(
        "Poder alternar entre estados te da control sobre el ciclo de vida del álbum. Podés armarlo con anticipación en borrador, publicarlo en el momento justo —idealmente apenas terminás de editar el evento— y, más adelante, despublicarlo cuando la venta haya cumplido su objetivo. El estado es tu interruptor de visibilidad."
      ),
      p(
        "Aprovechá el estado de borrador para trabajar sin presión y, sobre todo, para coordinar el momento exacto de la publicación. No siempre conviene publicar apenas terminás de editar: a veces es mejor esperar a tener listo el mensaje de difusión y elegir un horario en que tu público esté activo, para que el anuncio y la galería disponible coincidan. Tener el álbum terminado en borrador te da esa flexibilidad de elegir el cuándo. Recordá que, una vez publicado, cualquier ajuste que hagas queda visible de inmediato para quien esté mirando, así que los cambios grandes conviene hacerlos antes de dar el paso. El borrador es tu taller; el estado publicado, tu vidriera abierta. Manejar conscientemente ese pasaje, en lugar de publicar por inercia apenas subís la última foto, es parte de una operación profesional y ordenada."
      ),
      h2("Link público y privacidad"),
      p(
        "Al publicar, el álbum obtiene un link que podés compartir con tu público. Según la configuración, la galería puede ser de acceso abierto o requerir que solo quienes tengan el enlace puedan verla. Esta flexibilidad te permite adaptar el nivel de privacidad al tipo de evento y a la sensibilidad del material."
      ),
      p(
        "En eventos masivos y públicos, un acceso abierto facilita que cualquier participante encuentre sus fotos. En cambio, en contextos escolares, sociales o privados, conviene un esquema más restringido donde solo accedan quienes recibieron el link, cuidando la privacidad de las personas fotografiadas, especialmente cuando hay menores."
      ),
      p(
        "Definí la privacidad en función de a quién querés que llegue la galería. No es lo mismo una carrera donde buscás máxima difusión que un acto escolar donde la prioridad es el cuidado. Elegir bien este parámetro es parte de tu responsabilidad profesional y de la confianza que depositan en vos las familias y las instituciones."
      ),
      h2("Compartir por WhatsApp y redes"),
      p(
        "El canal natural de difusión en Argentina es WhatsApp: grupos de corredores, de padres, de la comunidad del evento. Compartí el link con un mensaje claro que indique qué evento es, cómo buscarse y, si corresponde, hasta cuándo estarán las fotos. Cuanto más claro el mensaje, menos consultas vas a recibir."
      ),
      p(
        "Las redes sociales amplifican el alcance, sobre todo en eventos abiertos. Una publicación con la portada del álbum y el link invita a participantes que quizá no están en ningún grupo a encontrar sus fotos. Un código QR en el lugar del evento también funciona muy bien para captar a la gente en caliente."
      ),
      p(
        "El momento de compartir es decisivo. Difundir apenas publicás, mientras la emoción del evento está fresca, rinde mucho más que esperar días. La velocidad entre el evento y la difusión es una de las palancas de conversión más importantes, porque el interés por las propias fotos se enfría rápido con el paso del tiempo."
      ),
      p(
        "Pensá un mensaje de difusión que funcione bien en cada canal en lugar de copiar y pegar el mismo texto en todos lados. Lo que sirve en un grupo de WhatsApp —breve, directo, con el link arriba— no es igual a lo que conviene en una publicación de redes, donde una buena imagen y un texto un poco más cuidado captan a quien no está en ningún grupo. Adaptar el tono a cada lugar mejora notablemente la respuesta. Aprovechá también para dar una instrucción mínima de cómo buscarse, porque reducir esa fricción mental aumenta las chances de que la persona abra el link en el momento. Y si el evento lo permite, sumá un código QR en el lugar para captar a la gente en caliente: combinar varios canales bien pensados multiplica el alcance frente a confiar en uno solo."
      ),
      h2("Indexación y visibilidad"),
      p(
        "Más allá del link directo, una galería publicada puede ganar visibilidad dentro de la plataforma y, según la configuración, ser encontrada por compradores que llegan buscando un evento concreto. Esa visibilidad adicional suma ventas de personas que no recibieron el link por los canales directos pero buscan sus fotos por su cuenta."
      ),
      p(
        "La visibilidad debe equilibrarse con la privacidad. En eventos públicos, ser fácil de encontrar es una ventaja; en contextos sensibles, conviene mantener el acceso restringido aunque eso limite el alcance. No hay una respuesta única: depende del tipo de trabajo y de los acuerdos con quien organizó el evento o la institución."
      ),
      p(
        "Una galería bien rotulada —con título claro, fecha y descripción— no solo se ve más profesional, sino que es más fácil de encontrar y de reconocer para quien la busca. Cuidar esos datos al publicar mejora tanto la experiencia del comprador como las posibilidades de que tu trabajo aparezca cuando alguien lo busca."
      ),
      h2("Despublicar o archivar"),
      p(
        "Cuando un álbum cumplió su ciclo de venta, podés despublicarlo para quitarlo de circulación. Esto es útil cuando vence el plazo que comunicaste, cuando una institución pide bajar el material o simplemente cuando la galería dejó de generar ventas y preferís cerrarla de forma ordenada."
      ),
      p(
        "Despublicar no es lo mismo que borrar: el álbum vuelve a un estado donde no es accesible para el público, pero la información de ventas y la configuración se conservan. Eso te permite consultar registros históricos o reactivar la galería más adelante si surge una nueva demanda sobre ese mismo evento."
      ),
      p(
        "Archivar tus álbumes terminados mantiene tu panel ordenado y te ayuda a distinguir lo activo de lo cerrado. Una operación prolija, donde cada trabajo tiene su estado correcto, facilita tu gestión a medida que se acumulan eventos y te permite encontrar rápido lo que necesitás cuando un cliente vuelve meses después."
      ),
      h3("Qué hacer después de publicar"),
      p(
        "Publicar no es el final del trabajo, sino el comienzo de la etapa de ventas. Lo primero que conviene hacer apenas el álbum está publicado es difundirlo, mientras el interés por el evento está en su punto más alto. La velocidad entre la publicación y la difusión es una de las palancas de conversión más fuertes: cada día que pasa sin que la gente sepa que las fotos ya están disponibles es entusiasmo —y ventas potenciales— que se enfría y difícilmente vuelva."
      ),
      p(
        "Durante los primeros días, seguí de cerca cómo evolucionan las ventas y las consultas. Ese monitoreo te permite detectar problemas a tiempo: si nadie compra, quizás la difusión no llegó bien o falta facilitar la búsqueda; si llegan muchas consultas sobre lo mismo, conviene aclarar ese punto en tus mensajes. Reaccionar rápido en esta ventana inicial puede marcar una diferencia importante en el resultado total del álbum frente a dejarlo librado a su suerte."
      ),
      p(
        "Mantené la galería viva durante todo el período de venta. Un recordatorio bien timeado antes de que cierre el plazo recupera a quienes postergaron la compra, y reforzar la difusión en momentos clave puede reactivar las ventas cuando empiezan a amesetarse. Una galería publicada y olvidada vende menos que una acompañada con comunicación oportuna. El trabajo de publicar rinde mucho más cuando lo sostenés con presencia a lo largo de las semanas que dura la venta."
      ),
      p(
        "Cuando el álbum cumplió su ciclo, cerrá de forma ordenada. Despublicar o archivar los trabajos que ya vendieron lo que tenían para vender mantiene tu panel limpio y te ayuda a distinguir lo activo de lo terminado. Antes de cerrar, aprovechá para revisar los resultados: cuánto vendió, qué tipo de producto tuvo más salida y qué aprendiste para el próximo evento. Ese análisis convierte cada publicación en una lección que mejora tu forma de trabajar la siguiente."
      ),
    ],
    faq: [
      {
        q: "¿Qué reviso antes de publicar?",
        a: "Que estén todas las fotos correctas, que no se coló material ajeno o privado, que la portada represente el trabajo y que precios y opciones de venta estén bien configurados. Idealmente, hacé una compra de prueba.",
      },
      {
        q: "¿Cuál es la diferencia entre borrador y publicado?",
        a: "En borrador solo vos ves el álbum y podés armarlo con calma. Al publicarlo, queda accesible para los compradores a través de su link. El estado funciona como tu interruptor de visibilidad.",
      },
      {
        q: "¿Puedo controlar quién ve la galería?",
        a: "Sí. Según la configuración, la galería puede ser de acceso abierto o accesible solo para quienes tengan el link. Elegí el nivel de privacidad según el tipo de evento, con especial cuidado si hay menores.",
      },
      {
        q: "¿Cuándo conviene compartir el link?",
        a: "Apenas publicás, mientras la emoción del evento está fresca. La velocidad entre el evento y la difusión es clave, porque el interés por las propias fotos se enfría rápido.",
      },
      {
        q: "¿Qué pasa si despublico un álbum?",
        a: "Deja de ser accesible para el público, pero no se borra: la información de ventas y la configuración se conservan, y podés reactivarlo más adelante si surge nueva demanda.",
      },
    ],
    conclusion:
      "Publicar una galería es un paso simple que conviene dar con todo revisado: precios cerrados, fotos correctas y privacidad acorde al evento. Difundí rápido por WhatsApp y redes mientras el interés está caliente, cuidá el acceso según la sensibilidad del material y despublicá de forma ordenada cuando la venta cumplió su ciclo. Esa prolijidad protege tu reputación y mantiene tu operación bajo control.",
    ctaAudience: resolveCtaAudience(["fotografos"]),
    imageScene:
      "Photographer clicking publish on gallery software, sports stadium photos visible on monitor, hyperrealistic documentary photography style",
    imageAltSubject:
      "Fotógrafo publicando una galería de un evento deportivo desde su computadora",
    imageCaption: "Publicar con todo revisado evita reclamos cuando el link ya está circulando.",
  },

  "como-descargar-tus-ventas": {
    seoTitle: "Cómo descargar tus ventas en ComprameLaFoto",
    seoDescription:
      "Accedé al detalle de tus ventas, exportá reportes y descargá archivos de cada pedido en ComprameLaFoto, diferenciando ventas digitales de impresiones.",
    excerpt:
      "Accedé al detalle de tus ventas, exportá reportes y descargá archivos asociados a cada pedido.",
    blocks: [
      p(
        "Llevar el control de lo que vendés es tan importante como producir buenas fotos. El panel de ventas de ComprameLaFoto te muestra qué se vendió, cuándo y en qué formato, y te permite exportar información y descargar archivos asociados a cada pedido. Tener esta visibilidad ordenada te ayuda a entender tu negocio, conciliar tus cobros con Mercado Pago y responder con precisión cuando un cliente consulta por su compra. En esta guía vemos dónde encontrar tus ventas, cómo leer el detalle de cada pedido, cómo exportar la información, cómo descargar los archivos del pedido, en qué se diferencian las ventas digitales de las impresiones y a dónde recurrir ante dudas."
      ),
      h2("Dónde ver tus ventas"),
      p(
        "Desde tu panel de fotógrafo accedés a la sección de ventas, donde se listan todas las operaciones concretadas. Este es tu centro de control: cada compra que hace un cliente queda registrada ahí, con la información básica de qué se vendió y cuándo, lo que te da una foto clara del movimiento de tu cuenta."
      ),
      p(
        "El listado te permite ver el panorama general de tu actividad: cuántas ventas tuviste en un evento, cómo evolucionan a lo largo del tiempo y qué álbumes generan más movimiento. Esa mirada de conjunto es la base para tomar decisiones, como repetir el formato de los eventos que más venden o ajustar los que rinden poco."
      ),
      p(
        "Revisar tus ventas con regularidad, sobre todo después de cada evento, te mantiene al tanto sin sorpresas. En lugar de descubrir a fin de mes cómo te fue, vas siguiendo el pulso de tu negocio en tiempo real y podés reaccionar rápido si algo no funciona como esperabas."
      ),
      p(
        "Mirar las ventas de forma regular también te ayuda a descubrir patrones que de otro modo pasarían inadvertidos. Quizá notes que ciertos tipos de evento venden mucho mejor que otros, que hay un día o un horario en que se concentran las compras, o que algunas galerías siguen generando ingresos semanas después de publicadas mientras otras se agotan enseguida. Esa lectura te permite tomar decisiones concretas: dedicarte más a los trabajos rentables, ajustar la difusión de los que rinden poco o repetir el formato que mejor funciona. El panel deja de ser un simple registro de lo cobrado y se convierte en una brújula para hacer crecer tu actividad. Cuanto más incorpores el hábito de revisarlo, menos vas a depender de la intuición y más vas a operar con información real sobre cómo se comporta tu propio negocio fotográfico."
      ),
      h2("Detalle de cada pedido"),
      p(
        "Al entrar a una venta específica, accedés al detalle del pedido: qué fotos incluyó, en qué formato, el monto y la fecha. Esta información es la que te permite responder con exactitud si un cliente escribe consultando por su compra, sin tener que adivinar ni revolver mensajes viejos."
      ),
      p(
        "El detalle también distingue el tipo de producto vendido, lo que es clave cuando combinás digital con impresiones. Saber exactamente qué pidió cada cliente evita confusiones en la entrega y te da la trazabilidad necesaria para gestionar correctamente la parte que requiere producción física."
      ),
      p(
        "Cada pedido funciona como un registro al que podés volver. Si meses después surge una consulta o necesitás reconstruir qué pasó con una venta puntual, el detalle conservado te da la respuesta. Esa memoria ordenada es lo que diferencia una operación profesional de una que depende de recordar de memoria cada transacción."
      ),
      h2("Exportar información"),
      p(
        "Más allá de mirar las ventas en pantalla, podés exportar la información para trabajarla por fuera de la plataforma. Esto es muy útil para tu contabilidad, para cruzar datos con tus cobros de Mercado Pago o para analizar tu negocio con tus propias herramientas de planilla."
      ),
      p(
        "Exportar te permite, por ejemplo, sumar tus ingresos por período, comparar eventos o calcular cuánto representó cada tipo de producto en tu facturación. Tener los datos en un formato manipulable abre la puerta a un análisis más profundo que el que ofrece la vista rápida del panel."
      ),
      p(
        "Para quien factura o lleva registros formales, esta exportación es un puente práctico entre la venta y la administración. En lugar de transcribir a mano cada operación, partís de la información ya organizada y la adaptás a tus necesidades contables, ahorrando tiempo y reduciendo errores de carga."
      ),
      p(
        "La exportación es especialmente útil a la hora de cerrar un período y entender de verdad cómo te fue, más allá de la sensación general. Con los datos en una planilla podés sumar ingresos por mes, comparar la rentabilidad de distintos tipos de evento o calcular cuánto representó cada producto en tu facturación total. Esa mirada de conjunto es difícil de lograr revisando ventas de a una en pantalla. Si trabajás con un contador o llevás registros formales, entregar la información ya ordenada le simplifica el trabajo a ambos y reduce el riesgo de errores de transcripción. Y aunque manejes todo vos mismo, tener un respaldo propio de tus ventas, independiente de la plataforma, es una buena práctica: te da autonomía para analizar tu historia comercial con tus propias herramientas y conservar esos números a largo plazo."
      ),
      h2("Descargar archivos del pedido"),
      p(
        "Desde el detalle del pedido podés acceder a los archivos asociados a la venta. Esto te resulta útil para tu propio respaldo, para reenviar material si surge un inconveniente justificado con un cliente o para tener a mano lo que efectivamente se entregó en cada operación."
      ),
      p(
        "Contar con esta posibilidad te da tranquilidad operativa. Si un cliente reporta un problema legítimo con su descarga, podés verificar qué se vendió y resolver con conocimiento de causa, en lugar de depender solo de la palabra de la otra parte o de buscar el archivo entre tus carpetas originales."
      ),
      p(
        "Tené presente que el acceso a los archivos del pedido es una herramienta de gestión, no un reemplazo de tu propio respaldo de los originales. Mantené siempre tu backup de las fotos editadas: la plataforma facilita la operación, pero la custodia última de tu material es parte de tu profesión."
      ),
      h2("Ventas digitales vs impresiones"),
      p(
        "Las ventas digitales y las de impresiones se comportan distinto y conviene leerlas por separado. La digital se entrega de forma automática tras el pago y no tiene producción posterior; la impresión, en cambio, dispara un flujo de producción y, eventualmente, de envío que requiere tu seguimiento."
      ),
      p(
        "Distinguir ambas líneas en tus ventas te ayuda a entender de dónde vienen realmente tus ingresos. Quizá descubras que el digital aporta la mayor parte con cero logística, o que las impresiones, aun siendo menos, dejan buen margen en ciertos eventos. Ese conocimiento orienta dónde poner el foco."
      ),
      p(
        "La diferencia también importa para el soporte. Una consulta sobre una venta digital suele resolverse alrededor de la descarga; una sobre una impresión gira en torno a la producción y la entrega física. Saber con qué tipo de venta estás tratando te permite dar la respuesta correcta sin vueltas."
      ),
      h2("Soporte ante dudas"),
      p(
        "Si encontrás algo que no cuadra en tus ventas —un pedido que no entendés, una diferencia en lo acreditado— el primer paso es revisar el detalle del pedido y cruzarlo con tu cuenta de Mercado Pago, donde se refleja el movimiento del dinero. Muchas dudas se aclaran simplemente comparando ambas fuentes."
      ),
      p(
        "Para cuestiones que exceden tu panel, como un comportamiento inesperado del sistema o una incidencia de pago, está el soporte de la plataforma. Acudí con datos concretos —número o detalle del pedido— para que puedan ayudarte rápido, en lugar de describir el problema de forma vaga."
      ),
      p(
        "Mantener tus ventas ordenadas y revisadas es la mejor prevención. Cuando llevás un seguimiento regular, los problemas se detectan temprano y se resuelven fácil; cuando se acumulan sin control, una duda menor puede volverse un dolor de cabeza. La prolijidad en esta área es parte de profesionalizar tu negocio fotográfico."
      ),
      h3("Usar los datos de ventas para crecer"),
      p(
        "El panel de ventas no es solo un registro contable: es una fuente de información para tomar mejores decisiones. Si lo mirás con atención, te dice qué tipo de eventos te dejan más ingresos, qué productos tienen más salida y cómo evoluciona tu actividad a lo largo del tiempo. Esos patrones son oro para definir hacia dónde orientar tu trabajo: tal vez descubras que las escuelas te rinden más que los deportes, o que las impresiones aportan un margen que venías subestimando frente a lo digital."
      ),
      p(
        "Compará eventos similares entre sí para entender qué funciona. Si dos coberturas parecidas tuvieron resultados muy distintos, vale la pena preguntarse por qué: ¿se difundió mejor una que otra?, ¿los precios fueron distintos?, ¿la galería era más fácil de navegar? Cruzar los números con lo que hiciste en cada caso te permite identificar las prácticas que mueven la aguja y repetirlas, en lugar de atribuir los resultados al azar y seguir trabajando a ciegas evento tras evento."
      ),
      p(
        "Usá la exportación de datos para un análisis más profundo cuando lo necesites. Llevar tus ventas a una planilla te permite calcular tu facturación por período, estimar tu ingreso neto considerando comisiones y costos, y proyectar tus números para planificar la temporada. Para quien quiere profesionalizar su negocio fotográfico, ese trabajo de análisis es lo que transforma una actividad intuitiva en una operación con metas claras y decisiones fundamentadas en información real y no en sensaciones."
      ),
      p(
        "Fijate también en el comportamiento de tus compradores a lo largo del tiempo. En eventos recurrentes, ver que las mismas personas vuelven a comprarte es la señal de que estás construyendo una base fiel, uno de los activos más valiosos del negocio. Detectar quiénes son tus mejores clientes y qué los hace volver te ayuda a cuidar esa relación. Los datos, bien leídos, no solo te muestran de dónde venís: te marcan el camino más rentable hacia dónde conviene crecer."
      ),
    ],
    faq: [
      {
        q: "¿Dónde veo todo lo que vendí?",
        a: "En la sección de ventas de tu panel de fotógrafo, donde se listan todas las operaciones concretadas con la información de qué se vendió y cuándo. Conviene revisarla después de cada evento.",
      },
      {
        q: "¿Puedo exportar mis ventas para la contabilidad?",
        a: "Sí. Podés exportar la información para trabajarla por fuera de la plataforma, cruzarla con tus cobros de Mercado Pago o analizarla con tus propias planillas, ahorrando carga manual.",
      },
      {
        q: "¿Tengo acceso a los archivos de cada pedido?",
        a: "Sí, desde el detalle del pedido. Es útil como respaldo y para resolver inconvenientes justificados, aunque no reemplaza mantener tu propio backup de los originales editados.",
      },
      {
        q: "¿Por qué conviene separar digital de impresiones?",
        a: "Porque se comportan distinto: el digital se entrega automático sin logística y la impresión dispara producción y envío. Leerlas por separado te muestra de dónde vienen tus ingresos y orienta el soporte.",
      },
      {
        q: "¿Qué hago si una venta no coincide con lo acreditado?",
        a: "Revisá el detalle del pedido y cruzalo con tu cuenta de Mercado Pago. Si la diferencia persiste, contactá al soporte de la plataforma con el número o detalle del pedido a mano.",
      },
    ],
    conclusion:
      "El panel de ventas es tu tablero de control: te muestra qué vendiste, te deja exportar para la contabilidad y te da el detalle de cada pedido para responder consultas con precisión. Revisarlo con regularidad, distinguir digital de impresiones y cruzarlo con Mercado Pago convierte tu actividad fotográfica en un negocio ordenado, con decisiones basadas en datos y no en suposiciones.",
    ctaAudience: resolveCtaAudience(["fotografos"]),
    imageScene:
      "Photographer reviewing sales dashboard on laptop, printed order summary beside coffee cup, hyperrealistic documentary photography style",
    imageAltSubject:
      "Fotógrafo revisando el panel de ventas y el detalle de pedidos en su notebook",
    imageCaption: "El panel de ventas centraliza pedidos, reportes y archivos de cada operación.",
  },

  "como-retirar-tus-ganancias": {
    seoTitle: "Cómo retirar tus ganancias en ComprameLaFoto",
    seoDescription:
      "Entendé cómo se acreditan tus ventas con Mercado Pago, los plazos, las comisiones de la plataforma y cómo retirar tus ganancias como fotógrafo en Argentina.",
    excerpt:
      "Entendé cómo se acreditan tus ventas con Mercado Pago y cuándo podés retirar tus ganancias.",
    blocks: [
      p(
        "Vender es solo la mitad de la ecuación; la otra mitad es entender cómo y cuándo llega el dinero a tu bolsillo. En ComprameLaFoto los cobros se gestionan con Mercado Pago, la pasarela de pago principal en Argentina, lo que significa que tus ventas se acreditan dentro del flujo habitual de pagos online del país. En esta guía aclaramos cómo llega el dinero de una venta, por qué es clave tener Mercado Pago conectado, qué plazos de acreditación esperar, cómo funcionan las comisiones de la plataforma y cómo retirar o transferir tus ganancias. La idea es que tengas una imagen clara del recorrido que hace cada peso desde que un cliente paga hasta que vos disponés de él."
      ),
      h2("Cómo llega el dinero de una venta"),
      p(
        "Cuando un cliente compra una foto, paga a través de Mercado Pago dentro de la plataforma. Ese pago dispara la entrega del producto —descarga digital o pedido de impresión— y, en paralelo, inicia el recorrido del dinero hacia tu cuenta. Todo ocurre de forma integrada, sin que tengas que perseguir transferencias ni verificar comprobantes a mano."
      ),
      p(
        "Del monto que paga el cliente, la plataforma retiene su comisión y el resto corresponde a tu venta. Este modelo alinea los incentivos: ComprameLaFoto solo gana cuando vos ganás, porque no hay cuotas fijas ni costos por mantener la cuenta, sino una participación sobre cada operación concretada."
      ),
      p(
        "La gran ventaja frente a los métodos manuales es que el cobro es automático y trazable. Cada venta queda registrada, el dinero sigue un camino claro y vos podés conciliar lo que figura en tu panel con lo que aparece en tu cuenta de Mercado Pago, eliminando el clásico desorden de cobrar por transferencias sueltas."
      ),
      h2("Mercado Pago conectado"),
      p(
        "Tener Mercado Pago vinculado a tu cuenta de ComprameLaFoto es la condición para que el dinero de tus ventas tenga dónde acreditarse. Sin esa conexión, podés armar álbumes y previsualizar todo, pero las ventas no encontrarían un destino para el cobro, así que es uno de los primeros pasos al configurar tu perfil."
      ),
      p(
        "La vinculación se hace mediante el sistema de permisos de la propia pasarela, sin que compartas tu contraseña con la plataforma. Mercado Pago valida que sos el titular y autoriza la conexión, manteniendo el control de tu dinero siempre de tu lado. Es un esquema estándar y seguro para este tipo de integraciones."
      ),
      p(
        "Asegurate de que la cuenta de Mercado Pago esté a tu nombre o el de tu emprendimiento y correctamente verificada. Una cuenta sin verificar o con datos incompletos puede tener limitaciones para recibir o disponer del dinero, así que conviene resolver esa parte en el ecosistema de Mercado Pago antes de empezar a vender en serio."
      ),
      h2("Plazos de acreditación"),
      p(
        "Los plazos de acreditación responden a la dinámica de Mercado Pago y del medio de pago que haya usado el cliente. No es un tiempo arbitrario que define la plataforma de fotos, sino el flujo habitual de los pagos online en Argentina, que puede variar según cómo abonó cada comprador."
      ),
      p(
        "Por eso conviene que conozcas cómo funciona la acreditación en tu propia cuenta de Mercado Pago, donde vas a ver reflejado el estado de cada cobro. Familiarizarte con esos tiempos te permite planificar tu flujo de caja con realismo y no esperar el dinero antes de lo que corresponde según el medio de pago."
      ),
      p(
        "Entender los plazos también te ayuda a comunicar bien si trabajás con producción, como impresiones o preventa. Saber cuándo dispondrás efectivamente del dinero te permite organizar tus pagos a laboratorio o proveedores sin quedar descalzado entre lo que cobraste y lo que tenés que abonar."
      ),
      p(
        "Una forma sencilla de no confundirte con los plazos es mirar siempre el estado real en tu cuenta de Mercado Pago en lugar de asumir un tiempo fijo. Ahí vas a ver si un cobro está disponible, pendiente o en proceso, según el medio que usó el comprador. Con el tiempo, vas a reconocer los patrones habituales de tu operación y a proyectar con bastante precisión cuándo tendrás disponible el dinero de un evento. Esa previsión es clave cuando tenés gastos atados a la producción, como un laboratorio que cobra al entregar las impresiones: saber cuándo entra lo cobrado te permite comprometerte con esos pagos sin estirar tu caja. Tratar los plazos de acreditación como un dato más de tu planificación, y no como una sorpresa, es parte de manejar tu fotografía como un negocio y no como un pasatiempo."
      ),
      h2("Comisiones de la plataforma"),
      p(
        "ComprameLaFoto se sostiene con una comisión sobre cada venta, en lugar de cobrar una mensualidad. Esto significa que registrarte y mantener tus álbumes no tiene costo fijo: solo pagás cuando efectivamente vendés, lo que reduce el riesgo de empezar y hace que la plataforma trabaje a favor de tu éxito comercial."
      ),
      p(
        "Conocer la comisión vigente te permite calcular tu ingreso neto y fijar precios acordes. Si querés que cada venta te deje un determinado monto, tenés que considerar tanto la comisión de la plataforma como la dinámica de cobros de Mercado Pago al definir tus valores de venta."
      ),
      p(
        "Este modelo de comisión por venta es el que hace viable que no haya barreras de entrada. Un fotógrafo que recién arranca puede publicar sin invertir, y uno que vende mucho paga proporcionalmente a su volumen. Es un esquema pensado para acompañar distintos tamaños de operación sin penalizar a quien todavía está creciendo."
      ),
      h2("Retiros y transferencias"),
      p(
        "Una vez que el dinero está acreditado en tu Mercado Pago, disponés de él como de cualquier otro saldo en esa cuenta: podés mantenerlo, usarlo o transferirlo a tu cuenta bancaria según las opciones que ofrece la propia pasarela. A partir de la acreditación, la gestión del dinero pasa a estar en tu ecosistema de Mercado Pago."
      ),
      p(
        "Esto te da autonomía y control: no dependés de un proceso de retiro especial de la plataforma de fotos, sino de las herramientas que ya conocés de Mercado Pago para mover tu dinero. Si ya usás esa billetera en tu día a día, el manejo de tus ganancias te va a resultar familiar."
      ),
      p(
        "Conocer las condiciones de transferencia de Mercado Pago —tiempos, eventuales costos de pasar a banco— te ayuda a decidir cuándo y cómo retirar. Algunos fotógrafos prefieren acumular y transferir en bloque; otros mueven el dinero seguido. No hay una forma correcta: elegí la que mejor se adapte a tu organización financiera."
      ),
      p(
        "Antes de transferir a tu banco, conviene que conozcas las condiciones que aplica Mercado Pago en cada caso, porque pueden variar según la inmediatez que elijas. Algunas opciones acreditan el dinero en tu cuenta bancaria casi al instante y otras demoran, y esa diferencia puede tener o no un costo asociado. Saber esto de antemano te permite decidir con criterio: si no tenés urgencia, quizá te convenga la opción más económica; si necesitás el dinero ya, sabés qué esperar. Muchos fotógrafos encuentran práctico dejar parte del saldo en la propia billetera para usarlo en pagos cotidianos y transferir al banco solo lo que van a necesitar en efectivo. No hay una receta única, pero entender las herramientas que ofrece la pasarela te da el control para que tu dinero se mueva como mejor le sirve a tu economía."
      ),
      h2("Buenas prácticas para tu flujo de caja"),
      p(
        "Cruzá periódicamente lo que figura en tu panel de ventas con lo que aparece acreditado en Mercado Pago. Esa conciliación regular te da certeza de que todo está en orden y te permite detectar a tiempo cualquier diferencia, en lugar de descubrirla cuando ya pasó mucho tiempo y es difícil reconstruir qué ocurrió."
      ),
      p(
        "Separá mentalmente —o en cuentas distintas— el dinero de tu operación del de tus gastos personales, sobre todo si trabajás con producción que implica pagar a terceros. Tener claridad sobre cuánto es ingreso neto y cuánto está comprometido con costos te evita sorpresas y te da una visión real de tu rentabilidad."
      ),
      p(
        "Planificá considerando los plazos de acreditación, especialmente en campañas con producción o preventa. Saber cuándo vas a disponer efectivamente del dinero te permite comprometerte con proveedores y entregas sin riesgo de quedar descalzado. Una buena gestión de cobros es tan parte de tu negocio como una buena edición de fotos."
      ),
      h3("Organizar tu economía como fotógrafo"),
      p(
        "Cobrar de forma ordenada es parte de profesionalizar tu actividad, y eso empieza por separar mentalmente —o, mejor, en cuentas distintas— el dinero de tu trabajo del de tus gastos personales. Cuando todo se mezcla, es imposible saber cuánto ganás realmente, sobre todo si tenés costos de producción como impresiones o si pagás a colaboradores. Tener claridad sobre qué es ingreso neto y qué está comprometido con gastos te da una visión honesta de tu rentabilidad y evita la sensación engañosa de que vendiste mucho cuando en realidad gran parte ya estaba destinada a cubrir costos."
      ),
      p(
        "Conciliá con regularidad lo que figura en tu panel de ventas con lo que ves acreditado en Mercado Pago. Esa comparación periódica te da certeza de que todo está en orden y te permite detectar a tiempo cualquier diferencia, en lugar de descubrirla cuando ya pasó mucho tiempo y reconstruir qué ocurrió se vuelve difícil. La conciliación es una rutina simple que, hecha seguido, te ahorra dolores de cabeza y te mantiene siempre al tanto del estado real de tus cobros."
      ),
      p(
        "Planificá considerando los plazos de acreditación, especialmente en campañas con producción o preventa donde tenés que pagar a proveedores. Saber cuándo vas a disponer efectivamente del dinero te permite comprometerte con impresiones, envíos o colaboradores sin quedar descalzado entre lo que cobraste y lo que tenés que abonar. Una buena gestión del calendario de cobros y pagos es tan importante como la calidad de tus fotos para que el negocio sea sostenible en el tiempo."
      ),
      p(
        "Por último, llevá un registro de tus ingresos pensando en tus obligaciones formales. Más allá de la plataforma, ordenar tu facturación y tus números te facilita cualquier gestión contable o impositiva que corresponda a tu situación. La exportación de ventas y los registros de Mercado Pago son un buen punto de partida para ese ordenamiento. Tratar tu actividad fotográfica como el negocio que es, también en lo administrativo, te da tranquilidad y solidez para crecer sin sobresaltos."
      ),
    ],
    faq: [
      {
        q: "¿Cómo me llega el dinero de mis ventas?",
        a: "A través de Mercado Pago. Cuando el cliente paga, la plataforma retiene su comisión y el resto se acredita en tu cuenta de Mercado Pago dentro del flujo habitual de pagos online en Argentina.",
      },
      {
        q: "¿Necesito sí o sí tener Mercado Pago?",
        a: "Sí. Es la condición para que el dinero de tus ventas tenga dónde acreditarse. La conexión se hace por permisos de la propia pasarela, sin compartir tu contraseña con la plataforma.",
      },
      {
        q: "¿En cuánto tiempo dispongo del dinero?",
        a: "Depende de la dinámica de Mercado Pago y del medio de pago que usó el cliente. Conviene conocer cómo funciona la acreditación en tu propia cuenta para planificar tu flujo de caja con realismo.",
      },
      {
        q: "¿Qué comisión cobra la plataforma?",
        a: "ComprameLaFoto cobra una comisión por venta en lugar de mensualidad, según la configuración vigente. Considerala junto con la dinámica de Mercado Pago al fijar tus precios para calcular tu ingreso neto.",
      },
      {
        q: "¿Cómo retiro mis ganancias?",
        a: "Una vez acreditado, el dinero está en tu Mercado Pago y disponés de él como cualquier saldo: podés usarlo o transferirlo a tu banco con las herramientas de la propia pasarela.",
      },
    ],
    conclusion:
      "Entender el recorrido del dinero —del pago del cliente a la comisión de la plataforma y la acreditación en tu Mercado Pago— te da control sobre tu negocio fotográfico. Mantené la cuenta verificada, conocé los plazos de acreditación, calculá tu neto considerando la comisión y conciliá ventas con cobros. Con esa claridad, retirar tus ganancias deja de ser una incógnita y pasa a ser una rutina previsible.",
    ctaAudience: resolveCtaAudience(["fotografos"]),
    imageScene:
      "Photographer checking mobile banking app after event shoot, camera bag on bench, urban park setting, hyperrealistic documentary photography style",
    imageAltSubject:
      "Fotógrafo revisando la acreditación de sus ventas en Mercado Pago desde el celular",
    imageCaption: "Las ventas se acreditan en tu Mercado Pago dentro del flujo de pagos local.",
  },

  "como-registrarte-como-organizador": {
    seoTitle: "Cómo registrarte como organizador en ComprameLaFoto",
    seoDescription:
      "Creá tu cuenta de organizador de eventos en ComprameLaFoto, verificá tu identidad, configurá tu perfil y entendé en qué se diferencia de la cuenta de fotógrafo.",
    excerpt:
      "Creá tu cuenta de organizador de eventos en ComprameLaFoto y empezá a convocar fotógrafos.",
    blocks: [
      p(
        "Si coordinás eventos —carreras, torneos, festivales, encuentros deportivos— el rol de organizador en ComprameLaFoto te permite convocar a varios fotógrafos bajo una misma convocatoria y, si corresponde, generar ingresos por comisiones sobre las ventas. A diferencia del fotógrafo, no subís fotos: tu trabajo es articular la cobertura, ofrecer una landing única a los participantes y coordinar a quienes producen las imágenes. En esta guía recorremos qué implica el perfil de organizador, cómo hacer el registro paso a paso, cómo verificar la cuenta, qué configurar al inicio, en qué se diferencia de una cuenta de fotógrafo y cuáles son los próximos pasos una vez que tu cuenta está lista para operar."
      ),
      h2("Perfil de organizador"),
      p(
        "El organizador es quien pone el evento en el centro y reúne a su alrededor a los fotógrafos que lo cubren. En lugar de gestionar álbumes propios, gestionás un evento colaborativo: definís sus condiciones, convocás cobertura y ofrecés a los participantes un único lugar donde encontrar todas las galerías asociadas a esa jornada."
      ),
      p(
        "Este rol encaja con clubes, productoras, asociaciones deportivas y cualquiera que mueva la convocatoria de un evento con muchos participantes. La lógica es simple: vos tenés el acceso a la gente —corredores, equipos, asistentes— y los fotógrafos tienen el producto. ComprameLaFoto conecta ambas partes bajo tu coordinación."
      ),
      p(
        "Como organizador podés participar de las ventas mediante comisiones, lo que convierte la cobertura fotográfica de tu evento en una fuente de ingresos adicional. En vez de ser solo un costo o un servicio que tercerizás, la fotografía pasa a ser una línea que aporta a la economía del evento que ya estás produciendo."
      ),
      h2("Registro paso a paso"),
      p(
        "El alta como organizador empieza eligiendo esa opción al crear tu cuenta en ComprameLaFoto. El formulario inicial pide los datos básicos —nombre, email y contraseña— igual que cualquier registro, con la diferencia de que el perfil queda orientado a la gestión de eventos en lugar de a la carga de álbumes."
      ),
      p(
        "Usá un correo que revises a diario, porque por ahí van a llegar las comunicaciones vinculadas a tus eventos y la actividad de tu cuenta. Elegí también un nombre con el que quieras que te identifiquen los participantes y los fotógrafos: idealmente el del club, la productora o la marca bajo la que organizás."
      ),
      p(
        "Al completar el formulario, tu cuenta queda creada en estado pendiente de verificación. Ya existís en el sistema, pero conviene completar la confirmación del email y la configuración inicial antes de lanzarte a crear tu primer evento, para no tener que volver atrás cuando ya estés en plena coordinación."
      ),
      p(
        "Si ya tenías una cuenta como fotógrafo o como comprador con ese mismo correo, conviene revisarlo antes de avanzar, porque el sistema te avisará que el email ya está registrado. En ese caso suele ser mejor recuperar el acceso existente que crear un alta nueva, para no terminar con perfiles duplicados y actividad dispersa. Pensá desde el inicio el nombre con el que querés operar como organizador: idealmente el del club, la productora, la asociación o la marca con la que ya te conoce tu público, porque es el que verán los fotógrafos al recibir tus invitaciones y los participantes al entrar a la landing. Una identidad clara y reconocible desde el registro te ahorra explicaciones más adelante y le da seriedad a tus convocatorias, que es justo lo que necesitás para que buenos fotógrafos se sumen a cubrir tus eventos."
      ),
      h2("Verificación de cuenta"),
      p(
        "Como en cualquier alta, ComprameLaFoto te envía un correo de verificación que debés confirmar para activar plenamente tu cuenta. Abrí el mensaje desde la misma casilla que usaste y hacé clic en el enlace; ese paso valida que el email es tuyo y desbloquea las funciones de gestión de eventos."
      ),
      p(
        "Si el correo no aparece, revisá spam y promociones, y agregá el remitente a tus contactos para que las futuras comunicaciones no se filtren. Estar al día con los avisos es especialmente importante para un organizador, que necesita coordinar a tiempo a los fotógrafos y responder rápido durante la operación del evento."
      ),
      p(
        "La verificación es también un primer gesto de confianza: para que fotógrafos y participantes confíen en tu convocatoria, tu cuenta tiene que estar correctamente activada y con datos coherentes. Una cuenta verificada y bien configurada transmite la seriedad necesaria para que un fotógrafo decida sumarse a tu evento."
      ),
      h2("Configuración inicial"),
      p(
        "Con la cuenta verificada, completá tu perfil de organizador: nombre público, una descripción de qué tipo de eventos coordinás y cualquier dato que ayude a fotógrafos y participantes a reconocerte. Un perfil claro facilita que los fotógrafos evalúen sumarse y que los asistentes confíen en la landing del evento."
      ),
      p(
        "Definí también, al menos a grandes rasgos, cómo pensás trabajar: qué tipo de eventos vas a publicar, si vas a usar comisiones y cómo querés convocar a la cobertura. No hace falta tener todo resuelto al detalle, pero llegar al primer evento con una idea clara acelera mucho la puesta en marcha."
      ),
      p(
        "Aprovechá esta etapa para familiarizarte con el panel de organizador, que es distinto al de fotógrafo. Recorrer las secciones antes de crear tu primer evento te da seguridad cuando llegue el momento de configurar fechas, comisiones e invitaciones bajo la presión de una fecha de evento que se acerca."
      ),
      p(
        "Dedicá también unos minutos a pensar cómo vas a relacionarte con los fotógrafos antes de tu primer evento. Definir, aunque sea a grandes rasgos, qué tipo de cobertura buscás, qué comisión pensás ofrecer y cómo vas a difundir la landing te permite llegar a la convocatoria con una propuesta clara en lugar de improvisar. Los fotógrafos valoran trabajar con organizadores que tienen las reglas definidas, porque les reduce la incertidumbre al decidir si sumarse. No necesitás tener cada detalle resuelto, pero sí una idea firme de cómo querés que funcione tu evento. Esa preparación inicial, hecha con calma mientras todavía no hay una fecha encima, es la que después te permite coordinar con seguridad y transmitir el profesionalismo que hace que tanto fotógrafos como participantes confíen en tu convocatoria desde el primer contacto."
      ),
      h2("Diferencias con cuenta de fotógrafo"),
      p(
        "La diferencia central es qué gestiona cada rol. El fotógrafo administra álbumes: sube fotos, fija precios y vende su material. El organizador administra eventos: crea la convocatoria, define condiciones, invita fotógrafos y ofrece la landing unificada. Son funciones complementarias dentro del mismo ecosistema."
      ),
      p(
        "También difiere la fuente de ingresos. El fotógrafo gana por la venta de sus fotos; el organizador puede ganar por comisión sobre las ventas generadas en su evento. Esto refleja el aporte de cada uno: uno produce las imágenes, el otro aporta el público y la coordinación que hacen posible esas ventas."
      ),
      p(
        "Nada impide que una misma persona o entidad cumpla ambos roles en distintos contextos, pero conceptualmente conviene tenerlos claros. Entender que el organizador articula y el fotógrafo produce evita confusiones al configurar tu cuenta y al definir cómo te vas a relacionar con la cobertura de tus eventos."
      ),
      h2("Próximos pasos"),
      p(
        "Con tu cuenta de organizador lista, el paso natural es crear tu primer evento: cargar sus datos, definir fechas y condiciones, configurar las comisiones e invitar a los fotógrafos que lo cubrirán. El tutorial específico de creación de eventos te guía en cada una de esas decisiones."
      ),
      p(
        "Antes de lanzarte a un evento grande, conviene empezar con uno acotado para conocer el flujo completo: convocatoria, publicación de la landing, difusión y seguimiento de ventas. Ese primer ciclo te da la experiencia necesaria para coordinar con confianza eventos de mayor escala más adelante."
      ),
      p(
        "Pensá tu rol de organizador como el de un articulador que reduce fricción para todos. Si lográs que los fotógrafos tengan acceso a buen público y que los participantes encuentren sus fotos en un solo lugar, todos ganan, y tu evento suma una capa de valor —y de ingresos— que antes quedaba fuera de tu alcance."
      ),
      h3("Construir tu reputación como organizador"),
      p(
        "Como organizador, tu reputación es tu principal activo: determina si los buenos fotógrafos quieren sumarse a tus eventos y si los participantes confían en la landing que les ofrecés. Esa reputación se construye con cada interacción —condiciones claras, coordinación prolija, cumplimiento de lo prometido— y se sostiene en el tiempo. Un organizador serio, que paga las comisiones en orden y trata a su red con respeto, se gana un lugar de preferencia que se traduce en mejor cobertura y, por lo tanto, en más ventas para todos."
      ),
      p(
        "Frente a los participantes, la confianza nace de una experiencia cuidada. Una landing clara, fotos publicadas con rapidez, una búsqueda que funciona y un proceso de compra sin fricciones hacen que la gente asocie tu nombre con algo confiable. En eventos recurrentes, esa percepción se acumula: si en la primera edición todo salió bien, en la siguiente la gente entra a comprar sin dudar. La reputación es lo que convierte un evento aislado en una marca que la comunidad reconoce y elige."
      ),
      p(
        "Cuidá especialmente la relación con tu red de fotógrafos, porque son ellos quienes hacen posible la cobertura. Comunicación transparente, comisiones justas, coordinación que les facilita el trabajo y reconocimiento de su aporte construyen una relación de socios más que de proveedores. Un fotógrafo que se sintió bien tratado prioriza tus eventos cuando tiene que elegir, y esa lealtad mutua es lo que te permite contar con un equipo estable y de calidad en cada convocatoria."
      ),
      p(
        "Empezá de a poco para construir esa reputación sobre bases sólidas. Un primer evento acotado, donde podés cuidar cada detalle y aprender el flujo completo, te da experiencia y referencias para encarar coberturas más grandes. Es mejor crecer de forma ordenada, sumando eventos exitosos a tu historial, que lanzarte a algo enorme sin rodaje y arriesgar una mala primera impresión. La reputación se construye despacio y se cuida siempre, porque es lo que sostiene todo tu trabajo como organizador."
      ),
    ],
    faq: [
      {
        q: "¿Qué hace un organizador en ComprameLaFoto?",
        a: "Coordina eventos colaborativos: crea la convocatoria, define condiciones, invita fotógrafos y ofrece a los participantes una landing única con todas las galerías. No sube fotos; articula la cobertura.",
      },
      {
        q: "¿El organizador puede ganar dinero?",
        a: "Sí. Puede participar de las ventas mediante comisiones sobre lo generado en su evento, convirtiendo la cobertura fotográfica en una fuente de ingresos adicional.",
      },
      {
        q: "¿En qué se diferencia de la cuenta de fotógrafo?",
        a: "El fotógrafo gestiona álbumes y vende sus fotos; el organizador gestiona eventos, convoca fotógrafos y puede cobrar comisión. Son roles complementarios dentro del mismo ecosistema.",
      },
      {
        q: "¿Cómo activo mi cuenta de organizador?",
        a: "Registrándote con la opción de organizador y confirmando el correo de verificación que envía la plataforma. Revisá spam si no llega y agregá el remitente a tus contactos.",
      },
      {
        q: "¿Qué hago después de registrarme?",
        a: "Completá tu perfil, familiarizate con el panel de organizador y creá tu primer evento. Conviene empezar con uno acotado para conocer el flujo antes de coordinar eventos de mayor escala.",
      },
    ],
    conclusion:
      "Registrarte como organizador te abre la puerta a coordinar la cobertura fotográfica de tus eventos y a sumar ingresos por comisiones sobre las ventas. Completá el alta, verificá tu cuenta y configurá un perfil claro que genere confianza en fotógrafos y participantes. Con esa base lista, el siguiente paso es crear tu primer evento y empezar a convocar la cobertura.",
    ctaAudience: resolveCtaAudience(["organizadores"]),
    imageScene:
      "Event organizer with clipboard and headset at race expo desk, runners registering in background, hyperrealistic documentary photography style",
    imageAltSubject:
      "Organizadora de eventos coordinando la convocatoria de fotógrafos en una expo deportiva",
    imageCaption: "El organizador articula la cobertura y ofrece una landing única a los participantes.",
  },

  "como-crear-tu-primer-evento": {
    seoTitle: "Cómo crear tu primer evento en ComprameLaFoto",
    seoDescription:
      "Configurá tu primer evento colaborativo: datos y fechas, comisiones, invitación a fotógrafos, publicación de la landing y checklist previo al día del evento.",
    excerpt:
      "Configurá tu primer evento colaborativo: datos, fechas, fotógrafos y link público.",
    blocks: [
      p(
        "El evento es el corazón del trabajo de un organizador: agrupa a varios fotógrafos bajo una misma convocatoria y le ofrece a los participantes una única landing donde encontrar todas las fotos. Crear tu primer evento con criterio sienta las bases de una cobertura ordenada y de una experiencia de compra fluida para corredores, equipos o asistentes. En esta guía recorremos el proceso completo: cómo crear el evento, cargar sus datos y fechas, configurar las comisiones, invitar a los fotógrafos, publicar el evento y preparar un checklist para llegar tranquilo al día de la jornada con todo en su lugar."
      ),
      h2("Crear el evento"),
      p(
        "Desde tu panel de organizador, buscá la opción de crear un evento nuevo. El evento es el contenedor que va a unificar la cobertura: a diferencia de un álbum, que pertenece a un fotógrafo, el evento es tu espacio para articular a varios fotógrafos y darle a los participantes un único punto de entrada."
      ),
      p(
        "Ponele un nombre claro y reconocible, el mismo con el que la gente identifica al evento real: «Maratón de la Ciudad 2026», «Torneo Apertura de Vóley», y no un código interno. Ese nombre aparece en la landing y en el link que vas a difundir, así que tiene que resultar obvio para quien lo recibe por WhatsApp o redes."
      ),
      p(
        "Al crear el evento queda inicialmente en un estado de preparación, donde podés configurarlo con calma antes de exponerlo al público. Aprovechá esa instancia para dejar todo listo —datos, comisiones, fotógrafos— y publicar recién cuando el evento esté completo y revisado."
      ),
      h2("Datos y fechas"),
      p(
        "Cargá los datos esenciales del evento: fecha de realización, lugar y una descripción que ayude a los participantes a confirmar que están en la landing correcta. En eventos deportivos, sumar la disciplina y la edición; en otros formatos, los detalles que la gente usa para reconocer su jornada."
      ),
      p(
        "Las fechas no son solo informativas: ordenan toda la operación. La fecha del evento marca cuándo se produce la cobertura, y a partir de ahí se desprenden los tiempos de publicación de las fotos y de difusión a los participantes. Tener esas referencias claras evita improvisar sobre la marcha."
      ),
      p(
        "Cuidá la prolijidad de estos datos porque son la cara visible del evento. Una landing con información clara y bien presentada transmite seriedad y le da confianza al participante para volver más tarde a comprar sus fotos. Un evento descuidado en sus datos básicos resta credibilidad antes incluso de que haya una sola foto."
      ),
      p(
        "Pensá las fechas no solo como el día de la jornada, sino como un cronograma completo que ordena toda la operación. La fecha del evento define cuándo se produce la cobertura; a partir de ahí se desprenden los plazos de publicación de las fotos, el inicio de la difusión y, si lo hubiera, el cierre de la venta. Tener ese calendario claro desde la creación te evita improvisar y te permite coordinar con los fotógrafos cuándo deben subir su material. Conviene también que la descripción de la landing responda de antemano las dudas típicas del participante: de qué evento se trata, de qué fecha y cómo va a encontrar sus fotos. Cuanta más claridad ofrezcas en esa primera pantalla, menos consultas vas a recibir y más confianza va a tener la gente para volver a comprar cuando el material esté disponible."
      ),
      h2("Configurar comisiones"),
      p(
        "Uno de los pasos distintivos del organizador es definir el esquema de comisiones, es decir, qué porcentaje de las ventas generadas en el evento corresponde a tu rol de coordinación. Esta configuración es la que convierte tu trabajo de articulación en una fuente concreta de ingresos."
      ),
      p(
        "Definí la comisión de forma que sea atractiva para los fotógrafos a la vez que justa para tu aporte. Si pedís demasiado, te costará convocar buena cobertura; si pedís muy poco, dejás valor sobre la mesa. El equilibrio surge de entender qué le aportás al fotógrafo: acceso a público calificado sin que tenga que construir solo la promoción."
      ),
      p(
        "Comunicá las condiciones de comisión con transparencia desde la invitación. Un fotógrafo que sabe de antemano qué porcentaje aplica decide con tranquilidad y se suma sin sorpresas. La claridad en este punto es la base de una relación de trabajo sana y de eventos que se repiten en el tiempo."
      ),
      h2("Invitar fotógrafos"),
      p(
        "Con el evento configurado, llega el momento de convocar a los fotógrafos que lo van a cubrir. Desde el panel podés invitarlos a sumarse al evento, de modo que sus galerías queden vinculadas a tu landing y los participantes encuentren todo en un solo lugar."
      ),
      p(
        "Elegí fotógrafos acordes al tipo y la escala del evento. Para una cobertura amplia conviene varios, distribuidos para no dejar zonas o momentos sin registrar; para algo más acotado, quizá alcance con pocos. Pensar la cobertura en términos de qué momentos y lugares querés cubrir te ayuda a definir a cuántos convocar."
      ),
      p(
        "La invitación es también el momento de alinear expectativas: condiciones, comisión, zonas o categorías a cubrir. Cuanto más claro dejes el encuadre desde el inicio, más fluida será la coordinación el día del evento. El tutorial específico de convocatoria profundiza en cómo armar y enviar estas invitaciones."
      ),
      p(
        "Al elegir a quién convocar, equilibrá la cobertura que necesitás con la cantidad de fotógrafos que realmente conviene sumar. Demasiados para un evento chico genera competencia interna y fotos repetidas del mismo momento; muy pocos para uno grande deja zonas o instancias sin registrar y participantes que no encuentran su foto. Pensar la convocatoria en términos de qué lugares y momentos clave querés cubrir —largada, recorrido, llegada, premiación— te ayuda a definir el número justo. Si ya trabajaste antes con fotógrafos que respondieron bien, volver a convocarlos te da previsibilidad y acorta la coordinación. Dejá claras desde la invitación las condiciones, la comisión y la zona o categoría asignada, porque un encuadre transparente al inicio es lo que después hace fluida la coordinación el día del evento y construye una relación que invita a repetir."
      ),
      h2("Publicar el evento"),
      p(
        "Cuando los datos están cargados, las comisiones definidas y los fotógrafos convocados, publicá el evento para que su landing quede accesible al público. A partir de ese momento, el link puede circular y los participantes empiezan a tener un lugar al que volver cuando las fotos estén disponibles."
      ),
      p(
        "Antes de publicar, revisá la landing como si fueras un participante: que el nombre, la fecha y la descripción sean claros, y que la experiencia invite a volver a comprar. Una landing confusa o incompleta genera dudas justo en el momento en que querés que la gente confíe y se quede."
      ),
      p(
        "La publicación de la landing y la difusión son dos cosas distintas pero encadenadas. Podés publicar antes del evento para empezar a generar expectativa y, una vez que los fotógrafos suben las fotos, intensificar la difusión. El tutorial de cómo compartir el link te ayuda a aprovechar al máximo cada canal."
      ),
      h2("Checklist previo al día del evento"),
      p(
        "Llegar al día del evento con un checklist evita los olvidos que después cuestan ventas. Confirmá que todos los fotógrafos convocados aceptaron y saben qué cubrir, que las condiciones y comisiones están claras, y que la landing está publicada o lista para publicarse apenas haya material."
      ),
      ul([
        "Fotógrafos confirmados y con sus zonas o categorías asignadas.",
        "Comisiones definidas y comunicadas a toda la cobertura.",
        "Datos y fechas del evento revisados en la landing.",
        "Canales de difusión preparados: WhatsApp, redes, QR en el lugar.",
        "Acuerdo sobre los tiempos de publicación de las fotos tras el evento.",
      ]),
      p(
        "Coordiná con anticipación cómo y cuándo se subirán las fotos después de la jornada. La velocidad de publicación es clave para las ventas: cuanto antes los participantes encuentren su material, más compran. Dejar esto acordado de antemano evita que la cobertura se enfríe esperando que cada fotógrafo suba a su ritmo."
      ),
      p(
        "Por último, tené previsto un canal de comunicación con los fotógrafos durante el evento para resolver imprevistos. Un grupo o un contacto directo permite reorganizar la cobertura si alguien falla o si surge una situación inesperada. La coordinación en vivo es lo que distingue a un evento bien organizado de uno que improvisa."
      ),
      h3("Aprender de tu primer evento"),
      p(
        "Tu primer evento es, sobre todo, una oportunidad de aprendizaje. Por más que planifiques, siempre aparecen cosas que solo se descubren haciendo: una zona que quedó floja de cobertura, un mensaje de difusión que funcionó mejor que otro, un momento del día donde se concentraron las ventas. Encarar esa primera experiencia con mentalidad de aprender —tomando nota de lo que pasa— transforma cualquier tropiezo en información valiosa para los próximos, en lugar de en una frustración que te desanime."
      ),
      p(
        "Prestá atención a la coordinación con los fotógrafos. La forma en que fluyó la comunicación antes, durante y después del evento te dice mucho sobre qué ajustar. ¿Quedó clara la asignación de zonas? ¿Los tiempos de publicación se respetaron? ¿Hubo huecos de cobertura? Estas preguntas, respondidas con honestidad después de la jornada, son las que te permiten afinar tu manera de trabajar con la red y llegar al segundo evento con un proceso mucho más aceitado."
      ),
      p(
        "Mirá también los números con curiosidad. Cuánto se vendió, en qué momentos, qué productos tuvieron más salida y cómo respondió el público a la difusión son datos que dibujan el perfil de tu evento. Compararlos con tus expectativas iniciales te ayuda a calibrar mejor las próximas: tal vez subestimaste el potencial, o tal vez la difusión necesitaba más empuje. Cada evento deja una huella de datos que, bien leída, hace que el siguiente arranque con decisiones más informadas."
      ),
      p(
        "Por último, pedí feedback. Preguntarles a los fotógrafos cómo vivieron la coordinación y observar las consultas de los participantes te da una mirada que tus propios números no muestran. A veces un detalle de la experiencia —algo que confundió a la gente o una traba que vivió un fotógrafo— explica resultados que de otro modo parecerían inexplicables. Escuchar a quienes participaron es la forma más rica de mejorar, y demuestra una actitud profesional que tu red y tu público valoran."
      ),
    ],
    faq: [
      {
        q: "¿Qué diferencia hay entre un evento y un álbum?",
        a: "El álbum pertenece a un fotógrafo y contiene sus fotos. El evento es del organizador y agrupa a varios fotógrafos bajo una misma convocatoria, ofreciendo a los participantes una landing única con todas las galerías.",
      },
      {
        q: "¿Cómo defino la comisión del evento?",
        a: "Buscá un porcentaje atractivo para los fotógrafos y justo para tu aporte de coordinación y acceso a público. Comunicalo con transparencia desde la invitación para que cada fotógrafo decida sin sorpresas.",
      },
      {
        q: "¿A cuántos fotógrafos conviene invitar?",
        a: "Depende de la escala y del tipo de evento. Pensá qué momentos y zonas querés cubrir: para una cobertura amplia conviene varios distribuidos; para algo acotado puede alcanzar con pocos.",
      },
      {
        q: "¿Puedo publicar la landing antes del evento?",
        a: "Sí, podés publicarla para generar expectativa y luego intensificar la difusión cuando los fotógrafos suban las fotos. Revisá que los datos sean claros antes de exponerla al público.",
      },
      {
        q: "¿Qué no puede faltar antes del día del evento?",
        a: "Fotógrafos confirmados con zonas asignadas, comisiones comunicadas, datos de la landing revisados, canales de difusión listos y un acuerdo claro sobre cuándo se publicarán las fotos.",
      },
    ],
    conclusion:
      "Crear tu primer evento es un ejercicio de coordinación: datos claros, comisiones justas, fotógrafos bien convocados y una landing que invite a volver. Si llegás al día de la jornada con un checklist cumplido y los tiempos de publicación acordados, la cobertura fluye y las ventas aparecen. Ese primer evento te deja la plantilla para coordinar coberturas cada vez más grandes con confianza.",
    ctaAudience: resolveCtaAudience(["organizadores"]),
    imageScene:
      "Organizer creating event on laptop at community sports club office, medals on shelf, hyperrealistic documentary photography style",
    imageAltSubject:
      "Organizador configurando un nuevo evento colaborativo en el panel de ComprameLaFoto",
    imageCaption: "Un evento bien configurado unifica la cobertura de varios fotógrafos en una landing.",
  },

  "como-convocar-fotografos": {
    seoTitle: "Cómo convocar fotógrafos para tu evento",
    seoDescription:
      "Estrategias y pasos para invitar fotógrafos a tu evento en ComprameLaFoto: definir cupos y zonas, enviar invitaciones, comunicar condiciones y coordinar el día.",
    excerpt:
      "Estrategias y pasos para invitar fotógrafos a cubrir tu evento en ComprameLaFoto.",
    blocks: [
      p(
        "Una buena cobertura es lo que hace que un evento venda: cuantos más momentos, ángulos y participantes queden bien registrados, más fotos habrá para comprar. Convocar a los fotógrafos adecuados, en la cantidad justa y con las condiciones claras es una de las tareas centrales del organizador. No se trata solo de juntar gente con cámara, sino de planificar quién cubre qué para que ninguna zona o momento clave quede sin registrar. En esta guía vemos cómo definir cupos y zonas, enviar las invitaciones, comunicar las condiciones, confirmar la asistencia, coordinar el día del evento y aplicar buenas prácticas que hacen que los fotógrafos quieran repetir."
      ),
      h2("Definir cupos y zonas"),
      p(
        "Antes de invitar a nadie, pensá la cobertura en términos de espacio y tiempo. Un evento tiene momentos clave —largada, llegada, premiación— y zonas distintas que conviene cubrir. Definir cuántos fotógrafos necesitás y para qué parte evita el doble problema de superponer cobertura en un lugar y dejar otro vacío."
      ),
      p(
        "La cantidad de fotógrafos debe ser proporcional a la escala del evento y al público esperado. Una maratón con miles de corredores requiere más cobertura que un torneo barrial; sobredimensionar genera competencia interna innecesaria y subdimensionar deja participantes sin sus fotos. Buscá el número que cubra bien sin saturar."
      ),
      p(
        "Asignar zonas o categorías desde el inicio ordena la cobertura y le da a cada fotógrafo un objetivo claro. Cuando cada uno sabe qué le toca, el resultado es más completo y los participantes tienen más chances de encontrarse. Esta planificación previa es la diferencia entre una cobertura coordinada y una multitud de cámaras sin rumbo."
      ),
      h2("Enviar invitaciones"),
      p(
        "Con la cobertura planificada, invitá a los fotógrafos a sumarse al evento desde tu panel de organizador. La invitación vincula su participación a tu evento, de modo que sus galerías queden asociadas a la landing única que verán los participantes. Es el mecanismo formal que arma el equipo de cobertura."
      ),
      p(
        "Elegí a quién invitar según el tipo de evento y el estilo de fotografía que buscás. Para deportes conviene gente con experiencia en acción; para sociales, otro perfil. Si ya trabajaste con fotógrafos que respondieron bien, volver a convocarlos te da previsibilidad y acelera la coordinación respecto de armar un equipo desde cero."
      ),
      p(
        "La invitación es tu primera impresión como organizador frente al fotógrafo. Una convocatoria clara, con la información necesaria y un tono profesional, predispone a aceptar. Una invitación vaga, sin condiciones ni detalles, genera dudas y hace que los buenos fotógrafos —que suelen tener opciones— prefieran otros eventos."
      ),
      p(
        "Cuidá el momento y la anticipación con que enviás las invitaciones, porque los buenos fotógrafos suelen tener la agenda comprometida con semanas de antelación. Convocar a último momento reduce tus opciones a quienes quedaron libres, que no siempre son los que mejor se ajustan a tu evento. Cuanto antes armes tu equipo, más probabilidades tenés de contar con la cobertura que querés. Incluí en la invitación la información esencial para que la persona pueda decidir sin tener que perseguirte con preguntas: fecha, lugar, tipo de evento, zona o categoría que te interesa que cubra y condiciones generales. Una convocatoria completa y profesional desde el primer mensaje predispone a aceptar y proyecta una imagen de organizador serio, mientras que una invitación vaga obliga a un ida y vuelta que enfría el interés y demora el armado de tu cobertura."
      ),
      h2("Comunicar condiciones"),
      p(
        "Desde el primer contacto, dejá claras las condiciones: la comisión que aplica, qué se espera de la cobertura, las zonas o categorías asignadas y los tiempos de publicación de las fotos. Un fotógrafo que conoce las reglas de antemano decide con tranquilidad y se suma sabiendo a qué atenerse."
      ),
      p(
        "La transparencia en las condiciones es la base de una relación de trabajo sana. Sorprender al fotógrafo después —con una comisión distinta a la hablada o exigencias no comunicadas— rompe la confianza y arruina la posibilidad de futuros eventos juntos. Lo que se acuerda al inicio es lo que sostiene la colaboración."
      ),
      p(
        "Aprovechá la comunicación de condiciones para alinear también la calidad esperada y el estilo. No se trata de imponer una forma de fotografiar, sino de asegurar coherencia para los participantes. Cuando todos entienden el estándar común del evento, el resultado se siente como una cobertura unificada y no como piezas sueltas."
      ),
      h2("Confirmar asistencia"),
      p(
        "No alcanza con invitar: necesitás confirmaciones firmes para saber con qué cobertura realmente contás. Hacé un seguimiento de quién aceptó y quién no, y reasigná zonas si alguien se baja. Llegar al día del evento sin saber quién va a estar es la receta de los huecos de cobertura."
      ),
      p(
        "La confirmación es el momento de consolidar el plan: con la lista final de fotógrafos, revisá que todas las zonas y momentos clave estén cubiertos. Si detectás un faltante, todavía estás a tiempo de convocar a alguien más o de redistribuir la cobertura entre los confirmados."
      ),
      p(
        "Dejá registro claro de las confirmaciones y de qué le toca a cada uno. Ese registro es tu mapa de cobertura para el día del evento y la referencia para resolver cualquier duda. La prolijidad en esta etapa se traduce directamente en una jornada sin sorpresas y en una galería completa al final."
      ),
      p(
        "Establecé una fecha límite para las confirmaciones, de modo que tengas margen de reacción si alguien no responde o se baja. Esperar respuestas hasta el día previo te deja sin tiempo para cubrir un hueco, mientras que un corte anticipado te permite convocar a un reemplazo o redistribuir zonas con calma. Una vez cerrada la lista de confirmados, repasá tu mapa de cobertura y verificá que cada momento y lugar importante tenga responsable: la largada, el recorrido, la llegada, la premiación. Si detectás un punto débil, todavía estás a tiempo de reforzarlo. Compartí con todo el equipo la distribución final para que cada uno sepa exactamente qué le toca y no haya superposiciones ni vacíos. Llegar al día del evento con ese plan consolidado y comunicado es lo que convierte a un grupo de fotógrafos sueltos en una cobertura coordinada."
      ),
      h2("Coordinación el día del evento"),
      p(
        "El día de la jornada, tené un canal de comunicación abierto con todos los fotógrafos —un grupo, un contacto directo— para coordinar en vivo. Los imprevistos son parte de cualquier evento: alguien llega tarde, una zona se vuelve más interesante de lo previsto, el clima cambia. Poder reorganizar sobre la marcha salva la cobertura."
      ),
      p(
        "Mantené presente el mapa de cobertura que armaste y verificá durante el evento que las zonas clave estén siendo registradas. Si notás un hueco, redistribuí. Tu rol ese día es de director de orquesta: no tomás las fotos, pero asegurás que el conjunto cubra todo lo que vale la pena."
      ),
      p(
        "Acordá también el momento y la forma de la publicación posterior. La velocidad con que las fotos lleguen a la landing impacta de lleno en las ventas, así que dejar claro cuándo sube cada uno evita que la cobertura se enfríe mientras esperás que el material aparezca a cuentagotas."
      ),
      h2("Buenas prácticas"),
      p(
        "Tratá a los fotógrafos como socios del evento, no como proveedores descartables. Una buena experiencia —condiciones claras, coordinación prolija, pagos en orden— hace que quieran repetir, y contar con un equipo estable te ahorra el trabajo de reconstruir la cobertura desde cero en cada evento."
      ),
      p(
        "Después del evento, mantené la relación: agradecé, compartí cómo fueron las ventas si corresponde y dejá la puerta abierta para la próxima. Los organizadores que cuidan a su red de fotógrafos terminan teniendo prioridad cuando hay que elegir qué evento cubrir, lo que se traduce en mejor cobertura para sus jornadas."
      ),
      p(
        "Documentá lo que funcionó y lo que no para mejorar la próxima convocatoria. Si una zona quedó floja, si faltó cobertura en un momento clave o si sobró gente en otro, esos aprendizajes afinan tu planificación. Convocar bien es una habilidad que se perfecciona evento tras evento con observación y ajuste."
      ),
      h3("Retener a tu red de fotógrafos"),
      p(
        "Convocar fotógrafos para un evento puntual es relativamente fácil; lo difícil y valioso es construir una red estable que quiera repetir contigo. Un equipo de fotógrafos que ya conocés te ahorra el trabajo de rearmar la cobertura desde cero cada vez, te da previsibilidad sobre la calidad y agiliza enormemente la coordinación, porque ya hablan tu mismo idioma. Invertir en esa relación de largo plazo rinde mucho más que tratar a cada fotógrafo como un colaborador descartable que se busca y se reemplaza en cada evento."
      ),
      p(
        "La base de la retención es una buena experiencia de trabajo. Condiciones que se cumplen, comisiones pagadas en orden, coordinación que les facilita la tarea y reconocimiento de su aporte son los ingredientes que hacen que un fotógrafo quiera volver. Nadie repite con un organizador desprolijo, que cambia las reglas o que se demora con los pagos, por más que el evento sea atractivo. La prolijidad y el respeto en el trato son lo que construye lealtad en una red profesional."
      ),
      p(
        "Cuidá el vínculo también fuera del evento. Un mensaje de agradecimiento, compartir cómo fueron los resultados o avisar con anticipación de la próxima convocatoria mantienen viva la relación y le dan al fotógrafo la sensación de ser parte de algo y no solo una pieza intercambiable. Esos gestos, que cuestan poco, hacen una gran diferencia en cómo te perciben y en la prioridad que le dan a tus eventos cuando tienen que elegir entre varias propuestas."
      ),
      p(
        "Pensá en el crecimiento mutuo. Si a los fotógrafos les va bien en tus eventos —venden, acceden a buen público, trabajan cómodos— su éxito es también el tuyo, porque más cobertura de calidad significa más ventas y más comisiones. Plantear la relación como una sociedad donde ambos ganan alinea los intereses y crea un círculo virtuoso. Una red de fotógrafos satisfecha es, a la larga, uno de los mayores diferenciales que un organizador puede tener frente a la competencia."
      ),
    ],
    faq: [
      {
        q: "¿Cuántos fotógrafos necesito para mi evento?",
        a: "Depende de la escala y del público. Pensá la cobertura por zonas y momentos clave: una maratón masiva requiere varios fotógrafos distribuidos, mientras que un evento acotado puede cubrirse con pocos.",
      },
      {
        q: "¿Cómo invito a los fotógrafos?",
        a: "Desde tu panel de organizador, invitándolos a sumarse al evento. La invitación vincula sus galerías a tu landing única. Hacela clara y profesional para predisponer a que acepten.",
      },
      {
        q: "¿Qué condiciones debo comunicar?",
        a: "La comisión que aplica, qué se espera de la cobertura, las zonas o categorías asignadas y los tiempos de publicación. La transparencia desde el inicio es la base de una colaboración sana.",
      },
      {
        q: "¿Por qué es importante confirmar la asistencia?",
        a: "Porque te dice con qué cobertura real contás. Sin confirmaciones firmes podés llegar al evento con huecos. Hacé seguimiento y reasigná zonas si alguien se baja.",
      },
      {
        q: "¿Cómo logro que los fotógrafos quieran repetir?",
        a: "Tratándolos como socios: condiciones claras, coordinación prolija y pagos en orden. Un equipo estable te ahorra rearmar la cobertura en cada evento y mejora la calidad del material.",
      },
    ],
    conclusion:
      "Convocar fotógrafos es planificación y relación: definí cupos y zonas, invitá con condiciones transparentes, confirmá la asistencia y coordiná en vivo el día del evento. Si tratás a tu cobertura como un equipo de socios y cuidás cada experiencia, vas a construir una red estable que mejora la calidad de tus eventos y te da prioridad cuando llega el momento de elegir qué cubrir.",
    ctaAudience: resolveCtaAudience(["organizadores"]),
    imageScene:
      "Group of sports photographers receiving briefing from organizer before marathon start line, hyperrealistic documentary photography style",
    imageAltSubject:
      "Organizador dando indicaciones a un equipo de fotógrafos antes de la largada de una maratón",
    imageCaption: "Una cobertura bien planificada por zonas asegura que nadie se quede sin sus fotos.",
  },

  "como-generar-ingresos-comisiones-organizadores": {
    seoTitle: "Cómo generar ingresos con comisiones de organizador",
    seoDescription:
      "Entendé cómo funcionan las comisiones de organizador en ComprameLaFoto: el modelo, cómo configurar el porcentaje, qué ventas comisionan, seguimiento y cobro.",
    excerpt:
      "Entendé cómo funcionan las comisiones de organizador y cómo maximizar ingresos por evento.",
    blocks: [
      p(
        "El modelo de comisiones es lo que transforma la coordinación de eventos en una fuente real de ingresos para el organizador. En lugar de ser solo quien articula la cobertura, recibís un porcentaje de las ventas generadas en tu evento, convirtiendo la fotografía en una línea económica más de la jornada que ya producís. Entender bien cómo funciona este esquema —cómo se configura, qué ventas comisionan y cómo se sigue y se cobra— es clave para maximizar el retorno sin afectar la motivación de los fotógrafos. En esta guía recorremos el modelo de comisiones, su configuración, el alcance, el seguimiento, el cobro y ejemplos según el tipo de evento."
      ),
      h2("Modelo de comisiones"),
      p(
        "La lógica es simple: vos aportás el público y la coordinación, los fotógrafos aportan las imágenes, y de cada venta generada en tu evento te corresponde un porcentaje. Ese porcentaje es tu comisión de organizador, una retribución por hacer posible que esas ventas existan al reunir audiencia y cobertura en un mismo lugar."
      ),
      p(
        "Este modelo alinea los intereses de todos. Al organizador le conviene que se venda mucho, porque su comisión depende del volumen; al fotógrafo le conviene sumarse a un evento bien promocionado, porque accede a público que no tendría por su cuenta. La comisión es el pegamento económico de esa colaboración."
      ),
      p(
        "A diferencia de un costo fijo, la comisión es proporcional al éxito del evento. Si vendés mucho, ganás mucho; si el evento fue chico, la comisión acompaña esa escala. Esto reduce el riesgo de organizar: no comprometés un gasto fijo, sino que participás del resultado real de las ventas."
      ),
      h2("Configurar el porcentaje"),
      p(
        "Al crear el evento definís el porcentaje de comisión que aplicará sobre las ventas. Esta decisión es estratégica: tiene que ser lo suficientemente atractiva para que los fotógrafos quieran sumarse y, a la vez, reflejar de manera justa el valor que aportás con el público y la organización."
      ),
      p(
        "Un porcentaje demasiado alto desalienta a la cobertura: los fotógrafos comparan y eligen eventos donde se quedan con más de su venta. Uno demasiado bajo deja valor sobre la mesa y subestima tu aporte. El punto justo surge de entender qué tan valioso es el acceso al público que vos ofrecés para esos fotógrafos."
      ),
      p(
        "Pensá la comisión también en función del esfuerzo de promoción que vas a poner. Si vas a difundir fuerte y a llevar mucho público a la landing, tu aporte justifica un porcentaje mayor que si tu rol es más liviano. La comisión debe guardar proporción con el valor que efectivamente generás."
      ),
      p(
        "Tené en cuenta que el porcentaje no es una decisión que tomás una sola vez para siempre: podés calibrarlo evento tras evento según los resultados y el tipo de jornada. Un evento donde aportás un público enorme y una difusión potente justifica una comisión distinta a uno donde tu rol es más acotado. Lo importante es que el número sea sostenible para ambas partes: si los fotógrafos sienten que les queda poco, te costará retener a los mejores; si te quedás corto, subestimás tu trabajo de coordinación y promoción. Conviene también ser transparente sobre cómo llegaste a ese porcentaje, porque un fotógrafo que entiende la lógica detrás de la comisión la acepta con más facilidad que uno al que simplemente le imponen un número. La claridad y la coherencia en este punto son la base de relaciones que se repiten en el tiempo."
      ),
      h2("Qué ventas generan comisión"),
      p(
        "La comisión se aplica sobre las ventas generadas dentro de tu evento, es decir, las que ocurren en las galerías de los fotógrafos vinculados a tu convocatoria. Entender claramente este alcance evita confusiones tanto para vos como para los fotógrafos sobre qué operaciones forman parte del esquema."
      ),
      p(
        "Por eso es tan importante que los fotógrafos suban su material al evento y que los participantes lleguen a través de la landing. Cuanto más se concentre la actividad de compra dentro del evento, más claro y completo es el cálculo de tu comisión. La unificación de la cobertura no es solo comodidad: es la base del modelo de ingresos."
      ),
      p(
        "Comunicar con claridad qué ventas comisionan, desde el inicio y a todas las partes, previene malentendidos. Un fotógrafo que entiende exactamente sobre qué se calcula la comisión trabaja sin desconfianza, y vos podés explicar tus ingresos con transparencia. La claridad sobre el alcance sostiene la confianza en todo el esquema."
      ),
      h2("Seguimiento en el panel"),
      p(
        "Desde tu panel de organizador podés seguir las ventas del evento y, con ellas, la comisión que vas generando. Este seguimiento te da en tiempo real la dimensión económica de tu evento, lo que te permite evaluar si la difusión está funcionando y dónde conviene poner más energía."
      ),
      p(
        "El seguimiento es también una herramienta de aprendizaje. Ver qué eventos rinden más, qué tipo de cobertura genera más ventas y cómo evoluciona la actividad te da información para mejorar los próximos. Sin esos datos, organizar es a ciegas; con ellos, cada evento es una oportunidad de optimizar el siguiente."
      ),
      p(
        "Revisar el panel con regularidad, especialmente durante el período de ventas posterior al evento, te mantiene al tanto del comportamiento de tu audiencia. Las ventas no siempre ocurren todas el primer día; un seguimiento atento te muestra la curva real y te permite reforzar la difusión si ves que el potencial todavía no se agotó."
      ),
      p(
        "Usá esos datos también para comparar eventos entre sí y entender qué tipo de jornada te conviene priorizar. Tal vez descubras que una carrera masiva, aun con compras chicas por persona, te deja más comisión total que un evento de nicho, o al revés. Esa lectura te ayuda a decidir dónde invertir tu energía de organización y promoción en el futuro. El seguimiento en tiempo real es además una herramienta para actuar mientras todavía podés: si ves que las ventas de un evento vienen flojas durante el período activo, estás a tiempo de reforzar la difusión, sumar un recordatorio o pedirles a los fotógrafos que publiquen el material pendiente. Mirar el panel no como un informe final sino como un tablero vivo es lo que convierte la información en mejores resultados para tu próxima cobertura."
      ),
      h2("Cobro y liquidación"),
      p(
        "Como en todo el ecosistema, los cobros se gestionan a través de Mercado Pago, la pasarela principal en Argentina. Tu comisión sigue el flujo de pagos integrado de la plataforma, lo que mantiene la operación ordenada y trazable sin que tengas que perseguir cobros de forma manual a cada fotógrafo."
      ),
      p(
        "Tener tu cuenta correctamente configurada y verificada es la condición para que la parte que te corresponde tenga dónde acreditarse. Igual que el fotógrafo necesita Mercado Pago para cobrar sus ventas, el organizador necesita su cuenta en orden para recibir la comisión generada por su evento."
      ),
      p(
        "Conocer los plazos de acreditación de Mercado Pago te ayuda a planificar. La comisión, como cualquier cobro, sigue la dinámica de los pagos online del país, así que entender esos tiempos te permite proyectar tus ingresos por evento con realismo y organizar tu economía sin sorpresas."
      ),
      h2("Ejemplos por tipo de evento"),
      p(
        "En una maratón masiva, el volumen es el aliado del organizador: aunque cada corredor compre pocas fotos, la cantidad de participantes hace que la suma de comisiones sea significativa. Acá el foco está en lograr la máxima difusión para que el mayor número posible de corredores llegue a la landing y compre."
      ),
      p(
        "En un torneo o liga deportiva con varias fechas, la oportunidad está en la recurrencia: si la experiencia es buena, los mismos equipos y familias vuelven a comprar fecha tras fecha. Acá conviene construir una relación de mediano plazo, porque el ingreso por comisiones se acumula a lo largo de toda la temporada."
      ),
      p(
        "En eventos más chicos o de nicho, el valor está en la especificidad del público: menos gente, pero muy interesada en sus fotos. Una comisión razonable sobre ventas de alto interés puede rendir muy bien. La clave, en todos los casos, es ajustar la difusión y el porcentaje al perfil real de cada evento."
      ),
      h3("Aumentar tus ingresos por comisiones"),
      p(
        "La comisión crece con el volumen de ventas de tu evento, así que la forma más directa de aumentar tus ingresos es lograr que se venda más. Y eso depende, en gran medida, de dos cosas que están en tus manos: la difusión y la facilidad de compra. Un evento muy bien promocionado, donde la mayor cantidad posible de participantes llega a la landing y encuentra sus fotos sin esfuerzo, vende mucho más que uno con la misma cobertura pero comunicado a medias. La promoción es tu palanca más potente."
      ),
      p(
        "La calidad y la rapidez de la cobertura también impactan en las ventas. Cuantas más fotos buenas haya de cada participante, y cuanto antes estén publicadas mientras la emoción sigue fresca, más compra la gente. Coordinar con los fotógrafos para que el material suba rápido y cubra bien todos los momentos clave no es solo una cuestión operativa: es una decisión que se traduce directamente en tu comisión. Un evento con cobertura completa y veloz rinde mucho más que uno con huecos o demoras."
      ),
      p(
        "La recurrencia es otra vía de crecimiento que muchos organizadores subestiman. En ligas, circuitos o torneos con varias fechas, los mismos equipos y familias vuelven a comprar una y otra vez si la experiencia es buena. Construir una relación de mediano plazo con ese público, donde saben que en cada fecha van a encontrar sus fotos rápido y a buen precio, hace que las comisiones se acumulen a lo largo de toda la temporada. La fidelidad del público es ingreso recurrente."
      ),
      p(
        "Por último, usá los datos para optimizar. Seguir qué eventos rinden más, qué canales de difusión funcionan mejor y cómo se comporta tu audiencia te permite enfocar tu energía donde hay más retorno. No todos los eventos ni todas las acciones de promoción rinden igual, y aprender a distinguir cuáles te dejan más comisión por el mismo esfuerzo es lo que separa a un organizador que crece de uno que repite siempre lo mismo esperando resultados distintos."
      ),
    ],
    faq: [
      {
        q: "¿Cómo gano dinero como organizador?",
        a: "Mediante una comisión sobre las ventas generadas en tu evento. Aportás público y coordinación, los fotógrafos aportan las imágenes, y de cada venta te corresponde un porcentaje que definís al crear el evento.",
      },
      {
        q: "¿Cómo defino el porcentaje de comisión?",
        a: "Buscá un valor atractivo para los fotógrafos y proporcional a tu aporte de público y promoción. Demasiado alto desalienta la cobertura; demasiado bajo subestima tu trabajo.",
      },
      {
        q: "¿Sobre qué ventas se calcula la comisión?",
        a: "Sobre las ventas generadas dentro de tu evento, en las galerías de los fotógrafos vinculados a tu convocatoria. Por eso es clave que suban su material al evento y que el público llegue por la landing.",
      },
      {
        q: "¿Cómo sigo cuánto estoy generando?",
        a: "Desde tu panel de organizador podés seguir las ventas del evento y la comisión asociada en tiempo real, lo que te ayuda a evaluar la difusión y a mejorar los próximos eventos.",
      },
      {
        q: "¿Cómo cobro mi comisión?",
        a: "A través de Mercado Pago, siguiendo el flujo de pagos integrado de la plataforma. Necesitás tu cuenta verificada y en orden para que la comisión tenga dónde acreditarse.",
      },
    ],
    conclusion:
      "Las comisiones convierten tu rol de organizador en un negocio: un porcentaje sobre las ventas de tu evento que crece con su éxito y reduce el riesgo de organizar. Configurá un porcentaje justo, asegurá que la actividad se concentre en tu landing, seguí los resultados en el panel y cobrá por Mercado Pago. Cuanto mejor difundas y coordines, más rinde cada evento.",
    ctaAudience: resolveCtaAudience(["organizadores"]),
    imageScene:
      "Event organizer reviewing commission report on tablet after local football tournament, hyperrealistic documentary photography style",
    imageAltSubject:
      "Organizador revisando las comisiones generadas por su evento en una tablet",
    imageCaption: "La comisión es proporcional al éxito del evento y se cobra vía Mercado Pago.",
  },

  "como-gestionar-fotografos-colaboradores": {
    seoTitle: "Cómo gestionar fotógrafos colaboradores en tu evento",
    seoDescription:
      "Administrá fotógrafos invitados en ComprameLaFoto: roles, aprobar o rechazar colaboradores, asignar zonas, comunicación durante el evento e incidencias.",
    excerpt:
      "Administrá fotógrafos invitados, permisos y cobertura dentro de un evento colaborativo.",
    blocks: [
      p(
        "Tener varios fotógrafos en un evento es una ventaja para la cobertura, pero también un desafío de coordinación. Gestionar bien a los colaboradores —decidir quién entra, qué cubre cada uno, cómo se comunican durante la jornada y cómo se resuelven los imprevistos— es lo que separa un evento prolijo de un caos de cámaras sin rumbo. Una buena gestión mejora la calidad del material, la experiencia de los participantes y la relación con tu red de fotógrafos. En esta guía vemos los roles dentro de un evento, cómo aprobar o rechazar colaboradores, cómo asignar zonas o categorías, cómo comunicarse durante el evento, cómo resolver incidencias y qué hacer en el post-evento."
      ),
      h2("Roles en un evento"),
      p(
        "En un evento colaborativo conviven roles distintos con responsabilidades claras. El organizador coordina: define condiciones, convoca y articula. Los fotógrafos colaboradores producen las imágenes dentro del marco que vos establecés. Entender esta distinción es la base para gestionar sin pisarse ni generar confusión sobre quién decide qué."
      ),
      p(
        "El organizador no reemplaza el criterio fotográfico de cada colaborador, pero sí fija el encuadre general: qué se cubre, bajo qué condiciones y con qué estándar. Esa frontera —vos coordinás, ellos producen— permite que cada uno aporte lo suyo sin invadir el terreno del otro, lo que hace fluida la colaboración."
      ),
      p(
        "Tener los roles claros desde el inicio evita los conflictos típicos de los eventos con mucha gente. Cuando cada colaborador sabe qué se espera de él y qué decisiones te corresponden a vos, la coordinación deja de ser una negociación constante y se vuelve una operación ordenada donde todos reman para el mismo lado."
      ),
      h2("Aprobar o rechazar colaboradores"),
      p(
        "No todo fotógrafo que quiere sumarse encaja en cualquier evento. Como organizador, tenés la potestad de aprobar a quienes aportan a tu cobertura y de no incorporar a quienes no se ajustan al perfil, la escala o el estándar que buscás. Esta selección es parte de cuidar la calidad del resultado final."
      ),
      p(
        "Aprobá pensando en la cobertura que necesitás: si ya tenés cubierta una zona, sumar a alguien más para el mismo lugar genera superposición innecesaria. La decisión de incorporar o no a un colaborador debe responder a las necesidades reales del evento, no solo a la disponibilidad de quien se ofrece."
      ),
      p(
        "Cuando declinás una incorporación, hacelo con respeto y claridad. La red de fotógrafos es chica y la reputación circula; un «no» bien comunicado deja la puerta abierta para otro evento donde esa persona sí encaje. Gestionar las altas con criterio y buen trato fortalece tu posición como organizador a largo plazo."
      ),
      p(
        "A la hora de aprobar, mirá más allá de la disponibilidad y considerá la complementariedad del equipo. Dos fotógrafos con estilos y fortalezas distintas pueden cubrir mejor un evento que dos muy parecidos compitiendo por los mismos planos. Pensá también en la experiencia: para una zona exigente, como la llegada de una maratón, conviene alguien con rodaje en acción, mientras que otras instancias admiten perfiles más variados. Llevá un registro de cómo respondió cada colaborador en eventos anteriores, porque esa memoria es oro al momento de decidir a quién volver a convocar. Un equipo construido con criterio, donde cada integrante aporta algo y conocés de antemano su forma de trabajar, rinde mucho más que una suma de cámaras reunidas por azar. La selección no es solo filtrar: es diseñar la cobertura que tu evento necesita."
      ),
      h2("Asignar zonas o categorías"),
      p(
        "Una vez aprobados los colaboradores, asignales zonas o categorías para que la cobertura sea completa y no se superponga. Esta distribución es el corazón de la gestión: convierte un grupo de fotógrafos en un equipo coordinado donde cada uno tiene un objetivo concreto que cubrir."
      ),
      p(
        "Pensá la asignación en función de los momentos y lugares clave del evento. Largada, recorrido, llegada, premiación; o, en un torneo, distintas canchas o categorías. Repartir estos focos entre los colaboradores asegura que lo importante quede registrado y que los participantes tengan más chances de encontrarse."
      ),
      p(
        "Comunicá la asignación con claridad y confirmá que cada uno la entendió. Una zona que todos creen que cubre otro termina sin cobertura; una que dos personas creen suya genera superposición. La precisión en el reparto es lo que garantiza que el mapa de cobertura se cumpla en la práctica el día del evento."
      ),
      h2("Comunicación durante el evento"),
      p(
        "El día de la jornada, mantené un canal abierto con todos los colaboradores para coordinar en vivo. Un grupo de mensajería o un contacto directo permite ajustar la cobertura sobre la marcha, avisar de cambios y resolver dudas sin que nadie quede desconectado del plan general."
      ),
      p(
        "La comunicación en vivo es clave porque los eventos rara vez salen exactamente como se planearon. Un retraso, un cambio de clima, una zona que resulta más interesante de lo previsto: poder comunicar estos ajustes en el momento es lo que permite que el equipo reaccione como un conjunto y no como individuos aislados."
      ),
      p(
        "Mantené un tono claro y resolutivo durante el evento. No es momento de discusiones largas, sino de indicaciones concretas: «falta cubrir tal zona», «concentrémonos en la premiación». La eficacia de la comunicación en vivo se mide en qué tan rápido el equipo puede reorganizarse ante un imprevisto sin perder momentos importantes."
      ),
      p(
        "Definí antes del evento cuál va a ser el canal principal de comunicación y asegurate de que todos lo tengan a mano y lo revisen. Un grupo de mensajería acordado, con la regla de que ahí se avisan los cambios, evita que la información quede dispersa entre llamadas y mensajes sueltos. Designá también, si el evento es grande, momentos de chequeo: un mensaje al inicio para confirmar que todos están en posición y otros durante la jornada para verificar que las zonas clave estén cubiertas. Esa cadencia de comunicación mantiene al equipo sincronizado sin necesidad de estar encima de cada uno. Cuando surge un imprevisto, un canal aceitado permite reorganizar en minutos lo que de otro modo se resolvería tarde y mal. La comunicación en vivo bien estructurada es, en los hechos, lo que distingue una cobertura coordinada de un grupo de gente sacando fotos por su cuenta."
      ),
      h2("Resolución de incidencias"),
      p(
        "Los imprevistos son inevitables: un fotógrafo que falla, un equipo con problemas, una zona sin cubrir. Tu rol como organizador es resolver estas incidencias con calma y rapidez, redistribuyendo la cobertura entre los colaboradores disponibles para que el impacto en el resultado sea el menor posible."
      ),
      p(
        "Tener un plan B mental para los escenarios más probables te da ventaja. Si sabés de antemano cómo reaccionarías ante la ausencia de un colaborador clave o un problema en una zona crítica, la incidencia deja de ser una crisis y se vuelve un ajuste gestionable que resolvés sin que los participantes lo noten."
      ),
      p(
        "Después de cada incidencia, registrá qué pasó y cómo se resolvió. Ese aprendizaje es valioso para futuros eventos: te permite anticipar problemas recurrentes y mejorar la planificación. Los organizadores experimentados no son los que no tienen imprevistos, sino los que aprendieron a resolverlos sin que se note."
      ),
      h2("Post-evento"),
      p(
        "Terminada la jornada, la gestión continúa. Coordiná con los colaboradores los tiempos de subida del material a la landing, porque la velocidad de publicación impacta directamente en las ventas. Dejar este punto en claro evita que la cobertura se enfríe esperando que cada uno suba a su ritmo."
      ),
      p(
        "El post-evento es también el momento de cuidar la relación con tu red. Agradecer, compartir cómo fue la respuesta y dejar la puerta abierta para próximas convocatorias fideliza a los buenos colaboradores. Un fotógrafo que se sintió bien tratado prioriza tus eventos cuando tiene que elegir dónde cubrir."
      ),
      p(
        "Revisá el evento en su conjunto: qué funcionó en la gestión de colaboradores y qué mejorar. ¿La asignación de zonas fue acertada? ¿La comunicación fluyó? ¿Hubo huecos de cobertura? Estas preguntas, respondidas con honestidad, son las que hacen que cada evento gestiones mejor que el anterior y que tu reputación crezca."
      ),
      h3("Prevenir conflictos entre colaboradores"),
      p(
        "Con varios fotógrafos trabajando en un mismo evento, los roces son posibles, sobre todo si no hay reglas claras. La mejor forma de prevenirlos es definir desde el inicio las condiciones para todos por igual: cómo se reparten las zonas, qué comisión aplica, cómo se manejan los tiempos de publicación. Cuando las reglas son explícitas y parejas, se reduce muchísimo el margen para los malentendidos y las sensaciones de trato injusto, que son la raíz de la mayoría de los conflictos entre colaboradores en un evento."
      ),
      p(
        "Las zonas o categorías bien asignadas son una herramienta clave para evitar fricciones. Cuando cada fotógrafo tiene un espacio claro donde trabajar, se minimiza la competencia directa por los mismos sujetos y la sensación de pisarse entre colegas. Una distribución pensada no solo mejora la cobertura: también ordena la convivencia, porque cada uno sabe cuál es su terreno y no siente que otro le está sacando las fotos que le correspondían. La claridad espacial previene buena parte de las tensiones."
      ),
      p(
        "La transparencia en lo económico es innegociable. Muchos conflictos nacen de dudas sobre cómo se calculan las comisiones o de la percepción de que alguien recibe un trato preferencial. Aplicar reglas claras y parejas, y comunicarlas abiertamente, despeja esas sospechas. Si todos entienden cómo funciona el reparto y ven que se aplica de forma consistente, la confianza se mantiene y el foco queda en hacer bien el trabajo en lugar de en desconfiar del de al lado."
      ),
      p(
        "Cuando aun así surge un conflicto, abordalo rápido y con criterio. Escuchar a las partes, recordar las reglas acordadas y resolver con justicia evita que un roce menor escale y contamine al resto del equipo. Tu rol como organizador incluye ser un árbitro ecuánime cuando hace falta. Una incidencia bien manejada, lejos de dañar la red, puede incluso fortalecerla, porque demuestra que hay alguien que sostiene las reglas y cuida que el trato sea justo para todos."
      ),
    ],
    faq: [
      {
        q: "¿Quién decide qué en un evento colaborativo?",
        a: "El organizador coordina —define condiciones, convoca y articula— y los fotógrafos colaboradores producen las imágenes dentro de ese marco. Tener los roles claros evita conflictos y superposiciones.",
      },
      {
        q: "¿Puedo rechazar a un fotógrafo que quiere sumarse?",
        a: "Sí. Como organizador aprobás a quienes aportan a tu cobertura según el perfil, la escala y el estándar del evento. Hacelo con respeto, porque la red de fotógrafos es chica y la reputación circula.",
      },
      {
        q: "¿Por qué asignar zonas a cada colaborador?",
        a: "Para que la cobertura sea completa sin superposiciones. Repartir momentos y lugares clave convierte un grupo de fotógrafos en un equipo coordinado y aumenta las chances de que cada participante se encuentre.",
      },
      {
        q: "¿Cómo coordino durante el evento?",
        a: "Con un canal de comunicación abierto —un grupo o contacto directo— para ajustar la cobertura en vivo. Usá un tono claro y resolutivo, con indicaciones concretas ante cualquier imprevisto.",
      },
      {
        q: "¿Qué hago si un fotógrafo falla el día del evento?",
        a: "Redistribuí la cobertura entre los colaboradores disponibles con calma y rapidez. Tener un plan B mental para los escenarios más probables convierte la crisis en un ajuste gestionable.",
      },
    ],
    conclusion:
      "Gestionar colaboradores es liderar un equipo: roles claros, selección con criterio, zonas bien asignadas, comunicación fluida en vivo y resolución serena de imprevistos. Si a eso le sumás un post-evento que cuide los tiempos de publicación y la relación con tu red, vas a lograr coberturas más completas, participantes más satisfechos y fotógrafos que quieren repetir en tus eventos.",
    ctaAudience: resolveCtaAudience(["organizadores"]),
    imageScene:
      "Organizer coordinating photographers with walkie-talkies at outdoor cycling race, hyperrealistic documentary photography style",
    imageAltSubject:
      "Organizador coordinando en vivo a los fotógrafos colaboradores durante una carrera de ciclismo",
    imageCaption: "Asignar zonas y comunicar en vivo convierte a varios fotógrafos en un equipo.",
  },

  "como-compartir-link-de-tu-evento": {
    seoTitle: "Cómo compartir el link de tu evento en ComprameLaFoto",
    seoDescription:
      "Compartí la landing de tu evento por WhatsApp, redes, QR y email para que los participantes encuentren sus fotos: mensajes, timing y medición de resultados.",
    excerpt:
      "Compartí la landing de tu evento por WhatsApp, redes y email para que los participantes encuentren sus fotos.",
    blocks: [
      p(
        "Podés tener la mejor cobertura del mundo, pero si los participantes no llegan a la landing, no hay ventas. Compartir el link del evento de forma efectiva es la tarea que conecta todo el trabajo previo con el resultado económico. La buena noticia es que, al concentrar todas las galerías en una sola landing, tenés un único link para difundir en lugar de mil enlaces sueltos. En esta guía vemos cómo obtener ese link, qué mensajes funcionan en WhatsApp, cómo usar redes y códigos QR, cómo aprovechar el email, cuál es el momento ideal para compartir y cómo medir los resultados para mejorar evento tras evento."
      ),
      h2("Obtener el link público"),
      p(
        "Una vez publicada la landing del evento, obtenés su link público desde tu panel de organizador. Ese enlace es la puerta de entrada única para corredores, equipos o asistentes: lo abren, encuentran todas las galerías vinculadas y pueden buscar y comprar sus fotos sin perderse entre múltiples direcciones."
      ),
      p(
        "La gran ventaja de este modelo es la simplicidad para difundir. En lugar de coordinar y repartir el enlace de cada fotógrafo por separado, tenés un solo link que representa todo el evento. Eso facilita enormemente la comunicación y reduce la confusión del participante, que sabe que en ese único lugar está todo."
      ),
      p(
        "Antes de difundirlo masivamente, abrí el link vos mismo y verificá que la landing se vea bien y que la experiencia sea clara. Es el primer contacto del participante con tu evento online; que funcione sin fricciones desde el primer clic es decisivo para que se quede y termine comprando."
      ),
      h2("Mensajes sugeridos para WhatsApp"),
      p(
        "WhatsApp es el canal rey en Argentina para este tipo de difusión: grupos de corredores, de equipos, de la comunidad del evento. Un buen mensaje es corto, claro y orientado a la acción: qué evento es, que ya están las fotos y el link para buscarlas. La gente decide en segundos, así que la claridad manda."
      ),
      p(
        "Incluí en el mensaje una pista de cómo buscarse —por ejemplo, por número de dorsal o por selfie si está disponible— para que el participante sepa que encontrar su foto es fácil. Bajar esa barrera mental aumenta las chances de que abra el link en el momento en lugar de dejarlo para después y olvidarlo."
      ),
      p(
        "Evitá los mensajes largos y cargados de detalles que nadie lee. Un texto breve con el link y, si querés, la portada del evento convierte mucho mejor que un párrafo extenso. Si necesitás dar más información, dejala en la propia landing, no en el mensaje de WhatsApp que debe invitar a hacer clic."
      ),
      p(
        "Sumá al mensaje un pequeño gancho visual o emocional, porque en un grupo saturado de notificaciones lo que se destaca es lo que se abre. Una frase que conecte con la experiencia vivida —«¿ya viste cómo quedaron tus fotos de la carrera?»— suele funcionar mejor que un aviso impersonal. Cuidá también el horario del envío: un mensaje a la noche, cuando la gente revisa el teléfono con calma, rinde distinto a uno en plena jornada laboral. Si el grupo es grande, considerá que el primer mensaje puede quedar sepultado rápido, así que un recordatorio prudente días después, sin saturar, recupera a quienes no lo vieron. La clave es respetar a la comunidad: pocos mensajes, claros y bien pensados, generan más ventas y mejor imagen que una catarata de avisos repetidos que la gente termina ignorando o, peor, silenciando."
      ),
      h2("Redes sociales y QR"),
      p(
        "Las redes sociales amplían el alcance más allá de los grupos cerrados, captando a participantes que no están en ningún chat del evento. Una publicación con una buena imagen del evento y el link invita a un público amplio a encontrar sus fotos. Para eventos abiertos, las redes son un complemento potente de WhatsApp."
      ),
      p(
        "El código QR es una herramienta excelente para captar a la gente en caliente, durante o justo al terminar el evento. Un QR bien visible en la zona de llegada, en pantallas o en material impreso permite que el participante acceda a la landing en el momento de máxima emoción, cuando más ganas tiene de ver sus fotos."
      ),
      p(
        "Combiná canales según el evento: el QR en el lugar para el momento, las redes para el alcance amplio y WhatsApp para la difusión dirigida a la comunidad. Cada canal capta a un tipo de participante distinto, y usarlos en conjunto maximiza la cantidad de gente que termina llegando a tu landing."
      ),
      h2("Email a participantes"),
      p(
        "Cuando el evento tiene una base de inscriptos con sus correos, el email es un canal muy efectivo y directo. A diferencia de un grupo de WhatsApp, llega de forma personal a cada participante y permite un mensaje algo más completo, con la información del evento y el link a la landing bien destacado."
      ),
      p(
        "El email funciona especialmente bien en eventos con inscripción formal, como maratones o torneos organizados, donde ya tenés los datos de contacto. Aprovechar esa base para avisar que las fotos están disponibles es una de las formas más rentables de difusión, porque le hablás directo a quien participó."
      ),
      p(
        "Cuidá que el email sea claro y con el link visible, sin perderse entre otra información. El objetivo es el mismo que en WhatsApp: que la persona entienda en segundos que sus fotos están listas y haga clic. Respetá siempre las preferencias de contacto de los participantes al usar este canal."
      ),
      p(
        "El email permite además un nivel de detalle que en WhatsApp resultaría excesivo: podés incluir una imagen destacada del evento, instrucciones claras de cómo buscarse y, si corresponde, la fecha hasta la que estarán disponibles las fotos. Aprovechá ese espacio para responder de antemano las dudas más frecuentes y reducir las consultas posteriores. Cuidá que el asunto sea atractivo y directo, porque de él depende que el correo se abra o quede sin leer entre decenas de otros mensajes. Un asunto que mencione el evento por su nombre y anticipe que las fotos ya están listas suele tener buena apertura. Y como en todo canal, el momento importa: enviar el email mientras el recuerdo del evento sigue fresco multiplica las chances de conversión frente a hacerlo cuando el entusiasmo ya se enfrió y la jornada quedó atrás en la memoria de los participantes."
      ),
      h2("Momento ideal para compartir"),
      p(
        "El timing es uno de los factores que más impacta en las ventas. El interés por las propias fotos es altísimo justo después del evento y se enfría rápido con el paso de los días. Difundir apenas las fotos están publicadas, mientras la emoción está fresca, rinde mucho más que esperar."
      ),
      p(
        "Coordiná con los fotógrafos para que la publicación del material sea rápida y poder difundir cuanto antes. De nada sirve un buen plan de comunicación si las fotos tardan una semana en aparecer: para entonces, buena parte del entusiasmo —y de las ventas potenciales— ya se perdió. La velocidad es una ventaja competitiva."
      ),
      p(
        "Pensá también en una segunda ola de difusión antes de que cierre el plazo de venta, si lo hay. Un recordatorio bien timeado recupera a quienes lo dejaron pendiente. La combinación de un anuncio inmediato y un recordatorio antes del cierre suele capturar la mayor parte de las ventas posibles del evento."
      ),
      h2("Medir resultados"),
      p(
        "Difundir sin medir es avanzar a ciegas. Seguí desde tu panel cómo evolucionan las ventas del evento tras cada acción de difusión, para entender qué canales y mensajes funcionan mejor con tu público. Esos datos son la materia prima para mejorar la comunicación de tus próximos eventos."
      ),
      p(
        "Observá patrones: si las ventas se disparan después del mensaje de WhatsApp pero el email rinde poco, o si el QR del lugar trajo muchos compradores en caliente. Cada evento te enseña algo sobre cómo se comporta tu audiencia, y aplicar esos aprendizajes hace que cada difusión sea más efectiva que la anterior."
      ),
      p(
        "Con el tiempo, vas a construir un manual propio de qué funciona para tus eventos: qué canales, qué mensajes, qué timing. Esa experiencia acumulada es uno de los activos más valiosos de un organizador, porque convierte la difusión de algo intuitivo en una práctica afinada que maximiza el retorno de cada cobertura."
      ),
      h3("Errores frecuentes al difundir el link"),
      p(
        "El error más costoso es difundir tarde. El interés por las propias fotos es altísimo justo después del evento y se enfría rápido con el paso de los días; esperar una semana para compartir el link significa perder buena parte de las ventas posibles. Coordiná con los fotógrafos para que el material suba pronto y difundí apenas esté disponible. La velocidad no es un detalle: es probablemente el factor que más diferencia a un evento que vende mucho de uno que vende poco con la misma cobertura."
      ),
      p(
        "Otro tropiezo habitual es enviar mensajes largos y confusos que nadie lee. La gente decide en segundos si hace clic, así que un texto breve, claro y orientado a la acción —qué evento es, que ya están las fotos, el link y cómo buscarse— convierte mucho mejor que un párrafo cargado de detalles. Si necesitás dar más información, dejala en la landing, no en el mensaje. El objetivo de cada comunicación es lograr el clic, y la simplicidad es la mejor aliada para conseguirlo."
      ),
      p(
        "Subestimar los canales también es un error. Concentrar todo en un solo grupo de WhatsApp deja afuera a quienes no están ahí. Combinar canales —WhatsApp para la comunidad, redes para el alcance amplio, un QR en el lugar para captar en caliente y email cuando tenés la base de inscriptos— multiplica la cantidad de participantes que llegan a la landing. Cada canal capta a un público distinto, y desaprovechar alguno es dejar ventas sobre la mesa sin necesidad."
      ),
      p(
        "Por último, difundir una sola vez y olvidarse desperdicia potencial. Muchas personas tienen la intención de comprar pero postergan, y un recordatorio bien timeado antes del cierre del plazo recupera una porción importante de esas ventas. Planificá al menos dos olas de comunicación: el anuncio inicial inmediato y un recordatorio antes de que la galería deje de estar disponible. Sostener la difusión a lo largo del período de venta, sin saturar, es lo que exprime al máximo el potencial de cada evento."
      ),
    ],
    faq: [
      {
        q: "¿Tengo un link por fotógrafo o uno solo?",
        a: "Uno solo. La landing del evento concentra todas las galerías vinculadas, así que difundís un único link en lugar de repartir el enlace de cada fotógrafo por separado.",
      },
      {
        q: "¿Qué canal conviene para difundir?",
        a: "Combiná varios: WhatsApp para la comunidad del evento, redes para alcance amplio, QR en el lugar para captar en caliente y email cuando tenés la base de inscriptos. Cada uno capta un público distinto.",
      },
      {
        q: "¿Cómo debe ser el mensaje de WhatsApp?",
        a: "Corto, claro y orientado a la acción: qué evento es, que ya están las fotos, el link y una pista de cómo buscarse. Evitá textos largos; la gente decide en segundos.",
      },
      {
        q: "¿Cuándo conviene compartir el link?",
        a: "Apenas las fotos están publicadas, mientras la emoción está fresca. El interés se enfría rápido, así que coordiná con los fotógrafos para publicar y difundir cuanto antes.",
      },
      {
        q: "¿Cómo sé si mi difusión funciona?",
        a: "Seguí la evolución de las ventas en tu panel tras cada acción de difusión. Identificar qué canales y mensajes rinden mejor te permite afinar la comunicación de tus próximos eventos.",
      },
    ],
    conclusion:
      "Compartir el link de tu evento es el puente entre la cobertura y las ventas. Aprovechá que tenés una landing única, combiná WhatsApp, redes, QR y email, y difundí rápido mientras la emoción está fresca. Medí los resultados de cada acción para construir tu propio manual de difusión: con timing y mensajes afinados, cada evento convierte mejor que el anterior.",
    ctaAudience: resolveCtaAudience(["organizadores"]),
    imageScene:
      "Organizer sharing event QR code on phone with marathon runners at finish area, hyperrealistic documentary photography style",
    imageAltSubject:
      "Organizador mostrando el código QR de la landing del evento a corredores en la llegada",
    imageCaption: "Un único link y el QR en el lugar acercan a los participantes en caliente.",
  },

  "como-crear-galeria-escolar": {
    seoTitle: "Cómo crear una galería escolar en ComprameLaFoto",
    seoDescription:
      "Armá una galería escolar con privacidad, preventa y venta a familias: estructura del proyecto, cursos y divisiones, consentimiento y publicación paso a paso.",
    excerpt:
      "Pasos para armar una galería escolar con privacidad, preventa y venta a familias.",
    blocks: [
      p(
        "La fotografía escolar tiene reglas propias: trabajás con menores, con instituciones y con familias que esperan un cuidado especial en cómo se manejan las imágenes. Crear una galería escolar no es solo subir fotos, sino diseñar un proyecto donde la privacidad, la organización por curso y la comunicación con los padres están pensadas desde el inicio. Hacerlo bien protege a los chicos, le da tranquilidad a la institución y te permite vender de forma profesional. En esta guía recorremos la estructura de un proyecto escolar, cómo crear el álbum institucional, cómo organizar cursos y divisiones, cómo manejar la privacidad y el consentimiento, cómo armar la preventa y cómo publicar a las familias."
      ),
      h2("Estructura de un proyecto escolar"),
      p(
        "Un proyecto escolar suele ser más grande y ordenado que un álbum común. Antes de sacar una foto, conviene tener claro el alcance: qué cursos se fotografían, qué tipo de tomas —grupales, individuales, de jornada—, y cómo se va a entregar y cobrar. Esa planificación inicial evita el descontrol cuando aparecen cientos de chicos y familias."
      ),
      p(
        "Pensá la estructura en función de cómo las familias van a buscar sus fotos. Lo natural es organizar por curso y división, de modo que cada familia entre directo a lo suyo sin recorrer fotos de toda la escuela. Esta lógica de organización es la columna vertebral de un proyecto escolar bien armado."
      ),
      p(
        "Coordiná desde el inicio con la institución el encuadre del proyecto: fechas, cursos, autorizaciones y forma de comunicación con los padres. La escuela es tu socio en este trabajo, y un proyecto acordado con ella desde el principio fluye mucho mejor que uno improvisado, además de generar la confianza necesaria para que las familias compren."
      ),
      h2("Crear el álbum institucional"),
      p(
        "Dentro de ComprameLaFoto, armá el álbum o la estructura que contendrá el proyecto escolar. A diferencia de un evento deportivo abierto, acá la privacidad es prioridad desde la creación, así que configurá el acceso pensando en que solo lleguen las familias correspondientes, no el público general."
      ),
      p(
        "Ponele al álbum un nombre claro que identifique a la institución y el período —por ejemplo, el colegio y el año— para que tanto vos como las familias reconozcan de qué proyecto se trata. La prolijidad en la identificación es parte del cuidado profesional que las escuelas y los padres valoran."
      ),
      p(
        "Cargá las fotos ya editadas y revisadas, prestando especial atención a que cada imagen corresponda al curso correcto. En un proyecto escolar, una foto mal ubicada no es solo un error de orden: puede exponer a un chico en un lugar equivocado o confundir a una familia. La precisión en la carga es esencial."
      ),
      p(
        "Conviene definir desde la creación las condiciones generales del proyecto para no tener que configurarlas curso por curso más adelante. Pensá qué vas a ofrecer —fotos digitales, impresiones, carpetas o combos—, qué precios y si habrá preventa, y dejalo establecido a nivel institucional. Esa coherencia hace que todas las familias del colegio vivan la misma experiencia de compra, sin diferencias confusas entre un grado y otro. Aprovechá también para acordar con la escuela qué identifica oficialmente al proyecto, de modo que las familias reconozcan sin dudar que es la galería avalada por la institución y no un enlace cualquiera. Cuanto más sólida y clara sea esta base inicial, más simple será sumar cursos y divisiones a medida que avanzás con la edición, porque cada grupo se apoya sobre una estructura que ya tiene resueltas las decisiones de fondo."
      ),
      h2("Cursos y divisiones"),
      p(
        "Organizar por cursos y divisiones es lo que hace navegable una galería escolar. Cada familia debería poder llegar a las fotos de su curso sin tener que mirar las de los demás, tanto por comodidad como por privacidad. Esta segmentación es una de las características que distingue un proyecto escolar de un álbum genérico."
      ),
      p(
        "Definí una nomenclatura clara y consistente para los cursos —sala, grado, año, división— acorde a cómo los nombra la propia escuela. Usar los mismos términos que la institución y las familias evita confusiones y hace que cada padre identifique de inmediato dónde están las fotos de su hijo."
      ),
      p(
        "Revisá que cada foto esté en el curso que corresponde antes de publicar. Este chequeo es doblemente importante en el ámbito escolar: además de ordenar la venta, protege la privacidad al asegurar que las imágenes de cada grupo solo sean accesibles para las familias de ese grupo, según la configuración del proyecto."
      ),
      h2("Privacidad y consentimiento"),
      p(
        "La privacidad es el corazón de la fotografía escolar. Al trabajar con menores, el acceso a las imágenes debe estar restringido a quienes corresponde, y la cobertura y la venta deben contar con las autorizaciones adecuadas de la institución y de las familias. Este cuidado no es opcional: es la base ética y de confianza de todo el proyecto."
      ),
      p(
        "Coordiná con la escuela el tema de los consentimientos, ya que es la institución la que suele gestionar la relación con las familias y las autorizaciones de imagen de los menores. Asegurate de que el marco esté claro antes de publicar, para que ninguna foto se exponga sin la conformidad correspondiente."
      ),
      p(
        "Tené prevista la posibilidad de que una familia no quiera que su hijo aparezca publicado. ComprameLaFoto contempla canales para solicitar la baja de una imagen cuando una persona no desea figurar, y en el contexto escolar esa sensibilidad es especialmente importante. Manejar estos pedidos con rapidez y respeto refuerza la confianza de toda la comunidad."
      ),
      p(
        "Trasladá ese cuidado a la forma en que mostrás las imágenes mientras dura la venta. Las vistas previas con marca de agua cumplen un rol clave en el ámbito escolar, porque permiten que las familias elijan sin que circulen archivos en alta calidad fuera de control. El material final, limpio y en buena resolución, se entrega únicamente tras la compra y a quien corresponde. Conversá con la institución, además, sobre qué hacer con las fotos una vez cerrado el período de venta: muchas escuelas prefieren que el material deje de estar accesible pasado cierto tiempo, una decisión razonable cuando se trata de menores. Tener previstos estos detalles desde el inicio, y dejarlos por escrito si hace falta, evita malentendidos y demuestra que la protección de los chicos está por encima de cualquier conveniencia comercial del proyecto."
      ),
      h2("Preventa escolar"),
      p(
        "La preventa es una herramienta muy potente en el ámbito escolar. En lugar de imprimir carpetas para todos sin saber quién las quiere, cobrás por adelantado y producís solo lo vendido. Esto reduce el riesgo, mejora tu flujo de caja y le da a las familias un precio anticipado que premia decidirse temprano."
      ),
      p(
        "Para que funcione, definí plazos claros de cierre y de entrega, y comunicalos junto con la institución. Las familias planifican alrededor de fechas concretas del calendario escolar, así que cumplir lo prometido en tiempo y forma es decisivo para tu reputación y para el éxito de futuras campañas en esa escuela."
      ),
      p(
        "Coordiná la difusión de la preventa con la escuela para que el mensaje llegue con respaldo institucional. Un comunicado avalado por el colegio convierte mucho mejor que un link suelto, porque despeja las dudas naturales que genera pagar por adelantado y le da a las familias la seguridad de que el proyecto es serio."
      ),
      h2("Publicación a familias"),
      p(
        "Cuando todo está listo —fotos organizadas, privacidad configurada, precios definidos— publicá la galería para las familias. La publicación en el ámbito escolar es un acto de cuidado: asegurate de que solo las familias correspondientes accedan a las fotos de su curso, según el esquema de privacidad acordado."
      ),
      p(
        "Comunicá la publicación a través de los canales acordados con la institución, con instrucciones claras de cómo cada familia accede a las fotos de su hijo. Cuanto más simple sea el camino —entrar al link, buscar el curso, ver las fotos— menos consultas vas a recibir y más fluida será la venta."
      ),
      p(
        "Acompañá a las familias durante el período de venta, resolviendo dudas y manteniendo la galería ordenada. Un proyecto escolar bien gestionado de punta a punta —desde la planificación hasta el soporte post-publicación— deja a la comunidad satisfecha y te abre la puerta a repetir el trabajo año tras año en esa institución."
      ),
      h3("Fidelizar a la institución para el año siguiente"),
      p(
        "La fotografía escolar tiene una ventaja enorme frente a otros rubros: la recurrencia. Una escuela realiza eventos y necesita fotos año tras año, así que ganarte la confianza de una institución puede significar un cliente estable por varias temporadas. Por eso, cada proyecto escolar conviene pensarlo no como un trabajo aislado, sino como el primer paso de una relación de largo plazo. La forma en que manejás esta cobertura determina, en buena medida, si te vuelven a llamar el año que viene o si buscan a otro."
      ),
      p(
        "La confianza institucional se construye con profesionalismo en cada detalle. Una galería ordenada por curso, un cuidado escrupuloso de la privacidad de los menores, una comunicación clara y respaldada por la escuela y el cumplimiento de los plazos prometidos hacen que la institución te perciba como un socio confiable. Las escuelas valoran la tranquilidad: si tu trabajo les evita problemas con las familias y se desarrolla sin sobresaltos, te van a preferir frente a cualquier alternativa que les genere incertidumbre o reclamos."
      ),
      p(
        "Cuidá especialmente la experiencia de las familias, porque su satisfacción llega a oídos de la escuela. Si los padres acceden fácil a las fotos, encuentran a sus hijos sin esfuerzo y compran sin inconvenientes, esa buena impresión refuerza la decisión de la institución de seguir trabajando con vos. En cambio, una catarata de quejas de familias por una galería confusa o un proceso engorroso pone en riesgo la continuidad, por más que a vos te haya parecido que el trabajo fotográfico salió bien."
      ),
      p(
        "Mantené el vínculo abierto entre proyectos. Un cierre prolijo del trabajo, un agradecimiento a la institución y la disposición a planificar con tiempo la cobertura del año siguiente dejan la puerta abierta para repetir. Las escuelas planifican su calendario con anticipación, así que estar presente en el momento en que definen quién hará las fotos es clave. Una relación cuidada convierte un proyecto puntual en una fuente de ingresos recurrente que se renueva temporada tras temporada con cada vez menos esfuerzo de captación."
      ),
    ],
    faq: [
      {
        q: "¿Qué diferencia a una galería escolar de un álbum común?",
        a: "El cuidado de la privacidad de menores, la organización por curso y división y la comunicación coordinada con la institución y las familias. Es un proyecto pensado para proteger a los chicos y vender de forma ordenada.",
      },
      {
        q: "¿Cómo organizo las fotos para que las familias se encuentren?",
        a: "Por curso y división, con una nomenclatura clara acorde a cómo los nombra la escuela. Así cada familia entra directo a lo suyo sin recorrer fotos de toda la institución, lo que también cuida la privacidad.",
      },
      {
        q: "¿Quién gestiona los consentimientos de los menores?",
        a: "Conviene coordinarlo con la institución, que suele manejar la relación con las familias y las autorizaciones de imagen. Asegurate de que el marco esté claro antes de publicar cualquier foto.",
      },
      {
        q: "¿Por qué usar preventa en el ámbito escolar?",
        a: "Porque te permite cobrar antes y producir solo lo vendido, reduciendo el riesgo de imprimir carpetas que nadie compra. Definí plazos claros y difundí con respaldo de la institución.",
      },
      {
        q: "¿Qué pasa si una familia no quiere que su hijo aparezca?",
        a: "La plataforma contempla canales para solicitar la baja de una imagen cuando una persona no desea figurar. En el contexto escolar conviene manejar estos pedidos con especial rapidez y respeto.",
      },
    ],
    conclusion:
      "Crear una galería escolar es diseñar un proyecto donde la privacidad de los menores, la organización por curso y la comunicación con la institución vienen primero. Si planificás con la escuela, cuidás los consentimientos, usás la preventa para producir sobre demanda y publicás con acceso restringido, vas a vender de forma profesional y a ganarte la confianza de una comunidad que te volverá a contratar.",
    ctaAudience: resolveCtaAudience(["fotografos", "escuelas"]),
    imageScene:
      "School photographer organizing class group photos in elementary school courtyard, hyperrealistic documentary photography style",
    imageAltSubject:
      "Fotógrafo escolar organizando las fotos de los cursos en el patio de un colegio",
    imageCaption: "La organización por curso y el cuidado de la privacidad son la base del proyecto escolar.",
  },

  "como-compartir-fotografias-con-padres": {
    seoTitle: "Cómo compartir fotografías escolares con los padres",
    seoDescription:
      "Canales y buenas prácticas para que las familias accedan y compren las fotos escolares: link privado, comunicación con la institución y búsqueda por curso.",
    excerpt:
      "Canales y buenas prácticas para que las familias accedan y compren las fotos escolares.",
    blocks: [
      p(
        "Tener una galería escolar bien armada es solo la mitad del trabajo; la otra mitad es lograr que las familias accedan a ella de forma simple y segura. Compartir correctamente las fotos con los padres reduce las consultas, acelera las ventas y mantiene el cuidado de la privacidad que el ámbito escolar exige. No se trata de difundir masivamente como en un evento abierto, sino de hacer llegar el acceso a las familias correctas por los canales adecuados. En esta guía vemos cómo usar el link privado de la galería, cómo coordinar con la institución, qué mensajes funcionan en los grupos de padres, cómo facilitar la búsqueda por curso o alumno, cómo manejar los plazos de venta y cómo dar soporte a las familias."
      ),
      h2("Link privado de la galería"),
      p(
        "En el ámbito escolar, el acceso a las fotos debe estar restringido a las familias correspondientes, no abierto al público. El link privado de la galería es la herramienta que permite eso: solo quienes lo reciben pueden ver las fotos, lo que protege la privacidad de los menores mientras habilita la compra a quien corresponde."
      ),
      p(
        "A diferencia de un evento deportivo donde buscás máxima difusión, acá la lógica es la inversa: querés que el acceso sea acotado y controlado. Esa restricción no es un obstáculo para la venta, sino una condición de confianza: las familias compran tranquilas sabiendo que las fotos de sus hijos no están expuestas a cualquiera."
      ),
      p(
        "Manejá el link con cuidado y compartilo solo por los canales acordados con la institución. Evitá publicarlo en lugares abiertos donde pueda circular más allá de la comunidad escolar. El control sobre quién accede es parte central de tu responsabilidad profesional en este tipo de proyectos."
      ),
      h2("Comunicación con la institución"),
      p(
        "La escuela es tu aliada clave para llegar a las familias. Coordinar la comunicación con la institución le da respaldo a tu mensaje y multiplica la confianza de los padres: un aviso que viene avalado por el colegio se toma en serio, mientras que un link suelto genera dudas y desconfianza."
      ),
      p(
        "Acordá con la institución cómo y cuándo se comunicará la disponibilidad de las fotos a las familias. Puede ser a través de los canales oficiales del colegio, de los grupos de cada curso o de una combinación. Respetar los circuitos de comunicación de la escuela hace que el mensaje llegue de forma ordenada y creíble."
      ),
      p(
        "Mantené a la institución informada durante todo el proceso de venta. Una escuela que sabe qué está pasando con el proyecto fotográfico puede ayudarte a resolver dudas, reforzar la comunicación y avalar la seriedad del trabajo. Esa relación cuidada es la que te abre la puerta a repetir en años siguientes."
      ),
      p(
        "Facilitale el trabajo a la escuela entregándole un texto breve y listo para reenviar, en lugar de pedirle que redacte la comunicación desde cero. Cuanto más sencillo le resulte difundir, más rápido y mejor llega el mensaje a las familias. Incluí en ese texto lo esencial —que las fotos ya están disponibles, cómo acceder y hasta cuándo— y dejá los detalles más extensos para la propia galería. Acordá también quién responde las consultas que surjan: si las maneja la institución, si te las derivan a vos o si hay un canal directo para las familias. Definir ese circuito de antemano evita que la escuela quede en el medio sin saber qué contestar y que los padres no sepan a quién recurrir. Una comunicación coordinada y prolija, en la que cada parte sabe qué le toca, es la que sostiene la confianza de toda la comunidad escolar."
      ),
      h2("Mensajes para grupos de padres"),
      p(
        "Los grupos de padres de cada curso son el canal natural para hacer llegar el acceso de forma dirigida. Un mensaje claro que explique qué fotos están disponibles, cómo acceder y cómo buscar las del propio hijo facilita que cada familia llegue a lo suyo sin confusión ni consultas innecesarias."
      ),
      p(
        "Adaptá el mensaje al tono de la comunidad escolar: cordial, claro y respetuoso. No es una venta agresiva de evento masivo, sino una comunicación a familias que confían en la escuela y en vos. Un mensaje bien redactado transmite la seriedad del proyecto y predispone a la compra sin presionar."
      ),
      p(
        "Incluí instrucciones concretas de cómo encontrar las fotos del curso correcto, porque eso es lo que más dudas genera. Cuanto más simple y guiado sea el camino que describís, menos mensajes de «no encuentro las fotos de mi hijo» vas a recibir, y más rápido se concretan las ventas."
      ),
      h2("Búsqueda por curso o alumno"),
      p(
        "La organización por curso y división es lo que hace que cada familia encuentre rápido las fotos de su hijo. Cuando la galería está bien estructurada, el padre entra, va directo a la sala o el grado correspondiente y ve solo lo relevante, sin perderse entre las fotos de toda la escuela."
      ),
      p(
        "Esta facilidad de búsqueda no es solo comodidad: es también privacidad y eficiencia de venta. Una familia que encuentra rápido lo suyo compra con más facilidad, mientras que una que se frustra navegando puede abandonar. La estructura por curso convierte la búsqueda en un paso simple en lugar de un obstáculo."
      ),
      p(
        "En proyectos donde corresponda, las herramientas de búsqueda pueden afinar aún más el acceso a las fotos de cada alumno. Aprovechar estas funciones, dentro del marco de privacidad acordado, hace que la experiencia de la familia sea todavía más directa y reduce al mínimo el tiempo entre entrar y encontrar."
      ),
      p(
        "Anticipá en tus instrucciones las dudas más frecuentes sobre la búsqueda, porque son las que más mensajes generan. Aclarar con un ejemplo concreto cómo llegar al curso correcto —entrar al link, elegir el nivel, después la división— le ahorra a muchas familias el desconcierto inicial, sobre todo a quienes no están habituadas a comprar fotos online. Recordá que en una misma escuela puede haber familias con más de un hijo, así que conviene explicarles que deben repetir el recorrido para cada curso. Y si hay fotos grupales además de las individuales, indicá dónde encontrar cada tipo para que nadie crea que falta material. Cuanto más guiado y previsible sea el camino que describís, menos consultas del estilo «no encuentro las fotos de mi hijo» vas a recibir, y más fluida y rápida será la venta para todos."
      ),
      h2("Plazos de venta"),
      p(
        "Comunicar un plazo claro de venta ayuda a que las familias se decidan en lugar de postergar indefinidamente. En el ámbito escolar, donde las fechas del calendario marcan el ritmo, indicar hasta cuándo estarán disponibles las fotos genera una urgencia sana que impulsa la compra."
      ),
      p(
        "Sé honesto y consistente con los plazos que comunicás. Si decís que las fotos están hasta cierta fecha, respetalo, porque las familias planifican en función de eso. Cambiar las reglas sobre la marcha genera desconfianza y reclamos, justo lo contrario de lo que buscás en una comunidad escolar."
      ),
      p(
        "Un recordatorio cuando se acerca el cierre recupera a quienes lo dejaron pendiente. Coordinado con la institución, ese aviso final suele capturar una parte importante de las ventas de familias que tenían intención de comprar pero se les había pasado. El timing del recordatorio es tan importante como el del aviso inicial."
      ),
      h2("Soporte a familias"),
      p(
        "Durante el período de venta, vas a recibir consultas de familias: cómo acceder, cómo pagar, cómo descargar. Dar un soporte claro y amable es parte del servicio y de la imagen profesional del proyecto. Una familia bien atendida no solo compra, sino que habla bien del trabajo en la comunidad."
      ),
      p(
        "Anticipá las dudas más comunes y resolvelas de antemano en tus mensajes: cómo encontrar el curso, cómo se paga con Mercado Pago, cómo se reciben las fotos. Cuanto más despejes por adelantado, menos consultas individuales vas a tener que responder y más fluida será la experiencia para todos."
      ),
      p(
        "Coordiná con la institución cómo se canalizan las consultas para que las familias sepan a quién recurrir. Un circuito de soporte claro evita que los padres no sepan dónde preguntar y que la escuela quede en el medio sin respuestas. La prolijidad en el soporte cierra un proyecto escolar de forma profesional."
      ),
      h3("Manejar el cierre del período de venta"),
      p(
        "Todo proyecto escolar tiene un momento de cierre, y manejarlo bien es tan importante como la apertura. Comunicar con claridad hasta cuándo estarán disponibles las fotos le da a las familias una referencia concreta para decidirse y evita que la galería quede abierta indefinidamente sin generar nuevas ventas. En el ámbito escolar, donde las fechas del calendario marcan el ritmo, un plazo bien comunicado y coordinado con la institución genera la urgencia sana que muchas familias necesitan para concretar la compra que venían postergando."
      ),
      p(
        "El recordatorio previo al cierre es una de las herramientas más efectivas. Una parte importante de las familias tiene la intención de comprar pero deja pasar el tiempo, y un aviso oportuno cuando se acerca la fecha límite recupera muchas de esas ventas. Coordinado con la escuela para que llegue con respaldo, ese recordatorio final suele provocar un último envión de compras de quienes no querían quedarse sin las fotos de sus hijos pero lo tenían pendiente entre otras tantas tareas del día a día."
      ),
      p(
        "Sé honesto y consistente con el plazo que comunicaste. Si dijiste que las fotos están hasta cierta fecha, respetalo, porque las familias planifican en función de eso y cambiar las reglas sobre la marcha genera desconfianza en toda la comunidad. La coherencia entre lo que prometés y lo que cumplís es la base de tu reputación escolar, y un cierre manejado con seriedad refuerza la imagen profesional que te abre la puerta a trabajar nuevamente con esa institución."
      ),
      p(
        "Después del cierre, podés evaluar si conviene reabrir por un tiempo acotado para quienes quedaron afuera. Algunas familias siempre se enteran tarde, y una ventana adicional —comunicada con claridad— puede capturar esas ventas rezagadas sin desvirtuar el plazo original. Cerrá también de forma ordenada en tu panel, archivando el proyecto una vez que cumplió su ciclo. Un cierre prolijo, que atiende incluso a los rezagados, redondea una experiencia profesional que las familias y la escuela van a recordar positivamente."
      ),
    ],
    faq: [
      {
        q: "¿Por qué usar un link privado en lugar de difundir abierto?",
        a: "Porque en el ámbito escolar el acceso debe restringirse a las familias correspondientes para proteger la privacidad de los menores. El link privado habilita la compra solo a quien lo recibe.",
      },
      {
        q: "¿Cómo hago para que las familias confíen en el mensaje?",
        a: "Coordinando la comunicación con la institución. Un aviso avalado por el colegio genera mucha más confianza que un link suelto, y se transmite por los circuitos oficiales o los grupos de cada curso.",
      },
      {
        q: "¿Cómo facilito que cada padre encuentre a su hijo?",
        a: "Organizando la galería por curso y división con nomenclatura clara, e incluyendo instrucciones concretas en el mensaje. Una buena estructura hace que la familia vaya directo a lo suyo.",
      },
      {
        q: "¿Conviene poner un plazo de venta?",
        a: "Sí. Un plazo claro genera una urgencia sana que ayuda a decidir. Sé honesto y consistente con la fecha, y enviá un recordatorio antes del cierre para recuperar a quienes lo dejaron pendiente.",
      },
      {
        q: "¿Cómo manejo las consultas de las familias?",
        a: "Anticipando las dudas más comunes en tus mensajes y coordinando con la institución un circuito claro de soporte, para que las familias sepan a quién recurrir y la experiencia sea fluida.",
      },
    ],
    conclusion:
      "Compartir las fotos escolares con los padres es un ejercicio de cuidado y coordinación: link privado para proteger a los menores, comunicación avalada por la institución, búsqueda simple por curso, plazos honestos y buen soporte. Cuando las familias acceden fácil y con confianza, las ventas fluyen y tu reputación crece, abriéndote la puerta a repetir el proyecto cada año en esa escuela.",
    ctaAudience: resolveCtaAudience(["fotografos", "escuelas"]),
    imageScene:
      "Parents viewing school photos on phone while picking up children at school gate, hyperrealistic documentary photography style",
    imageAltSubject:
      "Familias accediendo a las fotos escolares desde el celular en la puerta del colegio",
    imageCaption: "Un acceso simple y privado por curso facilita la compra de las familias.",
  },

  "como-funciona-privacidad-fotografias-escolares": {
    seoTitle: "Privacidad de las fotografías escolares en ComprameLaFoto",
    seoDescription:
      "Políticas de privacidad, acceso restringido y buenas prácticas para fotografía escolar en Argentina: datos de menores, marcas de agua y solicitudes de baja.",
    excerpt:
      "Políticas de privacidad, acceso restringido y buenas prácticas para fotografía escolar en Argentina.",
    blocks: [
      p(
        "La privacidad es el tema más sensible de la fotografía escolar y, bien manejada, es también una ventaja competitiva: las familias compran con tranquilidad cuando confían en que las imágenes de sus hijos están cuidadas. Entender cómo funciona la privacidad en ComprameLaFoto —qué principios la guían, cómo se controla el acceso, cómo se tratan los datos de menores, qué rol juegan las marcas de agua y cómo se gestionan los pedidos de baja— es esencial para cualquier fotógrafo, escuela o familia involucrada en un proyecto escolar. En esta guía recorremos esos aspectos para que el trabajo con menores se haga con el resguardo que corresponde y dentro de un marco de confianza."
      ),
      h2("Principios de privacidad en CLF"),
      p(
        "El punto de partida es que las imágenes de menores requieren un cuidado especial. ComprameLaFoto está pensada para que el fotógrafo controle quién accede a cada galería, lo que en el contexto escolar significa restringir el acceso a las familias correspondientes en lugar de exponer las fotos al público general."
      ),
      p(
        "La privacidad no es un agregado opcional, sino un principio que atraviesa todo el proyecto escolar, desde la cobertura hasta la venta. Cada decisión —cómo se organiza la galería, quién recibe el link, qué se publica— debe tomarse con la pregunta de fondo de cómo se protege a los chicos fotografiados."
      ),
      p(
        "Este enfoque beneficia a todos: protege a los menores, le da respaldo a la institución y genera la confianza que las familias necesitan para comprar. Lejos de ser una traba comercial, el cuidado de la privacidad es lo que hace viable y sostenible el negocio de la fotografía escolar a lo largo del tiempo."
      ),
      h2("Acceso a galerías"),
      p(
        "El control de acceso es la herramienta concreta que materializa la privacidad. En lugar de una galería pública abierta a cualquiera, los proyectos escolares se configuran para que solo quienes tengan el acceso correspondiente puedan ver las fotos, manteniéndolas fuera del alcance del público general."
      ),
      p(
        "Organizar las fotos por curso y división refuerza este control: idealmente, cada familia accede a lo de su grupo y no a las imágenes de toda la escuela. Esta segmentación combina comodidad de búsqueda con un nivel adicional de resguardo, ya que limita la exposición de cada chico a su propia comunidad de curso."
      ),
      p(
        "Manejar los links de acceso con responsabilidad es parte del trabajo. Compartirlos solo por los canales acordados con la institución y evitar su publicación en espacios abiertos garantiza que el control de acceso configurado en la plataforma se sostenga también en la práctica de difusión."
      ),
      p(
        "Pensá el control de acceso como una cadena que es tan fuerte como su eslabón más débil. De nada sirve una galería configurada con todo el rigor si después el enlace se publica en una red social abierta o circula en un grupo que excede a la comunidad escolar. Por eso el cuidado técnico que ofrece la plataforma debe ir acompañado de un cuidado equivalente en cómo y por dónde compartís el acceso. Coordiná con la institución los canales oficiales de difusión y resistí la tentación de ampliar el alcance para vender más: en fotografía de menores, la prudencia siempre vale más que un puñado de ventas extra. Una familia que percibe que las fotos de su hijo están realmente resguardadas compra con tranquilidad, y esa confianza es, a la larga, el activo más valioso de cualquier proyecto escolar serio."
      ),
      h2("Datos de menores"),
      p(
        "Trabajar con datos e imágenes de menores implica una responsabilidad mayor que cualquier otro tipo de fotografía. Las autorizaciones de imagen, gestionadas habitualmente a través de la institución, son la base que habilita tanto la cobertura como la venta, y deben estar resueltas antes de exponer cualquier foto."
      ),
      p(
        "La coordinación con la escuela es clave en este punto, porque es la institución la que mantiene la relación con las familias y suele administrar los consentimientos. Un proyecto donde el marco de autorizaciones está claro desde el inicio protege a todas las partes y evita situaciones incómodas una vez publicadas las fotos."
      ),
      p(
        "Tratá la información de los chicos con discreción y solo para los fines del proyecto. La minimización —usar lo necesario y nada más— y el cuidado en cómo se identifican los cursos o alumnos son prácticas que refuerzan el respeto por la privacidad de los menores y la confianza de las familias en tu trabajo."
      ),
      h2("Marcas de agua y vistas previas"),
      p(
        "Mientras las familias navegan la galería antes de comprar, las fotos se muestran con marca de agua y en resolución de vista previa. Esto cumple dos funciones: protege tu trabajo de descargas no autorizadas y, en el contexto escolar, agrega una capa de resguardo sobre las imágenes que aún no fueron adquiridas."
      ),
      p(
        "La marca de agua permite que las familias vean y elijan sin que el archivo limpio circule libremente. Solo después del pago se libera la versión final, lo que mantiene el control sobre las imágenes de los menores hasta que efectivamente son compradas por quien corresponde."
      ),
      p(
        "Lejos de ser una molestia, esta protección es lo que permite mostrar las fotos para vender sin renunciar al cuidado. En un ámbito tan sensible como el escolar, la combinación de acceso restringido y vista previa protegida es una garantía valiosa tanto para vos como para las familias."
      ),
      p(
        "Vale la pena explicarles a las familias, cuando comunicás la galería, por qué las fotos se ven con marca de agua antes de la compra. Muchas personas no están familiarizadas con este modelo y, sin una aclaración, podrían pensar que el archivo que recibirán también tendrá esa marca. Anticipar que la versión final llega limpia y en buena resolución tras el pago despeja esa duda y predispone a comprar con confianza. En el contexto escolar, esa transparencia suma un mensaje implícito de cuidado: muestra que el material no circula libremente y que las imágenes de los chicos están protegidas mientras se eligen. Comunicar con sencillez cómo funciona la protección, en lugar de darla por entendida, es parte de la pedagogía que acompaña a un buen proyecto escolar y refuerza la sensación de seriedad que las familias valoran."
      ),
      h2("Solicitudes de baja de imagen"),
      p(
        "Puede ocurrir que una familia no quiera que su hijo aparezca en una galería, y ese deseo debe respetarse. ComprameLaFoto contempla canales para solicitar la baja de una imagen cuando una persona no desea figurar publicada, algo especialmente relevante cuando se trata de menores."
      ),
      p(
        "Manejar estos pedidos con rapidez y respeto es fundamental. Una solicitud de baja bien atendida transmite a toda la comunidad que el proyecto toma en serio la privacidad, mientras que una demorada o ignorada puede dañar la confianza no solo de esa familia sino de toda la escuela."
      ),
      p(
        "Tener previsto de antemano cómo se canalizan estos pedidos —en coordinación con la institución— evita la improvisación cuando surgen. Un circuito claro para las solicitudes de baja es parte de un proyecto escolar profesional y demuestra que la protección de los menores está por encima de cualquier interés comercial."
      ),
      h2("Recursos y políticas"),
      p(
        "Más allá de las herramientas técnicas, conviene apoyarse en las políticas y recursos disponibles para enmarcar correctamente el trabajo escolar. Conocer cómo la plataforma aborda la privacidad te permite explicárselo a la institución y a las familias, generando la confianza que sostiene el proyecto."
      ),
      p(
        "Las buenas prácticas de privacidad no son solo una obligación, sino un diferencial profesional. El fotógrafo que demuestra cuidado y conocimiento en este terreno se gana la preferencia de escuelas y familias frente a quien trabaja sin esa sensibilidad. La privacidad bien gestionada es parte de tu propuesta de valor."
      ),
      p(
        "Mantenerte actualizado sobre cómo manejar la privacidad en fotografía escolar en Argentina es una inversión en la sostenibilidad de tu negocio. Las familias son cada vez más conscientes del cuidado de la imagen de sus hijos, y responder a esa expectativa con prácticas sólidas es lo que te posiciona como un profesional confiable a largo plazo."
      ),
      h3("Transmitir confianza a las familias"),
      p(
        "La privacidad bien gestionada solo cumple su propósito si las familias la perciben. De nada sirve un esquema de acceso restringido impecable si los padres no entienden que sus hijos están protegidos. Por eso, parte del trabajo es comunicar el cuidado: explicar, en lenguaje simple, que la galería es privada, que solo acceden las familias correspondientes y que las imágenes están resguardadas. Esa comunicación transforma una protección técnica en una tranquilidad concreta que predispone a las familias a comprar sin temores."
      ),
      p(
        "El respaldo de la institución es decisivo para esa confianza. Cuando la comunicación sobre las fotos llega avalada por la escuela, las familias asumen que el proyecto cuenta con las autorizaciones y el cuidado necesarios. Trabajar de forma coordinada y visible con el colegio —en lugar de aparecer como un tercero que pide datos por fuera— es lo que hace que los padres bajen la guardia y participen tranquilos. La escuela es el puente de confianza entre tu trabajo y la comunidad de familias."
      ),
      p(
        "La forma en que respondés a las inquietudes también construye confianza. Si una familia consulta cómo se manejan las fotos de su hijo o pide que una imagen no se publique, una respuesta rápida, respetuosa y resolutiva transmite que la privacidad no es un discurso sino una práctica real. Atender estos pedidos con seriedad, en coordinación con la institución, demuestra a toda la comunidad que su tranquilidad está por encima de cualquier interés comercial, y eso fortalece tu reputación más que cualquier argumento de venta."
      ),
      p(
        "La confianza, una vez ganada, se vuelve tu mejor activo. Las familias que se sintieron cuidadas compran con menos dudas, recomiendan tu trabajo y reciben con buena predisposición tus próximos proyectos en esa comunidad. En un terreno tan sensible como la fotografía de menores, ser reconocido como un profesional que toma la privacidad en serio es un diferencial enorme frente a quien trabaja sin esa sensibilidad. El cuidado de los chicos y la confianza de las familias no son una traba al negocio: son su cimiento más sólido."
      ),
    ],
    faq: [
      {
        q: "¿Las fotos escolares son públicas en la plataforma?",
        a: "No deberían serlo. Los proyectos escolares se configuran con acceso restringido para que solo las familias correspondientes vean las fotos, manteniéndolas fuera del alcance del público general.",
      },
      {
        q: "¿Quién gestiona las autorizaciones de imagen de los menores?",
        a: "Habitualmente la institución, que mantiene la relación con las familias y administra los consentimientos. El marco de autorizaciones debe estar claro antes de publicar cualquier foto.",
      },
      {
        q: "¿Para qué sirven las marcas de agua en este contexto?",
        a: "Protegen tu trabajo de descargas no autorizadas y agregan una capa de resguardo sobre las imágenes de menores. El archivo limpio solo se libera tras el pago de quien corresponde.",
      },
      {
        q: "¿Qué pasa si una familia no quiere que su hijo aparezca?",
        a: "La plataforma contempla canales para solicitar la baja de la imagen. Estos pedidos deben atenderse con rapidez y respeto, idealmente con un circuito acordado con la institución.",
      },
      {
        q: "¿Por qué la privacidad es una ventaja y no una traba?",
        a: "Porque las familias compran con tranquilidad cuando confían en que las imágenes de sus hijos están cuidadas. El buen manejo de la privacidad es un diferencial profesional que sostiene el negocio escolar.",
      },
    ],
    conclusion:
      "La privacidad en la fotografía escolar no es un trámite, sino el cimiento de la confianza que hace posible el negocio. Acceso restringido, autorizaciones claras gestionadas con la institución, vistas previas protegidas y atención rápida a los pedidos de baja son las prácticas que protegen a los menores y posicionan al fotógrafo como un profesional confiable que las escuelas eligen año tras año.",
    ctaAudience: resolveCtaAudience(["fotografos", "escuelas", "clientes"]),
    imageScene:
      "School principal and photographer discussing privacy documents in school office, respectful tone, hyperrealistic documentary photography style",
    imageAltSubject:
      "Directora de escuela y fotógrafo revisando las pautas de privacidad de un proyecto escolar",
    imageCaption: "El acceso restringido y los consentimientos protegen a los menores fotografiados.",
  },

  "como-buscar-tus-fotografias": {
    seoTitle: "Cómo buscar tus fotos en ComprameLaFoto",
    seoDescription:
      "Encontrá tus fotos de un evento o escuela usando el link, el número de dorsal o el curso, y navegando la galería. Guía práctica para compradores en Argentina.",
    excerpt:
      "Encontrá tus fotos de un evento o escuela usando el link, número de dorsal o curso.",
    blocks: [
      p(
        "Participaste de una carrera, un torneo o tu hijo tiene fotos del colegio y te pasaron un link de ComprameLaFoto. La buena noticia es que no necesitás ser experto en tecnología: la plataforma está pensada para que encuentres tus imágenes, las agregues al carrito y compres con Mercado Pago desde el celular o la computadora. En esta guía te explicamos cómo ingresar con el link del evento, buscar por dorsal o categoría en deportes, buscar por curso o división en lo escolar, navegar la galería con calma, sumar fotos al carrito y qué hacer si no encontrás la tuya."
      ),
      h2("Ingresar con el link del evento"),
      p(
        "El link que recibís —por WhatsApp, email, QR en la llegada o redes— es tu puerta de entrada. Tocá o hacé clic y se abrirá la landing del evento o la galería escolar. Si es un evento colaborativo, verás un punto único desde donde acceder a las distintas galerías de los fotógrafos que cubrieron la jornada."
      ),
      p(
        "Guardá el link en un lugar seguro si no vas a comprar en ese momento. En eventos deportivos el interés es alto los primeros días; en lo escolar, la escuela suele indicar un plazo de venta. Volver al mismo enlace más tarde te lleva a la misma galería sin tener que buscar de nuevo."
      ),
      p(
        "Si el link no abre, revisá que esté completo —sin cortes al copiar— y probá desde otro navegador o desde el celular. La mayoría de los problemas son de conexión o de enlace mal copiado, no de la galería en sí."
      ),
      p(
        "En eventos grandes conviene usar el mismo dispositivo con el que vas a pagar: así Mercado Pago ya está instalado o recordado en el navegador y el checkout es más ágil cuando encontrás tu foto. Si el organizador compartió un código QR, escanealo con la cámara del celular para evitar errores al tipear la dirección."
      ),
      h2("Buscar por dorsal o categoría"),
      p(
        "En carreras, ciclismo, triatlón y muchos torneos podés buscar tu foto por número de dorsal. Ingresá el número que llevaste en la competencia y la galería filtrará las imágenes asociadas. Es la forma más rápida cuando hay miles de fotos y no querés recorrer todo."
      ),
      p(
        "Si corrés en una categoría específica —edad, distancia, equipo— a veces conviene combinar dorsal con navegación por horario o zona de la galería. Los fotógrafos suelen organizar por momento de la prueba; si tu dorsal no aparece de inmediato, probá la sección del tramo donde te sacaron."
      ),
      p(
        "Verificá que el dorsal esté bien escrito: un dígito de más o de menos es la causa más común de «no encuentro mi foto». Si participaste sin dorsal visible, usá la navegación general o la búsqueda por selfie si el evento la tiene habilitada."
      ),
      p(
        "Algunos eventos publican el dorsal con cero a la izquierda y otros sin él; si no hay resultados, probá variaciones del número tal como figura en tu documento de acreditación. En relevos o pruebas por equipos, buscá también por el nombre del equipo si la galería lo permite."
      ),
      h2("Buscar por curso o división"),
      p(
        "En fotografía escolar, la galería suele organizarse por curso, sala o división. Abrí el menú o las secciones y elegí el grupo de tu hijo o hija —por ejemplo, Segundo Grado Mañana o Sala Verde—. Ahí verás las fotos individuales y grupales de esa clase."
      ),
      p(
        "Si la escuela usa padrón de alumnos, podés buscar por nombre cuando esa función esté disponible. Eso acorta el camino cuando hay muchas secciones y varios turnos en el mismo colegio, donde recorrer curso por curso llevaría bastante tiempo. Tené presente que el nombre cargado en la galería puede figurar tal como aparece en la libreta o el documento, así que si no encontrás resultados probá con el nombre completo o con alguna variante. En proyectos con muchos alumnos, esta búsqueda por padrón es la forma más directa de llegar a las fotos de tu hijo sin depender de recordar en qué división exacta quedó asignado este año."
      ),
      p(
        "¿No ves el curso correcto? Revisá el comunicado de la escuela: a veces el nombre en la galería es ligeramente distinto al que usás en casa. Si seguís sin encontrarlo, contactá al fotógrafo o a la institución con el nombre completo del alumno y el curso según libreta."
      ),
      p(
        "Las fotos grupales del curso suelen estar en una subsección aparte de las individuales; si buscás solo retratos de tu hijo, revisá ambas carpetas dentro del mismo grado. En actos o jornadas especiales puede haber un álbum adicional con tomas del evento completo."
      ),
      h2("Navegar la galería"),
      p(
        "Si no tenés dorsal o preferís mirar todo, podés recorrer la galería foto por foto o por secciones. Usá las miniaturas para avanzar rápido y hacé clic en una imagen para verla más grande antes de comprar. Las vistas previas pueden llevar marca de agua; la versión completa se obtiene tras pagar."
      ),
      p(
        "En eventos largos, empezá por la sección del momento en que estuviste —largada, meta, premiación— para no perder tiempo. Muchas galerías tienen cientos o miles de fotos; acotar por zona o horario hace la búsqueda más llevadera."
      ),
      p(
        "Podés agregar varias fotos al carrito y pagar una sola vez. Aprovechá si hay descuentos por cantidad o packs: a veces conviene llevar tres o cinco fotos juntas a un precio mejor que comprar una sola."
      ),
      p(
        "Usá la vista ampliada para confirmar que la foto es la que querés antes de sumarla: en eventos deportivos, varias tomas seguidas pueden parecer iguiles en miniatura pero mostrar momentos distintos del recorrido. Ese minuto de revisión evita compras duplicadas o arrepentimientos."
      ),
      h2("Agregar al carrito"),
      p(
        "Cuando encontrás una foto que querés, seleccionala y agregala al carrito. Ahí elegís si la querés en digital, impresión o ambas, según lo que ofrezca el fotógrafo. Revisá el carrito antes de pagar: cantidad, formato y precio total."
      ),
      p(
        "Si combinás digital e impresiones, completá los datos que pida el sistema —tamaño, cantidad, dirección de envío si corresponde—. Un pedido bien armado evita correcciones después del pago, que muchas veces son difíciles o imposibles una vez que la compra quedó confirmada. Revisá con calma que cada ítem sea el correcto: la foto elegida, el formato y, en el caso de las impresiones, los datos de entrega bien escritos. Dedicarle un minuto a esta verificación antes de avanzar al pago te ahorra el dolor de cabeza de descubrir, ya tarde, que pediste el tamaño equivocado o que cargaste mal la dirección a la que querías que llegara el pedido."
      ),
      p(
        "No cerrés la ventana hasta confirmar que el pago con Mercado Pago fue aprobado. Recibirás confirmación por email y, en el caso de digitales, acceso a la descarga según el flujo del pedido."
      ),
      p(
        "Antes de confirmar, mirá el resumen de precios: a veces el descuento por cantidad se aplica automáticamente al superar un umbral y conviene agregar una foto más para activarlo. El carrito te muestra el total actualizado antes de redirigirte a Mercado Pago."
      ),
      h2("Ayuda si no encontrás tu foto"),
      p(
        "Si buscaste por dorsal o curso y no aparecés, probá variantes: otro número si hubo error de registro, otra sección de la galería, o la búsqueda por selfie en eventos masivos. A veces la foto está pero con un criterio distinto al que imaginabas."
      ),
      p(
        "Contactá al fotógrafo o al organizador con datos concretos: evento, fecha, dorsal o nombre del alumno, y —si podés— una descripción de tu ropa o ubicación. Eso ayuda a ubicar la imagen manualmente si el sistema no la mostró en el filtro."
      ),
      p(
        "Tené paciencia en los primeros días post-evento: en coberturas grandes, los fotógrafos pueden seguir subiendo material. Volvé al mismo link más tarde o preguntá en el canal oficial del evento si ya se publicó toda la galería."
      ),
      p(
        "Guardá capturas de pantalla de la búsqueda que hiciste si contactás soporte: dorsal, curso, hora del intento y sección donde miraste. Con esos datos el fotógrafo o el organizador puede ubicar la imagen manualmente mucho más rápido que con un mensaje genérico de «no está mi foto»."
      ),
      h3("Consejos para no perderte ninguna foto"),
      p(
        "Cuando finalmente entrás a la galería, vale la pena dedicarle unos minutos a mirar con calma, porque es habitual que haya más fotos tuyas de las que imaginás. En un mismo evento podés aparecer en distintos momentos, ángulos y tomas: una en la largada, otra en el recorrido, otra en la llegada. Revisar toda la sección que te corresponde, y no quedarte con la primera que encontrás, te asegura no dejar afuera esa imagen que quizás es la que más te va a gustar de todo el evento."
      ),
      p(
        "Combiná las distintas formas de búsqueda disponibles para cubrir todos los frentes. Si hay búsqueda por dorsal, empezá por ahí; si está la opción de selfie, usala como complemento para detectar fotos donde tu número no se ve bien; y completá con una navegación manual por los momentos en los que sabés que pasaste. Ninguna herramienta es perfecta por sí sola, pero usadas en conjunto reducen al mínimo las chances de que una buena toma tuya quede sin descubrir."
      ),
      p(
        "Tené en cuenta el factor tiempo. Si el evento fue muy reciente, puede que no todas las fotos estén publicadas todavía, porque la subida del material lleva su tiempo. Si revisaste y encontraste pocas, vale la pena volver más tarde para ver si aparecieron nuevas. Por otro lado, no dejes pasar demasiado: muchas galerías tienen un plazo de venta, así que conviene encontrar y comprar tus fotos dentro de la ventana en la que están disponibles."
      ),
      p(
        "Si tras mirar con atención seguís sin encontrar fotos tuyas, no asumas de entrada que no existen. Verificá que estás en el evento y la sección correctos, probá las otras búsquedas y, si nada funciona, contactá al fotógrafo o al organizador, que conocen el detalle de la cobertura. En eventos masivos es posible que simplemente no te hayan captado en una toma identificable, pero muchas veces el problema es de búsqueda y se resuelve con un poco de ayuda de quien armó la galería."
      ),
    ],
    faq: [
      {
        q: "¿Necesito crear cuenta para buscar fotos?",
        a: "En muchas galerías públicas o con link podés buscar y comprar sin registrarte. El flujo te pedirá los datos necesarios al pagar con Mercado Pago.",
      },
      {
        q: "¿Cómo busco en una maratón?",
        a: "Usá el link del evento e ingresá tu número de dorsal en el buscador si está disponible. Es la forma más rápida cuando hay miles de fotos.",
      },
      {
        q: "¿Y en el colegio?",
        a: "Entrá al link que envió la escuela o el fotógrafo, elegí el curso o sala de tu hijo/a y navegá las fotos de esa sección. Si hay padrón, podés buscar por nombre del alumno.",
      },
      {
        q: "¿Por qué las fotos tienen marca de agua?",
        a: "Es la vista previa protegida. Después de pagar, descargás la versión completa sin marca de agua para uso personal.",
      },
      {
        q: "No encuentro mi dorsal, ¿qué hago?",
        a: "Revisá que el número esté bien escrito, probá otras secciones de la galería o la búsqueda por selfie si el evento la ofrece. Si persiste, contactá al fotógrafo con tu dorsal y fecha del evento.",
      },
    ],
    conclusion:
      "Buscar tus fotos en ComprameLaFoto es cuestión de tener el link correcto y usar la herramienta adecuada: dorsal en deportes, curso o padrón en la escuela, o navegación y selfie cuando hace falta. Tomate unos minutos para explorar la galería con calma y, cuando encuentres lo que buscás, el carrito y Mercado Pago cierran la compra en pocos pasos.",
    ctaAudience: resolveCtaAudience(["clientes"]),
    imageScene:
      "Parent searching race photos on smartphone at home living room, casual realistic setting, hyperrealistic documentary photography style",
    imageAltSubject:
      "Persona buscando sus fotos de una carrera en el celular desde la sala de su casa",
    imageCaption: "Con el link del evento y tu dorsal o curso, encontrar tus fotos lleva pocos minutos.",
  },

  "como-comprar-fotografias-digitales": {
    seoTitle: "Cómo comprar fotos digitales en ComprameLaFoto",
    seoDescription:
      "Elegí fotos digitales, pagá con Mercado Pago y descargá en alta resolución. Guía paso a paso para compradores en Argentina: carrito, packs y descarga.",
    excerpt:
      "Tutorial para clientes: elegir fotos digitales, pagar con Mercado Pago y recibir la descarga.",
    blocks: [
      p(
        "Comprar fotografías digitales en ComprameLaFoto es un proceso pensado para ser rápido: encontrás la imagen, la sumás al carrito, pagás con Mercado Pago y recibís el archivo para descargar sin depender de que el fotógrafo te lo envíe a mano. Ya sea una carrera, un acto escolar o una fiesta, el flujo es el mismo. En esta guía repasamos cómo seleccionar fotografías, usar el carrito y los packs si hay promociones, pagar con Mercado Pago de forma segura, qué esperar en la confirmación del pedido, cómo descargar los archivos y los problemas frecuentes que podés resolver vos mismo antes de contactar soporte."
      ),
      h2("Seleccionar fotografías"),
      p(
        "Recorré la galería con el link del evento o la escuela hasta encontrar las fotos que querés. Hacé clic en cada imagen para verla más grande; la vista previa puede tener marca de agua, lo cual es normal. Cuando estés seguro, elegí la opción de compra digital si está disponible."
      ),
      p(
        "Podés seleccionar varias fotos en la misma sesión. Muchas galerías ofrecen descuento por cantidad: a veces conviene agregar tres o cinco imágenes juntas porque el precio por unidad baja. Revisá el detalle antes de ir al pago."
      ),
      p(
        "Si dudás entre dos tomas muy parecidas, quedate con la que mejor se vea en pantalla grande, donde se notan detalles que la miniatura esconde. La digital que comprás es exactamente el archivo que descargás, así que vale la pena tomarse unos segundos para comparar la nitidez, la expresión y el encuadre antes de decidir. Elegir con calma evita compras duplicadas de imágenes casi idénticas que después no sabés cuál usar. En eventos deportivos, por ejemplo, suele haber ráfagas de fotos del mismo instante: quedarte con la mejor de la serie te deja una selección más linda y aprovecha mejor cada peso que invertís en tus recuerdos."
      ),
      p(
        "En fotografía escolar, muchas familias combinan retrato individual y foto grupal del curso en la misma compra. Revisá ambas secciones de la galería antes de cerrar el carrito para no volver a pagar el envío mental de buscar de nuevo más tarde."
      ),
      h2("Carrito y packs"),
      p(
        "El carrito concentra todo lo que vas a comprar en una sola operación. Antes de pagar, revisá cantidad, formato —solo digital o digital más impresión— y el total. Si el fotógrafo armó packs —por ejemplo, varias digitales a precio fijo— evaluá si te conviene respecto de comprar foto por foto."
      ),
      p(
        "Los packs simplifican la decisión cuando querés muchas imágenes del mismo evento o del mismo alumno en contexto escolar. Agregá el pack al carrito y verificá qué incluye: cantidad de fotos, resolución y si hay impresiones opcionales."
      ),
      p(
        "Podés vaciar o editar el carrito antes de pagar. No hay apuro: el carrito espera hasta que confirmes con Mercado Pago, aunque en eventos muy concurridos conviene no dejar la compra para el último día si hay plazo de venta."
      ),
      p(
        "Compará el precio del pack con la suma de fotos sueltas: a veces el pack incluye una cantidad fija que te obliga a elegir más imágenes de las que querías, y otras veces el ahorro es claro. El carrito muestra el desglose antes de pagar."
      ),
      h2("Pago con Mercado Pago"),
      p(
        "ComprameLaFoto utiliza Mercado Pago como pasarela principal en Argentina. Al finalizar el carrito, serás redirigido a pagar con la app o la web de Mercado Pago: tarjeta, dinero en cuenta u otros medios habilitados en tu perfil."
      ),
      p(
        "No compartas datos de pago por WhatsApp con terceros: el único lugar seguro para pagar es el flujo oficial dentro de la galería. Si alguien te pide transferencia manual fuera de la plataforma, desconfiá: podría no ser el canal autorizado del fotógrafo."
      ),
      p(
        "Esperá la confirmación de que el pago fue aprobado antes de cerrar la ventana. Si queda pendiente, Mercado Pago te indicará los pasos; la descarga digital se libera cuando el pago está acreditado."
      ),
      p(
        "Si pagás con tarjeta en cuotas, las cuotas las gestiona Mercado Pago según tu banco y tu perfil; el fotógrafo recibe la venta igual que en un pago en un pago. Revisá en la pantalla de Mercado Pago las opciones disponibles antes de confirmar."
      ),
      h2("Confirmación del pedido"),
      p(
        "Tras un pago aprobado, recibirás un email de confirmación con el detalle del pedido y las instrucciones para acceder a tus fotos. Guardá ese correo: es tu comprobante y suele incluir el enlace directo a la descarga."
      ),
      p(
        "Revisá la carpeta de spam o promociones si no ves el mensaje en unos minutos. Agregar el remitente a contactos seguros ayuda para futuras compras en otros eventos."
      ),
      p(
        "Anotá el número de pedido si necesitás contactar soporte, porque es el dato que permite ubicar tu compra al instante. Con esa referencia a mano se resuelve mucho más rápido cualquier incidencia de acceso o descarga que si describís el problema de forma genérica. Guardá también el correo de confirmación completo, ya que suele incluir el detalle de lo que compraste y el enlace directo a tus fotos. Tener esa información ordenada desde el momento de la compra te da tranquilidad: si más adelante surge una duda o necesitás volver a bajar los archivos, sabés exactamente a qué pedido corresponde y con qué dato pedir ayuda."
      ),
      p(
        "Si compraste desde el celular, el mismo email te sirve para abrir la descarga en la computadora y guardar los archivos en un disco con más espacio. No hace falta repetir la compra: el enlace del pedido funciona en distintos dispositivos."
      ),
      h2("Descarga de archivos"),
      p(
        "Las fotografías digitales se entregan en alta resolución, sin la marca de agua de la vista previa. Desde el email o desde la pantalla de confirmación podés descargar cada archivo o un paquete, según cómo esté configurado el pedido."
      ),
      p(
        "Descargá en el dispositivo donde las vas a guardar o respaldar —celular, computadora, nube personal—. Hacé una copia de seguridad si son recuerdos importantes: actos escolares, maratones o celebraciones familiares."
      ),
      p(
        "El uso típico es personal: redes sociales, impresión en casa, álbum familiar o el cuadro para el living. Respetá los derechos del fotógrafo, ya que la compra digital te habilita a disfrutar y compartir la imagen, pero no significa revenderla ni sublicenciarla salvo que el vendedor indique expresamente lo contrario. Si pensás darle un uso comercial o publicarla en nombre de una marca, lo correcto es consultarlo antes con quien la tomó. Para el uso cotidiano y familiar, en cambio, la foto es tuya para guardar y mostrar cuanto quieras. Un gesto que muchos fotógrafos agradecen es etiquetarlos cuando compartís la imagen en redes: no es obligatorio, pero reconoce su trabajo y ayuda a que otros los encuentren."
      ),
      p(
        "Después de descargar, renombrá los archivos si querés ordenarlos —por ejemplo, con fecha y evento— antes de subirlos a tu nube. Ese hábito te ahorra buscar entre nombres genéricos cuando tengas fotos de varias carreras o actos escolares."
      ),
      h2("Problemas frecuentes"),
      p(
        "Pago aprobado y sin email: revisá spam, esperá unos minutos y buscá en Mercado Pago el comprobante con referencia al pedido. Si pasó más de una hora, contactá soporte con el número de operación."
      ),
      p(
        "El link de descarga no abre: probá otro navegador o descargá desde la computadora si el archivo es pesado. No reenvíes el link a terceros: suele estar asociado a tu compra."
      ),
      p(
        "Compraste la foto equivocada: depende de las políticas del fotógrafo y del caso. Contactá con educación, el número de pedido y el detalle; muchas veces hay solución si actuás rápido."
      ),
      p(
        "Si Mercado Pago rechazó el pago, revisá saldo, límite de tarjeta o datos antes de reintentar. Varios intentos fallidos seguidos pueden bloquear temporalmente el medio; esperá unos minutos o probá otro método habilitado en tu cuenta."
      ),
      h3("Cuidar y aprovechar tus fotos compradas"),
      p(
        "Una vez que pagaste y descargaste tus fotos digitales, el primer consejo es guardarlas en un lugar seguro y, si podés, con una copia de respaldo. Las fotos son tu recuerdo, y aunque la entrega haya sido sencilla, los archivos en tu dispositivo dependen de vos a partir de ahí. Una copia en la nube, en otro dispositivo o en un disco externo te protege de perderlas si se rompe el celular o se borran por accidente. Unos minutos de respaldo evitan el disgusto de perder un momento irrepetible."
      ),
      p(
        "Aprovechá la calidad del archivo que recibiste. Como las fotos vienen sin la marca de agua de la vista previa y en buena resolución, podés usarlas para distintos fines: compartirlas en redes, enviarlas a familiares o imprimirlas por tu cuenta. Si pensás en una impresión, la buena resolución es importante, así que conservá el archivo original tal como lo descargaste, sin recomprimirlo demasiado al reenviarlo por aplicaciones de mensajería, que suelen reducir la calidad de las imágenes que circulan por ellas."
      ),
      p(
        "Si lo que querés es una copia física de calidad, considerá pedir la impresión directamente desde la galería cuando esa opción está disponible. Muchas veces el mismo fotógrafo ofrece impresiones del evento con un acabado profesional que supera al de una impresión casera. Comprar el digital para compartir y, además, una impresión para enmarcar es una combinación frecuente entre quienes quieren tanto el recuerdo para las redes como el objeto físico para conservar o regalar a alguien especial."
      ),
      p(
        "Por último, conservá la confirmación de tu compra junto con las fotos. Ese comprobante te sirve como respaldo y como vía de acceso si necesitás volver a descargar dentro de los plazos disponibles. Tener todo ordenado —archivos guardados y confirmación a mano— hace que tus recuerdos queden bien resguardados y que cualquier gestión futura, como una consulta al fotógrafo, se resuelva rápido. Tratar tus fotos compradas con ese pequeño cuidado asegura que las disfrutes durante mucho tiempo sin sobresaltos."
      ),
    ],
    faq: [
      {
        q: "¿Qué medios de pago aceptan?",
        a: "En Argentina el flujo principal es Mercado Pago: tarjeta, dinero en cuenta y otros medios habilitados en tu perfil de la pasarela.",
      },
      {
        q: "¿Cuándo puedo descargar después de pagar?",
        a: "Cuando el pago está aprobado. Recibirás un email con el acceso; si tarda unos minutos, revisá spam antes de preocuparte.",
      },
      {
        q: "¿La foto descargada tiene marca de agua?",
        a: "No. La vista previa en la galería puede llevar marca de agua; el archivo que comprás y descargás es la versión completa para uso personal.",
      },
      {
        q: "¿Puedo comprar varias fotos juntas?",
        a: "Sí. Agregá todas al carrito y pagá una sola vez. Mirá si hay descuentos por cantidad o packs para ahorrar.",
      },
      {
        q: "¿Es seguro pagar en la plataforma?",
        a: "Sí, siempre que pagues dentro del flujo oficial de la galería con Mercado Pago. No transfieras a cuentas sueltas por WhatsApp que no sean el canal autorizado.",
      },
    ],
    conclusion:
      "Comprar fotos digitales en ComprameLaFoto resume a elegir, pagar con Mercado Pago y descargar. Si guardás el email de confirmación y respaldás tus archivos, te quedás con el recuerdo en alta calidad sin idas y vueltas con el fotógrafo. Ante cualquier duda, el número de pedido es tu mejor aliado para resolver rápido.",
    ctaAudience: resolveCtaAudience(["clientes"]),
    imageScene:
      "Customer completing photo purchase on laptop, credit card and Mercado Pago on phone nearby, hyperrealistic documentary photography style",
    imageAltSubject:
      "Comprador finalizando la compra de fotos digitales con Mercado Pago en su computadora",
    imageCaption: "Elegí tus fotos, pagá con Mercado Pago y descargá en pocos minutos.",
  },

  "como-comprar-impresiones": {
    seoTitle: "Cómo comprar impresiones en ComprameLaFoto",
    seoDescription:
      "Pedí impresiones de eventos o escuelas en ComprameLaFoto: tamaños, packs, envío o retiro, pago con Mercado Pago y seguimiento del pedido en Argentina.",
    excerpt:
      "Guía para pedir impresiones fotográficas de eventos o escuelas con envío o retiro.",
    blocks: [
      p(
        "Además de la foto digital, muchas veces querés el papel: enmarcar un recuerdo escolar, regalar una ampliación o tener una copia física de la meta de una carrera. En ComprameLaFoto podés encargar impresiones directamente desde la misma galería donde viste las fotos, con pago por Mercado Pago y seguimiento del pedido. En esta guía te explicamos cómo elegir tamaño y acabado, combinar cantidad y packs, completar datos de envío, confirmar el pago, qué tiempos de producción esperar y cómo seguir tu pedido hasta recibirlo."
      ),
      p(
        "El flujo es el mismo si venís de una maratón, un acto escolar o una fiesta: elegís la foto en la galería, marcás impresión en el carrito y completás el pedido sin negociar por mensaje con el fotógrafo. Eso te da precio claro, comprobante y un número de seguimiento si hay envío."
      ),
      h2("Elegir tamaño y acabado"),
      p(
        "Al agregar una foto al carrito, verás las opciones de impresión que ofrece el fotógrafo: tamaños —por ejemplo, 10x15 o formatos mayores— y a veces acabado mate o brillo. Elegí según el uso: un 10x15 es práctico para álbumes; una ampliación conviene para enmarcar."
      ),
      p(
        "No hace falta decidir todas las impresiones de una: podés comprar digital de algunas fotos e impresión solo de las favoritas. Revisá la vista previa y el recorte si la herramienta lo permite, para asegurarte de que encuadre como querés."
      ),
      p(
        "Si dudás entre dos tamaños, pensá dónde irá la foto antes de decidir. Una impresión más grande impacta en la pared y funciona como cuadro destacado del living o el escritorio; un tamaño estándar es más fácil de regalar, llevar en la billetera o guardar en un álbum escolar junto al resto de los recuerdos del año. También influye la distancia desde la que se va a mirar: una ampliación se aprecia de lejos, mientras que las copias chicas se disfrutan en la mano. Si el presupuesto lo permite, muchas familias combinan una ampliación para enmarcar con varias copias estándar para repartir, cubriendo ambos usos en un mismo pedido."
      ),
      p(
        "El acabado mate suele reducir reflejos en marcos con vidrio; el brillo realza colores en álbumes que se miran con luz directa. Si la galería ofrece ambos, elegí según dónde vas a exhibir la foto más que por gusto abstracto."
      ),
      h2("Cantidad y packs"),
      p(
        "Podés pedir varias copias de la misma imagen o combinar distintas fotos en un solo pedido. Algunas galerías ofrecen packs que mezclan digitales e impresiones a precio promocional; compará el total con comprar por separado."
      ),
      p(
        "En contexto escolar, las familias suelen pedir sets para abuelos, padrinos o hermanos, porque la foto del año es un recuerdo que varios quieren tener. Aprovechá los descuentos por cantidad si están disponibles: muchas veces la segunda o tercera copia sale bastante más conveniente que la primera, así que pedir varias juntas optimiza el gasto. Pensá de antemano cuántas copias vas a necesitar para no tener que hacer un segundo pedido más tarde, que implicaría volver a esperar la producción y, eventualmente, otro envío. Resolver todas las copias en una sola compra es más cómodo, suele ser más económico y te asegura que todas salgan del mismo lote con la misma calidad."
      ),
      p(
        "Revisá el carrito antes de pagar: cantidad por foto, tamaño y dirección de envío si corresponde. Un detalle mal cargado es la causa más común de retrasos o reimpresiones."
      ),
      p(
        "Si ya compraste la digital de una foto, agregar impresión del mismo archivo en el mismo pedido suele ser más simple que hacer dos compras separadas. El carrito unifica digitales e impresiones cuando el fotógrafo lo habilitó."
      ),
      h2("Datos de envío"),
      p(
        "Si las impresiones se envían a domicilio, completá dirección, localidad, código postal y teléfono de contacto con cuidado. Un número mal escrito o un piso omitido complica la entrega y retrasa tu pedido."
      ),
      p(
        "En campañas escolares a veces hay retiro en el colegio o entrega centralizada. Leé el comunicado del fotógrafo o la escuela: puede que no debas cargar envío sino elegir retiro en institución."
      ),
      p(
        "Para regalos, verificá si podés usar una dirección distinta a la de facturación. Mercado Pago y el formulario de pedido te guiarán según las opciones habilitadas en esa galería."
      ),
      p(
        "En envíos a domicilio, alguien debe poder recibir el paquete en horario laboral o indicá un punto de retiro si el correo lo ofrece. Un teléfono atendido acelera la entrega cuando el repartidor necesita coordinar."
      ),
      h2("Pago y confirmación"),
      p(
        "El pago de impresiones también pasa por Mercado Pago en el flujo oficial de ComprameLaFoto. Al aprobarse, recibirás confirmación por email con el detalle del pedido y, cuando corresponda, el estado de producción."
      ),
      p(
        "Las impresiones tienen costo de producción y logística; el precio en pantalla debería reflejar eso. Si algo parece demasiado bajo o te piden pagar fuera de la plataforma, verificá que estés en el link correcto del fotógrafo o la escuela."
      ),
      p(
        "Guardá el comprobante y el número de pedido en un lugar a mano, porque son la referencia para cualquier consulta sobre demoras, cambios de dirección o incidencias en el envío. A diferencia de una compra digital, que se resuelve al instante, una impresión atraviesa producción y logística, etapas donde tener el dato del pedido agiliza enormemente cualquier gestión. Si surge una duda sobre cuándo llega tu paquete o necesitás avisar algo sobre la entrega, citar el número evita explicaciones largas y permite que te ubiquen el pedido de inmediato. Conservá también el email de confirmación, que suele detallar qué ítems son digitales —disponibles ya— y cuáles impresiones en producción, para no confundir los tiempos de cada uno."
      ),
      p(
        "El email de confirmación puede distinguir entre ítems digitales —disponibles al instante— e impresiones —en producción—. Leé el detalle para no esperar el correo en la puerta el mismo día que compraste la ampliación."
      ),
      h2("Tiempos de producción"),
      p(
        "A diferencia de lo digital —que se libera al instante tras el pago—, las impresiones requieren producción en laboratorio y, si aplica, envío. Los plazos varían según el fotógrafo, el volumen de pedidos y tu ubicación."
      ),
      p(
        "En preventas escolares, la fecha de entrega suele estar comunicada desde el inicio. En eventos deportivos, muchas impresiones se procesan en los días posteriores a la carrera. Consultá el mensaje del organizador si necesitás la foto antes de una fecha concreta."
      ),
      p(
        "La paciencia ayuda: picos de demanda post-maratón o cierre de preventa escolar pueden extender colas de producción. Un pedido confirmado dentro de plataforma tiene seguimiento; uno pagado por fuera, no."
      ),
      p(
        "Si necesitás la impresión para una fecha fija —cumpleaños, acto escolar— comprá con margen y preguntá en el comunicado del evento cuál es el plazo realista. Las preventas escolares suelen cerrar con fecha de entrega ya acordada con la institución."
      ),
      h2("Seguimiento del pedido"),
      p(
        "Desde el email de confirmación o contactando al fotógrafo con tu número de pedido podés consultar en qué estado está: en producción, listo para retiro, enviado. Algunos flujos incluyen código de seguimiento de correo cuando el envío ya salió."
      ),
      p(
        "Si el plazo comunicado venció y no recibiste novedades, escribí con educación y el dato del pedido. La mayoría de los retrasos se resuelven con una consulta puntual, sobre todo en campañas escolares donde hay muchos pedidos simultáneos."
      ),
      p(
        "Al recibir las impresiones, revisá que coincidan cantidad y tamaño. Si hay un error, reportalo pronto con fotos del producto recibido y el comprobante de compra."
      ),
      p(
        "En retiro en colegio, llevá el comprobante o el número de pedido por si hay varias familias recogiendo el mismo día. Una identificación clara evita entregas cruzadas en campañas con cientos de carpetas."
      ),
      p(
        "Si combinás impresiones de varios eventos en distintas compras, cada pedido tiene su propio número y plazo. No mezcles consultas en un solo mensaje al fotógrafo: indicá siempre qué evento y qué número de pedido corresponde a cada consulta."
      ),
      h3("Cómo elegir el mejor recuerdo impreso"),
      p(
        "Antes de encargar una impresión, pensá dónde y cómo vas a usar la foto, porque eso define el tamaño ideal. Una imagen para tener sobre un escritorio o regalar a un familiar funciona bien en un formato cómodo, mientras que una toma especial que querés colgar en la pared luce mucho más en una ampliación. Elegir el tamaño en función del destino concreto de la foto evita decepciones: una imagen pensada para enmarcar pierde impacto si la pedís demasiado chica, y viceversa."
      ),
      p(
        "Considerá también el acabado si la galería ofrece distintas opciones. Cada terminación le da un carácter distinto a la copia, y aunque a veces cueste decidir, vale la pena leer las descripciones para entender qué estás eligiendo. Si tenés dudas, la opción más clásica suele ser una apuesta segura que queda bien en casi cualquier contexto. Lo importante es que la impresión refleje lo que imaginaste, porque a diferencia del archivo digital, la copia física es un objeto definitivo que vas a conservar."
      ),
      p(
        "Aprovechá los packs si pensás encargar varias impresiones o combinarlas con el archivo digital. Muchas veces, llevar un conjunto sale más conveniente que pedir cada copia por separado, y los combos que incluyen digital más impresión resuelven de una sola vez las ganas de compartir la foto en redes y de tener el recuerdo en papel. Revisar estas opciones antes de finalizar el pedido puede hacer que termines con más recuerdos por un precio similar al que ibas a gastar de todos modos."
      ),
      p(
        "Por último, planificá con tiempo. A diferencia de la descarga digital, que es inmediata, la impresión tiene un proceso de producción y, si hay envío, un tiempo de despacho. Si necesitás la copia para una fecha concreta —un cumpleaños, un regalo, un acto— encargá con anticipación para que llegue cuando la necesitás. Pedir a último momento es la causa más común de impresiones que no llegan a tiempo, así que un poco de previsión asegura que el recuerdo esté listo para el momento que tenías en mente."
      ),
    ],
    faq: [
      {
        q: "¿Puedo comprar solo impresión sin digital?",
        a: "Depende de lo que habilite el fotógrafo en la galería. Muchas veces podés elegir solo impresión, solo digital o ambas para la misma foto.",
      },
      {
        q: "¿Cuánto tardan las impresiones?",
        a: "Varía según producción y envío. En preventas escolares suele indicarse una fecha de entrega; en eventos deportivos, varios días después de la carrera es habitual.",
      },
      {
        q: "¿Cómo pago las impresiones?",
        a: "Con Mercado Pago dentro del flujo oficial de la galería, igual que las fotos digitales. No pagues por transferencia suelta si no es el canal autorizado.",
      },
      {
        q: "¿Puedo enviar a otra dirección?",
        a: "Si el formulario de pedido lo permite, sí. Cargá los datos completos y un teléfono de contacto para el correo o mensajería.",
      },
      {
        q: "¿Qué hago si el pedido se demora?",
        a: "Contactá con el número de pedido y la fecha de compra. Revisá también spam por si llegó aviso de envío con tracking.",
      },
    ],
    conclusion:
      "Comprar impresiones en ComprameLaFoto te permite llevar el recuerdo al papel sin salir de la galería donde elegiste las fotos. Definí tamaño y cantidad con calma, pagá con Mercado Pago y seguí el pedido con el número de confirmación. Un poco de planificación en el envío y los plazos evita sorpresas cuando esperás ese cuadro para el living o el regalo para los abuelos.",
    ctaAudience: resolveCtaAudience(["clientes"]),
    imageScene:
      "Family unboxing photo prints at dining table, genuine smiles, warm indoor light, hyperrealistic documentary photography style",
    imageAltSubject:
      "Familia abriendo un paquete con impresiones fotográficas pedidas en ComprameLaFoto",
    imageCaption: "Las impresiones convierten tus fotos favoritas en recuerdos para compartir en casa.",
  },

  "como-descargar-fotografias-compradas": {
    seoTitle: "Cómo descargar fotos compradas en ComprameLaFoto",
    seoDescription:
      "Accedé a tus fotos digitales tras la compra en ComprameLaFoto: email de confirmación, descarga individual o ZIP, plazos de disponibilidad y qué hacer si falla.",
    excerpt:
      "Accedé a tus archivos digitales después de la compra: links, plazos y reintentos de descarga.",
    blocks: [
      p(
        "Pagaste tus fotografías digitales con Mercado Pago y ahora querés el archivo en tu celular o computadora. La descarga es el último paso del recorrido y, en la mayoría de los casos, es automática una vez acreditado el pago. En esta guía te explicamos qué buscar en el email de confirmación, cómo acceder desde el pedido, si conviene descarga individual o archivo ZIP, cuánto tiempo tenés disponible el enlace, qué calidad recibís y cuándo contactar soporte si algo no funciona."
      ),
      p(
        "Si compraste varias fotos en un solo pedido, el email suele agrupar el acceso a todas. No hace falta un correo por imagen: un solo mensaje con el detalle y los enlaces —o un ZIP— es lo habitual en ComprameLaFoto cuando el pago con Mercado Pago queda aprobado."
      ),
      h2("Email de confirmación"),
      p(
        "Tras un pago aprobado, ComprameLaFoto envía un correo con el detalle de tu compra y el acceso a la descarga. Revisá la bandeja de entrada y, si no aparece en unos minutos, las carpetas de spam, promociones o correo no deseado."
      ),
      p(
        "El email es tu comprobante: guardalo o reenviámelo a una cuenta que uses siempre. Ahí suele estar el enlace directo para bajar cada foto o un paquete con todas las del pedido."
      ),
      p(
        "No compartas el enlace de descarga en grupos públicos ni lo reenvíes a terceros: está asociado a tu compra y conviene tratarlo como un dato personal de acceso a tus archivos. Si querés que otra persona de la familia tenga las fotos, lo más simple es descargarlas vos y después compartir los archivos finales por el medio que prefieras, en lugar de pasar el enlace original. Pensá que ese link es la llave a tus imágenes en alta resolución; mantenerlo dentro de tus canales privados evita que el acceso quede expuesto. Una vez que bajaste y guardaste las fotos en tu dispositivo, el enlace pierde relevancia y lo que importa es la copia que ya tenés a salvo."
      ),
      p(
        "Si usás Gmail u otro proveedor con pestañas automáticas, buscá también en Promociones o Actualizaciones: los correos de confirmación de compra a veces caen ahí en lugar de la bandeja principal."
      ),
      h2("Acceso desde el pedido"),
      p(
        "Además del correo, a veces podés volver a la pantalla de confirmación justo después de pagar y descargar desde ahí. Si cerraste la ventana, el email sigue siendo el canal principal para recuperar el acceso."
      ),
      p(
        "Si la galería te permite consultar pedidos con tu email o un código, usalo para reintentar la descarga sin comprar de nuevo. Buscá la sección de «mis pedidos» o el enlace que indique el mensaje de confirmación."
      ),
      p(
        "Anotá el número de pedido que figura en la confirmación y guardalo junto con el correo de compra. Cualquier consulta a soporte —ya sea al fotógrafo o a la plataforma— se resuelve mucho más rápido cuando aportás ese dato, porque permite ubicar tu compra sin vueltas. Si el enlace dejó de funcionar, si un archivo no se descargó completo o si simplemente querés volver a bajar las fotos, esa referencia es la que destraba la gestión. Tené presente que la compra queda registrada en el sistema aunque pierdas el correo: con el número de pedido y el email que usaste al pagar, quien te atienda puede verificar la operación y ayudarte a recuperar el acceso a tus imágenes."
      ),
      p(
        "Si cerraste el navegador antes de descargar, no hace falta volver a pagar: el pedido queda registrado y el acceso se recupera con el email o la consulta de pedidos usando el mismo correo que usaste en Mercado Pago."
      ),
      h2("Descarga individual o ZIP"),
      p(
        "Según el pedido, podés descargar cada fotografía por separado o un archivo ZIP con todas juntas. El ZIP es práctico cuando compraste muchas imágenes: una sola descarga y después las ordenás en tu computadora."
      ),
      p(
        "En el celular, archivos grandes pueden tardar más o pedir Wi-Fi estable. Si falla, probá desde una notebook o esperá a mejor señal antes de reintentar."
      ),
      p(
        "Después de bajar, abrí los archivos para confirmar que son las fotos correctas y que se ven nítidas. La versión descargada es la de alta resolución, sin la marca de agua de la vista previa."
      ),
      p(
        "En iPhone o Android, las fotos pueden guardarse en la galería del teléfono o en la app de archivos según el navegador. Si no las ves de inmediato, buscá en Descargas o en la carpeta que tu sistema asigna a archivos del navegador."
      ),
      h2("Plazos de disponibilidad"),
      p(
        "Los enlaces de descarga están disponibles por un tiempo razonable para que completes la baja a tu dispositivo. No asumas que podrás volver años después con el mismo link: descargá y hacé tu copia de seguridad pronto."
      ),
      p(
        "Guardá las fotos en tu nube personal, disco externo o álbum del celular según prefieras. Recuerdos de actos escolares o carreras valen una copia extra por si cambiás de teléfono."
      ),
      p(
        "Si el plazo del enlace venció y necesitás el archivo, contactá soporte con el número de pedido. Según el caso y las políticas vigentes, puede haber una nueva emisión; no está garantizado, por eso conviene descargar al recibir la confirmación."
      ),
      p(
        "Una buena rutina es descargar el mismo día, subir una copia a tu nube —Google Fotos, iCloud, Drive— y recién ahí compartir en redes si querés. Así no dependés de un solo dispositivo ni de un link que puede expirar."
      ),
      h2("Calidad del archivo"),
      p(
        "Lo que descargás es el archivo que el fotógrafo cargó para venta digital, en la resolución configurada para ese álbum. Debería ser apto para impresión casera, redes sociales y álbumes familiares."
      ),
      p(
        "Si la imagen se ve pixelada solo en una miniatura del celular, abrila en pantalla completa o en la computadora antes de pensar que hay un error. Las vistas chicas engañan; el archivo real suele ser mucho mayor."
      ),
      p(
        "El uso típico de estas fotos es personal: guardarlas, compartirlas con la familia, subirlas a tus redes o imprimirlas para un álbum o un cuadro. No revendas ni sublicencies las imágenes salvo acuerdo expreso con el fotógrafo, ya que la compra te permite disfrutarlas pero no comercializarlas en nombre de un tercero. Si en algún momento querés darle un uso publicitario o profesional, lo correcto es consultarlo antes con quien tomó la foto. Para el día a día —el recuerdo de la carrera, el acto escolar o la fiesta— las imágenes son tuyas para usar cuanto quieras. Etiquetar al fotógrafo cuando las compartís es un gesto de cortesía que reconoce su trabajo y muchos agradecen, aunque no sea obligatorio."
      ),
      p(
        "Para imprimir en casa o en un kiosco, el archivo descargado suele ser suficiente; para ampliaciones muy grandes, la calidad depende de la resolución original que cargó el fotógrafo. Si necesitás un tamaño específico, preguntá antes de comprar impresión integrada en la galería."
      ),
      h2("Contactar soporte"),
      p(
        "Contactá soporte si el pago figura aprobado en Mercado Pago pero no recibiste email ni enlace tras un tiempo razonable, si el link da error repetido o si el archivo descargado no corresponde a lo que compraste."
      ),
      p(
        "Tené a mano: número de pedido, fecha de compra, email usado y —si podés— captura del comprobante de Mercado Pago. Con eso evitás idas y vueltas."
      ),
      p(
        "Revisá primero spam y probá otro navegador; muchos «problemas» de descarga se resuelven ahí. Si persiste, el soporte de ComprameLaFoto o del fotógrafo puede verificar el estado del pedido en el panel."
      ),
      p(
        "Si descargaste pero el archivo no abre, verificá que la descarga terminó por completo —barra de progreso al 100%— antes de abrirlo. Archivos cortados por conexión inestable son la causa más común de «foto corrupta» que en realidad es una descarga incompleta."
      ),
      p(
        "Compartir la foto en redes después de descargar es uso personal habitual; etiquetar al fotógrafo o al evento es un gesto de cortesía que muchos agradecen, aunque no sea obligatorio para disfrutar tu compra."
      ),
      h3("Cómo respaldar tus fotos a largo plazo"),
      p(
        "Las fotos quedan disponibles para descargar durante un período determinado tras la compra, así que el hábito más importante es bajarlas y guardarlas cuanto antes. Una vez que los archivos están en tu poder, ya no dependés de plazos ni de accesos online: tus recuerdos son tuyos para siempre. Dejar la descarga para mucho después es arriesgarse a que el plazo se cumpla, así que apenas recibís la confirmación, tomate unos minutos para descargar todo y dejarlo a buen recaudo en tu dispositivo."
      ),
      p(
        "No te quedes con una única copia. Los celulares se pierden, se rompen o se llenan, y las computadoras fallan; confiar todos tus recuerdos a un solo lugar es la receta para perderlos algún día. Guardá tus fotos en al menos dos sitios distintos: por ejemplo, en tu dispositivo y en un servicio de nube, o en una computadora y un disco externo. Esa redundancia simple es la mejor garantía de que un accidente técnico no se lleve imágenes que no se pueden volver a tomar."
      ),
      p(
        "Organizá tus fotos para encontrarlas en el futuro. Crear una carpeta por evento, con un nombre y una fecha claros, te ahorra horas de búsqueda cuando, meses o años después, quieras reencontrarte con ese recuerdo. Si descargaste un archivo ZIP, descomprimilo y guardá las fotos individuales en su carpeta correspondiente. Un poco de orden al momento de guardar convierte una descarga suelta en un archivo personal ordenado que vas a agradecer cada vez que quieras revivir un momento especial."
      ),
      p(
        "Conservá también la confirmación de tu compra junto con los archivos, al menos por un tiempo. Ese comprobante es tu respaldo y, dentro de los plazos disponibles, tu vía para volver a descargar si algo sale mal. Si en algún momento necesitás ayuda con un archivo, tenerlo a mano agiliza la gestión con el fotógrafo o el soporte. Con tus fotos respaldadas en varios lugares, ordenadas y con su comprobante guardado, tus recuerdos quedan protegidos para disfrutarlos durante muchos años."
      ),
    ],
    faq: [
      {
        q: "¿Cuándo llega el email con la descarga?",
        a: "En general, pocos minutos después de que Mercado Pago aprueba el pago. Si tarda, revisá spam y esperá un poco antes de escalar a soporte.",
      },
      {
        q: "¿Puedo descargar desde el celular?",
        a: "Sí. Usá el enlace del email; para muchas fotos o archivos pesados, Wi-Fi estable o una computadora pueden ser más cómodos.",
      },
      {
        q: "¿La descarga tiene marca de agua?",
        a: "No. La marca de agua es solo en la vista previa de la galería. El archivo comprado es la versión completa.",
      },
      {
        q: "¿Cuánto tiempo tengo para descargar?",
        a: "Hay un plazo de disponibilidad del enlace; no es indefinido. Descargá y guardá tus copias pronto, idealmente el mismo día de la compra.",
      },
      {
        q: "Perdí el email, ¿puedo recuperar las fotos?",
        a: "Probá acceder desde la pantalla de pedido si la galería lo permite, o contactá soporte con tu número de pedido y el email de compra.",
      },
    ],
    conclusion:
      "Descargar tus fotografías compradas es el cierre del proceso: email de confirmación, enlace y copia en tus dispositivos. Hacelo en cuanto pagues, guardá backup en la nube o en tu computadora y conservá el número de pedido por si necesitás soporte. Así te quedás con tus recuerdos en alta calidad sin depender de un link que puede vencer más adelante.",
    ctaAudience: resolveCtaAudience(["clientes"]),
    imageScene:
      "Person downloading photos from email link on phone, progress bar visible, sofa background, hyperrealistic documentary photography style",
    imageAltSubject:
      "Persona descargando fotografías digitales compradas desde el enlace del email en su celular",
    imageCaption: "Tras el pago aprobado, la descarga llega por email en pocos minutos.",
  },

  "como-encontrar-fotografias-mediante-selfie": {
    seoTitle: "Cómo buscar fotos con selfie en ComprameLaFoto",
    seoDescription:
      "Usá el reconocimiento por selfie para encontrar tus fotos en eventos masivos: cómo funciona, privacidad, resultados y qué hacer si no hay coincidencias.",
    excerpt:
      "Usá el reconocimiento por selfie para ubicar tus fotos en segundos en eventos masivos.",
    blocks: [
      p(
        "Recorrer miles de fotos de una maratón o un festival puede llevar horas. La búsqueda por selfie en ComprameLaFoto acorta ese camino: subís o tomás una foto de tu rostro y el sistema busca coincidencias en la galería del evento. Es especialmente útil cuando no recordás tu dorsal, llegaste tarde al link o simplemente querés encontrarte rápido entre cientos de fotógrafos. En esta guía explicamos cuándo está disponible esta función, cómo tomar o subir la selfie, cómo funciona el reconocimiento, qué pasa con la privacidad de esa imagen, cómo interpretar los resultados y qué alternativas tenés si no hay match."
      ),
      h2("Cuándo está disponible"),
      p(
        "La búsqueda por selfie no está en todas las galerías: depende de que el fotógrafo u organizador la haya habilitado para ese evento. Suele aparecer en competencias masivas —running, ciclismo, triatlón— donde el volumen de imágenes hace impráctico buscar solo a ojo."
      ),
      p(
        "Si entrás al link del evento y ves la opción de buscar por selfie o reconocimiento facial, podés usarla. Si no aparece, el evento puede no tenerla activa; en ese caso usá dorsal, categoría o navegación por secciones."
      ),
      p(
        "Antes de una carrera, fijate en el comunicado del organizador si mencionan selfie search. Saberlo de antemano te ahorra frustración si llegás esperando una función que no fue habilitada en esa edición."
      ),
      p(
        "En eventos colaborativos con varios fotógrafos, la selfie busca en todas las galerías vinculadas a la landing. No necesitás repetir la búsqueda en cada subgalería: un solo escaneo recorre el material indexado del evento."
      ),
      h2("Tomar o subir una selfie"),
      p(
        "Seguí las instrucciones en pantalla: podés tomarte una selfie en el momento con la cámara del celular o subir una foto reciente donde se vea bien tu rostro. Buscá buena luz, sin anteojos de sol ni gorra que tapen rasgos, y mirá de frente a la cámara."
      ),
      p(
        "Una selfie clara mejora notablemente las coincidencias, así que vale la pena dedicarle un segundo a sacar una buena. Evitá fotos muy editadas, filtros extremos que deforman los rasgos o imágenes de grupo donde tu cara aparezca pequeña y de costado; el sistema necesita identificar tus facciones con precisión para encontrarte. Buscá luz pareja sobre el rostro, sin sombras fuertes ni contraluz, y mirá de frente a la cámara. Si la primera búsqueda no devuelve buenos resultados, probá con otra selfie tomada en mejores condiciones: muchas veces el problema no es que falten fotos tuyas, sino que la imagen de referencia no le dio al algoritmo suficiente información para reconocerte entre la multitud del evento."
      ),
      p(
        "Si estás en la expo o la llegada de la carrera, muchos eventos montan puntos con buena iluminación para esto. Aprovecharlos reduce errores respecto de una selfie apurada en la calle con poca luz."
      ),
      p(
        "Si corrés con barba o bigote el día de la carrera pero en la selfie no los tenés —o al revés—, el reconocimiento puede fallar. Usá una selfie lo más parecida posible a cómo te veías en el evento, incluidos accesorios habituales como vincha o gorra si la llevabas puesta."
      ),
      h2("Cómo funciona el reconocimiento"),
      p(
        "El sistema compara los rasgos de tu selfie con los rostros detectados en las fotos de la galería y te muestra las coincidencias más probables. No es magia: puede haber falsos positivos o fotos tuyas que aún no se subieron cuando buscás."
      ),
      p(
        "Revisá cada resultado antes de comprar. A veces aparece alguien parecido o una toma donde salís de perfil. Confirmá que la imagen es tuya —ropa, contexto, momento de la prueba— antes de agregarla al carrito."
      ),
      p(
        "Si el evento sigue cargando fotos, probá de nuevo más tarde. La búsqueda por selfie solo encuentra imágenes ya publicadas en la galería en ese momento."
      ),
      p(
        "El reconocimiento funciona mejor en fotos donde tu rostro se ve de frente o tres cuartos. Perfiles muy cerrados, casco o buff que cubre la cara en la carrera pueden no aparecer aunque la foto exista; ahí ayuda combinar con búsqueda por dorsal."
      ),
      h2("Privacidad de la selfie"),
      p(
        "Es normal preguntarse qué pasa con la foto que subís para buscar. ComprameLaFoto usa esa imagen para el matching en el evento; no es un trámite para publicar tu selfie en internet. Leé las indicaciones en pantalla y las políticas de privacidad del sitio si querés más detalle."
      ),
      p(
        "No subas la selfie de otra persona sin su permiso: la herramienta está pensada para que cada participante busque sus propias fotos, no las de terceros. Si querés ayudar a un familiar o amigo a encontrar sus imágenes, lo ideal es que sea él mismo quien suba su selfie, o que te dé su consentimiento explícito para hacerlo en su nombre. Este cuidado es especialmente importante porque se trata de datos sensibles vinculados al rostro de una persona. La búsqueda por selfie es una comodidad pensada para vos, y usarla de forma responsable —solo con tu propia cara o con permiso de quien corresponda— es parte de aprovecharla bien y de respetar la privacidad del resto de los participantes del evento."
      ),
      p(
        "Si te incomoda usar reconocimiento facial, siempre podés volver a la búsqueda por dorsal o al recorrido manual de la galería. La selfie es una ayuda opcional, no el único camino."
      ),
      p(
        "La selfie que subís para buscar no reemplaza la compra de la foto del evento: solo sirve para ubicar coincidencias. Las imágenes que elegís comprar siguen el mismo flujo de pago con Mercado Pago y descarga que cualquier otra foto de la galería."
      ),
      h2("Resultados y coincidencias"),
      p(
        "Los resultados suelen ordenarse por similitud. Empezá por las primeras coincidencias y ampliá cada miniatura para verificar. Podés seleccionar varias y comprarlas juntas con Mercado Pago, igual que en cualquier otra búsqueda."
      ),
      p(
        "En eventos con mucho público, puede haber varias fotos tuyas en distintos puntos del recorrido. La selfie ayuda a encontrarlas sin buscar dorsal por dorsal en cada sección."
      ),
      p(
        "Si una coincidencia no es tuya, ignorala y seguí revisando el resto de los resultados sin apuro. El reconocimiento puede sugerir caras parecidas o tomas donde aparece alguien similar, así que conviene confirmar cada foto antes de sumarla: fijate en la ropa, el contexto y el momento de la prueba para asegurarte de que sos vos. No compres fotos de desconocidos por error; de todos modos, el carrito siempre muestra con claridad lo que vas a pagar antes de confirmar, así que tenés una última oportunidad de revisar la selección. Tomarte ese instante extra para verificar evita compras equivocadas y te asegura que cada imagen que pagás es realmente un recuerdo tuyo del evento."
      ),
      p(
        "Guardá en favoritos o en el carrito las coincidencias válidas mientras seguís revisando el listado. Así no perdés las que ya confirmaste si el buscador actualiza resultados al subir nuevas tandas de fotos al evento."
      ),
      h2("Si no hay match"),
      p(
        "Que no haya resultados no significa que no te hayan sacado foto. Puede que aún no subieron tu tramo, que salías de perfil o con elementos que dificultan el reconocimiento, o que la iluminación de la selfie no fue la mejor."
      ),
      p(
        "Probá de nuevo con otra selfie más clara, buscá por dorsal si lo tenés, o navegá la sección del recorrido donde recordás haber estado. Combinar métodos suele funcionar mejor que depender de uno solo."
      ),
      p(
        "Si nada aparece y el evento ya cerró la carga, contactá al fotógrafo u organizador con tu dorsal, horario aproximado y descripción de tu indumentaria. A veces la foto está pero el algoritmo no la vinculó; un humano puede ayudarte a ubicarla."
      ),
      p(
        "Volvé a intentar la selfie unas horas después de la carrera si buscás el mismo día: muchas galerías se completan de noche y los primeros resultados pueden ser parciales. La paciencia y un segundo intento con mejor iluminación resuelven buena parte de los casos sin soporte."
      ),
      h3("Combinar la selfie con otras búsquedas"),
      p(
        "La búsqueda por selfie es un atajo potente, pero rinde mucho más cuando la combinás con las otras formas de encontrarte. En un evento deportivo, por ejemplo, conviene empezar por el dorsal si está disponible, porque identifica directamente tus fotos por tu número, y usar la selfie como complemento para detectar imágenes donde el dorsal no se ve bien —cuando estás de espaldas, tapado por otro corredor o en una toma de detalle. Las dos herramientas juntas cubren situaciones que cada una por separado deja afuera."
      ),
      p(
        "La navegación manual sigue siendo un buen complemento, sobre todo si querés asegurarte de no perder ninguna toma. El reconocimiento facial trabaja con probabilidades y puede no detectarte en fotos donde aparecés de perfil, lejos o con poca luz sobre tu cara. Recorrer los momentos del evento en los que sabés que estuviste, después de usar la selfie, te permite rescatar esas imágenes que el sistema no asoció pero en las que igual aparecés. Un poco de revisión extra suele revelar fotos que valían la pena."
      ),
      p(
        "Si la selfie no devuelve resultados, no concluyas de inmediato que no hay fotos tuyas. Probá primero con otra selfie de mejor calidad —más frontal, mejor iluminada y nítida—, porque un pequeño cambio en la foto que subís puede mejorar mucho las coincidencias. Si aun así no aparecés, recurrí al dorsal o a la navegación, y tené presente que en eventos muy recientes el material podría no estar todo publicado todavía, así que volver a intentar más tarde también puede dar frutos."
      ),
      p(
        "Una vez que reuniste tus fotos con la combinación de búsquedas, revisá cada coincidencia para confirmar que efectivamente sos vos antes de comprar, ya que entre los resultados podría colarse alguien parecido. Con tu selección verificada, el resto del proceso es igual que en cualquier galería: agregás las fotos al carrito, aprovechás los packs si llevás varias y pagás con Mercado Pago. La selfie fue solo el atajo para encontrarte rápido; combinada con las demás búsquedas, te asegura llevarte todos tus recuerdos del evento."
      ),
    ],
    faq: [
      {
        q: "¿En todos los eventos puedo usar selfie?",
        a: "No. Solo cuando el fotógrafo u organizador habilitó la búsqueda por selfie para esa galería. Si no ves la opción, usá dorsal o navegación manual.",
      },
      {
        q: "¿Qué selfie conviene subir?",
        a: "Una con buena luz, rostro de frente, sin anteojos de sol ni gorra que tapen rasgos. Evitá filtros fuertes o fotos de grupo donde tu cara sea muy chica.",
      },
      {
        q: "¿Es seguro subir mi selfie?",
        a: "Se usa para buscar coincidencias en el evento. Si tenés dudas, revisá las políticas de privacidad del sitio o usá búsqueda por dorsal en su lugar.",
      },
      {
        q: "¿Por qué aparecen fotos que no son mías?",
        a: "El reconocimiento puede sugerir coincidencias parecidas. Revisá cada imagen antes de comprar y confirmá ropa y contexto.",
      },
      {
        q: "No encontré nada, ¿significa que no hay fotos mías?",
        a: "No necesariamente. Probá otra selfie, buscá por dorsal, revisá más tarde si siguen subiendo fotos o contactá al organizador con tu dorsal y descripción.",
      },
    ],
    conclusion:
      "La búsqueda por selfie en ComprameLaFoto es un atajo valioso en eventos masivos: una buena foto de tu rostro, unos segundos de espera y coincidencias para revisar y comprar. Combinada con dorsal y navegación por secciones, casi siempre termina el laberinto de miles de miniaturas. Si no hay match, no te desanimes: probá de nuevo o pedí ayuda con datos concretos del día de la carrera.",
    ctaAudience: resolveCtaAudience(["clientes"]),
    imageScene:
      "Runner taking selfie at marathon expo photo kiosk, bib number visible, realistic crowd, hyperrealistic documentary photography style",
    imageAltSubject:
      "Corredor tomándose una selfie en un punto de búsqueda de fotos en la expo de una maratón",
    imageCaption: "La búsqueda por selfie acorta el camino entre miles de fotos y las tuyas.",
  },
};
