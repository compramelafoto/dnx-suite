# 44 — Manual de operaciones editoriales (lanzamiento)

**Producto:** Info Spot  
**Alcance:** preparación editorial para el día del lanzamiento  
**No incluye:** cambios de producto, Prisma, APIs, infra ni producción  

Este documento es la guía operativa para una redacción real. Combina auditoría del sistema actual, configuración inicial recomendada, fixtures DEMO, checklist de publicación, moderación y roles.

---

## 1. Auditoría de la estructura editorial existente

### 1.1 Categorías

| Aspecto | Estado actual |
|--------|----------------|
| Modelo | `InfoSpotCategory` **plana** (sin subcategorías en DB) |
| Seed canónico | `deportes`, `cultura`, `fotografia`, `eventos` |
| CRUD admin | No hay administración de categorías en UI |
| Home | Orden preferido: deportes → cultura → fotografia (`HOME_CATEGORY_ORDER`) |
| Sync CLF | Mapeo fijo en `apps/infospot/lib/clf-event-sync/category-map.ts` |

**Conclusión:** no conviene crear docenas de categorías en DB el día 1 (rompe expectativa de home/footer y el mapa CLF). Usar las **4 canónicas** y tratar el resto como **temas editoriales** (ver §2).

### 1.2 Subcategorías y tags públicos

| Concepto | Existe? | Notas |
|----------|---------|--------|
| Subcategorías | No | No hay jerarquía en schema |
| Tags públicos (SEO/taxonomía) | No | |
| Tags de contenido | Sí | `DEMO` \| `REAL` \| `NEEDS_REVIEW` (`InfoSpotContentTag`) |

Los tags de contenido son **operativos** (calidad / origen), no taxonomía de lector.

### 1.3 Estados editoriales

Flujo unificado (artículos y eventos):

```text
DRAFT → IN_REVIEW → PUBLISHED
                 ↘ UNPUBLISHED → ARCHIVED
```

- `READY_TO_PUBLISH` es **legado**: se trata como alias de `IN_REVIEW` y no se escribe.
- Intake público de eventos (`/publicar-evento`) entra en revisión, no en publicado.

### 1.4 Prioridades

- Campo `editorialPriority` (número): influye en score de distribución y orden de destacados.
- Recomendación práctica: 0 = normal; 30–50 = agenda; 70–90 = portada / banner candidato.
- Flag `excludeFromHomepage`: saca el ítem de bloques automáticos aunque esté `PUBLISHED`.

### 1.5 Distribución Home

Motor: `apps/infospot/lib/distribution/` + composición editorial `lib/home-composition.ts`.

**Regla pública (ETAPA 15):** solo `status = PUBLISHED` y `excludeFromHomepage = false`.  
**Ya no** se exige `contentTag = REAL` para aparecer en home. Aun así, política de redacción: **no publicar DEMO** en producción (usar borradores o `UNPUBLISHED`).

| Bloque | Fuente | Si vacío |
|--------|--------|----------|
| Banner | Placement `HERO` (artículo o evento) | `HomePlatformHero` (institucional) |
| Pitch organizador / cómo funciona / por qué publicar | Estático | Siempre visible |
| Eventos destacados | Score + prioridad | Empty state del componente |
| Próximos eventos | `startAt >= now` | Empty state |
| Buscan fotógrafos | Eventos CLF elegibles (`isClfEventPublicPhotographerCall`) | Empty state |
| Cerca tuyo | Geo usuario o fallback próximos | Depende de query |
| Coberturas | Coberturas / artículos con vínculo | Sección omitida si no hay densidad editorial |
| Últimas noticias / más leídas | Artículos publicados | Secciones omitidas si `density === empty` |
| Institucional + newsletter | Settings / estático | Siempre |

Admin de placements: `/redaccion/distribucion` (Director o redactor con publicación directa).

### 1.6 Coberturas, eventos, noticias

| Entidad | Notas operativas |
|---------|------------------|
| Noticias | Editor + asistente + checklist; estados arriba |
| Eventos | Origen `REDACCION`, `PUBLIC_INTAKE` o sync CLF |
| Coberturas | Flujo unificado de material (docs 25–28, 40); fotos vía biblioteca / CLF |
| Convocatorias fotógrafos | Automáticas desde elegibilidad CLF, no switch manual |

