# Arquitectura y reutilización

Responde al capítulo 24 del documento maestro. Cada fila está verificada contra el
repositorio el 2026-09-11, no supuesta.

## Resumen en una frase

Subí la Foto es una app más de DNX Suite (`apps/subilafoto`), sobre el schema Prisma
compartido, que reutiliza el login, los pagos y el ZIP de CompraMeLaFoto, la base de
empresas de DNX Partners y el motor de notificaciones. Lo único verdaderamente nuevo es
**la pantalla en vivo**.

## Matriz de capacidades

| Capacidad | Decisión | Evidencia en el repositorio | Riesgo |
|---|---|---|---|
| Autenticación | **Reutilizar** | `packages/auth` — sesiones, registro, verificación de email, reset, Google OAuth, invitaciones | Bajo |
| Workspaces y roles | **Extender** | `Workspace`, `WorkspaceMembership`, `WorkspaceAppAccess`, enums `SuiteApp` / `SuiteAppRole` en `packages/db/prisma/schema.prisma` | Bajo: agregar `SUBILAFOTO` a `SuiteApp` |
| Interruptor por workspace | **Reutilizar** | `WorkspaceFeatureModule` (`moduleKey` + `enabled`) | Bajo |
| Pagos con comisión | **Reutilizar** | `apps/compramelafoto/lib/event-organizer-commission-mp-marketplace-fee.ts`, `album-order-mp-preference.ts`, `mp-oauth-token-refresh.ts`, `resolve-album-order-mp-credentials.ts` — **en producción hoy** | Medio: hay que portarlo, no copiarlo |
| Split 1:N (DNX Payments) | **No usar en el MVP** | `docs/dnx-payments/README.md`: *"adapter Mercado Pago Orders/Consent sandbox-only"*, *"Bloque A smoke real MP: sigue bloqueado"*, *"No: production writes"* | **Alto si se depende de él** |
| Almacenamiento privado | **Reutilizar** | `@aws-sdk/client-s3` + `s3-request-presigner` en CLF, FotoRank, Clickatón, InfoSpot y Fotoffice | Bajo |
| Moderación IA | **Extender** | `@aws-sdk/client-rekognition ^3.985.0` ya instalado y con credenciales AWS vivas en CLF (`app/api/albums/[id]/search/face`, `app/api/admin/ai/test-connections`) | Bajo: cambia la operación a `DetectModerationLabels` |
| Paquete ZIP y entrega | **Reutilizar** | `ZipGenerationJob`, `OrderDownloadToken`, `app/api/downloads/[token]`, `app/api/orders/[id]/zip-status` en CLF | Bajo |
| Emails y secuencias | **Reutilizar** | `packages/notifications` (`engine`, `scheduling`, `deduplication`, `preferences`) + `packages/communications` + Resend | Bajo: `deduplication` resuelve el "sin mensajes duplicados" del capítulo 6.6 |
| QR | **Reutilizar** | `qrcode ^1.5.4` en Fotoffice, CLF, FotoRank y Clickatón | Bajo |
| PDF para imprenta | **Reutilizar** | `@repo/design-studio` (`emitDesign`) genera PDF con sangrado; lo usa el carnet de socio en `apps/fotoffice/lib/carnet/render.ts` | Bajo |
| Empresas y proveedores | **Reutilizar** | `packages/partners` — `DnxPartner`, `DnxPartnerContact`, onboarding por token (`onboarding-token.ts`), `slug.ts`, `validate.ts` | Bajo. **Sin activar campañas ni sponsors** (capítulo 33) |
| Plantillas visuales | **Extender** | `packages/template-engine`, `template-engine-renderer`, `design-studio`, `TemplateV2*` en el schema | Medio: son plantillas de impresión, no de pantalla. Ver abajo |
| Auditoría | **Reutilizar** | Patrón `MemberAudit` (Fotoffice) y `OrderAuditLog` / `AdminLog` (CLF) | Bajo |
| **Tiempo real** | **Crear** | **No existe nada.** Ni Pusher, ni Ably, ni socket.io, ni SSE en todo el monorepo | **Alto** |
| Diseño / componentes | **Crear propio** | `packages/ui` sólo tiene `button/card/code` del template de Turborepo; `packages/design-system` está prácticamente vacío. Cada app tiene su estética | Medio |

## Las tres decisiones estructurales

### 1. Pagos: `marketplace_fee`, no split 1:N

