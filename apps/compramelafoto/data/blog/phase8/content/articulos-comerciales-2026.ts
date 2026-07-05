import type { Phase8ArticleContent } from "@/data/blog/phase8/types";
import { resolveCtaAudience } from "@/data/blog/phase8/cta";
import { h2, h3, p, pr, ul } from "@/data/blog/phase8/editorial-nodes";

export const ARTICULOS_COMERCIALES_2026_PHASE8: Record<string, Phase8ArticleContent> = {
  "vende-fotos-sin-suscripcion-mensual": {
    seoTitle: "Vendé fotos sin pagar suscripción mensual | ComprameLaFoto",
    seoDescription:
      "ComprameLaFoto es gratis para empezar: sin abono mensual ni costo fijo por galería. Solo pagás comisión cuando vendés fotos online en Argentina.",
    excerpt:
      "Empezá a vender fotografías online sin suscripción mensual: cargá eventos, publicá galerías y pagá comisión solo cuando concretás una venta.",
    blocks: [
      p(
        "Muchos fotógrafos en Argentina quieren sumar venta online a su negocio, pero frenan ante la idea de pagar una herramienta todos los meses aunque no vendan nada. Suscripciones, planes anuales y costos fijos por almacenamiento pueden comerse el margen de quien recién arranca o de quien cubre eventos esporádicos. ComprameLaFoto fue pensada con otro criterio: podés registrarte y usar la plataforma sin abono mensual, sin costo fijo por mantener tus galerías publicadas y sin pagar por cargar eventos. La plataforma cobra una comisión únicamente cuando realmente se vende una fotografía. Si no vendés, no hay un cargo recurrente que te presione."
      ),
      p(
        "Ese modelo cambia la ecuación mental del fotógrafo. En lugar de preguntarte «¿me alcanza para pagar la herramienta este mes?», la pregunta pasa a ser «¿cómo mejoro mi oferta para convertir visitas en ventas?». Podés probar la plataforma sin riesgo financiero inicial, armar tu primer álbum, conectar Mercado Pago y publicar un evento chico antes de comprometerte con una temporada completa. Es una forma justa de alinear incentivos: vos querés vender; la plataforma gana cuando vos ganás."
      ),
      h2("Sin suscripción: qué significa en la práctica"),
      p(
        "«Sin suscripción mensual» no es un eslogan vacío: implica que crear tu cuenta de fotógrafo, configurar álbumes y mantener galerías activas no tiene un cargo fijo periódico. No tenés que renovar un plan cada mes para que tus fotos sigan visibles ni pagar por «tener el local abierto» en internet. El costo aparece cuando hay una transacción concreta: un cliente elige fotos, paga con Mercado Pago y recibe su descarga o pedido según lo que hayas configurado."
      ),
      p(
        "Eso es especialmente relevante para fotógrafos que trabajan por temporadas —escuela en marzo, torneos los fines de semana, recitales puntuales— o para quienes están probando si la venta digital encaja en su negocio sin querer sumar un gasto fijo más a la lista. También sirve a fotógrafos deportivos, sociales y de eventos masivos que necesitan escalar en fechas pico sin multiplicar costos fijos en meses flojos."
      ),
      h3("Compará con el costo de herramientas que cobran todos los meses"),
      p(
        "Cuando pagás una suscripción mensual, el gasto es el mismo vendas mucho o poco. En meses sin eventos, igual salís a pagar. En meses con pocas ventas, la herramienta puede comerse buena parte del margen. Ese desfasaje empuja a algunos fotógrafos a postergar la digitalización o a seguir vendiendo por WhatsApp con todos los problemas que eso trae: pagos desordenados, archivos reenviados a mano y ventas perdidas por demora."
      ),
      pr(
        { type: "text", text: "Centralizar la venta en una plataforma con checkout y entrega automática reduce esa fricción. Si todavía dependés del chat para cobrar y entregar, leé " },
        {
          type: "link",
          text: "cómo evitar perder ventas por WhatsApp",
          href: "/blog/como-evitar-perder-ventas-por-whatsapp",
        },
        { type: "text", text: " y comparalo con un flujo donde el cliente paga y descarga sin que intervengas en cada archivo." }
      ),
      h2("Ideal para quien recién empieza o quiere sumar una unidad de negocio"),
      ul([
        "Fotógrafos que recién incorporan venta online y no quieren asumir un fijo mensual.",
        "Cobertura escolar con campañas concentradas en pocos meses del año.",
        "Fotografía deportiva de fines de semana, maratones o torneos puntuales.",
        "Eventos sociales, fiestas de egresados y recitales con ventana de venta acotada.",
        "Fotógrafos establecidos que quieren probar un canal nuevo sin renegociar contratos con otras herramientas.",
        "Quien vuelve al rubro después de una pausa y prefiere reactivar sin compromiso de abono.",
      ]),
      p(
        "En todos esos perfiles, la barrera de entrada baja: no necesitás justificar ante tu contador un gasto fijo antes de la primera venta. Podés publicar, medir tráfico y conversión, ajustar precios y comunicación, y decidir con datos si el canal rinde para vos."
      ),
      h3("Experimentá eventos nuevos sin miedo a perder plata"),
      p(
        "¿Te invitaron a cubrir un torneo que nunca fotografiaste? ¿Un colegio te pidió presupuesto pero no sabés cuánto venderán las familias? Con un modelo solo-por-venta, el riesgo de «pagar la herramienta y que el evento no rinda» desaparece. Si el evento no convierte, no quedás atrapado pagando meses siguientes por una galería que casi nadie compró. Si convierte, la comisión es el costo de haber usado pagos, hosting, previews protegidas y entrega automatizada."
      ),
      pr(
        { type: "text", text: "Para entender el panorama general de la plataforma, consultá " },
        {
          type: "link",
          text: "qué es ComprameLaFoto",
          href: "/blog/que-es-compramelafoto",
        },
        { type: "text", text: ". Si ya decidiste probar, el siguiente paso es " },
        {
          type: "link",
          text: "registrarte como fotógrafo",
          href: "/blog/como-registrarte-en-compramelafoto",
        },
        { type: "text", text: " y conectar tu cuenta de Mercado Pago." }
      ),
      h2("La venta se automatiza de punta a punta"),
      p(
        "Una vez publicada la galería, el cliente entra al link, ve vistas previas con marca de agua, elige las fotos que quiere, paga online y accede a sus archivos o impresiones según tu configuración. Vos no tenés que enviar cada JPEG por WhatsApp ni perseguir comprobantes de transferencia. Ese automatismo es lo que hace escalable vender en un maratón, un acto escolar o una fiesta con cientos de asistentes."
      ),
      pr(
        { type: "text", text: "Si vendés digitales, el flujo completo está detallado en " },
        {
          type: "link",
          text: "cómo vender fotos digitales",
          href: "/blog/como-vender-fotos-digitales",
        },
        { type: "text", text: " y en " },
        {
          type: "link",
          text: "cómo publicar una galería",
          href: "/blog/como-publicar-una-galeria",
        },
        { type: "text", text: ". La clave comercial es publicar con precios claros y compartir el link en los canales del evento apenas tengas material listo." }
      ),
      h3("Mercado Pago y tu ingreso neto"),
      p(
        "Los cobros se procesan con Mercado Pago. De cada venta, la plataforma retiene su comisión y el resto se acredita en tu cuenta según los plazos habituales del medio de pago. Conocer ese recorrido te ayuda a fijar precios que dejen el margen que buscás. No hay doble sorpresa: sin mensualidad fija y con comisión solo sobre ventas concretadas."
      ),
      pr(
        { type: "text", text: "Para profundizar en plazos y conciliación, revisá " },
        {
          type: "link",
          text: "cómo retirar tus ganancias",
          href: "/blog/como-retirar-tus-ganancias",
        },
        { type: "text", text: "." }
      ),
      h2("Un modelo alineado con tu crecimiento"),
      p(
        "La lógica es simple: si vendés, la plataforma participa del resultado; si no vendés, no te carga un abono por existir. Eso permite usar ComprameLaFoto como laboratorio comercial —probar precios, packs, timing de publicación— sin sentir que cada día de prueba tiene un costo fijo. Cuando encontrás la fórmula que funciona en tu nicho, escalás eventos; cuando un mes está flojo, no arrastrás un gasto de software que no usaste."
      ),
      p(
        "Tampoco implica que todo sea gratis en sentido absoluto: servicios que consumen recursos puntuales —como extensiones de almacenamiento si las contratás— pueden tener costo asociado al uso. Pero el núcleo del negocio fotográfico —cuenta, álbumes, venta digital con comisión por transacción— está pensado para que el fotógrafo no pague por adelantado una suscripción mensual solo por estar en la plataforma."
      ),
      h3("Cuándo tiene más sentido que una suscripción tradicional"),
      p(
        "Las suscripciones pueden convenir a estudios con volumen altísimo y predecible todos los meses. Si tu realidad es irregular —eventos, temporada escolar, fines de semana deportivos— un modelo sin mensualidad suele ser más sano. Pagás proporcionalmente a lo que facturás y podés pausar mentalmente la inversión en meses sin trabajo, sin recibir un débito automático de una herramienta que no usaste."
      ),
      p(
        "Muchos fotógrafos combinan ComprameLaFoto con su trabajo presencial o con impresiones en laboratorio. La venta online deja de ser un «proyecto aparte con costo fijo» y pasa a ser un canal más que se activa cuando hay material y público, con riesgo acotado."
      ),
      h2("Primeros pasos sin compromiso de abono"),
      ul([
        "Creá tu cuenta de fotógrafo sin costo de alta.",
        "Conectá Mercado Pago para recibir cobros.",
        "Armá un álbum de prueba con un evento chico o sesión propia.",
        "Configurá precios digitales e impresiones si las ofrecés.",
        "Publicá y compartí el link con un grupo acotado para medir conversión.",
        "Iterá precios y comunicación antes de tu próximo evento grande.",
      ]),
      p(
        "Ese recorrido podés hacerlo completo sin pagar una suscripción mensual. La única comisión aparece cuando alguien compra. Si nadie compra en la prueba, aprendiste sobre tu oferta y tu comunicación; si compran, ya validaste el canal con costo variable acotado a ventas reales."
      ),
      h2("Preguntas que suelen hacer los fotógrafos antes de migrar"),
      h3("«¿Y si ya pago otra herramienta?»"),
      p(
        "Muchos conviven un tiempo con dos canales hasta comparar conversión y tiempo invertido. No necesitás cancelar nada el día uno: podés publicar un evento piloto en ComprameLaFoto, medir resultados y decidir con números. El ausencia de mensualidad hace más barato ese experimento que mantener dos suscripciones eternas."
      ),
      h3("«¿Qué pasa en temporada baja?»"),
      p(
        "En meses sin coberturas, tus galerías pueden quedar publicadas o archivadas según tu estrategia, sin un débito automático por «plan básico». Eso importa en fotografía escolar, donde el pico es trimestral, y en deportes outdoor con invierno flojo."
      ),
      h3("«¿Necesito vender mucho para que rinda?»"),
      p(
        "No hay un mínimo de ventas para «justificar» la plataforma, porque no hay fijo mensual. Una sola venta digital ya validó que el flujo funciona; el desafío comercial es replicar ese resultado. La herramienta no te penaliza por empezar chico."
      ),
      p(
        "El modelo sin suscripción mensual no es un truco de marketing: es la forma en que ComprameLaFoto alinea su éxito con el tuyo. Menos riesgo al probar, más libertad para crecer a tu ritmo y un camino claro hacia la venta automatizada cuando estés listo para escalar."
      ),
      p(
        "Si venís postergando la venta online por miedo a sumar otro gasto fijo a tu estudio, este es un buen momento para probar con un evento real pero acotado. Configurá precios, publicá, compartí el link y dejá que el sistema cobre y entregue mientras vos te enfocás en el próximo trabajo detrás de la cámara."
      ),
    ],
    faq: [
      {
        q: "¿ComprameLaFoto cobra suscripción mensual?",
        a: "No. Podés registrarte y usar la plataforma sin abono mensual fijo. La comisión se aplica cuando concretás una venta, según la configuración vigente de tu cuenta.",
      },
      {
        q: "¿Tengo que pagar por subir un evento o mantener una galería publicada?",
        a: "No hay un costo fijo mensual por tener álbumes activos en el modelo estándar. El gasto variable principal es la comisión sobre ventas realizadas.",
      },
      {
        q: "¿Puedo probar la plataforma antes de un evento grande?",
        a: "Sí. Muchos fotógrafos publican primero un evento chico o una galería de prueba para validar precios, flujo de compra y tiempos de carga sin asumir un gasto recurrente.",
      },
      {
        q: "¿Cómo cobro mis ventas?",
        a: "A través de Mercado Pago. Conectás tu cuenta en el panel del fotógrafo; cuando un cliente paga, se procesa la venta y se acredita tu parte según las reglas del medio de pago y la comisión de la plataforma.",
      },
      {
        q: "¿Este modelo sirve para fotografía escolar o deportiva?",
        a: "Sí. Es especialmente útil en rubros con picos estacionales: campañas escolares, torneos de fin de semana o eventos puntuales donde no querés un fijo mensual en meses sin actividad.",
      },
      {
        q: "¿Qué pasa si un mes no vendo nada?",
        a: "No pagás comisión por ventas inexistentes ni un abono mensual por el uso básico de la cuenta y las galerías. Ese es el sentido del modelo: el costo acompaña tus ingresos, no el calendario.",
      },
    ],
    conclusion:
      "Vender fotografías online no debería empezar con un gasto fijo que te presione antes de la primera venta. ComprameLaFoto te permite registrarte sin suscripción mensual, publicar galerías y pagar comisión solo cuando realmente vendés. Es una forma justa de probar eventos nuevos, automatizar cobros y entregas, y hacer crecer tu negocio sin miedo a perder plata en meses flojos. Si sos fotógrafo y querés empezar a vender tus fotos online con un modelo alineado a tus resultados, creá tu cuenta en ComprameLaFoto hoy mismo.",
    ctaAudience: "fotografos",
    imageScene:
      "Argentine photographer smiling at laptop in home studio, sales notification on screen, no subscription invoices on desk, warm natural window light, hyperrealistic documentary photography",
    imageAltSubject: "Fotógrafo revisando ventas online sin preocuparse por una suscripción mensual",
    imageCaption: "Sin abono fijo: empezá a vender y pagá comisión solo cuando concretás una venta.",
  },

  "encontrar-fotos-con-selfie": {
    seoTitle: "Encontrar fotos con selfie: búsqueda automática | ComprameLaFoto",
    seoDescription:
      "Cómo la búsqueda por selfie ayuda a clientes, fotógrafos y organizadores a encontrar fotos en eventos masivos y comprar más rápido en ComprameLaFoto.",
    excerpt:
      "En eventos con miles de fotos, una selfie ayuda al cliente a encontrar sus imágenes en segundos, mejora la experiencia de compra y reduce consultas al fotógrafo.",
    blocks: [
      p(
        "En una maratón, un torneo con varias canchas o un acto escolar con cientos de alumnos, el archivo fotográfico crece a un ritmo que el ojo humano no puede recorrer con paciencia. El participante quiere sus fotos ya; el fotógrafo quiere vender, no responder cincuenta mensajes de «¿estoy en la foto 847?»; el organizador quiere participantes satisfechos. La búsqueda por selfie de ComprameLaFoto apunta a ese cuello de botella: el cliente sube una selfie, el sistema compara rostros con las imágenes del evento o álbum y devuelve las coincidencias más probables para comprar."
      ),
      p(
        "No reemplaza al fotógrafo ni elimina la necesidad de buena cobertura. Mejora la experiencia comercial: quien llega a la galería encuentra antes lo que busca, completa el carrito y paga online. Eso beneficia a clientes, fotógrafos, escuelas y organizadores que quieren un proceso moderno, ordenado y rápido."
      ),
      h2("El problema: demasiadas fotos, poco tiempo"),
      p(
        "Quien corre una media maratón o asiste al festejo de fin de curso suele tener veinte minutos entre el trabajo y la cena para buscar fotos. Si la galería exige recorrer álbum tras álbum, muchos abandonan. Cada abandono es una venta perdida y una mala impresión del servicio, aunque la calidad de las fotos sea excelente."
      ),
      ul([
        "Eventos deportivos con miles de corredores o jugadores.",
        "Actos escolares con muchos cursos en un mismo día.",
        "Recitales y fiestas con público numeroso.",
        "Viajes de egresados o salidas educativas con muchas tomas grupales.",
        "Eventos colaborativos con varios fotógrafos en una misma landing.",
      ]),
      p(
        "En todos esos escenarios, la selfie funciona como atajo: acorta la distancia entre «llegué al link» y «estas son mis fotos»."
      ),
      h2("Cómo funciona la búsqueda por selfie"),
      h3("Para el cliente o la familia"),
      p(
        "El usuario entra a la galería del evento y elige la opción de buscar por selfie. Sube o toma una foto de su rostro —mejor si hay buena luz, de frente y sin elementos que tapen la cara—. El sistema procesa la comparación y muestra un listado de imágenes ordenadas por similitud, con vistas previas protegidas igual que en el resto de la galería. Selecciona las que quiere, paga con Mercado Pago y recibe el acceso correspondiente. La selfie sirve para encontrar; no reemplaza el checkout ni otorga descargas gratuitas."
      ),
      pr(
        { type: "text", text: "Si sos comprador y querés el paso a paso desde tu lado, revisá " },
        {
          type: "link",
          text: "cómo encontrar fotografías mediante selfie",
          href: "/blog/como-encontrar-fotografias-mediante-selfie",
        },
        { type: "text", text: ". Si preferís el detalle técnico y de configuración, leé " },
        {
          type: "link",
          text: "cómo funciona el reconocimiento por selfie",
          href: "/blog/como-funciona-reconocimiento-por-selfie",
        },
        { type: "text", text: "." }
      ),
      h3("Para el fotógrafo y el organizador"),
      p(
        "El fotógrafo debe subir material con rostros detectables y comunicar que la búsqueda estará disponible cuando haya volumen indexado. El organizador puede incluir en la landing del evento un mensaje claro: «Buscá tus fotos con una selfie». Coordinar ese mensaje con la hora real de publicación evita frustraciones el día de mayor tráfico."
      ),
      p(
        "En eventos colaborativos, la búsqueda puede cruzar galerías adheridas para que el participante no deba entrar uno por uno a cada fotógrafo. Eso multiplica el valor: más ángulos, más opciones de compra, una sola experiencia de búsqueda."
      ),
      h2("Beneficios comerciales concretos"),
      h3("Mejor experiencia de compra"),
      p(
        "Un cliente que encuentra sus fotos en segundos percibe un servicio profesional. Esa sensación se traduce en más carritos completados y en recomendaciones boca a boca para la próxima edición del evento."
      ),
      h3("Menos consultas manuales"),
      p(
        "Cada mensaje de «¿me ayudás a encontrar mi foto?» consume tiempo que podrías dedicar a editar, cargar o vender en otro evento. La selfie no elimina el soporte humano en casos límite, pero reduce el volumen de consultas repetitivas en eventos masivos."
      ),
      h3("Más ventas porque el interés no se enfría"),
      p(
        "La motivación de compra es máxima en las primeras horas post-evento. Si la búsqueda es lenta, esa motivación cae. Un buscador por rostro mantiene el impulso: el participante ve sus fotos, elige packs o ampliaciones y cierra la compra antes de distraerse."
      ),
      pr(
        { type: "text", text: "Para estrategias comerciales más amplias en eventos, combiná esta herramienta con las ideas de " },
        {
          type: "link",
          text: "cómo vender más fotografías de eventos",
          href: "/blog/como-vender-mas-fotografias-eventos",
        },
        { type: "text", text: " o " },
        {
          type: "link",
          text: "cómo vender fotografías deportivas online",
          href: "/blog/como-vender-fotografias-deportivas-online",
        },
        { type: "text", text: "." }
      ),
      h2("Contextos donde más aporta"),
      p(
        "La búsqueda por selfie brilla en eventos masivos con muchas fotos homogéneas —misma cancha, misma calle de llegada, mismo escenario— donde el cliente no tiene un número de dorsal a mano o no sabe qué fotógrafo lo cubrió. También ayuda en salidas escolares cuando las familias quieren encontrar rápido a su hijo entre decenas de miniaturas."
      ),
      p(
        "En contextos escolares con menores, puede convivir con otras medidas de privacidad. Por ejemplo, la función de ocultar galería hasta selfie restringe el acceso antes de la verificación; la búsqueda por rostro ayuda después a encontrar las fotos relevantes. Son piezas complementarias de una experiencia más cuidada."
      ),
      pr(
        { type: "text", text: "Para el enfoque de privacidad escolar con galería oculta, consultá " },
        {
          type: "link",
          text: "cómo protegemos la privacidad con Ocultar galería hasta selfie",
          href: "/blog/seguridad-escolar-ocultar-galeria-hasta-selfie",
        },
        { type: "text", text: "." }
      ),
      h2("Expectativas realistas: herramienta, no magia"),
      p(
        "Ningún reconocimiento facial es perfecto. Puede haber falsos negativos si la cara en la foto del evento está muy lejos o de perfil, o falsos positivos en casos extremos de parecido. Por eso conviene mantener métodos alternativos —búsqueda por dorsal, por horario o por álbum del fotógrafo— y comunicar con honestidad qué puede y qué no puede hacer la selfie."
      ),
      p(
        "La tecnología no reemplaza al fotógrafo: mejora el canal de venta. Seguís necesitando buena exposición, enfoque y publicación oportuna. La selfie ordena el catálogo para el comprador; la calidad de tu trabajo sigue siendo el motor de la recompra."
      ),
      h3("Buenas prácticas antes de anunciar el buscador"),
      ul([
        "Subí un volumen representativo de fotos antes de promocionar la búsqueda.",
        "Probá con una selfie interna para validar resultados.",
        "Indicá en la landing tips breves: luz, rostro visible, sin anteojos de sol.",
        "Coordiná con el organizador un único mensaje de «fotos disponibles».",
        "Prepará respuesta tipo para quien no obtiene coincidencias a la primera.",
      ]),
      h2("Compra más simple, rápida y ordenada"),
      p(
        "El objetivo final es que comprar fotos deje de sentirse como una tarea y pase a ser un paso natural después del evento. La selfie es una pieza de ese diseño: menos fricción, más claridad, más ventas para quien produjo las imágenes y mejor experiencia para quien las compra. Fotógrafos y organizadores que la comunican bien transmiten modernidad sin complicar el día a día del cliente."
      ),
      h2("Cómo comunicarlo al público del evento"),
      p(
        "Una función potente mal anunciada genera confusión. Incluí en el mail o la story del organizador tres líneas claras: «Subí una selfie», «El sistema te muestra tus fotos» y «Comprá y descargá al instante». Evitá tecnicismos sobre algoritmos; el público quiere resultados, no una clase de informática."
      ),
      p(
        "Si el evento tiene público internacional o adultos mayores, sumá una captura de pantalla del botón de búsqueda. Un tutorial de veinte segundos en vertical suele reducir consultas más que un texto largo en PDF."
      ),
      h3("Métricas que vale la pena mirar"),
      ul([
        "Porcentaje de visitas que usan búsqueda por selfie versus navegación manual.",
        "Tiempo entre publicación de fotos y primera compra.",
        "Consultas de soporte post-evento relacionadas con «no encuentro mi foto».",
        "Ticket promedio de quien compró tras usar selfie versus quien no.",
        "Tasa de recompra en la edición siguiente del mismo torneo o carrera.",
      ]),
      p(
        "Esas señales te dicen si la función está bien configurada y bien comunicada. Si muchos usan selfie pero pocos compran, el cuello de botella puede ser precio o timing de publicación, no la tecnología. Si casi nadie usa selfie, revisá visibilidad del botón y el mensaje del organizador."
      ),
    ],
    faq: [
      {
        q: "¿La búsqueda por selfie reemplaza al fotógrafo?",
        a: "No. Es una herramienta para que el cliente encuentre sus fotos más rápido en galerías grandes. El fotógrafo sigue produciendo, editando, publicando y definiendo precios.",
      },
      {
        q: "¿El cliente necesita cuenta para buscar?",
        a: "En muchas galerías públicas puede buscar y comprar sin cuenta previa, pagando con Mercado Pago como en cualquier compra online. Consultá el flujo del evento específico.",
      },
      {
        q: "¿Funciona en todos los álbumes?",
        a: "Depende de la configuración del álbum o evento y de que las fotos estén procesadas para detección de rostros. No todos los contextos requieren selfie; es opcional según el caso.",
      },
      {
        q: "¿Qué pasa si no hay coincidencias?",
        a: "Puede deberse a mala iluminación de la selfie, rostro poco visible en las fotos del evento o material aún no indexado. Conviene reintentar o usar búsqueda alternativa si el evento la ofrece.",
      },
      {
        q: "¿Sirve para escuelas y eventos con menores?",
        a: "Sí, en combinación con las políticas del colegio y las autorizaciones familiares. En algunos contextos escolares conviven selfie, padrón de alumnos y galería oculta hasta verificación.",
      },
      {
        q: "¿Aumenta las ventas?",
        a: "Acorta el camino entre visita y compra, lo que suele mejorar conversión en eventos masivos. El resultado depende también de precio, calidad, timing de publicación y comunicación del organizador.",
      },
    ],
    conclusion:
      "Encontrar fotos en un evento grande no debería ser un laberinto. La búsqueda por selfie de ComprameLaFoto ayuda a clientes y familias a llegar rápido a sus imágenes, reduce consultas manuales y hace más fluida la compra online. Para fotógrafos y organizadores, es una forma concreta de ofrecer una experiencia moderna sin sacrificar el control del servicio. Si querés que tu próximo evento destaque por simplicidad y velocidad, usá ComprameLaFoto y activá las herramientas de búsqueda que mejor encajen con tu público.",
    ctaAudience: resolveCtaAudience(["fotografos", "organizadores"]),
    imageScene:
      "Runner at outdoor race expo uploading selfie on smartphone to find race photos, photo kiosks and banners blurred background, bright daylight, hyperrealistic documentary style",
    imageAltSubject: "Participante de carrera usando selfie para encontrar sus fotos del evento",
    imageCaption: "Una selfie acorta el camino entre la galería del evento y la compra.",
  },

  "como-protegemos-datos-privacidad": {
    seoTitle: "Cómo protegemos datos y privacidad | ComprameLaFoto",
    seoDescription:
      "Privacidad, datos personales y uso responsable de tecnología en ComprameLaFoto: orientación para escuelas, padres, fotógrafos y organizadores en Argentina.",
    excerpt:
      "Trabajamos con criterios de privacidad para proteger imágenes de personas, especialmente en contextos escolares, con herramientas como galería oculta hasta selfie y controles de acceso.",
    blocks: [
      p(
        "ComprameLaFoto opera con fotografías de personas reales: alumnos en un acto escolar, corredores en una maratón, familias en una fiesta. Eso convierte la privacidad y el tratamiento responsable de datos en un tema central, no accesorio. Escuelas, padres, fotógrafos y organizadores nos eligen cuando necesitan vender imágenes de forma ordenada; también esperan que la plataforma ayude a reducir la exposición innecesaria y a mejorar el control de acceso. Este artículo explica, en lenguaje claro y sin asesoramiento legal, cómo abordamos esos desafíos y qué rol cumple la tecnología —incluido el reconocimiento facial— en ese marco."
      ),
      p(
        "No prometemos cumplimiento legal absoluto ni reemplazamos las autorizaciones que cada institución o familia debe gestionar según su contexto. Sí buscamos ofrecer herramientas pensadas para mejorar el control de acceso, trabajar con criterios de privacidad y acompañar a quienes venden fotografías con mayor cuidado, especialmente cuando hay menores de edad."
      ),
      h2("Por qué la privacidad importa en la venta de fotos"),
      p(
        "Una galería abierta con link compartible puede ser cómoda para vender, pero también implica que cualquiera con el enlace recorra imágenes ajenas. En fotografía escolar o en eventos con niños, esa exposición genera inquietud legítima en padres y directivos. En eventos deportivos o sociales, muchas personas prefieren no aparecer navegables por desconocidos sin necesidad."
      ),
      p(
        "La venta online no tiene por qué elegir entre comodidad y cuidado. La plataforma puede facilitar pagos y entregas automatizadas y, al mismo tiempo, incorporar mecanismos que limiten quién ve qué y cuándo. Ese equilibrio es el que guía varias funciones de ComprameLaFoto orientadas a privacidad y seguridad operativa."
      ),
      h2("Marco de referencia en Argentina"),
      p(
        "En Argentina, la Ley 25.326 de Protección de Datos Personales establece principios sobre el tratamiento de datos personales, incluidos en muchos casos los vinculados a imágenes identificables. La Agencia de Acceso a la Información Pública (AAIP) es el organismo de referencia en la materia y publica orientaciones para titulares, responsables y usuarios."
      ),
      p(
        "Este artículo no sustituye el asesoramiento de un profesional legal ni de las áreas de asesoría de cada escuela. Recomendamos que cada institución acompañe el uso de la plataforma con sus propias autorizaciones, actas y políticas internas sobre imagen de menores. La tecnología es una herramienta de seguridad adicional, no un reemplazo de las autorizaciones institucionales o familiares."
      ),
      pr(
        { type: "text", text: "Podés leer nuestras políticas generales en " },
        { type: "link", text: "Privacidad", href: "/privacidad" },
        { type: "text", text: ", el apartado " },
        { type: "link", text: "Privacidad para escuelas", href: "/privacidad/escuelas" },
        { type: "text", text: " y la información sobre " },
        { type: "link", text: "consentimiento biométrico", href: "/consentimiento-biometrico" },
        { type: "text", text: " cuando aplique el uso de selfie o reconocimiento facial." }
      ),
      h2("Galería oculta hasta selfie: menos exposición pública"),
      p(
        "Una de las funciones más relevantes en contextos escolares es «Ocultar galería hasta selfie» (también configurable como fotos ocultas hasta selfie). Las imágenes del evento no quedan visibles en navegación libre: cada familia debe realizar una verificación mediante selfie antes de acceder a las fotografías asociadas a esa identidad. Buscamos reducir la exposición pública de las imágenes y mejorar el control de acceso sin complicar en exceso la compra."
      ),
      pr(
        { type: "text", text: "El funcionamiento detallado está en " },
        {
          type: "link",
          text: "cómo protegemos la privacidad con Ocultar galería hasta selfie",
          href: "/blog/seguridad-escolar-ocultar-galeria-hasta-selfie",
        },
        { type: "text", text: " y en " },
        {
          type: "link",
          text: "cómo funciona la privacidad de las fotografías escolares",
          href: "/blog/como-funciona-privacidad-fotografias-escolares",
        },
        { type: "text", text: "." }
      ),
      h3("Beneficio para padres"),
      p(
        "Las familias perciben mayor tranquilidad cuando no tienen que recorrer galerías completas con fotos de otros alumnos antes de encontrar a su hijo o hija. El proceso es guiado: verificación, coincidencias, compra. Eso no elimina la necesidad de autorizaciones firmadas, pero sí muestra un proveedor que tomó en serio el acceso a imágenes de menores."
      ),
      h3("Beneficio para escuelas"),
      p(
        "Directivos y equipos de convivencia pueden presentar un flujo más ordenado en reuniones con padres: link controlado, verificación previa, menos navegación abierta. La funcionalidad está pensada para mejorar el control de acceso; la institución sigue siendo responsable de definir si la campaña fotográfica se realiza y bajo qué condiciones."
      ),
      h3("Beneficio para fotógrafos escolares"),
      p(
        "Ofrecer herramientas de privacidad diferencia tu servicio frente a carpetas compartidas o galerías sin restricciones. Combinado con preventa, packs familiares y entrega digital, forma parte de un discurso profesional que las escuelas valoran cada vez más."
      ),
      pr(
        { type: "text", text: "Si trabajás con colegios, revisá también " },
        {
          type: "link",
          text: "cómo crear una galería escolar",
          href: "/blog/como-crear-galeria-escolar",
        },
        { type: "text", text: " y las " },
        {
          type: "link",
          text: "soluciones para escuelas",
          href: "https://www.compramelafoto.com/escuelas",
        },
        { type: "text", text: " en ComprameLaFoto." }
      ),
      h2("Uso responsable de reconocimiento facial y selfie"),
      p(
        "La búsqueda por selfie y las verificaciones de identidad utilizan comparación de rostros para facilitar la compra o restringir el acceso. Ese uso debe ser proporcional al fin: encontrar fotos del evento o mostrar solo las imágenes relevantes para quien se verificó. Trabajamos con criterios de privacidad orientados a no ampliar el tratamiento más allá de lo necesario para ese servicio."
      ),
      pr(
        { type: "text", text: "Para el detalle operativo del buscador, leé " },
        {
          type: "link",
          text: "cómo funciona el reconocimiento por selfie",
          href: "/blog/como-funciona-reconocimiento-por-selfie",
        },
        { type: "text", text: ". Conviene informar a las familias cuándo se usa selfie, con qué fin y qué alternativas existen si alguien no desea utilizarla." }
      ),
      p(
        "Recomendamos transparencia en la comunicación del colegio y del fotógrafo: qué datos se solicitan, por cuánto tiempo pueden conservarse según configuración y a quién contactar ante dudas. Ningún algoritmo es infalible; por eso el flujo contempla reintentos y atención humana cuando hace falta."
      ),
      h2("Seguridad operativa y buenas prácticas"),
      h3("Para instituciones educativas"),
      ul([
        "Mantener autorizaciones de imagen actualizadas según su normativa interna.",
        "Comunicar a las familias el flujo de acceso antes de abrir la venta.",
        "Evitar difundir links en grupos abiertos sin contexto.",
        "Designar un referente interno para consultas de padres.",
        "Revisar con el fotógrafo qué funciones de privacidad estarán activas.",
      ]),
      h3("Para fotógrafos y organizadores"),
      ul([
        "Activar galería oculta hasta selfie cuando el colegio o el evento lo requiera.",
        "No prometer garantías legales que correspondan a asesores o a la institución.",
        "Usar previews protegidas y checkout centralizado en lugar de enviar archivos sueltos.",
        "Documentar qué se acordó con la escuela sobre acceso y plazos de publicación.",
        "Capacitar brevemente al staff del evento sobre el mensaje al público.",
      ]),
      h3("Para padres y participantes"),
      ul([
        "Leer la comunicación del colegio o del organizador antes de acceder.",
        "Usar selfies solo en el contexto del evento autorizado.",
        "Consultar por canales oficiales ante dudas sobre imagen de menores.",
        "Evitar reenviar capturas de fotos de terceros.",
      ]),
      h2("Lo que la plataforma no hace"),
      p(
        "ComprameLaFoto no reemplaza el criterio pedagógico ni legal de una escuela sobre si se pueden fotografiar menores en un acto determinado. No elimina la necesidad de consentimientos familiares cuando la institución los exige. No convierte una herramienta técnica en certificación de cumplimiento normativo automático. Sí aporta controles de acceso, pagos ordenados y funciones que buscan reducir la exposición pública innecesaria de las imágenes."
      ),
      p(
        "Cada organizador, fotógrafo y establecimiento educativo debe evaluar, con sus asesores cuando corresponda, si el uso de reconocimiento facial o de galerías restringidas es adecuado para su comunidad. Nosotros ponemos las herramientas; la decisión institucional y familiar sigue siendo fundamental."
      ),
      h2("Confianza como parte del negocio fotográfico"),
      p(
        "Vender fotografías en 2026 no es solo cuestión de precio y calidad de imagen. Padres y directivos preguntan cómo se protegen las fotos de los chicos. Corredores y asistentes a eventos preguntan quién puede ver qué. Un fotógrafo o organizador que responde con procesos claros —y con tecnología que respalda esas respuestas— cierra más campañas y repite contratos. La privacidad dejó de ser un apéndice: es parte del valor percibido del servicio."
      ),
      p(
        "Seguimos mejorando controles y documentación a medida que evolucionan las expectativas del mercado y el marco regulatorio. Si tenés sugerencias desde una institución educativa o un estudio fotográfico, podés canalizarlas por nuestros medios de contacto oficiales. La confianza se construye con hechos, comunicación honesta y herramientas alineadas al cuidado de las personas fotografiadas."
      ),
    ],
    faq: [
      {
        q: "¿ComprameLaFoto cumple automáticamente con la Ley 25.326?",
        a: "Trabajamos con criterios de privacidad y publicamos políticas claras, pero cada uso debe evaluarse en su contexto. Este artículo no es asesoramiento legal; recomendamos que las instituciones consulten a sus asesores y sigan las orientaciones de la AAIP.",
      },
      {
        q: "¿Qué es la AAIP?",
        a: "Es la Agencia de Acceso a la Información Pública de Argentina, organismo vinculado a la protección de datos personales y referente en la materia en nuestro país.",
      },
      {
        q: "¿La galería oculta hasta selfie reemplaza la autorización de imagen?",
        a: "No. Es una herramienta técnica de control de acceso. Las autorizaciones institucionales o familiares siguen siendo responsabilidad del colegio y de quien contrata la cobertura fotográfica.",
      },
      {
        q: "¿Se guardan las selfies para siempre?",
        a: "Las selfies de verificación o búsqueda se procesan en el contexto del servicio. Consultá nuestras políticas de privacidad y consentimiento biométrico para información actualizada sobre retención y finalidad.",
      },
      {
        q: "¿Puedo vender fotos escolares sin reconocimiento facial?",
        a: "Sí. Las funciones de selfie y galería oculta son opcionales según el acuerdo con la institución. Podés configurar el flujo que mejor se adapte a cada campaña dentro de las herramientas disponibles.",
      },
      {
        q: "¿Dónde leo las políticas del sitio?",
        a: "En las páginas de Privacidad, Privacidad para escuelas y Consentimiento biométrico del sitio, accesibles desde el pie de página de ComprameLaFoto.",
      },
    ],
    conclusion:
      "Proteger datos y privacidad en la venta de fotografías es una responsabilidad compartida entre plataforma, fotógrafos, organizadores, escuelas y familias. En ComprameLaFoto buscamos reducir la exposición pública de las imágenes, mejorar el control de acceso con herramientas como la galería oculta hasta selfie y usar la tecnología —incluido el reconocimiento facial— de forma responsable y proporcional. Si sos escuela, fotógrafo escolar u organizador y querés vender fotos de manera ordenada, profesional y con mayor cuidado de la privacidad, conocé ComprameLaFoto y evaluá cómo nuestras funcionalidades encajan con tus autorizaciones y políticas internas.",
    ctaAudience: "escuelas",
    imageScene:
      "School principal and photographer reviewing privacy checklist on tablet in bright office, parents waiting area blurred, trust and professionalism mood, documentary photography style",
    imageAltSubject: "Directivo escolar y fotógrafo revisando privacidad en campaña fotográfica",
    imageCaption: "Privacidad y venta ordenada: herramientas pensadas para contextos con menores y datos sensibles.",
  },
};
