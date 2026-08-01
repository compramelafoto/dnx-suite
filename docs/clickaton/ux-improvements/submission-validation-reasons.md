# Motivos de validación / admisión — presentación

**Fuente:** capas de presentación Imp. 05.  
**Regla:** no inventar motivos; no cambiar significado; no convertir advertencias en rechazos.

Marcado `LEGAL_REVIEW` donde el copy toca descalificación, metadatos, ubicación, fecha, duplicación o límites de corrección.

---

## Captura / procesamiento (failure / captureEval)

| Código interno | Título visible | Explicación admin | Mensaje participante (si existe) | Gravedad | Auto/humano | Corrección | LEGAL_REVIEW |
|---|---|---|---|---|---|---|---|
| `EXIF_CAPTURE_DATE_ABSENT` | No pudimos comprobar la fecha de captura | Sin fecha utilizable; no afirma fraude | Revisar archivo original | warning | auto | si ventana lo permite | sí |
| `CAPTURE_WINDOW_NOT_CONFIGURED` | Ventana de captura no configurada | Falta horario | — | warning | mixed | config admin | no |
| `WITHIN_CAPTURE_WINDOW` | Fecha de captura dentro del horario | OK según archivo | — | info | auto | — | no |
| `WITHIN_TOLERANCE` | Fecha de captura dentro de la tolerancia | Cerca del límite | — | warning | auto | — | no |
| `CAPTURE_OUTSIDE_WINDOW` | Fecha de captura fuera del horario permitido | Según archivo, fuera de ventana | Fuera de ventana permitida | blocking | auto | no ampliar plazos | sí |
| `CAPTURE_OUTSIDE_WINDOW_EXTREME` | Fecha de captura muy fuera del horario | Claramente fuera | Fuera de ventana permitida | blocking | auto | — | sí |
| `INVALID_MIME` | Formato no permitido | Tipo no admitido | Formato no admitido | blocking | auto | otro archivo si hay plazo | sí |
| `CORRUPT_IMAGE` | Archivo no legible | No se pudo analizar | No pudimos leer el archivo | blocking | auto | — | no |
| `DUPLICATE_SAME_PROMPT` | Posible fotografía duplicada | Mismo archivo/consigna | Ya enviaste este archivo | blocking | auto | — | sí |
| `DUPLICATE_OTHER_PROMPT` | Posible fotografía duplicada | Otra consigna | — | warning | mixed | — | sí |
| `DUPLICATE_OTHER_PARTICIPANT` | Posible fotografía duplicada | Otro participante | En revisión | blocking | mixed | — | sí |
| `PROCESSING_FAILED` | No pudimos analizar el archivo | Sigue registrada | — | blocking | auto | revisión | no |

## Admisión (`ReasonCode`)

| Código interno | Título visible | Gravedad | LEGAL_REVIEW |
|---|---|---|---|
| `SUBMISSION_NOT_CONFIRMED` | Entrega no confirmada | blocking | no |
| `PAYMENT_NOT_APPROVED` | Inscripción sin pago confirmado | blocking | sí |
| `ENTRY_MISSING` | Sin vínculo con FotoRank | blocking | no |
| `ORIGINAL_MISSING` | Falta el archivo original | blocking | sí |
| `HASH_MISSING` | Falta verificación de integridad | blocking | no |
| `DECLARATION_MISSING` | Falta la declaración del participante | blocking | sí |
| `PROMPT_NOT_RELEASED` | Consigna no disponible | blocking | no |
| `UPLOAD_OUTSIDE_WINDOW` | Entrega fuera de plazo | blocking | sí |
| `CAPTURE_OUTSIDE_WINDOW` | Fecha de captura fuera del horario permitido | blocking | sí |
| `EXIF_FAIL` | Datos de captura no válidos | blocking | sí |
| `GPS_REQUIRED_MISSING` | Ubicación no verificable | blocking | sí |
| `DUPLICATE_BLOCKING` | Posible fotografía duplicada | blocking | sí |
| `MIME_INVALID` | Formato no permitido | blocking | sí |
| `EXIF_WARNING` | Advertencia en datos de captura | warning | sí |
| `GPS_OPTIONAL_MISSING` | Ubicación no informada | warning | no |
| `METADATA_INCOMPLETE` | Datos insuficientes | warning | sí |
| `DUPLICATE_REVIEW` | Posible fotografía duplicada | warning | sí |
| `EXIF_INCONSISTENT` | Datos de captura inconsistentes | warning | sí |
| `ACCREDITATION_MISSING` | Falta acreditación | blocking | sí |
| `ACCREDITATION_EXCEPTION` | Excepción de acreditación | warning | sí |
| `TIMEZONE_AMBIGUOUS` | Zona horaria ambigua | warning | sí |
| `ADMIN_EXCEPTION` | Decisión administrativa | blocking | sí |
| `FOTORANK_SYNC_DELAY` | Demora en FotoRank | warning | no |
| `WRONG_EDITION` / `WRONG_CONTEST` / `CATEGORY_INCOMPATIBLE` | Edición/concurso/categoría incorrecta | blocking | no |
| `ENTRY_REPLACED` / `ENTRY_WITHDRAWN` | Reemplazada / Retirada | blocking | no |
| `PROCESSING_INCOMPLETE` | Procesamiento incompleto | blocking | no |

## Notas

- No se modificó `publicReasonForStatus` en reglas (sigue siendo la fuente de mensajes públicos persistidos).  
- La UI admin muestra títulos humanizados; el texto público ya guardado se muestra como “Lo que puede ver el participante”.  
- No se afirma fraude ni manipulación automática.