---

## 2. Configuración editorial inicial recomendada

### 2.1 Categorías canónicas (sistema)

Mantener exactamente estas cuatro (seed `db:seed:infospot`):

| Slug | Nombre | Uso |
|------|--------|-----|
| `deportes` | Deportes | Competencias, torneos, running, fútbol, auto, moto, bici |
| `cultura` | Cultura | Recitales, fiestas, turismo cultural, solidarios, capacitaciones |
| `fotografia` | Fotografía | Oficio, galerías, convocatorias de fotógrafos |
| `eventos` | Eventos | Agenda general, empresas, mixto, banner institucional |

### 2.2 Temas editoriales (redacción — no son filas de DB)

Usar en título, bajada, cuerpo o notas internas. Mapear al canónico:

| Tema | Categoría canónica |
|------|--------------------|
| Automovilismo | Deportes |
| Motociclismo | Deportes |
| Running | Deportes |
| Ciclismo | Deportes |
| Fútbol | Deportes |
| Recitales | Cultura |
| Capacitaciones | Cultura (o Eventos si es agenda pura) |
| Solidarios | Cultura |
| Turismo | Cultura / Eventos |
| Fiestas populares | Cultura |
| Empresas | Eventos |
| Convocatorias | Eventos o Fotografía |
| Buscan fotógrafos | Fotografía (+ elegibilidad CLF) |

**No ampliar categorías en DB** sin actualizar mapa CLF, footer, smoke y docs de sync.

### 2.3 Defaults de settings (seed)

- Nombre: Info Spot  
- Slogan: «Descubrí lo que está pasando cerca tuyo.»  
- SEO: cobertura deportiva, cultural y social  

Ajustar solo vía settings de Director; no hardcodear en código para lanzamiento.

### 2.4 Prioridades sugeridas día 1

| Uso | `editorialPriority` |
|-----|---------------------|
| Banner / HERO | 80–100 |
| Evento destacado | 60–80 |
| Convocatoria fotógrafos | 40–60 |
| Nota de agenda | 20–40 |
| Resto | 0 |

---

## 3. Contenido DEMO (fixtures / seeds opcionales)

### 3.1 Principio

Los fixtures de lanzamiento **no deben publicarse automáticamente**. Quedan en `DRAFT` + `contentTag = DEMO` para ensayo de redacción.

### 3.2 Scripts

| Comando | Qué hace | Publica? |
|---------|----------|----------|
| `pnpm --filter @repo/db db:seed:infospot` | Settings + 4 categorías + Director | No |
| `pnpm --filter @repo/db db:seed:infospot-launch-drafts` | Noticias y eventos DEMO en **DRAFT** | **No** |
| `pnpm --filter @repo/db db:seed:infospot-demo` | Artículos demo históricos | **Sí** (solo staging; requiere `ALLOW_INFOSPOT_DEMO_SEED=1` en prod) |
| `pnpm --filter @repo/db db:seed:infospot-events` | Eventos demo históricos | **Sí** (mismo guard) |
| `packages/db/scripts/infospot-seed-launch-templates.ts` | Plantillas `[PENDIENTE]` REAL en borrador | No |

**Para ensayo de lanzamiento usar solo** `db:seed:infospot` + `db:seed:infospot-launch-drafts`.

### 3.3 Fixtures `launch-drafts` (slugs)

**Noticias (DRAFT):**

- `draft-demo-banner-home` — candidato a banner  
- `draft-demo-cobertura-deportes` — cobertura  
- `draft-demo-ultima-noticia-cultura` — últimas noticias  
- `draft-demo-fotografia-galeria` — galería / créditos  

**Eventos (DRAFT):**

- `draft-demo-evento-destacado` — destacados  
- `draft-demo-buscan-fotografos` — convocatoria (ensayo; el bloque real depende de CLF)  
- `draft-demo-agenda-proximos` — próximos  

Tras publicar piezas **REAL**, asignar placement HERO en `/redaccion/distribucion` si corresponde.

### 3.4 Guardas

