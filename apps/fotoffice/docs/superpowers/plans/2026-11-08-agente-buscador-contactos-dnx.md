# Contactos DNX + agente Buscador Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una base única de prospectos («Contactos DNX») en FOTOFFICE, con panel de super admin, que un agente Buscador llena región por región con Google Places (sólo descubrir) + Claude con búsqueda web, sin duplicados, con topes de gasto y resumen por Telegram.

**Architecture:** Tablas nuevas `Dnx*` en la base de FOTOFFICE. Lógica en `apps/fotoffice/lib/agentes/buscador/` (funciones puras + funciones con `deps` inyectables, como el Periodista). Un cron cada 15 min procesa una cola de tareas con presupuesto de tiempo. El panel vive en `/admin/contactos-dnx`. CLF expone una ruta interna nueva, protegida con un secreto, para saber si un email o teléfono ya es usuario.

**Tech Stack:** Next.js (leer `node_modules/next/dist/docs/` antes de tocar rutas o server actions: hay cambios incompatibles), Prisma + Postgres (Neon), vitest con `lib/circuitos/base-en-memoria`, Anthropic SDK vía `@repo/dnx-bot`, Google Places API (New) por `fetch`, Telegram por `lib/agentes/canal.ts`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-11-08-agente-buscador-contactos-dnx-design.md` (leerla entera antes de empezar).

## Global Constraints

- Topes por mes: Google **USD 20** (frena al llegar a **USD 18**); Claude **USD 30** (frena al llegar a **USD 28**). Los dos se pueden editar en el panel. El mes se cuenta en **hora argentina** (`inicioDelMesArgentino` de `lib/agentes/periodista/horario.ts`).
- De Google Places **sólo se guarda `googlePlaceId`**. Ningún `DnxContactoDato` tiene fuente `GOOGLE_PLACES`.
- Sólo se guardan datos de contacto comerciales y publicados, cada uno con la URL de su fuente. Nunca datos inventados por el modelo.
- `NO_CONTACTAR` es permanente: ningún proceso automático lo cambia.
- Los prospectos **no** se escriben en `Client` ni se sincronizan con Google Contacts.
- Una tarea se reintenta como máximo 3 veces; después queda `FALLO`.
- Places: 1 página de resultados por consulta; hasta 3 en capitales y Gran Rosario.
- Regiones en este orden: `CENTRO`, `BUENOS_AIRES_AMBA`, `CUYO`, `NOA`, `NEA`, `PATAGONIA`. Cuando una región se completa, la siguiente arranca sola.
- Una región se cierra sólo cuando no le quedan tareas `PENDIENTE` de ninguna fuente.
- Workspace de DNX Estudio: `cmv5z6qxwwmmhf0q5gp8qja1j`.
- Modelo de Claude: `claude-sonnet-5-5`, herramienta `web_search_20260209`.
- Textos para Daniel en español rioplatense; decir «dinero», nunca «plata».
- Secretos (`GOOGLE_PLACES_API_KEY`, `CLF_CONSULTA_USUARIOS_SECRET`) los carga Daniel en Vercel; nunca van en el código, el chat ni `launch.json`.
- Migración escrita a mano, con timestamp **posterior al último de `main` al momento de fusionar** (hoy el último es `20270131090000`). Se aplica en Neon `divine-hall-10689679` / `br-old-rain-adwthzng` y se registra en `_prisma_migrations` con su sha256.
- En la Mac, `tsc` de FOTOFFICE se queda sin memoria: chequear tipos con un tsconfig acotado a los archivos tocados, o dejar que lo valide el CI (`tipos-y-pruebas`). No fusionar hasta que el CI esté verde (`gh pr merge --auto` fusiona al instante porque main no exige controles).

## Review Focus

1. **Correo compartido o de relleno** (`info@gmail.com`, el correo de una federación que usan todos los clubes) que fusionaría contactos distintos → no tiene que emparejar. Prueba en la Tarea 2.
2. **Teléfono de una central o call center** repetido en muchos lugares de Maps → no tiene que fusionarlos. Prueba en la Tarea 3 (un mismo teléfono en ≥3 contactos de ciudades distintas deja de servir como llave).
3. **El cron se superpone consigo mismo** (una corrida tarda más de 15 min, o «Correr ahora» coincide con el cron) → la misma tarea no se procesa dos veces. Prueba en la Tarea 10 (la tarea se toma con un update condicional de `PENDIENTE` a `EN_CURSO`).
4. **El cambio de mes en medio de una corrida** → el gasto de la llamada cuenta en el mes en que se hizo y el freno se levanta al empezar el mes nuevo. Prueba en la Tarea 6.
5. **Claude devuelve el candidato con el email de la web de otro negocio** (el email de un directorio que lista a muchos) → el email no se guarda si su dominio no coincide con la web del contacto y no es un proveedor genérico. Prueba en la Tarea 8.

---

## Estructura de archivos

Todo bajo `apps/fotoffice/` salvo que se indique otra cosa.

| Archivo | Responsabilidad |
|---|---|
| `packages/db/prisma/schema.prisma` (raíz del repo) | Modelos `DnxContacto`, `DnxContactoDato`, `DnxContactoEvento`, `DnxBuscadorTarea`, `DnxBuscadorRegion` |
| `packages/db/prisma/migrations/<ts>_dnx_contactos_buscador/migration.sql` | SQL a mano |
| `lib/circuitos/base-en-memoria.ts` | Registrar las 5 tablas nuevas y sus defectos |
| `lib/agentes/buscador/tipos.ts` | Constantes de tipos, nichos, regiones, estados, fuentes |
| `lib/agentes/buscador/normalizar.ts` | Claves de emparejamiento (puras) |
| `lib/agentes/buscador/contactos.ts` | `guardarCandidato`, eventos, cambios de estado, fusión |
| `lib/agentes/buscador/carga-inicial.ts` | Importar los 37 fotógrafos conocidos |
| `lib/agentes/claude.ts` | Conversación con Claude extraída del Periodista (compartida) |
| `lib/agentes/buscador/ciudades.ts` | Provincias y ciudades por región, capitales marcadas |
| `lib/agentes/buscador/consultas.ts` | Frases de búsqueda por tipo y nicho, y generación de tareas |
| `lib/agentes/buscador/gasto.ts` | Precios, gasto del mes, topes y ajustes |
| `lib/agentes/buscador/places.ts` | Cliente de Google Places (Text Search) |
| `lib/agentes/buscador/web.ts` | Claude: descubrir por provincia y leer la web de un lugar; validación de candidatos |
| `lib/agentes/buscador/clf.ts` | Consulta de usuarios a CLF |
| `lib/agentes/buscador/motor.ts` | Procesar tareas, cerrar regiones, avisos por Telegram |
| `app/api/cron/agente-buscador/route.ts` | Cron |
| `vercel.json` | Agregar el cron |
| `app/(shell)/admin/contactos-dnx/{page.tsx,[id]/page.tsx,actions.ts,*.tsx}` | Panel |
| `app/(shell)/admin/agentes/page.tsx` | Tarjeta del Buscador con enlace al panel |
| `apps/compramelafoto/app/api/internal/usuarios/existentes/route.ts` | Ruta de CLF |
| `apps/compramelafoto/lib/usuarios-existentes.ts` | Lógica de esa ruta |
| `docs/superpowers/puesta-en-marcha/2026-11-08-buscador.md` | Pasos de GCP y Vercel para Daniel |

---

### Task 1: Tablas y base en memoria

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (al final, junto a `FotofficeAgentePropuesta`)
- Create: `packages/db/prisma/migrations/20270201090000_dnx_contactos_buscador/migration.sql` (subir el timestamp si `main` ya tiene uno igual o posterior)
- Modify: `apps/fotoffice/lib/circuitos/base-en-memoria.ts` (`TABLAS` y `DEFECTOS`)
- Create: `apps/fotoffice/lib/agentes/buscador/tipos.ts`
- Test: `apps/fotoffice/lib/agentes/buscador/tipos.test.ts`

**Interfaces:**
- Produces (Prisma delegates): `prisma.dnxContacto`, `prisma.dnxContactoDato`, `prisma.dnxContactoEvento`, `prisma.dnxBuscadorTarea`, `prisma.dnxBuscadorRegion`.
- Produces (`tipos.ts`):
  - `TIPOS_CONTACTO = ["FOTOGRAFO","ESCUELA","CLUB","ORGANIZADOR_EVENTOS","ASOCIACION_FOTOGRAFOS","ORGANIZADOR_MUESTRAS","EMPRESA_TURISMO","NEGOCIO_FOTOGRAFIA","OTRO"] as const`
  - `NICHOS = ["ESCOLAR","DEPORTIVA","TURISTICA","SOCIAL","EVENTOS","FOTO_CARNET","CORPORATIVA","MASCOTAS_NEWBORN_FAMILIA"] as const`, más `OTRO:<texto>` como valor libre
  - `NICHOS_PRIORITARIOS = ["ESCOLAR","TURISTICA","DEPORTIVA"]`
  - `REGIONES` (el orden de Global Constraints)
  - `ESTADOS_CONTACTO = ["NUEVO","REVISADO","CONTACTADO","RESPONDIO","SE_SUMO","NO_INTERESA","DESCARTADO","NO_CONTACTAR"]`
  - `FUENTES_DATO = ["SITIO_PROPIO","WEB_SEARCH","ALBOOM","MANUAL","CLF"]`
  - `PLATAFORMAS = ["CLF","INFOSPOT","MUESTRAS","FOTOFFICE"]`
  - `plataformasPorTipo(tipo): Plataforma[]`
  - types `TipoContacto`, `Nicho`, `Region`, `EstadoContacto`, `FuenteDato`, `Plataforma`

**Modelos** (TEXT con CHECK para los conjuntos; `text[]` para `nichos` y `plataformas`; ids `cuid()`):
- `DnxContacto`: `id, tipo, nichos text[], plataformas text[], nombre, ciudad?, provincia?, region?, lat?, lng?, web?, instagram?, facebook?, email?, telefono?, whatsapp?, googlePlaceId? @unique, estado @default("NUEVO"), vinculo? ("CONOCIDO_DNX_ESTUDIO"|"USUARIO_CLF"), vinculoId?, compradorClf Boolean @default(false), creadoPor, creadoEn, actualizadoEn @updatedAt, fusionadoEnId?`
  - Columnas de clave: `claveDominio?, claveInstagram?, claveEmail?, claveTelefono?, claveNombreCiudad?`, cada una con su índice.
- `DnxContactoDato`: `id, contactoId (cascade), campo, valor, fuente, fuenteUrl?, vistoEn`. Índice `(contactoId, campo)`.
- `DnxContactoEvento`: `id, contactoId (cascade), tipo, datos Json?, autor, creadoEn`. Índice `(contactoId, creadoEn)`.
  - `tipo`: `CREADO|DATO_NUEVO|ESTADO|NOTA|FUSIONADO|VINCULADO|CORREO_ENVIADO|CORREO_RECIBIDO`.
- `DnxBuscadorTarea`: `id, region, provincia, ciudad?, tipo, nicho?, fuente ("GOOGLE_PLACES"|"WEB_SEARCH"), consulta, paginas Int @default(1), estado @default("PENDIENTE") ("PENDIENTE"|"EN_CURSO"|"HECHA"|"FALLO"|"SALTEADA"), intentos Int @default(0), resultado Json?, costoGoogleUsdMicros Int @default(0), costoClaudeUsdMicros Int @default(0), tomadaEn?, hechaEn?, prioridad Int`.
  - `@@unique([region, provincia, ciudad, tipo, nicho, fuente])`. Hacerlo con `NULLS NOT DISTINCT` en el SQL, porque `ciudad` y `nicho` pueden ser null.
  - `@@index([region, estado, prioridad])`.
- `DnxBuscadorRegion`: `region @id, orden Int, estado ("EN_ESPERA"|"EN_CURSO"|"COMPLETA"|"PAUSADA"), iniciadaEn?, completadaEn?, resumenEnviadoEn?`.

- [ ] **Step 1: Test de `plataformasPorTipo` en `tipos.test.ts`**
  - `FOTOGRAFO` → `["CLF","FOTOFFICE"]`
  - `ESCUELA` → `["CLF"]`
  - `CLUB` → `["CLF","INFOSPOT"]`
  - `ORGANIZADOR_EVENTOS` → `["INFOSPOT","CLF"]`
  - `ORGANIZADOR_MUESTRAS` → `["MUESTRAS"]`
  - `ASOCIACION_FOTOGRAFOS` → `["CLF","MUESTRAS","FOTOFFICE"]`
  - `EMPRESA_TURISMO` → `["CLF"]`
  - `NEGOCIO_FOTOGRAFIA` → `["CLF","FOTOFFICE"]`
  - `OTRO` → `[]`
- [ ] **Step 2:** `pnpm vitest run lib/agentes/buscador/tipos.test.ts` → FAIL (no existe el módulo).
- [ ] **Step 3:** Escribir `tipos.ts`, los modelos Prisma y el SQL de la migración. El SQL tiene: las tablas, los CHECK de cada conjunto, los índices y el `UNIQUE NULLS NOT DISTINCT` de tareas.
  - Insertar las 6 filas de `DnxBuscadorRegion` con `orden` 1–6, todas `EN_ESPERA`.
  - Registrar las 5 tablas en `TABLAS` de `base-en-memoria.ts`, con defectos que reflejen los `@default`.
- [ ] **Step 4:** `pnpm vitest run lib/agentes/buscador/tipos.test.ts` → PASS. `pnpm prisma validate --schema ../../packages/db/prisma/schema.prisma` → sin errores.
- [ ] **Step 5:** Aplicar el SQL en `development` y registrar la migración en `_prisma_migrations` con `sha256` del archivo. Antes, verificar que ninguna tabla `Dnx*` exista.
- [ ] **Step 6: Commit** — `git commit -m "Contactos DNX: tablas del Buscador"`

---

### Task 2: Claves de emparejamiento

**Files:**
- Create: `apps/fotoffice/lib/agentes/buscador/normalizar.ts`
- Test: `apps/fotoffice/lib/agentes/buscador/normalizar.test.ts`

**Interfaces:**
- Produces:
  - `claveDominio(web: string | null): string | null`: dominio sin `www.`. Devuelve null para redes y plataformas genéricas: instagram, facebook, linktr.ee, wa.me, google, sites.google.com, wixsite, blogspot, mercadolibre.
  - `claveInstagram(texto: string | null): string | null`: usuario en minúsculas, desde URL o `@usuario`.
  - `claveEmail(email: string | null): string | null`: minúsculas. Devuelve null si es inválido o de relleno; reutilizar las reglas de `lib/alboom/carga/normalizar.ts` si se pueden importar.
  - `claveTelefono(tel: string | null): string | null`: E.164 argentino `+54` + área + número, sin el 9 de celular ni el 15. Null si no tiene entre 10 y 11 dígitos nacionales.
  - `claveNombreCiudad(nombre: string, ciudad: string | null): string | null`: sin acentos ni mayúsculas ni signos. Saca palabras genéricas (`fotografia, fotografo, foto, estudio, studio, ph, photo`) sólo si queda al menos una palabra. Concatena con la ciudad normalizada. Null sin ciudad.
  - `clavesDe(c: { web?, instagram?, email?, telefono?, nombre, ciudad? }): ClavesContacto`
  - `type ClavesContacto = { claveDominio; claveInstagram; claveEmail; claveTelefono; claveNombreCiudad }`

- [ ] **Step 1: Tests**
  - `claveDominio("https://www.estudioluz.com.ar/contacto")` → `"estudioluz.com.ar"`
  - `claveDominio("https://instagram.com/x")` → `null`
  - `claveInstagram("https://www.instagram.com/Estudio.Luz/?hl=es")` → `"estudio.luz"`
  - `claveInstagram("@estudio.luz")` → `"estudio.luz"`
  - `claveTelefono("0341 15-555-1234")` → `"+543415551234"`
  - `claveTelefono("+54 9 341 555 1234")` → `"+543415551234"`
  - `claveTelefono("123")` → `null`
  - `claveEmail("INFO@EstudioLuz.com.ar")` → `"info@estudioluz.com.ar"`
  - `claveEmail("no@tiene.com")` → `null` (relleno)
  - `claveNombreCiudad("Estudio Fotográfico Luz", "Rosario")` → `"luz|rosario"`
  - `claveNombreCiudad("Fotografía", "Rosario")` → `"fotografia|rosario"` (no queda vacío)
- [ ] **Step 2:** `pnpm vitest run lib/agentes/buscador/normalizar.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `normalizar.ts`.
- [ ] **Step 4:** Mismo comando → PASS.
- [ ] **Step 5: Commit** — `"Contactos DNX: claves de emparejamiento"`

