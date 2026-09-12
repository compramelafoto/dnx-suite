# Riesgos y decisiones abiertas

Responde a los capítulos 31 y 36.

## Decisiones bloqueantes

Cuatro frenaban la Etapa 1. **Tres quedaron resueltas el 2026-09-11**; falta la cuarta.

### 1. ¿En qué base vive Subí la Foto? — RESUELTA

**Rama `production` de CompraMeLaFoto (`divine-hall-10689679` / `br-autumn-rain-ad18wq7y`).**
Los 272 fotógrafos con Mercado Pago ya conectado pueden vender desde el día uno.

Lo que esto obliga a cuidar:

- Cada migración se aplica sobre la base de producción de CompraMeLaFoto. **Rama de
  respaldo en Neon antes de tocar nada, siempre.**
- Los eventos con cientos de fotos comparten Postgres con la venta de fotos. Los índices
  del documento 02 no son un lujo: una consulta sin índice acá afecta a CLF.
- El borrado a los 30 días corre sobre esa base. El filtro por `SubilafotoEvent` tiene que
  ser imposible de saltear. <!-- Ver la limpieza de álbumes CLF a 45 días. -->

<details>
<summary>La evaluación original de las tres opciones</summary>

La evidencia (ver documento 06): la base de CompraMeLaFoto tiene **797 fotógrafos, de los
cuales 272 ya tienen Mercado Pago conectado**. La base de Fotoffice y FotoRank tiene 202
usuarios y 2 empresas cargadas en DNX Partners.

| Opción | A favor | En contra |
|---|---|---|
| **Rama `production` de CompraMeLaFoto** | 272 fotógrafos con MP listo para vender desde el día uno. El código de `marketplace_fee` y OAuth ya vive ahí | Es la base grande y crítica. Un evento con 500 fotos entra al mismo Postgres que sostiene la venta de fotos |
| **Rama `development` (Fotoffice/FotoRank)** | Es la base "DNX Suite" donde el modelo multi-app ya se usa. Aislada de lo crítico | Los 272 fotógrafos tienen que registrarse y conectar MP de nuevo. Es fricción justo en el canal de venta |
| Proyecto Neon nuevo | Aislamiento total | Rompe la decisión de reutilizar el login. No lo recomiendo |

El producto se vende a través de fotógrafos y ahí están los fotógrafos, con la cuenta de
cobro ya conectada.

</details>

### 2. ¿Cobrar con `marketplace_fee` en lugar del split 1:N? — RESUELTA

**Sí.** DNX Payments está en sandbox y sus propios documentos prohíben escrituras en
producción; no llega homologado al 10 de octubre. Se usa el modelo que ya cobra hoy en
CompraMeLaFoto, detrás de una interfaz que permita cambiar al split cuando esté listo.

### 3. ¿Cuánto puede descargar el profesional? — RESUELTA

**Nada.** El fotógrafo ve y modera todo, pero no descarga ninguna foto aportada por
invitados. La única descarga del evento es la del cliente, detrás del pago del adicional.
El detalle y sus consecuencias, en el documento 03.

### 4. ¿Qué cuenta de AWS usa Rekognition? — RESUELTA

Credenciales propias. El 2026-09-11 el titular creó el usuario IAM `subilafoto-moderacion`
con un solo permiso, `rekognition:DetectModerationLabels`, y cargó sus claves en Vercel.
Si hay que rotar esa clave por un incidente no se cae el buscador de caras de
CompraMeLaFoto, que está en producción. Verificado desde Vercel: responde en ~100 ms.

### 5. ¿Por qué Amazon y no Google Cloud Vision? — RESUELTA

Pregunta del titular el 2026-09-12: si Google Cloud ya se usa para el login, por qué la
moderación se hace con Amazon, "que era la alternativa más cara".

**No es la más cara: es la más barata de las dos.** Precios verificados el 2026-09-12 en las
páginas oficiales:

