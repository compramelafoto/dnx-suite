# De dónde salen los correos de FotoOffice

**Decisión tomada el 2026-09-17.** La pregunta fue: *¿no conviene que cada usuario
conecte su cuenta de Gmail al workspace, por API o SMTP, para no consumir recursos de
Resend?*

**Respuesta: no para los correos automáticos.** Sí, con límites, para otros dos usos que
están al final.

---

## Los números, primero

Al 2026-09-17, medidos sobre la base de FotoOffice:

| | |
|---|---|
| Correos enviados en toda la historia | **2** |
| En cola | 2 |
| Socios | 271 |
| Socios con email cargado | 224 |

El ahorro sería sobre **un gasto que todavía no existe**.

Y cuando exista, el orden de magnitud es chico. 224 socios recibiendo cuota, carnet,
reservas y algún aviso dan unos **1.000 correos por mes**. Diez instituciones como SFPR,
unos 10.000. Eso entra en el escalón pago más barato de Resend: decenas de dólares al año,
no cientos. *(Verificar el precio vigente antes de citarlo.)*

**Optimizar esto hoy es resolver un problema que no tenemos, y pagarlo con complejidad que
sí vamos a tener.**

---

## Por qué Gmail no sirve para los automáticos

### El permiso no te lo dan así nomás

`gmail.send` es un **restricted scope** de Google: exige una auditoría de seguridad para
usarlo en producción. Cuesta dinero y lleva meses. Es el mismo tipo de trámite
administrativo que ya frenó la homologación de Mercado Pago.

### La alternativa es peor

SMTP con **contraseña de aplicación** necesita que cada usuario tenga verificación en dos
pasos activada y genere una contraseña especial. Para la secretaria de un club eso es una
llamada de soporte por cada alta. Y Google viene cerrando ese camino desde hace años.

### El límite diario corta justo cuando importa

Gmail gratuito: **500 destinatarios por día**. Workspace: 2.000.

SFPR mandando a sus 224 socios entra una vez. Una tanda más un recordatorio más una
campaña el mismo día, no. Y cuando se pasa, Gmail bloquea 24 horas **sin decir por qué**.

### La entrega empeora, no mejora

224 correos iguales saliendo de un Gmail personal por SMTP es exactamente el patrón que
los filtros de spam están hechos para detectar. Un proveedor de correo existe para eso:
reputación de IP, firmas SPF/DKIM/DMARC, manejo de rebotes y lista de suprimidos.

### Se pierde el registro central

Hoy se puede preguntar *"¿salió el aviso de la cuota de septiembre?"*. Con cada usuario
mandando por su cuenta, cada uno falla distinto y nadie ve nada.

Para avisos de **dinero** —cuotas, vencimientos, altas— eso no es un detalle de
observabilidad: es la diferencia entre poder responderle a un socio y no poder.

### Y la culpa no se mueve

Si el aviso de la cuota cae en spam, **el club le reclama a FotoOffice**, salga de la
cuenta que salga. Mover el envío al usuario mueve el control, no la responsabilidad.

---

## Lo que sí se hace

### 1. Enviar desde nuestro dominio, con el nombre de la institución

El socio ve **"SFPR"** como remitente, y si contesta le llega al club por `Reply-To`.
Resuelve el tema de la marca sin ninguna fragilidad y sin ningún trámite.

Es lo que ya hace SubiLaFoto con los correos posteriores al evento: el remitente lleva el
nombre del vendedor sobre nuestra dirección verificada. Ver
`apps/subilafoto/lib/correos/transporte.ts`.

### 2. Dominio propio por institución, cuando lo pidan

Resend permite verificar varios dominios. SFPR verifica `sfpr.org.ar` y los correos salen
de `socios@sfpr.org.ar`: entrega excelente, marca de ellos, y **es una función que se puede
cobrar**.

Ese es el camino de crecimiento, no las cuentas de Gmail.

### 3. Si el volumen llegara a molestar, revisar el volumen

La mayor parte del costo de cualquier sistema de correo son mensajes que nadie abre. Antes
de cambiar de infraestructura, mirar qué se manda.

---

## Dónde sí tiene sentido conectar Gmail

**Para leer y responder**, no para mandar en tanda. Una casilla compartida de consultas
dentro del workspace, donde el club ve y contesta desde FotoOffice.

**Para correos individuales que escribe una persona** — un presupuesto a un cliente, la
respuesta a una consulta —, mandar como el usuario está bien y queda mejor.

Ninguno de los dos necesita el scope restringido: leer usa `gmail.readonly` y responder
dentro de un hilo existente es otra conversación con Google.

### La regla

> Lo que **escribe una persona** puede salir de su cuenta.
> Lo que **dispara un cron a las tres de la mañana** tiene que salir de infraestructura que
> controlamos nosotros.

---

## Qué revisaría esta decisión

- Que Resend pase a costar de verdad —miles de correos por día, no por mes—.
- Que Google simplifique el acceso a `gmail.send` sin auditoría.
- Que una institución exija por contrato que los correos salgan de su propia casilla. En
  ese caso, la respuesta es el **dominio verificado** (punto 2), no Gmail.
