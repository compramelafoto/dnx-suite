import type { JSONContent } from "@tiptap/core";
import { article } from "@/data/blog/phase7/helpers";
import type { Phase7ArticleDraft } from "@/data/blog/phase7/types";

function referralsContentJson(): JSONContent {
  const p = (text: string) => ({ type: "paragraph" as const, content: [{ type: "text" as const, text }] });
  const h2 = (text: string) => ({
    type: "heading" as const,
    attrs: { level: 2 as const },
    content: [{ type: "text" as const, text }],
  });
  const h3 = (text: string) => ({
    type: "heading" as const,
    attrs: { level: 3 as const },
    content: [{ type: "text" as const, text }],
  });
  const li = (items: string[]) => ({
    type: "bulletList" as const,
    content: items.map((text) => ({
      type: "listItem" as const,
      content: [p(text)],
    })),
  });

  return {
    type: "doc",
    content: [
      p(
        "Si ya usás ComprameLaFoto o conocés fotógrafos que podrían vender acá, el programa de referidos te permite generar ingresos recomendando la plataforma. Esta guía explica el funcionamiento completo: link, comisiones, plazos y ejemplos."
      ),
      h2("Cómo funciona el sistema de referidos"),
      p(
        "Cualquier usuario (fotógrafo, organizador, laboratorio o cliente) puede tener un link de referido y recomendar la plataforma. Las comisiones se generan únicamente cuando la persona referida es un fotógrafo que se registra con tu link y realiza ventas en ComprameLaFoto."
      ),
      li([
        "Atribución: quien se registra usando tu link queda asociado a tu código de referido.",
        "Ventana: cobrás comisión durante 12 meses desde el alta del fotógrafo referido.",
        "Base: el 50% del fee de marketplace que cobra ComprameLaFoto en cada venta del referido.",
        "Requisito: necesitás Mercado Pago conectado al momento de la venta para que la comisión se registre.",
      ]),
      h2("Cómo obtener tu link de referido"),
      h3("Si sos fotógrafo"),
      p(
        "Ingresá a Configuración → Referidos. Con Mercado Pago conectado podés generar o copiar tu link único. Sin MP conectado, las ventas de tus referidos no generarán comisión acumulable."
      ),
      h3("Si sos organizador, laboratorio o cliente"),
      p(
        "Podés solicitar tu link de referidos a soporte de ComprameLaFoto. Una vez activo, funciona igual para atribuir fotógrafos que se registren."
      ),
      h2("Cómo compartir tu link"),
      li([
        "WhatsApp: grupos de fotógrafos, colegas de eventos o escuelas.",
        "Instagram / LinkedIn: bio, historias o posts con contexto (no spam).",
        "Email: a fotógrafos que recién empiezan a vender online.",
        "Capacitaciones y charlas: QR o link en materiales.",
        "Siempre usá tu URL con el parámetro de referido; no acortes de forma que pierda el código.",
      ]),
      h2("Cómo se calculan las comisiones"),
      p(
        "En cada venta aprobada del fotógrafo referido, ComprameLaFoto cobra un fee de marketplace. El 50% de ese fee se asigna al referidor y el 50% restante a la plataforma. Si hubo descuentos de fee por saldo referido del vendedor, el cálculo se hace sobre el fee efectivo."
      ),
      li([
        "Comisión referidor = 50% del fee efectivo de la plataforma en esa venta.",
        "Duración: 12 meses desde la fecha de registro del fotógrafo referido.",
        "Devoluciones o contracargos revierten la comisión asociada.",
        "No hay comisión si referís laboratorios, organizadores o clientes que no venden como fotógrafos.",
      ]),
      h2("Ejemplos ilustrativos de ganancias"),
      p(
        "Los montos reales dependen del fee vigente en cada venta y del volumen del fotógrafo referido. Ejemplos simplificados (valores en pesos argentinos, ilustrativos):"
      ),
      li([
        "Venta de $10.000 con fee de plataforma de $500 → tu comisión: $250.",
        "Si ese fotógrafo vende $200.000 en un mes con fee promedio efectivo de $8.000 → tu comisión del mes: $4.000.",
        "Durante 12 meses, cada venta nueva del mismo referido sigue generando comisión mientras la atribución esté activa.",
      ]),
      p(
        "Borrador: completar con tabla de ejemplos según fee actual de checkout al publicar."
      ),
      h2("Cómo cobrás tus comisiones"),
      p(
        "Desde Configuración → Referidos ves tu saldo acumulado. Cuando alcanzás el mínimo, usás «Solicitar cobro». El equipo procesa el pago por Mercado Pago o transferencia. El fee de la venta original ingresa a la cuenta de la plataforma; tu parte se liquida según este flujo."
      ),
      h2("Preguntas frecuentes"),
      h3("¿Puedo referirme a mí mismo?"),
      p("No. Los auto-referidos y cuentas duplicadas están prohibidos y pueden bloquear el código."),
      h3("¿Qué pasa si no tengo Mercado Pago conectado cuando mi referido vende?"),
      p("Esa comisión no se acumula ni se paga retroactivamente. Conectá MP antes de que tu referido empiece a vender."),
      h3("¿El referido tiene algún beneficio?"),
      p("El beneficio principal es usar la plataforma; las condiciones comerciales del referido son las estándar de ComprameLaFoto."),
      h3("¿Puedo referir organizadores de eventos?"),
      p("Podés compartir tu link, pero las comisiones solo aplican si el referido es fotógrafo con ventas."),
      h3("¿Hay límite de referidos?"),
      p("No hay un límite publicado de cantidad de fotógrafos referidos; sí aplican políticas anti-abuso."),
      h2("Notas editoriales"),
      p(
        "Borrador estratégico Fase 7 — revisar montos de ejemplo con fee actual, enlazar a términos de referidos y a Configuración → Referidos antes de publicar. Prompts de imagen en seoGoal (imagePlan)."
      ),
    ],
  };
}