---

### Task 3: Guardar candidatos (emparejamiento, fusión, historial)

**Files:**
- Create: `apps/fotoffice/lib/agentes/buscador/contactos.ts`
- Test: `apps/fotoffice/lib/agentes/buscador/contactos.test.ts`

**Interfaces:**
- Consumes: Task 1 (tablas, tipos) y Task 2 (`clavesDe`).
- Produces:
  - `type DatoConFuente = { valor: string; fuente: FuenteDato; fuenteUrl: string | null }`
  - `type Candidato = { tipo: TipoContacto; nichos: string[]; nombre: string; ciudad: string | null; provincia: string | null; region: Region | null; googlePlaceId?: string | null; lat?: number | null; lng?: number | null; datos: Partial<Record<"web"|"instagram"|"facebook"|"email"|"telefono"|"whatsapp", DatoConFuente>>; creadoPor: "BUSCADOR"|"MUESTRAS"|"RADAR"|"CARGA_INICIAL"|"MANUAL" }`
  - `guardarCandidato(c: Candidato, deps?: { ahora?: () => Date }): Promise<{ contactoId: string; nuevo: boolean; datosNuevos: number }>`
  - `buscarExistente(claves: ClavesContacto, googlePlaceId: string | null): Promise<string | null>`: orden placeId → dominio → instagram → email → teléfono → nombre+ciudad. Un teléfono presente en ≥3 contactos de ciudades distintas no cuenta como llave.
  - `cambiarEstado(id: string, estado: EstadoContacto, autor: string): Promise<{ ok: boolean; motivo?: string }>`: rechaza salir de `NO_CONTACTAR` salvo con `autor` de usuario y `forzar: true`.
  - `agregarNota(id: string, texto: string, autor: string): Promise<void>`
  - `editarDato(id: string, campo, valor: string | null, autor: string): Promise<void>`: fuente `MANUAL`.
  - `fusionar(origenId: string, destinoId: string, autor: string): Promise<void>`: mueve datos y eventos, deja `fusionadoEnId` en el origen y le pone estado `DESCARTADO`, y crea evento `FUSIONADO` en ambos.
  - `vincularDnxEstudio(contactoId: string): Promise<boolean>`: busca `Client` en el workspace de DNX Estudio por email o teléfono normalizado. Si lo encuentra, setea `vinculo: "CONOCIDO_DNX_ESTUDIO"` y `vinculoId`, y crea evento `VINCULADO`.

