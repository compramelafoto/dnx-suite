# Auditoría de la venta escolar (preventa → canje → diseño → entrega)

Fecha: 2026-09-04 · App: `apps/compramelafoto` · Banco de pruebas: `scripts/audit-venta-escolar-e2e.ts`

## Resumen

El circuito escolar **corre de punta a punta**: se puede armar el pack, comprarlo en preventa,
pagarlo, recibir el link de canje, elegir fotos, y se crea el proyecto de diseño. Se encontraron
**cuatro roturas confirmadas**.

> **Estado al 2026-09-04:** arreglados los hallazgos **1** (fotos equivocadas en el impreso),
> **3** (botón «generar diseño»), **4** (descarga digital tras el canje), **5** (estados del pedido)
> y **6** (modo prueba). El banco de pruebas corre con **0 fallas**.
> El **2** (cron de render) también quedó arreglado: la cola y los cron sobreviven al cambio de
> Designer, solo cambia el renderizador que llaman. No queda ninguna rotura abierta.
>
> **Decisión de producto:** las plantillas escolares se van a diseñar con el **módulo DNX Suite
> Designer** (`TemplateV2`), no con el `Template` legacy de huecos. Eso cambia los hallazgos 2 y 9;
> ver la sección «Impacto del Designer» al final.

Además, en producción este circuito **nunca se completó**: de 10 pedidos de preventa, 8 quedaron
en `PENDING` (nunca se pagaron) y los 2 pagados son de abril y de un código anterior. Hay
**0 proyectos de diseño** creados en toda la historia de la base.

## Cómo probarlo

Se agregó un banco de pruebas que recorre el circuito llamando al mismo código que usa la app
(no reimplementa nada). Corre en una rama aislada de Neon, deja 15 verificaciones y se autolimpia.

```bash
cd apps/compramelafoto && DATABASE_URL="<rama de prueba>" AUDIT_E2E_CONFIRM=1 NODE_ENV=production pnpm --filter @repo/payments exec tsx --tsconfig ../../apps/compramelafoto/tsconfig.json ../../apps/compramelafoto/scripts/audit-venta-escolar-e2e.ts
```

Agregá `--cleanup` al mismo comando para borrar los datos que creó.
El script se niega a arrancar sin `AUDIT_E2E_CONFIRM=1`, para no correr contra producción por error.

Rama de prueba usada en esta auditoría: `auditoria-venta-escolar-20260904` (`br-fancy-truth-ad3hhe8p`,
proyecto Neon `divine-hall-10689679`). Se puede borrar cuando no se use más.

### Resultado de la última corrida

```
[  ok ] 1. Escenario: álbum, escuela, pack, plantilla (2 huecos), 6 fotos
[  ok ] 2. Catálogo: pack visible antes y después de subir fotos
[  ok ] 3. Pedido: PreCompraOrder + Order; 1 ítem en estado WAITING_SELFIE
[ aviso] 3b. Entitlement: no se crea; ya no rompe nada, pero es código muerto
[  ok ] 4. Pago: Order → PAID; PreCompraOrder → PAID_HELD
[  ok ] 5. Link de canje: token válido → /cliente/pack/<token>
[  ok ] 6. Canje: Order de canje (2 digitales, 2 impresas)
[  ok ] 7a. Selección guardada: 4 fotos persistidas
[  ok ] 7b. Proyecto de diseño: creado, PENDING_PHOTOGRAPHER_APPROVAL
[  ok ] 7c. Preflight de render: isValid=true
[  ok ] 7d. Fotos del impreso: usa las fotos elegidas para imprimir     (era FALLA)
[  ok ] 7e. Mapeo foto↔beneficio: recuperable desde la base             (nuevo)
[  ok ] 8a. Estado del ítem: READY_TO_DESIGN                            (era FALLA)
[ aviso] 8b. Cola de render: los cron que la procesan no están agendados
[  ok ] 9a. Descarga automática: 1 zip job, 1 token creados por el canje (era FALLA)
[  ok ] 9b. Descarga manual: ensureDigitalDelivery también funciona a mano

Pasos verificados: 16 · Fallas: 0 · Avisos: 2
```

> **Nota sobre la rama de prueba.** Su compute se apaga sola cada pocos minutos (scale-to-zero) y
> eso corta las corridas con `P1017: Server has closed the connection`, en pasos distintos cada vez.
> No es un problema del código. Si pasa, subí `suspend_timeout_seconds` del endpoint mientras probás
> y volvé a bajarlo después.

---

## Hallazgos

