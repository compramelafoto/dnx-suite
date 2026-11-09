# Equipo de agentes — pieza 3: agente Vendedor

Diseño del 09/11/2026. Se apoya en la pieza 2, la base «Contactos DNX» y el agente Buscador
(`2026-11-08-agente-buscador-contactos-dnx-design.md`), que ya está en producción llenando la base.

## Por qué

El Buscador junta contactos de todo el país: fotógrafos por nicho, escuelas, clubes, organizadores de
eventos, asociaciones, organizadores de muestras, empresas de turismo y negocios de fotografía. Esa base
no sirve de nada si nadie les escribe.

Daniel quiere que un agente les escriba **caso por caso**, a cada uno sobre **su propio problema**, que
conteste sus dudas y que a él le lleguen solamente los interesados. Así se hace crecer CompraMelaFoto
(CLF) sin pagar publicidad.

### Qué es éxito para Daniel

- Gente que **se hace usuaria de CLF** gracias al correo. Para él, registrarse ya es la señal de interés.
- Saber **cuántas ventas llegaron por mes gracias a esta estrategia**, con números reales de CLF y no
  estimaciones. Daniel lo pidió de forma explícita.
- Que le lleguen por Telegram los interesados, con un resumen corto: quién es, qué preguntó, si se
  registró y si quiere capacitarse.

## Objetivos

1. Escribir un **primer correo personalizado** a cada contacto apto de la base, con un mensaje distinto
   según el tipo de contacto:
   - **Fotógrafos escolares:** cómo hacer más fácil el trabajo de foto escolar, con invitación al curso
     de fotografía escolar.
   - **Otros fotógrafos:** lo mismo, adaptado a su nicho (turismo, deportes, eventos, etc.), con la
     landing que corresponda.
   - **Clubes y organizadores de eventos:** cómo ganar dinero con las fotos de sus eventos sin invertir
     dinero.
   - **Escuelas:** sacarse de encima el trabajo tedioso de contratar un fotógrafo y organizar todas las
     fotos escolares.
   - **Asociaciones, organizadores de muestras, empresas de turismo y negocios de fotografía:** misma
     lógica, cada uno con su ángulo.
2. **Un solo recordatorio** a los que no contestan.
3. **Contestar las dudas por correo** en el mismo hilo (decisión de Daniel: no se abre el bot al público).
4. **Leer las respuestas** y guardarlas en el historial del contacto.
5. **Detectar quién se registró en CLF** gracias al correo.
6. **Medir las ventas por mes** que generaron esos usuarios.
7. Avisar a Daniel por Telegram de los interesados y mandarle un resumen diario.
8. Una **página nueva en CLF para clubes y organizadores de eventos**.

## Fuera de alcance

- WhatsApp, Instagram o Telegram como canal de primer contacto. Daniel ya decidió que con desconocidos
  el primer contacto es por correo, por el riesgo de que suspendan el número.
- Abrir el DNX Bot al público sin cuenta.
- Llamadas o mensajes que manda Daniel por su cuenta. El Vendedor solo le pasa el contacto.
- Que el Buscador busque en Telegram. Lo único posible a futuro es guardar un enlace `t.me/` si aparece
  en una página.
- Ofrecer descuentos, precios especiales o acuerdos. Eso lo decide siempre Daniel.

## Cosas que serían un fracaso aunque «funcionen»

- Que la dirección **compramelafoto.com quede marcada como spam**. Los correos de CLF a compradores
  (comprobantes, descargas) salen del mismo dominio y se perderían.
- Que el Vendedor **invente** algo: una función que CLF no tiene, un precio o una promesa. Todo lo que
  afirma tiene que existir hoy en CLF.
- Que vuelva a escribirle a alguien que pidió la baja, que ya está en `NO_CONTACTAR` o que ya recibió
  la campaña escolar de octubre.
- Que mande más de un recordatorio, o que siga escribiendo después de que la persona contestó.
- Que una respuesta de un cliente quede sin leer y nadie se entere.
- Que el resumen de ventas **cuente de más**: ventas de alguien que ya era usuario antes del correo, o
  ventas sin pagar.
