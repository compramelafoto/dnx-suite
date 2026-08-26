# Santa Fe en Foco — Decisiones funcionales

**Etapa:** SANTA FE — ETAPA 05  
**Estado:** `CONFIRMED BY ORGANIZER` (reglas de producto)  
**Legal:** `LEGAL REVIEW REQUIRED` — no publicar bases ni abrir inscripción real.

## Participación

- Participación **abierta**.
- **No** se exige residencia, domicilio, nacimiento ni DNI santafesino.
- El criterio geográfico aplica a la **fotografía**, no al domicilio del participante.

Texto funcional:

> La participación es abierta. No es necesario residir en la Provincia de Santa Fe. La fotografía presentada deberá haber sido realizada dentro del territorio de la Provincia de Santa Fe y durante el período oficial establecido para el concurso.

## Territorio de la fotografía

- Localidad/paraje obligatorio.
- Confirmación “tomada en Provincia de Santa Fe” obligatoria.
- GPS opcional; no se publica; ausencia no rechaza; inconsistencia → revisión manual.

## Período de captura

- Fuente principal: `DateTimeOriginal` (timezone `America/Argentina/Cordoba`).
- Ausente / fuera / inválida → revisión manual (no auto-rechazo irreversible v1).

## Cantidad

- `maxEntriesPerRegistration = 1`
- `maxCategoriesPerRegistration = 1`
- Una fotografía; una categoría.

## Categorías oficiales

| Nombre | Slug | Dispositivo | Extra |
| ------ | ---- | ----------- | ----- |
| Fotógrafo Profesional | `fotografo-profesional` | Cámara (no celular, no dron) | Celular → revisión |
| Fotógrafo Amateur | `fotografo-amateur` | Celular o cámara | Dron no |
| Reportero Gráfico | `reportero-grafico` | Cámara | ARGRA obligatorio, privado, verificación manual |
| Fotografía Aérea | `fotografia-aerea` | Dron | LEGAL REVIEW REQUIRED |

ARGRA: `PENDING_INSTITUTIONAL_APPROVAL` + `LEGAL REVIEW REQUIRED`. Sin logos ni afirmación de asociación.

## Preset

Fuente: `apps/fotorank/app/lib/fotorank/rules-config/santa-fe-en-foco-2026.ts`  
`residencyRequired: false`.

## Pendientes organizador / legal

- Fechas definitivas de publicación/jurado/premios si cambian.
- Edad / finalistas / licencia / contacto.
- Revisión jurídica completa y aprobación institucional ARGRA.
