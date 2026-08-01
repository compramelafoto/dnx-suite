# Antes / después — Entregas y admisión técnica

## Admission

| Antes | Después |
|---|---|
| KPI “Admitidos” / “Sin entry FR” | “Aceptadas técnicamente” / “Sin vínculo FotoRank” |
| `status` enum en decisiones | Etiqueta ES + descripción + motivo humanizado |

## Entry

| Antes | Después |
|---|---|
| `entry {id}` en listado | “Disponible en FotoRank” / “Pendiente de enviar…”; ID en técnico |

## EXIF

| Antes | Después |
|---|---|
| `EXIF: {status}` | “Datos de captura disponibles / incompletos / no válidos” |

## MIME

| Antes | Después |
|---|---|
| (implícito / técnico) | Formato “JPEG/PNG…”; MIME solo en información técnica |

## Hash

| Antes | Después |
|---|---|
| `hash abc123…` visible | “Huella del archivo (hash)” dentro de `AdminTechnicalInfo` |

## Duplicado

| Antes | Después |
|---|---|
| Códigos `DUPLICATE_*` | “Posible fotografía duplicada” + explicación sin afirmar fraude |

## Fecha de captura

| Antes | Después |
|---|---|
| `Captura Δ: N min` | “Fecha de captura” + ayuda de cámara/dispositivo |

## Fecha de entrega

| Antes | Después |
|---|---|
| Sin etiqueta clara | “Fecha de entrega” = momento de envío a Clickatón |

## Aceptación técnica

| Antes | Después |
|---|---|
| “Aprobar técnicamente” | “Aceptar técnicamente” + disclaimer vs jurado |

## Rechazo

| Antes | Después |
|---|---|
| “Rechazar” | “Marcar como no válida” + confirmación de consecuencias |

## FotoRank

| Antes | Después |
|---|---|
| ID de entry como dato principal | Bloque “Envío a FotoRank” como etapa |

## Error

| Antes | Después |
|---|---|
| Mensajes/códigos crudos en UI | Motivo humanizado + próximo paso; códigos en técnico |

## Reintento

| Antes | Después |
|---|---|
| (sin UI de retry en estas rutas) | Documentado: no se agregó reintento real ni jobs nuevos |

## Información técnica

| Antes | Después |
|---|---|
| Hash/entry/EXIF/GPS mezclados | Colapsable cerrado por defecto |

## Vista móvil

| Antes | Después |
|---|---|
| Cards densas con mono/hash | Cards con síntesis, checklist, acciones full-width, filtros colapsables |
