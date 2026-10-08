# Muestras Fotográficas: mapa nacional de muestras y actividades culturales

Fecha: 2026-10-08 · Estado: aprobado por Daniel en chat (las cuatro partes)

## Problema

Las instituciones de FOTOFFICE y sus socios organizan muestras fotográficas y otras
actividades culturales, pero no hay un lugar donde publicarlas. Hoy:

- Sólo el equipo de cada institución publica en su blog; un socio no puede proponer contenido.
- El socio no tiene forma de enterarse de las muestras que hay cerca de donde vive.
- No existe una vidriera nacional de muestras, ni para socios ni para el público.
- Las obras de una muestra no se pueden vender, ni hay forma de certificar una copia.

## Objetivo

Que **cualquiera pueda promocionar una muestra** (socio, galería, centro cultural o fotógrafo
suelto), que se publique en un **mapa nacional** con su **galería virtual**, que los socios
vean las **muestras cercanas** en su portal y en un resumen semanal, que las instituciones la
publiquen en su blog, y que las obras se puedan **vender en CompraMeLaFoto** como copias
impresas o digitales, incluso en **ediciones limitadas firmadas y verificables por QR**.

## Decisiones (tomadas con Daniel)

1. **Plataforma propia sobre la base compartida (opción B).** App nueva `apps/muestras` en el
   dominio `muestrasfotograficas.com`, con su propio proyecto de Vercel, pero usando **la misma
   base de datos que FOTOFFICE y FotoRank** (Neon `divine-hall-10689679`, rama `development`).
   Mismas cuentas, mismos socios, sin conectar sistemas. Se descartó una plataforma con base
   propia (más costo fijo y otra integración) y una simple sección de FOTOFFICE (marca menos
   neutral para organizadores externos).
2. **"Actividades culturales", no sólo muestras.** El modelo es genérico; la muestra es un
   tipo. Tipos: muestra, charla, taller, salida fotográfica, presentación de libro, proyección,
   otra. La galería virtual es sólo para muestras.
3. **Quién aprueba.** Lo que propone un socio lo aprueba **su institución** (administrador o
   Comisión). Lo que propone alguien sin institución lo aprueba **Daniel** (super admin) al
   principio.
4. **Blog de la institución.** Las muestras de **sus socios** se publican solas al aprobarse.
   Las **cercanas** de otros llegan como **sugerencia** ("Publicar en mi blog" / "Descartar").
5. **Socios.** Ven muestras **de todo el país**, ordenadas por distancia. El módulo viene
   **encendido** en todas las instituciones y cada una lo puede apagar.
6. **Aviso a socios.** **Resumen semanal por mail, jueves 10:00 hora argentina**; no se manda
   si no hay nada en su zona; suscripto por defecto, baja con un clic.
7. **Venta.** Copias impresas y archivos digitales, **a través de CLF con un puente** (CLF
   está en otra base). No se unifican las bases.
8. **Ediciones limitadas** con número de copia, certificado de autenticidad, firma digital
   propia (sin blockchain ni NFT) y **QR de verificación**.

## Arquitectura

| Pieza | Qué hace |
|---|---|
| `apps/muestras` (nueva) | Sitio público: mapa nacional, listado con filtros, ficha con galería, "Proponé tu muestra", bandeja de aprobación de Daniel, verificación de certificados (etapa 6). |
| `packages/muestras` (nuevo) | Las reglas en un solo lugar: crear, enviar a revisión, aprobar, rechazar, despublicar, cancelar; estado temporal; quién aprueba qué; cercanía. Sin React. Lo usan la app nueva y FOTOFFICE. |
| `@repo/geo` (existe) | Distancias (Haversine), Nominatim, consultas de cercanía y el adaptador de InfoSpot (etapa 4). |
| `@repo/content` (existe) | Crear y actualizar entradas del blog de la institución. |
| FOTOFFICE | Panel "Muestras" (aprobar y sugerencias), ubicación de la institución, portal "Muestras cerca", resumen semanal. |
| CLF | Etapa 5: tienda de la muestra, cobro por el Mercado Pago del fotógrafo, pedidos de impresión existentes. |

La app nueva se compila **sólo cuando cambia su propio código, también en producción**
(`turbo-ignore` sin la excepción de producción que tiene `apps/fotoffice/vercel.json`).

## Datos (tablas nuevas en la base de FOTOFFICE y FotoRank)

Los estados y tipos van como **texto, no como enum de Prisma**: el schema lo comparten todas
las apps y un enum que falte en alguna base rompe sus escrituras (mismo criterio que
`Raffle` y `Booking.status`). Los ids de usuario son `Int` sin relación Prisma a `User`.

