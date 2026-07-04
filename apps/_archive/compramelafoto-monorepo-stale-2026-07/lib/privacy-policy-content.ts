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

**3. Biometría / Reconocimiento Facial:** cuando usás la función de búsqueda por rostro en álbumes con fotos ocultas, guardamos una plantilla facial vinculada a tu email/álbum. Se elimina automáticamente a los 45 días o cuando lo solicitás.`,
  },
  {
    id: "uso",
    title: "Para qué los usamos",
    content: `- **Operación:** gestionar cuentas, pedidos, descargas y cobros.
- **Transaccional:** procesar pagos (Mercado Pago), impresiones y logística.
- **Soporte:** responder consultas e incidencias.
- **Seguridad:** prevenir fraudes y uso indebido.
- **Marketing:** solo con tu consentimiento explícito (opt-in); podés darte de baja en cualquier momento.
- **Biometría:** únicamente para ayudarte a encontrar tus fotos en álbumes con búsqueda facial; nunca para identificación masiva ni otros fines.`,
  },
  {
    id: "compartir",
    title: "Con quién los compartimos",
    content: `- **Fotógrafos:** dueños del álbum acceden a las fotos y datos de compra de su contenido.
- **Laboratorios de impresión:** para producir y enviar impresiones.
- **Logística:** datos de entrega cuando aplica envío.
- **Pasarela de pagos:** Mercado Pago procesa pagos (datos de tarjeta no pasan por nosotros).
- **Proveedores técnicos:** hosting (Vercel), email (Resend), almacenamiento (Cloudflare R2), análisis facial (AWS Rekognition).`,
  },
  {
    id: "plazos",
    title: "Plazos de conservación",
    content: `- **Cuentas:** mientras estén activas; tras supresión solicitada, datos mínimos para obligaciones legales.
- **Transacciones:** según normativa fiscal (período legal).
- **Fotos en álbumes:** 45 días desde la primera foto; luego se eliminan del servidor.
- **Marketing:** hasta que te des de baja + 2 años para demostrar cumplimiento.
- **Biometría:** vida del álbum; borrado a los 45 días o al vencer el álbum.`,
  },
  {
    id: "derechos",
    title: "Derechos del titular",
    content: `Tenés derecho a acceder, rectificar, suprimir u oponerte al tratamiento de tus datos, y a la portabilidad. Podés ejercerlos enviando un mail a ${CONTACT_EMAIL} o completando el formulario en ${PRIVACY_SOLICITUD_URL}.

Responderemos en un plazo razonable según la normativa vigente.`,
  },
];
