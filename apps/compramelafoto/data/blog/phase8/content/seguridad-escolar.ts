import type { Phase8ArticleContent } from "@/data/blog/phase8/types";
import { p, h2, ul, pr } from "@/data/blog/phase8/editorial-nodes";

export const SEGURIDAD_ESCOLAR_PHASE8: Record<string, Phase8ArticleContent> = {
  "seguridad-escolar-ocultar-galeria-hasta-selfie": {
    seoTitle:
      'Privacidad escolar: función "Ocultar galería hasta selfie" | ComprameLaFoto',
    seoDescription:
      "Descubrí cómo Ocultar galería hasta selfie permite que cada familia vea solo las fotos de su hijo, con mayor privacidad en eventos escolares.",
    excerpt:
      "La función Ocultar galería hasta selfie protege a los menores: cada familia identifica con selfie y accede solo a las fotografías de su hijo o hija.",
    blocks: [
      p(
        "Cuando se trabaja con fotografías escolares, la seguridad y la privacidad de los menores deben ser una prioridad absoluta. Por ese motivo, en ComprameLaFoto desarrollamos una funcionalidad especialmente pensada para escuelas, jardines, institutos y fotógrafos que trabajan con menores de edad: «Ocultar galería hasta selfie», también configurable en el panel del fotógrafo como fotos ocultas hasta selfie."
      ),
      p(
        "Esta herramienta permite que las fotografías de un evento escolar permanezcan ocultas hasta que cada familia realice una identificación mediante una selfie, mejorando significativamente la privacidad de los alumnos y brindando mayor tranquilidad tanto a los padres como a las instituciones educativas."
      ),
      h2("¿Cómo funciona?"),
      p(
        "Cuando el fotógrafo publica las fotografías de un evento escolar con esta opción activada, la galería no queda visible de forma abierta. Antes de acceder a las imágenes, cada familia debe tomarse una selfie utilizando la herramienta integrada de ComprameLaFoto."
      ),
      p(
        "Nuestro sistema analiza esa fotografía y busca coincidencias dentro del evento para mostrar únicamente las imágenes relacionadas con esa persona. De esta manera, cada familia accede primero a las fotografías donde aparece su hijo o hija, evitando tener que navegar entre cientos o miles de imágenes de otros alumnos."
      ),
      p(
        "El fotógrafo activa la función desde la configuración del álbum, en la sección de privacidad y acceso. No requiere desarrollo técnico adicional: es un interruptor que cambia por completo la experiencia del visitante."
      ),
      p(
        "Para la familia, el proceso es directo: ingresa al link del colegio o del fotógrafo, ve un mensaje claro de verificación y sube o toma una selfie desde el celular. Si hay coincidencias, la galería se abre mostrando primero las fotos donde aparece su hijo o hija. Si no hay match en el primer intento, puede repetir con mejor iluminación o contactar al soporte del evento sin exponer el resto del álbum."
      ),
      h2("Un nivel adicional de privacidad"),
      p(
        "En muchas plataformas tradicionales, cualquier persona que tenga acceso al enlace puede recorrer todas las fotografías del evento. Aunque esto suele ser habitual en la venta de fotografías escolares, cada vez más instituciones buscan mecanismos que permitan proteger mejor la identidad de los menores."
      ),
      p(
        "La función «Ocultar galería hasta selfie» agrega una capa adicional de seguridad porque:"
      ),
      ul([
        "Reduce la exposición pública de las fotografías.",
        "Evita la navegación libre por galerías completas.",
        "Facilita que cada familia encuentre rápidamente sus imágenes.",
        "Mejora el control sobre el acceso al contenido.",
        "Genera mayor confianza en padres y directivos.",
      ]),
      pr(
        { type: "text", text: "Para profundizar en políticas de acceso y consentimiento, consultá también " },
        {
          type: "link",
          text: "cómo funciona la privacidad de las fotografías escolares",
          href: "/blog/como-funciona-privacidad-fotografias-escolares",
        },
        { type: "text", text: " y " },
        {
          type: "link",
          text: "cómo funciona el reconocimiento por selfie",
          href: "/blog/como-funciona-reconocimiento-por-selfie",
        },
        { type: "text", text: "." }
      ),
      h2("Beneficios para las escuelas"),
      p(
        "Las instituciones educativas suelen ser cada vez más exigentes respecto al tratamiento de imágenes de menores. Implementar una herramienta de identificación previa permite demostrar que existe una preocupación real por la privacidad de los alumnos."
      ),
      p(
        "En reuniones con padres y en actas de comisión directiva, contar con un proveedor que ofrezca acceso restringido por identidad simplifica la conversación. No reemplaza las autorizaciones firmadas ni las políticas internas del establecimiento, pero sí muestra que la campaña fotográfica incorpora controles técnicos actuales y no depende únicamente de un link abierto que cualquiera puede compartir."
      ),
      ul([
        "Mayor tranquilidad para directivos y representantes legales.",
        "Mejor percepción por parte de las familias.",
        "Procedimientos más modernos para la gestión de fotografías escolares.",
        "Reducción de consultas relacionadas con privacidad y acceso a imágenes.",
        "Mayor profesionalismo en la organización de campañas fotográficas.",
      ]),
      pr(
        { type: "text", text: "Si tu institución evalúa proveedores, conocé las " },
        {
          type: "link",
          text: "soluciones para escuelas en ComprameLaFoto",
          href: "https://www.compramelafoto.com/escuelas",
        },
        { type: "text", text: " y el caso de uso " },
        {
          type: "link",
          text: "cómo vender fotografías escolares",
          href: "/blog/como-vender-fotografias-escolares-caso-de-uso",
        },
        { type: "text", text: " para entender el flujo comercial completo." }
      ),
      h2("Beneficios para los padres"),
      p(
        "Los padres valoran cada vez más las medidas que ayudan a proteger la identidad de sus hijos en Internet. En campañas donde antes debían buscar entre cientos de miniaturas, la verificación previa reduce la sensación de exposición y acelera la compra."
      ),
      p("Gracias a este sistema:"),
      ul([
        "Encuentran las fotografías de sus hijos en segundos.",
        "Evitan revisar galerías completas.",
        "Perciben un mayor compromiso con la privacidad.",
        "Compran de forma más rápida y cómoda.",
        "Disfrutan de una experiencia mucho más personalizada.",
      ]),
      h2("Beneficios para los fotógrafos"),
      p(
        "La función también mejora considerablemente la experiencia de venta. Al mostrar primero las fotografías más relevantes para cada familia, se genera una experiencia más eficiente que ayuda a incrementar las posibilidades de compra."
      ),
      p(
        "En licitaciones o presentaciones ante colegios, poder explicar que la plataforma limita la navegación libre antes de la selfie es un diferencial concreto frente a carpetas compartidas o galerías sin control. Combinado con preventa, packs familiares y entrega digital automática, forma parte de un discurso comercial integral que transmite seriedad."
      ),
      ul([
        "Disminuyen las consultas de soporte.",
        "Las familias encuentran más rápido sus imágenes.",
        "Se mejora la percepción profesional del servicio.",
        "Se fortalece la relación con las instituciones educativas.",
      ]),
      pr(
        { type: "text", text: "Si recién empezás con campañas escolares, revisá " },
        {
          type: "link",
          text: "cómo crear una galería escolar",
          href: "/blog/como-crear-galeria-escolar",
        },
        { type: "text", text: ", " },
        {
          type: "link",
          text: "cómo funciona la preventa escolar",
          href: "/blog/como-funciona-preventa-escolar",
        },
        { type: "text", text: " y " },
        {
          type: "link",
          text: "cómo registrarte como fotógrafo",
          href: "/blog/como-registrarte-en-compramelafoto",
        },
        { type: "text", text: " para configurar tu cuenta y Mercado Pago." }
      ),
      h2("Tecnología aplicada a la seguridad"),
      p(
        "En ComprameLaFoto creemos que la tecnología debe utilizarse para mejorar tanto la experiencia de compra como la protección de los usuarios. La función «Ocultar galería hasta selfie» fue desarrollada pensando especialmente en eventos escolares y en la necesidad de ofrecer herramientas modernas que ayuden a proteger la privacidad de los menores sin complicar el proceso para las familias."
      ),
      p(
        "Es una solución simple para el usuario, pero con un enorme impacto en materia de seguridad, confianza y profesionalismo. El reconocimiento facial se aplica únicamente para facilitar la búsqueda dentro del álbum autorizado; no sustituye las autorizaciones institucionales ni el marco legal que cada colegio debe respetar."
      ),
      p(
        "El fotógrafo puede definir, además, si desea conservar las selfies por un período limitado para auditoría o soporte, según la configuración del álbum. Eso permite equilibrar trazabilidad operativa con minimización de datos."
      ),
      p(
        "Como en cualquier sistema de reconocimiento facial, conviene comunicar con honestidad las limitaciones: puede haber falsos negativos si la cara no se detectó bien en la foto del evento, o falsos positivos en casos extremos de parecido. Por eso el flujo contempla reintentos y atención humana cuando hace falta. La meta no es prometer perfección algorítmica, sino reducir drásticamente la exposición innecesaria de menores en galerías abiertas."
      ),
      h2("Cuándo conviene activarla"),
      p(
        "Recomendamos evaluar esta función en jornadas de fotos escolares con muchos cursos, actos con público mixto y cualquier campaña donde el colegio exprese preocupación por privacidad. En sesiones muy pequeñas o con pocos alumnos, el fotógrafo puede decidir si el beneficio operativo justifica el paso extra para las familias; en eventos masivos, suele ser la configuración más alineada con las expectativas actuales de las instituciones."
      ),
      p(
        "Antes de publicar, coordiná con la institución el mensaje que recibirán los padres: explicá que deberán tomarse una selfie para ver las fotos de su hijo, que el link es personal y que no deben reenviar capturas de pantalla de otras familias. Una comunicación clara del colegio —mail del preceptor, carta en la mochila o aviso en la app institucional— reduce la fricción del primer acceso y evita consultas repetidas al fotógrafo durante la venta."
      ),
    ],
    faq: [
      {
        q: "¿Cómo activo «Ocultar galería hasta selfie» en un álbum?",
        a: "Desde el panel del fotógrafo, en la configuración del álbum, activá la opción «Fotos ocultas hasta selfie» dentro de privacidad y acceso. Al publicar, los visitantes verán primero la pantalla de verificación.",
      },
      {
        q: "¿Qué pasa si una familia no obtiene coincidencias?",
        a: "Puede reintentar con otra selfie con mejor luz y rostro visible. Si el problema persiste, el fotógrafo o la escuela pueden atender el caso por los canales de soporte habituales.",
      },
      {
        q: "¿Puede convivir con la preventa escolar?",
        a: "Sí. La preventa gestiona el cobro anticipado y la preventa escolar tiene su propio flujo; la galería con fotos ocultas controla qué imágenes ve cada familia al acceder. Son complementarias.",
      },
      {
        q: "¿Reemplaza el consentimiento de imagen del colegio?",
        a: "No. Es una herramienta técnica de acceso. La institución sigue siendo responsable de las autorizaciones y políticas de uso de imagen de los menores.",
      },
      {
        q: "¿Sirve solo para escuelas?",
        a: "Está pensada especialmente para contextos escolares, pero cualquier fotógrafo puede activarla en un álbum donde quiera restringir la navegación libre antes de una selfie.",
      },
      {
        q: "¿Qué debe comunicar el colegio a las familias?",
        a: "Que el acceso requiere una selfie del padre, madre o tutor para ver las fotos del alumno, que el link no debe compartirse públicamente y que el fotógrafo o la institución atienden dudas por los canales oficiales de la campaña.",
      },
    ],
    conclusion:
      "Las fotografías escolares son recuerdos valiosos para las familias, pero también requieren un tratamiento responsable. La función «Ocultar galería hasta selfie» permite que escuelas, fotógrafos y padres cuenten con una herramienta adicional para proteger la privacidad de los alumnos, facilitando al mismo tiempo la búsqueda y compra de fotografías. Si buscás una plataforma moderna para vender fotografías escolares con herramientas avanzadas de seguridad y reconocimiento facial, registrate gratuitamente en ComprameLaFoto y descubrí todas las funcionalidades disponibles.",
    ctaAudience: "escuelas",
    imageScene:
      "Mother using smartphone to access school photos in modern school hallway, blurred face recognition interface on screen, natural light, documentary professional photography, sense of privacy and trust",
    imageAltSubject:
      "Madre accediendo a fotografías escolares con verificación por selfie en el móvil",
    imageCaption:
      "Cada familia accede a sus fotografías tras identificarse, sin recorrer la galería completa.",
  },
};