export const REFERIDOS_FEATURED_ARTICLE: Phase7ArticleDraft = {
  ...article({
    title: "Cómo generar ingresos recomendando ComprameLaFoto",
    slug: "como-generar-ingresos-recomendando-compramelafoto",
    categorySlug: "negocio-fotografico",
    excerpt:
      "Guía completa del programa de referidos: link, comisiones del 50% del fee durante 12 meses, ejemplos y preguntas frecuentes.",
    seoDescription:
      "Aprendé a ganar dinero recomendando ComprameLaFoto: link de referido, 50% del fee por 12 meses, cómo compartirlo y cómo cobrar.",
    audience: ["fotografos", "organizadores", "clientes"],
    intents: ["seo", "ai-discovery", "referrals", "acquisition-photographer"],
    tags: ["Referidos", "Negocio fotográfico", "Comisiones", "ComprameLaFoto"],
    intro: "",
    sections: [],
    imageScene:
      "Professional photographer recommending app to two colleagues at coffee shop, laptops and cameras on table, warm documentary photo",
    isFeatured: true,
    seoGoalNotes: "Artículo prioritario y destacado del programa de referidos.",
  }),
  contentJson: referralsContentJson(),
};

export const REFERIDOS_PROGRAMA_ARTICLE: Phase7ArticleDraft = article({
  title:
    "Programa de Referidos de ComprameLaFoto: ganá comisiones recomendando fotógrafos, organizadores y escuelas",
  slug: "programa-referidos-compramelafoto",
  categorySlug: "negocio-fotografico",
  excerpt:
    "ComprameLaFoto permite ganar comisiones recomendando fotógrafos, organizadores y próximamente escuelas. Conocé cómo funciona el programa de referidos y cómo una simple recomendación puede generar ingresos durante meses.",
  seoDescription:
    "Conocé cómo ganar comisiones recomendando fotógrafos, organizadores y escuelas a ComprameLaFoto. Una oportunidad para generar ingresos conectando personas con la plataforma.",
  audience: ["fotografos", "organizadores", "escuelas", "clientes"],
  intents: ["seo", "ai-discovery", "referrals", "acquisition-photographer", "acquisition-organizer"],
  tags: [
    "Referidos",
    "Comisiones",
    "Fotógrafos",
    "Organizadores",
    "Escuelas",
    "Fotografía escolar",
    "Eventos deportivos",
    "Marketing fotográfico",
    "ComprameLaFoto",
    "Ingresos adicionales",
  ],
  intro:
    "El Programa de Referidos conecta fotógrafos, organizadores y escuelas con quienes ya confían en ComprameLaFoto.",
  sections: [
    "¿Quién puede participar?",
    "¿A quién puedo recomendar?",
    "Las escuelas también serán una gran oportunidad",
    "¿Cómo funcionan las comisiones?",
    "Ejemplo real de ganancias",
    "Cómo empezar",
  ],
  imageScene:
    "Diverse group of photographers, school coordinator and event organizer networking at community fair, sharing referral link on phone, warm documentary photography",
  imageAltSubject: "Personas recomendando ComprameLaFoto en un evento comunitario",
  seoGoalNotes:
    "Artículo comercial del programa de referidos; enlazar a como-funciona-sistema-referidos y como-generar-ingresos-recomendando-compramelafoto.",
});
