# Riesgos y decisiones abiertas

Responde a los capítulos 31 y 36.

## Decisiones bloqueantes

Estas cuatro frenan la Etapa 1. Hay que resolverlas entre el 11 y el 13 de septiembre.

### 1. ¿En qué base vive Subí la Foto?

La evidencia (ver documento 06): la base de CompraMeLaFoto tiene **797 fotógrafos, de los
cuales 272 ya tienen Mercado Pago conectado**. La base de Fotoffice y FotoRank tiene 202
usuarios y 2 empresas cargadas en DNX Partners.

| Opción | A favor | En contra |
|---|---|---|
| **Rama `production` de CompraMeLaFoto** | 272 fotógrafos con MP listo para vender desde el día uno. El código de `marketplace_fee` y OAuth ya vive ahí | Es la base grande y crítica. Un evento con 500 fotos entra al mismo Postgres que sostiene la venta de fotos |
| **Rama `development` (Fotoffice/FotoRank)** | Es la base "DNX Suite" donde el modelo multi-app ya se usa. Aislada de lo crítico | Los 272 fotógrafos tienen que registrarse y conectar MP de nuevo. Es fricción justo en el canal de venta |
| Proyecto Neon nuevo | Aislamiento total | Rompe la decisión de reutilizar el login. No lo recomiendo |

**Recomendación: la rama `production` de CompraMeLaFoto.** El producto se vende a través de
fotógrafos y ahí están los fotógrafos, con la cuenta de cobro ya conectada. Pedirles que se
registren otra vez es la clase de fricción que hace que un lanzamiento arranque en cero.

### 2. ¿Se acepta cobrar con `marketplace_fee` en lugar del split 1:N?

DNX Payments está en sandbox y sus propios documentos prohíben escrituras en producción. No
llega homologado al 10 de octubre. La alternativa ya cobra en producción hoy.

**Recomendación: sí.** Y dejar el split para cuando esté homologado, detrás de la misma
interfaz.

### 3. ¿Cuánto puede descargar el profesional sin pagar el adicional?

Ver la regla anti-bypass del documento 03. La propuesta es 20 originales por evento, con
registro. Si el número no te cierra, hay que definirlo ahora: cambia el diseño del panel y
las condiciones que el fotógrafo acepta.

### 4. ¿Qué cuenta de AWS usa Rekognition?

CompraMeLaFoto ya lo usa para reconocimiento facial. Hay que confirmar que la misma cuenta
y región admiten `DetectModerationLabels` y decidir si Subí la Foto comparte esas
credenciales o tiene las suyas. Recomiendo credenciales propias: si hay que rotar una clave
por un incidente, no se cae también el buscador de caras de CompraMeLaFoto.

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

## Lo que dejo dicho por escrito

El alcance del capítulo 26.1 es más grande que 29 días de trabajo. Va a entrar completo
sólo si no se agrega nada en el camino y si las cuatro decisiones bloqueantes se resuelven
esta semana. Si algo se atrasa, lo que se recorta es —en este orden— proveedores,
plantillas más allá de seis, panel del cliente y landing.

Lo que no se recorta nunca es el recorrido QR → carga → moderación → pantalla → álbum.
