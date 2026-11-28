import type { CampoDeLista, Cuestionario, Opcion } from "../tipos";

/**
 * Cuestionario para una marca que fabrica y vende productos propios y quiere su plataforma: tienda
 * online con envíos a todo el país, pedidos a medida, venta mayorista y una comunidad alrededor de
 * la marca. Lo estrena Proyecto Design (Jonatan Pérez, Paraná): arneses, correas y accesorios de
 * cuero hechos a mano para fotógrafos.
 *
 * Arranca de cero: lo que ya sabemos (nombre, ciudad, Instagram, correo) va precargado en la fila
 * de `FotofficeAltaCliente` y la persona sólo lo confirma. Los productos se cargan con fotos.
 */

const SI_MAS_ADELANTE_NO: Opcion[] = [
  { valor: "si", etiqueta: "Sí" },
  { valor: "mas_adelante", etiqueta: "Más adelante" },
  { valor: "no", etiqueta: "No" },
];

const CATEGORIAS: Opcion[] = [
  { valor: "arnes", etiqueta: "Arneses (para una o dos cámaras)" },
  { valor: "correa_cuello", etiqueta: "Correas de cuello u hombro" },
  { valor: "correa_mano", etiqueta: "Correas de mano o muñeca" },
  { valor: "cinturon", etiqueta: "Cinturones porta equipo" },
  { valor: "bolso", etiqueta: "Bolsos, mochilas o riñoneras" },
  { valor: "funda", etiqueta: "Fundas o medias fundas de cámara" },
  { valor: "porta_lente", etiqueta: "Porta lentes" },
  { valor: "porta_tarjetas", etiqueta: "Porta tarjetas y baterías" },
  { valor: "accesorio", etiqueta: "Accesorios (llaveros, clips, protectores)" },
  { valor: "kit", etiqueta: "Kits o combos" },
];

const STOCK: Opcion[] = [
  { valor: "stock", etiqueta: "Lo tengo hecho (en stock)" },
  { valor: "pedido", etiqueta: "Lo fabrico cuando me lo piden" },
  { valor: "ambos", etiqueta: "Algunos hechos y, si se acaban, a pedido" },
];

/** Los campos de cada producto. Igual para los diez principales y para los que sume después. */
const CAMPOS_DE_PRODUCTO: CampoDeLista[] = [
  { id: "nombre", titulo: "Nombre del producto", tipo: "texto" },
  { id: "categoria", titulo: "Categoría", tipo: "opcion", opciones: CATEGORIAS },
  {
    id: "fotos",
    titulo: "Fotos del producto",
    tipo: "fotos",
    maximo: 10,
    ayuda: "La primera es la portada. Ideal: una de frente con fondo liso, detalles del cuero y costuras, y una puesta (en uso).",
  },
  { id: "descripcion", titulo: "Descripción para la tienda (cómo se lo contarías a un cliente)", tipo: "parrafo" },
  { id: "para_quien", titulo: "¿Para quién es ideal? (bodas, eventos, viajes, estudio, una o dos cámaras…)", tipo: "texto" },
  { id: "materiales", titulo: "Materiales (tipo de cuero, herrajes, costura, forro)", tipo: "parrafo" },
  { id: "medidas", titulo: "Medidas del producto (largo, ancho, regulación)", tipo: "texto" },
  { id: "carga", titulo: "Peso de equipo que soporta (si aplica)", tipo: "texto" },
  {
    id: "variantes",
    titulo: "Variantes: colores, talles o largos disponibles",
    tipo: "parrafo",
    ayuda: "Por ejemplo: Colores: suela, negro, chocolate. Talles: S, M, L, XL. Si un talle cuesta distinto, aclaralo.",
  },
  { id: "tabla_talles", titulo: "Cómo elegir el talle (si aplica)", tipo: "parrafo" },
  { id: "precio", titulo: "Precio de venta al público", tipo: "dinero" },
  { id: "precio_oferta", titulo: "Precio de oferta o con descuento (si tiene)", tipo: "dinero" },
  { id: "precio_mayorista", titulo: "Precio mayorista (si vendés por mayor)", tipo: "dinero" },
  { id: "costo", titulo: "Lo que te cuesta fabricarlo (opcional, sólo lo ves vos)", tipo: "dinero" },
  { id: "stock_tipo", titulo: "¿Lo tenés hecho o lo fabricás a pedido?", tipo: "opcion", opciones: STOCK },
  { id: "stock", titulo: "¿Cuántos tenés hechos hoy?", tipo: "numero" },
  { id: "dias_fabricacion", titulo: "Días que tardás en fabricarlo si no hay stock", tipo: "numero" },
  { id: "peso_paquete", titulo: "Peso del paquete listo para enviar (en gramos)", tipo: "numero" },
  { id: "medidas_paquete", titulo: "Medidas del paquete (alto × ancho × largo, en cm)", tipo: "texto" },
  {
    id: "personalizable",
    titulo: "¿Se puede personalizar?",
    tipo: "opcion",
    opciones: [
      { valor: "no", etiqueta: "No" },
      { valor: "grabado", etiqueta: "Sí, con grabado (nombre, iniciales o logo)" },
      { valor: "medida", etiqueta: "Sí, a medida" },
      { valor: "ambos", etiqueta: "Sí, grabado y a medida" },
    ],
  },
  { id: "video", titulo: "Enlace a un video o reel del producto (opcional)", tipo: "enlace" },
  { id: "destacado", titulo: "¿Por qué se vende tanto? (lo que más te dicen los clientes)", tipo: "parrafo" },
];