El documento maestro (capítulos 6.3 y 35) pide analizar el split 1:N sin darlo por hecho.
La verificación es concluyente: **DNX Payments está en sandbox y sus propios documentos
prohíben escrituras en producción.** No llega homologado al 10 de octubre.

La alternativa ya está en producción y hace exactamente lo que el negocio necesita:

- El fotógrafo conecta su cuenta de Mercado Pago por OAuth (una vez).
- El cliente paga **en la cuenta del fotógrafo**.
- Subí la Foto retiene su comisión con `marketplace_fee`, configurable, sin tocar el dinero.
- El webhook confirma el pago de forma idempotente y recién ahí se crea el evento.

**El adicional de descarga se cobra aparte**, en una orden propia contra la cuenta de DNX,
porque su ingreso es 100% de la plataforma (capítulo 6.5). Separarlo en dos órdenes evita
tener que repartir un mismo pago y es lo que hace innecesario el split.

Cuando DNX Payments se homologue, migrar es cambiar el proveedor detrás de la misma
interfaz. No es trabajo perdido.

### 2. Tiempo real: SSE con reconexión y respaldo

Un endpoint `GET /api/eventos/[id]/stream` que emite Server-Sent Events. Las pantallas se
suscriben, reciben `foto.aprobada`, `foto.oculta`, `pantalla.comando` y `evento.cerrado`.

Tres decisiones que hacen que esto no falle en un salón:

- **Reconexión con `Last-Event-ID`.** Si se corta el wifi, la pantalla no pierde fotos.
- **Respaldo por consulta cada 15 segundos.** Si el SSE muere sin avisar, la pantalla
  sigue funcionando aunque con retardo. El operador ve el estado real.
- **Precarga local.** La pantalla mantiene en memoria las últimas N fotos aprobadas y
  puede seguir proyectando sin red (modo contingencia del capítulo 11.1).

Con 100 fotos por evento y unas pocas pantallas, esto sobra. No hay que pagar Pusher.

### 3. Plantillas: dos cosas distintas con el mismo nombre

El monorepo tiene un motor de plantillas potente, pero está hecho para **piezas impresas**
(TemplateV2, Designer, exportación a PDF). Lo que pide el capítulo 8 es **tema visual de
pantalla**: portada, colores, tipografías, transiciones, placa de cierre.

<!-- Reutilizar TemplateV2 acá sería forzar la herramienta equivocada. -->

Propuesta: plantillas de Subí la Foto como **datos**, no como motor. Un registro
`SlfTemplate` con un JSON de tokens visuales (paleta, tipografías, fondo, estilo de
transición, ornamentos) que el front renderiza con CSS. Diez plantillas bien hechas al
lanzamiento. Es una tarde de trabajo por plantilla, no un motor nuevo.

## Ubicación y despliegue

- **App:** `apps/subilafoto`, Next 16.2.1 y React 19.2.4 como el resto de la suite.
- **Proyecto Vercel propio**, con `subilafoto.com` como dominio canónico.
- **Base:** la misma Neon compartida. Ver [06-migraciones-pruebas-y-despliegue.md](./06-migraciones-pruebas-y-despliegue.md),
  porque el schema compartido tiene una consecuencia operativa seria.

### Rutas públicas y privadas

| Ruta | Quién |
|---|---|
| `subilafoto.com/` | Landing del producto |
| `subilafoto.com/v/[slug]` | Enlace permanente de venta del profesional |
| `subilafoto.com/e/[codigo]` | Entrada del invitado por QR |
| `subilafoto.com/e/[codigo]/album` | Galería del evento |
| `subilafoto.com/pantalla/[codigo]` | Pantalla en vivo (16:9, sin interfaz) |
| `subilafoto.com/proveedor/[token]` | Ficha del proveedor |
| `subilafoto.com/panel/...` | Panel del profesional |
| `subilafoto.com/cliente/...` | Panel simplificado del cliente |

El código del invitado y el de la pantalla son **distintos**: quien saca una foto del QR
proyectado no debe poder abrir la consola de control.

## Lo que deliberadamente no se toca

- Sponsors, campañas y directorio público de proveedores (capítulo 33).
- Integración con CompraMeLaFoto para venta de fotos profesionales (capítulo 13).
- Reconocimiento facial. La cara ya se detecta en CLF, pero acá no hace falta y suma
  obligaciones de datos biométricos que no queremos abrir antes del lanzamiento.
