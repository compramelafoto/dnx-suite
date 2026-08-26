# Clickatón — Placas de bienvenida y de sponsors: estado y cierre

**Fecha:** 2026-08-26
**Alcance:** placas de participante (welcome + member) y placas de agradecimiento a sponsors (Clickatón y FotoRank).
**Pipeline:** Template V2 (`@repo/template-engine` + `@repo/template-engine-renderer`).

---

## Resumen

El pipeline V2 ya estaba construido y con tests verdes, pero **el PNG que producía salía sin texto**: el
stack tipográfico (`"Barlow Condensed", …`) contiene comillas dobles y se inyectaba sin escapar dentro
del atributo `style`, de modo que el navegador cortaba el atributo y descartaba todas las declaraciones
posteriores, `color` incluido. El texto se pintaba en negro sobre fondo negro. Ningún test lo detectaba
porque todos operaban sobre el documento resuelto, no sobre el PNG.

Se corrigió eso, el logo roto, se agregaron las plantillas de sponsors —que no existían— y se cableó la
generación automática al confirmarse el pago.

---

## Qué se corrigió

| # | Problema | Corrección |
|---|----------|------------|
| 1 | **Placas sin texto** — comillas del stack tipográfico cerraban el atributo `style` | `styleAttr()` escapa todo atributo `style` en `packages/template-engine-renderer/src/html-builder.ts` + tests de regresión en `html-builder.test.ts` |
| 2 | **Logo ausente** — `/brand/...` es relativo y el render corre sobre `about:blank` | Logo embebido como data URL (512 px, 46 KB) en `lib/participant-cards/participant-card-branding-logo.ts`, regenerable con `scripts/build-card-logo.ts` |
| 3 | **Hueco visual** en la placa de bienvenida | Bloque `card.message` agregado a `CLICKATON_WELCOME_STORY_V1` (el preset member ya lo tenía) |
| 4 | **No había plantillas de sponsors** | `CLICKATON_SPONSOR_THANKYOU_STORY_V1` y `FOTORANK_SPONSOR_THANKYOU_STORY_V1` + plugin de variables `sponsor` / `program` |
| 5 | **La generación no era automática** en V2 (era on-demand) | Hook post-pago + cron `/api/cron/participant-cards` cada 5 minutos |

---

## Generación automática de placas de participante

```
Pago confirmado (apply-payment-event)
  └─► enqueueParticipantCardsAfterPaid()      soft-fail, no revierte PAID
        └─► autoGenerateParticipantCardsForRegistration()
              ├─ welcome  → getOrGenerateClickatonParticipantCard()
              └─ member   → getOrGenerateClickatonParticipantCard()

Cron GET /api/cron/participant-cards  (*/5, Bearer CRON_SECRET o x-vercel-cron)
  └─► processDueParticipantCards(limit)
        └─ inscripciones CONFIRMED + foto + consentimiento sin placa READY
```

Archivo: `apps/clickaton/lib/participant-cards/participant-card-autogenerate.ts`.

Reglas:

- **Nunca bloquea el pago.** El hook es `void` con `catch` vacío; el cron reintenta.
- **Actor del sistema = el propio participante.** Se arma desde `userId`/`email` de la inscripción,
  así que no amplía permisos sobre inscripciones ajenas.
- **Fail-closed por configuración.** Si falta una flag o el provider remoto está mal configurado,
  devuelve `FLAG_OFF` / `RUNTIME_CONFIG_INVALID` sin tocar la base.
- Falta de foto o de consentimiento se reporta como `NOT_ELIGIBLE`, no como error: la placa se genera
  cuando el participante completa su perfil.

### Flags necesarias para que se generen

```bash
CLICKATON_PARTICIPANT_CARDS_V2_ENABLED=true
CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED=true
CLICKATON_CARD_RENDER_PROVIDER=remote
CLICKATON_CARD_REMOTE_RENDER_URL=https://<worker>/internal/template-render
DNX_TEMPLATE_RENDER_HMAC_SECRET=<32+ caracteres>
CLICKATON_PARTICIPANT_CARDS_STORAGE_PROVIDER=r2
R2_BUCKET_NAME / R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
# En staging, además:
CLICKATON_PARTICIPANT_CARDS_KEY_PREFIX=clickaton-staging/participant-cards
```