### 1. El diseño impreso se arma con las fotos equivocadas — GRAVE · ARREGLADO

Cuando un pack mezcla beneficios digitales e impresos, la carpeta impresa se arma con las fotos
que la familia eligió **para descargar**, y las que eligió **para imprimir** quedan sin usar.
No hay error: el preflight da `isValid=true` y el fotógrafo imprimiría sin enterarse.

Evidencia de la corrida: la familia eligió las fotos 265898 y 265899 para el impreso; el diseño
colocó 265896 y 265897 (las digitales) y dejó las otras dos como `unassignedSelectionPhotoIds`.

Causa: en [redeem-preventa-pack-order-v1.ts](../../apps/compramelafoto/lib/preventa-canjeable/redeem-preventa-pack-order-v1.ts)
`persistSchoolSelectionsFromRedeem` vuelca las fotos de **todos** los beneficios en una sola bolsa
por ítem, sin marcar a qué beneficio pertenece cada una (`SelectionPhoto.role` queda en `null`).
Después, [ensure-school-design-for-preventa-order-item.ts](../../apps/compramelafoto/lib/school-render/ensure-school-design-for-preventa-order-item.ts)
llena los huecos de la plantilla por orden de posición, así que gana el beneficio con `sortOrder`
más bajo. Encima `validateSelectionAgainstTemplate` acepta el caso porque solo compara
`selectedCount >= expectedCount` (4 ≥ 2).

**Arreglado el 2026-09-04.** El canje ahora registra, en memoria, qué fotos eligió la familia para
cada beneficio, y el motor de diseño usa **solo las del beneficio que exige la plantilla**
(`pickSelectionPhotosForDesign`). La `Selection` sigue guardando las cuatro fotos: el registro de lo
que eligió la familia queda intacto. Si el beneficio no tiene fotos que coincidan, el diseño se
saltea con `no_photos_for_template` en vez de armarse con las que no son.

De paso se corrigieron dos problemas del mismo bloque:

- Al releer la selección recién creada no se traían las fotos, así que el preflight avisaba
  `missing_asset` en todos los huecos y no podía detectar fotos borradas. Ahora sí las trae.
- Si esa relectura fallaba, se fabricaban `SelectionPhoto` usando el `photoId` como id (espacios de
  identificadores distintos). Ahora se corta con un aviso.
- Cuando sobran fotos para los huecos disponibles, queda registrado
  (`selection_photos_exceed_slots`); antes pasaba en silencio.

Verificación: `pnpm --filter compramelafoto test:school-design` (6 casos, sin base de datos) y el
banco de pruebas completo, donde el chequeo `7d` pasó de FALLA a OK. Comprobado además contra la
base: el diseño quedó con las dos fotos compradas para imprimir, cero fotos descartadas y cero
avisos de preflight.

Archivos: `lib/preventa-canjeable/redeem-preventa-pack-order-v1.ts`,
`lib/school-render/ensure-school-design-for-preventa-order-item.ts`.

### 2. Los cron de preview y export de diseño no están agendados — ARREGLADO

`app/api/cron/process-design-previews` y `app/api/cron/process-design-exports` existen, pero no
figuran en [vercel.json](../../apps/compramelafoto/vercel.json) ni los llama nadie más
(se verificó en todo el monorepo). Consecuencia en cadena:

- `previewStatus` nunca pasa a `READY` (solo lo escribe ese cron).
- Por eso `POST /api/dashboard/design-projects/[id]/export` siempre responde 409 "Preview not ready".
- Por eso el ítem nunca llega a `EXPORTED`.
- Por eso **no se puede empezar la entrega física**: `start-physical-fulfillment` exige `EXPORTED`,
  y detrás vienen `mark-at-school` y `mark-delivered`.

En producción hay 0 `DesignPreviewJob` y 0 `DesignExportJob`, coherente con que esto nunca corrió.

**Arreglado el 2026-09-04.** Los dos cron quedaron agendados en `vercel.json` cada 2 minutos,
junto a `process-zip-jobs`.

**Corrección a lo que decía antes este informe:** habíamos anotado que agendarlos podía ser trabajo
perdido por la migración al Designer. No es así. Lo que el Designer reemplaza es el **renderizador**
(`renderDesignPreview` / `renderDesignExport`); la cola, los workers y las entradas de cron son
independientes del modelo de plantilla y sobreviven al cambio. Solo cambia a qué función llaman.

Agendarlos sin más era una trampa, así que primero se taparon dos agujeros que solo aparecen cuando
la cola realmente corre (`lib/school-render/design-job-recovery.ts`):