- Que la atribución se mezcle con el **programa de referidos** de CLF y genere comisiones a alguien.
- Que el gasto pase el tope.

## Decisiones de Daniel (09/11)

- Los correos salen **con su nombre** («Daniel Cuart») **desde compramelafoto.com**.
- **Todos los grupos mezclados** desde el principio.
- **Aprobación por grupo:** el Vendedor le manda por Telegram el primer correo de cada grupo como
  modelo. Cuando Daniel lo aprueba, los correos de ese grupo salen solos, adaptados a cada persona.
- Las **dudas las contesta el Vendedor por correo**. Cuando la persona se registra, el DNX Bot la sigue
  ayudando dentro del panel.
- Se hace **una página nueva para clubes y organizadores**.
- **Tope de Claude para el Vendedor: USD 30 por mes**, propio y aparte de los USD 30 del Buscador.
- Quiere **ver cuántas ventas llegaron por mes** con esta estrategia.
- Le pareció bien todo el circuito que se le describió: ritmo, recordatorio, bajas, avisos y resumen.

## Decisiones mías (Claude), que Daniel puede cambiar

- **Ritmo:** 10 correos por día la primera semana y 20 por día desde la segunda, en total y mezclados
  entre grupos. Los recordatorios cuentan dentro de ese número.
- **Horario de envío:** días hábiles de 9 a 18, hora argentina, repartidos a lo largo del día y no
  todos juntos.
- **Recordatorio:** uno solo, a los 5 días hábiles, en el mismo hilo y más corto. Después de eso no se
  le escribe más.
- **Dirección:** `Daniel Cuart <daniel@compramelafoto.com>`, con Reply-To igual a esa misma dirección.
- **Qué contacto es apto para un primer correo:**
  - tiene email;
  - su estado es `NUEVO` o `REVISADO`;
  - no tiene vínculo `USUARIO_CLF`, porque ya es usuario;
  - no tiene vínculo `CONOCIDO_DNX_ESTUDIO`, porque Daniel ya lo conoce y se le escribe a mano;
  - no está en la campaña escolar de octubre;
  - su email no es genérico de un portal.
- **Prioridad dentro de la cola mezclada:** primero los tipos con landing propia (fotógrafos escolares,
  escuelas, clubes y organizadores), y dentro de cada tipo, los contactos con datos más completos.
- **Interesado** quiere decir cualquiera de estas cosas:
  - responde con interés;
  - hace preguntas;
  - pide capacitación;
  - se registra en CLF.
- **Modelo «Claude Sonnet 5.5»** (`claude-sonnet-5-5`), el mismo que usan los otros agentes, a través
  de `lib/agentes/claude.ts`.

## Contexto que ya existe (relevado el 09/11 sobre `origin/main`)

- **Base de contactos (FOTOFFICE):**
  - tablas `DnxContacto`, `DnxContactoDato` y `DnxContactoEvento`;
  - los eventos ya prevén los tipos `CORREO_ENVIADO` y `CORREO_RECIBIDO`;
  - los estados son `NUEVO`, `REVISADO`, `CONTACTADO`, `RESPONDIO`, `SE_SUMO`, `NO_INTERESA`,
    `DESCARTADO` y `NO_CONTACTAR`;
  - el panel de super admin está en `/admin/contactos-dnx`.
- **Telegram de agentes (FOTOFFICE):**
  - envío: `lib/agentes/canal.ts`, con `mandarPropuesta`, `mandarMensaje`, `cambiarBotones` y
    `contestarBoton`;
  - entrada: el webhook `app/api/webhooks/telegram-agentes` → `procesarUpdateAgentes()`. Hoy está
    atado al Periodista, con botones `pe:<letra>:<id>`, la cola `FotofficeAgentePropuesta` y la
    respuesta a un mensaje que llama a `corregirPropuesta`;
  - el Vendedor necesita **su propio prefijo** y su propia rama de despacho.