**`CulturalActivity`** — la ficha.
- `type` (uno de los siete tipos), `title`, `slug` único, `description`, `coverImageUrl`.
- `organizersText` (nombres libres). Los vínculos a cuentas (`CulturalActivityOrganizer`) llegan en la etapa 2.
- `startsAt`, `endsAt`, `openingAt?`, `scheduleText`, `priceText?` (entrada libre si vacío),
  `externalUrl?`.
- Lugar: `isVirtualOnly`, `venueName?`, `address?`, `city?`, `province?`, `latitude?`,
  `longitude?`, `geohash?`. Sin coordenadas no aparece en el mapa.
- `workspaceId?` (institución, si la propuso un socio), `proposedByUserId`.
- `reviewStatus`: `DRAFT | IN_REVIEW | APPROVED | REJECTED | UNPUBLISHED`, más
  `rejectionReason?`, `reviewedByUserId?`, `reviewedAt?`, `isCancelled`.
- `galleryMode`: `HIGHLIGHTS_UNTIL_CLOSED | FULL` (por defecto el primero).
- `rightsConfirmedAt` (confirmación de autorización de los autores).
- `blogPostId?` (entrada en el blog de su institución), `itinerantGroupId?` (sedes de una
  misma muestra itinerante).

**`CulturalActivityWork`** — obra de la galería: `imageUrl`, `title`, `authorName`,
`authorUserId?`, `year?`, `technique?`, `isHighlight`, `sortOrder`. Tope: **40 por muestra**,
**12 destacadas**.

**`CulturalActivitySuggestion`** (etapa 2) — `activityId`, `workspaceId`, `distanceKm`,
`status: PENDING | PUBLISHED | DISMISSED`, `blogPostId?`.

**`MemberActivityPreference`** (etapa 2) — `userId`, `latitude`, `longitude` (a nivel de
ciudad, nunca la dirección exacta), `radiusKm` (25/50/100/200/todo el país),
`weeklyDigest` (por defecto sí), `unsubscribeToken`.

**Ubicación de la institución** (etapa 2) — `latitude`, `longitude` y `suggestionRadiusKm`
(por defecto 50) en la configuración del workspace.

Etapas 5 y 6 agregan sus tablas (oferta de venta por obra, edición, copias numeradas,
reservas de número, certificados); se diseñan en detalle al llegar.

## La ficha y la galería

- Obligatorio: tipo, título, descripción, portada, organizadores, fechas, horarios y lugar
  (o "sólo virtual"). La dirección se geocodifica una vez y el organizador puede corregir el
  punto en el mapa.
- **Galería:** mientras la muestra está próxima o abierta se ven sólo las destacadas con el
  cartel "Visitala en persona"; al cerrar se ve completa. El organizador puede elegir
  "completa desde el principio".
- Las fotos se guardan **achicadas para web** (preset nuevo en el bucket de FOTOFFICE). Los
  originales en alta se suben recién en la etapa 5, al poner una obra a la venta.
- **Itinerante:** una ficha por sede; "Duplicar para otra sede" copia todo menos lugar y fechas.

## Recorrido

```
Borrador → En revisión → Aprobada → (Próxima → Abierta → Cerrada)
                       ↘ Rechazada (con motivo) → se corrige y vuelve a revisión
Aprobada → Despublicada (por quien aprobó)       Aprobada → Cancelada (cartel, sigue visible)
```

- **Próxima / Abierta / Cerrada** se calculan con las fechas en hora argentina; no se guardan.
  Cerrada pasa al **archivo** y sigue visible.
- Al **aprobar**: aparece en el mapa; si es de un socio, se crea la entrada del blog de su
  institución; se generan sugerencias para instituciones cercanas (etapa 2); mail a quien la
  propuso.
- Al **rechazar**: mail con el motivo.
- **Editar una aprobada** (texto, horarios, obras) no vuelve a revisión. Si cambian fechas o
  lugar, se actualiza la entrada del blog. Si se despublica, la entrada vuelve a borrador.
- Proponer exige cuenta. La cookie de sesión de FOTOFFICE no cruza a otro dominio, así que la
  app nueva tiene su propio **ingreso con Google** (igual que SubiLaFoto) que crea la sesión en
  la **misma tabla `User`**: el socio entra con el mismo Google y es el mismo usuario.
- En la etapa 1 todas las propuestas van a la bandeja de Daniel; el ruteo a la institución
  del socio llega en la etapa 2.

## Portal del socio (etapa 2)

- Tarjeta **"Muestras cerca tuyo"** en el tablero: las 3 más cercanas abiertas o próximas, con
  distancia, fechas y "Últimos días" si cierra esa semana.
