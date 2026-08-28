# Generador de propuestas para sponsors — diseño

Fecha: 2026-08-22
Estado: aprobado para implementar la etapa 1
Rama de trabajo: `feat/partners-demo-comercial-e2` (worktree `dnx-suite-wt-etapa10-marquee`)

## Problema

Vender espacios publicitarios en las plataformas DNX hoy exige trabajo de diseño
por cada prospecto: para mostrarle a una marca cómo se vería su publicidad hay
que componer los mockups a mano. Eso no escala y hace que la mayoría de las
propuestas se manden genéricas, que venden peor.

Además, cuando un sponsor acepta, sus datos y su logo se vuelven a tipear a mano
en el panel de administración.

## Qué construimos

Una pantalla en `/propuesta` (Clickatón) donde un vendedor sube el logo de un
cliente potencial y ve, al instante, cómo se vería esa marca en las cuatro
plataformas. Descarga un PDF con esas piezas. Si el cliente acepta, el alta del
sponsor se hace desde la misma propuesta, sin volver a cargar datos.

## Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Alcance | Pre-venta **y** alta en un paso | Evita re-tipear datos al cerrar |
| Acceso | Un link, dos capas según sesión | Link único difundible sin exponer la cartera |
| Generación | Vista previa en navegador + PDF en servidor | Instantáneo en la reunión, sin navegador headless en Vercel |
| Almacenamiento de propuestas | Tabla propia, efímera | Evita partners fantasma en la base real |
| Estructura de la propuesta | Líneas tipadas desde el día 1 | Compatibilidad con el presupuestador futuro |

### Por qué no se reutiliza `DnxPartnerOnboardingInvitation`

La invitación de onboarding **exige un `partnerId` existente**: su flujo es
inverso (el admin crea el sponsor y le envía el link para que complete datos).
Acá el sponsor todavía no existe.

Sí se reutiliza su patrón: token hasheado con vencimiento y revocación, y el
circuito de revisión `PENDING_REVIEW → APPROVED | CHANGES_REQUESTED | REJECTED`.

## Las dos capas

Un solo link, `/propuesta`.

| Acción | Sin sesión | Con `PARTNER_CREATE` |
|---|---|---|
| Subir logo y datos | Sí | Sí |
| Ver mockups | Sí | Sí |
| Descargar PDF | Sí | Sí |
| Recuperar por código | Sí | Sí |
| Buscar sponsors existentes | **No** | Sí |
| Dar de alta el sponsor | **No** | Sí |
| Actualizar imágenes de uno existente | **No** | Sí |
| Ver listado de propuestas | **No** | Sí |

La búsqueda queda del lado autenticado porque expondría la cartera de clientes a
cualquiera con el link.

## Modelo de datos

### `DnxPartnerProposal`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | cuid | |
| `code` | string único | `PR-` + 6 caracteres de alfabeto sin ambiguos (sin `O`/`0`, `I`/`1`), p. ej. `PR-4F2AKX`. ~1.070 millones de combinaciones |
| `status` | enum | `DRAFT` \| `READY` \| `CONVERTED` \| `EXPIRED` |
| `brandName` | string | |
| `industry` | string? | Rubro |
| `contactUrl` | string? | Sitio o Instagram del prospecto |
| `logoStorageKey` | string? | Clave en R2 |
| `logoMeta` | Json? | Ancho, alto, mime, contraste medido |
| `pdfStorageKey` | string? | Último PDF generado |
| `createdByUserId` | Int? | Nulo cuando se generó sin sesión |
| `clientKeyHash` | string? | Hash efímero para rate limit; sin PII |
| `expiresAt` | DateTime | 30 días |
| `convertedPartnerId` | string? | Se llena al dar de alta |
| `convertedByUserId` | Int? | |
| `convertedAt` | DateTime? | |
| `createdAt` / `updatedAt` | DateTime | |

### `DnxPartnerProposalItem`

Las líneas de la propuesta. En la etapa 1 solo describen qué piezas se muestran;
las columnas comerciales quedan nulas y las llena el presupuestador futuro **sin
migración**.

| Campo | Tipo | Etapa 1 | Uso futuro |
|---|---|---|---|
| `id` | cuid | | |
| `proposalId` | FK | | |
| `kind` | enum | `DIGITAL_PLACEMENT` | + `PHYSICAL`, `MERCHANDISING`, `MENTION` |
| `placementKey` | string? | `INFOSPOT_HOME_WELCOME` | igual |
| `label` | string | «Placa de bienvenida · InfoSpot» | igual |
| `quantity` | Int | `1` | «3 meses», «2 eventos» |
| `unitPriceMinor` | Int? | nulo | precio del catálogo |
| `currency` | string? | nulo | `ARS` |
| `selection` | enum | `INCLUDED` | `INCLUDED` \| `OPTIONAL` \| `EXCLUDED` |
| `sortOrder` | Int | | |

El PDF se arma recorriendo estas líneas, no con secciones fijas: la cantidad de
páginas depende de cuántas líneas tenga la propuesta. Es lo que
permite que el mismo generador sirva cuando aparezcan precios e ítems físicos.

### Limpieza

Tarea diaria: borra propuestas vencidas y sus archivos en R2. Las convertidas se
conservan como historial, sin el logo.

## Piezas generadas

**Nueve piezas**, cada una en desktop (1440×900) y mobile (390×844) — 18
imágenes por propuesta.

| Pieza | Plataformas |
|---|---|
| Placa de bienvenida | InfoSpot, Clickatón, FotoRank, ComprameLaFoto (4) |
| Banner horizontal | InfoSpot, ComprameLaFoto (2) |
| Franja de logos | InfoSpot, Clickatón, ComprameLaFoto (3) |