- Bloqueado en `NODE_ENV=production` salvo `ALLOW_INFOSPOT_DEMO_SEED=1`.  
- **Nunca** correr seeds DEMO publicados contra Neon production el día del lanzamiento.

---

## 4. Auditoría de Home — hallazgos y mejoras editoriales

### 4.1 Orden actual (arriba → abajo)

1. Banner editorial **o** hero de plataforma  
2. Pitch organizador / cómo funciona / por qué publicar (siempre)  
3. Eventos destacados + próximos  
4. Buscan fotógrafos  
5. Cerca tuyo  
6. Coberturas (condicional)  
7. Últimas noticias / más leídas (condicional)  
8. Institucional + newsletter  

### 4.2 Riesgos de bloques vacíos el día 1

| Bloque | Riesgo | Mitigación editorial |
|--------|--------|----------------------|
| Banner | Sin HERO → hero genérico | Publicar 1 nota/evento fuerte + placement HERO |
| Destacados / próximos | Agenda vacía | 3–6 eventos REAL futuros con geo y portada |
| Buscan fotógrafos | Sin CLF elegible | Coordinar 1–2 convocatorias abiertas en CLF |
| Coberturas | Sin vínculo evento/fotos | 1 cobertura completa con material |
| Noticias | `density empty` oculta sección | ≥ 3–5 notas REAL publicadas |
| Cerca tuyo | Sin geo usuario | Fallback a próximos (OK) |

### 4.3 Jerarquía recomendada (sin nuevas features)

1. **Un** HERO claro (hecho + imagen autorizada).  
2. Agenda densa antes que notas opinativas.  
3. Al menos una convocatoria fotógrafos real si el bloque es promesa de producto.  
4. No publicar DEMO: el visitante no debe ver «[DEMO]» ni plantillas.  
5. Preferir pocas piezas excelentes a muchas incompletas.

### 4.4 Mejoras propuestas (solo editorial / proceso)

- Calendario de carga 72 h antes del go-live (ver §13 en informe de lanzamiento).  
- Checklist obligatorio en revisión (Director).  
- Archivar o despublicar demos viejos si quedaron `PUBLISHED` en staging.  
- Documentar en Slack/Notion el mapa tema → categoría (§2.2).

---

## 5. Manual editorial (para redactores)

### 5.1 Cómo crear una noticia

1. Entrar a `/redaccion` con rol activo.  
2. Crear noticia → queda en `DRAFT`.  
3. Completar título, bajada, cuerpo, categoría canónica.  
4. Agregar portada y fotos (crédito + alt).  
5. SEO (título/descripción) si aplica.  
6. Marcar `contentTag = REAL` cuando el material sea verificable.  
7. Enviar a revisión (`IN_REVIEW`) o publicar según política del rol.  
8. Completar checklist de publicación (§6) antes de `PUBLISHED`.

### 5.2 Cómo crear un evento

1. Redacción → nuevo evento (origen redacción), **o** intake público (entra a revisión).  
2. Título, resumen, descripción, categoría, fechas, lugar, geo confirmada.  
3. Organizador y datos de contacto verificables.  
4. Portada; si hay convocatoria fotógrafos, alinear con CLF.  
5. Revisar checklist de evento; publicar solo con fechas futuras coherentes.

### 5.3 Cómo usar el asistente

- Abrir el asistente desde la superficie de escritura.  
- Usar para estructura, bajada, SEO y sugerencias; **verificar hechos**.  
- No publicar texto generado sin edición humana.  
- Detalle de producto: `docs/infospot/37-editorial-assistant.md` y `38-writing-surface.md`.

### 5.4 Cómo agregar fotografías

1. Preferir material con derecho de uso (CLF / autorización).  
2. Biblioteca / selector editorial → insertar en cuerpo o portada.  
3. Completar crédito y texto alternativo.  
4. No usar stock genérico como si fuera cobertura propia sin aclararlo.  
5. Flujo de material: `docs/infospot/40-unified-editorial-material-flow.md`.

### 5.5 Cómo crear una cobertura

1. Evento publicado o vinculado.  
2. Preparar material en el centro de coberturas / asistente.  
3. Nota con galería y créditos.  
4. Verificar que aparezca en bloque de coberturas tras publicar.  
5. Docs: `25-editorial-coverage-center.md`, `27-public-editorial-coverage.md`.