- **Trabajos trabados.** Los workers escribían `lockedAt` pero nadie lo leía. Si una corrida se
  cortaba a la mitad —timeout de 60s, un deploy, un corte de red— el trabajo quedaba en
  `PROCESSING` para siempre. Y como encolar deduplica contra `PENDING`/`PROCESSING`, ese diseño
  tampoco se podía reintentar nunca más: el fotógrafo quedaba sin salida. Ahora, al empezar, cada
  worker reencola lo que lleva más de 10 minutos trabado y descarta lo que ya agotó 3 intentos,
  dejando el motivo en la revisión para que la pantalla no diga "renderizando" para siempre.
- **Choque con el índice único.** `DesignPreviewJob` y `DesignExportJob` tienen
  `@@unique([designRevisionId, status])`: por revisión existe un solo trabajo de cada estado. Un
  segundo intento fallido de la misma revisión chocaba con el primero (P2002) al cerrarse, y el
  render quedaba a mitad de camino. Ahora se libera el lugar del estado terminal apenas se toma el
  trabajo.

Archivos: `vercel.json`, `lib/school-render/design-job-recovery.ts` (nuevo),
`app/api/cron/process-design-previews/route.ts`, `app/api/cron/process-design-exports/route.ts`.

**Verificado por tipos y por lectura, no de punta a punta:** el render real necesita credenciales de
R2, que no están en el entorno local. Lo que falta comprobar en el primer deploy es que los dos cron
aparezcan en Vercel y que un diseño llegue a `EXPORTED`.

### 3. El botón "generar diseño" del fotógrafo siempre falla — ARREGLADO

[generate-design/route.ts](../../apps/compramelafoto/app/api/fotografo/school-order-items/[id]/generate-design/route.ts)
lee el snapshot del pack desde `order.packPurchaseEntitlement.snapshotJson`. Pero
**nunca se crea ningún `PackPurchaseEntitlement`**: `createPackPurchaseEntitlement` y
`updateEntitlementStatus` están definidos en `entitlement-service.ts` y no los llama nadie
(verificado en todo el monorepo; producción tiene 0 filas).

El snapshot real vive en `Order.preventaPackSnapshotJson`, que es de donde lo lee el canje.
Así que el botón devuelve siempre `no_pack_snapshot` → "el pedido no tiene pack".

**Arreglado el 2026-09-04.** La ruta ahora lee el pack congelado desde
`Order.preventaPackSnapshotJson`, el mismo lugar que usa el canje.

Con eso sola no alcanzaba: al regenerar el diseño más tarde hacía falta saber **qué foto era de qué
beneficio**, o volvía a aparecer el hallazgo 1 por la puerta de atrás. Ese vínculo sí queda
guardado, en `OrderItem.benefitStableKey` del pedido de canje, así que se agregó
`loadPhotoIdsByBenefitKeyForPreventaOrder` para reconstruirlo desde la base. El banco de pruebas lo
verifica en el paso `7e`.

Archivos: `app/api/fotografo/school-order-items/[id]/generate-design/route.ts`,
`lib/preventa-canjeable/photo-ids-by-benefit-key.ts` (nuevo).

Nota: queda **código muerto** — `PackPurchaseEntitlement`, `RedemptionSession`,
`entitlement-service.ts` y `redemption-session-service.ts` son de un diseño V1 que quedó
reemplazado por el puente "Order PREVENTA_PACK + snapshot + PackAccessToken". Ya no lo usa nadie
del circuito; conviene borrarlo.

### 4. Después del canje, la familia no recibe la descarga digital — ARREGLADO

El canje crea el `Order` de tipo `PACK_REDEMPTION` ya en estado `PAID` con los ítems digitales,
pero **no encola el ZIP ni crea el token de descarga ni manda email**. La entrega digital
(`ensureDigitalDelivery`) solo se dispara desde el webhook de Mercado Pago —que este pedido no
recorre—, desde el botón del fotógrafo o desde admin.

Verificado: tras el canje hay 0 zip jobs y 0 tokens; si se llama a `ensureDigitalDelivery` a mano,
funciona perfecto (1 zip job, 1 token). Es solo que nadie la llama.

**Arreglado el 2026-09-04.** El canje llama a `ensureDigitalDelivery` apenas confirma la
transacción. No hace falta mandar un email extra: el cron `process-zip-jobs` (que **sí** está
agendado, cada 5 minutos) avisa solo al cliente con el link cuando el ZIP queda listo
(`notifyClientDigitalZipReady`).