Los fondos son las capturas de las páginas públicas reales que ya viven en
`docs/partners/visual-validation/harness/public/backgrounds/`. Se mueven a
`apps/clickaton/public/propuesta/backgrounds/` para que la app las sirva.

### Estructura del PDF

```
Portada       marca del cliente + "Propuesta comercial" + fecha y código
Página 2      qué es DNX Partners y alcance de las cuatro plataformas
Cuerpo        una página por línea incluida: mockup desktop y mobile,
              formato, medidas y en qué pantalla aparece
Resumen       tabla de formatos y qué debe entregar el anunciante
Contratapa    contacto y validez
```

## Alta y duplicados

Al escribir el nombre, se buscan sponsors parecidos normalizando mayúsculas,
acentos y sufijos societarios (`SRL`, `SA`). Se muestran candidatos con su
estado. Crear uno nuevo habiendo candidatos **exige confirmación explícita**.

Al dar de alta:

```
Sponsor      se crea en PROSPECT
Logo         asset en PENDING, esperando aprobación
Campaña      DRAFT, sin placements vinculados
Propuesta    marcada CONVERTED, no reutilizable
Auditoría    queda registrado quién convirtió y cuándo
```

Nada se publica. Publicar sigue requiriendo los flags y la aprobación de siempre.

Actualizar imágenes de un sponsor existente crea un asset adicional en `PENDING`
que **no reemplaza** al aprobado.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Abuso del link público | Rate limit por `ephemeralClientKey` y hora |
| Archivo que no es imagen | Validación de contenido real vía `assets-mime.ts` |
| Logo demasiado pesado | Tope de peso y medidas; reducción con `sharp` |
| Logo ilegible según el fondo | Medición de contraste; placa automática cuando hace falta |
| Falla la generación del PDF | Se cachea el generado; error claro; la vista previa sigue |
| Propuestas basura acumuladas | Vencimiento a 30 días y limpieza automática |
| Logo con derechos ajenos | Nada se publica sin aprobación; alta deja el asset en `PENDING` |
| Adivinar códigos ajenos | 6 caracteres de un alfabeto de 32 (~2³⁰ combinaciones), más rate limit por intentos. El código solo recupera esa propuesta |
| **Divergencia pantalla / PDF** | Prueba de comparación entre ambas salidas con tolerancia |

La divergencia es la deuda aceptada al elegir el enfoque A. Si algún día molesta,
se resuelve migrando a render server-side único.

## Dónde vive cada cosa

| Qué | Dónde |
|---|---|
| Modelos Prisma | `packages/db/prisma/schema.prisma` |
| Dominio: código, duplicados, capacidades, contraste | `packages/partners/src/proposals*.ts` |
| Repositorio Prisma | `packages/db/src/partners-proposals.ts` |
| Composición de piezas (`sharp`) | `packages/db` o `apps/clickaton/lib/propuesta/` |
| Armado del PDF (`pdf-lib`) | `apps/clickaton/lib/propuesta/pdf.ts` |
| Pantalla pública | `apps/clickaton/app/(public)/propuesta/` |
| API de subida y PDF | `apps/clickaton/app/api/propuesta/` |
| Listado autenticado | `apps/clickaton/app/admin/(panel)/sponsors/propuestas/` |
| Fondos de los mockups | `apps/clickaton/public/propuesta/backgrounds/` |

`pdf-lib` hay que agregarlo a `apps/clickaton/package.json`: hoy está en FotoRank
y ComprameLaFoto pero no en Clickatón. `sharp` ya está.

## Pruebas

Lógica de dominio en `@repo/partners`, sin base de datos:

- generación y validación del código de propuesta; vencimiento
- detección de duplicados por nombre normalizado
- resolución de capacidades por capa (con y sin sesión)
- medición de contraste y decisión de placa
- conversión a sponsor: estados resultantes correctos, usando el repositorio en memoria

En la app (Clickatón):

- composición de piezas: comparación de imágenes con tolerancia
- armado del PDF: cantidad de páginas y presencia de cada línea

Las 220 pruebas existentes de `@repo/partners` deben seguir pasando.

## Etapas

| # | Entrega | Se puede ver |
|---|---|---|
| 1 | Vista previa sin persistencia | Subir logo y ver las 8 piezas |
| 2 | Generación del PDF | La herramienta ya sirve para vender |
| 3 | Persistencia de la propuesta | Código, recuperación, vencimiento, limpieza |
| 4 | Capa autenticada | Búsqueda, duplicados, alta, actualización de imágenes |
| 5 | Listado y control | Panel de propuestas y conversión |

Después de la etapa 2 la herramienta de venta está completa.

## Fuera de alcance

Explícitamente excluido de esta versión:

- **Precios y tarifas.** Requiere catálogo, vigencias, descuentos, moneda e
  impuestos. Depende de definir el modelo comercial.
- **Contrato digital.** Aceptación, identidad del firmante, versionado del texto
  y respaldo probatorio. Tiene implicancias legales.
- **Activación automática en las plataformas.** Que un presupuesto aceptado
  encienda campañas reales en cuatro bases necesita su propio diseño de
  seguridad.
- Edición de creatividades gráficas desde la herramienta.
- Envío de la propuesta por correo.
- Estadísticas de conversión.

Ninguna obliga a rehacer lo de esta etapa, siempre que las líneas de propuesta
se modelen como se define arriba.

## Visión posterior

El destino es un configurador de patrocinios: catálogo de ítems digitales y
físicos con precios, armado de paquetes, presupuesto con las pantallas de cada
ítem incluido, contrato digital y activación en cada plataforma.

`DnxPartnerProposalItem` es la pieza que hace posible esa evolución sin migrar
datos: en la etapa 1 sus columnas comerciales quedan nulas y el presupuestador
las completa.
