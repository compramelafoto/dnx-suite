# Política de admisión técnica — Clickatón / FotoRank

**Etapa:** 15B  
**Estado:** CANÓNICO FUNCIONAL (documental)  
**Fuente maestra:** `jury-and-public-voting-master-rules.md`  
**LEGAL REVIEW REQUIRED** (EXIF, GPS, IA, menores, rechazo, retención).

---

## 1. Pipeline

```text
upload → validación técnica → admisión → elegibilidad → jurado
```

Una carga exitosa **no** implica obra ADMISIBLE ni participante ELEGIBLE.

---

## 2. Semáforo

| Estado | Significado | Auto-acción |
|--------|-------------|-------------|
| **GREEN** | Compatible / sin observaciones relevantes | Puede avanzar |
| **YELLOW** | Requiere revisión humana | **Nunca** auto-rechazar |
| **RED** | Incumplimiento confirmado o técnicamente no admisible | Requiere confirmación humana salvo corrupción ilegible |

### Capas de decisión

| Capa | Código conceptual | Quién |
|------|-------------------|-------|
| Señal detectada | `DETECTED_SIGNAL` | Sistema |
| Revisión manual | `MANUAL_REVIEW` | Operador |
| Rechazo confirmado | `CONFIRMED_REJECTION` | Operador / política |

---

## 3. Catálogo preliminar de motivos

### 3.1 GREEN (ejemplos)

- Archivo válido y legible  
- Consigna / slot correcto  
- Metadata coherente  
- Captura compatible con ventana  
- Upload dentro de ventana  

### 3.2 YELLOW — revisión humana (ejemplos)

| Código sugerido | Descripción |
|-----------------|-------------|
| `EXIF_MISSING` | EXIF ausente |
| `DATETIME_ORIGINAL_MISSING` | DateTimeOriginal ausente |
| `POSSIBLE_CAMERA_CLOCK_OFFSET` | Posible reloj desajustado |
| `GPS_MISSING` | GPS ausente (si la edición lo observa) |
| `EDITING_SOFTWARE_DETECTED` | Software de edición detectado |
| `PARTIAL_METADATA` | Metadata parcial |
| `POSSIBLE_DUPLICATE` | Posible duplicado |
| `DEVICE_UNIDENTIFIABLE` | Dispositivo no identificable |
| `DOUBTFUL_DATETIME` | Fecha dudosa |
| `DOUBTFUL_TIMEZONE` | Timezone dudosa |

### 3.3 RED / rechazo confirmado (ejemplos)

| Código sugerido | Descripción |
|-----------------|-------------|
| `CORRUPT_FILE` | Archivo corrupto |
| `UNREADABLE_FILE` | Archivo no legible |
| `DUPLICATE_FORBIDDEN` | Duplicado cuando las reglas lo prohíben |
| `CAPTURE_WINDOW_VIOLATION_CONFIRMED` | Fuera de ventana de captura confirmado |
| `FORBIDDEN_MANIPULATION_CONFIRMED` | Manipulación prohibida confirmada |
| `FORBIDDEN_AI_CONFIRMED` | IA prohibida confirmada |
| `PROHIBITED_CONTENT` | Contenido prohibido |
| `RULES_BREACH_CONFIRMED` | Incumplimiento expreso de bases |
| `WRONG_PROMPT_SLOT` | Obra no correspondiente a consigna/slot |
| `OTHER_MANDATORY_BREACH` | Otro incumplimiento obligatorio confirmado |

---

## 4. EXIF / metadatos

Campos que FotoRank puede leer: DateTimeOriginal, Make, Model, Lens (si existe), orientation, dimensiones, GPS presente/ausente, software de edición, otros técnicos disponibles.

Reglas duras:

1. EXIF **no** prueba autoría.  
2. EXIF **no** determina culpabilidad automática.  
3. EXIF ausente → YELLOW / `MANUAL_REVIEW`.  
4. **Nunca** reescribir EXIF original.

---

## 5. Clock offset (`POSSIBLE_CAMERA_CLOCK_OFFSET`)

Si el patrón EXIF es consistentemente desplazado (p. ej. −3 h):

Mostrar al operador:

- Hora EXIF original  
- Offset estimado  
- Hora corregida estimada  

Prohibido: modificar archivo/EXIF; auto-aprobar; auto-rechazar. Validación humana + auditoría.

---

## 6. Duplicados e IA

- Posible duplicado → YELLOW hasta confirmación.  
- Duplicado prohibido confirmado → RED / `CONFIRMED_REJECTION`.  
- Indicio de IA → señal; rechazo solo si **confirmado** según bases de la edición.

---

## 7. Elegibilidad tras admisión

Solo obras **ADMISIBLES** cuentan para el mínimo competitivo.

Si tras admisión el participante queda con menos de `minimumCompletedPrompts` (8 en la edición actual):

- estado **NO ELEGIBLE**;  
- obras se conservan;  
- **no** entran al roster del jurado.

El corte se congela antes de abrir jurado (ver checklist pre-jurado).