- Sección **"Muestras"** en el menú (`PORTAL_MENU`, módulo nuevo en `MODULE_REGISTRY`): lista
  por distancia, mapa, radio y filtro por tipo, y enlace a "Proponé tu muestra".
- Ubicación: la ciudad y provincia del perfil del socio, geocodificadas una vez; si faltan, la
  sección pregunta "¿Dónde estás?". Botón optativo "Usar mi ubicación" (se guarda redondeada).

## Resumen semanal (etapa 3)

- Cron semanal, **jueves 10:00 hora argentina** (`0 13 * * 4` en UTC).
- Bloques: **Nuevas cerca tuyo**, **Inauguran esta semana**, **Últimos días**, dentro del
  radio de cada socio. Sin contenido no se envía.
- Con el nombre de su institución, por Resend como los demás mails a socios. Baja con un clic
  por token, sin login.
- A los administradores, en el mismo envío: "Tenés N muestras cercanas para publicar".

## Sugerencias a instituciones (etapa 2)

Al aprobarse una actividad de otra institución o de alguien suelto, a menos de
`suggestionRadiusKm` de una institución con ubicación cargada, se crea una sugerencia. En
**Muestras → Sugerencias**: "Publicar en mi blog" (la entrada cita al organizador y enlaza a la
ficha en `muestrasfotograficas.com`) o "Descartar". Sin ubicación cargada no hay sugerencias.

## Ediciones limitadas con QR (etapa 6)

- Al poner una obra a la venta: **edición abierta** o **limitada de N copias** (+ pruebas de
  autor). Vendida la primera copia, N no puede subir.
- Cada copia vendida recibe **número** ("3/10") y **certificado**: obra, autor, número, papel
  y tamaño (si es impresa), fecha, comprador sólo si acepta, firma manuscrita escaneada del
  autor (cargada una vez).
- **Firma digital:** hash SHA-256 del archivo original + datos de la copia, firmado con una
  clave privada de DNX (Ed25519); la página de verificación valida la firma. Los datos se
  incrustan también como metadatos XMP en el archivo digital. *Content Credentials* (C2PA)
  queda como mejora futura.
- **QR** en el certificado impreso, en una etiqueta para el dorso y en el PDF del digital →
  `muestrasfotograficas.com/verificar/<código>`: "Copia auténtica 3/10 de … emitida el …", o
  "anulada" si hubo devolución (el número no se reutiliza).
- **Nunca la copia 11 de 10:** la numeración vive en nuestra base; al iniciar el pago en CLF
  se reserva un número por 20 minutos y se libera si no se paga.
- En digital, el valor está en el certificado registrado, no en el archivo (se puede copiar).

## Etapas

| Etapa | Contenido |
|---|---|
| 1 | `apps/muestras` + `packages/muestras` + tablas: mapa, listado, ficha con galería, "Proponé tu muestra", bandeja de aprobación de Daniel |
| 2 | FOTOFFICE: aprobación por institución, blog automático, portal "Muestras cerca", ubicación de la institución, sugerencias |
| 3 | Resumen semanal por mail |
| 4 | Envío a InfoSpot (adaptador de `@repo/geo`) |
| 5 | Puente a CLF: venta de copias impresas y digitales (diseño propio) |
| 6 | Ediciones limitadas firmadas, certificado y QR |
| 7 | FotoRank: "Convertir concurso en muestra" |

## Pruebas

- Unitarias (vitest) en `packages/muestras`: transiciones de estado, permisos de aprobación,
  estado temporal en hora argentina, cercanía y orden por distancia, topes de galería. En la
  etapa 6, que la numeración no se pase del total con compras simultáneas.
- Prueba local con `next dev` antes de cada publicación (las vistas previas de Vercel no
  sirven para esto).
- Piloto con SFPR en la etapa 2 antes de abrir a todas las instituciones (FOTOFFICE no tiene
  staging).

## Riesgos

- **Dominio:** comprar `muestrasfotograficas.com` (y ver `.com.ar`) antes de publicar.
- **Nominatim** tiene límite de uso: se geocodifica una vez y se guarda; con el limitador que
  ya usa FOTOFFICE.
- **Migraciones a mano** en las bases que tienen el schema compartido, verificando tabla por
  tabla (el registro `_prisma_migrations` no es confiable).
- **Contenido indebido o sin derechos:** aprobación previa, confirmación de derechos,
  despublicar.
- **Puente a CLF** cruza bases: etapa propia con diseño propio.

## Fuera de alcance de este documento

El detalle de las etapas 4 a 7, la unificación de bases de la suite y las ediciones
numeradas dentro de CLF fuera de las muestras.
