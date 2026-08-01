# Etapa 02 Imp. 04 — Cronograma, consignas y automatizaciones

**Estado:** DONE (con riesgos horarios documentados y `LEGAL_REVIEW`)  
**Fecha:** 2026-08-01  
**Alcance:** presentación admin de cronograma y consignas.  
**No modificado:** Prisma, jobs, crons, workers, scheduler, triggers, lógica temporal, FotoRank, APIs, permisos, estados persistidos.

---

## Rutas intervenidas

| Ruta | Cambio |
|---|---|
| `/admin/ediciones/[editionId]/cronograma` | Copy, próximo evento, borrador/publicado, confirmaciones, técnico |
| `/admin/ediciones/[editionId]/consignas` | Resumen, formulario humano, publicar vs guardar, preview sin JSON |

Fuera de profundidad (sin cambios en esta etapa): envíos, admisión, social, finanzas.

---

## Componentes modificados / creados

**Creados**

- `lib/timeline/ui/timeline-status-presentation.ts`
- `lib/timeline/ui/timeline-status-presentation.test.ts`
- `components/admin/ConfirmSubmitButton.tsx`

**Modificados**

- Páginas cronograma y consignas
- `package.json` (`test:timeline-ux`)

---

## Estados traducidos

Ver `timeline-status-map.md`.

---

## Acciones renombradas

| Antes | Después |
|---|---|
| Asegurar DRAFT | Crear borrador de cronograma |
| Activar versión | Publicar cronograma |
| Contingencia / pausa | Pausar por contingencia |
| Guardar evento | Guardar cambios |
| Desplazar futuros → nueva DRAFT | Pasar hitos futuros a un nuevo borrador |
| Liberar consigna ahora | Publicar ahora |
| Guardar (consigna) | Guardar cambios |
| Options DRAFT/READY/LOCKED | En preparación / Lista / Programada · oculta |

---

## Guardar vs programar vs publicar

| Acción | Efecto (según código existente) |
|---|---|
| Guardar cambios (evento/consigna) | Persiste datos; no publica sola |
| Publicar cronograma | `activateTimeline` sobre borrador |
| Publicar ahora (consigna) | `releasePromptManual` — visible de inmediato |
| Programada · oculta | Estado LOCKED/READY: oculta hasta apertura |

---

## Visibilidad

Badges separados: estado de preparación vs “Visible/Oculta para participantes” derivados del DTO público simulado.

---

## Responsive

- Cards mobile en cronograma publicado
- Formularios 1 col en mobile
- CTAs `min-h-11` / full width
- Sin tablas `min-w-[640+]`
- JSON de preview movido a técnico colapsable

---

## Información técnica

`AdminTechnicalInfo`: ISO server, IDs, event types, payload sanitizado de preview.

---

## Riesgos pendientes

1. `datetime-local` del borrador sigue usando offset del runtime al serializar (preexistente).
2. Pausar se dispara sobre ID de borrador (comportamiento previo).
3. No hay UI de jobs/crons genéricos; solo copy de “acciones automáticas” del cronograma.
4. Ventanas 14:00–22:00 son copy de referencia AR2026, no editables en esta pantalla.

---

## Fallas previas ajenas

- Posible Prisma `coverImageVerticalUrl` en build estático.
