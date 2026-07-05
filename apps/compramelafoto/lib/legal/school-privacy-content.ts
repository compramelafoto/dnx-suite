/**
 * Política Escolar y Tratamiento de Datos de Menores — LEGAL-PACK-2026-06 / SCHOOL-PRIVACY-v1.0
 */

export const SCHOOL_PRIVACY_VERSION = "SCHOOL-PRIVACY-v1.0";
export const SCHOOL_PRIVACY_EFFECTIVE_DATE = "2026-06-01";

const CONTACT_EMAIL = process.env.PRIVACY_CONTACT_EMAIL || "privacidad@compramelafoto.com";

export type SchoolPrivacySection = {
  id: string;
  title: string;
  content: string;
};

export const SCHOOL_PRIVACY_SECTIONS: SchoolPrivacySection[] = [
  {
    id: "introduccion",
    title: "Introducción",
    content: `ComprameLaFoto permite a fotógrafos e **instituciones educativas** gestionar álbumes escolares, **padrón de alumnos**, **preventa** de paquetes fotográficos y, opcionalmente, búsqueda de fotos por identificación del alumno o selfie cargada por el adulto responsable.

Esta Política complementa la [Política de Privacidad](/privacidad) y aplica cuando se traten datos de **menores de edad** o datos del padrón escolar.`,
  },
  {
    id: "roles",
    title: "Roles",
    content: `- **Institución educativa:** proveer padrón veraz, autorizar tratamiento institucional, comunicar a las familias.
- **Fotógrafo:** contratar con la escuela, subir fotos, configurar ventas.
- **ComprameLaFoto:** plataforma tecnológica, encargada de tratamiento respecto de datos alojados.
- **Padre/madre/tutor:** compra preventa, carga selfie del menor si elige búsqueda facial, ejerce derechos ARCO del menor.`,
  },
  {
    id: "padron",
    title: "Datos del padrón escolar",
    content: `**Datos tratados:** nombre y apellido del alumno; nivel, curso, división, turno; DNI u otro identificador (opcional); ID externo institucional; datos de sincronización con matrícula institucional.

**Finalidad:** identificar al alumno en el proceso de compra (preventa y venta posterior); evitar duplicados y errores de asignación de fotos; sincronizar inscripciones entre álbumes de la misma institución.

**Legitimación:** contrato entre fotógrafo e institución; interés legítimo de la escuela en gestionar su padrón fotográfico. **No se utiliza el padrón para marketing a menores.**

**Acceso:** fotógrafo del álbum vinculado a la escuela; usuarios con rol Organizador escolar autorizados para esa institución; personal admin de ComprameLaFoto bajo procedimiento restringido.`,
  },
  {
    id: "preventa",
    title: "Preventa y compras por familias",
    content: `**Datos del adulto responsable:** email, nombre, teléfono del comprador; datos de pago vía Mercado Pago (sin almacenar tarjeta).

**Datos del menor en la orden:** nombre del alumno seleccionado del padrón o carga manual si está habilitada.

Al confirmar una preventa, el adulto declara ser padre/madre/tutor o estar autorizado para la compra; haber leído los términos de la preventa del álbum; y aceptar el tratamiento de datos del menor **solo** para la gestión de la compra y entrega de fotos.

**Texto de checkbox propuesto:**

> Declaro ser el padre, madre o tutor legal del alumno indicado (o estar expresamente autorizado por quien ejerce la responsabilidad parental) y acepto el tratamiento de sus datos personales conforme la Política Escolar y la Política de Privacidad.`,
  },
  {
    id: "selfies",
    title: "Selfies y reconocimiento facial de menores",
    content: `- Solo el **adulto responsable** puede subir una selfie del menor para búsqueda de fotos en preventa.
- Aplica el [Consentimiento Biométrico](/consentimiento-biometrico) en nombre del menor.
- Plazo máximo de conservación: **90 días** o fin del álbum, lo primero.
- Eliminación automática al canjear el pack, cancelar el pedido o solicitud ARCO.

**La Plataforma no garantiza que el reconocimiento facial encuentre todas las fotos del menor.**`,
  },
  {
    id: "fotografias",
    title: "Fotografías de menores en álbumes escolares",
    content: `- Las fotos son tomadas en contexto escolar autorizado por la institución.
- Las familias compran bajo los términos del fotógrafo y de la preventa.
- Cualquier persona puede solicitar **remoción por derecho de imagen** mediante los canales de solicitud de privacidad.`,
  },
  {
    id: "derechos",
    title: "Derechos ARCO de menores",
    content: `Las solicitudes respecto de menores deben ser presentadas por **titular con patria potestad o tutor**, acreditando identidad.

Tipos disponibles en /privacidad/solicitud con relación padre/madre/tutor.`,
  },
  {
    id: "conservacion",
    title: "Conservación del padrón",
    content: `- Duración del **ciclo lectivo** configurado + **12 meses** de gracia para reclamos y sincronización, salvo solicitud de supresión anticipada de la institución.
- Las importaciones CSV de padrón se anonimizan o eliminan a los **24 meses**.`,
  },
  {
    id: "seguridad",
    title: "Seguridad y confidencialidad",
    content: `Acceso por roles, logs de importación, prohibición de uso del padrón para fines ajenos al servicio fotográfico escolar.`,
  },
  {
    id: "contacto",
    title: "Contacto",
    content: `${CONTACT_EMAIL} — asunto: "Datos escolares"`,
  },
];
