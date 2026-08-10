# Bases y Condiciones Clickatón — Borrador v3 (jurado, elegibilidad, votación pública)

**Estado:** DRAFT — **NO PUBLICADO**  
**Versión propuesta:** `CLICKATON_TERMS_2026_09_19_v3_DRAFT`  
**Supersede parcial de:** cláusulas competitivas de `CLICKATON_TERMS_2026_09_19_v2`  
**Fuente funcional:** `jury-and-public-voting-master-rules.md`  
**Fecha:** 2026-08-10  

> **LEGAL REVIEW REQUIRED**  
> Este borrador **no** modifica el texto publicado en `apps/clickaton/content/legal-funnel.ts` (v2).  
> No afirmar automatización de Instagram como implementada.  
> No abrir jurado / resultados / votación pública hasta aprobación jurídica y etapa de implementación.

---

## A. Alcance de este borrador

Completa y aclara, respecto de la v2 publicada:

- elegibilidad competitiva (mínimo 8);
- admisión técnica;
- evaluación anónima del jurado;
- criterios y scoring;
- finalistas vs ganadores definitivos;
- votación pública por Me Gusta;
- desempate público;
- incidentes técnicos y extensiones;
- EXIF / metadata;
- premios por edición.

Las cláusulas de inscripción, precio, kit, privacidad, licencias promocionales y jurisdicción de la v2 permanecen vigentes hasta que Legal unifique v3.

---

## B. Cláusulas propuestas (copy para Bases)

### B.1 Reglas de consignas y elegibilidad competitiva

Hay 10 consignas (1 fotografía por consigna). El parámetro `minimumCompletedPrompts` de esta edición es **8** obras válidas/admisibles.

- Quien finalice con **8, 9 o 10** obras válidas/admisibles es **ELEGIBLE** y compite.
- Quien finalice con **7 o menos** es **NO ELEGIBLE**: queda descalificado de **toda** la competencia. Sus fotografías se conservan; **no** pasan al jurado; **no** puede obtener posición en una consigna individual.
- Si un participante tenía 8 obras válidas y una resulta **NO ADMISIBLE**, su conteo pasa a 7 y queda fuera de toda la competencia.

**LEGAL REVIEW REQUIRED** (efecto competitivo, conservación de obras, reembolsos).

### B.2 Admisión previa

Antes del jurado, cada obra atraviesa validación técnica y admisión. El organizador puede usar un semáforo GREEN / YELLOW / RED. Las señales automáticas débiles no implican rechazo automático. El rechazo confirmado requiere decisión humana auditada cuando corresponda.

**LEGAL REVIEW REQUIRED**.

### B.3 EXIF y metadatos

La plataforma puede leer metadatos técnicos (p. ej. DateTimeOriginal, dispositivo, orientación, dimensiones, presencia/ausencia de GPS, indicios de software de edición).  

- Los metadatos **no** prueban autoría por sí solos.  
- La ausencia de EXIF puede motivar revisión, no rechazo automático.  
- La plataforma no reescribe el EXIF original del archivo.  
- Puede detectarse un posible desajuste de reloj de cámara; cualquier corrección estimada es operativa y no modifica el archivo.

**LEGAL REVIEW REQUIRED** (privacidad, GPS, menores, evidencia).

### B.4 Jurado profesional (evaluación anónima)

El jurado profesional realiza una **evaluación** ciega. No determina al ganador definitivo de cada consigna: selecciona hasta **3 FINALISTAS** por consigna (hasta 30 finalistas en total). Una persona puede ser finalista en varias consignas.

Criterios de esta edición (escala entera 1–10, pesos iguales):

1. Interpretación de la consigna  
2. Creatividad / originalidad  
3. Composición / calidad fotográfica  

El jurado no ve identidad del participante ni datos comerciales durante la evaluación. Puede declarar conflicto de interés; la obra se reasigna sin penalizar al jurado.

**LEGAL REVIEW REQUIRED** (anonimato, conflictos, comentarios privados, menores).

### B.5 Votación pública

Tras el jurado, los finalistas de cada consigna participan en una **votación pública**. Unidad: consigna. Métrica: cantidad de **Me Gusta**. Duración: configurable por la organización (default operativo propuesto: 24 horas).  

El resultado de la votación pública determina el **1.º, 2.º y 3.º definitivos** de esa consigna. El carácter del voto público es **definitivo** respecto del orden de esos finalistas, sin perjuicio de empates y verificación.

**No se garantiza** que la votación se ejecute automáticamente vía Instagram u otra red en una versión dada de la plataforma; el canal y el método se comunicarán cuando estén operativos.

**LEGAL REVIEW REQUIRED** (voto público, redes, transparencia, fraude).

### B.6 Desempate público

Ante empate en la votación pública, **no** se usa el puntaje del jurado ni se suman scores. Se abre una nueva instancia pública de desempate (`PUBLIC_TIEBREAK`), de duración configurable. Puede repetirse. Si no puede verificarse el dato al cierre, no se declara ganador hasta verificación (`PENDING_PUBLIC_VOTE_VERIFICATION` o equivalente).

**LEGAL REVIEW REQUIRED**.

### B.7 Incidentes técnicos y extensiones

Ante incidente técnico acreditado, la organización puede extender de forma **global** la ventana de carga u otras ventanas operativas, dejando registro (horario anterior/nuevo, motivo, operador, timestamp). Extensiones individuales quedan reservadas a mecanismos excepcionales futuros.

**LEGAL REVIEW REQUIRED**.

### B.8 Premios

Las posiciones resultantes de la competencia no definen por sí solas la distribución de premios. Los premios y beneficios se establecen por edición y se comunican por canales oficiales.

**LEGAL REVIEW REQUIRED** (premios, impuestos, patrocinios).

### B.9 Decisión del organizador

Sin perjuicio de estas Bases y de derechos irrenunciables del consumidor, la organización puede resolver casos dudosos de admisión, integridad o operación conforme a las reglas de la edición y a la política técnica publicada, con registro cuando corresponda.

**LEGAL REVIEW REQUIRED**.

---

## C. Checklist de publicación v3

- [ ] Revisión jurídica completa  
- [ ] Unificación con cláusulas v2 vigentes  
- [ ] Actualización de `legal-funnel.ts` + versión constante  
- [ ] Comunicación a inscriptos si el cambio es material  
- [ ] FAQ / blog / manuales alineados  
- [ ] Confirmación humana de GO legal  

**No publicar v3 en runtime en esta etapa (15B).**
