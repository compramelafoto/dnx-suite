import { FAQ_CATEGORIES } from "@/components/faq-data";

/*
 * Conocimiento fijo de CLF para DNX Bot. Cada afirmación sale del código o de los textos legales:
 * - Requisitos de venta: lib/albums/album-sales-readiness.ts, app/api/dashboard/albums/route.ts,
 *   app/api/dashboard/albums/[id]/route.ts y app/api/dashboard/albums/[id]/photos/route.ts.
 * - Vencimiento: lib/album-cleanup/config.ts (30 / 45 días), lib/album-cleanup/eligibility.ts,
 *   lib/album-extensions/request-album-extension.ts, lib/pricing/album-extension-surcharge.ts,
 *   lib/cron/send-album-notifications.ts (avisos a 3, 2 y 1 semana).
 * - Descuentos: lib/pricing/digital-bulk-discount.ts. Packs: modelo AlbumPack.
 * - Selfies: lib/legal/biometric-consent-content.ts, lib/legal/retention-policy-content.ts,
 *   components/dashboard/albums/AlbumConfigurationSection.tsx.
 * - Mercado Pago: app/ayuda/mercadopago/seguridad/page.tsx. Términos: lib/terms/photographerTerms.ts.
 * Texto fijo: sin fechas ni montos que cambien por configuración (va en el prompt cacheado).
 */

const FAQ = FAQ_CATEGORIES.map(
  (c) => `## ${c.title}\n` + c.items.map((i) => `- P: ${i.q}\n  R: ${i.a}`).join("\n"),
).join("\n\n");

export const CONOCIMIENTO_CLF = `# Cómo funciona CLF

Lo que sigue es cómo funciona la plataforma. Si algo de las preguntas frecuentes del final no coincide con estas secciones, valen estas secciones. Si no sabés algo, decí que no lo sabés y ofrecé un pedido de soporte; no lo inventes.

## Para vender hace falta
1. Cuenta de Mercado Pago conectada. Sin eso no se pueden crear álbumes ("Debés vincular tu cuenta de Mercado Pago para crear álbumes") ni subir fotos ("Debés conectar Mercado Pago para subir fotos"). Se conecta desde Configuración del panel. Si la conexión venció, hay que volver a conectarla desde el mismo botón de Mercado Pago: mientras tanto no se puede cobrar.
2. Un álbum con al menos un producto activo: fotos digitales, impresas o las dos.
3. Si vende digitales: precio de la foto digital cargado en el álbum. No puede ser menor al mínimo que fija la plataforma; si lo intenta, el panel le muestra el mínimo. En los álbumes que son parte de un evento donde el organizador fija el precio digital, el fotógrafo no puede cambiar ese precio ni crear packs digitales: manda el precio del evento. Las impresiones sí las sigue manejando el fotógrafo.
4. Términos y condiciones aceptados en el álbum. Se aceptan por álbum, al crearlo.
5. Si vende impresas: productos cargados en la lista de precios ("Para habilitar impresas, primero cargá productos en tu lista de precios."), el margen de ganancia cargado y, si trabaja con un laboratorio, el laboratorio elegido y quién retira las copias (el cliente o el fotógrafo).
Cuando falta algo, el comprador ve "Las fotos ya están disponibles, pero la venta todavía no fue habilitada por el fotógrafo." En el panel, el álbum figura como "Venta pendiente de configurar" o "Venta incompleta" y dice qué falta: "Activar al menos un producto (digital o impresiones)", "Configurar precio digital", "Aceptar términos y condiciones" o "Configurar impresiones". Cuando está todo, figura "Venta activa".

## Vencimiento de álbumes
El plazo arranca con la primera foto subida al álbum. Los compradores lo ven durante 30 días; después se oculta. Las fotos quedan guardadas hasta los 45 días; después se eliminan automáticamente y dejan de estar disponibles para la venta. Se puede extender: el fotógrafo, o un comprador desde el link de un álbum ya oculto, puede pedir la extensión, y se suman días a los dos plazos. Mientras corre el tiempo extendido, las compras pueden tener un recargo.
A las personas que se anotaron para recibir avisos de un álbum les llegan recordatorios por mail cuando faltan 3 semanas, 2 semanas y 1 semana para que se elimine.

## Descuentos por cantidad
En las fotos digitales se puede poner un porcentaje de descuento a partir de 5, de 10 y de 20 fotos. Se aplica el escalón más alto que alcance la compra. Un escalón sin porcentaje no hace nada.

## Búsqueda por selfie y fotos ocultas
- El comprador puede buscar sus fotos con una selfie, si acepta el consentimiento biométrico. Esa selfie se guarda como máximo 90 días o hasta que termina el álbum, lo que pase primero. La búsqueda no garantiza encontrar todas las fotos de una persona.
- Si el fotógrafo activa "fotos ocultas" en la configuración del álbum, los visitantes sólo ven sus fotos después de verificarse con una selfie. El fotógrafo elige cuántos días se guardan esas selfies (0 = no se guardan).
- También se puede ofrecer un pack especial con todas las fotos donde aparece el comprador, a un precio fijo que carga el fotógrafo.

## Packs
Combos con precio fijo dentro de un álbum (por ejemplo, una cantidad de fotos digitales, impresiones o carpeta escolar). Si el pack pide elegir fotos, se indica cuántas fotos incluye y el comprador las elige.

## Pedidos y descargas
Cuando un pedido de fotos digitales se paga, el comprador recibe por mail el link de descarga. Si no le llegó: que revise spam y promociones. Desde Pedidos, el fotógrafo puede sacar el link de descarga de un pedido pagado y pasárselo. Si el comprador se equivocó de mail, eso lo resuelve soporte con el comprobante de pago.

## Subidas
Si algunas fotos no se pudieron subir, el panel lo avisa y ofrece reintentar sólo esas. El logo de una escuela no puede superar 5 MB.

## Plata y Mercado Pago
- Registrarse y crear álbumes no tiene costo. CLF cobra una comisión sólo cuando hay una venta.
- La conexión con Mercado Pago se autoriza en la pantalla oficial de Mercado Pago: CLF nunca ve la clave. El permiso sirve para generar cobros de las ventas hechas en CLF; no sirve para mover el saldo de la cuenta. Se puede revocar desde la cuenta de Mercado Pago, y sin conexión no se puede vender.
- Según los términos, los fondos pueden acreditarse primero en la cuenta de la plataforma y después transferirse al fotógrafo; los tiempos dependen de Mercado Pago. Una consulta sobre una plata puntual es un tema de plata: ofrecé un pedido de soporte.

## Derechos y remociones
- Las fotos siguen siendo del fotógrafo: subirlas no cede derechos a CLF, al laboratorio ni a nadie. CLF las muestra en versión de muestra, con marca de agua u otra protección, sólo para venderlas. Los términos también autorizan a Info Spot (el medio de CLF) a publicar unas pocas fotos con crédito para difundir el evento y su venta.
- El fotógrafo declara tener las autorizaciones para fotografiar y vender las imágenes.
- Cualquier persona puede pedir que se quite una foto. El pedido le llega al fotógrafo en su panel, que lo aprueba o lo rechaza; si lo aprueba, la foto deja de verse y de venderse. Vos no podés aprobarlo: explicá dónde hacerlo.

## Preguntas frecuentes
${FAQ}`;
