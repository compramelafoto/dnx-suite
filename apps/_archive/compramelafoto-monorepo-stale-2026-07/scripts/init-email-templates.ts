/**
 * Script para inicializar templates de email
 * Ejecutar: npx tsx scripts/init-email-templates.ts
 */

import { prisma } from "../lib/prisma";

const templates = [
  {
    key: "album_ready",
    name: "Álbum listo",
    subject: "¡Las fotos de {{albumTitle}} ya están disponibles!",
    bodyText: `Hola,

Las fotos del álbum "{{albumTitle}}" ya están disponibles para ver y comprar.

Ver álbum: {{albumUrl}}

Saludos,
ComprameLaFoto`,
    bodyHtml: `<p>Hola,</p>
<p>Las fotos del álbum "<strong>{{albumTitle}}</strong>" ya están disponibles para ver y comprar.</p>
<p><a href="{{albumUrl}}">Ver álbum</a></p>
<p>Saludos,<br>ComprameLaFoto</p>`,
    variables: ["albumTitle", "albumUrl"],
  },
  {
    key: "album_reminder_3weeks",
    name: "Recordatorio 3 semanas",
    subject: "Recordatorio: El álbum {{albumTitle}} se eliminará en {{daysRemaining}} días",
    bodyText: `Hola,

Te recordamos que el álbum "{{albumTitle}}" se eliminará en {{daysRemaining}} días (3 semanas).

No te pierdas la oportunidad de ver y comprar tus fotos:
{{albumUrl}}

Saludos,
ComprameLaFoto`,
    bodyHtml: `<p>Hola,</p>
<p>Te recordamos que el álbum "<strong>{{albumTitle}}</strong>" se eliminará en <strong>{{daysRemaining}} días</strong> (3 semanas).</p>
<p>No te pierdas la oportunidad de ver y comprar tus fotos:</p>
<p><a href="{{albumUrl}}">Ver álbum</a></p>
<p>Saludos,<br>ComprameLaFoto</p>`,
    variables: ["albumTitle", "albumUrl", "daysRemaining"],
  },
  {
    key: "album_reminder_2weeks",
    name: "Recordatorio 2 semanas",
    subject: "Recordatorio: El álbum {{albumTitle}} se eliminará en {{daysRemaining}} días",
    bodyText: `Hola,

Te recordamos que el álbum "{{albumTitle}}" se eliminará en {{daysRemaining}} días (2 semanas).

No te pierdas la oportunidad de ver y comprar tus fotos:
{{albumUrl}}

Saludos,
ComprameLaFoto`,
    bodyHtml: `<p>Hola,</p>
<p>Te recordamos que el álbum "<strong>{{albumTitle}}</strong>" se eliminará en <strong>{{daysRemaining}} días</strong> (2 semanas).</p>
<p>No te pierdas la oportunidad de ver y comprar tus fotos:</p>
<p><a href="{{albumUrl}}">Ver álbum</a></p>
<p>Saludos,<br>ComprameLaFoto</p>`,
    variables: ["albumTitle", "albumUrl", "daysRemaining"],
  },
  {
    key: "album_reminder_1week",
    name: "Recordatorio 1 semana",
    subject: "¡Última semana! El álbum {{albumTitle}} se eliminará en {{daysRemaining}} días",
    bodyText: `Hola,

¡Última semana! El álbum "{{albumTitle}}" se eliminará en {{daysRemaining}} días.

No te pierdas la oportunidad de ver y comprar tus fotos:
{{albumUrl}}

Saludos,
ComprameLaFoto`,
    bodyHtml: `<p>Hola,</p>
<p><strong>¡Última semana!</strong> El álbum "<strong>{{albumTitle}}</strong>" se eliminará en <strong>{{daysRemaining}} días</strong>.</p>
<p>No te pierdas la oportunidad de ver y comprar tus fotos:</p>
<p><a href="{{albumUrl}}">Ver álbum</a></p>
<p>Saludos,<br>ComprameLaFoto</p>`,
    variables: ["albumTitle", "albumUrl", "daysRemaining"],
  },
  {
    key: "album_extension_reminder_15",
    name: "Recordatorio extensión 15 días",
    subject: "¡Tu álbum extendido sigue disponible! Aprovechá antes de que suba el precio",
    bodyText: `Hola,

Se extendió el tiempo de expiración del álbum "{{albumTitle}}" como excepción.

Ya pasaron 15 días desde la extensión y quedan pocos días para comprar al precio habitual.

Recordá: si se cumple el plazo de la extensión, las fotos seguirán disponibles, pero el precio será mayor.

Aprovechá ahora y comprá tus fotos:
{{albumUrl}}

Saludos,
ComprameLaFoto`,
    bodyHtml: `<p>Hola,</p>
<p>Se extendió el tiempo de expiración del álbum "<strong>{{albumTitle}}</strong>" como excepción.</p>
<p><strong>Ya pasaron 15 días desde la extensión</strong> y quedan pocos días para comprar al precio habitual.</p>
<p>Recordá: si se cumple el plazo de la extensión, las fotos seguirán disponibles, pero el precio será mayor.</p>
<p><a href="{{albumUrl}}">Aprovechá ahora y comprá tus fotos</a></p>
<p>Saludos,<br>ComprameLaFoto</p>`,
    variables: ["albumTitle", "albumUrl"],
  },
  {
    key: "album_extension_reminder_29",
    name: "Recordatorio extensión 29 días",
    subject: "Últimos días del álbum extendido: comprá hoy para mantener el precio",
    bodyText: `Hola,

Esta es la recta final del período extendido del álbum "{{albumTitle}}".

Quedan muy pocos días para comprar al precio habitual. Después de esta fecha, las fotos seguirán disponibles, pero el precio será mayor.

No lo dejes para después:
{{albumUrl}}

Saludos,
ComprameLaFoto`,
    bodyHtml: `<p>Hola,</p>
<p><strong>Esta es la recta final</strong> del período extendido del álbum "<strong>{{albumTitle}}</strong>".</p>
<p>Quedan muy pocos días para comprar al precio habitual. Después de esta fecha, las fotos seguirán disponibles, pero el precio será mayor.</p>
<p><a href="{{albumUrl}}">No lo dejes para después</a></p>
<p>Saludos,<br>ComprameLaFoto</p>`,
    variables: ["albumTitle", "albumUrl"],
  },
  {
    key: "order_confirmed",
    name: "Pedido confirmado",
    subject: "Tu pedido #{{orderId}} fue confirmado",
    bodyText: `Hola {{customerName}},

Tu pedido #{{orderId}} fue confirmado exitosamente.

{{photographerInfo}}

{{printInfo}}

Total del pedido: {{total}}
Estado del pago: {{status}}

Ver pedido: {{orderUrl}}

Saludos,
ComprameLaFoto`,
    bodyHtml: `<p>Hola {{customerName}},</p>
<p>Tu pedido <strong>#{{orderId}}</strong> fue confirmado exitosamente.</p>
<p>{{photographerInfo}}</p>
<p>{{printInfo}}</p>
<p><strong>Total del pedido:</strong> {{total}}<br>
<strong>Estado del pago:</strong> {{status}}</p>
<p><a href="{{orderUrl}}" style="display: inline-block; background: #c27b3d; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Ver pedido</a></p>
<p>Saludos,<br>ComprameLaFoto</p>`,
    variables: ["customerName", "orderId", "total", "status", "orderUrl", "photographerInfo", "printInfo"],
  },
  {
    key: "photographer_new_order",
    name: "Nuevo pedido (fotógrafo)",
    subject: "Nuevo pedido #{{orderId}} en tu álbum",
    bodyText: `Hola {{photographerName}},

Tenés un nuevo pedido en tu álbum.

Cliente: {{buyerEmail}}
Total: {{total}}
{{#hasPrintItems}}
Este pedido incluye fotos para imprimir. En tu panel de pedidos podés descargar la carpeta organizada para impresión (por producto, acabado y tamaño) y el link de descargas digitales para el cliente.
{{/hasPrintItems}}
{{^hasPrintItems}}
Podés gestionar las descargas digitales desde tu panel de pedidos.
{{/hasPrintItems}}

Ver todos tus pedidos: {{pedidosUrl}}

Saludos,
ComprameLaFoto`,
    bodyHtml: `<p>Hola {{photographerName}},</p>
<p>Tenés un nuevo pedido en tu álbum.</p>
<p><strong>Cliente:</strong> {{buyerEmail}}<br><strong>Total:</strong> {{total}}</p>
<p><a href="{{pedidosUrl}}" style="display: inline-block; background: #10b981; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Ver pedidos</a></p>
<p>Saludos,<br>ComprameLaFoto</p>`,
    variables: ["photographerName", "orderId", "albumTitle", "buyerEmail", "total", "hasPrintItems", "pedidosUrl"],
  },
  {
    key: "order_ready",
    name: "Pedido listo",
    subject: "¡Tu pedido #{{orderId}} está listo!",
    bodyText: `Hola {{customerName}},

¡Tu pedido #{{orderId}} está listo!

{{pickupInfo}}

Ver pedido: {{orderUrl}}

Saludos,
ComprameLaFoto`,
    bodyHtml: `<p>Hola {{customerName}},</p>
<p><strong>¡Tu pedido #{{orderId}} está listo!</strong></p>
<p>{{pickupInfo}}</p>
<p><a href="{{orderUrl}}">Ver pedido</a></p>
<p>Saludos,<br>ComprameLaFoto</p>`,
    variables: ["customerName", "orderId", "pickupInfo", "orderUrl"],
  },
  {
    key: "digital_download",
    name: "Descarga digital",
    subject: "Descarga tus fotos digitales - Pedido #{{orderId}}",
    bodyText: `Hola {{customerName}},

Tus fotos digitales del pedido #{{orderId}} están listas para descargar.

Descargar: {{downloadUrl}}

Este link estará disponible hasta el {{expiresAt}}.

Saludos,
ComprameLaFoto`,
    bodyHtml: `<p>Hola {{customerName}},</p>
<p>Tus fotos digitales del pedido <strong>#{{orderId}}</strong> están listas para descargar.</p>
<p><a href="{{downloadUrl}}">Descargar fotos</a></p>
<p><small>Este link estará disponible hasta el {{expiresAt}}.</small></p>
<p>Saludos,<br>ComprameLaFoto</p>`,
    variables: [
      "customerName",
      "orderId",
      "downloadUrl",
      "expiresAt",
    ],
  },
  {
    key: "email_verification",
    name: "Verificación de email",
    subject: "Verifica tu email - ComprameLaFoto",
    bodyText: `Hola,

Por favor verifica tu email haciendo clic en el siguiente link:

{{verificationUrl}}

Este link expira en 24 horas.

Saludos,
ComprameLaFoto`,
    bodyHtml: `<p>Hola,</p>
<p>Por favor verifica tu email haciendo clic en el siguiente link:</p>
<p><a href="{{verificationUrl}}">Verificar email</a></p>
<p><small>Este link expira en 24 horas.</small></p>
<p>Saludos,<br>ComprameLaFoto</p>`,
    variables: ["verificationUrl"],
  },
  {
    key: "account_created",
    name: "Cuenta creada",
    subject: "¡Bienvenido a ComprameLaFoto!",
    bodyText: `Hola {{name}},

¡Bienvenido a ComprameLaFoto!

Tu cuenta ha sido creada exitosamente.

Acceder: {{loginUrl}}

Saludos,
ComprameLaFoto`,
    bodyHtml: `<p>Hola {{name}},</p>
<p><strong>¡Bienvenido a ComprameLaFoto!</strong></p>
<p>Tu cuenta ha sido creada exitosamente.</p>
<p><a href="{{loginUrl}}">Acceder a tu cuenta</a></p>
<p>Saludos,<br>ComprameLaFoto</p>`,
    variables: ["name", "loginUrl"],
  },
  {
    key: "lab_recommendation",
    name: "Recomendación a laboratorio",
    subject: "Un fotógrafo te recomendó ComprameLaFoto",
    bodyText: `Hola {{labName}},

Desde ComprameLaFoto te saludamos. {{photographerName}} te recomendó para usar nuestra plataforma.

ComprameLaFoto conecta fotógrafos con laboratorios y clientes: los fotógrafos suben álbumes, los clientes eligen fotos para imprimir o descargar, y los laboratorios reciben pedidos de impresión. Vas a tener disponible una pantalla para que tus clientes suban fotos y te envíen pedidos directamente.

Para darte de alta como laboratorio:
1. Entrá a https://www.compramelafoto.com
2. Registrate y elegí la opción de Laboratorio.
3. Completá el formulario con los datos de tu laboratorio.
4. Una vez aprobada tu cuenta, tendrás disponible una pantalla para que tus clientes suban fotos y te envíen pedidos directamente.

Si querés más información enviános un WhatsApp al 3413748324: https://wa.me/543413748324?text=Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20ComprameLaFoto%20para%20laboratorios.

Saludos,
Equipo de ComprameLaFoto
www.compramelafoto.com`,
    bodyHtml: `<p>Hola <strong>{{labName}}</strong>,</p>
<p>Desde ComprameLaFoto te saludamos. <strong>{{photographerName}}</strong> te recomendó para usar nuestra plataforma.</p>
<p>ComprameLaFoto conecta fotógrafos con laboratorios y clientes: los fotógrafos suben álbumes, los clientes eligen fotos para imprimir o descargar, y los laboratorios reciben pedidos de impresión. <strong>Vas a tener disponible una pantalla para que tus clientes suban fotos y te envíen pedidos directamente.</strong></p>
<p><strong>Para darte de alta como laboratorio:</strong></p>
<ol>
  <li>Entrá a <a href="https://www.compramelafoto.com">www.compramelafoto.com</a></li>
  <li>Registrate y elegí la opción de Laboratorio.</li>
  <li>Completá el formulario con los datos de tu laboratorio.</li>
  <li>Una vez aprobada tu cuenta, tendrás disponible una pantalla para que tus clientes suban fotos y te envíen pedidos directamente.</li>
</ol>
<p>Si querés más información enviános un WhatsApp al <a href="https://wa.me/543413748324?text=Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20ComprameLaFoto%20para%20laboratorios.">3413748324</a>.</p>
<p>Saludos,<br/>Equipo de ComprameLaFoto</p>`,
    variables: ["photographerName", "labName"],
  },
  {
    key: "abandoned_order_reminder",
    name: "Recordatorio pedido abandonado",
    subject: "Tu pedido en ComprameLaFoto está pendiente - Completalo antes de que expire",
    bodyText: `Hola {{buyerName}},

Tu pedido en ComprameLaFoto quedó pendiente de pago.

Recordá que las fotos pueden eliminarse después de un tiempo. Podés completar tu compra desde el siguiente link:

{{resumeLink}}

Saludos,
ComprameLaFoto`,
    bodyHtml: `<p>Hola {{buyerName}},</p>
<p>Tu pedido en ComprameLaFoto quedó <strong>pendiente de pago</strong>.</p>
<p>Recordá que las fotos pueden eliminarse después de un tiempo. Podés completar tu compra desde el siguiente link:</p>
<p><a href="{{resumeLink}}" style="display: inline-block; background: #c27b3d; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Completar compra</a></p>
<p>O copiá este link en tu navegador: {{resumeLink}}</p>
<p>Saludos,<br>ComprameLaFoto</p>`,
    variables: ["buyerName", "resumeLink"],
  },
];

async function main() {
  console.log("Inicializando templates de email...");

  for (const template of templates) {
    const existing = await prisma.emailTemplate.findUnique({
      where: { key: template.key },
    });

    if (existing) {
      console.log(`✓ Template "${template.key}" ya existe, actualizando...`);
      await prisma.emailTemplate.update({
        where: { key: template.key },
        data: {
          name: template.name,
          subject: template.subject,
          bodyText: template.bodyText,
          bodyHtml: template.bodyHtml,
          variables: template.variables,
          isActive: true,
        },
      });
    } else {
      console.log(`✓ Creando template "${template.key}"...`);
      await prisma.emailTemplate.create({
        data: {
          key: template.key,
          name: template.name,
          subject: template.subject,
          bodyText: template.bodyText,
          bodyHtml: template.bodyHtml,
          variables: template.variables,
          isActive: true,
        },
      });
    }
  }

  console.log("✅ Templates inicializados correctamente");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