Con todas apagadas el sistema queda exactamente como antes: no genera nada.

---

## Placas de agradecimiento a sponsors

Nuevas plantillas Instagram Story 1080×1920, misma estructura y distinta marca:

| Preset | Producto | Acento |
|--------|----------|--------|
| `CLICKATON_SPONSOR_THANKYOU_STORY_V1` | Clickatón | `#FFE600` sobre negro |
| `FOTORANK_SPONSOR_THANKYOU_STORY_V1` | FotoRank | `#D4AF37` sobre `#050505` |

Fuente de verdad: `packages/template-engine/src/presets/sponsor/`. El layout es un constructor
compartido (`buildSponsorThankYouPayload`) para que ambas placas no se separen visualmente con cada
retoque.

Variables nuevas (plugin `sponsor`, `packages/template-engine/src/plugins/sponsor/`):
`sponsor.name`, `sponsor.logoUrl`, `sponsor.tierLabel`, `sponsor.instagram`, `sponsor.website`,
`sponsor.message`, `program.productLabel`, `program.name`, `program.dateFormatted`, `program.city`,
`program.logoUrl`, `program.metaLine`, `program.participantsCount`.

Render compartido: `renderSponsorThankYouCardPng()` en `@repo/template-engine-renderer`.

### Cómo se usa hoy (Clickatón)

Admin → Ediciones → *edición* → Sponsors → columna **Acciones** → “Placa de agradecimiento”.

Detrás: `GET /api/admin/sponsors/[partnerId]/thankyou-card?editionId=…` devuelve el PNG.
Parámetros opcionales: `message`, `tierLabel`, `disposition=attachment`, `name`.

La categoría del sponsor (“Sponsor oficial”, “Colaborador”…) sale de `publicRoleLabel`, y si está
vacío se deduce del tipo de participación o del `displayTier`.

### Cómo se usa hoy (FotoRank)

Panel organizador → concurso → módulo **Premios y recompensas** → pestaña **Sponsors** →
“Placa de agradecimiento” en cada tarjeta.

Detrás: `GET /api/fotorank/contests/[contestId]/sponsors/thankyou-card?sponsor=<nombre>`.
Sin el parámetro `sponsor` la misma ruta devuelve el JSON con los sponsors del concurso.
Acceso: miembro ACTIVE de la organización dueña del concurso (mismo criterio que el resto del panel).

**Fuente de datos:** FotoRank no usa el CRM de partners para sponsors. Los carga como texto dentro
de premios y recompensas (`sponsorName`, `sponsorUrl`, `sponsorLogoUrl` en `rulesData`), y la
pestaña Sponsors los agrega automáticamente. La placa usa esa misma fuente. Si además el sponsor
existe en `DnxPartner` con el mismo nombre, gana su logo de marca aprobado.

**Ojo:** la placa se genera con los datos **ya guardados**. Si se agrega un sponsor en el modal y no
se guarda, la ruta responde 404.

---

## Plantillas propias para las placas de participante

Las placas ya no dependen de un diseño fijo en el código: cada edición puede usar una plantilla
dibujada en el **editor visual Template V2**.

**Dónde:** Admin → Ediciones → *edición* → **Placas**. Se elige una plantilla para «Bienvenida» y otra
para «Soy parte»; vacío = diseño oficial de Clickatón.

**Dónde se diseña:** Admin → **Plantillas**, dentro del propio panel de Clickatón. El editor visual
Template V2 se extrajo a dos paquetes compartidos y ahora lo montan tanto ComprameLaFoto como
Clickatón.

| Paquete | Qué contiene |
|---------|--------------|
| `@repo/template-editor-core` | Geometría del lienzo, diagnósticos, catálogo de variables, presets, render y servicios. Sin React ni Prisma. |
| `@repo/template-editor-ui` | Lienzo, inspector, capas, versiones, atajos y autoguardado. Componentes React. |

Cada app aporta sus tres puntos de contacto vía `setTemplateV2Runtime`: base de datos, sesión y
almacenamiento de imágenes. En ComprameLaFoto diseñan los fotógrafos; en Clickatón, los admins del
evento. El archivo `lib/template-v2/server.ts` de cada app registra ese runtime y es el único lugar
donde el editor toca la app.

