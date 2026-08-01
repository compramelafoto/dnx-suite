# LEGAL_REVIEW — Consentimientos del funnel público

**Etapa:** 02 — Experiencia pública y checkout comprensible  
**Estado:** Pendiente de decisión humana / legal  
**Fecha:** 2026-08-01  

> Esta mejora visual **no valida** el consentimiento jurídicamente.  
> No se modificó el alcance, la persistencia ni las validaciones legales.

---

## Dónde aparece

| Ubicación | Archivo |
|---|---|
| Wizard de inscripción · paso participante | `components/public-registration/PublicRegistrationWizard.tsx` |
| Marcador en DOM | `data-legal-review="consent-funnel-single-checkbox"` |
| Comentario de código | `LEGAL_REVIEW` junto al bloque de consentimientos |
| Bases publicadas | `content/legal-funnel.ts` + `/legal/terminos` |
| Privacidad | `/legal/privacidad` |

---

## Texto actual (resumen operativo)

Un único checkbox. Al marcarlo, el cliente envía:

- `acceptTerms=true`
- `acceptPrivacy=true`
- `acceptImage=true`
- `imageUsageConsent=true`
- `socialPublicationConsent=true`
- `identifiablePersonsConsent=true`
- `promotionalLicenseConsent=true`
- `consentVersion=2026-08-social-v1`
- `termsVersion` (versión publicada de Bases)

En Etapa 02 se mejoró la **legibilidad** (título «Consentimientos y autorizaciones», lista de conceptos, enlaces a Bases y Privacidad) **sin cambiar** qué se persiste.

---

## Conceptos legales agrupados

1. Aceptación de Bases y Condiciones  
2. Política de Privacidad / tratamiento de datos  
3. Uso de imagen (foto de perfil → placa de bienvenida)  
4. Posible publicación en redes sociales del evento  
5. Personas identificables en fotografías (declaración)  
6. Licencia promocional de obras presentadas  
7. Uso de nombre / usuario de Instagram en piezas del evento  

---

## Validación actual

- El checkbox es obligatorio para avanzar del paso participante.  
- No hay consentimientos por defecto marcados.  
- No se dividen checkboxes en producción sin decisión humana.  

---

## Riesgo de comprensión

- La persona puede creer que solo acepta «bases» y no autorizaciones de imagen/redes.  
- La placa y la publicación social quedan acopladas a un solo acto.  
- No hay UI clara de revocación posterior del consentimiento.  

---

## Decisiones humanas pendientes

1. ¿Un solo consentimiento sigue siendo suficiente jurídicamente?  
2. ¿Hay que separar imagen / redes / licencia promocional?  
3. ¿Cómo se comunica la revocación o retiro del consentimiento?  
4. ¿El uso de Instagram y generación de placa requieren mención más explícita?  
5. ¿Quién aprueba el texto definitivo de cada casilla?  

---

## Propuesta no vinculante (futuro)

Separar, solo si legal/producto lo aprueban:

1. Acepto Bases y Privacidad (obligatorio).  
2. Autorizo uso de mi foto de perfil para la placa (obligatorio si el flujo exige foto).  
3. Autorizo posible publicación de la placa en redes del evento (explícito).  
4. Declaro autorizaciones sobre personas identificables / licencia promocional (según Bases).  

**No implementar** hasta decisión humana. No marcar opciones por defecto.

---

## Temas marcados para revisión futura

- Uso de imagen  
- Publicación en redes sociales  
- Uso de nombre y usuario de Instagram  
- Generación automática de placa  
- Uso de fotografías presentadas  
- Privacidad y tratamiento de datos  
- Revocación o retiro del consentimiento  