| | Amazon Rekognition `DetectModerationLabels` | Google Cloud Vision SafeSearch |
|---|---:|---:|
| Precio por 1.000 imágenes | **USD 1,00** (primer millón) | USD 1,50 |
| Tramo siguiente | USD 0,80 | USD 0,60 (a partir de 5 M) |
| Gratis | 1.000/mes, sólo los primeros 12 meses de la cuenta | 1.000/mes, permanente |

Con el supuesto del documento maestro —100 fotos por evento— Amazon cuesta **USD 0,10 por
evento**. Google costaría 0,15. La diferencia real, a 50 eventos por mes, es **un dólar**:
5 contra 6. A este volumen el precio no decide nada.

Lo que sí decide son dos hechos:

1. **La cuenta de facturación de Google Cloud está cerrada.** Verificado por API el
   2026-09-12: la única cuenta visible, `01E0EB-C76321-DB0EB0`, devuelve `open: false`.
   Cloud Vision exige facturación activa **incluso para consumir su tramo gratuito**. O sea
   que hoy la opción de Google no está disponible, ni gratis ni paga.
2. **Rekognition ya está en producción en la suite.** El SDK
   `@aws-sdk/client-rekognition ^3.985.0` está instalado y con credenciales vivas en
   CompraMeLaFoto. Cambia la operación, no la integración.

Google Cloud **sí se usa** en Subí la Foto: es el cliente OAuth del inicio de sesión,
compartido con el resto de la suite. Son dos servicios distintos del mismo proveedor y sólo
uno estaba disponible.

El documento maestro ya recomendaba Rekognition (capítulos 10 y 22) y pedía verificar
precios antes de integrarlo. Esto es esa verificación.

**Queda abierto:** si en algún momento se reabre la facturación de Google, conviene medir a
los dos con fotos reales de eventos. La precisión importa más que el centavo de diferencia,
y eso no se sabe hasta probarlo. La integración está desacoplada por interfaz de proveedor
justamente para permitir el cambio.

## Decisiones que pueden esperar hasta la Etapa 2

- Umbrales exactos de cada perfil de moderación. Se calibran probando con fotos reales de
  eventos, no antes.
- Cuántas plantillas exactas y cuáles. Seis para el lanzamiento; los temas se eligen sobre
  la marcha.
- Alcance fino del panel del cliente.
- Ventana de gracia entre el último aviso y el borrado. Propuesta: 48 horas.
- Cuántas veces se puede regenerar el enlace de descarga. Propuesta: 5 veces en 90 días.
- Duración del guardado privado del contenido bloqueado. Propuesta: 90 días, y después se
  borra igual que el resto.

## Decisiones que no son técnicas y que hay que resolver igual

Estas no las puede tomar el código y ninguna puede faltar el 10 de octubre:

- **Términos y condiciones y política de privacidad** de Subí la Foto. Hay fotos de
  invitados que no firmaron nada con nadie.
- **Menores.** Un cumpleaños de quince está lleno de chicos de catorce años subiendo fotos
  de otros chicos de catorce años. Hay que decidir qué se pide y qué se guarda.
- **Canal para pedir la baja de una imagen**, que el capítulo 7.3 exige y que en la
  práctica es un email publicado y alguien que lo lea.
- Estructura fiscal de la comisión y quién absorbe el costo de Mercado Pago.
- Comisión mínima y precio mínimo por evento.

## Registro de riesgos

