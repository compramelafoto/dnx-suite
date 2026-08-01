# Clickatón — Brecha legal: placas de participante (Template V2)

**Etapa:** 07 — Auditoría legal (solo gaps; no reescribe textos legales)  
**Fecha:** 2026-08-01  
**Referencia técnica:** `clickaton-participant-cards-integration.md`

---

## Consentimientos existentes en datos

Campos persistidos en `ClickatonRegistration` relevantes para placas:

| Campo | Origen típico | Uso actual en código |
|-------|---------------|----------------------|
| `imageUsageConsent` | Checkbox único del wizard (`acceptImage` / términos) | **Proxy de gate** (`hasClickatonCardConsent`) |
| `acceptedImageAt` | Timestamp al aceptar imagen | **Proxy de gate** |
| `termsAcceptedAt` | Aceptación de Bases | **Proxy de gate** |
| `acceptedTermsAt` | Alias/legacy de términos | **Proxy de gate** |
| `socialPublicationConsent` | Mismo checkbox único | **No** usado en gate de generación |
| `consentAcceptedAt`, `termsVersion`, `consentVersion` | Auditoría funnel | No evaluados en gate de placas V2 |

Persistencia del wizard: un solo checkbox envía `imageUsageConsent=true` y `socialPublicationConsent=true` junto con `acceptTerms` (ver `PublicRegistrationWizard.tsx`, doc `ux-improvements/legal-review-consents.md`).

---

## Cláusula legal existente — «Foto de perfil y placa de bienvenida»

Ubicación: `content/legal-funnel.ts` → Bases públicas `/legal/terminos`.

**Alcance declarado en la cláusula (resumen operativo, sin reescribir el texto legal):**

- Autoriza uso de la **foto de perfil** para generar y mostrar la **placa de bienvenida (Welcome Card)**.
- Usos mencionados: visualización en Mi cuenta, descarga por el participante, uso operativo/comunicacional del evento, identificación en piezas digitales del participante.
- Menciona **publicación social** de la placa cuando la organización lo active (no automática al inscribirse).
- Forma parte de la aceptación de Bases cuando el flujo exige foto de perfil.

Cláusula relacionada «Datos personales…» remite explícitamente a «Foto de perfil y placa de bienvenida» para el tratamiento de foto y placa de bienvenida.

---

## Cobertura actual vs. implementación técnica

| Aspecto | ¿Cubierto por textos/consent existentes? | Notas |
|---------|------------------------------------------|-------|
| Placa **Welcome** (`welcome`) | **Parcialmente explícito** | Cláusula nombra «placa de bienvenida» |
| Placa **Member** (`member`, «Soy parte») | **No explícito** | Misma foto y datos; plantilla distinta no nombrada en Bases |
| Descarga on-demand por participante | **Sí** (implícito en cláusula welcome) | Implementado en Mi cuenta |
| Uso operativo/comunicacional admin | **Sí** (welcome) | Preview/descarga admin sin publicación automática |
| Handle **Instagram** en placa | **Parcial** | Aparece en pieza; cláusula agrupa «identificación en piezas digitales» pero no detalla @handle |
| Formato **Instagram Story** (1080×1920) | **No explícito** | Formato técnico no descrito en Bases |
| Reutilización **institucional** más allá del evento | **No claro** | Cláusula acota al marco Clickatón / DNX Suite del evento |
| Publicación en redes (`socialPublicationConsent`) | **Texto sí; gate código no** | Consent se persiste pero **no** bloquea generación V2 |
| Regeneración bajo demanda (sin asset persistido) | **No explícito** | Distinto del pipeline legacy con asset almacenado |

---

## Gaps identificados

1. **Placa Member / «Soy parte de Clickatón»** — No hay cláusula específica ni consentimiento separado; el gate técnico trata welcome y member igual (mismo proxy de imagen/términos).

2. **Instagram en la placa** — El handle se renderiza en ambas plantillas. No hay consentimiento granular «mostrar mi @ en piezas descargables/compartibles» aparte del paquete único del wizard.

3. **Reutilización institucional** — La cláusula welcome acota al evento vinculado a la inscripción. No define explícitamente uso en otros productos DNX, archivo permanente de placas generadas on-demand, ni materiales fuera del ciclo del evento.

4. **`socialPublicationConsent` desacoplado del gate** — Legalmente el checkbox agrupa publicación social; técnicamente la generación/descarga no exige ese flag. Riesgo de interpretación: el participante puede descargar/compartir manualmente sin que el organizador haya «activado» publicación oficial.

5. **Un solo checkbox** — Documentado en `legal-review-consents.md` como decisión pendiente: comprensión vs. granularidad (imagen / redes / licencia promocional).

6. **Revocación** — No hay flujo de producto para retirar consentimiento y bloquear nuevas generaciones (solo estado histórico en DB).

7. **Auto-generación al pago** — El sistema legacy (`welcome-card` post-PAID) y el V2 on-demand coexisten conceptualmente; la cláusula habla de generación/mostrado pero no distingue pipelines.

---

## Decisiones legales pendientes

1. ¿La cláusula «placa de bienvenida» cubre también la placa **Member** y futuras variantes Template V2?

2. ¿Se requiere mención explícita de **Instagram Story**, handle visible y compartir por el propio participante?

3. ¿Debe exigirse `socialPublicationConsent` (o un flag nuevo) para **generar** placas, o solo para **publicación oficial** por el organizador?

4. ¿Conviene separar consentimientos (Bases / imagen placa / redes / licencia obras) antes de ampliar tipos de placa?

5. ¿Política de **retención** si no se persiste PNG pero sí se loguean métricas y se lee foto de perfil en cada render?

6. ¿Quién aprueba texto si se agrega checkbox o cláusula específica para «Soy parte» y reutilización institucional?

---

## Acciones técnicas NO realizadas (por diseño Etapa 07)

- No se modificaron textos en `content/legal-funnel.ts` ni páginas `/legal/*`.
- No se agregaron flags DB ni checkboxes nuevos.
- No se cambió `hasClickatonCardConsent()` — sigue usando proxy imagen/términos documentado en integración.

**Próximo paso recomendado:** revisión legal humana con este gap doc + `ux-improvements/legal-review-consents.md` antes de ampliar plantillas o exigir consentimientos adicionales en código.
