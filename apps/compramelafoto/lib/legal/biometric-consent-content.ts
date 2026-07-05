/**
 * Consentimiento Biométrico — LEGAL-PACK-2026-06 / BIOMETRIC-v1.0
 * Documento independiente; debe aceptarse además de la Política de Privacidad al usar biometría.
 */

export const BIOMETRIC_CONSENT_VERSION = "BIOMETRIC-v1.0";
export const BIOMETRIC_CONSENT_EFFECTIVE_DATE = "2026-06-01";

const CONTACT_EMAIL = process.env.PRIVACY_CONTACT_EMAIL || "privacidad@compramelafoto.com";

export type BiometricConsentSection = {
  id: string;
  title: string;
  content: string;
};

export const BIOMETRIC_CONSENT_SECTIONS: BiometricConsentSection[] = [
  {
    id: "autorizando",
    title: "¿Qué estás autorizando?",
    content: `Al aceptar este Consentimiento, autorizás a ComprameLaFoto a:

1. **Recibir y almacenar temporalmente** una imagen de tu rostro (selfie) que vos subís voluntariamente.
2. **Generar y procesar una plantilla facial** (datos biométricos) mediante el servicio **AWS Rekognition** de Amazon Web Services, exclusivamente para:
   - ayudarte a **encontrar tus fotos** en un álbum o evento determinado;
   - **avisarte por email u otro canal** cuando haya fotos que podrían corresponderte, si activaste esa función.
3. **Comparar** esa plantilla con rostros detectados en las fotografías del álbum autorizado por el fotógrafo u organizador.`,
  },
  {
    id: "no-hacemos",
    title: "¿Qué NO hacemos con tu biometría?",
    content: `- No la usamos para vigilancia, seguridad pública ni identificación en bases masivas.
- No la vendemos ni la cedemos a fines comerciales de terceros.
- No la utilizamos para decisiones que produzcan efectos jurídicos sobre vos sin intervención humana.`,
  },
  {
    id: "datos",
    title: "Datos tratados",
    content: `- Selfie (imagen)
- Plantilla facial / identificadores técnicos en AWS Rekognition
- Email, nombre o teléfono si los proporcionaste para notificarte
- Registro de fecha, hora, IP y versión de este consentimiento`,
  },
  {
    id: "almacenamiento",
    title: "Almacenamiento",
    content: `Los datos biométricos se almacenan en infraestructura de nube con medidas de seguridad técnicas y organizativas. La selfie y la plantilla facial se conservan solo el tiempo necesario para las finalidades descritas en este documento y en la Política de Retención.

Contacto de privacidad: ${CONTACT_EMAIL}`,
  },
  {
    id: "aws-rekognition",
    title: "AWS Rekognition",
    content: `ComprameLaFoto utiliza **Amazon Rekognition** (Amazon Web Services) para:

- detectar rostros en las fotografías del álbum;
- indexar y almacenar plantillas faciales asociadas al servicio de la Plataforma;
- comparar tu selfie con las plantillas indexadas y devolver coincidencias dentro del álbum autorizado.

El tratamiento se limita a las finalidades de búsqueda y notificación descritas en este Consentimiento. AWS actúa como encargado del tratamiento bajo acuerdos contractuales de protección de datos.`,
  },
  {
    id: "cloudflare-r2",
    title: "Cloudflare R2",
    content: `La **selfie** que subís se almacena en **Cloudflare R2** (almacenamiento de objetos en la nube) mientras dure el tratamiento biométrico autorizado.

Cloudflare actúa como proveedor de infraestructura. La imagen no se utiliza para otros fines distintos a los indicados en este documento.`,
  },
  {
    id: "plazo-conservacion",
    title: "Plazo de conservación",
    content: `**90 días** desde que otorgás el consentimiento, o hasta la **finalización o eliminación del álbum**, lo que ocurra **primero**.

Transcurrido ese plazo, eliminamos la selfie y la plantilla facial. Podemos conservar tu email y nombre si seguís suscrito a avisos no biométricos, sin conservar la plantilla.`,
  },
  {
    id: "revocacion",
    title: "Revocación",
    content: `Podés revocar este consentimiento en cualquier momento:

- Desde tu cuenta: configuración de privacidad → revocar búsqueda facial
- Sin cuenta: enlace **"Eliminar mis datos biométricos"** en el email de notificación (\`/delete-biometric?token=...\`)
- Escribiendo a ${CONTACT_EMAIL}
- Completando el formulario en /privacidad/solicitud (opción "Desactivar reconocimiento facial")

La revocación no afecta la licitud del tratamiento previo. Dejaremos de procesar biometría y eliminaremos plantillas en un plazo razonable (orientativo: 72 horas hábiles).`,
  },
  {
    id: "consecuencias",
    title: "Consecuencias de no aceptar",
    content: `No podrás usar la búsqueda por rostro ni recibir avisos basados en selfie.

Podés igualmente navegar el álbum y comprar fotos por otros medios (búsqueda manual, listado, padrón escolar, etc.).`,
  },
  {
    id: "menores",
    title: "Menores",
    content: `Si el titular es menor de edad, el consentimiento debe ser otorgado por **padre, madre o tutor legal**, conforme la Política Escolar (/privacidad/escuelas).`,
  },
  {
    id: "transferencias",
    title: "Transferencias internacionales",
    content: `El procesamiento biométrico puede implicar transferencia de datos a servidores de **Amazon Web Services** y **Cloudflare** ubicados fuera de la República Argentina.

Estas transferencias se realizan con salvaguardas contractuales y medidas de seguridad acordes a la Ley 25.326 y normativa de la AAIP.`,
  },
  {
    id: "declaracion",
    title: "Declaración de aceptación",
    content: `Al marcar la casilla de aceptación en la Plataforma, declarás:

> He leído y acepto el Consentimiento Biométrico de ComprameLaFoto. Autorizo el tratamiento de mis datos biométricos en los términos allí descriptos. Entiendo que puedo revocarlo en cualquier momento.

**Versión del documento:** ${BIOMETRIC_CONSENT_VERSION}
**Vigencia desde:** ${BIOMETRIC_CONSENT_EFFECTIVE_DATE}`,
  },
];

export const BIOMETRIC_CONSENT_CHECKBOX_TEXT =
  "He leído y acepto el Consentimiento Biométrico de ComprameLaFoto. Autorizo el tratamiento de mis datos biométricos en los términos allí descriptos. Entiendo que puedo revocarlo en cualquier momento.";