### 5.6 Cómo publicar

1. Checklist en verde (mínimos obligatorios).  
2. `contentTag` correcto (`REAL` para lanzamiento público).  
3. Quien puede publicar: Director siempre; Redactor según `publicationPolicy`; Colaborador **nunca**.  
4. Tras publicar: si es portada, pedir placement HERO a quien gestione distribución.  
5. Revalidar home (el sistema cachea ~60–120s).

### 5.7 Buenas prácticas

- Título concreto; evitar clickbait vacío.  
- Bajada ≥ 1 oración útil.  
- Una categoría canónica clara.  
- Ubicación y fechas verificadas.  
- Crédito fotográfico siempre.  
- No mezclar DEMO y REAL en la misma pieza.  
- CTA claro (inscripción, álbum, mapa) solo si el enlace funciona.  
- Revisar ortografía y nombres propios.

---

## 6. Checklist de publicación (noticia)

Antes de publicar una noticia:

- [ ] Título definitivo (sin `[DEMO]`, `[PENDIENTE]`)  
- [ ] Bajada  
- [ ] Cuerpo completo y verificado  
- [ ] Categoría canónica  
- [ ] Ubicación / contexto geográfico si aplica  
- [ ] Portada  
- [ ] Fotografías en cuerpo (si la nota lo requiere)  
- [ ] Crédito fotográfico  
- [ ] SEO (slug, meta título/descripción)  
- [ ] Revisión humana (Director o redactor autorizado)  
- [ ] CTA funcional (si hay)  
- [ ] Evento relacionado (si existe cobertura/agenda)  
- [ ] `contentTag = REAL`  
- [ ] `excludeFromHomepage` solo si debe quedar fuera de home  

**Checklist técnico en código:** `apps/infospot/lib/launch-content.ts` (`buildArticlePublishChecklist`) + UI en redacción. Completar mentalmente los ítems de ubicación/CTA/evento aunque la UI no los marque todos.

### Checklist breve de evento

- [ ] Título y resumen  
- [ ] Fechas (`startAt` / `endAt`) coherentes  
- [ ] Ciudad / provincia / venue  
- [ ] Geo confirmada  
- [ ] Categoría y organizador  
- [ ] Portada  
- [ ] Convocatoria CLF alineada (si aplica)  

---

## 7. Manual de operación diaria

### 7.1 Flujo diario sugerido

```text
Mañana     → Inbox / bandeja de revisión
Mediodía   → Agenda (eventos próximos 7 días)
Tarde      → Coberturas y material fotográfico
Cierre     → Distribución home + publicación / archivo
```

### 7.2 Inbox

- Revisar `IN_REVIEW` (noticias y eventos de intake).  
- Devolver con comentario claro o aprobar/publicar.  
- Priorizar hechos del día y agenda con fecha cercana.

### 7.3 Coberturas

- Listar eventos del fin de semana con material pendiente.  
- Cerrar coberturas incompletas o marcar `NEEDS_REVIEW`.  
- No publicar galerías sin crédito.

### 7.4 Agenda

- Mantener ≥ N eventos futuros publicados (meta día 1: 3–6).  
- Despublicar o archivar vencidos que confundan.  
- Verificar geo y links de inscripción.

### 7.5 Distribución

- Un solo HERO vigente.  
- Revisar `editorialPriority` de destacados.  
- No saturar con muchos placements solapados.

### 7.6 Publicación

- Solo piezas con checklist.  
- Comunicar a la redacción qué salió a home.

### 7.7 Archivado

- Eventos vencidos sin valor histórico → `UNPUBLISHED` o `ARCHIVED`.  
- Convocatorias cerradas → fuera de home (`excludeFromHomepage` o despublicar).  
- DEMO nunca debe quedar `PUBLISHED` en producción.

---

## 8. Moderación

### 8.1 Qué revisar antes de aprobar

- Exactitud de fechas, lugar y nombres.  
- Derechos de imagen y crédito.  
- Tonos ofensivos / spam / autopromo engañosa.  
- Enlaces externos seguros y relevantes.  
- Categoría correcta.  
- Que no sea plantilla DEMO.

