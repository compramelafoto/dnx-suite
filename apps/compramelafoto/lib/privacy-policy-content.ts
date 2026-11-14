/**
 * Contenido de la Política de Privacidad (AAIP - bases registradas)
 */

const CONTACT_EMAIL = process.env.PRIVACY_CONTACT_EMAIL || "privacidad@compramelafoto.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://compramelafoto.com";

export const PRIVACY_CONTACT_EMAIL = CONTACT_EMAIL;
export const PRIVACY_SOLICITUD_URL = `${APP_URL}/privacidad/solicitud`;

export const PRIVACY_SECTIONS = [
  {
    id: "datos",
    title: "Qué datos recolectamos",
    content: `Recolectamos datos de tres bases registradas ante AAIP:

**1. Usuarios y Operaciones:** nombre, email, teléfono, dirección, datos de cuenta; información de compras, pedidos y transacciones; fotos subidas en álbumes; logs de actividad y accesos.

**2. Marketing y Comunicaciones:** email, preferencias de comunicación, historial de bajas (unsubscribe). Solo enviamos campañas a quienes optaron explícitamente.

**3. Biometría / Reconocimiento Facial:** cuando usás la función de búsqueda por rostro en álbumes con fotos ocultas, guardamos una plantilla facial vinculada a tu email/álbum. Se elimina automáticamente a los **90 días** desde el consentimiento, al finalizar el álbum (lo primero) o cuando lo revocás. Ver [Consentimiento Biométrico](/consentimiento-biometrico).`,
  },
  {
    id: "uso",
    title: "Para qué los usamos",
    content: `- **Operación:** gestionar cuentas, pedidos, descargas y cobros.
- **Transaccional:** procesar pagos (Mercado Pago), impresiones y logística.
- **Soporte:** responder consultas e incidencias.
- **Seguridad:** prevenir fraudes y uso indebido.
- **Marketing por correo:** solo con tu consentimiento explícito (la casilla de novedades, que viene sin marcar); podés darte de baja en cualquier momento.
- **Medición y publicidad en redes:** ver «Publicidad en redes sociales (Meta)» más abajo.
- **Biometría:** únicamente para ayudarte a encontrar tus fotos en álbumes con búsqueda facial; nunca para identificación masiva ni otros fines.`,
  },
  {
    id: "compartir",
    title: "Con quién los compartimos",
    content: `- **Fotógrafos:** dueños del álbum acceden a las fotos y datos de compra de su contenido.
- **Laboratorios de impresión:** para producir y enviar impresiones.
- **Logística:** datos de entrega cuando aplica envío.
- **Pasarela de pagos:** Mercado Pago procesa pagos (datos de tarjeta no pasan por nosotros).
- **Proveedores técnicos:** hosting (Vercel), email (Resend), almacenamiento (Cloudflare R2), análisis facial (AWS Rekognition).
- **Meta Platforms (Facebook e Instagram):** para medir nuestros anuncios y mostrarlos a las personas indicadas, como se explica en la sección siguiente.`,
  },
  {
    id: "publicidad",
    title: "Publicidad en redes sociales (Meta)",
    content: `Usamos herramientas de Meta Platforms (Facebook e Instagram) para medir y dirigir nuestros anuncios a fotógrafos:

- **Píxel y API de conversiones:** cuando navegás el sitio o realizás acciones como registrarte, crear tu primer álbum o hacer tu primera venta, le avisamos a Meta que ese evento ocurrió. Junto con el evento enviamos tu email, tu teléfono (si lo cargaste) y un identificador interno, siempre **cifrados con SHA-256** (Meta no recibe el dato legible); además la dirección IP y el navegador desde el que entraste y, en el caso de la primera venta, su monto. Nunca enviamos fotos, datos de tus compradores ni datos biométricos.
- **Públicos personalizados:** si tenés cuenta de fotógrafo, podemos subir a Meta tu email **cifrado** para no mostrarte anuncios de registro (porque ya tenés cuenta) o para que Meta encuentre a otros fotógrafos con un perfil parecido («públicos similares»). Meta usa esos datos solo para esa coincidencia y los descarta después; no los suma a tu perfil ni se los muestra a nadie.
- **Cómo oponerte:** desactivá «Novedades y publicidad» en Configuración, tocá «darme de baja» en cualquiera de nuestros correos o escribinos a ${CONTACT_EMAIL}. Desde ese momento no te incluimos en las próximas listas. También podés ajustar tus preferencias de anuncios desde tu cuenta de Facebook o Instagram.

Meta trata estos datos según sus propias condiciones como encargado del tratamiento y puede procesarlos fuera de Argentina, con las garantías que exige la Ley 25.326.`,
  },
  {
    id: "plazos",
    title: "Plazos de conservación",
    content: `- **Cuentas:** mientras estén activas; tras supresión solicitada, datos mínimos para obligaciones legales.
- **Transacciones:** según normativa fiscal (período legal).
- **Fotos en álbumes:** 45 días desde la primera foto; luego se eliminan del servidor.
- **Marketing:** hasta que te des de baja + 2 años para demostrar cumplimiento.
- **Biometría / selfies / plantillas faciales:** **90 días** desde el consentimiento o fin del álbum (lo primero); detalle en [/consentimiento-biometrico](/consentimiento-biometrico) y [/privacidad/retencion](/privacidad/retencion).`,
  },
  {
    id: "derechos",
    title: "Derechos del titular",
    content: `Tenés derecho a acceder, rectificar, suprimir u oponerte al tratamiento de tus datos, y a la portabilidad. Podés ejercerlos enviando un mail a ${CONTACT_EMAIL} o completando el formulario en ${PRIVACY_SOLICITUD_URL}.

Responderemos en un plazo razonable según la normativa vigente.`,
  },
];