**Reglas de `guardarCandidato`:**
- **Si existe:** completa sólo los campos vacíos del contacto. Agrega `DnxContactoDato` por cada valor nuevo (también si difiere del actual, sin pisarlo) con evento `DATO_NUEVO`, y suma nichos y plataformas. No toca `estado`.
- **Si no existe:** crea con `plataformas = plataformasPorTipo(tipo)` y evento `CREADO` con `{ creadoPor }`, y después llama `vincularDnxEstudio`.
- Rechaza (lanza) cualquier dato con fuente `GOOGLE_PLACES`, aunque el tipo no lo permita en tiempo de ejecución.

- [ ] **Step 1: Tests** (base en memoria + `client` sembrado en el workspace DNX):
  - `"crea un contacto nuevo con su dato y fuente"` → 1 `dnxContacto`, 1 `dnxContactoDato` con `fuenteUrl`, evento `CREADO`.
  - `"el mismo dominio web suma datos en vez de duplicar"` → segundo candidato con otro nombre pero misma web → 1 contacto, `datosNuevos: 1`.
  - `"el mismo instagram empareja"`.
  - `"el mismo googlePlaceId empareja aunque cambie el nombre"`.
  - `"no pisa un email existente distinto; lo guarda como dato adicional"`.
  - `"un teléfono repetido en 3 ciudades no fusiona"` → 3 contactos con el mismo teléfono y distinta ciudad, más un cuarto con ese teléfono → contacto nuevo.
  - `"un contacto NO_CONTACTAR que reaparece sigue NO_CONTACTAR"`.
  - `"cambiarEstado no saca de NO_CONTACTAR sin forzar"`.
  - `"vincula con un cliente de DNX Estudio por email"` → `vinculo: "CONOCIDO_DNX_ESTUDIO"`.
  - `"fusionar mueve datos y deja el origen DESCARTADO"`.