| # | Riesgo | Impacto | Probabilidad | Qué lo contiene |
|---|---|---|---|---|
| R1 | **El plazo.** 29 días para cinco piezas grandes | Crítico | Alta | Recorte del documento 05. Nada nuevo después del 20/9 |
| R2 | La pantalla en vivo falla en el salón real | Crítico | Media | Respaldo por consulta, precarga local, ensayo con TV real en Etapa 4 |
| R3 | Rekognition retiene demasiadas fotos buenas | Alto | Media | Calibrar con fotos reales; panel de revisión rápido en el celular del fotógrafo |
| R4 | Rekognition deja pasar algo grave | Crítico | Baja | Perfiles estrictos, ocultar en un toque desde el control remoto, auditoría |
| R5 | El webhook de MP duplica eventos o cobros | Alto | Media | `@unique` en `mpPaymentId` + registro de entrada. Probado en Etapa 3 |
| R6 | El borrado a los 30 días pisa un pago en curso | Alto | Media | Candado y ventana de gracia. Prueba explícita |
| R7 | Migración mal registrada rompe otra app | Alto | Baja | Sólo tablas nuevas + un `ALTER TYPE`. Respaldo antes de cada aplicación |
| R8 | Wifi del salón saturado con 100 invitados | Alto | **Alta** | Subida directa a R2 sin pasar por el servidor, reintentos, compresión en el teléfono |
| R9 | Base de proveedores llena de duplicados | Medio | Media | Búsqueda contra `DnxPartner` antes de crear, normalización de slug |
| R10 | Costos de R2 y AWS mayores de lo previsto | Medio | Baja | La retención de 30 días es el propio control de costos |

**R8 merece atención especial.** El riesgo más probable de todos no es el software: es que
en un salón con cien personas el wifi no dé abasto. La defensa es subir directo a R2 con
URL prefirmada (sin pasar por el servidor), reducir la foto en el teléfono antes de subir y
reintentar solo. <!-- FotoRank ya tuvo que hacer esto por el tope de 4,5 MB de Vercel. -->

## Deudas asumidas a propósito

Cosas que sabemos que están mal y decidimos no arreglar todavía, con el motivo.

### D1. El panel no se parece al del resto de la suite

**Asumida por el titular el 2026-09-11:** «el panel no es igual o parecido al resto de las
plataformas… pero bueno, dejalo como una deuda».

El panel de Subí la Foto se construyó con los tokens de su propio manual de marca
(`--slf-*`, Montserrat y Cormorant), mientras CompraMeLaFoto, FOTOFFICE y FotoRank comparten
otra estética de panel. Un fotógrafo que use dos plataformas ve dos productos distintos.

**Por qué se deja:** unificar el panel es rehacer la navegación, no cambiar colores, y no
entra antes del 10/10. Además la parte que ve el invitado —que es la que decide si la
plataforma se vende— sí tiene que verse como Subí la Foto y no como otra cosa.

**Cuándo se paga:** después del lanzamiento, y junto con el buscador ⌘K del menú DNX, que
toca los mismos cinco formatos de menú. Hacer las dos cosas por separado es pagar dos veces.

### D2. Faltan `/privacidad` y `/terminos`

La ficha de marca de Subí la Foto en `@repo/auth-ui` declara esas dos rutas
porque el contrato del paquete las exige. **Hoy ninguna de las dos existe.**

No se rompe nada todavía porque la pantalla de ingreso no dibuja los enlaces
legales, pero son obligatorias antes del lanzamiento: la puerta del invitado
pide aceptar condiciones y esas condiciones tienen que estar en algún lado.

### D3. `/api/diagnostico` está abierto en producción

Ruta temporal que informa si la base, R2 y Rekognition responden. No expone credenciales
—sólo el hostname de la base y tiempos de respuesta— pero **hay que borrarla antes del
lanzamiento**. Existe porque sin ella el `P2021` de las dos filas de `DATABASE_URL` habría
costado mucho más que media hora.

## Lo que dejo dicho por escrito

El alcance del capítulo 26.1 es más grande que 29 días de trabajo. Va a entrar completo
sólo si no se agrega nada en el camino y si las cuatro decisiones bloqueantes se resuelven
esta semana. Si algo se atrasa, lo que se recorta es —en este orden— proveedores,
plantillas más allá de seis, panel del cliente y landing.

Lo que no se recorta nunca es el recorrido QR → carga → moderación → pantalla → álbum.