Las plantillas creadas desde Clickatón nacen con `product: "clickaton"`, así el editor ofrece las
variables del participante y de la edición en vez de las escolares.

### Cómo está armado

| Pieza | Qué hace |
|-------|----------|
| `packages/db/src/template-v2-repository.ts` | Lee la plantilla de la base y la devuelve como payload legacy. Compartido: cualquier app puede consumirlo sin depender del código de otra. |
| `ClickatonCardTemplateAssignment` | Qué plantilla usa cada (edición, tipo de placa). Sin fila → preset del código. |
| `participant-card-template-source.ts` | Resuelve el origen, valida y convierte a preset. |
| `lib/admin/editions/card-template-mutations.ts` | Asignar, quitar y pausar desde el panel. |

### Reglas de seguridad

- **Se valida al asignar.** Si la plantilla usa variables que Clickatón no conoce (por ejemplo las
  escolares) o bloques que el motor no dibuja, se rechaza en el panel con el detalle, en vez de
  producir una placa rota cuando alguien se inscribe.
- **Nunca deja a nadie sin placa.** Si la plantilla se borra, se rompe o la base falla en el momento
  de generar, la placa sale con el diseño oficial y el motivo queda como warning `TEMPLATE_FALLBACK`.
- **Pausar sin perder la elección:** `enabled = false` vuelve al diseño oficial conservando la
  plantilla asignada.
- **Fijar versión:** por defecto la placa sigue la versión vigente (guardás en el editor y las placas
  nuevas usan el diseño nuevo). Tildando «fijar versión» queda clavada a la actual.
- **Cambiar el diseño regenera:** la huella de render ya incluye el contenido de la plantilla, así que
  un cambio de diseño produce placas nuevas sin tocar nada más.

### Límite conocido

Si un texto no entra en su caja, **se recorta en silencio** — el motor no achica la letra ni agranda
el bloque. El editor avisa de esto en su panel de diagnósticos al diseñar; conviene mirarlo antes de
asignar una plantilla.

---

## De dónde sale el logo del sponsor

### Subida a R2 (Clickatón)

Admin → Sponsors → *sponsor* → sección **Logos de marca**: se sube el archivo y queda guardado en R2
bajo `clickaton/partners/logos/YYYY-MM-DD/<uuid>.<ext>`, registrado como `DnxPartnerAsset` con
`storageProvider: R2` y `storageKey`.

- Formatos: PNG, JPG o WebP, hasta 5 MB. **SVG queda excluido** a propósito: es ejecutable y el
  renderer no lo acepta.
- Las dimensiones se leen del archivo y quedan en el asset.
- El asset nace `ACTIVE` + `APPROVED`: la aprobación existe para material que envía el partner, no
  para el que carga la organización. Sin eso el logo no entraría en las placas, que sólo usan
  assets aprobados.
- Si el sponsor no tenía logo, el recién subido pasa a ser el visible (`partner.logoUrl`).
- Si el registro en base falla después de subir, el objeto se borra de R2 para no dejar huérfanos.
- Sin R2 configurado: en desarrollo cae a `public/uploads`; en preview/producción **falla con aviso**
  en vez de escribir en el filesystem efímero de Vercel, donde el logo desaparecería en el próximo
  deploy.
- Archivar un logo lo marca `ARCHIVED` y borra el objeto de R2.

El bucket es privado, así que los logos se sirven por el proxy same-origin `/api/media/<key>`; la
clave está habilitada en el allowlist de `lib/content/public-media-keys.ts` (los logos son material
de marca destinado a mostrarse en público).

En **FotoRank** todavía se cargan como URL escrita a mano (`sponsorLogoUrl` del premio); si el sponsor
existe en el CRM de Clickatón con el mismo nombre, gana su logo subido a R2.

### Orden de preferencia

Orden de preferencia al armar la placa (`resolveSponsorCardLogoCandidates`):

1. Asset de marca `LOGO_DARK` con fondo claro (la placa pone el logo sobre plancha blanca)
2. Asset `LOGO_GENERAL`
3. Asset `LOGO_PRIMARY`
4. Campo suelto `logoUrl` del partner (o `sponsorLogoUrl` del premio, en FotoRank)

### Descarga y embebido

Sólo se consideran assets `ACTIVE` + `APPROVED` y sin archivar.

