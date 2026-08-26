# Experiencia del participante — ETAPA 03 IMPLEMENTACIÓN 01

Rama: `feat/fotorank-super-admin-09b` · Commit base: `43553fb`

## Estado

**PARTIAL** — área de listado + detalle + estados/próximos pasos listos.  
La experiencia completa de **carga de fotografías** no se declara terminada (fuera de alcance; carga sigue cerrada según ventana real).

## Arquitectura

| Nivel | Ruta | Rol |
|-------|------|-----|
| 1 | `/participaciones` | Resumen de todas las inscripciones |
| 2 | `/participaciones/[id]` | Detalle operativo de una participación |

Ownership: `participantUserId` en query. Si no hay match → `notFound()` (sin revelar existencia ajena).

## Fuentes reales

- Inscripción: `FotorankContestRegistration` (`status`, `paymentStatus`, `registrationNumber`, categoría).
- Obra: `FotorankContestEntry` (status, admisión, review, motivo público).
- Ventana de carga: `submissionOpensAt` / `submissionDeadline` (fallback reg./start) — misma lógica que `entry-service`.
- Resultados publicados: `FotorankResultBatch` status `PUBLISHED`.
- Categoría semántica: reutiliza `contest-public-presentation` (IMPL 04).

## Traducciones

Resolver: `participant-experience/status-labels.ts`  
Nunca se muestra el enum técnico al participante.

## Acciones

`resolveParticipantNextAction` — evita CTA “Cargar fotografías” si la ventana está cerrada.

## Carga cerrada

Bloque informativo (no error). Sin drag-and-drop ni botón activo engañoso.  
En `/inscripcion` con carga cerrada: aviso + volver al detalle. Se eliminó la promesa “te avisaremos” (no hay canal garantizado).

## Selfcheck

```bash
pnpm --filter fotorank test:participant-experience:selfcheck
```

## Capturas

`.tmp/fotorank-etapa03-impl01-visual/`

## Pendiente — ETAPA 03 IMPLEMENTACIÓN 02

- Flujo guiado de carga (rediseño `EntryUploadPanel`).
- Hydrate inicial de obras / previews protegidos.
- Notificaciones reales de apertura de carga (si producto lo define).
- Pulido mobile de estados de corrección/admisión con fixtures.
