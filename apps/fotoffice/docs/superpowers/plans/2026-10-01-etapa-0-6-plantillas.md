# Etapa 0.6 · Plantillas de mensajes — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plantillas de correo y WhatsApp por organización con variables en español, envío desde la ficha (Cliente, Socio, Consulta) con registro en la línea de tiempo y una respuesta automática a consultas nuevas del formulario público.

**Architecture:**
- Un motor puro (`lib/plantillas/motor.ts`) analiza el texto: variables `[clave]`, bloques `[si:clave]…[/si]` y `[campo:clave]`. Lo reemplaza con un contexto armado en lote desde la base (`contexto.ts`).
- El render (`render.ts`) produce HTML seguro para el correo y texto para WhatsApp.
- `envio.ts` manda por `sendTransactionalEmail` o arma el enlace `wa.me`. Registra cada mensaje en `FotofficeMessage`, que alimenta un proveedor nuevo de la línea de tiempo.

**Tech Stack:**
- Next.js 16 App Router; Prisma (`packages/db/prisma/schema.prisma`); Vitest 3 (node).
- Pruebas de comportamiento con la base en memoria `apps/fotoffice/lib/circuitos/base-en-memoria.ts`.
- Tailwind v4 `--fo-*`, lucide-react, pnpm. **Sin dependencias nuevas.**

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-01-etapa-0-6-plantillas-design.md`

## Global Constraints

- **Rama y worktree:** rama `feat/fotoffice-plantillas` desde `feat/fotoffice-campos-y-numeracion` (PR 294), en el worktree `~/Desktop/PROGRAMACIONES/dnx-fotoffice-plantillas`.
- **Dependencias:** pnpm; **ninguna dependencia nueva**.
- **Base de datos:**
  - Sólo dos tablas nuevas: `FotofficeMessageTemplate` y `FotofficeMessage`. Ninguna columna nueva en tablas existentes.
  - Migración a mano `packages/db/prisma/migrations/20261005120000_fotoffice_plantillas/migration.sql`. **No se aplica.**
  - Nada de `prisma migrate` / `db push` remotos; `prisma validate` / `generate` sí.
  - **Sin staging:** el documento de migración describe producción directa (pedido de Daniel del 01/10).
- **Aislamiento:**
  - `workspaceId` siempre de la sesión.
  - Un registro (cliente, socio, consulta) se valida contra el workspace antes de leer o escribir (`registroDelWorkspace` de `lib/campos/valores.ts`).
  - Ids ajenos → "no encontrado".
- **Permisos (`puede`):**
  - usar plantillas y enviar = `operar`;
  - configurar plantillas y automáticos = `configurar`.
- **Valores:**
  - Canales: `EMAIL`, `WHATSAPP`.
  - Tipos de ficha de plantilla: `GENERAL`, `CLIENTE`, `SOCIO`, `CONSULTA`.
  - Estados del registro: `SENT`, `FAILED`, `OPENED_WHATSAPP`.
  - Clave de automático: `CONSULTA_AUTORESPUESTA`.
- **Límites:**
  - nombre 1–80; asunto ≤ 200;
  - cuerpo ≤ 10.000 (correo) y ≤ 4.000 (WhatsApp);
  - 100 plantillas activas por canal;
  - 200 correos por día y organización (día de Buenos Aires).
- **Formato y envío:**
  - Texto plano. En el correo todo se escapa; los párrafos van por línea en blanco y sólo se vuelven clicables los enlaces `http(s)`.
  - `[firma]` se agrega al final del correo si falta; en WhatsApp nunca.
  - El correo va sólo a la dirección de la persona. Remitente: `FOTOFFICE_NOTIFICATIONS_FROM`, con el nombre de la organización como nombre visible y `replyTo` = correo de contacto de la organización.
  - Nunca se loguean datos personales: ni direcciones ni cuerpos, sólo códigos.
- **Idioma y hora:** textos en español rioplatense; Socios con el vocabulario del workspace; fechas en `America/Argentina/Buenos_Aires`.
- **Verificación:**
  - Pruebas: `pnpm --filter fotoffice exec vitest run <ruta>`.
  - tsc: `NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice exec tsc --noEmit`, mirando el código de salida **y** la salida.
  - Build igual. Borrar `apps/fotoffice/.next/cache` después de cada build.
  - No commitear `apps/*/tsconfig.tsbuildinfo`.
- **Commits y PR:** commits en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push hasta el final; sin merge nunca.

## Decisiones tomadas al planificar (rulings)

1. Spec y plan se decidieron sin consultar a Daniel, por su pedido explícito. Cada **[decisión]** del spec va listada en el PR.
2. **El catálogo de variables es código** (`variables.ts`), con una función de obtención por variable que lee de un contexto ya cargado en lote. Ninguna variable consulta la base por su cuenta.
3. **El registro de mensajes es una tabla propia**, no `SentEmailLog`: esa tabla no tiene workspace ni persona.
4. **La autorespuesta va en el mismo punto posterior al alta** donde 0.5 llama a `numerarConsultaNueva` (`app/actions/service-lead.ts`), después del número. Nunca lanza.

## Mapa de archivos

- **Base:** schema + `migrations/20261005120000_fotoffice_plantillas/migration.sql` + `packages/db/docs/MIGRACION-PLANTILLAS.md`.
- **`apps/fotoffice/lib/plantillas/`:** `constantes.ts`, `variables.ts` (puro), `motor.ts` (puro), `render.ts` (puro), `contexto.ts`, `definiciones.ts`, `semillas.ts`, `envio.ts`, `acceso.ts`, `automaticos.ts`; pruebas al lado.
- **Configuración:** `apps/fotoffice/app/workspace/configuracion/plantillas/{page.tsx,actions.ts,*.tsx}` + entradas en los tres menús de Configuración (como Campos).
- **Mensajes desde la ficha:**
  - `apps/fotoffice/app/actions/mensajes.ts`;
  - `apps/fotoffice/components/mensajes/{boton-mensaje.tsx,panel-mensaje.tsx,vista-previa.tsx}`;
  - `lib/ficha/proveedores/mensajes.ts` + `index.ts`;
  - fichas `app/(shell)/clientes/[clientId]`, `app/(shell)/members/[id]` y `app/(shell)/captacion/[id]`.

---

### Task 1: Tablas y migración

**Files:** schema, migration.sql, `apps/fotoffice/lib/plantillas/migracion.test.ts`.

- [ ] **Modelos** según spec §4.1.
  - `FotofficeMessageTemplate`:
    - índice (workspaceId, channel, archivedAt, order);
    - único parcial (workspaceId, systemKey) `WHERE "systemKey" IS NOT NULL`, sólo en el SQL;
    - CHECKs: `channel` en la lista; `entityType` en la lista; asunto no nulo si `EMAIL` y nulo si `WHATSAPP`.
  - `FotofficeMessage`:
    - índices (workspaceId, entityType, entityId, createdAt) y (workspaceId, channel, createdAt);
    - `templateId` FK `onDelete: SetNull`;
    - CHECK de `status` y de `channel`;
    - `body` en `Text`.
  - FKs a Workspace `onDelete: Cascade`, con relaciones inversas en `Workspace`.
- [ ] **SQL** con `prisma migrate diff` sin base, más el índice parcial y los CHECKs. Correr `prisma validate` y `generate`.
- [ ] **Prueba de fuente:** no altera tablas existentes; crea las dos tablas; tiene el índice parcial y los CHECKs.
- [ ] **tsc** de fotoffice, compramelafoto, clickaton y fotorank.
- [ ] **Commit** `Plantillas: tablas (SQL sin aplicar)`.

### Task 2: Catálogo de variables, motor y render (puros)

**Files:** `lib/plantillas/constantes.ts`, `variables.ts`, `motor.ts`, `render.ts` + pruebas.

**Produces:**
- **`constantes.ts`:** `CANALES`, `TIPOS_PLANTILLA`, `ESTADOS_MENSAJE`, `CLAVES_AUTOMATICO`, los límites y `TOPE_CORREOS_DIA = 200`.
- **`variables.ts`:**
  - `VARIABLES: { clave; etiqueta; descripcion; grupo; tipos: TipoPlantilla[]; obtener(ctx: ContextoVariables): string | null }[]`, según la tabla del spec §3.3.
  - `ContextoVariables = { persona: {nombreCompleto, email, telefono}; organizacion: {...}; usuario: {nombre, email}; hoy: Date; consulta?: {numero, tipo, fecha, lugar, mensaje, etapa}; socio?: {numero}; campos: Record<clave, string> }`.
  - `variablesPara(tipo, clavesDeCampos[])`.
  - Nombre de pila = primera palabra.
  - `[consulta_fecha]` y `[hoy]` en dd/mm/aaaa, hora de Buenos Aires.
- **`motor.ts`:**
  - `analizar(texto, permitidas: Set<string>): { ok: true; piezas } | { ok: false; errores: { posicion, mensaje }[] }`.
  - Reconoce `[clave]`, `[campo:clave]`, `[si:clave]` / `[si:campo:clave]` … `[/si]`. Los bloques no se anidan; un bloque sin cerrar o una variable desconocida da error.
  - Los corchetes que no forman una variable válida (por ejemplo `[nota al pie]`) son texto literal, no error.
  - `completar(piezas, valores: (clave) => string | null): { texto; vacias: string[] }`.
- **`render.ts`:**
  - `cuerpoCorreoHtml(texto, firmaHtml): string` escapa todo, arma un párrafo por línea en blanco, `<br>` por salto simple y enlaces `http(s)` con `rel="noopener noreferrer"`. Agrega la firma si el texto no contenía `[firma]`: se pasa una bandera desde `completar`.
  - `cuerpoCorreoTexto`.
  - `textoWhatsapp`.
  - Reutilizá el `escapeHtml` existente si hay uno exportable; si no, uno local.

- [ ] **Pruebas que fallan, después implementar, después pasan.** Casos:
  - cada variable;
  - nombre de pila;
  - bloques vacíos y llenos;
  - errores con posición;
  - corchetes literales;
  - XSS (`<script>`, `javascript:`);
  - enlaces;
  - firma agregada sólo una vez.
- [ ] **Commit** `Plantillas: catálogo de variables, motor y render`.

### Task 3: Definiciones, semillas y acceso

**Files:** `lib/plantillas/definiciones.ts`, `semillas.ts`, `acceso.ts` + pruebas.

**Produces:** todas reciben `ctx = { workspaceId, userId, userLabel, role }`, y las de escritura exigen `configurar` adentro.
- **Lectura:** `listarPlantillas(workspaceId, { canal, tipo?, incluirArchivadas? })`. Para un tipo de ficha devuelve las de ese tipo más las `GENERAL`, activas y ordenadas.
- **Escritura:**
  - `crearPlantilla`, `editarPlantilla`, `duplicarPlantilla`, `reordenarPlantillas`, `archivarPlantilla`, `desarchivarPlantilla`.
  - `borrarPlantilla`: sólo si no hay `FotofficeMessage` con ese `templateId`. Si no → "Esta plantilla ya se usó: archivala."
  - Valida con `analizar` contra `variablesPara(tipo, camposActivos)`, usando `listarCampos` de 0.5 para `CLIENTE`, `SOCIO` y `CONSULTA`.
  - Tope de 100 activas por canal.
- **Automático:** `leerAutomatico(workspaceId, clave)` y `guardarAutomatico(ctx, clave, { enabled, subject, body })`.
- **Semillas:** `asegurarPlantillasIniciales(workspaceId, slug)`.
  - DNX (`dnx-estudio`): las 7 plantillas y la autorespuesta **apagada** del spec §3.6. Los textos se escriben completos en el código, en rioplatense.
  - Las demás organizaciones: sólo la autorespuesta apagada, con un texto genérico.
  - Es idempotente: conteo simple fuera de la transacción y re-chequeo adentro, como `asegurarCamposIniciales`.
- **Acceso:** `contextoDePlantillas()`, con el patrón de `lib/campos/acceso.ts` (nunca redirige).

- [ ] **Pruebas** con la base en memoria:
  - aislamiento;
  - tope;
  - variable desconocida rechazada con su nombre;
  - borrar contra archivar;
  - semilla idempotente;
  - una `GENERAL` no acepta variables de consulta.
- [ ] **Commit** `Plantillas: definiciones, automáticos y plantillas iniciales de DNX`.

### Task 4: Contexto y envío

**Files:** `lib/plantillas/contexto.ts`, `envio.ts` + pruebas; `app/actions/mensajes.ts` + pruebas.

**Produces:**
- **`contextoDe(workspaceId, entityType, entityId, usuario)`:**
  - Arma un `ContextoVariables` real, o devuelve null si el registro no es del workspace.
  - Fuentes:
    - la persona, con `resolverPersonaPorCliente` / `resolverPersonaPorSocio` de `lib/ficha/persona.ts`, o la consulta directamente;
    - la organización, con `loadWorkspaceEmailContext`;
    - el número, con `numeroDe` de 0.5;
    - los campos, con `valoresDe` + `textoLegible` de 0.5;
    - la etapa actual de la consulta, del recorrido (0.4).
  - La firma va como HTML y como texto.
- **`prepararMensaje(...)`:** con la plantilla (o un texto libre), devuelve `{ asunto, cuerpo, vacias }` para el panel. No escribe.
- **`enviarCorreo(ctx, { entityType, entityId, templateId?, asunto, cuerpo, automatico? })`:**
  - Valida el registro, el correo de la persona y el tope diario (cuenta los `FotofficeMessage` `EMAIL` `SENT` del día de Buenos Aires).
  - El texto que llega ya viene completado y editado por quien envía: se vuelve a pasar por `analizar` sólo para rechazar marcadores sin reemplazar.
  - Arma el HTML, llama a `sendTransactionalEmail` (nunca lanza) con `replyTo` y registra `SENT` o `FAILED` con `errorCode`.
  - Devuelve el resultado.
- **`abrirWhatsapp(ctx, {...})`:** normaliza el número con `normalizeWhatsappNumber`, registra `OPENED_WHATSAPP` y devuelve la URL de `buildWhatsappUrl`.
- **Acciones** `"use server"`, sólo async:
  - `prepararMensajeAction`, `enviarCorreoAction`, `abrirWhatsappAction`.
  - Orden: forma → contexto → módulo del tipo encendido → `operar` → registro del workspace → plantilla del workspace, activa y del canal y tipo correctos.
  - Revalidan la ficha.

- [ ] **Pruebas:**
  - contexto aislado por workspace;
  - persona sin correo → error claro;
  - tope diario (199, 200 y 201);
  - falla de envío registrada como `FAILED` sin datos personales en logs;
  - WhatsApp registrado y URL correcta;
  - plantilla de otro workspace o archivada rechazada;
  - sin `operar` → sin permiso.
- [ ] **Commit** `Plantillas: contexto real, envío de correo y WhatsApp con registro`.

### Task 5: Configuración → Plantillas

**Files:** `app/workspace/configuracion/plantillas/*` y las entradas en los menús.

- [ ] **Pestañas** Correo / WhatsApp / Automáticos.
- [ ] **Lista** con nombre, para qué ficha (Socios con vocabulario; Consulta sólo con Captación encendida), y las acciones subir/bajar, duplicar, archivar/desarchivar y borrar (sólo si no se usó).
- [ ] **Editor:**
  - nombre, asunto (correo), cuerpo y tipo de ficha;
  - lista de variables disponibles que se insertan en el cursor;
  - vista previa en vivo con datos de ejemplo (client, usando sólo `motor`, `render` y `variables` puros);
  - errores del servidor con posición.
- [ ] **Automáticos:** interruptor, asunto y cuerpo de "Respuesta automática a una consulta nueva".
- [ ] Llamar `asegurarPlantillasIniciales` al abrir.
- [ ] Exigir `configurar` antes de leer.
- [ ] **Pruebas de fuente:** permiso antes de leer; acciones sólo async; componentes cliente sin `@repo/db`. Más pruebas de las acciones.
- [ ] **Build.**
- [ ] **Commit** `Configuración: plantillas de mensajes`.

### Task 6: "Mensaje" en las fichas y registro en la línea de tiempo

**Files:** `components/mensajes/*`, `lib/ficha/proveedores/mensajes.ts` + `index.ts`, las tres fichas.

- [ ] **Botón "Mensaje"** (Correo / WhatsApp) en la ficha de Cliente, Socio y Consulta, visible sólo con `operar`.
  - Sin correo, o sin teléfono, la opción aparece deshabilitada con el motivo.
- [ ] **Panel (client):**
  - elegir plantilla (del canal, para esa ficha más las `GENERAL`) o "Sin plantilla";
  - `prepararMensajeAction` completa asunto y cuerpo;
  - las variables vacías se marcan;
  - el texto es editable.
  - **Enviar** (correo): muestra el resultado o el error.
  - **Abrir WhatsApp:** abre la URL devuelta en otra pestaña.
- [ ] **Proveedor `mensajes`** en la línea de tiempo de Cliente y Socio:
  - acotado por workspace y por los ids de la persona;
  - cada lado (cliente o socio) sólo con su módulo encendido;
  - tipo "Mensajes";
  - cuerpo recortado con "ver completo";
  - estado legible: "Enviado", "Falló", "Abierto en WhatsApp", "Automático".
- [ ] **Ficha de Consulta:** los mensajes se intercalan por fecha en su historial, junto con los cambios de 0.5.
- [ ] **Pruebas:** proveedor acotado; guarda antes de leer; componentes cliente sin `@repo/db`.
- [ ] **Build.**
- [ ] **Commit** `Fichas: enviar mensajes con plantillas y verlos en la línea de tiempo`.

### Task 7: Respuesta automática, documento y verificación

**Files:** `lib/plantillas/automaticos.ts` + pruebas, `app/actions/service-lead.ts`, `packages/db/docs/MIGRACION-PLANTILLAS.md`.

- [ ] **`responderConsultaNueva(workspaceId, leadId)`:** nunca lanza.
  - Si la autorespuesta está encendida, la consulta tiene correo y no se pasó el tope, completa la plantilla con `contextoDe` y envía como `automatico: true`.
  - Si no, no hace nada.
  - Se llama en `service-lead.ts` después de `numerarConsultaNueva`, sólo en el camino del formulario público: **no** desde la inscripción presencial ni desde altas manuales.
- [ ] **Pruebas:**
  - apagada → no envía;
  - encendida → envía y registra;
  - un fallo no rompe el alta;
  - un alta sin correo → nada;
  - el número ya está disponible en el texto.
- [ ] **Documento `MIGRACION-PLANTILLAS.md`:** con la estructura de `MIGRACION-CAMPOS-Y-NUMERACION.md`, pero **sin staging**:
  - qué hace;
  - en negrita, qué pantallas leen las tablas;
  - orden: PR 277→294 fusionados, SQL en producción, fusionar;
  - checksum;
  - verificación de sólo lectura;
  - vuelta atrás;
  - prueba manual en producción, con un correo a una ficha propia de Daniel, un WhatsApp a su número y la autorespuesta con una consulta de prueba.
- [ ] **Verificación completa:**
  - vitest de fotoffice;
  - tsc de fotoffice, compramelafoto, clickaton y fotorank;
  - build de fotoffice, y borrar `.next/cache`.
- [ ] **Commit** `Plantillas: respuesta automática y documento de migración`.