- **Envío de correo:**
  - CLF usa Resend (`apps/compramelafoto/lib/email.ts` y `lib/email-sender.ts`) y FOTOFFICE tiene su
    propio envío;
  - el dominio `compramelafoto.com` está verificado para **enviar**;
  - para **recibir**, la configuración en Resend falla, porque el registro MX no existe en los DNS:
    hoy **ninguna dirección @compramelafoto.com recibe correo**;
  - no existe código que procese correo entrante;
  - el webhook de estados de Resend (entregado, abierto, clic, rebotado, queja) está en FOTOFFICE:
    `app/api/webhooks/resend/route.ts` y `lib/mailing/webhook-events.ts`.
- **Antecedente directo:** la campaña escolar de octubre.
  - Código: `apps/compramelafoto/scripts/campana-escolar-dnx.ts` y `lib/dnx-escolar/campaign-email.ts`.
  - El 23/10 se mandaron **18 correos a colegios** desde «Daniel Cuart | DNX Estudio»
    <info@compramelafoto.com>, con Reply-To a dnxfotografia@gmail.com.
  - Esos colegios están en la tabla `SchoolOutreachProspect`, de la **base de CLF**, campaña
    `dnx-escolar-2026-10`.
- **Bajas:**
  - FOTOFFICE tiene `lib/mailing/opt-out.ts`, un token de baja y `unsubscribeHeaders()`, que arma la
    baja en un clic con `List-Unsubscribe-Post`;
  - CLF tiene su propia baja, pero solo para usuarios.
- **DNX Bot (CLF):**
  - el conocimiento de CLF está en `apps/compramelafoto/lib/bot/guia/*` (identidad y conocimiento);
  - hoy exige iniciar sesión, por eso no sirve para los prospectos.
- **Landings de CLF:**
  - curso: `/tutoriales/fotografia-escolar`;
  - fotógrafos escolares: `/land/fotografo-escolar`;
  - fotógrafos en general: `/land`;
  - escuelas: `/escuelas` y `/dnx/escolar`;
  - organizadores: `/organizador`;
  - turismo: `/tutoriales/fotografia-de-turismo`;
  - **no hay página para clubes**.
- **Atribución en CLF:**
  - el middleware guarda `?ref=` en la cookie `clf_ref`, y el registro lo convierte en
    `ReferralAttribution`;
  - **eso es el programa de referidos, que genera comisiones**: el Vendedor **no** debe usar `?ref=`;
  - `User` no tiene campos de origen ni utm;
  - existe `lib/usuarios-existentes.ts`, servido en `/api/internal/usuarios/existentes` con secreto
    compartido, que responde si unos emails o teléfonos ya son usuarios de CLF. El Buscador lo usa
    desde `lib/agentes/buscador/clf.ts`.

## Cómo funciona (para Daniel)

1. Cada día hábil, el Vendedor toma de la base unos pocos contactos aptos, mezclados.
2. **Si es el primero de su grupo,** no lo manda: te lo pasa por Telegram como modelo con tres botones,
   **Aprobar**, **Corregir** y **Descartar**. Para corregir, le respondés al mensaje con lo que querés
   cambiar.
3. Cuando aprobaste el modelo de un grupo, los correos de ese grupo salen solos. Cada uno nombra a la
   persona, su ciudad y lo que hace, con el mismo mensaje y el mismo tono que aprobaste.
4. Si no contesta, a los 5 días le llega un recordatorio corto, y nada más.
5. Si contesta:
   - **con una duda**, el Vendedor le responde en el mismo hilo;
   - **con algo delicado** (precio especial, acuerdo, queja) **o algo que no sabe**, no contesta: te lo
     pasa a vos por Telegram con su propuesta de respuesta para que la apruebes o la cambies;
   - **pidiendo que no le escriban más**, queda en «No contactar» para siempre.
6. Si se registra en CLF, te llega el aviso «se sumó». Desde ese momento empiezan a contar sus ventas.
7. Todos los días a las 19 te llega un resumen: cuántos correos salieron, cuántos se abrieron, cuántos
   contestaron, cuántos se registraron y cuánto se gastó.
8. Una vez por mes, el informe de ventas: cuántos se registraron por esta vía, cuántos vendieron y
   cuánto dinero vendieron en CLF, separado por grupo.