### 8.2 Cómo devolver correcciones

- Usar acción de devolver a borrador / comentario de revisión (workflow existente).  
- Indicar **qué** falta (portada, geo, crédito, hechos).  
- Evitar devoluciones genéricas («mejorar texto»).

### 8.3 Eventos vencidos

- Si ya ocurrieron: quitar de destacados; archivar o dejar como archivo histórico según valor.  
- No mantener HERO de eventos pasados.

### 8.4 Convocatorias cerradas

- Verificar estado en CLF.  
- Si ya no hay cupo: despublicar o excluir de home para no frustrar fotógrafos.

### 8.5 Álbumes eliminados

- Quitar CTA roto de la nota.  
- Sustituir fotos o despublicar hasta tener material.  
- Coordinar con CompraMeLaFoto si el álbum era la fuente.

---

## 9. Roles y permisos (documentación — sin cambios)

Fuente de verdad: `packages/db/src/infospot-permissions.ts`.

| Capacidad | Director | Redactor | Colaborador | Organizador (intake) | Visitante |
|-----------|----------|----------|-------------|----------------------|-----------|
| Acceso `/redaccion` | Sí | Sí | Sí | No | No |
| Crear/editar noticias y eventos redacción | Sí | Sí | Sí | No* | No |
| Publicar / despublicar | Sí | Según `publicationPolicy` / `canPublish` | **No** | No | No |
| Revisar aprobaciones | Sí | No | No | No | No |
| Settings / usuarios | Sí | No | No | No | No |
| Moderación eventos admin | Sí | No | No | No | No |
| Distribución home | Sí | Solo si publicación directa | No | No | No |
| Ver eventos publicados (vincular) | Sí | Sí | No | — | Público solo publicados |
| Enviar evento público | — | — | — | Sí → `IN_REVIEW` | Puede usar formulario si está abierto |
| Leer sitio público | — | — | — | Sí | Sí (solo `PUBLISHED`) |

\* El organizador crea vía formulario público, no como miembro editorial.

**Políticas de publicación del redactor:**

- `DIRECT_PUBLISH` → puede publicar y, si aplica, gestionar distribución.  
- `REQUIRES_APPROVAL` → envía a revisión; Director aprueba.

**SUPER_ADMIN** de la suite DNX: bypass editorial (tratar como Director).

**Validación Production 22U:** membresías Director×2 + Redactor×1 clasificadas `VALID_*`; Redactor con `canPublish=true` (distribución y publish según flag). Evidencia y matriz smoke en [62](./62-editorial-roles-and-day-one-content-gate.md). Cleanup R2: solo Director (Redactor 403).

---

## 10. Coberturas, convocatorias y distribución (resumen operativo)

### Coberturas

- Pieza editorial + material visual + vínculo a evento/CLF.  
- Meta lanzamiento: ≥ 1 cobertura completa en home.

### Convocatorias («Buscan fotógrafos»)

- No hay toggle manual en Info Spot.  
- Dependen de reglas CLF (`isClfEventPublicPhotographerCall`).  
- CTA trackeado hacia CompraMeLaFoto.

### Distribución

- Placements: `HERO` (y tipos documentados en doc 24).  
- Score combina tiempo, geo, completitud, métricas y `editorialPriority`.  
- Cache corta: esperar 1–2 minutos tras publicar.

---

## 11. Referencias

| Doc | Tema |
|-----|------|
| `19-editorial-workflow-core.md` | Workflow |
| `24-homepage-distribution-engine.md` | Home (actualizar mentalmente: ya no exige REAL) |
| `25`–`28` | Coberturas y CLF |
| `34` / `36`–`41` | UX editorial, asistente, material, design system |
| `42` / `43` | Go-live e infraestructura / readiness |
| `10-launch-checklist.md` | Checklist histórico de launch |

---

## 12. Confirmación de alcance de este documento

Este manual y el seed `db:seed:infospot-launch-drafts` **no modifican**:

- Workflow / Editor / Asistente / UX  
- Prisma schema ni migraciones  
- APIs, CLF, Coberturas (código), Distribución (código)  
- Infraestructura ni producción  

Solo documentación y seeds opcionales de borrador.
