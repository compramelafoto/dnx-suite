# Revisión de anonimización — Jurado (Clickatón)

**Alcance:** superficies Clickatón + contratos de hand-off.  
**No se modificó** el mecanismo `buildAnonymousJuryCode` ni el freeze.

---

## Datos que deben ocultarse al jurado

Lista canónica CK: `JURY_FORBIDDEN_IDENTITY_FIELDS` en `lib/technical-admission/anonymity.ts`

- Nombre / apellido  
- Email / teléfono / documento  
- Instagram  
- Número de participante Clickatón  
- Nombre original de archivo  
- authorUserId  
- GPS lat/long  

## Dónde Clickatón muestra (o no) identidad

| Superficie | ¿Identidad del fotógrafo? | Notas |
|---|---|---|
| Panel jurado CK | N/A | No existe |
| Export `mode=jury` | No | `codigo_anonimo`, categoría, consigna, asset, batch, sha256 |
| Export `mode=admin` | Sí | Admin-only |
| Admin envíos | Sí | Admin-only; no es panel jurado |
| Admin admisión | No nombres | IDs en técnico |
| Pública `MarathonJury` | Perfiles del **jurado** | Correcto; no revela autores evaluados |
| Pública resultados | Sin ranking hasta published | Placeholder no lista autores |
| `JuryHandoffCard` | No | Solo conteos / estado lote |

## Texto alternativo

- Helpers: `anonymousWorkAltText` → sin nombre de participante.  
- Galería pública: alt genérico de edición (fotos autorizadas, no evaluación).  
- Retratos de jurado: alt con nombre del **jurado** (público intencional).

## Nombres de archivo / URLs / metadatos

- Keys privadas no se exponen en UI jurado (no hay UI).  
- Preview admin de envíos usa fallback sin URL privada (Imp. 05).  
- Export jury no incluye `originalFileName`.

## Logs visibles en UI

- Errores de sync de inscripción: mensaje humano; códigos en `AdminTechnicalInfo`.  
- No se muestran tokens de invitación.

## Riesgos encontrados

1. **Gap estructural:** la evaluación real está en FotoRank; esta revisión no audita HTML del panel `/jurado` de FR.  
2. Admin envíos sigue mostrando PII (correcto para admin, incorrecto si se reutilizara como vista jurado).  
3. `sha256` en export jury es huella de archivo (soporte), no identidad directa; no se elevó a UI admin principal.

## Correcciones realizadas (presentación)

- Avisos de anonimización en hand-off y sección pública de jurado.  
- Helpers de obra anónima / alt text.  
- Sync de inscripción: IDs fuera de la línea principal.

## Riesgos pendientes

- Auditoría de UI FotoRank (`apps/fotorank/app/jurado/**`) fuera del alcance de no modificar motor FR en este brief CK.  
- Confirmar que assets de jurado strippean metadatos identificatorios en todos los caminos (lógica existente de admission jury asset).  
- `LEGAL_REVIEW` sobre definición de conflicto de interés y mensajes al jurado.