- [ ] **Step 2:** `pnpm vitest run lib/agentes/buscador/contactos.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `contactos.ts`. Cada `guardarCandidato` va en una `prisma.$transaction`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** — `"Contactos DNX: guardar, emparejar y fusionar"`

---

### Task 4: Carga inicial de conocidos

**Files:**
- Create: `apps/fotoffice/lib/agentes/buscador/carga-inicial.ts`
- Test: `apps/fotoffice/lib/agentes/buscador/carga-inicial.test.ts`

**Interfaces:**
- Consumes: `guardarCandidato`, `cambiarEstado` (Task 3).
- Produces: `importarConocidos(): Promise<{ importados: number; yaEstaban: number }>`. Toma los `Client` del workspace DNX que tienen asignada la etiqueta con `nameKey = "fotografo"` (`FotofficeTagAssignment` → `FotofficeTag`).
  - Cada uno entra como `tipo: "FOTOGRAFO"`, `creadoPor: "CARGA_INICIAL"`, datos con fuente `ALBOOM`, `vinculo: "CONOCIDO_DNX_ESTUDIO"` (`vinculoId` = clientId), estado `REVISADO`.

- [ ] **Step 1: Tests:**
  - `"importa los clientes con etiqueta Fotógrafo"` → con 2 etiquetados y 1 sin etiqueta, `{ importados: 2 }`, ambos `REVISADO` y vinculados.
  - `"correrlo dos veces no duplica"` → la segunda vez devuelve `{ importados: 0, yaEstaban: 2 }`.
- [ ] **Step 2:** `pnpm vitest run lib/agentes/buscador/carga-inicial.test.ts` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** — `"Contactos DNX: importar fotógrafos conocidos"`

---

### Task 5: Panel «Contactos DNX» (lista, ficha, acciones)

**Files:**
- Create: `apps/fotoffice/app/(shell)/admin/contactos-dnx/page.tsx`
- Create: `apps/fotoffice/app/(shell)/admin/contactos-dnx/[id]/page.tsx`
- Create: `apps/fotoffice/app/(shell)/admin/contactos-dnx/actions.ts`
- Create: `apps/fotoffice/app/(shell)/admin/contactos-dnx/acciones-contacto.tsx` (cliente)
- Create: `apps/fotoffice/app/api/admin/contactos-dnx/csv/route.ts`
- Create: `apps/fotoffice/lib/agentes/buscador/consultas-panel.ts`
- Test: `apps/fotoffice/lib/agentes/buscador/consultas-panel.test.ts`

**Interfaces:**
- Consumes: Task 3 (`cambiarEstado`, `agregarNota`, `editarDato`, `fusionar`) y Task 4 (`importarConocidos`).
- Produces:
  - `type FiltrosContactos = { tipo?; nicho?; region?; provincia?; estado?; vinculo?: "CONOCIDO_DNX_ESTUDIO"|"USUARIO_CLF"|"NINGUNO"; conEmail?: boolean; texto?: string; pagina?: number }`
  - `listarContactos(f: FiltrosContactos): Promise<{ filas: FilaContacto[]; total: number }>`: 50 por página, orden `creadoEn desc`. Excluye fusionados (`fusionadoEnId` no null).
  - `fichaContacto(id): Promise<{ contacto; datos: DnxContactoDato[]; eventos: DnxContactoEvento[] } | null>`
  - `csvContactos(f): Promise<string>`: mismas columnas que la lista, separador `;`, BOM UTF-8.
- **Acceso:** igual que `/admin/agentes`. El layout de `/admin` ya exige SUPER_ADMIN. La ruta CSV verifica la sesión y el rol explícitamente, porque está fuera del layout.
- **Lista:**
  - Columnas: nombre, tipo, nichos, ciudad/provincia, región, íconos de datos, estado, vínculo, fecha.
  - Filtros por querystring, búsqueda por texto (nombre, ciudad, email, instagram) y botón «Exportar CSV».
  - Botón «Importar conocidos» → `importarConocidos`.
  - Mientras la Tarea 11 no existe, la cabecera del Buscador queda vacía.
- **Ficha:**
  - Datos con enlace a su `fuenteUrl`, edición por campo, selector de estado y «No contactar» con confirmación.
  - Notas, «Fusionar con…» (por id o búsqueda) y línea de tiempo de eventos.
  - Muestra «Compró en CLF» si `compradorClf`.
- Leer `node_modules/next/dist/docs/` sobre server actions y `searchParams` antes de escribir las páginas. No probar server actions a ciegas: verificar en el navegador con `preview_start`.

- [ ] **Step 1: Tests de `consultas-panel.ts`:**
  - `"filtra por tipo, región y conEmail"`.
  - `"busca por texto en nombre e instagram"`.
  - `"no lista los fusionados"`.
  - `"el CSV escapa ; y comillas y lleva BOM"` → una fila con nombre `Luz; "Estudio"` sale entre comillas con las comillas duplicadas.
- [ ] **Step 2:** `pnpm vitest run lib/agentes/buscador/consultas-panel.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `consultas-panel.ts`, las páginas, las acciones y la ruta CSV.
- [ ] **Step 4:** Tests → PASS. Levantar FOTOFFICE con `preview_start` y verificar en el navegador:
  - lista vacía;
  - «Importar conocidos» → aparecen;
  - abrir una ficha, agregar nota, cambiar estado y verlo en la línea de tiempo;
  - el CSV se descarga.
- [ ] **Step 5: Commit** — `"Contactos DNX: panel de super admin"`

> **Corte sugerido de PR:** las Tareas 1–5 pueden salir como **PR 1** (base + panel + carga inicial). Con el CI verde se fusiona, se aplica y se prueba en producción con los conocidos.

---

### Task 6: Gasto y topes

**Files:**
- Create: `apps/fotoffice/lib/agentes/buscador/gasto.ts`
- Test: `apps/fotoffice/lib/agentes/buscador/gasto.test.ts`

