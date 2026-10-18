# Pedidos de trabajo: del Mostrador al retiro

Plan del 18/10/2026 para DNX Estudio. Reemplaza las cuatro planillas de Google (FOTOLAG, ROMÁN,
"Fotografía semanal 7 días" y "VHS y rollos") y las carpetas de Google Drive por pedidos dentro de
FOTOFFICE, con su recorrido, sus archivos en nuestro propio almacenamiento y el aviso al cliente.

## Lo que muestran las planillas

| Planilla | Qué lleva | Columnas | Volumen |
|---|---|---|---|
| FOTOLAG (una hoja por mes) | Copias 10x15, 13x18, 15x20, carnet, polaroid; algunos cuadros a La Isla | fecha, descripción, cliente, teléfono, **link de Drive**, n° de pedido, estado, **seña, total, resta**, laboratorio | ~50 pedidos por mes |
| Fotografía semanal 7 días | Impresiones a 7 días, tarjetas | lo mismo + **fecha de retiro** | pocos, recién empezada |
| ROMÁN | Fotolibros, canvas, MDF, semirrígidos | lo mismo + **n° de pedido del laboratorio**, fecha de entrega, **costo** | ~5 por mes |
| VHS y rollos (5 hojas) | VHS, 8 mm, mini DV, DVD, CD, casetes de audio, diapositivas, rollos y cámaras descartables | cliente, **link de Drive**, cantidad, abono, total, resta, teléfono, estado, comentario | ~40 abiertos |

Lo que se repite y hay que resolver:

- **Seña y saldo** en todas: el cliente deja una parte y paga el resto al retirar.
- **Un link de Drive por pedido**, para mandarle los archivos al laboratorio o para entregarle al
  cliente lo digitalizado.
- **Estados sueltos**: "LISTO", "ENVIADO", "LINK ENVIADO", "Recibido", "Entregado", "por pasar",
  "falta pendrive"… cada planilla los escribe distinto.
- **El número de pedido del laboratorio** y el **costo** que cobra (para saber cuánto se gana).
- **Agregados que se venden con el trabajo**: pendrive, cuadro o marco reservado, envío por Andreani.
- **Notas que importan**: "VHS que no funciona" (se descuenta), "descuento del 15 % por más de 10",
  "agregar el pedido que tiene arriba" (varios pedidos del mismo cliente), "cortar polaroid".
- **Casi siempre hay teléfono y casi nunca correo**: el aviso tiene que poder salir por WhatsApp.

## Lo que ya existe en FOTOFFICE (se reusa, no se rehace)

- **Pedidos** con cuotas, cobros, recibos, saldo y página pública para el cliente (con pago por
  Mercado Pago y datos para transferir).
- **Proyectos** con recorridos (circuitos) configurables: etapas con color, plazo en días, tareas
  automáticas y reglas que los mueven solos. Un producto del catálogo puede "generar un proyecto"
  de un recorrido. DNX ya tiene cargados "Impresiones a laboratorio", "Impresión de Fotografías",
  "Fotolibro" y "Pendrive".
- **Galerías** en nuestro almacenamiento (Cloudflare R2): subida directa de fotos y videos de hasta
  5 GB, enlace privado para el cliente y descarga en ZIP.
- **Borrado automático a los 30 días** para adjuntos (falta para galerías).
- **Correo** por Resend con plantillas y registro de envíos. **En los últimos 30 días no salió
  ninguno** (verificado en la base): hay que confirmar que esté configurado en producción.

Lo que falta: el Mostrador no crea pedidos ni acepta seña; un proyecto no existe sin pedido; no hay
proveedores; no hay fecha de entrega prometida; no hay recorridos de rollos ni de digitalización;
no hay carpeta para archivos que no sean fotos; nada avisa al cliente cuando el trabajo está listo;
y el tablero muestra un recorrido por vez.

## Cómo va a funcionar

### En el Mostrador

1. Se cargan los productos como hoy. Si alguno **lleva proceso** (copias para mañana o para la
   semana, cuadros, fotolibros, rollos, digitalizaciones), el ticket lo marca y pide:
   - **Cliente** (obligatorio: hay que avisarle y entregarle).
   - **Fecha de entrega**, sugerida según el producto (ver "Plazos") y editable.
   - **Cobro: seña o total.** Con seña se carga cuánto deja; el resto queda como saldo.
2. Al cobrar se crea el **pedido** con su número, la seña como primer cobro (entra a Caja una sola
   vez) y **un trabajo por cada producto con proceso**, en la primera etapa de su recorrido.
3. Las instantáneas y lo que se lleva en el momento siguen siendo una venta común, sin pedido.
4. Cuando el cliente vuelve a retirar, el Mostrador muestra **"Tiene pedidos para retirar"** al
   elegirlo, con el saldo, y se cobra desde ahí.

### Los recorridos (uno por tipo de trabajo)

Todos tienen como mínimo los estados que pediste. Las etapas se pueden renombrar o agregar después
desde Configuración → Circuitos.

| Recorrido | Etapas |
|---|---|
| **Impresión en laboratorio** (copias, cuadros, canvas, MDF) | Pedido recepcionado → Enviado al laboratorio → Retirado del laboratorio → **Listo para retirar** → Entregado |
| **Fotolibro** | Pedido recepcionado → En edición → Aprobado por el cliente → Enviado al laboratorio → Retirado del laboratorio → **Listo para retirar** → Entregado |
| **Revelado de rollos** | Recibido → Enviado al laboratorio → Recibido digital → Subido a la nube (YouTube no hace falta) → **Listo para retirar** → Negativos o cámara entregados |
| **Digitalización** (VHS, 8 mm, mini DV, DVD, CD, casete, diapositivas) | Recibido → Grabado → Subido a la nube y a YouTube → **Listo para retirar** → Material original retirado |

