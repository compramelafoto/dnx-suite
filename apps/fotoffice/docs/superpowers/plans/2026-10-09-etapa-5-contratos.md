# Etapa 5 · Contratos — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- plantillas de contrato con variables;
- contratantes en el pedido;
- un contrato generado desde el pedido, que se congela al enviarse;
- firma en línea con código por correo y firma dibujada, con evidencia;
- un PDF sellado con hoja de constancia, enviado a todas las partes;
- recordatorios.

**Architecture:**
- **Datos:** tablas nuevas `Fotoffice*`.
- **Reutiliza:**
  - el motor de plantillas (`lib/plantillas/motor.ts`) con un contexto nuevo;
  - el patrón de enlace con token HMAC y la aceptación con evidencia del presupuesto;
  - R2 privado;
  - correos automáticos con topes;
  - crons;
  - numeración `CONTRATO`;
  - listado 0.2 y ficha 0.3.
- **PDF:** con `pdf-lib`, la misma versión que ya usa el monorepo (`1.17.1`).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-09-etapa-5-contratos-design.md`.

## Global Constraints

- **Rama y worktree:** rama `feat/fotoffice-etapa-5-contratos` desde `origin/main`, en el worktree `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-3`.
- **Dependencias:**
  - sólo `pdf-lib` en `apps/fotoffice/package.json`, con la versión exacta `1.17.1` que ya resuelve el lockfile;
  - verificar con `pnpm install --frozen-lockfile` después de actualizar el lockfile con `pnpm install`;
  - el lockfile sólo puede cambiar en el importador de fotoffice. Si cambia otra cosa, revertir y reportar.
- **Base de datos:**
  - una migración: `packages/db/prisma/migrations/20261027120000_fotoffice_etapa_5_contratos/migration.sql`;
  - sólo tablas nuevas;
  - se reemplaza el CHECK de `FotofficeMessageTemplate.entityType`, conservando `GENERAL`, `CLIENTE`, `SOCIO`, `CONSULTA`, `PRESUPUESTO`, `PEDIDO`, `PROYECTO` y `CITA`, y sumando `CONTRATO`;
  - sin líneas que no sean SQL;
  - no se aplica en la rama;
  - documento `packages/db/docs/MIGRACION-ETAPA-5-CONTRATOS.md`.
- **Tablas:**
  - `FotofficeContratoPlantilla`: workspaceId, name, body TEXT, isActive, order, timestamps; único `(workspaceId, name)`.
  - `FotofficePedidoContratante`: workspaceId, pedidoId (CASCADE), orden INT CHECK `IN (1,2)`, clientId (RESTRICT); único `(pedidoId, orden)`.
  - `FotofficeContrato`:
    - workspaceId, pedidoId (RESTRICT), clientId (RESTRICT), templateId? (SET NULL), number, name;
    - status CHECK `BORRADOR|ENVIADO|FIRMADO_PARCIAL|FIRMADO|RECHAZADO|ANULADO`;
    - bodyText, currentVersionId? (único);
    - sentAt?, signedAt?, rejectedAt?, voidedAt?, voidReason?;
    - pdfKey?, pdfHash?, pdfSentAt?;
    - manualSignedAt?, manualAttachmentId?;
    - ownerUserId?, createdByUserId?, timestamps.

    Único `(workspaceId, number)`.
  - `FotofficeContratoVersion`: workspaceId, contratoId (CASCADE), number, bodyText, contentHash TEXT (hex SHA-256), sentAt, revokedAt?; único `(contratoId, number)`.
  - `FotofficeContratoFirmante`:
    - workspaceId, versionId (CASCADE), orden, clientId? (SET NULL), name, docNumber?, email;
    - tokenHash (único), tokenExpiresAt;
    - viewedAt?;
    - codeHash?, codeExpiresAt?, codeAttempts INT default 0, codesSentInWindow INT default 0, codeWindowStart?, verifiedAt?;
    - typedName?, signatureKey?, signedAt?, ipHash?, userAgent?;
    - rejectedAt?, rejectReason?;
    - lastReminderAt?.
  - `FotofficeContratoEvento`: workspaceId, contratoId (CASCADE), type, firmanteId?, actorUserId?, data JSONB?, createdAt.
  - `FotofficeContratoAjustes`: workspaceId único, companySignatureKey?, companyName?, companyTaxId?, companyAddress?, consentClause TEXT?, reminderEnabled BOOLEAN default false, reminderDays INT default 3 (CHECK 1–30).
- **Firma:**
  - código de 6 dígitos guardado con hash (HMAC con el secreto de enlaces);
  - vale 15 minutos;
  - 5 intentos por código;
  - 3 códigos por hora por firmante;
  - freno por IP como el presupuesto;
  - firma dibujada: PNG ≤ 200 KB, no vacío, guardado en R2 privado bajo `contratos/<workspaceId>/<contratoId>/<firmanteId>.png`;
  - evidencia: ipHash (con sal, igual que en `aceptacion.ts`) y userAgent;
  - escritura condicional: una sola firma por firmante;
  - leyenda: "Firma electrónica conforme a la Ley 25.506. Este documento no tiene firma digital con certificado."
- **Huella:** SHA-256 en hex del `bodyText` final de la versión, en UTF-8, al enviar. El PDF tiene su propia huella.
- **Permisos:**
  - módulo `contracts` ("Contratos"): `AVAILABLE`, `route: "/contratos"`, `dependsOn: ["orders"]`;
  - Ver para leer, Gestionar para generar, editar, enviar, anular y marcar firmado en papel;
  - plantillas y ajustes con `configurar`.
- **Variables nuevas** (tipo de plantilla `CONTRATO`):
  - `[contratante1_nombre]`, `[contratante1_documento]`, `[contratante1_domicilio]`, `[contratante1_correo]`, `[contratante1_telefono]` y lo mismo para `contratante2`;
  - `[pedido_numero]`, `[pedido_total]`, `[pedido_items]`, `[pedido_cuotas]`;
  - `[evento]`, `[evento_fecha]`;
  - `[empresa_nombre]`, `[empresa_cuit]`, `[empresa_domicilio]`;
  - `[fecha_hoy]`, `[contrato_numero]`, `[salto_de_pagina]`.

  Las tablas se generan como texto tabulado para la vista y como tabla en el PDF.
- **Correos automáticos:**
  - `CONTRATO_ENVIO`: enlace del firmante con `[contrato_enlace]`;
  - `CONTRATO_CODIGO`: el código. **No se registra el código** en el historial ni en el registro;
  - `CONTRATO_RECORDATORIO`;
  - `CONTRATO_FIRMADO`: el PDF adjunto;
  - todos sin el freno de 24 h por dirección (son transaccionales) y con los topes diarios.
- **Textos:** español rioplatense; nunca decir "firma digital" para esto.
- **Verificación:**
  - vitest completo;
  - tsc de fotoffice con `NODE_OPTIONS=--max-old-space-size=8192`, mirando el código de salida y la salida;
  - si cambia el schema, tsc de las 4 apps y `prisma validate`/`generate`;
  - `next build --webpack` y después `rm -rf apps/fotoffice/.next`;
  - sin tsbuildinfo.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Tablas y cálculos puros
**Files:** schema, migración y su prueba de fuente; `lib/contratos/{constantes,formato,variables,codigo,huella}.ts` y sus pruebas.
- [ ] Modelos y SQL según las Global Constraints.
- [ ] `formato.ts`: convierte el texto con formato liviano en bloques (título, párrafo, negrita, salto de página, tabla), sin HTML de usuario.
- [ ] `variables.ts`: catálogo y armado del contexto de contrato desde datos ya leídos (pedido, contratantes, empresa, cuotas). Detecta las variables desconocidas.
- [ ] `codigo.ts`: genera, hashea y valida el código, con vencimiento, intentos y ventana.
- [ ] `huella.ts`: SHA-256.
- [ ] Commit `Contratos: tablas y cálculos (SQL sin aplicar)`.

### Task 2: Plantillas, contratantes y ajustes
**Files:**
- `lib/contratos/{acceso,contexto,plantillas,contratantes,ajustes,semillas}.ts` y sus pruebas;
- `app/workspace/configuracion/contratos/{page,plantillas}`, con la subida de la firma de la empresa a R2 privado;
- sección "Contratantes" en la ficha del pedido;
- módulo `contracts` en el registro, y en la portada si su prueba lo exige;
- tipo `CONTRATO` en `lib/plantillas`.
- [ ] Plantillas: CRUD y vista previa con un pedido de ejemplo.
- [ ] Contratantes: el 1 por omisión es el contacto del pedido; el 2 es opcional; se valida que sean del workspace.
- [ ] Ajustes con `configurar`.
- [ ] Semilla de DNX: una plantilla "Contrato de eventos (modelo)" con un texto base genérico y las variables, para que Daniel pegue el texto real.
- [ ] Commit `Contratos: plantillas, contratantes y ajustes`.

### Task 3: Contrato, versiones y envío
**Files:** `lib/contratos/{contratos,versiones,envio,enlace,eventos}.ts` y sus pruebas; `app/actions/contratos.ts`.
- [ ] Generar desde el pedido.
- [ ] Editar el borrador y "Actualizar datos".
- [ ] Enviar:
  - valida variables y correos;
  - asigna el número;
  - crea la versión con su huella;
  - crea los firmantes con token;
  - manda los correos con `after()`;
  - registra los eventos.
- [ ] Corregir crea una versión nueva y revoca la anterior.
- [ ] Anular con motivo.
- [ ] Marcar firmado en papel con un adjunto escaneado.
- [ ] Pruebas: aislamiento, permisos, estados, carreras, revocación.
- [ ] Commit `Contratos: generar, versionar y enviar`.

### Task 4: Página pública de firma
**Files:** `app/w/[workspaceSlug]/contrato/[token]/{page,actions,firma-canvas}`, `lib/contratos/{publico,firma}.ts` y sus pruebas.
- [ ] Mostrar el contrato con el patrón de la página del presupuesto (`noindex`, cabeceras, freno por IP, dominio propio).
- [ ] Flujo: nombre y "Leí y acepto", después pedir el código, después ingresarlo, después dibujar la firma y firmar. También "No estoy de acuerdo" con motivo.
- [ ] Canvas de firma con eventos de puntero; se manda como PNG en base64 y el servidor lo valida (tamaño, PNG válido, no vacío).
- [ ] Al firmar: guardar la evidencia y el PNG en R2, y recalcular el estado del contrato. Si están todos: `FIRMADO`, se tilda la tarea "Recoger firma del contrato" del checklist si existe, y se avisa al responsable.
- [ ] Pruebas:
  - token cruzado;
  - código vencido o equivocado;
  - límite de códigos;
  - firma duplicada;
  - versión revocada;
  - nunca se muestran datos de otros firmantes (salvo su nombre y estado).
- [ ] Commit `Contratos: firma en línea con código y firma dibujada`.

### Task 5: Pantallas internas
**Files:** `app/(shell)/contratos/{page,[id]}`, `components/contratos/*`, tarjetas en el pedido y el contacto, menú.
- [ ] Listado estándar: número, contacto, pedido, estado, enviado, firmado.
- [ ] Ficha: texto o versión, firmantes con su estado, historial, copiar y reenviar enlaces, anular, firmado en papel, descargar PDF (Task 6).
- [ ] Botón "Generar contrato" en el pedido.
- [ ] Commit `Contratos: listado, ficha y tarjetas`.

### Task 6: PDF sellado y recordatorios
**Files:**
- `lib/contratos/pdf.ts` con `pdf-lib`, y sus pruebas;
- envío del PDF;
- descarga autenticada en la ficha y con token en la página pública firmada;
- `app/api/cron/contratos-recordatorios` y `vercel.json` (diario 13:00 UTC);
- `packages/db/docs/MIGRACION-ETAPA-5-CONTRATOS.md`.
- [ ] PDF:
  - bloques del formato, con salto de página real;
  - firmas dibujadas y la de la empresa;
  - hoja de constancia;
  - fuente estándar Helvetica (WinAnsi cubre los acentos del español). Si hace falta un carácter fuera de WinAnsi, se reemplaza con un aviso.
- [ ] Se genera al pasar a `FIRMADO`, con `after()`, sin frenar la firma; también por cron si quedó pendiente.
- [ ] Recordatorios según los ajustes.
- [ ] Documento: tablas, checksum, verificación, vuelta atrás, encender el módulo, plantilla real de DNX, prueba en producción con un contrato firmado desde el celular.
- [ ] Commit `Contratos: PDF sellado, recordatorios y documento`.