**Interfaces:**
- Produces:
  - `type AjustesBuscador = { topeGoogleUsd: number; topeClaudeUsd: number; pausado: boolean; avisoTope: { GOOGLE?: string; CLAUDE?: string } }`, guardado en `SystemSettings` con la clave `fotoffice_buscador_ajustes`. Por omisión `{ 20, 30, false, {} }`. `avisoTope` guarda el mes (`"YYYY-MM"` argentino) del último aviso por tope, que usa la Tarea 10.
  - `leerAjustes(): Promise<AjustesBuscador>` / `guardarAjustes(a: Partial<AjustesBuscador>): Promise<void>`
  - `MARGEN_FRENO_USD = 2`: frena en tope − 2.
  - `PRECIOS_PLACES`: objeto por SKU con `usdPorMil` y `gratisPorMes`. **Los valores se copian de la página de precios vigente de Places API (New) al implementar**, con la fecha de consulta en un comentario.
  - `costoLlamadaPlaces(sku: string, llamadasPreviasDelMes: number): number`: devuelve 0 mientras `llamadasPreviasDelMes < gratisPorMes`.
  - `gastoDelMes(ahora: Date): Promise<{ googleUsd: number; claudeUsd: number; llamadasPorSku: Record<string, number> }>`: suma `DnxBuscadorTarea.costo*UsdMicros` y cuenta llamadas desde `resultado.llamadas` de las tareas con `hechaEn >= inicioDelMesArgentino(ahora)`.
  - `puedeUsar(fuente: "GOOGLE"|"CLAUDE", ahora: Date): Promise<{ ok: boolean; motivo?: "PAUSADO"|"TOPE" }>`

- [ ] **Step 1: Tests:**
  - `"Google frena al llegar a USD 18 con tope 20"` → con tareas del mes por USD 18,00 → `{ ok: false, motivo: "TOPE" }`; con 17,99 → ok.
  - `"Claude frena en USD 28 con tope 30"`.
  - `"las llamadas dentro del uso gratis cuestan 0"` → con `gratisPorMes: 1000` y 999 previas → 0; con 1000 previas → `usdPorMil/1000`.
  - `"el mes cambia en hora argentina"` → una tarea con `hechaEn` `2026-12-01T02:30:00Z` (30/11 23:30 AR) cuenta en noviembre; `ahora` = `2026-12-01T03:00:00Z` (00:00 AR) da gasto 0.
  - `"pausado frena las dos fuentes"`.
  - `"un tope editado se respeta"` → tope Google 50 y gasto 30 → ok.
- [ ] **Step 2:** `pnpm vitest run lib/agentes/buscador/gasto.test.ts` → FAIL.
- [ ] **Step 3:** Implementar. Consultar la página oficial de precios de Places API (New) y completar `PRECIOS_PLACES`. Si no se puede consultar, dejar el valor más alto publicado conocido y `gratisPorMes: 0` (conservador), y anotarlo en el PR.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** — `"Buscador: gasto del mes y topes"`

---

### Task 7: Claude compartido + cliente de Google Places

**Files:**
- Create: `apps/fotoffice/lib/agentes/claude.ts`
- Modify: `apps/fotoffice/lib/agentes/periodista/redactor.ts` (usar `claude.ts`, sin cambiar su comportamiento)
- Create: `apps/fotoffice/lib/agentes/buscador/places.ts`
- Test: `apps/fotoffice/lib/agentes/buscador/places.test.ts`

**Interfaces:**
- Produces (`claude.ts`): mover desde `redactor.ts`, sin cambiar la lógica:
  - `ClienteClaude` (lo que hoy es `ClientePeriodista`; dejar `export type ClientePeriodista = ClienteClaude` en `redactor.ts`), `clienteReal()`, `type Conversacion<T>`, `conversar<T>(input): Promise<ResultadoRedaccion<T>>`, `ResultadoRedaccion<T>`, `ResultadoParseo<T>`.
  - Agregar a `Conversacion` el campo opcional `maxBusquedas?: number` (por omisión 5, el valor actual), y en `claude.ts` el tope `MAX_VUELTAS = 6` ya existente.
- Produces (`places.ts`):
  - `type LugarPlaces = { placeId: string; nombre: string; web: string | null; direccion: string | null; lat: number | null; lng: number | null }`. Vive **sólo en memoria**: nunca se persiste salvo `placeId`.
  - `buscarLugares(consulta: string, opciones: { paginas: number; region?: "ar" }, deps?: { fetch?: typeof fetch; clave?: string | null }): Promise<{ lugares: LugarPlaces[]; llamadas: Record<string, number> } | { error: "SIN_CLAVE" | "HTTP" | "CUOTA"; detalle: string }>`
  - Usa `POST https://places.googleapis.com/v1/places:searchText` con `X-Goog-Api-Key`, `X-Goog-FieldMask` mínimo (`places.id,places.displayName,places.websiteUri,places.formattedAddress,places.location,nextPageToken`, ajustado al SKU más barato según la Task 6), `languageCode: "es"` y `regionCode: "AR"`.
  - Pagina con `pageToken` hasta `paginas`. 429 o `RESOURCE_EXHAUSTED` → `CUOTA`.

- [ ] **Step 1:** Correr `pnpm vitest run lib/agentes/periodista` y anotar que pasa entero (línea base).
- [ ] **Step 2: Tests de `places.ts`** con `fetch` falso:
  - `"manda la clave, el field mask y es/AR"` → inspeccionar headers y body.
  - `"pagina hasta 3 con nextPageToken"` → 3 llamadas, `llamadas` por SKU = 3.
  - `"sin clave devuelve SIN_CLAVE sin llamar"`.
  - `"429 devuelve CUOTA"`.
- [ ] **Step 3:** `pnpm vitest run lib/agentes/buscador/places.test.ts` → FAIL.
- [ ] **Step 4:** Extraer `claude.ts`, adaptar `redactor.ts` e implementar `places.ts`.
- [ ] **Step 5:** `pnpm vitest run lib/agentes` → todo PASS, incluido el Periodista sin cambios en sus tests.
- [ ] **Step 6: Commit** — `"Agentes: Claude compartido y cliente de Google Places"`

---

### Task 8: Búsqueda web con Claude y validación de candidatos

**Files:**
- Create: `apps/fotoffice/lib/agentes/buscador/web.ts`
- Create: `apps/fotoffice/lib/agentes/buscador/prompts.ts`
- Test: `apps/fotoffice/lib/agentes/buscador/web.test.ts`