Cada candidato se **descarga en el servidor y se embebe como data URL** antes de renderizar
(`fetchImageAsDataUrl`). Eso resuelve tres cosas de una vez:

- Un asset guardado en R2 se sirve por el proxy relativo `/api/media/<key>`, que no significa nada
  para el renderer: ahora se resuelve contra la URL pública de la app antes de bajarlo.
- El worker remoto no necesita alcanzar el origen de la app ni tener sesión.
- Se valida formato (PNG/JPG/WEBP), tamaño y se bloquean hosts privados (SSRF).

Si ningún candidato sirve, **la placa se genera igual, sin logo**, y el motivo viaja en el header
`X-Sponsor-Logo-Warning` de la respuesta.

---

## Verificación ejecutada

| Comprobación | Resultado |
|--------------|-----------|
| `pnpm --filter clickaton test:clickaton-participant-cards` | 110/110 |
| `pnpm --filter @repo/db test:template-v2-repository` | 6/6 |
| `pnpm --filter @repo/template-editor-core test` | 47/47 |
| `pnpm --filter @repo/template-editor-core check-types` + `lint` | ok, 0 errores |
| `pnpm --filter @repo/template-editor-ui check-types` + `lint` | ok, 0 errores |
| ComprameLaFoto `tsc --noEmit` tras la extracción | ok (sin regresiones) |
| `pnpm --filter @repo/template-engine test` | 46/46 |
| `pnpm --filter @repo/template-engine-renderer test` | 20/20 |
| `pnpm --filter @repo/partners test` | 191/191 |
| `pnpm --filter @repo/partners lint` | corre (faltaba `eslint.config.js`); 0 errores, 8 warnings preexistentes |
| `pnpm --filter clickaton test:partner-logos` | 15/15 |
| `pnpm --filter clickaton test:content` | 35/35 |
| `pnpm --filter clickaton selfcheck:sponsor-card` | ok (ambos productos) |
| `pnpm --filter fotorank selfcheck:sponsor-card` | ok (agregación + render) |
| `pnpm --filter fotorank check-types` | ok |
| `pnpm --filter clickaton selfcheck:welcome-card` | ok (pipeline legacy intacto) |
| `pnpm --filter clickaton check-types` | ok |
| `pnpm --filter clickaton lint` | 0 errores (205 warnings preexistentes) |
| Render local welcome/member | PNG 1080×1920 con texto, foto y logo |
| Render vía worker remoto (`services/template-render-worker`, HMAC) | PNG idéntico al local, 1041 ms |

---

## Lo que falta para producción

1. **Hospedar `services/template-render-worker`** (Docker/Fly/Railway/VPS). Playwright no corre en
   Vercel serverless: sin worker, `provider=remote` no tiene a quién llamar y las placas quedan
   pendientes. El Dockerfile ya existe y el worker se probó localmente contra el pipeline real.
2. **Bucket R2 privado + credenciales** para persistir los PNG.
3. **Configurar las flags** listadas arriba en Vercel (staging primero).
4. **Revisión legal pendiente** — ver [`clickaton-participant-cards-legal-gap.md`](./clickaton-participant-cards-legal-gap.md).
   Sigue abierto: la placa *member* («Soy parte») no está nombrada en las Bases, y
   `socialPublicationConsent` no bloquea la generación. Nada de esto impide generar y descargar en
   staging, pero sí conviene resolverlo antes de publicar en redes.
5. **Subida de logos en FotoRank.** Clickatón ya sube a R2; FotoRank sigue con URL escrita a mano en
   el premio. Mientras esa URL sea pública y PNG/JPG/WEBP la placa sale bien; si el origen se cae, la
   placa sale sin logo (avisado en `X-Sponsor-Logo-Warning`).

---

## Referencias

- Persistencia V2: [`clickaton-participant-cards-persistence.md`](./clickaton-participant-cards-persistence.md)
- Integración HTTP: [`clickaton-participant-cards-integration.md`](./clickaton-participant-cards-integration.md)
- Pipeline legacy (coexiste, no se tocó): [`clickaton-welcome-card-pipeline-audit.md`](./clickaton-welcome-card-pipeline-audit.md)
- Brecha legal: [`clickaton-participant-cards-legal-gap.md`](./clickaton-participant-cards-legal-gap.md)
