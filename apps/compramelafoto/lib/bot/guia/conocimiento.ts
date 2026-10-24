import { FAQ_CATEGORIES } from "@/components/faq-data";
import { seccionPantallasDelPanel } from "../rutas-panel";

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
 * - Venta escolar: lib/bot/escolar/progreso.ts (los 11 pasos y sus títulos), app/canje/preventa/[token],
 *   lib/school-roster/student-identification-mode-ui.ts (modos de identificación),
 *   lib/school-organizer-commission.ts (comisión de la escuela: sólo se registra),
 *   app/api/fotografo/escuelas/pedidos/[orderId]/labels y app/escolar/entrega/[token] (entrega con QR),
 *   docs/compramelafoto/AUDITORIA-VENTA-ESCOLAR.md. El porcentaje del recargo a la familia vive en la
 *   base (con excepciones por fotógrafo), así que acá no va ningún número.
 * Texto fijo: sin fechas ni montos que cambien por configuración (va en el prompt cacheado).
 */

const VENTA_ESCOLAR = `## Venta escolar
Cómo funciona en CLF:
- Preventa: el fotógrafo arma packs (por ejemplo, una carpeta impresa más el digital) y las familias los pagan por Mercado Pago antes de la toma o antes de que se suban las fotos. Cada familia recibe su comprobante y el fotógrafo cobra su precio completo; CLF suma un recargo que paga la familia encima de ese precio.
- Canje: cuando las fotos están subidas, cada familia entra con su link personal (/canje/preventa/…), elige las fotos que le corresponden según el pack que pagó y canjea. Si el álbum vende fotos sueltas, después puede comprar más fotos desde la galería del álbum (botón «Comprar más fotos»), pagándolas por Mercado Pago.
- Cursos: la escuela tiene sus cursos cargados; la familia indica el curso al comprar y cada pedido queda con su curso.
- Identificación del alumno, en palabras simples: sin identificación (la familia no dice de qué alumno es), carga manual (la familia escribe el nombre del alumno), lista opcional (la familia puede elegir al alumno de la lista del curso) o lista obligatoria (tiene que elegirlo de la lista). Para las dos con lista hay que cargar la lista de alumnos.
- Plantillas: los productos impresos, como las carpetas, pueden llevar una plantilla de diseño con el nombre, el curso y la escuela.
- Comisión de la escuela: si el fotógrafo arregló una comisión con la escuela, el sistema la deja anotada en cada venta para que la tenga clara. La paga el fotógrafo directamente a la escuela; CLF no la cobra ni la paga.
- Entrega: hay etiquetas con QR para cada sobre y una ficha para seguir qué pedido se entregó.
- Si el fotógrafo no hace fotografía escolar (la situación de la cuenta lo dice), cuando termines de resolver su consulta ofrecele en una línea aprender a vender fotografía escolar. Una sola vez por conversación; si dice que no, no insistas. En la situación aparece como «Fotografía escolar: nunca la usó».
- El diseño automático con las plantillas y la entrega con QR son nuevos: todavía no hay colegios que los hayan usado de punta a punta. Ofrecelos como parte del sistema escolar; aclará que son nuevos y que lo acompañamos en el primer uso ("está recién estrenado; te acompañamos"). La opción segura es que el fotógrafo descargue las fotos elegidas y diseñe e imprima como siempre.

Los 11 pasos del armado, en orden (los opcionales no frenan la venta):
1. Crear la escuela
2. Cargar cursos o alumnos
3. Invitar a alguien de la escuela (opcional)
4. Crear el álbum escolar vinculado a la escuela
5. Definir cómo se identifica a cada alumno
6. Armar los packs de preventa
7. Elegir las plantillas de los productos impresos
8. Configurar la comisión para la escuela (opcional)
9. Publicar la preventa para las familias
10. Subir las fotos y avisar a las familias (el aviso no sale solo: el fotógrafo tiene que mandarlo)
11. Entregar los pedidos
Un álbum marcado como escolar pero sin escuela vinculada queda a medias: el paso 4 no está hecho.

Por qué conviene frente al sobre con plata:
- La plata no pasa por las maestras: cada familia paga por Mercado Pago, con comprobante, y queda anotado pedido por pedido.
- No hace falta imprimir antes de cobrar: se imprime lo que ya se pagó.
- Cada familia elige sus fotos y puede comprar más, cosa que con el sobre casi no pasa.
- Menos errores de nombres y cursos que con listas en papel y sobres escritos a mano.
- Privacidad de las imágenes de los chicos: cada familia ve sólo lo suyo, en vez de pruebas de todo el curso circulando en papel o por grupos.

Respuestas cortas a dudas frecuentes:
- "Las familias no tienen tarjeta": el pago es por Mercado Pago, que ofrece otros medios además de la tarjeta; no prometas un medio en particular.
- "El colegio prefiere efectivo": contale que con la preventa la plata no pasa por el colegio ni por las maestras y queda registrada con comprobante, y que cada familia elige sus fotos desde el celular. No ofrezcas cargar pagos hechos por fuera.
- "Me van a copiar las fotos": cada familia entra con su link y ve sólo lo suyo, las muestras se ven con protección y se pueden activar las "fotos ocultas" del álbum. Un consejo: incluir el digital en el pack, así no hay nada que copiar.
- "La comisión": el fotógrafo cobra su precio completo; el recargo de CLF lo paga la familia encima. La comisión de la escuela la arregla y la paga el fotógrafo; el sistema sólo la anota.
- "El colegio ya cobró por fuera": es un caso especial para fotógrafos que se sumaron con el proceso empezado. Nunca lo ofrezcas vos. Si el fotógrafo dice que ya cobró, explicale que es un caso especial que arma el equipo y abrí un pedido de soporte con abrir_ticket (motivo OTHER).
- Si preguntan por algo escolar que no está en esta sección, no lo prometas: decí que no lo sabés y ofrecé un pedido de soporte.`;

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
A las personas que se anotaron para recibir avisos de un álbum les llegan recordatorios por mail a los 9, 16 y 23 días contados desde que se creó el álbum (3, 2 y 1 semana antes del día 30 desde la creación). Esos avisos no tienen en cuenta cuándo se subió la primera foto ni las extensiones. Si la situación de la cuenta muestra otras fechas, valen esas.