**Interfaces:**
- Consumes: `conversar` (Task 7), `Candidato` (Task 3), `claveDominio`/`claveTelefono`/`claveEmail` (Task 2).
- Produces:
  - `descubrirEnProvincia(t: { provincia: string; region: Region; tipo: TipoContacto; nicho: string | null }, deps): Promise<{ candidatos: Candidato[]; uso: UsoClaude; descartados: number }>`: búsqueda web amplia por provincia.
  - `leerLugar(lugar: LugarPlaces, t: { ciudad: string; provincia: string; region: Region; tipo: TipoContacto; nicho: string | null }, deps): Promise<{ candidato: Candidato | null; uso: UsoClaude }>`: con la web del lugar (o buscándola por nombre + ciudad), devuelve los datos sacados de **páginas propias**. El candidato lleva `googlePlaceId: lugar.placeId` y **ningún** dato con fuente Google.
  - `validarCandidato(bruto: unknown): { ok: true; candidato: Candidato } | { ok: false; motivo: string }`, con un esquema zod. Reglas:
    - cada dato trae `fuenteUrl` http(s), si no se descarta ese dato;
    - el email se descarta si su dominio no es el `claveDominio` de la web del candidato ni un proveedor genérico (`gmail.com, hotmail.com, outlook.com, yahoo.com, yahoo.com.ar, live.com, icloud.com`);
    - el teléfono se descarta si `claveTelefono` da null;
    - el candidato se descarta si no queda ningún dato de contacto ni web/red.
  - Prompts en español:
    - sólo datos publicados por el propio negocio o persona para ser contactados;
    - nunca inventar;
    - campo vacío si no está;
    - cada dato con la URL exacta donde se vio;
    - devolver JSON en un bloque ```json.
  - Búsquedas por llamada: `maxBusquedas: 5` en `descubrirEnProvincia` y `3` en `leerLugar`.

- [ ] **Step 1: Tests** con cliente falso (mismo patrón que `redactor.test.ts`):
  - `"descubrir devuelve candidatos válidos con su fuente"`.
  - `"descarta el email de un dominio ajeno"` → web `estudioluz.com.ar`, email `contacto@directoriofotos.com` → sin email.
  - `"acepta gmail aunque la web sea propia"`.
  - `"descarta datos sin fuenteUrl"`.
  - `"descarta el candidato sin ningún dato de contacto"`.
  - `"leerLugar no guarda nada con fuente Google y lleva el placeId"`.
  - `"suma el uso de Claude de todas las vueltas"`.
- [ ] **Step 2:** `pnpm vitest run lib/agentes/buscador/web.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `web.ts` y `prompts.ts`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** — `"Buscador: búsqueda web y validación de candidatos"`

---

### Task 9: Ciudades, frases y generación de tareas

**Files:**
- Create: `apps/fotoffice/lib/agentes/buscador/ciudades.ts`
- Create: `apps/fotoffice/lib/agentes/buscador/consultas.ts`
- Test: `apps/fotoffice/lib/agentes/buscador/consultas.test.ts`

**Interfaces:**
- Produces:
  - `CIUDADES: Record<Region, Array<{ provincia: string; ciudades: Array<{ nombre: string; grande: boolean }> }>>`.
    - Regiones: CENTRO = Santa Fe, Córdoba, Entre Ríos; BUENOS_AIRES_AMBA = CABA, Buenos Aires; CUYO = Mendoza, San Juan, San Luis, La Rioja; NOA = Jujuy, Salta, Tucumán, Catamarca, Santiago del Estero; NEA = Misiones, Corrientes, Chaco, Formosa; PATAGONIA = La Pampa, Neuquén, Río Negro, Chubut, Santa Cruz, Tierra del Fuego.
    - Ciudades: capitales + ciudades de más de ~20.000 habitantes.
    - En CENTRO se incluye el Gran Rosario: Rosario, Funes, Roldán, Villa Gobernador Gálvez, Granadero Baigorria, Pérez, San Lorenzo.
    - `grande: true` sólo para capitales, CABA, ciudades del Gran Rosario y del Gran Buenos Aires con más de 300.000 habitantes.
  - `FRASES: Record<TipoContacto, string[]>` y `FRASES_NICHO: Record<Nicho, string[]>`. Plantillas con `{ciudad}`, por ejemplo `"fotógrafo escolar en {ciudad}"`, `"colegio en {ciudad}"`, `"club deportivo en {ciudad}"`, `"agencia de turismo en {ciudad}"`.
  - `TIPOS_WEB: TipoContacto[] = ["FOTOGRAFO","ASOCIACION_FOTOGRAFOS","ORGANIZADOR_MUESTRAS","ORGANIZADOR_EVENTOS","CLUB"]`: los que además se buscan con web por provincia.
  - `generarTareas(region: Region): Promise<{ creadas: number }>`:
    - Places: una tarea por ciudad × (tipo, o nicho si es fotógrafo), con `paginas = grande ? 3 : 1`.
    - Web: una por provincia × tipo de `TIPOS_WEB` (× nicho si es fotógrafo).
    - `prioridad`: 1 para nichos prioritarios y sus contrapartes (`ESCUELA` para escolar, `EMPRESA_TURISMO` para turística, `CLUB` para deportiva), 2 para el resto.
    - Inserta con `createMany({ skipDuplicates: true })` para que repetirlo no duplique.
  - `activarRegion(region: Region, ahora: Date): Promise<void>`: pone `EN_CURSO` + `iniciadaEn`, y deja en `EN_ESPERA` cualquier otra que esté `EN_CURSO`. Después llama a `generarTareas`.
  - `regionActual(): Promise<Region | null>`: la `EN_CURSO`.

- [ ] **Step 1: Tests:**
  - `"genera tareas de Places por ciudad y de web por provincia"` → para CENTRO, la cantidad esperada se calcula desde `CIUDADES` y `FRASES` en el mismo test.
  - `"las ciudades grandes piden 3 páginas"` → Rosario 3, Funes 1.
  - `"escolar, turística y deportiva y sus contrapartes tienen prioridad 1"`.
  - `"generar dos veces no duplica"`.
  - `"activar una región deja las demás fuera de EN_CURSO"`.