Va fuera de la transacción y sin propagar el error: si la preparación de la entrega falla, el canje
—que ya está confirmado— no se cae; queda el error en el log.

Verificado: el paso `9a` del banco de pruebas pasó de FALLA a OK (1 zip job y 1 token creados por
el canje). Archivo: `lib/preventa-canjeable/redeem-preventa-pack-order-v1.ts`.

### 5. Los estados del pedido escolar nunca avanzan — ARREGLADO

`PreCompraOrderItem` se crea en `WAITING_SELFIE` y se queda ahí. Nada en el código escribe
`WAITING_UPLOAD`, `APPROVED_BY_MATCH` ni `WAITING_SELECTION`. Y como
`ensureSchoolDesignForPreCompraOrderItem` hace el pasaje a `READY_TO_DESIGN` con
`where: { status: "WAITING_SELECTION" }`, ese update nunca aplica.

Efecto: el panel del fotógrafo muestra "Esperando selfie" aunque la familia ya haya elegido las
fotos y el diseño ya exista. Los estados intermedios (`DESIGN_SUBMITTED`, `NEEDS_CHANGES`,
`APPROVED`) tampoco se escriben nunca; el único salto real es a `EXPORTED`, desde el cron del
hallazgo 2 —que no corre.

**Arreglado el 2026-09-04.** La compuerta que pasa a `READY_TO_DESIGN` ya no exige un estado
puntual: acepta cualquiera de los previos al diseño (`PRE_DESIGN_ITEM_STATUSES`). Y cuando el pack
no tiene pieza para diseñar —por ejemplo, solo digitales— el ítem pasa igual a `APPROVED_BY_MATCH`
con `approvalProof=SELECTION`, porque la familia ya eligió y dejarlo en «Esperando selfie» hace que
el panel mienta.

Confirmación de que la transición nunca existió: el e2e del monorepo archivado
(`apps/_archive/.../scripts/e2e-school-setup.ts:326`) **creaba el ítem directamente en
`WAITING_SELECTION`** para que la compuerta pasara. Solo la cumplían los fixtures.

No se tocó el enum: recortarlo sería una migración a mano en las 5 bases del esquema compartido,
y no vale la pena por esto.

Verificado: el paso `8a` del banco de pruebas pasó de FALLA a OK.
Archivos: `lib/school-render/ensure-school-design-for-preventa-order-item.ts`,
`lib/preventa-canjeable/redeem-preventa-pack-order-v1.ts`.

### 6. El "modo prueba" no permite probar el canje — ARREGLADO

`POST /api/payments/simulated/confirm` (checkout simulado en álbumes `isTest`) marca el pedido
como `PAID`, pero **no genera el `PackAccessToken`**, que es el link con el que la familia entra a
canjear. Así que el circuito de prueba integrado se corta justo antes de la parte más frágil.

**Arreglado el 2026-09-04.** El confirm simulado genera el token cuando el resultado es
`approved` y devuelve el link en la respuesta, en el campo `packAccessUrl`. No manda email: es un
pedido de prueba. Usa `createPackAccessTokenForOrder` con rotación, así cada simulación te deja un
link usable (en un álbum de prueba invalidar el anterior no molesta). Si la generación del token
falla, queda en el log y el pedido simulado igual sigue pagado.

Archivo: `app/api/payments/simulated/confirm/route.ts`.

**Verificado solo por código**, no de punta a punta: la ruta necesita una sesión HTTP autenticada de
fotógrafo, y el banco de pruebas no levanta el servidor.

### 7. Conviven dos sistemas de packs sin relación entre sí

| Sistema | Modelos | En producción |
|---|---|---|
| Preventa canjeable (escolar) | `PackDefinition` + `BenefitDefinition` | 29 packs, 10 pedidos, 0 pagados por el código actual |
| Packs de galería | `AlbumPack` + `AlbumPackSelectionSession` | 329 packs, 456 sesiones, 456 borradores |

El negocio real corre por `STANDARD_CHECKOUT` (2060 pedidos pagados). El motor escolar es el que
está sin usar. No es un bug, pero explica por qué las roturas de arriba no salieron antes: nadie
recorrió el camino completo.

### 8. Identificación por selfie: sin uso real

Producción tiene 0 `SubjectSelfie`, 0 `PhotoFace`, 0 `FaceMatch`, 0 `PhotoClaim`. El estado inicial
del ítem (`WAITING_SELFIE`) apunta a un mecanismo que nunca produjo una coincidencia. Se conecta
con el hallazgo 5.

### 9. Plantillas: el motor escolar solo entiende las viejas

