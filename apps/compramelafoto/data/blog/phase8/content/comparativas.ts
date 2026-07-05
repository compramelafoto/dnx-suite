import type { Phase8ArticleContent } from "@/data/blog/phase8/types";
import { h2, h3, p, ul } from "@/data/blog/phase8/editorial-nodes";
import { CLF_KNOWLEDGE } from "@/data/blog/phase8/knowledge";

export const COMPARATIVAS_PHASE8: Record<string, Phase8ArticleContent> = {
  "compramelafoto-vs-mirelia": {
    seoTitle: "ComprameLaFoto vs Mirelia: comparativa objetiva para fotógrafos",
    seoDescription:
      "Comparación imparcial entre ComprameLaFoto y Mirelia: pagos locales, eventos, escuelas y criterios para elegir según tu negocio en Argentina.",
    excerpt:
      "Comparación objetiva entre ComprameLaFoto y Mirelia para fotógrafos de eventos y escuelas en Argentina.",
    blocks: [
      p(
        "Elegir una plataforma para vender fotografías no es solo una decisión técnica: define cómo cobrás, cómo entregás y cuánto tiempo dedicás a tareas administrativas después de cada evento. Mirelia y ComprameLaFoto pertenecen al mismo universo de producto — plataformas orientadas a la venta de imágenes de eventos y proyectos fotográficos — pero pueden diferir en enfoque comercial, mercado objetivo y modelo operativo. Esta comparativa no busca declarar un ganador absoluto; busca darte criterios claros para decidir según tu tipo de trabajo, volumen y prioridades.",
      ),
      h2("Resumen ejecutivo"),
      p(
        "ComprameLaFoto está diseñada para el mercado argentino, con cobros vía Mercado Pago, flujos para eventos masivos, fotografía escolar, colaboración con organizadores y entrega digital automática tras el pago. Mirelia, en términos generales de categoría de producto, es otra plataforma de venta de fotografías que suele apuntar a fotógrafos que cubren eventos, escuelas u otros proyectos con necesidad de galería y checkout online.",
      ),
      p(
        "Sin acceso a documentación pública detallada y actualizada de Mirelia en el momento de redactar este artículo, no afirmamos funcionalidades puntuales de esa plataforma. Lo que sí podemos comparar con rigor es el encaje de cada opción según perfiles de uso: fotógrafo independiente de eventos, proveedor escolar, operador de alto volumen o quien recién migra desde métodos informales.",
      ),
      p(
        "En la práctica, la decisión suele depender de tres ejes: facilidad de cobro local para tus clientes, tiempo que ahorrás en entrega y soporte, y alineación con el tipo de eventos que cubrís (deportivos masivos, escolares, sociales o corporativos). Si tu operación está centrada en Argentina y necesitás un flujo integral de venta y entrega, ComprameLaFoto suele ser la opción más directa. Si ya tenés contrato, flujo o relación comercial consolidada con Mirelia, evaluar costos de migración y continuidad es tan importante como comparar features en abstracto.",
      ),
      p(
        "También conviene separar lo que necesitás hoy de lo que imaginás necesitar en dos temporadas. Un fotógrafo que hoy hace quince fiestas de egresados por año tiene prioridades distintas a uno que cubre ocho maratones y tres colegios grandes. La comparativa honesta empieza por escribir tu mix real de eventos, ticket promedio actual, horas semanales en entrega manual y porcentaje de ventas que hoy se pierden por demora o fricción de pago. Esos números valen más que cualquier lista de funcionalidades copiada de una landing.",
      ),
      h2("Para quién es cada opción"),
      h3("ComprameLaFoto"),
      p(
        "ComprameLaFoto encaja especialmente bien con fotógrafos argentinos que venden en eventos deportivos, fiestas, recitales, corporativos y proyectos escolares. También con organizadores que quieren centralizar la venta y, en algunos modelos, participar de comisiones. El perfil típico valora cobrar en pesos con medios locales, publicar rápido después del evento y reducir la gestión manual por WhatsApp.",
      ),
      h3("Mirelia"),
      p(
        "En términos de categoría, Mirelia apunta a fotógrafos y estudios que necesitan una plataforma de venta online de imágenes, habitualmente en contextos de eventos o servicios fotográficos con entrega digital. El encaje concreto depende de su cobertura geográfica, condiciones comerciales y herramientas vigentes en el momento de tu evaluación — aspectos que conviene confirmar directamente con su sitio o soporte antes de decidir.",
      ),
      ul([
        "ComprameLaFoto: fotógrafos y organizadores con foco en Argentina, alto volumen y automatización de entrega.",
        "Mirelia: fotógrafos que buscan una plataforma de venta de fotos en su categoría de producto y deben validar encaje local por su cuenta.",
        "Ambas compiten conceptualmente en el espacio «galería + venta»; la diferencia práctica está en mercado, pagos y operación diaria.",
      ]),
      p(
        "Si sos organizador de carreras o coordinador escolar, el perfil cambia: no solo evaluás tu experiencia como fotógrafo, sino si la plataforma facilita un link único, comisiones claras y menos consultas de padres o corredores por canales informales. ComprameLaFoto contempla explícitamente ese rol colaborativo; para Mirelia, confirmá con su equipo si el modelo encaja con tu convenio antes de prometerlo a terceros.",
      ),
      h2("Funcionalidades de ComprameLaFoto"),
      p(
        "Según la oferta pública de ComprameLaFoto, la plataforma cubre venta de fotografías digitales e impresiones, álbumes y galerías por evento o escuela, packs y descuentos por cantidad, preventa escolar, eventos colaborativos con organizadores, comisiones para organizadores, búsqueda por selfie en eventos masivos, marketplace de fotógrafos, entrega digital automática tras el pago y programa de referidos. Los pagos se procesan con Mercado Pago.",
      ),
      p(
        "Para eventos deportivos, la búsqueda por selfie y la organización por álbum reducen fricción cuando hay miles de participantes. En escuelas, la preventa y los bundles familiares ayudan a concentrar ventas en ventanas cortas. Para el fotógrafo independiente, el marketplace permite visibilidad adicional más allá de la difusión propia.",
      ),
      h2("Funcionalidades de la alternativa"),
      p(
        "Mirelia, como plataforma de su categoría, suele orientarse a ofrecer un entorno para publicar trabajos fotográficos y convertirlos en ventas online. Eso puede incluir, en términos generales del rubro, galerías o álbumes privados, selección de fotos por el cliente y un proceso de compra digital — pero la lista exacta, integraciones, límites de almacenamiento y herramientas de marketing deben verificarse en su documentación oficial.",
      ),
      p(
        "No asumimos que Mirelia tenga o no búsqueda por selfie, preventa escolar, comisiones para organizadores o un marketplace equivalente. Si alguno de esos puntos es crítico para tu negocio, contrastalo explícitamente en una prueba con datos reales de tu próximo evento.",
      ),
      h2("Ventajas de ComprameLaFoto"),
      ul([
        "Enfoque en Argentina: pagos con Mercado Pago y lenguaje operativo alineado al mercado local.",
        "Flujos pensados para volumen en deportes y escuelas, no solo para sesiones pequeñas.",
        "Entrega digital automática tras el pago, lo que reduce carga manual post-evento.",
        "Colaboración con organizadores y comisiones, útil en torneos y carreras.",
        "Programa de referidos para quienes recomiendan fotógrafos que venden en la plataforma.",
      ]),
      p(
        "Otra ventaja práctica es la coherencia del ecosistema: el cliente compra, paga y descarga en un mismo lugar, lo que mejora la percepción de profesionalismo frente a links sueltos o carpetas compartidas.",
      ),
      h2("Limitaciones de ComprameLaFoto"),
      ul([
        "Está optimizada para el mercado argentino; si vendés principalmente al exterior, debés evaluar medios de pago y expectativas de clientes internacionales.",
        "Como cualquier plataforma de nicho, tiene reglas de uso, fees de marketplace y políticas que conviene leer antes de escalar volumen.",
        "La curva de aprendizaje inicial existe si venís de métodos 100 % manuales: configurar álbumes, precios y comunicación lleva tiempo la primera vez.",
        "No reemplaza por sí sola tu marketing: la plataforma facilita la venta, pero la difusión del evento sigue siendo responsabilidad tuya o del organizador.",
      ]),
      p(
        "Otra limitación general de cualquier plataforma especializada frente a un proveedor con el que llevás años: el costo de cambio. Reconfigurar precios, reeducar clientes, migrar histórico y renegociar con organizadores lleva tiempo. Por eso la comparativa no empuja a migrar por principio; empuja a decidir con datos cuando el dolor operativo ya es medible.",
      ),
      h2("Ventajas de la alternativa"),
      p(
        "Una plataforma de venta de fotografías como Mirelia puede resultar ventajosa si ya la conocés, tenés historial de ventas allí o tu red de colegas la usa de forma estándar. En ese escenario, la curva de adopción es baja y el riesgo operativo de cambiar de sistema puede no compensar.",
      ),
      p(
        "También puede ser razonable si sus condiciones comerciales vigentes — según lo que negocies o consultes oficialmente — se ajustan mejor a tu mix de productos o a un tipo de cliente que ya está acostumbrado a esa interfaz. La ventaja aquí es la continuidad, no necesariamente una superioridad técnica demostrable sin prueba lado a lado.",
      ),
      h2("Limitaciones de la alternativa"),
      p(
        "Sin inventar detalles de producto, las limitaciones típicas de comparar cualquier plataforma del rubro frente a una solución hiperlocal incluyen: incertidumbre sobre medios de pago preferidos por tu audiencia argentina, posible necesidad de adaptar comunicación y soporte, y falta de visibilidad pública sobre funciones específicas para organizadores o escuelas hasta que las pruebes.",
      ),
      p(
        "Si dependés de integraciones, reportes o flujos muy concretos, la ausencia de información pública verificable se convierte en un riesgo: lo que no confirmes antes del evento, lo descubrís bajo presión después.",
      ),
      h2("Cuándo elegir cada una"),
      ul([
        "Elegí ComprameLaFoto si tu prioridad es vender en Argentina con Mercado Pago, automatizar entrega, trabajar con organizadores o escuelas y cubrir eventos masivos con búsqueda rápida.",
        "Considerá Mirelia si ya operás allí con resultados satisfactorios, si tus clientes están habituados a esa plataforma o si tras una demo oficial confirmás que cubre tus requisitos no negociables.",
        "Hacé una prueba paralela con un evento pequeño si dudás: mismas fotos, dos flujos, mismas métricas de conversión y tiempo administrativo.",
        "No elijas solo por precio de suscripción o fee en abstracto: medí conversión, tiempo de entrega y reclamos.",
      ]),
      p(
        "Checklist práctico antes de firmar una temporada completa: hacé una compra de prueba en cada opción con un monto real, medí minutos desde que subís hasta que un cliente externo puede comprar, pedí a un colega que se busque por selfie o navegación sin tu ayuda, y compará cuántos mensajes de soporte recibís en las primeras veinticuatro horas. Ese mini experimento suele decidir más que una tabla comparativa estática.",
      ),
      p(
        "Si trabajás con organizadores que ya tienen preferencia de plataforma, conversá con transparencia: a veces el mejor acuerdo es estandarizar un link por circuito de eventos, aunque eso implique negociar fees o responsabilidades de difusión. La herramienta correcta es la que todos los actores del evento están dispuestos a usar de forma consistente.",
      ),
      p(
        "Por último, recordá que ninguna comparativa reemplaza el contrato con tu organizador ni la confianza de tu cartera escolar. La plataforma es infraestructura; la relación comercial sigue siendo tuya. Elegí la herramienta que te permita honrar esas relaciones con menos fricción operativa cada fin de semana.",
      ),
      p(
        "Al evaluar Mirelia, pedí por escrito confirmación de medios de pago disponibles para compradores argentinos y de soporte en horario local. Sin eso, asumir equivalencia con una plataforma pensada para Mercado Pago es arriesgado.",
      ),
      p(
        "Si tu organizador ya usa otra herramienta, negociá quién comunica el link y quién responde consultas. La mejor plataforma mal comunicada pierde contra una mediocre con difusión excelente.",
      ),
      p(
        "Considerá el costo de capacitar a clientes mayores o instituciones con poca familiaridad digital. Cada clic extra en el checkout reduce conversión en fotografía escolar.",
      ),
      p(
        "Un último criterio es la capacidad de tu equipo: si trabajás con asistentes o editores externos, necesitás un flujo que cualquiera pueda ejecutar un domingo sin llamarte. ComprameLaFoto estandariza publicación y venta; otra plataforma puede ser igual de válida si su manual interno es claro y probado en Argentina.",
      ),
      p(
        "Un ejercicio útil es simular el recorrido del comprador con alguien que no sea fotógrafo: tu madre buscando la foto del nieto en un torneo, o un corredor con el celular mojado después de la meta. Si en ese recorrido aparecen más de tres pasos confusos o un pago que no reconocen, la plataforma — sea cual sea — está fallando en tu mercado real, no en una demo de escritorio.",
      ),
      p(
        "Las comparativas en foros suelen mezclar opiniones de quien hace bodas premium con quien cubre escuelas públicas. Filtrá testimonios por tipo de evento y volumen antes de tomar una decisión. Lo que funciona para quince sesiones al año no escala igual que para quince mil fotos en un fin de semana.",
      ),
      p(
        "Si negociás con un organizador que ya tiene relación con otra plataforma, preguntá qué les dolió el año pasado: demora de publicación, reclamos de padres, conciliación de pagos. Esas respuestas orientan más que una tabla de precios. A veces el organizador prefiere estabilidad operativa aunque otra herramienta parezca más barata en papel.",
      ),
      p(
        "Documentá por escrito qué validaste de Mirelia antes de comprometer una temporada: medios de pago, soporte, tiempos de carga, experiencia mobile. Ese registro te protege si el acuerdo con el club exige rendición de cuentas o si un colega te pregunta por qué elegiste una u otra.",
      ),
      p(
        "El fee de plataforma es solo una línea del presupuesto. Sumá horas de soporte, costo de oportunidad si publicás tarde y ventas perdidas por fricción. Una comisión ligeramente mayor con mejor conversión puede dejarte más neto que la opción «más barata» con checkout incómodo.",
      ),
    ],
    faq: [
      {
        q: "¿Puedo usar ambas plataformas a la vez?",
        a: "Técnicamente podés publicar en más de un lugar, pero duplicar esfuerzos de carga, precios y soporte suele ser ineficiente. Mejor elegir un canal principal por tipo de evento.",
      },
      {
        q: "¿Esta comparativa garantiza que Mirelia no tenga ciertas funciones?",
        a: "No. Describimos categorías de producto y criterios de decisión. Las capacidades concretas de Mirelia deben confirmarse en su documentación o soporte oficial.",
      },
      {
        q: "¿Qué debería probar antes de migrar?",
        a: "Checkout con un cliente real, tiempo de publicación post-evento, entrega digital, reportes de ventas y experiencia mobile. Esos cinco puntos suelen revelar más que cualquier tabla de features.",
      },
      {
        q: "¿La comisión de plataforma es el único costo a evaluar?",
        a: "No. Sumá horas de soporte, tiempo de carga, herramientas complementarias y costo de oportunidad si publicás tarde. El fee es una parte del costo total de operar.",
      },
    ],
    conclusion:
      "ComprameLaFoto y Mirelia compiten en el mismo espacio conceptual de venta de fotografías online, pero la elección inteligente depende de tu mercado, tu volumen y lo que ya tenés funcionando. Para operaciones centradas en Argentina con cobro local y flujos de eventos o escuelas, ComprameLaFoto ofrece un encaje claro y verificable. Para Mirelia, la recomendación objetiva es validar condiciones y herramientas vigentes con fuentes oficiales y, si es posible, un evento piloto antes de comprometer toda tu temporada.",
    ctaAudience: "fotografos",
    imageScene:
      "Two photographers comparing software on laptops side by side in neutral studio, balanced composition",
    imageAltSubject:
      "Dos fotógrafos comparando plataformas de venta en sus notebooks",
  },

  "compramelafoto-vs-pixieset": {
    seoTitle:
      "ComprameLaFoto vs Pixieset: diferencias para fotógrafos en Argentina",
    seoDescription:
      "Pixieset es referencia global en galerías; ComprameLaFoto está pensada para el mercado argentino. Comparativa objetiva de encaje, pagos y operación.",
    excerpt:
      "ComprameLaFoto y Pixieset: diferencias en pagos locales, eventos masivos y fotografía escolar.",
    blocks: [
      p(
        "Pixieset es una referencia internacional en el mundo de las galerías para fotógrafos profesionales. ComprameLaFoto, en cambio, nació con foco en el mercado argentino y en flujos de venta de eventos y escuelas. Compararlas no es contrastar «mejor o peor» en abstracto, sino entender dos propuestas de categoría distinta que a veces se solapan y a veces no. Esta guía está pensada para fotógrafos que ya escucharon hablar de Pixieset — por formación, por redes o por clientes corporativos — y necesitan decidir si tiene sentido para su realidad local.",
      ),
      h2("Resumen ejecutivo"),
      p(
        "Pixieset pertenece a la categoría de plataformas globales de galerías y venta para fotógrafos, con fuerte presencia en bodas, retrato y estudios que buscan una experiencia de cliente pulida y estándares internacionales. ComprameLaFoto se orienta a la venta de fotografías en Argentina, con Mercado Pago, eventos deportivos masivos, fotografía escolar, colaboración con organizadores y entrega digital automatizada.",
      ),
      p(
        "No detallamos aquí funcionalidades específicas de Pixieset — planes, integraciones o módulos concretos — porque pueden cambiar y no todas son públicas de forma uniforme. Sí podemos afirmar con claridad qué problema resuelve cada una en términos generales: Pixieset compite en el ecosistema global de galerías profesionales; ComprameLaFoto compite en operación local de venta y entrega para eventos y escuelas.",
      ),
      p(
        "Para un fotógrafo argentino de maratones, torneos o colegios, la pregunta relevante suele ser: ¿mis clientes pagan fácil en pesos? ¿Puedo publicar miles de fotos y que las encuentren rápido? ¿Cuánto tiempo paso enviando archivos a mano? En esas preguntas, el encaje local pesa más que la reputación internacional de una marca.",
      ),
      p(
        "Otro matiz importante es el costo total de propiedad: no solo la suscripción o el fee por venta, sino horas de soporte, herramientas complementarias para pagos locales, tipo de cambio si facturás en dólares y tiempo de capacitación de clientes poco familiarizados con interfaces en inglés. Una plataforma global puede ser excelente en su nicho y aun así ser cara en tiempo humano para tu operación del fin de semana en Rosario o Mendoza.",
      ),
      p(
        "Finalmente, considerá la expectativa del organizador. Muchos contratos deportivos y escolares en Argentina se cierran con la promesa de «link único y pago fácil para familias». Cumplir esa promesa con fricción mínima pesa más en renovación de contrato que el prestigio internacional de la herramienta que uses detrás.",
      ),
      h2("Para quién es cada opción"),
      h3("ComprameLaFoto"),
      p(
        "Fotógrafos y organizadores que venden principalmente en Argentina, con necesidad de cobros locales, alto volumen en deportes o escuelas, y preferencia por un flujo unificado de venta y entrega. También quienes trabajan con preventa escolar, packs y comisiones para organizadores.",
      ),
      h3("Pixieset"),
      p(
        "Fotógrafos que buscan una plataforma de galerías de categoría internacional, frecuentemente en bodas, sesiones privadas, estudios de retrato o clientes que ya esperan ese tipo de experiencia de galería. El encaje en eventos masivos o escuelas argentinas debe evaluarse caso por caso con pruebas reales, no por reputación de marca.",
      ),
      p(
        "Híbrido frecuente: estudio con línea de bodas premium internacional y línea de eventos locales masivos. Ese estudio puede terminar usando herramientas distintas por línea de negocio si el margen lo permite. La pregunta no es «una sola plataforma para todo», sino «¿qué herramienta minimiza fricción en cada flujo de ingresos?».",
      ),
      h2("Funcionalidades de ComprameLaFoto"),
      p(
        "ComprameLaFoto integra venta digital e impresiones, álbumes por evento o escuela, packs, preventa escolar, eventos colaborativos, comisiones para organizadores, búsqueda por selfie en eventos masivos, marketplace, entrega automática tras el pago y referidos. Pagos con Mercado Pago.",
      ),
      p(
        "El diseño operativo prioriza velocidad post-evento y reducción de fricción para el comprador local: menos pasos entre «vi mi foto» y «la tengo en el celular». Para el fotógrafo, eso se traduce en menos mensajes de «¿me la podés mandar por WhatsApp?».",
      ),
      h2("Funcionalidades de la alternativa"),
      p(
        "Pixieset, en su categoría de producto global, suele asociarse a galerías online para fotógrafos profesionales, presentación cuidada de trabajos, venta de digitales e impresiones y herramientas orientadas a la experiencia del cliente en sesiones contratadas. La profundidad exacta de catálogo, e-commerce, marketing o apps móviles debe consultarse en su sitio oficial.",
      ),
      p(
        "No afirmamos que Pixieset ofrezca o no búsqueda por selfie para maratones, preventa escolar con dinámica local o split de comisiones con organizadores argentinos. Esos son puntos de validación práctica, no de marketing comparativo.",
      ),
      p(
        "En sesiones premium, las plataformas globales suelen invertir en presentación visual, pruebas de selección para clientes y flujos de aprobación. En eventos masivos, la prioridad se desplaza hacia ingestión rápida, búsqueda y checkout mobile. Comparar Pixieset con ComprameLaFoto sin separar esos dos mundos lleva a conclusiones incorrectas.",
      ),
      h2("Ventajas de ComprameLaFoto"),
      ul([
        "Mercado y pagos argentinos con Mercado Pago.",
        "Flujos para eventos de alto volumen y fotografía escolar.",
        "Búsqueda por selfie y herramientas de descubrimiento en eventos masivos.",
        "Colaboración con organizadores y modelo de comisiones.",
        "Entrega digital automática integrada al checkout.",
      ]),
      p(
        "Además, la comunicación comercial y el soporte contextual están alineados con cómo se venden fotos en eventos locales: urgencia post-carrera, grupos de padres en colegios, torneos de fin de semana.",
      ),
      h2("Limitaciones de ComprameLaFoto"),
      ul([
        "Menor reconocimiento de marca a nivel global frente a players internacionales consolidados.",
        "Si tu cliente corporativo exige explícitamente una galería con estándar «internacional» por política interna, puede haber preferencia por otra herramienta.",
        "La estética de galería y personalización pueden diferir de lo que ofrecen plataformas enfocadas en sesiones premium de estudio.",
      ]),
      h2("Ventajas de la alternativa"),
      p(
        "Pixieset puede ser ventajosa cuando tu cliente ya conoce ese tipo de galería, cuando tu negocio mezcla mercado internacional o cuando tu propuesta de valor es una experiencia de presentación de nivel estudio en sesiones contratadas puntuales. La marca global también facilita ciertas conversaciones con clientes corporativos multinacionales, aunque eso no garantiza por sí solo mejor conversión en pesos.",
      ),
      h2("Limitaciones de la alternativa"),
      p(
        "Para venta masiva en Argentina, las limitaciones típicas a evaluar en cualquier plataforma global incluyen: medios de pago preferidos por tu audiencia, costos en moneda extranjera si aplican, soporte en huso horario local y herramientas específicas para deporte escolar o preventa con dinámica institucional argentina. Sin prueba en campo, asumir que una galería premium resuelve un torneo de ocho canchas simultáneas es un error común.",
      ),
      h2("Cuándo elegir cada una"),
      ul([
        "ComprameLaFoto: eventos deportivos, escuelas, fiestas y venta local recurrente con Mercado Pago.",
        "Pixieset: sesiones y galerías donde la experiencia internacional de galería es parte central de tu propuesta y tus clientes lo valoran explícitamente.",
        "Convivencia posible pero costosa: algunos fotógrafos usan una herramienta para sesiones premium y otra para eventos masivos; solo tiene sentido si el margen y el tiempo administrativo lo justifican.",
      ]),
      p(
        "Matriz de decisión rápida: si más del sesenta por ciento de tu facturación viene de eventos con más de trescientos compradores potenciales, priorizá herramienta local de volumen. Si más del sesenta por ciento viene de sesiones contratadas uno a uno con cliente premium, evaluá galería internacional. En el medio, prueba piloto de cuatro semanas con un evento chico y una sesión real.",
      ),
      p(
        "Documentá en una hoja: tiempo de carga, conversión, soporte manual, ingreso neto después de fees y renovación de contrato con organizador. Esas cinco celdas bastan para decidir sin debate ideológico en foros.",
      ),
      p(
        "Pixieset puede brillar en presentación de sesiones contratadas; ComprameLaFoto en operación de evento con urgencia. No mezcles esos criterios al votar.",
      ),
      p(
        "Si exportás fuera de Argentina, evaluá si tus ingresos en pesos justifican suscripción o fees en otra moneda. El tipo de cambio puede comer el margen de un fin de semana entero.",
      ),
      p(
        "Probá checkout mobile con un familiar no fotógrafo. Si no compra solo en tres minutos, tenés trabajo de UX independientemente de la marca.",
      ),
      p(
        "Pixieset construyó reputación en mercados donde el fotógrafo vende sesiones contratadas y el cliente espera una galería cuidada. Ese contexto es distinto al de un corredor anónimo que quiere dos fotos del domingo. Comparar ambas sin separar esos mundos lleva a frustración y a elegir herramienta por prestigio, no por encaje.",
      ),
      p(
        "Si tu cliente corporativo multinacional pide explícitamente una galería con estándar internacional, Pixieset puede facilitar la conversación comercial aunque no garantice mejor conversión en pesos. Pero si tu ingreso principal es escuela o running local, la pregunta es operativa: ¿cuántos minutos pasa el padre desde el link hasta la descarga pagada?",
      ),
      p(
        "Los costos en moneda extranjera — suscripción, fees o add-ons — deben convertirse a pesos con tipo de cambio realista y amortizarse sobre ventas esperadas del trimestre. Un fin de semana flojo puede comer el margen de toda la suscripción anual si no dimensionaste bien el volumen.",
      ),
      p(
        "Algunos estudios mantienen Pixieset para bodas premium y ComprameLaFoto para eventos masivos. Ese híbrido tiene sentido si el margen lo permite y si tu equipo no confunde flujos de publicación. Si sos un operador solitario, dos stacks paralelos suelen duplicar errores más que duplicar ingresos.",
      ),
      p(
        "Probá checkout mobile con un familiar no fotógrafo en cada opción. Si no compra solo en tres minutos, tenés trabajo de UX independientemente de la marca. En deporte y escuela, el celular es el canal principal de compra.",
      ),
      p(
        "La estética de galería importa en sesiones premium; en maratones importa la velocidad de búsqueda. Priorizá según dónde está tu facturación, no según lo que más te gusta diseñar.",
      ),
      p(
        "Antes de importar precios o packs de un mercado dolarizado, ajustalos al ticket que tu audiencia local tolera. Una galería internacional no corrige un precio desalineado con el poder adquisitivo de familias o clubes de tu zona.",
      ),
      p(
        "Si exportás trabajo al exterior ocasionalmente, evaluá si necesitás plataforma global para ese diez por ciento del ingreso o si un flujo aparte para esos clientes basta sin migrar todo el negocio.",
      ),
      p(
        "Una comparativa objetiva no elige por vos: ordena preguntas. Respondelas con números de tu última temporada y la decisión se vuelve evidente sin debate ideológico en grupos de Facebook.",
      ),
      p(
        "Pedí a un colega que haga una compra de prueba en cada opción sin tu ayuda. Cronometrá el proceso desde el link hasta la descarga. Esa medición vale más que diez opiniones en un hilo de Twitter.",
      ),
      p(
        "El organizador del evento a veces impone la plataforma. Si es tu cliente comercial principal, negociá condiciones de difusión y soporte antes de discutir features técnicas que el club ni entiende.",
      ),
      p(
        "Registrá en una planilla: fee, horas de soporte post-evento, conversión estimada y reclamos. Compará filas, no logos. El logo más lindo no envía archivos mientras dormís.",
      ),
      p(
        "Si migrás, comunicá el cambio con anticipación a clientes recurrentes y ofrecé un primer checkout guiado. La resistencia al cambio dura un evento si la experiencia nueva es claramente más simple.",
      ),
      p(
        "No confundas «conozco la interfaz» con «esta herramienta maximiza mis ventas». La comodidad personal del fotógrafo importa, pero el comprador anónimo del domingo vota con su billetera y su paciencia.",
      ),
      p(
        "Revisá políticas de devolución, contracargos y soporte en ambas opciones antes de la temporada alta. Descubrir esas reglas con un reclamo real en mano es la peor clase posible.",
      ),
      p(
        "La plataforma es infraestructura; tu relación con el organizador y la calidad de tu cobertura siguen siendo el motor del negocio. Elegí herramienta que no te robe horas para dedicarlas a lo que solo vos hacés bien.",
      ),
      p(
        "Considerá el perfil digital de tu audiencia: edad, hábito de pago, uso de celular vs desktop. Una herramienta perfecta en desktop pierde ventas si tus compradores están en el tren con el teléfono en la mano.",
      ),
      p(
        "Documentá cada prueba piloto con fecha, evento y resultado. En dos años no vas a recordar por qué elegiste; un log breve te ahorra repetir experimentos fallidos.",
      ),
      p(
        "Si tu margen es ajustado, priorizá conversión sobre estética de galería. Un checkout feo que funciona puede dejar más plata que una galería hermosa que nadie termina de pagar.",
      ),
    ],
    faq: [
      {
        q: "¿Pixieset acepta Mercado Pago?",
        a: "Las pasarelas disponibles en plataformas globales cambian. Verificá en la documentación oficial de Pixieset qué métodos de pago ofrece para tu país antes de asumir compatibilidad con hábitos de pago argentinos.",
      },
      {
        q: "¿Puedo usar ComprameLaFoto solo para deportes y otra galería para bodas?",
        a: "Sí, si podés sostener dos flujos operativos sin errores de entrega o precios. Muchos fotógrafos especializan herramienta por línea de negocio.",
      },
      {
        q: "¿Qué métrica comparo en una prueba?",
        a: "Tasa de conversión visita→compra, tiempo desde publicación hasta primera venta, minutos de soporte manual por cada 100 órdenes y tasa de reclamos por entrega.",
      },
      {
        q: "¿Necesito abandonar Pixieset para usar ComprameLaFoto?",
        a: "No necesariamente. Muchos fotógrafos usan una plataforma para sesiones internacionales y otra para eventos locales. Lo importante es no duplicar esfuerzo sin estrategia clara.",
      },
    ],
    conclusion:
      "Pixieset representa el estándar global de galerías para fotógrafos; ComprameLaFoto representa operación local de venta y entrega para eventos y escuelas en Argentina. La decisión objetiva no pasa por prestigio internacional, sino por encaje con tus clientes pagadores, tu volumen y tu tiempo administrativo. Si tu ingreso principal viene de eventos y colegios locales, priorizá la plataforma que reduce fricción de pago y entrega en ese contexto. Si tu ingreso principal viene de sesiones donde la galería internacional es parte del valor percibido, evaluá Pixieset con una prueba real y contrastá costos totales, no solo la cuota mensual.",
    ctaAudience: "fotografos",
    imageScene:
      "Wedding and school photographers discussing gallery workflows at cafe table, laptops closed, candid",
    imageAltSubject:
      "Fotógrafos de bodas y escuelas conversando sobre flujos de galería",
  },

  "compramelafoto-vs-pic-time": {
    seoTitle:
      "ComprameLaFoto vs Pic-Time: análisis para venta de fotos de eventos",
    seoDescription:
      "Comparativa objetiva entre ComprameLaFoto y Pic-Time: mercado local, pagos, eventos masivos y criterios para fotógrafos en Argentina.",
    excerpt:
      "Análisis comparativo entre ComprameLaFoto y Pic-Time para venta de fotos de eventos.",
    blocks: [
      p(
        "Pic-Time se menciona frecuentemente en conversaciones de fotógrafos que buscan vender más en línea y automatizar parte del trabajo comercial. ComprameLaFoto, por su parte, está construida para el fotógrafo argentino de eventos y escuelas. Ambas pertenecen al amplio rubro de plataformas de venta de fotografías, pero no necesariamente resuelven los mismos problemas con la misma prioridad. Esta comparativa te ayuda a decidir con criterios operativos, no con slogans.",
      ),
      h2("Resumen ejecutivo"),
      p(
        "ComprameLaFoto ofrece un stack integrado para Argentina: galerías por evento, Mercado Pago, packs, preventa escolar, colaboración con organizadores, búsqueda por selfie en eventos masivos, marketplace y entrega digital automática. Pic-Time, en términos de categoría, es una plataforma orientada a fotógrafos que quieren combinar galería, venta y herramientas comerciales en el ecosistema internacional de fotografía profesional.",
      ),
      p(
        "No enumeramos features específicas de Pic-Time — como módulos de marketing, IA o integraciones concretas — porque no son estables para afirmarlas sin documentación oficial actualizada. Lo comparado aquí es el tipo de negocio que cada propuesta favorece y los trade-offs previsibles al elegir una u otra.",
      ),
      p(
        "Un error habitual es elegir plataforma por recomendación de un colega con negocio distinto al tuyo: quien vende sesiones de estudio en Palermo no necesariamente tiene el mismo cuello de botella que quien cubre diez canchas de hockey un domingo. Antes de decidir, escribí tu propio listado de «no negociables» — por ejemplo Mercado Pago, selfie, preventa escolar o comisión a organizador — y tachá lo que no puedas confirmar en cada opción.",
      ),
      p(
        "También diferenciá costo visible (fee, suscripción) de costo oculto (horas de soporte, herramientas adicionales, tipo de cambio, contracargos). Una comparativa objetiva suma ambos lados en una temporada completa, no en un solo evento de prueba mal medido.",
      ),
      h2("Para quién es cada opción"),
      h3("ComprameLaFoto"),
      p(
        "Fotógrafos de eventos deportivos, escolares y sociales en Argentina; organizadores que quieren un canal de venta compartido; estudios que priorizan cobro local y entrega inmediata tras el pago.",
      ),
      h3("Pic-Time"),
      p(
        "Fotógrafos que buscan una plataforma de venta de fotografías de perfil internacional, con énfasis comercial general en el rubro. Su utilidad para maratones locales, colegios públicos o convenios con clubes debe validarse con prueba piloto, no con supuestos.",
      ),
      p(
        "Perfil intermedio: estudios que hacen retrato y además aceptan dos o tres eventos masivos por año. Ahí conviene decidir si unificar stack o especializar herramientas por línea. Unificar simplifica operación; especializar optimiza conversión en cada flujo. No hay respuesta universal.",
      ),
      h2("Funcionalidades de ComprameLaFoto"),
      p(
        "La plataforma cubre venta de fotografías digitales e impresiones, álbumes y galerías por evento o escuela, packs y descuentos por cantidad, preventa escolar, eventos colaborativos con organizadores y también comisiones para organizadores, búsqueda por selfie en eventos masivos, marketplace de fotógrafos, entrega digital automática tras el pago, programa de referidos. El pago es con Mercado Pago y el foco operativo es cerrar el ciclo venta→entrega sin intervención manual habitual.",
      ),
      p(
        "En eventos con miles de participantes, la combinación de álbumes organizados y búsqueda por selfie ataca el cuello de botella principal: encontrar la propia foto rápido. En escuelas, preventa y bundles respetan la ventana corta de decisión de las familias.",
      ),
      h2("Funcionalidades de la alternativa"),
      p(
        "Pic-Time, como categoría de producto, suele asociarse a galerías de venta, herramientas para aumentar conversión y flujos de compra orientados a fotógrafos profesionales. La composición exacta de esas herramientas — álbumes, store, automatizaciones, apps — debe revisarse en fuentes oficiales de Pic-Time al momento de tu decisión.",
      ),
      p(
        "Evitamos afirmar equivalencias directas con preventa escolar argentina, comisiones a organizadores locales o marketplace de fotógrafos del mismo mercado. Si esos puntos son críticos, contrastalos en una demo o piloto.",
      ),
      p(
        "En términos generales del rubro internacional, plataformas como Pic-Time suelen enfatizar conversión comercial en galerías de clientes que ya contrataron una sesión. Ese contexto es distinto al de un corredor anónimo que quiere comprar dos fotos del domingo por la tarde. Comparar sin ese matiz lleva a frustración.",
      ),
      h2("Ventajas de ComprameLaFoto"),
      ul([
        "Alineación con pagos y hábitos de compra argentinos.",
        "Herramientas para volumen y descubrimiento en eventos masivos.",
        "Modelo colaborativo con organizadores.",
        "Menos dependencia de procesos manuales de entrega.",
        "Referidos para ingresos adicionales recomendando fotógrafos.",
      ]),
      p(
        "La ventaja acumulativa aparece cuando repetís el mismo tipo de evento semana a semana: configurás una vez, clonás estructura de álbum y precios, y cada nueva fecha entra con fricción decreciente. Eso impacta margen real más que cualquier función esporádica de marketing.",
      ),
      h2("Limitaciones de ComprameLaFoto"),
      ul([
        "Foco geográfico: no está pensada como plataforma global genérica.",
        "Si tu cliente exige herramientas de marketing sofisticadas de un vendor internacional específico, evaluá si las necesitás realmente en tu nicho local.",
        "Migrar galerías históricas desde otra plataforma requiere trabajo de catalogación y comunicación a clientes.",
      ]),
      h2("Ventajas de la alternativa"),
      p(
        "Pic-Time puede resultar atractiva si tu red profesional internacional ya la usa, si vendés a clientes que esperan ese ecosistema o si, tras revisar su oferta oficial, encontrás herramientas comerciales que encajan con tu estilo de sesiones contratadas. La ventaja potencial está en continuidad de ecosistema y en herramientas de categoría «venta + marketing» que debés confirmar caso por caso.",
      ),
      h2("Limitaciones de la alternativa"),
      p(
        "Sin inventar detalles, los riesgos objetivos al usar una plataforma internacional para eventos locales incluyen fricción de pago, costos en moneda extranjera, soporte fuera de tu huso horario y posible desajuste con dinámicas institucionales argentinas (colegios, clubes, federaciones). Un fotógrafo de torneo juvenil un sábado a la noche necesita que el padre pague fácil; eso no siempre correlaciona con la cantidad de features comerciales de un vendor global.",
      ),
      h2("Cuándo elegir cada una"),
      ul([
        "ComprameLaFoto: operación argentina de eventos y escuelas con prioridad en pagos locales y entrega automática.",
        "Pic-Time: cuando confirmás oficialmente que sus herramientas cubren tu mix de productos y tus clientes no tienen fricción de pago.",
        "Si dudás, medí en un solo evento: tiempo de carga, conversión y horas de soporte post-publicación.",
      ]),
      p(
        "Pic-Time compite en ecosistema internacional de venta; validá si tus clientes necesitan ese ecosistema o solo un link que funcione el domingo a la noche.",
      ),
      p(
        "Listá integraciones que realmente uses hoy, no las que «algún día» usarás. Pagar por potencial es caro en temporadas flojas.",
      ),
      p(
        "Un piloto de un torneo juvenil revela más que diez testimonios en inglés de fotógrafos de otros mercados.",
      ),
      p(
        "Pic-Time suele aparecer en conversaciones de fotógrafos que quieren vender más en línea y automatizar parte del trabajo comercial. Ese discurso es atractivo, pero tu negocio concreto puede ser mayoritariamente eventos con compradores anónimos y ventana corta post-carrera. Validá si las herramientas comerciales que promete la categoría «venta + marketing» aplican a tu calendario real.",
      ),
      p(
        "Un error habitual es elegir plataforma por recomendación de un colega con negocio distinto al tuyo. Quien vende sesiones de estudio en una zona céntrica no necesariamente tiene el mismo cuello de botella que quien cubre diez canchas de hockey un domingo. Escribí tus no negociables antes de mirar landings.",
      ),
      p(
        "Listá integraciones que realmente uses hoy, no las que «algún día» usarás. Pagar por potencial es caro en temporadas flojas. Si tu flujo es subir, publicar, difundir link y cobrar, las automatizaciones de email que no vas a configurar no deberían pesar en la decisión.",
      ),
      p(
        "Un piloto de un torneo juvenil revela más que diez testimonios en inglés de fotógrafos de otros mercados. Medí conversión, tiempo de publicación y soporte manual con tus fotos y tus precios.",
      ),
      p(
        "La ventaja acumulativa de una plataforma local aparece cuando repetís el mismo tipo de evento semana a semana: clonás estructura, packs y comunicación. Eso impacta margen real más que cualquier función esporádica de marketing que uses una vez al año.",
      ),
      p(
        "Si tu calendario mezcla retrato y deporte, decidí si unificar stack o especializar por línea. Unificar simplifica operación; especializar optimiza conversión en cada flujo. No hay respuesta universal sin números propios.",
      ),
      p(
        "Contrastá costo visible — fee, suscripción — con costo oculto: horas de soporte, herramientas complementarias, tipo de cambio, contracargos. Una comparativa objetiva suma ambos lados en una temporada completa.",
      ),
      p(
        "Pedí a Pic-Time — o a cualquier alternativa internacional — confirmación escrita de medios de pago para compradores argentinos antes de prometerlo a un organizador. La promesa incumplida en pagos destruye contratos más que una foto mal expuesta.",
      ),
      p(
        "Una comparativa objetiva no elige por vos: ordena preguntas. Respondelas con números de tu última temporada y la decisión se vuelve evidente sin debate ideológico en grupos de Facebook.",
      ),
      p(
        "Pedí a un colega que haga una compra de prueba en cada opción sin tu ayuda. Cronometrá el proceso desde el link hasta la descarga. Esa medición vale más que diez opiniones en un hilo de Twitter.",
      ),
      p(
        "El organizador del evento a veces impone la plataforma. Si es tu cliente comercial principal, negociá condiciones de difusión y soporte antes de discutir features técnicas que el club ni entiende.",
      ),
      p(
        "Registrá en una planilla: fee, horas de soporte post-evento, conversión estimada y reclamos. Compará filas, no logos. El logo más lindo no envía archivos mientras dormís.",
      ),
      p(
        "Si migrás, comunicá el cambio con anticipación a clientes recurrentes y ofrecé un primer checkout guiado. La resistencia al cambio dura un evento si la experiencia nueva es claramente más simple.",
      ),
      p(
        "No confundas «conozco la interfaz» con «esta herramienta maximiza mis ventas». La comodidad personal del fotógrafo importa, pero el comprador anónimo del domingo vota con su billetera y su paciencia.",
      ),
      p(
        "Revisá políticas de devolución, contracargos y soporte en ambas opciones antes de la temporada alta. Descubrir esas reglas con un reclamo real en mano es la peor clase posible.",
      ),
      p(
        "La plataforma es infraestructura; tu relación con el organizador y la calidad de tu cobertura siguen siendo el motor del negocio. Elegí herramienta que no te robe horas para dedicarlas a lo que solo vos hacés bien.",
      ),
      p(
        "Considerá el perfil digital de tu audiencia: edad, hábito de pago, uso de celular vs desktop. Una herramienta perfecta en desktop pierde ventas si tus compradores están en el tren con el teléfono en la mano.",
      ),
      p(
        "Documentá cada prueba piloto con fecha, evento y resultado. En dos años no vas a recordar por qué elegiste; un log breve te ahorra repetir experimentos fallidos.",
      ),
      p(
        "Si tu margen es ajustado, priorizá conversión sobre estética de galería. Un checkout feo que funciona puede dejar más plata que una galería hermosa que nadie termina de pagar.",
      ),
      p(
        "Hablá con soporte de cada opción antes de comprometerte: medí tiempo de respuesta y claridad. El día que se cae un álbum en vivo, ese soporte es parte del producto.",
      ),
      p(
        "Pic-Time suele aparecer en conversaciones de fotógrafos que quieren vender más en línea y automatizar parte del trabajo comercial. Ese discurso es atractivo, pero tu negocio concreto puede ser mayoritariamente eventos con compradores anónimos y ventana corta post-carrera. Validá si las herramientas comerciales que promete la categoría «venta + marketing» aplican a tu calendario real.",
      ),
      p(
        "Un error habitual es elegir plataforma por recomendación de un colega con negocio distinto al tuyo. Quien vende sesiones de estudio en una zona céntrica no necesariamente tiene el mismo cuello de botella que quien cubre diez canchas de hockey un domingo. Escribí tus no negociables antes de mirar landings.",
      ),
      p(
        "Listá integraciones que realmente uses hoy, no las que «algún día» usarás. Pagar por potencial es caro en temporadas flojas. Si tu flujo es subir, publicar, difundir link y cobrar, las automatizaciones de email que no vas a configurar no deberían pesar en la decisión.",
      ),
      p(
        "Un piloto de un torneo juvenil revela más que diez testimonios en inglés de fotógrafos de otros mercados. Medí conversión, tiempo de publicación y soporte manual con tus fotos y tus precios.",
      ),
      p(
        "La ventaja acumulativa de una plataforma local aparece cuando repetís el mismo tipo de evento semana a semana: clonás estructura, packs y comunicación. Eso impacta margen real más que cualquier función esporádica de marketing que uses una vez al año.",
      ),
      p(
        "Si tu calendario mezcla retrato y deporte, decidí si unificar stack o especializar por línea. Unificar simplifica operación; especializar optimiza conversión en cada flujo. No hay respuesta universal sin números propios.",
      ),
    ],
    faq: [
      {
        q: "¿Pic-Time sirve para maratones?",
        a: "Depende de cómo resuelva búsqueda, volumen y pagos para tu audiencia. Corré una prueba con un subset de fotos y medí cuántos corredores compran sin asistencia manual.",
      },
      {
        q: "¿ComprameLaFoto tiene herramientas de marketing por email?",
        a: "Su foco está en venta y entrega de eventos. Para campañas de marketing amplias, muchos fotógrafos combinan la plataforma con email, redes y comunicación del organizador.",
      },
      {
        q: "¿El fee es el único costo a comparar?",
        a: "No. Sumá tiempo administrativo, contracargos, conversión y costo de oportunidad si publicás tarde.",
      },
      {
        q: "¿Puedo probar ambas con el mismo evento?",
        a: "Podés hacer una prueba piloto con un subset de fotos y medir conversión real. Evitá publicar el mismo catálogo en dos lugares sin coordinar comunicación al cliente.",
      },
    ],
    conclusion:
      "Pic-Time compite en la categoría internacional de venta y herramientas comerciales para fotógrafos; ComprameLaFoto compite en ejecución local de eventos y escuelas en Argentina. Ninguna etiqueta de marketing reemplaza una prueba con tus fotos, tus precios y tus clientes reales. Si tu calendario está lleno de carreras, torneos y colegios, priorizá la plataforma que minimiza fricción de pago y entrega en ese contexto. Si tu negocio es otra cosa, validá Pic-Time con información oficial y métricas propias.",
    ctaAudience: "fotografos",
    imageScene:
      "Sports photographer reviewing sales metrics on two monitors, marathon medals on wall",
    imageAltSubject:
      "Fotógrafo deportivo comparando métricas de venta en pantallas",
  },

  "compramelafoto-vs-google-drive": {
    seoTitle: "ComprameLaFoto vs Google Drive: ¿alcanza para vender fotos?",
    seoDescription:
      "Comparación entre compartir fotos por Google Drive y un flujo profesional de venta con pagos, entrega automática y galerías en ComprameLaFoto.",
    excerpt:
      "¿Alcanza con Google Drive para vender fotos? Comparación con un flujo profesional de venta.",
    blocks: [
      p(
        "Muchos fotógrafos argentinos empiezan vendiendo por Google Drive: una carpeta, un link, transferencia o Mercado Pago por fuera, y envío manual de archivos. Funciona al principio, hasta que el volumen, los errores y el tiempo perdido convierten el método en un cuello de botella. Esta comparativa contrasta ese enfoque informal con un flujo profesional en ComprameLaFoto, sin demonizar herramientas que siguen siendo útiles para otras tareas.",
      ),
      h2("Resumen ejecutivo"),
      p(
        "Google Drive es un servicio de almacenamiento y compartición de archivos en la nube. No es una plataforma de venta de fotografías: no tiene checkout nativo para tus clientes, no automatiza entrega tras pago ni está diseñado para galerías de eventos con búsqueda y packs. ComprameLaFoto sí está diseñada para ese fin: galerías por evento, Mercado Pago integrado, packs, preventa escolar, búsqueda por selfie, entrega digital automática y herramientas para organizadores.",
      ),
      p(
        "Drive puede ser excelente para backup, intercambio interno con editores o entrega puntual a un cliente corporativo que ya pagó por otro canal. Dejar de usarlo por completo no es el mensaje; dejar de usarlo como «tienda» cuando crecés, sí puede serlo.",
      ),
      p(
        "El punto de quiebre suele llegar entre cincuenta y doscientos compradores potenciales por evento, según cuánto cobrás y cuánto tiempo valorás. Antes de ese rango, Drive más transferencia puede ser aceptable si controlás errores. Después, cada hora enviando archivos se come margen que una tienda automatizada devuelve en conversión y profesionalismo.",
      ),
      p(
        "También considerá reputación: un link de carpeta compartida comunica informalidad. En escuelas y clubes, la institución a veces exige un canal de venta que no dependa del celular personal del fotógrafo. Ahí Drive deja de ser «gratis» y pasa a costar contratos.",
      ),
      h2("Para quién es cada opción"),
      h3("ComprameLaFoto"),
      p(
        "Fotógrafos que venden a muchas personas por evento, necesitan cobrar online de forma ordenada y quieren que cada cliente se autosirva sin depender de tu WhatsApp.",
      ),
      p(
        "También organizadores que quieren un único link oficial y menos consultas de padres o corredores; estudios que miden conversión y quieren packs, preventa escolar o búsqueda por selfie en deporte.",
      ),
      h3("Google Drive"),
      p(
        "Uso personal o profesional de almacenamiento; entrega gratuita o ya pactada a pocos clientes; portfolios internos; compartir RAW o previews con equipo. También etapa muy temprana de un fotógrafo con volumen ínfimo y sin urgencia de profesionalizar.",
      ),
      p(
        "Drive sigue siendo excelente como capa de backup y staging: exportás, verificás, respaldás en carpeta privada y publicás en la tienda solo lo comercial. Ese híbrido es sano y no contradice profesionalizar la venta.",
      ),
      h2("Funcionalidades de ComprameLaFoto"),
      p(
        "ComprameLaFoto ofrece venta de digitales e impresiones, álbumes por evento o escuela, packs y descuentos, preventa escolar, eventos colaborativos, comisiones para organizadores, búsqueda por selfie, marketplace, entrega automática tras el pago y programa de referidos, con Mercado Pago como medio de cobro principal.",
      ),
      p(
        "El comprador entra, encuentra sus fotos, paga y descarga sin que intervengas en cada orden. Eso escala cuando hay cientos o miles de potenciales compradores por jornada.",
      ),
      h2("Funcionalidades de la alternativa"),
      p(
        "Google Drive permite subir archivos, organizarlos en carpetas, compartir links con permisos de vista o descarga, controlar acceso básico y colaborar en documentos. Integra con cuentas Google, tiene apps móviles y límites de almacenamiento según el plan de Google One o espacio de Google Workspace.",
      ),
      p(
        "Lo que Drive no hace de fábrica: procesar pagos por cada foto, aplicar precios por pack, generar watermarks de venta, ofrecer búsqueda por selfie en eventos, calcular comisiones de organizadores ni enviar automáticamente archivos en alta resolución solo tras confirmar el pago. Todo eso requiere procesos manuales o herramientas adicionales.",
      ),
      p(
        "Podés complementar Drive con formularios, planillas o bots, pero cada parche suma fragilidad: un formulario no valida pago, una planilla no entrega archivo, un bot puede romperse en actualización de WhatsApp. La comparación no es Drive vs ComprameLaFoto aislados, sino Drive más parches vs flujo integrado.",
      ),
      h2("Ventajas de ComprameLaFoto"),
      ul([
        "Checkout y entrega integrados: menos errores humanos.",
        "Experiencia de compra profesional para el cliente final.",
        "Herramientas específicas para eventos masivos y escuelas.",
        "Pagos con Mercado Pago en el flujo, no por fuera.",
        "Trazabilidad de órdenes y menos dependencia del chat.",
      ]),
      h2("Limitaciones de ComprameLaFoto"),
      ul([
        "Curva inicial de configuración y fees de plataforma.",
        "Menos flexible que una carpeta cruda si solo querés regalar tres fotos a un amigo.",
        "Requiere conexión a internet y adopción del cliente (aunque suele ser menor fricción que coordinar pago manual).",
      ]),
      h2("Ventajas de la alternativa"),
      ul([
        "Gratis o de bajo costo para almacenar y compartir.",
        "Universal: casi todos saben abrir un link de Drive.",
        "Control total manual si tenés pocos clientes y preferís informalidad.",
        "Útil como respaldo o staging antes de subir a la tienda.",
      ]),
      h2("Limitaciones de la alternativa"),
      ul([
        "Sin tienda: cada venta requiere coordinación de pago y envío.",
        "Riesgo de compartir carpetas enteras o archivos incorrectos.",
        "Links reenviados pueden filtrar material sin watermark comercial.",
        "No escala en maratones o escuelas: colapsa el WhatsApp del fotógrafo.",
        "Percepción poco profesional cuando compites con quien sí tiene checkout.",
      ]),
      p(
        "Además, Google puede limitar descargas masivas o generar alertas de seguridad en links muy compartidos, interrumpiendo entregas en momentos críticos post-evento.",
      ),
      h2("Cuándo elegir cada una"),
      ul([
        "ComprameLaFoto: cuando vendés a más de un puñado de personas por evento o querés crecer sin multiplicar horas administrativas.",
        "Google Drive: backup, intercambio interno, entregas ya cobradas por contrato o etapa inicial de prueba con volumen mínimo.",
        "Híbrido razonable: editás y respaldás en Drive; publicás para venta en ComprameLaFoto.",
      ]),
      p(
        "Señales de que ya superaste Drive como tienda: pasás más de dos horas post-evento enviando archivos, recibís pagos sin poder mapearlos a pedidos, perdés ventas porque el cliente «se cansó de esperar», o el organizador pide reporte de ventas que no podés sacar de una carpeta.",
      ),
      p(
        "Migrar no tiene que ser dramático: próximo evento chico, mismo precio, nuevo flujo. Compará horas y conversión. Si mejora, trasladá el resto del calendario. Drive queda para backup.",
      ),
      p(
        "Drive no registra órdenes: imposible saber qué fotos se vendieron sin planilla paralela. Ese hueco genera errores de entrega y discusiones de pago.",
      ),
      p(
        "Compartir carpetas con permiso de descarga facilita filtración de archivos en alta si alguien reenvía el link. Una tienda entrega solo lo pagado.",
      ),
      p(
        "En colegios, dirección puede exigir trazabilidad de ventas. Drive no la ofrece; una plataforma de venta sí.",
      ),
      p(
        "Calculá costo hora de tu edición. Si enviar archivos te quita dos horas y podés cubrir otro evento, Drive «gratis» es caro.",
      ),
      p(
        "Drive es excelente para backup, intercambio con editores y staging antes de publicar en la tienda. El error no es usar Drive; es usar Drive como única capa comercial cuando ya tenés decenas o cientos de compradores potenciales por evento.",
      ),
      p(
        "El punto de quiebre suele llegar entre cincuenta y doscientos compradores potenciales, según cuánto cobrás y cuánto valorás tu hora. Antes de ese rango, Drive más transferencia puede ser aceptable si controlás errores. Después, cada hora enviando archivos se come margen que una tienda automatizada devuelve en conversión.",
      ),
      p(
        "Un link de carpeta compartida comunica informalidad. En escuelas y clubes, la institución a veces exige un canal de venta que no dependa del celular personal del fotógrafo. Ahí Drive deja de ser «gratis» y pasa a costar contratos o renovaciones.",
      ),
      p(
        "Podés complementar Drive con formularios, planillas o bots, pero cada parche suma fragilidad: un formulario no valida pago, una planilla no entrega archivo, un bot puede romperse. La comparación no es Drive vs ComprameLaFoto aislados, sino Drive más parches vs flujo integrado.",
      ),
      p(
        "Google puede limitar descargas masivas o generar alertas de seguridad en links muy compartidos, interrumpiendo entregas en momentos críticos post-evento. Una tienda entrega solo lo pagado y registra la orden.",
      ),
      p(
        "Señales de que ya superaste Drive como tienda: pasás más de dos horas post-evento enviando archivos, recibís pagos sin poder mapearlos a pedidos, perdés ventas porque el cliente «se cansó de esperar», o el organizador pide reporte que no podés sacar de una carpeta.",
      ),
      p(
        "Migrar no tiene que ser dramático: próximo evento chico, mismo precio, nuevo flujo. Compará horas y conversión. Si mejora, trasladá el resto del calendario. Drive queda para backup y trabajo interno.",
      ),
      p(
        "Calculá costo hora de tu edición. Si enviar archivos te quita dos horas y podés cubrir otro evento, Drive «gratis» es caro. La profesionalización no es snobismo: es recuperar tiempo e ingresos que hoy se pierden en fricción.",
      ),
      p(
        "En colegios, dirección puede exigir trazabilidad de ventas. Drive no la ofrece de forma nativa; una plataforma de venta sí. Eso importa cuando firmás convenio anual con la institución.",
      ),
      p(
        "Una comparativa objetiva no elige por vos: ordena preguntas. Respondelas con números de tu última temporada y la decisión se vuelve evidente sin debate ideológico en grupos de Facebook.",
      ),
      p(
        "Pedí a un colega que haga una compra de prueba en cada opción sin tu ayuda. Cronometrá el proceso desde el link hasta la descarga. Esa medición vale más que diez opiniones en un hilo de Twitter.",
      ),
      p(
        "El organizador del evento a veces impone la plataforma. Si es tu cliente comercial principal, negociá condiciones de difusión y soporte antes de discutir features técnicas que el club ni entiende.",
      ),
      p(
        "Registrá en una planilla: fee, horas de soporte post-evento, conversión estimada y reclamos. Compará filas, no logos. El logo más lindo no envía archivos mientras dormís.",
      ),
      p(
        "Si migrás, comunicá el cambio con anticipación a clientes recurrentes y ofrecé un primer checkout guiado. La resistencia al cambio dura un evento si la experiencia nueva es claramente más simple.",
      ),
      p(
        "No confundas «conozco la interfaz» con «esta herramienta maximiza mis ventas». La comodidad personal del fotógrafo importa, pero el comprador anónimo del domingo vota con su billetera y su paciencia.",
      ),
      p(
        "Revisá políticas de devolución, contracargos y soporte en ambas opciones antes de la temporada alta. Descubrir esas reglas con un reclamo real en mano es la peor clase posible.",
      ),
      p(
        "La plataforma es infraestructura; tu relación con el organizador y la calidad de tu cobertura siguen siendo el motor del negocio. Elegí herramienta que no te robe horas para dedicarlas a lo que solo vos hacés bien.",
      ),
      p(
        "Considerá el perfil digital de tu audiencia: edad, hábito de pago, uso de celular vs desktop. Una herramienta perfecta en desktop pierde ventas si tus compradores están en el tren con el teléfono en la mano.",
      ),
      p(
        "Documentá cada prueba piloto con fecha, evento y resultado. En dos años no vas a recordar por qué elegiste; un log breve te ahorra repetir experimentos fallidos.",
      ),
      p(
        "Si tu margen es ajustado, priorizá conversión sobre estética de galería. Un checkout feo que funciona puede dejar más plata que una galería hermosa que nadie termina de pagar.",
      ),
      p(
        "Hablá con soporte de cada opción antes de comprometerte: medí tiempo de respuesta y claridad. El día que se cae un álbum en vivo, ese soporte es parte del producto.",
      ),
      p(
        "Drive es excelente para backup, intercambio con editores y staging antes de publicar en la tienda. El error no es usar Drive; es usar Drive como única capa comercial cuando ya tenés decenas o cientos de compradores potenciales por evento.",
      ),
      p(
        "El punto de quiebre suele llegar entre cincuenta y doscientos compradores potenciales, según cuánto cobrás y cuánto valorás tu hora. Antes de ese rango, Drive más transferencia puede ser aceptable si controlás errores. Después, cada hora enviando archivos se come margen que una tienda automatizada devuelve en conversión.",
      ),
      p(
        "Un link de carpeta compartida comunica informalidad. En escuelas y clubes, la institución a veces exige un canal de venta que no dependa del celular personal del fotógrafo. Ahí Drive deja de ser «gratis» y pasa a costar contratos o renovaciones.",
      ),
      p(
        "Podés complementar Drive con formularios, planillas o bots, pero cada parche suma fragilidad: un formulario no valida pago, una planilla no entrega archivo, un bot puede romperse. La comparación no es Drive vs ComprameLaFoto aislados, sino Drive más parches vs flujo integrado.",
      ),
      p(
        "Google puede limitar descargas masivas o generar alertas de seguridad en links muy compartidos, interrumpiendo entregas en momentos críticos post-evento. Una tienda entrega solo lo pagado y registra la orden.",
      ),
    ],
    faq: [
      {
        q: "¿Puedo cobrar por MP y mandar Drive después?",
        a: "Podés, pero seguís haciendo trabajo manual y sin garantía de que el cliente no comparta el link. Es un parche, no un sistema.",
      },
      {
        q: "¿Drive con watermark alcanza?",
        a: "Ayuda a mostrar previews, pero no reemplaza checkout, packs ni entrega automática en alta tras el pago.",
      },
      {
        q: "¿Cuándo migrar?",
        a: "Cuando pasás más de un par de horas por evento enviando archivos o cuando perdés ventas por demora.",
      },
      {
        q: "¿Puedo seguir usando Drive como respaldo?",
        a: "Sí. Muchos fotógrafos usan la plataforma de venta para el flujo comercial y Drive u otro almacenamiento para backup interno. Son roles distintos.",
      },
    ],
    conclusion:
      "Google Drive es una herramienta de archivos; ComprameLaFoto es una herramienta de venta y entrega de fotografías. No compiten en la misma categoría, aunque muchos fotógrafos las mezclen al inicio. La decisión objetiva es simple: si tu objetivo es vender a escala con menos fricción, Drive solo no alcanza. Si tu objetivo es almacenar o entregar a pocos clientes sin tienda, Drive sigue siendo válido. Profesionalizar no es snobismo: es recuperar tiempo y capturar ingresos que hoy se pierden en fricción.",
    ctaAudience: "fotografos",
    imageScene:
      "Photographer frustrated with shared folder on phone while professional gallery app open on laptop",
    imageAltSubject:
      "Fotógrafo comparando carpeta compartida de Drive con galería profesional",
  },

  "compramelafoto-vs-galerias-privadas-tradicionales": {
    seoTitle: "ComprameLaFoto vs galerías privadas tradicionales",
    seoDescription:
      "Plataforma de venta online vs galería con contraseña clásica: seguridad, pagos, escala y cuándo migrar a ComprameLaFoto.",
    excerpt:
      "Plataforma de venta online vs galería con contraseña tradicional: seguridad, pagos y escala.",
    blocks: [
      p(
        "Antes de las plataformas actuales, muchos fotógrafos vendían con «galerías privadas» tradicionales: un sitio con usuario y contraseña, selección de fotos favoritas y pedido por email o formulario. Ese modelo sigue en uso y tiene virtudes. Pero frente a eventos masivos, pagos instantáneos y expectativas mobile, muestra grietas. Esta comparativa ayuda a decidir si conviene migrar, convivir o mantener el esquema clásico según tu nicho.",
      ),
      h2("Resumen ejecutivo"),
      p(
        "Las galerías privadas tradicionales suelen ser sitios o módulos donde el cliente accede con credenciales, navega previews en baja resolución y realiza un pedido que el fotógrafo procesa manualmente o semi-manualmente. ComprameLaFoto unifica publicación, checkout con Mercado Pago, packs, preventa, colaboración con organizadores, búsqueda por selfie en eventos masivos y entrega digital automática tras el pago.",
      ),
      p(
        "La diferencia central no es solo estética: es dónde termina el trabajo del fotógrafo. En el modelo tradicional, muchas veces termina cuando empieza el pedido («¿cuáles querés en alta?», «¿ya transferiste?»). En un flujo moderno, termina cuando subís y comunicás el link correcto.",
      ),
      p(
        "Las galerías clásicas nacieron en una época de pocos clientes por sesión y email como canal principal. Los eventos actuales —móvil, pago instantáneo, miles de visitas en un fin de semana— exigen otro diseño. No es que el modelo viejo sea «malo»; es que el contexto cambió para una parte grande del mercado argentino.",
      ),
      h2("Para quién es cada opción"),
      h3("ComprameLaFoto"),
      p(
        "Eventos deportivos, escuelas, fiestas y corporativos con muchos compradores potenciales, urgencia post-evento y necesidad de pagos locales integrados.",
      ),
      p(
        "Fotógrafos que quieren datos de conversión, menos WhatsApp operativo y alianzas con organizadores mediante comisiones o eventos colaborativos.",
      ),
      h3("Galerías privadas tradicionales"),
      p(
        "Sesiones premium de bajo volumen donde el fotógrafo quiere curar la experiencia paso a paso; clientes habituados al ritual de «galería con clave»; o estudios con inversión previa en un sitio propio que aún rentabilizan.",
      ),
      h2("Funcionalidades de ComprameLaFoto"),
      p(
        "Incluye venta de fotografías digitales e impresiones, álbumes y galerías por evento o escuela, packs y descuentos por cantidad, preventa escolar, eventos colaborativos con organizadores, comisiones para organizadores, búsqueda por selfie en eventos masivos, marketplace de fotógrafos, entrega digital automática tras el pago, programa de referidos. Pagos con Mercado Pago. La entrega digital se dispara al confirmarse el pago, reduciendo intercambio de emails con archivos adjuntos.",
      ),
      p(
        "Para escuelas, la preventa y los bundles respetan calendarios institucionales. Para deportes, la búsqueda por selfie reduce la dependencia de que el atleta recuerde en qué altura o fondo apareció.",
      ),
      h2("Funcionalidades de la alternativa"),
      p(
        "Una galería privada tradicional típicamente ofrece: acceso restringido por contraseña o usuario, visualización de previews, marcado de favoritas, descarga opcional de muestras y un canal de pedido (formulario, email o carrito básico). Algunas incluyen watermark fijo y álbumes por sesión.",
      ),
      p(
        "Lo habitual es que el cobro ocurra por transferencia, efectivo o link de pago externo, y que la entrega en alta resolución la ejecute el fotógrafo manualmente. Pocos sistemas clásicos integran Mercado Pago nativo, packs dinámicos, comisiones a organizadores o búsqueda biométrica para eventos masivos.",
      ),
      h2("Ventajas de ComprameLaFoto"),
      ul([
        "Autoservicio real para el comprador: menos cuellos de botella en WhatsApp.",
        "Pagos y entrega en un solo flujo.",
        "Escala a miles de visitantes sin colapsar operación manual.",
        "Herramientas específicas para escuela y deporte.",
        "Marketplace y referidos como canales adicionales de ingreso.",
      ]),
      h2("Limitaciones de ComprameLaFoto"),
      ul([
        "Menos control artesanal paso a paso si vendés exclusivamente sesiones ultra-premium con curación manual como valor central.",
        "Fees de plataforma y reglas de uso a considerar en el margen.",
        "Migración requiere reeducar clientes que extrañan «la galería de siempre».",
      ]),
      h2("Ventajas de la alternativa"),
      ul([
        "Experiencia familiar para clientes de estudio de hace años.",
        "Control manual total sobre qué se entrega y cuándo.",
        "Posible inversión amortizada en web propia.",
        "Adecuada para pocos pedidos complejos con negociación de extras.",
      ]),
      h2("Limitaciones de la alternativa"),
      ul([
        "No escala bien en eventos masivos.",
        "Alto riesgo de errores en pedidos y archivos.",
        "Cobros desconectados de la entrega generan órdenes impagas o duplicadas.",
        "Experiencia mobile inferior a tiendas modernas.",
        "Dificultad para medir conversión y optimizar precios con datos.",
      ]),
      h2("Cuándo elegir cada una"),
      ul([
        "ComprameLaFoto: maratones, torneos, egresados, escuelas, corporativos con muchos asistentes.",
        "Galería tradicional: sesiones íntimas, volumen bajo y valor en curación personal 1:1.",
        "Migración gradual: mantené galería clásica para retrato premium y adoptá plataforma para línea de eventos.",
      ]),
      p(
        "Si hoy perdés ventas porque el cliente no completa el formulario de pedido o paga tarde, la migración deja de ser opcional. Medí cuántos pedidos se caen entre «me encantó la galería» y «acá está el comprobante». Ese hueco es donde una tienda integrada recupera ingreso.",
      ),
      p(
        "Comunicá el cambio con honestidad a clientes históricos: mismo fotógrafo, mejor experiencia de compra. La mayoría adapta en un evento si el primer checkout es fluido en el celular.",
      ),
      p(
        "La galería con clave ritualiza la compra; la tienda moderna la acelera. Elegí según velocidad que tu cliente espera post-evento.",
      ),
      p(
        "Migrar no borra tu estética: seguís siendo el mismo fotógrafo con mejor infraestructura comercial en la línea de eventos.",
      ),
      p(
        "Medí tickets impagos en modelo tradicional. Ese número es ingreso recuperable con checkout integrado.",
      ),
      p(
        "Las galerías con contraseña ritualizan la compra; las tiendas modernas la aceleran. Elegí según la velocidad que tu cliente espera post-evento. Un padre en el hall del recital quiere pagar y llevarse la foto esa noche, no llenar un formulario que procesarás al día siguiente.",
      ),
      p(
        "El modelo tradicional cumplió un rol histórico importante en sesiones premium de bajo volumen. Para la economía actual de eventos y escuelas — muchos compradores, poco tiempo, pagos digitales — un flujo integrado es objetivamente más eficiente en la mayoría de los casos medidos por horas de soporte.",
      ),
      p(
        "Medí tickets impagos en modelo tradicional: transferencias prometidas que nunca llegaron, pedidos por email sin cerrar. Ese número es ingreso recuperable con checkout integrado y entrega automática al confirmar pago.",
      ),
      p(
        "Migrar no borra tu estética ni tu estilo fotográfico: seguís siendo el mismo fotógrafo con mejor infraestructura comercial en la línea de eventos. Muchos estudios mantienen galería clásica para retrato premium y plataforma moderna para deporte o escuela.",
      ),
      p(
        "Si hoy perdés ventas porque el cliente no completa el formulario de pedido o paga tarde, la migración deja de ser opcional. Medí cuántos pedidos se caen entre «me encantó la galería» y «acá está el comprobante».",
      ),
      p(
        "Comunicá el cambio con honestidad a clientes históricos: mismo fotógrafo, mejor experiencia de compra. La mayoría adapta en un evento si el primer checkout es fluido en el celular.",
      ),
      p(
        "Las galerías clásicas nacieron con email como canal principal y pocos clientes por sesión. Los eventos actuales — móvil, pago instantáneo, miles de visitas en un fin de semana — exigen otro diseño operativo para quien vende volumen.",
      ),
      p(
        "Una web propia amortizada puede seguir siendo tu escaparate de marca mientras la tienda operativa vive en la plataforma. No son excluyentes si definís qué ve el cliente en cada punto del viaje.",
      ),
      p(
        "La experiencia mobile inferior de muchos sistemas clásicos no es un detalle: en escuela y deporte, más del setenta por ciento de las compras ocurren desde el teléfono. Si la galería con clave es incómoda en pantalla chica, la conversión cae aunque las fotos sean excelentes.",
      ),
      p(
        "Una comparativa objetiva no elige por vos: ordena preguntas. Respondelas con números de tu última temporada y la decisión se vuelve evidente sin debate ideológico en grupos de Facebook.",
      ),
      p(
        "Pedí a un colega que haga una compra de prueba en cada opción sin tu ayuda. Cronometrá el proceso desde el link hasta la descarga. Esa medición vale más que diez opiniones en un hilo de Twitter.",
      ),
      p(
        "El organizador del evento a veces impone la plataforma. Si es tu cliente comercial principal, negociá condiciones de difusión y soporte antes de discutir features técnicas que el club ni entiende.",
      ),
      p(
        "Registrá en una planilla: fee, horas de soporte post-evento, conversión estimada y reclamos. Compará filas, no logos. El logo más lindo no envía archivos mientras dormís.",
      ),
      p(
        "Si migrás, comunicá el cambio con anticipación a clientes recurrentes y ofrecé un primer checkout guiado. La resistencia al cambio dura un evento si la experiencia nueva es claramente más simple.",
      ),
      p(
        "No confundas «conozco la interfaz» con «esta herramienta maximiza mis ventas». La comodidad personal del fotógrafo importa, pero el comprador anónimo del domingo vota con su billetera y su paciencia.",
      ),
      p(
        "Revisá políticas de devolución, contracargos y soporte en ambas opciones antes de la temporada alta. Descubrir esas reglas con un reclamo real en mano es la peor clase posible.",
      ),
      p(
        "La plataforma es infraestructura; tu relación con el organizador y la calidad de tu cobertura siguen siendo el motor del negocio. Elegí herramienta que no te robe horas para dedicarlas a lo que solo vos hacés bien.",
      ),
      p(
        "Considerá el perfil digital de tu audiencia: edad, hábito de pago, uso de celular vs desktop. Una herramienta perfecta en desktop pierde ventas si tus compradores están en el tren con el teléfono en la mano.",
      ),
      p(
        "Documentá cada prueba piloto con fecha, evento y resultado. En dos años no vas a recordar por qué elegiste; un log breve te ahorra repetir experimentos fallidos.",
      ),
      p(
        "Si tu margen es ajustado, priorizá conversión sobre estética de galería. Un checkout feo que funciona puede dejar más plata que una galería hermosa que nadie termina de pagar.",
      ),
      p(
        "Hablá con soporte de cada opción antes de comprometerte: medí tiempo de respuesta y claridad. El día que se cae un álbum en vivo, ese soporte es parte del producto.",
      ),
      p(
        "Las galerías con contraseña ritualizan la compra; las tiendas modernas la aceleran. Elegí según la velocidad que tu cliente espera post-evento. Un padre en el hall del recital quiere pagar y llevarse la foto esa noche, no llenar un formulario que procesarás al día siguiente.",
      ),
      p(
        "El modelo tradicional cumplió un rol histórico importante en sesiones premium de bajo volumen. Para la economía actual de eventos y escuelas — muchos compradores, poco tiempo, pagos digitales — un flujo integrado es objetivamente más eficiente en la mayoría de los casos medidos por horas de soporte.",
      ),
      p(
        "Medí tickets impagos en modelo tradicional: transferencias prometidas que nunca llegaron, pedidos por email sin cerrar. Ese número es ingreso recuperable con checkout integrado y entrega automática al confirmar pago.",
      ),
      p(
        "Migrar no borra tu estética ni tu estilo fotográfico: seguís siendo el mismo fotógrafo con mejor infraestructura comercial en la línea de eventos. Muchos estudios mantienen galería clásica para retrato premium y plataforma moderna para deporte o escuela.",
      ),
      p(
        "Si hoy perdés ventas porque el cliente no completa el formulario de pedido o paga tarde, la migración deja de ser opcional. Medí cuántos pedidos se caen entre «me encantó la galería» y «acá está el comprobante».",
      ),
      p(
        "Comunicá el cambio con honestidad a clientes históricos: mismo fotógrafo, mejor experiencia de compra. La mayoría adapta en un evento si el primer checkout es fluido en el celular.",
      ),
      p(
        "Las galerías clásicas nacieron con email como canal principal y pocos clientes por sesión. Los eventos actuales — móvil, pago instantáneo, miles de visitas en un fin de semana — exigen otro diseño operativo para quien vende volumen.",
      ),
      p(
        "Una web propia amortizada puede seguir siendo tu escaparate de marca mientras la tienda operativa vive en la plataforma. No son excluyentes si definís qué ve el cliente en cada punto del viaje.",
      ),
      p(
        "La experiencia mobile inferior de muchos sistemas clásicos no es un detalle: en escuela y deporte, más del setenta por ciento de las compras ocurren desde el teléfono. Si la galería con clave es incómoda en pantalla chica, la conversión cae aunque las fotos sean excelentes.",
      ),
      p(
        "Una comparativa objetiva no elige por vos: ordena preguntas. Respondelas con números de tu última temporada y la decisión se vuelve evidente sin debate ideológico en grupos de Facebook.",
      ),
      p(
        "Pedí a un colega que haga una compra de prueba en cada opción sin tu ayuda. Cronometrá el proceso desde el link hasta la descarga. Esa medición vale más que diez opiniones en un hilo de Twitter.",
      ),
      p(
        "El organizador del evento a veces impone la plataforma. Si es tu cliente comercial principal, negociá condiciones de difusión y soporte antes de discutir features técnicas que el club ni entiende.",
      ),
    ],
    faq: [
      {
        q: "¿Mis clientes van a extrañar la contraseña?",
        a: "Algunos sí al principio. Un email claro con link directo y beneficios (pago y descarga inmediata) suele reducir fricción en una o dos compras.",
      },
      {
        q: "¿Puedo seguir usando mi web y vender en ComprameLaFoto?",
        a: "Sí. Muchos estudios usan web propia como escaparate y la plataforma como tienda operativa de eventos.",
      },
      {
        q: "¿Qué hago con galerías viejas archivadas?",
        a: "Podés mantenerlas en solo lectura para clientes históricos y usar la nueva plataforma para trabajo nuevo.",
      },
      {
        q: "¿La migración afecta la imagen premium de mi estudio?",
        a: "Un checkout profesional con pago integrado suele percibirse como más serio que un link con contraseña y transferencia manual. La percepción depende de cómo comuniques el cambio.",
      },
    ],
    conclusion:
      "Las galerías privadas tradicionales cumplieron un rol histórico importante y aún tienen sentido en nichos de bajo volumen y alta curación. Pero para la economía actual de eventos y escuelas — muchos compradores, poco tiempo, pagos digitales — un flujo integrado como ComprameLaFoto es objetivamente más eficiente. La migración no es traición a tu estilo: es especializar herramientas. Usá lo clásico donde brilla; usá lo moderno donde el manual ya te cuesta ventas.",
    ctaAudience: "fotografos",
    imageScene:
      "Older password-protected gallery printout next to modern online store on tablet, photographer thinking",
    imageAltSubject:
      "Galería con contraseña impresa junto a tienda online moderna en tablet",
  },
};
