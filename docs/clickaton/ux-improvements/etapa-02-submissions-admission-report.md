# Etapa 02 — Imp. 05 — Entregas fotográficas y admisión técnica

**Estado:** DONE (presentación)  
**Alcance:** solo copy, jerarquía, responsive, mapas de estado visibles y confirmaciones.  
**No modificado:** Prisma, validadores, reglas de admisión, R2, FotoRank, APIs, permisos, estados persistidos.

---

## Rutas intervenidas

| Ruta | Cambio |
|---|---|
| `/admin/ediciones/[editionId]/envios` | Listado + detalle por card humanizado; filtros ES; checklist; FotoRank; técnico colapsable |
| `/admin/ediciones/[editionId]/admision` | KPIs humanos; lote; decisiones recientes; confirmaciones sensibles |

---

## Componentes modificados

- `AdminPageHeader` (vía páginas)
- Uso de `AdminTechnicalInfo`, `ConfirmSubmitButton`, `Badge`, `Card`, `Button`

## Componentes creados

- `components/admin/submissions/SubmissionFiltersPanel.tsx`
- `components/admin/submissions/ValidationChecklist.tsx`
- `components/admin/submissions/SubmissionPhotoPreview.tsx`
- `lib/photo-upload/ui/submission-status-presentation.ts`
- `lib/technical-admission/ui/admission-status-presentation.ts`

---

## Estados traducidos

Ver `submission-admission-status-map.md`.

Incluye: estados de entrega, resultado de validación, vínculo FotoRank, estados de admisión y lote.

## Motivos humanizados

Ver `submission-validation-reasons.md`.

Códigos de captura/duplicado/MIME y `ReasonCode` de admisión con título, explicación admin y mensaje participante cuando ya existía separación.

## Diferencia validación técnica vs jurado

Texto fijo en ambas pantallas:

> La validación técnica comprueba requisitos de archivo, fecha, consigna y entrega. **No determina si la fotografía será finalista o ganadora.**

Etiquetas preferidas: “Aceptada técnicamente”, “Lista para el jurado”, “Requiere revisión técnica”.

## Estrategia de listado

1. Participante  
2. Consigna  
3. Estado técnico  
4. Alerta / síntesis operativa  
5. FotoRank  
6. Fecha de entrega  
7. Acción “Revisar entrega” (ancla al card)

IDs, hash, MIME, storage keys y coordenadas quedan en `AdminTechnicalInfo`.

## Estrategia móvil

- Filtros colapsables (`SubmissionFiltersPanel`)
- Cards apiladas (única columna)
- Tabla solo `md+`
- Acciones de ancho completo en mobile
- Técnico cerrado por defecto

## Vista previa

No hay proxy autenticado para `clickaton/private/` (y no se creó API nueva).  
`SubmissionPhotoPreview` muestra fallback estructural:

- “No pudimos mostrar la vista previa”
- “El archivo sigue registrado…”

## Checklist

`ValidationChecklist` deriva de campos existentes (`technicalSummaryJson`, EXIF/GPS status, validationResult, etc.). No reejecuta validadores.

## Integración FotoRank

Presentada como etapa: “Envío a FotoRank”.  
Estados visibles: pendiente / disponible / no aplica. IDs en técnico.

## Información técnica reubicada

Cerrada por defecto en cada entrega y en cada decisión de admisión.

## Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm test:submissions-ux` | OK (14/14) |
| `tsc --noEmit` | OK |
| `eslint` archivos modificados | OK |
| `pnpm selfcheck:photo-upload` | OK (33) |
| `pnpm selfcheck:technical-admission` | OK (32) |
| `pnpm build` | OK |
| E2E | No ejecutados (sin entorno E2E dedicado en esta sesión) |

## Resultados por resolución

Validación estructural (layout cards + tabla desktop). Sin admitir/rechazar obras reales ni sync productivos.

| Viewport | Resultado esperado |
|---|---|
| 320×568 | Cards 1 col, sin tabla, filtros colapsables |
| 360×800 | Igual |
| 390×844 | Igual |
| 430×932 | Igual |
| Escritorio | Tabla resumen + cards detalle |

## Fallas previas ajenas

Posible aviso Prisma `coverImageVerticalUrl` en build estático (ya documentado en etapas previas).

## Riesgos pendientes

1. Vista previa real de archivos privados requiere endpoint autenticado futuro (fuera de alcance).  
2. Mensajes públicos de rechazo / descalificación → `LEGAL_REVIEW`.  
3. No hay página de detalle con ruta propia: el “detalle” es el card anclado en el listado (sin cambiar rutas).  
4. Confirmaciones usan `window.confirm` (mismo patrón Imp. 04).