9. En el panel «Contactos DNX» ves cada conversación completa en el historial del contacto, y podés
   pausar o reanudar el Vendedor.

## Diseño técnico

### Dónde vive

- El agente: `apps/fotoffice/lib/agentes/vendedor/`.
- El cron: `app/api/cron/agente-vendedor`, con el mismo patrón del Buscador (`isAuthorizedCronRequest`,
  presupuesto de tiempo y `maxDuration`).
- La página de clubes y organizadores y la atribución de registros van en **CLF**, porque es donde
  ocurren.

### Datos (FOTOFFICE, migración nueva a mano y registrada con su sha256)

- **`DnxVendedorModelo`:** el modelo aprobado de cada grupo.
  - Grupo: tipo de contacto, más el nicho cuando es fotógrafo.
  - Estado: `PROPUESTO`, `APROBADO` o `DESCARTADO`.
  - Asunto, cuerpo de ejemplo e indicaciones de tono.
  - Landing a la que lleva.
  - Quién lo aprobó y cuándo.
  - Puede haber un modelo nuevo que reemplace al aprobado. Mientras Daniel no apruebe el nuevo, sigue
    vigente el anterior.
- **`DnxVendedorHilo`:** una conversación por contacto.
  - Datos: contacto, modelo usado, `Message-ID` del primer correo y token de seguimiento.
  - Estado: `PENDIENTE_ENVIO`, `ENVIADO`, `RECORDADO`, `RESPONDIO`, `ESPERA_DANIEL`, `CERRADO` o
    `BAJA`.
  - Fechas de envío, recordatorio, última respuesta y registro en CLF.
  - Usuario de CLF vinculado.
  - Costo de Claude acumulado.
- **Cada correo, de ida o de vuelta,** se guarda como `DnxContactoEvento`, `CORREO_ENVIADO` o
  `CORREO_RECIBIDO`, con asunto, texto, `Message-ID` y el estado de entrega que va llegando del webhook.
  Así queda en el historial que ya muestra el panel.
- **Ajustes** en `SystemSettings` `fotoffice_vendedor_ajustes`, con el mismo patrón que
  `fotoffice_buscador_ajustes`:
  - pausado: **arranca en `true`**;
  - tope de Claude: USD 30;
  - correos por día;
  - fecha de arranque, para calcular la primera semana de rampa.
- **Tipos de evento nuevos** en el CHECK de `DnxContactoEvento`, si hacen falta (por ejemplo `BAJA` o
  `REGISTRO_CLF`). A criterio del que construye: puede reutilizar `ESTADO` y `VINCULADO`.

### Envío

- Por Resend, con remitente `Daniel Cuart <daniel@compramelafoto.com>` y Reply-To igual.
- Clave de idempotencia por hilo y por paso (primero o recordatorio), para que un reintento no duplique.
- **Texto simple, sin imágenes ni diseño de boletín.** Debe parecer un correo escrito por una persona.
  Al pie, el nombre de Daniel, CLF y una línea de baja.
- **Baja en un clic:** cabeceras `List-Unsubscribe` y `List-Unsubscribe-Post`, con un enlace propio
  del Vendedor que pasa el contacto a `NO_CONTACTAR`. Se puede reutilizar el token de
  `lib/mailing/opt-out.ts` si encaja.
- **Enlaces:** cada uno lleva el token de seguimiento del hilo en un parámetro **propio**, por ejemplo
  `?dnxv=<token>`, **nunca `?ref=`**.
- **Antes de cada envío se vuelve a chequear que el contacto siga apto.** Un contacto pudo pasar a
  `NO_CONTACTAR` o registrarse entre que se armó la cola y el envío.
- Un rebote o una queja que llega del webhook de Resend:
  - **queja (spam):** el contacto pasa a `NO_CONTACTAR`;
  - **rebote:** se cierra el hilo y se marca el email como inválido.
- **Freno por salud de la dirección:** si en los últimos 50 envíos los rebotes pasan el 5 % o hay
  alguna queja, el Vendedor **se pausa solo** y avisa a Daniel. Estos números son mi decisión.

### Recepción de respuestas