## Descuentos por cantidad
En las fotos digitales se puede poner un porcentaje de descuento a partir de 5, de 10 y de 20 fotos. Se aplica el escalón más alto que alcance la compra. Un escalón sin porcentaje no hace nada.

## Búsqueda por selfie y fotos ocultas
- El comprador puede buscar sus fotos con una selfie, si acepta el consentimiento biométrico. Esa selfie se guarda como máximo 90 días o hasta que termina el álbum, lo que pase primero. La búsqueda no garantiza encontrar todas las fotos de una persona.
- Si el fotógrafo activa "fotos ocultas" en la configuración del álbum, los visitantes sólo ven sus fotos después de verificarse con una selfie. El fotógrafo elige cuántos días se guardan esas selfies (0 = no se guardan).
- También se puede ofrecer un pack especial con todas las fotos donde aparece el comprador, a un precio fijo que carga el fotógrafo.

## Packs
Combos con precio fijo dentro de un álbum (por ejemplo, una cantidad de fotos digitales, impresiones o carpeta escolar). Si el pack pide elegir fotos, se indica cuántas fotos incluye y el comprador las elige.

## Pedidos y descargas
Cuando un pedido de fotos digitales se paga, el comprador recibe por mail el link de descarga. Si no le llegó: que revise spam y promociones. El fotógrafo puede pedirle a DNX Bot que le reenvíe el mail con el link al comprador (sólo pedidos pagados; si el link venció, se genera uno nuevo). Desde el panel, en Pedidos, también puede copiar el link de descarga de un pedido pagado y pasárselo. Si el comprador se equivocó de mail, eso lo resuelve soporte con el comprobante de pago.

## Subidas
Si algunas fotos no se pudieron subir, el panel lo avisa y ofrece reintentar sólo esas. El logo de una escuela no puede superar 5 MB.

## Plata y Mercado Pago
- Registrarse y crear álbumes no tiene costo. CLF cobra una comisión sólo cuando hay una venta.
- La conexión con Mercado Pago se autoriza en la pantalla oficial de Mercado Pago: CLF nunca ve la clave. El permiso sirve para generar cobros de las ventas hechas en CLF; no sirve para mover el saldo de la cuenta. Se puede revocar desde la cuenta de Mercado Pago, y sin conexión no se puede vender.
- Según los términos, los fondos pueden acreditarse primero en la cuenta de la plataforma y después transferirse al fotógrafo; los tiempos dependen de Mercado Pago. Una consulta sobre una plata puntual es un tema de plata: ofrecé un pedido de soporte.

## Cam Of Duty
Cam Of Duty (camofduty.com) es el simulador fotográfico de DNX: una cámara virtual en una ciudad 3D y un Estudio Fotográfico con luces de estudio en 3D. Es gratis, pero para entrar hace falta una cuenta de fotógrafo de CLF: la misma con la que se usa CLF (email y contraseña, o Google). Al registrarse desde Cam Of Duty se piden nombre y apellido, WhatsApp, Instagram (opcional), empresa o estudio y ciudad, y se valida el email con un código de 6 números que llega por correo (vence en 15 minutos; se puede pedir otro). También se puede marcar si quiere enterarse de trabajos como fotógrafo cerca de su ciudad. Si ya tenía cuenta de CLF, entra con ella y completa los datos que falten. Las cuentas de cliente no sirven para Cam Of Duty. Al abrir el simulador o el estudio aparece el logo con una barra de carga: el simulador arranca recién cuando todo cargó al 100 % (la primera vez puede tardar unos segundos; después queda guardado en el navegador). En la ciudad, además de gente caminando y autos, andan bicicletas, monopatines eléctricos y motos con su conductor, y corredores con ropa deportiva en las vueltas largas: sirven para practicar barridos, congelar movimiento o larga exposición. Los charcos reflejan de verdad lo que tienen alrededor (edificios, árboles, autos y gente que pasa): agachándose cerca de uno (tecla K) se puede componer con reflejos. En la pestaña Luz natural se elige la hora (de amanecer a noche) y el clima: soleado, nublado (luz suave, unos 3 pasos menos que el sol pleno) o lluvia (unos 4 pasos menos, piso mojado y gotas que con tiempos de exposición largos se ven como rayas). En el inicio de Cam Of Duty hay una Pregunta del día de fotografía (200 preguntas técnicas que van rotando), con la respuesta correcta y una explicación al responder.

## Derechos y remociones
- Las fotos siguen siendo del fotógrafo: subirlas no cede derechos a CLF, al laboratorio ni a nadie. CLF las muestra en versión de muestra, con marca de agua u otra protección, sólo para venderlas. Los términos también autorizan a Info Spot (el medio de CLF) a publicar unas pocas fotos con crédito para difundir el evento y su venta.
- El fotógrafo declara tener las autorizaciones para fotografiar y vender las imágenes.
- Cualquier persona puede pedir que se quite una foto. El pedido le llega al fotógrafo en su panel, que lo aprueba o lo rechaza; si lo aprueba, la foto deja de verse y de venderse. Vos no podés aprobarlo: explicá dónde hacerlo.

${seccionPantallasDelPanel()}

${VENTA_ESCOLAR}

## Preguntas frecuentes
${FAQ}`;