- [ ] **Step 2:** `pnpm vitest run lib/agentes/buscador/consultas.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `ciudades.ts` y `consultas.ts`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** — `"Buscador: ciudades, frases y tareas por región"`

---

### Task 10: Motor, cierre de región y Telegram

**Files:**
- Create: `apps/fotoffice/lib/agentes/buscador/motor.ts`
- Test: `apps/fotoffice/lib/agentes/buscador/motor.test.ts`

**Interfaces:**
- Consumes: `puedeUsar`, `costoLlamadaPlaces`, `gastoDelMes`, `leerAjustes` (T6); `buscarLugares` (T7); `descubrirEnProvincia`, `leerLugar` (T8); `regionActual`, `activarRegion` (T9); `guardarCandidato` (T3); `vincularClf` (T12, opcional por `deps`; si no existe todavía, no-op); `destinoAgentes`, `mandarMensaje` (`lib/agentes/canal.ts`).
- Produces:
  - `type DepsMotor = { ahora?: () => Date; reloj?: () => number; places?: typeof buscarLugares; web?: { descubrir: typeof descubrirEnProvincia; leer: typeof leerLugar }; telegram?: DepsTelegramApi; clf?: (ids: string[]) => Promise<void> }`
  - `correrBuscador(opciones: { presupuestoMs: number; motivo: "CRON"|"MANUAL" }, deps?: DepsMotor): Promise<{ procesadas: number; nuevos: number; frenadoPor: null | "PAUSADO" | "TOPE_GOOGLE" | "TOPE_CLAUDE" | "SIN_REGION"; regionCerrada: Region | null }>`

**Algoritmo de `correrBuscador`:**
1. Si `pausado` → devuelve `frenadoPor: "PAUSADO"`. Si no hay región `EN_CURSO` y ninguna `EN_ESPERA` → `SIN_REGION`. Si no hay región `EN_CURSO`, activa la primera `EN_ESPERA` por `orden`.
2. Mientras quede tiempo (`reloj() - inicio < presupuestoMs`):
   - Elige la próxima tarea `PENDIENTE` de la región por `prioridad`, después `id`, salteando las fuentes frenadas. Toma la tarea con `updateMany({ where: { id, estado: "PENDIENTE" }, data: { estado: "EN_CURSO", tomadaEn, intentos: { increment: 1 } } })`; si `count !== 1`, sigue con otra.
   - **Tarea `GOOGLE_PLACES`:** requiere `puedeUsar("GOOGLE")` y `puedeUsar("CLAUDE")`. Llama `buscarLugares`. Por cada lugar cuyo `placeId` no exista ya en `DnxContacto`, llama `leerLugar` y después `guardarCandidato`. Si cruza el tope de Claude a mitad, se corta y la tarea vuelve a `PENDIENTE`.
   - **Tarea `WEB_SEARCH`:** requiere `puedeUsar("CLAUDE")`. Llama `descubrirEnProvincia` y después `guardarCandidato` por cada candidato.
   - **Fin de la tarea:** `HECHA` con `resultado = { encontrados, nuevos, actualizados, descartados, llamadas }`, más `costoGoogleUsdMicros`, `costoClaudeUsdMicros` y `hechaEn`.
   - **Error:** vuelve a `PENDIENTE`, o `FALLO` si `intentos >= 3`.
   - Una tarea `EN_CURSO` con `tomadaEn` de hace más de 20 minutos vuelve a `PENDIENTE`: es una corrida que murió.
3. **Freno por tope:** la primera vez en el mes que se frena por un tope, manda un aviso por Telegram. Para no repetirlo, se guarda en los ajustes `avisoTope: { GOOGLE?: "YYYY-MM"; CLAUDE?: "YYYY-MM" }`.
4. **Cierre de región:** si a la región no le quedan tareas `PENDIENTE` ni `EN_CURSO`:
   - `COMPLETA` + `completadaEn`;
   - manda `resumenDeRegion` por Telegram y setea `resumenEnviadoEn`;
   - si `FALLO` supera el 20 % de las tareas, agrega la línea de aviso;
   - `activarRegion` de la siguiente por `orden`.
- `resumenDeRegion(region): Promise<string>`. El texto exacto incluye:
  - título `«Región <nombre> lista»`;
  - contactos nuevos totales;
  - desglose por tipo y, para fotógrafos, por nicho;
  - las 5 ciudades con más contactos;
  - gasto de Google y de Claude de la región;
  - enlace `<NEXT_PUBLIC_APP_URL>/admin/contactos-dnx?region=<REGION>`.
- `REGIONES_NOMBRE: Record<Region, string>` para los textos: «Centro», «Buenos Aires y AMBA», «Cuyo», «NOA», «NEA», «Patagonia».

- [ ] **Step 1: Tests** con todos los `deps` falsos y la base en memoria:
  - `"procesa tareas hasta agotar el presupuesto de tiempo"` → reloj falso que avanza 1000 ms por tarea, presupuesto 2500 → 3 procesadas.
  - `"una tarea tomada por otra corrida no se procesa dos veces"` → tarea ya `EN_CURSO` reciente → se saltea.
  - `"una tarea EN_CURSO vieja vuelve a PENDIENTE"`.
  - `"con Google frenado, las tareas de web siguen y las de Places quedan PENDIENTE"` → la región no se cierra.
  - `"con Claude frenado no procesa nada y avisa una sola vez por mes"` → dos corridas = 1 mensaje.
  - `"tres errores dejan la tarea en FALLO"`.
  - `"al no quedar pendientes cierra la región, manda el resumen y activa la siguiente"` → `CENTRO` `COMPLETA`, `BUENOS_AIRES_AMBA` `EN_CURSO`, 1 `sendMessage` que contiene «Región Centro lista».
  - `"más de 20 % de FALLO agrega el aviso al resumen"`.
  - `"no guarda nada con fuente GOOGLE_PLACES"` → ningún `dnxContactoDato` tiene esa fuente después de una tarea de Places.
  - `"un placeId que ya existe no gasta Claude"` → `leerLugar` no se llama.
- [ ] **Step 2:** `pnpm vitest run lib/agentes/buscador/motor.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `motor.ts`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** — `"Buscador: motor, cierre de región y avisos"`

---

### Task 11: Cron, panel del Buscador y tarjeta en Agentes

**Files:**
- Create: `apps/fotoffice/app/api/cron/agente-buscador/route.ts`
- Modify: `apps/fotoffice/vercel.json`: agregar `{ "path": "/api/cron/agente-buscador", "schedule": "*/15 * * * *" }`
- Modify: `apps/fotoffice/app/(shell)/admin/contactos-dnx/page.tsx` (cabecera)
- Modify: `apps/fotoffice/app/(shell)/admin/contactos-dnx/actions.ts`
- Modify: `apps/fotoffice/app/(shell)/admin/agentes/page.tsx`
- Create: `apps/fotoffice/lib/agentes/buscador/estado.ts`
- Test: `apps/fotoffice/lib/agentes/buscador/estado.test.ts`

**Interfaces:**
- Consumes: `correrBuscador` (T10); `leerAjustes`, `guardarAjustes`, `gastoDelMes` (T6); `activarRegion` (T9).
- Produces:
  - `estadoBuscador(ahora: Date): Promise<{ regiones: Array<{ region; nombre; orden; estado; hechas; total; fallidas }>; actual: Region | null; ajustes: AjustesBuscador; gasto: { googleUsd; claudeUsd }; tieneClaveGoogle: boolean }>`
  - `reordenarRegiones(orden: Region[]): Promise<void>`: sólo afecta a las regiones que no están `COMPLETA`.
- **Cron:**
  - Mismo patrón que `agente-periodista/route.ts` (GET→POST, `isAuthorizedCronRequest` con `CRON_SECRET` y `FOTOFFICE_CRON_SECRET`), `maxDuration = 300`.
  - Llama `correrBuscador({ presupuestoMs: 240_000, motivo: "CRON" })`.
- **Acciones del panel:**
  - «Pausar / Reanudar» → `guardarAjustes({ pausado })`.
  - «Correr ahora» → `correrBuscador` en segundo plano con `after`, igual que el Periodista.
  - Editar topes, con validación: números entre 0 y 500.
  - «Activar región» y reordenar.
- **Cabecera del panel:**
  - región actual con avance `hechas/total`;
  - lista de regiones en orden con su estado;
  - gasto de Google y de Claude del mes contra su tope;
  - si falta `GOOGLE_PLACES_API_KEY`, aviso «Sin clave de Google: busca sólo en internet».