- **Requiere un cambio de DNS que hace Daniel, guiado:** el registro MX de `compramelafoto.com` →
  `inbound-smtp.sa-east-1.amazonaws.com`, el que Resend ya pide. Hoy no hay ningún MX, así que no se
  rompe nada existente.
- Webhook de Resend `email.received`, verificado con firma Svix como el de estados, hacia un endpoint
  nuevo de FOTOFFICE.
- **Emparejamiento con el hilo:** primero por `In-Reply-To` y `References`, después por el email del
  remitente. Si no empareja con ningún hilo, no se pierde: se reenvía a dnxfotografia@gmail.com y se
  avisa a Daniel. Eso cubre también los correos que lleguen a info@, noreply@ o cualquier otra
  dirección @compramelafoto.com.
- **Se descartan:**
  - las respuestas automáticas («fuera de la oficina»): no cierran el hilo, pero cancelan el
    recordatorio;
  - los rebotes que lleguen como correo.
- **Claude clasifica cada respuesta** en una de estas opciones:
  - interesado o duda;
  - pide capacitación;
  - no le interesa;
  - baja;
  - delicada o no sabe;
  - automática.
- **Según la clasificación:**
  - **interesado o duda:** responde el Vendedor, con como máximo 3 respuestas automáticas por hilo;
    desde la cuarta, se la pasa a Daniel;
  - **pide capacitación:** responde con el enlace al curso o a la charla que corresponda y avisa a
    Daniel;
  - **no le interesa:** contesta una vez agradeciendo, `NO_INTERESA`, se cierra el hilo;
  - **baja:** `NO_CONTACTAR`, sin respuesta;
  - **delicada o no sabe:** `ESPERA_DANIEL`, y por Telegram le llega el mensaje con una propuesta de
    respuesta y los botones Enviar, Corregir y Lo contesto yo.

### Lo que sabe el Vendedor

- Lo que hoy sabe el DNX Bot sobre CLF (`apps/compramelafoto/lib/bot/guia/*`) es la **única fuente**
  de lo que puede afirmar.
  - Se lleva a un paquete compartido, o se genera un texto que comparten los dos.
  - No debe haber dos copias escritas a mano que se separen con el tiempo.
  - Cómo hacerlo queda a criterio del que construye.
- **Instrucción explícita:** si algo no está en esa fuente, no lo afirma y pasa a «delicada o no sabe».
- **Datos del contacto:** solo los guardados en la base (nombre, ciudad, tipo, nicho, web). No busca en
  internet al escribir.

### Atribución de registros (CLF)

- **Middleware de CLF:** si la URL trae `?dnxv=`, lo guarda en una cookie propia (`clf_dnxv`, por 60
  días). No toca `clf_ref`.
- **Registro** de fotógrafo, de organizador y con Google: si existe esa cookie, se guarda en una tabla
  nueva de CLF, `DnxVendedorAtribucion`, con userId, token, fecha y rol. Nada de comisiones.
- **Respaldo por email:** el Vendedor consulta `usuarios-existentes` con los emails y teléfonos de los
  contactos a los que les escribió. Si alguien aparece como usuario, se cuenta como registro por el
  Vendedor solo si **la cuenta se creó después del primer correo**. Esto exige que el endpoint devuelva
  también la fecha de alta.
- El endpoint interno nuevo de CLF (siguiente sección) devuelve las atribuciones, y FOTOFFICE marca el
  hilo y pasa el contacto a `SE_SUMO`.

### Ventas por mes (lo que pidió Daniel)

- **Endpoint interno nuevo en CLF,** con el mismo secreto compartido `CLF_CONSULTA_USUARIOS_SECRET`.
  - Recibe un mes.
  - Devuelve, por usuario atribuido (por cookie o por email), la cantidad de ventas pagadas y el total
    en pesos de ese mes.
  - En CLF, `totalCents` ya está en pesos.