export const CUESTIONARIO_MARCA_TIENDA_COMUNIDAD: Cuestionario = {
  clave: "marca-tienda-comunidad-v1",
  titulo: "Tu tienda y tu comunidad en FOTOFFICE",
  bienvenida:
    "Con estas respuestas armamos tu plataforma: el sitio, la tienda con envíos a todo el país, los pedidos a medida, la venta a revendedores y la comunidad de tu marca. Se guarda solo mientras escribís, así que podés completarlo en varias veces desde el mismo enlace (en la compu o en el celular). Lo más importante son tus productos, con sus fotos. Lo que no sepas todavía, dejalo vacío y lo charlamos.",
  secciones: [
    // ─────────────────────────────────────────────────────────────── 1
    {
      id: "datos",
      titulo: "Vos y tu marca",
      intro: "Algunas cosas ya las cargamos con lo que vimos en tu Instagram. Confirmalas o corregilas.",
      preguntas: [
        { id: "nombre_completo", titulo: "Tu nombre y apellido", tipo: "texto", obligatoria: true },
        { id: "marca", titulo: "Nombre de la marca, como querés que aparezca", tipo: "texto", obligatoria: true },
        {
          id: "email_acceso",
          titulo: "Correo con el que vas a entrar a administrar tu plataforma",
          ayuda: "Te va a llegar ahí el aviso de cada venta. Conviene uno que mires todos los días.",
          tipo: "email",
          obligatoria: true,
        },
        { id: "whatsapp", titulo: "WhatsApp para clientes", tipo: "telefono", placeholder: "343 …", obligatoria: true },
        {
          id: "whatsapp_mismo",
          titulo: "¿Es el mismo número en el que querés recibir los avisos de pedidos?",
          tipo: "si_no",
        },
        { id: "whatsapp_avisos", titulo: "¿A qué número te avisamos los pedidos?", tipo: "telefono", mostrarSi: { pregunta: "whatsapp_mismo", igualA: false } },
        { id: "email_publico", titulo: "Correo público para clientes (si es distinto)", tipo: "email" },
        { id: "ciudad", titulo: "Ciudad y provincia", tipo: "texto" },
        { id: "direccion_taller", titulo: "Dirección del taller", ayuda: "No se publica salvo que lo pidas. La usamos para calcular envíos.", tipo: "texto" },
        { id: "codigo_postal", titulo: "Código postal del taller (desde donde despachás)", tipo: "texto" },
        {
          id: "atiende_publico",
          titulo: "¿Se puede ir al taller a ver o retirar productos?",
          tipo: "opcion",
          opciones: [
            { valor: "si", etiqueta: "Sí, en horario fijo" },
            { valor: "coordinando", etiqueta: "Sí, coordinando antes" },
            { valor: "no", etiqueta: "No, sólo venta online" },
          ],
        },
        { id: "horarios", titulo: "Días y horarios", tipo: "texto", mostrarSi: { pregunta: "atiende_publico", distintoDe: "no" } },
        { id: "inicio", titulo: "¿Desde qué año existe la marca?", tipo: "numero" },
        { id: "equipo_cantidad", titulo: "¿Cuántas personas trabajan en la marca (con vos)?", tipo: "numero" },
      ],
    },
    // ─────────────────────────────────────────────────────────────── 2
    {
      id: "historia",
      titulo: "Tu historia y tu estilo",
      intro: "Con esto escribimos el «Sobre nosotros» y elegimos cómo se ve tu sitio.",
      preguntas: [
        { id: "historia", titulo: "¿Cómo nació Proyecto Design? Contalo como se lo contarías a un fotógrafo", tipo: "parrafo" },
        { id: "diferencia", titulo: "¿Qué te diferencia de otras marcas de arneses y correas?", tipo: "parrafo" },
        { id: "lema", titulo: "Una frase que resuma la marca (si tenés)", tipo: "texto" },
        { id: "proceso", titulo: "¿Cómo es el proceso de fabricación? (corte, costura, terminación, cuánto lleva)", tipo: "parrafo" },
        { id: "logo", titulo: "Tu logo", ayuda: "Si tenés la versión sin fondo (PNG), mejor. Podés subir varias versiones.", tipo: "fotos", maximo: 6 },
        { id: "fotos_marca", titulo: "Fotos tuyas, del taller y del proceso", ayuda: "Para la portada del sitio y el «Sobre nosotros». Las que más te gusten.", tipo: "fotos", maximo: 15 },
        { id: "fotos_clientes", titulo: "Fotos de fotógrafos usando tus productos (con permiso)", tipo: "fotos", maximo: 15 },
        { id: "colores", titulo: "Colores de la marca (si los tenés definidos)", tipo: "texto", placeholder: "Negro, suela, dorado…" },
        {
          id: "estilo",
          titulo: "¿Cómo te imaginás el sitio?",
          tipo: "opcion",
          conOtro: true,
          opciones: [
            { valor: "artesanal", etiqueta: "Artesanal y cálido (tonos cuero, madera, papel)" },
            { valor: "oscuro", etiqueta: "Oscuro y elegante (negro, fotos grandes)" },
            { valor: "minimal", etiqueta: "Minimalista y claro (blanco, mucho aire)" },
            { valor: "aventura", etiqueta: "Aventurero (viajes, exteriores, acción)" },
          ],
        },
        { id: "sitios_referencia", titulo: "Sitios o marcas que te gustan cómo se ven (enlaces)", tipo: "parrafo" },
        { id: "instagram", titulo: "Instagram", tipo: "texto" },
        { id: "facebook", titulo: "Facebook", tipo: "enlace" },
        { id: "tiktok", titulo: "TikTok", tipo: "texto" },
        { id: "youtube", titulo: "YouTube", tipo: "enlace" },
        {
          id: "testimonios",
          titulo: "Comentarios de clientes que quieras mostrar",
          ayuda: "Copiá mensajes o reseñas que te hayan dejado (con el nombre y, si es fotógrafo, su Instagram).",
          tipo: "lista",
          textoAgregar: "Sumar otro comentario",
          campos: [
            { id: "texto", titulo: "Lo que dijo", tipo: "parrafo" },
            { id: "nombre", titulo: "Nombre", tipo: "texto" },
            { id: "instagram", titulo: "Instagram o ciudad", tipo: "texto" },
          ],
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────── 3
    {
      id: "hoy",
      titulo: "Cómo vendés hoy",
      intro: "Para saber de dónde partimos y qué conviene automatizar primero.",
      preguntas: [
        {
          id: "canales_hoy",
          titulo: "¿Por dónde vendés hoy?",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            { valor: "instagram", etiqueta: "Instagram (mensajes directos)" },
            { valor: "whatsapp", etiqueta: "WhatsApp" },
            { valor: "mercadolibre", etiqueta: "Mercado Libre" },
            { valor: "tienda_propia", etiqueta: "Tienda online propia (Tienda Nube, Shopify, otra)" },
            { valor: "casas_foto", etiqueta: "Casas de fotografía o revendedores" },
            { valor: "ferias", etiqueta: "Ferias, congresos o eventos de fotografía" },
            { valor: "taller", etiqueta: "En el taller" },
          ],
        },
        { id: "tienda_actual", titulo: "Si tenés tienda online o Mercado Libre, pasanos el enlace", tipo: "enlace" },
        { id: "pedidos_mes", titulo: "¿Cuántos pedidos tenés por mes, más o menos?", tipo: "numero" },
        {
          id: "provincias",
          titulo: "¿De dónde son tus clientes?",
          tipo: "opciones",
          opciones: [
            { valor: "parana", etiqueta: "Paraná y alrededores" },
            { valor: "litoral", etiqueta: "Entre Ríos, Santa Fe y el Litoral" },
            { valor: "caba_gba", etiqueta: "CABA y Gran Buenos Aires" },
            { valor: "todo_pais", etiqueta: "Todo el país" },
            { valor: "exterior", etiqueta: "Del exterior" },
          ],
        },
        { id: "mas_vendido", titulo: "¿Cuál es tu producto más vendido?", tipo: "texto" },
        { id: "lo_que_mas_tiempo_lleva", titulo: "¿Qué parte de vender te lleva más tiempo hoy?", tipo: "parrafo", placeholder: "Contestar precios, pasar el alias, cotizar el envío, armar las etiquetas…" },
        { id: "preguntas_frecuentes", titulo: "Las preguntas que más te hacen los clientes (y qué contestás)", tipo: "parrafo" },
      ],
    },
    // ─────────────────────────────────────────────────────────────── 4
    {
      id: "catalogo",
      titulo: "Tu catálogo",
      intro: "Una mirada general antes de cargar producto por producto.",
      preguntas: [
        { id: "categorias", titulo: "¿Qué tipo de productos fabricás?", tipo: "opciones", conOtro: true, opciones: CATEGORIAS },
        { id: "cantidad_productos", titulo: "¿Cuántos productos distintos tenés en total (sin contar colores)?", tipo: "numero" },
        { id: "cueros", titulo: "Tipos de cuero que usás", tipo: "texto", placeholder: "Vaqueta, cuero graso, crudo…" },
        { id: "colores_cuero", titulo: "Colores de cuero disponibles", tipo: "texto" },
        { id: "herrajes", titulo: "Herrajes y terminaciones (acero, bronce, mosquetones, clips de seguridad…)", tipo: "texto" },
        { id: "garantia", titulo: "¿Qué garantía das y por cuánto tiempo?", tipo: "parrafo" },
        { id: "cuidados", titulo: "Cuidados del cuero que le recomendás al cliente", tipo: "parrafo" },
        {
          id: "fotos_profesionales",
          titulo: "¿Tenés fotos buenas de todos tus productos?",
          tipo: "opcion",
          opciones: [
            { valor: "si", etiqueta: "Sí, de todos" },
            { valor: "algunos", etiqueta: "De algunos" },
            { valor: "no", etiqueta: "No, hay que hacerlas" },
          ],
        },
        { id: "lanzamientos", titulo: "¿Tenés productos nuevos por lanzar? ¿Cuáles y cuándo?", tipo: "parrafo" },
      ],
    },
    // ─────────────────────────────────────────────────────────────── 5
    {
      id: "productos",
      titulo: "Tus 10 productos principales",
      intro:
        "La parte más importante. Cargá tus diez productos más vendidos, uno por casilla, con fotos. Si un producto viene en varios colores o talles, es UN producto: las variantes van en su campo. Si querés sumar más de diez, usá el botón del final.",
      preguntas: [
        {
          id: "productos",
          titulo: "Productos",
          tipo: "lista",
          obligatoria: true,
          textoAgregar: "Sumar otro producto",
          filasIniciales: Array.from({ length: 10 }, () => ({})),
          campos: CAMPOS_DE_PRODUCTO,
        },
        {
          id: "combos",
          titulo: "¿Armás combos o kits? (por ejemplo, arnés + porta tarjetas con descuento)",
          tipo: "parrafo",
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────── 6
    {
      id: "cobros",
      titulo: "Precios y cobros",
      preguntas: [
        {
          id: "mercadopago",
          titulo: "¿Tenés cuenta de Mercado Pago?",
          ayuda: "La tienda cobra con Mercado Pago y el dinero entra directo a tu cuenta. Después te mandamos un enlace para conectarla.",
          tipo: "opcion",
          opciones: [
            { valor: "si", etiqueta: "Sí" },
            { valor: "no", etiqueta: "No, la tengo que abrir" },
          ],
        },
        {
          id: "medios_pago",
          titulo: "¿Qué medios de pago querés aceptar?",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            { valor: "mp", etiqueta: "Mercado Pago (tarjetas, dinero en cuenta)" },
            { valor: "transferencia", etiqueta: "Transferencia bancaria" },
            { valor: "efectivo", etiqueta: "Efectivo (en el taller)" },
          ],
        },
        { id: "alias_cbu", titulo: "Alias o CBU para transferencias", tipo: "texto", mostrarSi: { pregunta: "medios_pago", incluye: "transferencia" } },
        { id: "descuento_transferencia", titulo: "¿Hacés descuento por transferencia o efectivo? ¿Cuánto (%)?", tipo: "numero" },
        {
          id: "cuotas",
          titulo: "¿Querés ofrecer cuotas sin interés?",
          ayuda: "Mercado Pago te cobra un recargo por cada cuota que absorbés. Lo vemos juntos.",
          tipo: "opcion",
          opciones: [
            { valor: "no", etiqueta: "No, las cuotas las paga el cliente" },
            { valor: "3", etiqueta: "Sí, 3 cuotas sin interés" },
            { valor: "6", etiqueta: "Sí, 6 cuotas sin interés" },
            { valor: "ver", etiqueta: "No sé, quiero ver los números" },
          ],
        },
        {
          id: "facturacion",
          titulo: "¿Cómo facturás?",
          tipo: "opcion",
          opciones: [
            { valor: "monotributo", etiqueta: "Monotributo (factura C)" },
            { valor: "ri", etiqueta: "Responsable inscripto (factura A y B)" },
            { valor: "no", etiqueta: "Todavía no facturo" },
          ],
        },
        { id: "cuit", titulo: "CUIT", tipo: "texto", mostrarSi: { pregunta: "facturacion", distintoDe: "no" } },
        { id: "razon_social", titulo: "Razón social (como figura en ARCA)", tipo: "texto", mostrarSi: { pregunta: "facturacion", distintoDe: "no" } },
        {
          id: "factura_automatica",
          titulo: "¿Querés que la factura salga sola con cada venta?",
          tipo: "opcion",
          opciones: SI_MAS_ADELANTE_NO,
          mostrarSi: { pregunta: "facturacion", distintoDe: "no" },
        },
        {
          id: "actualiza_precios",
          titulo: "¿Cada cuánto actualizás los precios?",
          tipo: "opcion",
          opciones: [
            { valor: "mensual", etiqueta: "Todos los meses" },
            { valor: "trimestral", etiqueta: "Cada dos o tres meses" },
            { valor: "cuando_sube", etiqueta: "Cuando me sube el cuero" },
          ],
        },
        {
          id: "cupones",
          titulo: "¿Qué promociones te gustaría tener?",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            { valor: "primera_compra", etiqueta: "Descuento en la primera compra" },
            { valor: "cupones", etiqueta: "Cupones para influencers o embajadores" },
            { valor: "fechas", etiqueta: "Fechas especiales (Hot Sale, Black Friday, Día del Fotógrafo)" },
            { valor: "segunda_unidad", etiqueta: "Descuento en la segunda unidad" },
            { valor: "envio_gratis", etiqueta: "Envío gratis por tiempo limitado" },
          ],
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────── 7
    {
      id: "envios",
      titulo: "Envíos a todo el país",
      intro: "Con esto la tienda calcula el envío sola en cada compra.",
      preguntas: [
        {
          id: "correos",
          titulo: "¿Con qué correos enviás hoy?",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            { valor: "andreani", etiqueta: "Andreani" },
            { valor: "correo_argentino", etiqueta: "Correo Argentino" },
            { valor: "oca", etiqueta: "OCA" },
            { valor: "via_cargo", etiqueta: "Vía Cargo" },
            { valor: "micro", etiqueta: "Encomienda en micro" },
            { valor: "cadete", etiqueta: "Moto o cadete en Paraná" },
          ],
        },
        {
          id: "cuenta_empresa",
          titulo: "¿Tenés cuenta empresa o contrato con algún correo?",
          ayuda: "Por ejemplo MiCorreo de Correo Argentino o una cuenta corporativa de Andreani.",
          tipo: "opcion",
          opciones: [
            { valor: "si", etiqueta: "Sí" },
            { valor: "no", etiqueta: "No, voy a la sucursal y pago ahí" },
          ],
        },
        { id: "cuenta_empresa_cual", titulo: "¿Con cuál o cuáles?", tipo: "texto", mostrarSi: { pregunta: "cuenta_empresa", igualA: "si" } },
        {
          id: "entrega",
          titulo: "¿Cómo querés que reciban los clientes?",
          tipo: "opciones",
          opciones: [
            { valor: "domicilio", etiqueta: "En su casa" },
            { valor: "sucursal", etiqueta: "En una sucursal del correo (más barato)" },
            { valor: "retiro", etiqueta: "Retiro en el taller" },
          ],
        },
        {
          id: "quien_paga_envio",
          titulo: "¿Quién paga el envío?",
          tipo: "opcion",
          opciones: [
            { valor: "comprador", etiqueta: "El comprador, según lo que cotice el correo" },
            { valor: "gratis_desde", etiqueta: "Gratis a partir de cierto monto de compra" },
            { valor: "fijo", etiqueta: "Un costo fijo para todo el país" },
            { valor: "gratis", etiqueta: "Siempre gratis (lo incluyo en el precio)" },
          ],
        },
        { id: "gratis_desde_monto", titulo: "¿Desde qué monto es gratis?", tipo: "dinero", mostrarSi: { pregunta: "quien_paga_envio", igualA: "gratis_desde" } },
        { id: "costo_fijo", titulo: "¿Cuánto cobrás de envío?", tipo: "dinero", mostrarSi: { pregunta: "quien_paga_envio", igualA: "fijo" } },
        { id: "dias_despacho", titulo: "Una vez pagado, ¿en cuántos días hábiles lo despachás (si está hecho)?", tipo: "numero" },
        { id: "dias_despacho_pedido", titulo: "¿Y si hay que fabricarlo?", tipo: "texto", placeholder: "Entre 7 y 10 días hábiles" },
        { id: "embalaje", titulo: "¿Cómo lo embalás? (caja, bolsa de tela, papel, tarjeta…)", tipo: "parrafo" },
        {
          id: "seguro",
          titulo: "¿Asegurás los envíos por el valor del producto?",
          tipo: "opcion",
          opciones: [
            { valor: "si", etiqueta: "Sí, siempre" },
            { valor: "caro", etiqueta: "Sólo los caros" },
            { valor: "no", etiqueta: "No" },
          ],
        },
        { id: "exterior", titulo: "¿Querés vender al exterior?", tipo: "opcion", opciones: SI_MAS_ADELANTE_NO },
        { id: "exterior_como", titulo: "¿Ya enviaste al exterior? ¿Cómo?", tipo: "parrafo", mostrarSi: { pregunta: "exterior", distintoDe: "no" } },
        { id: "cambios", titulo: "Cambios y devoluciones: ¿qué aceptás, en cuántos días y quién paga el envío de vuelta?", tipo: "parrafo" },
        { id: "envio_problemas", titulo: "¿Qué hacés si un paquete se pierde o llega dañado?", tipo: "parrafo" },
      ],
    },
    // ─────────────────────────────────────────────────────────────── 8
    {
      id: "medida",
      titulo: "Pedidos a medida y personalizados",
      preguntas: [
        { id: "medida_hace", titulo: "¿Hacés productos personalizados o a medida?", tipo: "si_no" },
        {
          id: "medida_que",
          titulo: "¿Qué se puede personalizar?",
          tipo: "opciones",
          conOtro: true,
          mostrarSi: { pregunta: "medida_hace", igualA: true },
          opciones: [
            { valor: "grabado_nombre", etiqueta: "Grabado de nombre o iniciales" },
            { valor: "grabado_logo", etiqueta: "Grabado del logo del fotógrafo o estudio" },
            { valor: "medida", etiqueta: "Medidas especiales (talles fuera de tabla)" },
            { valor: "color", etiqueta: "Combinación de colores a elección" },
            { valor: "diseno", etiqueta: "Diseño nuevo desde cero" },
          ],
        },
        { id: "grabado_precio", titulo: "¿Cuánto cuesta el grabado?", tipo: "dinero", mostrarSi: { pregunta: "medida_hace", igualA: true } },
        { id: "grabado_como", titulo: "¿Cómo grabás? (láser, bajo relieve, sello caliente) y qué tamaño máximo", tipo: "texto", mostrarSi: { pregunta: "medida_hace", igualA: true } },
        { id: "sena", titulo: "¿Pedís seña? ¿De qué porcentaje?", tipo: "numero", mostrarSi: { pregunta: "medida_hace", igualA: true } },
        { id: "medida_plazo", titulo: "¿Cuánto tardás en un pedido a medida?", tipo: "texto", mostrarSi: { pregunta: "medida_hace", igualA: true } },
        {
          id: "medida_boceto",
          titulo: "¿Le mostrás al cliente un boceto o prueba antes de hacerlo?",
          tipo: "si_no",
          mostrarSi: { pregunta: "medida_hace", igualA: true },
        },
        {
          id: "medida_datos",
          titulo: "¿Qué datos le tenés que pedir al cliente? (medidas del cuerpo, cámara que usa, logo en alta…)",
          tipo: "parrafo",
          mostrarSi: { pregunta: "medida_hace", igualA: true },
        },
        { id: "medida_devolucion", titulo: "¿Aceptás cambios en productos personalizados?", tipo: "si_no", mostrarSi: { pregunta: "medida_hace", igualA: true } },
        { id: "medida_fotos", titulo: "Fotos de trabajos personalizados que hayas hecho", tipo: "fotos", maximo: 12, mostrarSi: { pregunta: "medida_hace", igualA: true } },
      ],
    },
    // ─────────────────────────────────────────────────────────────── 9
    {
      id: "mayorista",
      titulo: "Venta mayorista y revendedores",
      preguntas: [
        { id: "mayorista_vende", titulo: "¿Vendés o querés vender por mayor?", tipo: "opcion", opciones: SI_MAS_ADELANTE_NO },
        {
          id: "mayorista_a_quien",
          titulo: "¿A quiénes?",
          tipo: "opciones",
          conOtro: true,
          mostrarSi: { pregunta: "mayorista_vende", distintoDe: "no" },
          opciones: [
            { valor: "casas_foto", etiqueta: "Casas de fotografía" },
            { valor: "revendedores", etiqueta: "Revendedores particulares" },
            { valor: "estudios", etiqueta: "Estudios o productoras (para su equipo)" },
            { valor: "escuelas", etiqueta: "Escuelas de fotografía" },
            { valor: "marcas", etiqueta: "Otras marcas (fabricación para terceros)" },
          ],
        },
        { id: "mayorista_minimo", titulo: "Compra mínima (en unidades o en dinero)", tipo: "texto", mostrarSi: { pregunta: "mayorista_vende", distintoDe: "no" } },
        { id: "mayorista_descuento", titulo: "Descuento mayorista sobre el precio al público (%)", tipo: "numero", mostrarSi: { pregunta: "mayorista_vende", distintoDe: "no" } },
        {
          id: "mayorista_registro",
          titulo: "¿Cómo querés que entren los revendedores?",
          tipo: "opcion",
          mostrarSi: { pregunta: "mayorista_vende", distintoDe: "no" },
          opciones: [
            { valor: "solicitud", etiqueta: "Piden acceso en la web y yo los apruebo" },
            { valor: "invitacion", etiqueta: "Sólo los que yo invito" },
          ],
        },
        { id: "mayorista_pago", titulo: "¿Les das otras condiciones de pago? (cuenta corriente, consignación, 50 % y 50 %)", tipo: "parrafo", mostrarSi: { pregunta: "mayorista_vende", distintoDe: "no" } },
        { id: "mayorista_zona", titulo: "¿Das exclusividad por ciudad o zona?", tipo: "si_no", mostrarSi: { pregunta: "mayorista_vende", distintoDe: "no" } },
        {
          id: "revendedores_actuales",
          titulo: "Revendedores o casas que ya venden tus productos",
          ayuda: "Si querés, los mostramos en el sitio como «Dónde comprar».",
          tipo: "lista",
          textoAgregar: "Sumar otro",
          mostrarSi: { pregunta: "mayorista_vende", distintoDe: "no" },
          campos: [
            { id: "nombre", titulo: "Nombre", tipo: "texto" },
            { id: "ciudad", titulo: "Ciudad", tipo: "texto" },
            { id: "contacto", titulo: "Contacto (Instagram, WhatsApp o web)", tipo: "texto" },
            {
              id: "mostrar",
              titulo: "¿Lo mostramos en el sitio?",
              tipo: "opcion",
              opciones: [
                { valor: "si", etiqueta: "Sí" },
                { valor: "no", etiqueta: "No" },
              ],
            },
          ],
        },
      ],
    },
    // ─────────────────────────────────────────────────────────────── 10
    {
      id: "comunidad",
      titulo: "Tu comunidad",
      intro: "La idea es que alrededor de la marca se arme una comunidad de fotógrafos. Contanos qué te imaginás.",
      preguntas: [
        { id: "comunidad_nombre", titulo: "¿Cómo se llamaría la comunidad? (si ya lo pensaste)", tipo: "texto", placeholder: "Comunidad Proyecto Design, PD Team…" },
        {
          id: "comunidad_que",
          titulo: "¿Qué te gustaría que tenga?",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            { valor: "beneficios", etiqueta: "Club con beneficios (descuentos, preventa de productos nuevos)" },
            { valor: "embajadores", etiqueta: "Embajadores o «team» de fotógrafos que usan la marca" },
            { valor: "sorteos", etiqueta: "Sorteos para la comunidad" },
            { valor: "galeria", etiqueta: "Galería con fotos de la comunidad usando tus productos" },
            { valor: "contenido", etiqueta: "Contenido: tips, tutoriales, cuidado del equipo" },
            { valor: "encuentros", etiqueta: "Encuentros, salidas fotográficas o workshops" },
            { valor: "referidos", etiqueta: "Referidos: quien trae un cliente gana un descuento" },
            { valor: "puntos", etiqueta: "Puntos por compra que se canjean" },
            { valor: "grupo", etiqueta: "Grupo de WhatsApp de la comunidad" },
            { valor: "concursos", etiqueta: "Concursos de fotografía con premios" },
          ],
        },
        {
          id: "comunidad_costo",
          titulo: "¿La comunidad sería gratis o paga?",
          tipo: "opcion",
          opciones: [
            { valor: "gratis", etiqueta: "Gratis: se suma cualquiera que se registre" },
            { valor: "compra", etiqueta: "Se entra comprando un producto" },
            { valor: "paga", etiqueta: "Con una cuota mensual o anual" },
            { valor: "mixta", etiqueta: "Gratis, con un nivel pago con más beneficios" },
          ],
        },
        { id: "comunidad_cuota", titulo: "¿Cuánto costaría la cuota?", tipo: "dinero", mostrarSi: [{ pregunta: "comunidad_costo", distintoDe: "gratis" }, { pregunta: "comunidad_costo", distintoDe: "compra" }] },
        { id: "comunidad_beneficios", titulo: "¿Qué beneficios concretos tendrían los miembros?", tipo: "parrafo" },
        {
          id: "embajadores_actuales",
          titulo: "Fotógrafos que hoy usan y recomiendan tu marca (posibles embajadores)",
          tipo: "lista",
          textoAgregar: "Sumar otro fotógrafo",
          campos: [
            { id: "nombre", titulo: "Nombre", tipo: "texto" },
            { id: "instagram", titulo: "Instagram", tipo: "texto" },
            { id: "ciudad", titulo: "Ciudad", tipo: "texto" },
            { id: "especialidad", titulo: "Especialidad (bodas, eventos, deportes…)", tipo: "texto" },
          ],
        },
        { id: "embajador_beneficio", titulo: "¿Qué le darías a un embajador? (productos, comisión por venta, cupón propio)", tipo: "parrafo" },
        {
          id: "sorteos_frecuencia",
          titulo: "¿Cada cuánto harías sorteos?",
          tipo: "opcion",
          opciones: [
            { valor: "mensual", etiqueta: "Todos los meses" },
            { valor: "fechas", etiqueta: "En fechas especiales" },
            { valor: "no", etiqueta: "No quiero sorteos" },
          ],
        },
        { id: "alianzas", titulo: "¿Con qué otras marcas, escuelas o fotógrafos te gustaría aliarte?", tipo: "parrafo" },
        { id: "contenido_produce", titulo: "¿Qué contenido podés producir vos? (videos del taller, reels, tips)", tipo: "parrafo" },
        {
          id: "novedades",
          titulo: "¿Querés mandar novedades por correo a tus clientes? (lanzamientos, promos)",
          tipo: "opcion",
          opciones: SI_MAS_ADELANTE_NO,
        },
        { id: "base_clientes", titulo: "¿Tenés una lista de clientes anteriores (planilla, contactos)? ¿Cuántos más o menos?", tipo: "texto" },
      ],
    },
    // ─────────────────────────────────────────────────────────────── 11
    {
      id: "automatico",
      titulo: "Lo que querés que funcione solo",
      preguntas: [
        {
          id: "automatizar",
          titulo: "Marcá todo lo que te gustaría que pase sin que tengas que hacer nada",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            { valor: "aviso_venta", etiqueta: "Aviso por WhatsApp o correo cuando entra una venta" },
            { valor: "confirmacion", etiqueta: "Correo de confirmación al cliente con el resumen" },
            { valor: "seguimiento", etiqueta: "Avisarle al cliente cuando se despacha, con el número de seguimiento" },
            { valor: "carrito", etiqueta: "Recordatorio a quien dejó el carrito sin pagar" },
            { valor: "resena", etiqueta: "Pedir una reseña o una foto unos días después de que llegó" },
            { valor: "stock_bajo", etiqueta: "Aviso cuando un producto se está quedando sin stock" },
            { valor: "cumpleanos", etiqueta: "Cupón de cumpleaños para clientes" },
            { valor: "factura", etiqueta: "Factura automática" },
            { valor: "bot", etiqueta: "Respuestas automáticas por WhatsApp a las preguntas frecuentes" },
          ],
        },
        { id: "atiende", titulo: "¿Quién atiende las consultas y en qué horario?", tipo: "texto" },
        { id: "respuesta_tipo", titulo: "Si un cliente pregunta «¿cuál me conviene?», ¿qué le preguntás para recomendarle?", tipo: "parrafo" },
      ],
    },
    // ─────────────────────────────────────────────────────────────── 12
    {
      id: "sitio",
      titulo: "Sitio y dominio",
      preguntas: [
        {
          id: "dominio_tiene",
          titulo: "¿Tenés dominio propio (proyectodesign.com.ar o similar)?",
          tipo: "opcion",
          opciones: [
            { valor: "si", etiqueta: "Sí" },
            { valor: "no_quiero", etiqueta: "No, quiero comprar uno" },
            { valor: "no_por_ahora", etiqueta: "No, por ahora uso la dirección de FOTOFFICE" },
          ],
        },
        { id: "dominio", titulo: "¿Cuál?", tipo: "texto", mostrarSi: { pregunta: "dominio_tiene", igualA: "si" } },
        { id: "dominio_donde", titulo: "¿Dónde lo compraste? (NIC Argentina, DonWeb, GoDaddy…)", tipo: "texto", mostrarSi: { pregunta: "dominio_tiene", igualA: "si" } },
        { id: "dominio_idea", titulo: "¿Qué nombre te gustaría?", tipo: "texto", mostrarSi: { pregunta: "dominio_tiene", igualA: "no_quiero" } },
        {
          id: "secciones_sitio",
          titulo: "¿Qué secciones querés en el sitio?",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            { valor: "tienda", etiqueta: "Tienda" },
            { valor: "a_medida", etiqueta: "Pedidos a medida" },
            { valor: "nosotros", etiqueta: "Sobre nosotros / el taller" },
            { valor: "comunidad", etiqueta: "Comunidad" },
            { valor: "galeria", etiqueta: "Galería de fotógrafos" },
            { valor: "donde_comprar", etiqueta: "Dónde comprar (revendedores)" },
            { valor: "mayoristas", etiqueta: "Acceso mayoristas" },
            { valor: "guia_talles", etiqueta: "Guía de talles" },
            { valor: "preguntas", etiqueta: "Preguntas frecuentes" },
            { valor: "blog", etiqueta: "Blog / novedades" },
          ],
        },
        { id: "ingles", titulo: "¿Querés el sitio también en inglés?", tipo: "opcion", opciones: SI_MAS_ADELANTE_NO },
      ],
    },
    // ─────────────────────────────────────────────────────────────── 13
    {
      id: "cierre",
      titulo: "Equipo y cierre",
      preguntas: [
        {
          id: "equipo",
          titulo: "¿Alguien más va a usar el sistema? (para ver pedidos, despachar o atender)",
          tipo: "lista",
          textoAgregar: "Sumar otra persona",
          campos: [
            { id: "nombre", titulo: "Nombre", tipo: "texto" },
            { id: "correo", titulo: "Correo", tipo: "texto" },
            { id: "tarea", titulo: "¿Qué hace? (despacho, atención, redes, fabricación)", tipo: "texto" },
          ],
        },
        { id: "fecha_lanzamiento", titulo: "¿Para cuándo te gustaría tener la tienda andando?", tipo: "fecha" },
        { id: "prioridad", titulo: "Si tuvieras que elegir UNA cosa para arrancar, ¿cuál sería?", tipo: "parrafo" },
        { id: "comentarios", titulo: "¿Algo más que quieras contarnos o que no te hayamos preguntado?", tipo: "parrafo" },
      ],
    },
  ],
};