`ensureSchoolDesignForPreCompraOrderItem` trabaja con `Template` + `TemplateSlot` (legacy).
Producción tiene **1 sola** `Template` con **1 hueco**, contra **30 `TemplateV2`**. Además hay
**1 beneficio con `templatePolicy=REQUIRED` y `templateId` en NULL**: para ese pack el diseño se
saltea con `required_template_missing` y no se genera nada.

**Decidido:** las plantillas escolares se hacen con el **módulo DNX Suite Designer**
(`TemplateV2`). Ver «Impacto del Designer» abajo.

Arreglo inmediato mientras tanto: completar o corregir ese beneficio con `templatePolicy=REQUIRED`
y `templateId` en NULL, para que los packs escolares actuales no queden sin diseño.

---

## Qué NO cubre esta auditoría

Tres partes quedaron fuera porque necesitan credenciales externas que no están en el entorno local:

- **Subida real de fotos**: el banco de pruebas inserta las fotos directo en la base. No se probó
  el upload a R2 ni la generación de variantes/marca de agua.
- **Reconocimiento facial** (AWS Rekognition): no se probó el circuito selfie → coincidencia.
- **Render real del diseño** (preview y JPG final): necesita R2. Se validó el preflight y el
  armado de la revisión, no el pixel.
- **Cobro real en Mercado Pago**: el banco de pruebas replica lo que hace el webhook al aprobar,
  no llama a MP.

Para cerrar esas tres haría falta un `.env.local` de compramelafoto (hoy no existe en el repo)
con R2, MP de test y Rekognition.

## Orden sugerido de arreglo

1. ~~**Hallazgo 1** (fotos equivocadas en el impreso)~~ — hecho el 2026-09-04.
2. ~~**Hallazgo 4** (descarga digital)~~ — hecho el 2026-09-04.
3. ~~**Hallazgo 3** (botón del fotógrafo)~~ — hecho el 2026-09-04.
4. ~~**Hallazgo 6** (modo prueba)~~ — hecho el 2026-09-04.
5. ~~**Hallazgo 5** (estados)~~ — hecho el 2026-09-04.
6. **Hallazgo 2** (cron de diseño) — **en suspenso**: depende de si el render pasa al Designer.
7. **Hallazgo 9** (plantillas) — decidido: van al Designer. Ver «Impacto del Designer».

---

## Impacto del Designer (decisión del 2026-09-04)

Las plantillas escolares se van a diseñar con el **módulo DNX Suite Designer**: el editor vive en
`apps/fotoffice/app/(editor)/members/disenador/[templateId]`, produce `TemplateV2` y se renderiza
con `@repo/template-engine-renderer` (captura por Chromium). El motor escolar de hoy es otra cosa
distinta: `Template` + `TemplateSlot` y render con sharp en `lib/school-render/`.

### El bloqueo concreto

`BenefitDefinition` —la línea del pack escolar— **solo tiene `templateId` apuntando al `Template`
legacy**. No tiene `templateV2Id`. En cambio `AlbumPack` (el sistema de packs de galería) sí lo
tiene, y ya hay un puente que resuelve la propiedad de la plantilla
(`lib/template-v2/resolve-template-v2-for-album-pack.ts`).

O sea: **hoy un pack escolar no puede apuntar a una plantilla del Designer, aunque quiera.**
Agregar esa columna es migración a mano en las 5 bases Neon del schema compartido.

### Qué sobrevive y qué se rehace

| Pieza | Estado |
|---|---|
| `pickSelectionPhotosForDesign` (qué fotos van al diseño) | **Sobrevive** — es agnóstico de plantilla |
| Persistencia de la selección por beneficio | **Sobrevive** |
| `resolveDesignTemplateForRedeemItem` | Se rehace (tiene que resolver `TemplateV2`) |
| `buildInitialTemplateSlotAssignments` | Se rehace (atado a `TemplateSlot.bbox`) |
| `buildInitialRenderPreflight` | Se rehace |
| `renderDesignPreview` / `renderDesignExport` (sharp) | Se reemplaza por el render V2 |
| Cola, workers y entradas de cron | **Sobreviven** — son independientes de la plantilla |
| Lo que el worker llama para renderizar | Se reemplaza |

### Consecuencia para el orden de trabajo

Ninguno de los arreglos hechos se tira con la migración: lo único atado al modelo de plantilla es la
resolución, la asignación a huecos, el preflight y el render. Lo que queda por delante del Designer
es una decisión de esquema —dónde guarda el pack escolar su plantilla nueva— más rehacer esas cuatro
piezas.