- **Qué es «venta»:** un pedido **pagado** de un álbum del fotógrafo atribuido. Para organizadores,
  clubes y escuelas, los pedidos pagados de los eventos o álbumes donde son organizadores.
  - Se excluyen los pedidos reembolsados o cancelados.
  - Solo cuentan los pedidos posteriores al registro atribuido.
  - La consulta exacta, viendo los modelos de pedidos de CLF, queda a criterio del que construye, con
    estas reglas como obligatorias.
- **Informe mensual** el día 1 a las 9, por Telegram, sobre el mes anterior y separado por grupo:
  - correos enviados;
  - personas que respondieron;
  - registros;
  - usuarios que vendieron;
  - cantidad de ventas;
  - total en pesos;
  - gasto del Vendedor en dólares.
- El mismo informe se muestra en el panel, con la opción de ver meses anteriores.

### Telegram

- Prefijo propio para los botones (por ejemplo `ve:`) y su rama en `procesarUpdateAgentes()`, sin
  romper la del Periodista.
- **Mensajes:**
  - el modelo de cada grupo para aprobar;
  - las respuestas que esperan a Daniel;
  - el aviso de cada interesado;
  - el resumen diario a las 19, solo los días con actividad;
  - el informe mensual;
  - el aviso de pausa por tope o por salud de la dirección.
- **Corregir** funciona como en el Periodista: Daniel responde al mensaje y el Vendedor rehace el
  modelo o la respuesta con esa indicación.

### Gasto

- Cada llamada a Claude registra su costo en el hilo o en el modelo.
- Con el gasto del mes llegando a USD 30, se pausa y avisa.
- Prompt de sistema con caché, porque se repite en cada correo.
- Estimación: USD 8 a 12 por mes con 20 correos por día.

### Página para clubes y organizadores (CLF)

- **Ruta nueva**, por ejemplo `/clubes`, a criterio del que construye, que sirva para clubes y para
  organizadores de eventos.
- **Mensaje:** cómo ganar dinero con las fotos de sus eventos **sin invertir dinero**.
- Tiene que apoyarse **solo en funciones que CLF ya tiene**: comisión del organizador, fotógrafos
  oficiales, venta de fotos en el álbum y reconocimiento facial.
- Lleva al registro de organizador.
- **Daniel aprueba el texto antes de publicarla.**
- Mientras no esté publicada, el modelo de los clubes no se puede aprobar.

### Panel «Contactos DNX»

- **Sección Vendedor:**
  - pausar y reanudar;
  - correr ahora;
  - gasto del mes;
  - modelos por grupo y su estado;
  - cola del día;
  - el informe mensual.
- **En la ficha del contacto:** la conversación completa, el estado del hilo y si se registró.

### Datos personales y ley

- Solo se escribe a direcciones **comerciales y publicadas**, que es lo que ya guarda el Buscador.
- Cada correo identifica quién escribe y por qué, y ofrece la baja de forma clara y gratuita.
- `NO_CONTACTAR` es permanente y se respeta aunque el contacto vuelva a aparecer.

### Pruebas

- **Emparejamiento de respuestas:** por cabeceras, por remitente y sin emparejar.
- **Clasificación de respuestas:** cada rama, con textos de prueba y Claude simulado.
- **Contacto apto:**
  - cada exclusión, incluida la de la campaña escolar;
  - un `NO_CONTACTAR` que aparece entre la cola y el envío.
- **Recordatorio:**
  - sale uno solo;
  - no sale si contestó, si la respuesta fue automática o si se registró.
- **Rampa y tope por día;** freno por rebotes o quejas.
- **Atribución:**
  - con cookie;
  - por email con fecha de alta posterior;
  - por email con fecha anterior, que no se cuenta;
  - el `?ref=` sigue intacto.
- **Ventas por mes:**
  - cuenta solo los pedidos pagados posteriores al registro;
  - excluye los reembolsos.
- **Telegram:** los botones `ve:` no tocan las propuestas del Periodista.

## Puesta en marcha

1. Daniel agrega el MX de recepción en los DNS de compramelafoto.com, guiado, y se confirma en Resend
   que pasa a verificado.
2. Se configura en Resend el webhook `email.received` hacia FOTOFFICE.
3. Se despliegan FOTOFFICE y CLF, con el Vendedor en pausa.
4. Prueba de punta a punta con una dirección de Daniel cargada como contacto: envío, respuesta,
   clasificación, registro con el enlace y su aparición en el informe.
