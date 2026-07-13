# 36 — Arquitectura UX del Centro Editorial

## Filosofía

La Redacción deja de organizarse por **entidades técnicas** (Noticias / Eventos / Coberturas) y pasa a organizarse por el **flujo mental del redactor**:

> ¿Qué tengo que publicar hoy? ¿Sobre qué evento escribo? ¿Qué material tengo? ¿Qué me falta?

La funcionalidad existente se mantiene. Solo cambia cómo se descubre y se usa.

## Flujo de trabajo (visible)

```
Inbox → En preparación → Escribiendo → En revisión → Publicados → Archivados
```

Las colas técnicas (`DRAFT`, `IN_REVIEW`, `PUBLISHED`, …) no cambian. Solo se reetiqueta la UI.

## Navegación

| Ítem | Ruta | Qué es |
|------|------|--------|
| Centro Editorial | `/redaccion` | Mesa de trabajo del día |
| Bandeja | `/redaccion/bandeja` | Colas de trabajo (antes: home con tabs) |
| Material | `/redaccion/coberturas` | Coberturas fotográficas / material disponible |
| Agenda | `/redaccion/eventos` | Eventos editoriales |
| Publicados | `/redaccion/bandeja?vista=publicadas` | Piezas visibles |
| Portada | `/redaccion/distribucion` | Distribución home |
| Estadísticas | `/redaccion#estadisticas` | Resumen en la mesa |

Compatibilidad: `/redaccion?vista=…` redirige a `/redaccion/bandeja?vista=…`.

## Concepto: Material Editorial

Agrupa visualmente (sin nueva lógica todavía):

- Evento
- Coberturas fotográficas
- Fotógrafos
- Fotos
- Documentos / videos (futuro)

El redactor no necesita entender álbumes CLF, ContentOrigin ni sync.

## Lenguaje

| Antes (técnico) | Ahora (redacción) |
|-----------------|-------------------|
| Álbum | Cobertura fotográfica / material |
| Sincronizar álbumes | Actualizar material |
| Centro Editorial de Coberturas | Material editorial |
| Georreferenciación | Ubicación confirmada |
| Nueva nota (nav permanente) | Acción rápida en la mesa |

## Principios de diseño

1. **Una acción primaria** por pantalla.
2. **Menos paneles**: la mesa responde “hoy tenés…” sin tablas enormes.
3. **Cards unificadas** (`EditorialWorkCard`) para evento / material / estadística.
4. **Breadcrumbs** con lenguaje de sala de prensa (`NewsroomBreadcrumbs`).
5. **Preparación del Wizard**: la navegación ya separa Elegir material → Escribir; el wizard futuro se enchufa sin rearmar la IA.

## Jerarquía visual

- Menos botones iguales compitiendo.
- Menos badges/chips en la home.
- Más tipografía serif para títulos de trabajo.
- Más espacio vertical entre bloques (`space-y-10` en la mesa).

## Qué NO se tocó

- Workflow editorial / permisos
- ContentOrigin / sync CLF
- Distribution engine / Coverage models
- Prisma / migraciones
- Selector de fotos / TipTap

## Preparación del Wizard (siguiente etapa)

Orden natural ya alineado:

1. Elegir tipo (nota / cobertura)
2. Elegir evento (Agenda / Material)
3. Elegir material
4. Datos
5. Editor (modo concentración ya existe)

## Métricas de complejidad (estimadas)

| Métrica | Antes | Después |
|---------|-------|---------|
| Ítems nav principales | 7+ (mezcla entidades + CTA + sitio) | 7 (trabajo) + Dirección aparte |
| Decisiones al abrir Redacción | “¿Noticias o Eventos o Coberturas?” | “¿Qué hay hoy?” en la mesa |
| Clics a crear nota | 1–2 (CTA en header ruidoso) | 1 (acción rápida primaria) |
| Clics a ver colas | Home con 7 tabs + KPIs | Bandeja con tabs de trabajo |
| Botones primarios visibles en home | 2–3 + KPIs clickeables + tabs | 1 primaria + secundarias claras |

## Archivos clave

- `lib/redaccion-ia.ts` — IA y glosario
- `components/redaccion/newsroom-desk.tsx` — mesa
- `components/redaccion/editorial-work-card.tsx` — card unificada
- `components/redaccion/newsroom-breadcrumbs.tsx`
- `app/redaccion/page.tsx` — Centro Editorial
- `app/redaccion/bandeja/page.tsx` — Bandeja
- `components/redaccion/redaccion-nav.tsx` — nueva nav