Cada trabajo guarda: **proveedor** (La Isla, Román, Estudio del Bajo, Fotolag), **n° de pedido del
proveedor**, **costo** del proveedor, **fecha de entrega prometida**, cantidad, notas y la carpeta de
archivos.

### Proveedores

Una lista corta de proveedores (nombre, teléfono, correo, días habituales) en Configuración. Cada
producto tiene su proveedor por omisión (las copias 10x15 van a Fotolag, los canvas a La Isla, los
fotolibros a Román) y se cambia en cada trabajo si hace falta.

### Plazos (para sugerir la fecha de entrega)

Cada producto tiene su plazo. Con lo que contaste: "para mañana" = 1 día hábil, "próxima semana" =
7 días, instantánea = en el momento. Fotolibros, rollos y digitalizaciones llevan los días que
definas. El Mostrador suma el plazo a hoy, saltea domingos (y feriados más adelante) y propone esa
fecha; con varios productos, propone la más lejana.

### La carpeta del pedido (adiós Google Drive)

- Cada trabajo tiene una **carpeta** en nuestro almacenamiento. Se arrastran archivos de cualquier
  tipo (JPG, TIFF, PDF, MP4, MOV, MP3, WAV, ZIP), de hasta 5 GB cada uno.
- **Enlace para el laboratorio**: privado, sin usuario, para que descarguen todo de una vez (ZIP).
  Se puede vencer apenas lo retiran.
- **Enlace para el cliente**: ve y descarga lo suyo, con los videos para mirar ahí mismo, y el
  enlace de YouTube si se subió.
- **Borrado automático a los 30 días** de "Listo para retirar", con aviso al cliente unos días
  antes ("descargalo antes del…"). El plazo se elige por recorrido: rollos y digitalizaciones 30
  días; impresiones se borran al entregar.
- Costo estimado: Cloudflare R2 cobra por guardar, no por descargar. 40 VHS por mes a ~2 GB cada uno
  son ~80 GB, menos de US$ 2 por mes, y con el borrado a 30 días no se acumula.
- **YouTube**: en la primera versión se pega el enlace del video (subido a mano a la cuenta del
  estudio). La subida automática a YouTube necesita conectar la cuenta de Google y queda para más
  adelante.

### "Listo para retirar": el aviso al cliente

Al pasar un trabajo a "Listo para retirar" aparece **"Avisar al cliente"**, que se puede dejar
automático por recorrido:

- **Por correo**, si tiene: qué está listo, **cuánto falta pagar**, **dirección y horarios de
  retiro**, **datos para transferir** el saldo (alias, CBU/CVU, titular), el **enlace del pedido**
  para pagar con Mercado Pago y, en digitalizaciones y rollos, el **enlace a los archivos** con la
  fecha hasta la que se pueden descargar.
- **Por WhatsApp**: botón que abre WhatsApp con el mismo mensaje ya escrito para ese teléfono. No
  hace falta ninguna integración: se aprieta "enviar" en WhatsApp.
- La página pública del pedido pasa a mostrar en qué etapa está cada trabajo.

La dirección y los horarios de retiro se cargan una vez en Configuración (se reusa lo que ya tiene
la tienda online).

### El panel de pedidos

Una pantalla **"Pedidos en curso"** con todos los trabajos de todos los recorridos juntos:

- Columnas comunes a todos los recorridos: **Recibido · En proceso · En el proveedor · Listo para
  retirar · Entregado** (cada etapa de cada recorrido cae en una de esas).
- Cada tarjeta: cliente, qué es, cantidad, proveedor, fecha prometida (en rojo si está vencida),
  saldo y botones rápidos (pasar a la etapa siguiente, abrir la carpeta, avisar).
- Filtros por recorrido, proveedor, vencidos, "con saldo" y "listos sin retirar hace más de N días".
- El tablero por recorrido de Proyectos sigue existiendo para el detalle.

## Etapas de trabajo

| Etapa | Qué incluye | Tiempo estimado |
|---|---|---|
| **1. Mostrador → pedido** | Productos "con proceso", seña o total, fecha de entrega sugerida, pedido + trabajos creados al cobrar (sin doble ingreso a Caja), proveedores, los 4 recorridos de DNX y "tiene pedidos para retirar" con cobro del saldo | 4 días |
| **2. Panel de pedidos** | Tablero único con todos los recorridos, filtros y acciones rápidas | 2 días |
| **3. Carpeta del pedido** | Subida de archivos de cualquier tipo, enlace para el laboratorio, enlace para el cliente, borrado a 30 días con aviso previo | 3 días |
| **4. Avisar al cliente** | Correo y WhatsApp de "Listo para retirar" con saldo, retiro, transferencia y archivos; poner a andar el correo en producción; etapa visible en la página del pedido | 2 días |
| **5. Pasar lo abierto** | Cargar en FOTOFFICE los pedidos abiertos de las planillas (no LISTO ni Entregado) | 1 día |
| Más adelante | Subida automática a YouTube; feriados en los plazos; envíos por Andreani | — |

## Lo que necesito de Daniel para arrancar

1. **Proveedores**: ¿están todos? La Isla, Román, Estudio del Bajo, Fotolag. ¿Qué va a cada uno por
   omisión?
2. **Plazos**: días de fotolibro, rollos y cada digitalización. ¿"Para mañana" es al día hábil
   siguiente?
3. **Retiro**: dirección y horarios de atención para el aviso.
4. **Correo**: si el aviso tiene que salir también por correo, confirmar el remitente (por ejemplo
   avisos@dnx…) para dejar Resend andando.