5. Daniel publica la página de clubes, después de aprobar el texto.
6. Daniel reanuda el Vendedor desde el panel y aprueba los modelos a medida que van llegando.

## Aclaraciones después de la revisión (decisiones mías, Claude)

- **Grupos finitos:**
  - un grupo es el `tipo` del contacto y, solo para `FOTOGRAFO`, su nicho principal tomado de la
    lista cerrada de nichos del Buscador (`lib/agentes/buscador/tipos.ts`);
  - un fotógrafo sin nicho o con nicho fuera de la lista va al grupo «fotógrafo general»;
  - nunca puede haber más grupos que tipos más nichos de esa lista.
- **Grupo sin modelo aprobado:**
  - sus contactos **se saltean** y no consumen el cupo del día;
  - hay un solo modelo propuesto por grupo a la vez;
  - si Daniel no lo contesta en 48 horas, el resumen diario se lo recuerda. No hay vencimiento.
- **Solo aprueba Daniel,** que es el chat ya vinculado al canal de agentes.
- **Prioridad dentro del cupo diario:** primero las respuestas, después los recordatorios, después los
  primeros correos. Las respuestas a dudas no cuentan dentro del cupo.
- **Días hábiles:** lunes a viernes, sin los feriados nacionales de Argentina. Si no hay un ayudante
  de feriados en el repo, va una lista fija por año en el código.
- **Email genérico de portal:** se usa la misma regla del Buscador (`normalizar.ts`, `claveEmail`
  nulo). Un contacto sin `claveEmail` no es apto.
- **Bajas de CLF:** antes de escribir, también se excluye a quien figure en CLF con `unsubscribedAt`.
  - El endpoint interno de CLF devuelve ese dato junto con la consulta de usuarios existentes.
  - La baja en cualquiera de los dos sistemas bloquea el envío.
- **Atribución:**
  - El cruce por email **o teléfono** es un respaldo.
  - Se acepta que cuente de menos: alguien que se registra con otro email y desde otro navegador no
    se cuenta.
  - El informe lo aclara con una línea: «mínimo comprobado».
  - El Vendedor **consulta** a CLF una vez por día. CLF no empuja avisos.
- **Ventas de organizadores, clubes y escuelas:** si el que construye comprueba que en el esquema de
  CLF no hay una relación clara entre el organizador y los pedidos pagados, el informe muestra para
  esos grupos solo los registros y cuántos crearon eventos, y lo dice. No inventa la cifra.
- **Recepción por Resend:**
  - el webhook trae el id del correo, y el cuerpo y las cabeceras se piden a la API de correos
    recibidos de Resend;
  - si no llegan `In-Reply-To` ni `References`, se empareja por remitente;
  - hoy `compramelafoto.com` no tiene MX, así que no hay correo existente que se rompa;
  - **si el MX no se pudiera agregar,** el Vendedor no se enciende: sin respuestas leídas, el circuito
    no cumple su objetivo.
- **Qué puede decir de la guía del bot:**
  - todo lo que la guía dice de CLF, incluidos los precios y comisiones públicos;
  - nunca descuentos, condiciones especiales ni plazos que la guía no tenga.
- **Gasto:** se usa el costo real por llamada que ya registra `lib/agentes/claude.ts` para el Buscador,
  a partir del uso de tokens que devuelve la API.

## Lo que queda a criterio del que construye

- Cómo compartir el conocimiento del DNX Bot sin duplicarlo.
- Los nombres exactos de las tablas, las rutas y los tipos de evento nuevos, respetando las reglas de
  arriba.
- Cómo marcar a los 18 colegios de la campaña de octubre. Puede ser una importación única desde
  `SchoolOutreachProspect` hacia la base de contactos, o una consulta a CLF. Lo obligatorio es que no
  reciban de nuevo.
- La consulta exacta de ventas en CLF, con las reglas de la sección «Ventas por mes».
- El diseño visual de la página de clubes, que sigue el estilo de las landings de CLF.