- **En `/admin/agentes`:** tarjeta «Buscador» con región actual, gasto del mes y enlace a `/admin/contactos-dnx`.

- [ ] **Step 1: Tests de `estado.ts`:**
  - `"cuenta hechas, total y fallidas por región"`.
  - `"reordenar no mueve regiones completas"`.
  - `"sin clave de Google lo informa"`.
- [ ] **Step 2:** `pnpm vitest run lib/agentes/buscador/estado.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `estado.ts`, el cron, `vercel.json`, la cabecera, las acciones y la tarjeta.
- [ ] **Step 4:** Tests → PASS. Verificar en el navegador con `preview_start`:
  - la cabecera muestra las 6 regiones;
  - Pausar y Reanudar cambian el estado;
  - editar un tope se guarda;
  - «Correr ahora» sin clave de Google ni de Claude no rompe y lo informa.
- [ ] **Step 5: Commit** — `"Buscador: cron y controles en el panel"`

---

### Task 12: Usuarios de CLF

**Files:**
- Create: `apps/compramelafoto/lib/usuarios-existentes.ts`
- Create: `apps/compramelafoto/app/api/internal/usuarios/existentes/route.ts`
- Test: `apps/compramelafoto/lib/usuarios-existentes.test.ts`
- Create: `apps/fotoffice/lib/agentes/buscador/clf.ts`
- Test: `apps/fotoffice/lib/agentes/buscador/clf.test.ts`
- Modify: `apps/fotoffice/lib/agentes/buscador/motor.ts`: después de guardar candidatos nuevos o actualizados, llamar `vincularClf` con sus ids.

**Interfaces:**
- **CLF:**
  - `usuariosExistentes(input: { emails: string[]; telefonos: string[] }): Promise<Array<{ clave: string; userId: number; rol: string }>>`.
    - Compara emails en minúsculas, y teléfonos normalizados igual que en `claveTelefono` de la Task 2 (copiar la función a CLF: no hay paquete compartido).
    - Busca en `User.phone` y `User.whatsapp`.
    - Ignora usuarios borrados o de prueba si el modelo los marca.
  - **Ruta:** `POST /api/internal/usuarios/existentes`.
    - Header `Authorization: Bearer <CLF_CONSULTA_USUARIOS_SECRET>`, comparado en tiempo constante. Sin secreto configurado → 503; secreto incorrecto → 401.
    - Body de hasta 200 claves por lote; más → 400.
    - Responde `{ coincidencias: [...] }`, sin nombres ni otros datos.
- **FOTOFFICE:**
  - `ROLES_PLATAFORMA = ["PHOTOGRAPHER","LAB_PHOTOGRAPHER","ORGANIZER","SCHOOL_ORGANIZER"]`.
  - `vincularClf(contactoIds: string[], deps?: { fetch?; url?; secreto? }): Promise<{ vinculados: number; compradores: number; error?: string }>`. Por cada coincidencia:
    - rol en `ROLES_PLATAFORMA` → `vinculo: "USUARIO_CLF"`, `vinculoId: String(userId)`, evento `VINCULADO`. No pisa `CONOCIDO_DNX_ESTUDIO`: si ya tiene ese vínculo, sólo agrega el evento;
    - `CUSTOMER` → `compradorClf: true` + evento `VINCULADO` con `{ comprador: true }`.
  - URL de CLF por `CLF_BASE_URL` (por omisión `https://compramelafoto.com`), con timeout de 10 s.
  - Si falla, devuelve `error` y no lanza. Los contactos quedan para la próxima corrida, que reintenta los contactos sin chequear (marca `datos.clfChequeadoEn` en un evento, o columna `clfChequeadoEn`; decide el implementador).

- [ ] **Step 1: Tests de CLF (`usuarios-existentes.test.ts`):**
  - `"encuentra por email sin importar mayúsculas"`.
  - `"encuentra por teléfono con 9 y 15"`.
  - `"devuelve el rol y nunca el nombre"`.
  - **Ruta:** `"sin secreto configurado responde 503"`, `"secreto incorrecto 401"`, `"más de 200 claves 400"`. Probar el handler llamándolo con un `Request` armado.
- [ ] **Step 2: Tests de FOTOFFICE (`clf.test.ts`):**
  - `"un fotógrafo de CLF queda USUARIO_CLF"`.
  - `"un comprador queda compradorClf sin vínculo"`.
  - `"no pisa CONOCIDO_DNX_ESTUDIO"`.
  - `"si CLF falla devuelve error y no lanza"`.
- [ ] **Step 3:** Correr ambos tests → FAIL.
- [ ] **Step 4:** Implementar los dos lados y engancharlo en `motor.ts`.
- [ ] **Step 5:** Correr ambos tests → PASS. `pnpm vitest run lib/agentes/buscador` → todo PASS.
- [ ] **Step 6: Commit** — `"Buscador: saber quién ya es usuario de CLF"`

---

### Task 13: Puesta en marcha

**Files:**
- Create: `apps/fotoffice/docs/superpowers/puesta-en-marcha/2026-11-08-buscador.md`

- [ ] **Step 1:** Escribir los pasos para Daniel, en español claro:
  1. En GCP (cuenta `compramelafoto@gmail.com`, `authuser=1`):
     - crear el proyecto `dnx-agentes` y vincularlo a la facturación `01E0EB-C76321-DB0EB0`;
     - habilitar «Places API (New)»;
     - crear una clave restringida a esa API;
     - fijar la cuota «solicitudes por día» en el valor que salga de USD 20 ÷ precio por llamada ÷ 30, redondeado hacia abajo;
     - crear una alerta de presupuesto de USD 20 al correo de Daniel.
  2. En Vercel FOTOFFICE cargar `GOOGLE_PLACES_API_KEY` y `CLF_CONSULTA_USUARIOS_SECRET`. En Vercel CLF (`compramelafoto-dnxsuite`), el mismo secreto. Después, redeploy de los dos.
  3. En `/admin/contactos-dnx`, «Importar conocidos» y después «Correr ahora».
  4. Mirar las primeras tareas: calidad y costo por tarea contra lo estimado.
- [ ] **Step 2: Commit** — `"Buscador: pasos de puesta en marcha"`

---

## Cierre (después de todas las tareas)

- [ ] `pnpm vitest run lib/agentes` en FOTOFFICE y el test nuevo de CLF → PASS.
- [ ] Abrir los PR: PR 1 = Tareas 1–5, PR 2 = Tareas 6–13. Esperar `tipos-y-pruebas` en verde **antes** de fusionar.
- [ ] Aplicar la migración en producción si no se hizo en la Tarea 1, registrarla y verificar que `/admin/contactos-dnx` carga sin 500 en fotoffice.com.
- [ ] Actualizar la memoria `project_dnx_equipo_de_agentes.md` con el estado.
