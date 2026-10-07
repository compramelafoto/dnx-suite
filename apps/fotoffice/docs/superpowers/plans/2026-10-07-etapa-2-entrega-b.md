# Etapa 2 · Entrega B (automatismos) — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Propuesta modelo por categoría (que el formulario web puede enviar sola), seguimiento automático de presupuestos a N días y variable `[lista_precios]`.

**Architecture:** Una tabla nueva, `FotofficePropuestaModelo`. El resto reutiliza lo que está en producción:
- presupuestos (entrega A): `crearPresupuesto`, `enviarPresupuesto`, `datosDeEnvio`, `FotofficePresupuestoAjustes.followUpDays` / `followUpEnabled`;
- plantillas y automáticos: topes, una vez por dirección cada 24 h, registro en `FotofficeMessage`;
- el alta única de consultas (`altaDeConsulta`, origen WEB).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-07-etapa-2-catalogo-y-presupuestos-design.md` (§2 B 13–15, §3.4).

## Global Constraints

- **Rama y worktree:** rama `feat/fotoffice-etapa-2-entrega-b` desde `origin/main`, en el worktree `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-2`.
- **Dependencias:** ninguna nueva.
- **Base de datos:**
  - Sólo la tabla `FotofficePropuestaModelo`: workspaceId, categoryId (único por workspace), items (JSON validado con `validarItem`, sólo modo `LISTA` **[decisión: un precio calculado depende del perfil privado; las propuestas modelo usan precio de lista]**), terms, autoSendOnWeb (bool, por omisión false), templateId (opcional), updatedAt, updatedByUserId.
  - Migración a mano `packages/db/prisma/migrations/20261021120000_fotoffice_etapa_2_propuesta_modelo/migration.sql`. **No se aplica** hasta la publicación (SQL antes del código).
  - Documento: sección "Entrega B" en `packages/db/docs/MIGRACION-ETAPA-2-PRESUPUESTOS.md`, sin staging.
- **Permisos:**
  - Configurar las propuestas modelo: `configurar`.
  - Los envíos automáticos los hace el sistema: actor "Sistema", sin rol.
- **Envíos automáticos al cliente:**
  - tope diario de los automáticos (50) y una vez por dirección cada 24 h;
  - registro en `FotofficeMessage` con `automatic=true`;
  - nunca lanzan error ni frenan el alta;
  - el registro sólo guarda códigos.
- **Orden después del alta WEB:**
  1. número;
  2. circuito;
  3. aviso al equipo;
  4. respuesta al cliente: la propuesta modelo si está activa para la categoría y la autorespuesta común está encendida; si no, la autorespuesta común.

  **[decisión: la propuesta modelo reemplaza a la autorespuesta común para esa consulta, nunca salen las dos]**
- **Seguimiento:**
  - una tarea programada diaria (Vercel cron, protegida con `CRON_SECRET` como las demás);
  - para cada organización con `followUpEnabled`, toma los presupuestos ENVIADO o VISTO cuyo último envío tiene `followUpDays` días o más, sin aceptar, rechazar ni vencer, y sin un seguimiento ya registrado para esa versión;
  - manda la plantilla del sistema `PRESUPUESTO_SEGUIMIENTO` por correo al contacto;
  - lo registra en el historial;
  - topes: los mismos de los automáticos, y como máximo 200 por corrida.
- **`[lista_precios]`:** texto con los productos "en lista de precios" (los de la categoría de la consulta si hay, si no todos), con su nombre y precio en ARS (es-AR). Disponible en las plantillas de CONSULTA y PRESUPUESTO.
- **Idioma, hora y verificación:** español rioplatense; hora de Buenos Aires. Verificación igual que en la entrega A: vitest, tsc de las 4 apps con 8 GB, build, borrar la caché; no commitear `tsbuildinfo`. Commits en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Tabla y propuestas modelo

**Files:** schema, migration.sql + prueba de fuente; `lib/presupuestos/propuestas-modelo.ts` + pruebas; pestaña "Propuestas modelo" en Configuración → Presupuestos.

- [ ] Modelo y SQL (sólo la tabla nueva). `prisma validate` y `generate`.
- [ ] Leer, guardar y borrar la propuesta modelo de una categoría del workspace:
  - ítems sólo del catálogo del workspace y en modo LISTA, con los topes de la entrega A;
  - condiciones;
  - plantilla de tipo PRESUPUESTO del workspace;
  - interruptor "Enviar sola al llegar una consulta web".
- [ ] Pantalla: lista de categorías con su propuesta (sí o no) y un editor de ítems simplificado que reutiliza los componentes del editor de la entrega A en modo lista.
- [ ] Pruebas y commit `Presupuestos: propuestas modelo por categoría (SQL sin aplicar)`.

### Task 2: Envío automático desde el formulario web

**Files:** `lib/presupuestos/propuesta-automatica.ts` + pruebas; enganche en `lib/consultas/alta.ts` (sólo WEB), en el paso de la respuesta al cliente.

- [ ] Si la categoría de la consulta tiene una propuesta modelo con `autoSendOnWeb`:
  - crear el presupuesto como el sistema, con esos ítems a precio de lista vigente (las instantáneas se arman en el momento);
  - responsable: el de los ajustes de Consultas, o el dueño;
  - enviarlo por correo con su plantilla y las mismas reglas de topes y de una vez por dirección.
- [ ] Si falla o se pasa el tope, se manda la autorespuesta común, sólo si está encendida, sin duplicar.
- [ ] Nunca bloquea el alta.
- [ ] Pruebas:
  - encendida contra apagada;
  - el tope;
  - una vez por dirección;
  - la falla cae a la autorespuesta;
  - el orden;
  - que no salgan dos respuestas.
- [ ] Commit `Presupuestos: la consulta web puede recibir su propuesta modelo sola`.

### Task 3: Seguimiento y `[lista_precios]`

**Files:** `lib/presupuestos/seguimiento.ts` + pruebas; `app/api/cron/presupuestos-seguimiento/route.ts` + `vercel.json` (cron diario, 13:00 UTC = 10:00 AR); plantilla del sistema `PRESUPUESTO_SEGUIMIENTO` (semilla y edición en Configuración → Plantillas → Automáticos); variable `[lista_precios]` en `lib/plantillas/variables.ts` y en el contexto.

- [ ] Seguimiento según las Global Constraints:
  - idempotente por versión (busca su mensaje ya registrado);
  - acotado por corrida;
  - registra un paso en el historial de la consulta.
- [ ] La ruta del cron: autenticación igual que las otras de FOTOFFICE, `maxDuration` y respuesta con contadores, sin datos personales.
- [ ] `[lista_precios]`.
- [ ] Pruebas y commit `Presupuestos: seguimiento automático y lista de precios`.

### Task 4: Documento y verificación

- [ ] Sección "Entrega B" en `MIGRACION-ETAPA-2-PRESUPUESTOS.md`:
  - tabla nueva y checksum;
  - el cron nuevo;
  - cómo encender el seguimiento (Configuración → Presupuestos);
  - prueba en producción.
- [ ] Verificación completa y commit `Presupuestos: documento de la entrega B`.
