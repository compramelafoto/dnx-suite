# Guía para organizadores — Bases y Condiciones en FotoRank

## Idea clave

Primero configurás el concurso (reglas estructuradas).  
Después generás o importás el texto de las Bases.  
Las Bases **no** reemplazan la configuración: deben coincidir con ella.

Rutas:

1. `/dashboard/concursos/[id]/configuracion` — motor de reglas  
2. `/dashboard/concursos/[id]/bases` — texto, revisión y publicación  

---

## 1. Configurar

1. Abrí **Configuración estructurada**.  
2. Cargá el preset (p. ej. Santa Fe en Foco) o completá el asistente.  
3. Guardá borrador y publicá la configuración (o «aplicar técnico» en staging).  
4. Resolvé pendientes humanos (menores, jurado, etc.) antes de publicación formal.

## 2. Generar prompt para ChatGPT

En **Bases**:

1. Pulsá **Generar borrador de Bases / Copiar prompt**.  
2. Copiá el prompt al portapapeles.  
3. Pegalo en ChatGPT.  
4. Pedí que responda **solo** con el JSON indicado (incluye `rulesDocument` y `declaredConfigurationHash`).

Reglas que el prompt ya impone a la IA:

- no inventar reglas  
- no convertir recomendaciones (EXIF/GPS) en obligaciones  
- marcar vacíos en `missingDecisions`  

## 3. Importar

Dos opciones:

- **Importar documento:** pegá Markdown/texto.  
- **Importar JSON:** pegá la respuesta completa de ChatGPT.

El sistema:

- asocia el texto a la configuración publicada  
- calcula hashes  
- corre comparación y checklist de secciones  
- deja estado `GENERATED` (nunca publica sola)

## 4. Revisar

El panel muestra:

- resumen de configuración  
- documento  
- coincidencias / contradicciones / secciones / notas legales  

Acciones:

- Comparar  
- Enviar a revisión  
- Solicitar cambios  
- Aprobar (humano)  
- Marcar revisión jurídica  

## 5. Resolver contradicciones

Si aparece `CONFLICT` o `EXTRA_RULE`:

1. Corregí el **texto** (recomendado), o  
2. Ajustá la **configuración** y creá una nueva versión de bases asociada.

Ejemplos típicos:

- texto dice «GPS obligatorio» pero config es RECOMMENDED  
- texto inventa peso máximo cuando no hay límite reglamentario  
- texto cobra inscripción en un concurso FREE  

## 6. Publicar nueva versión

Solo si está `APPROVED` y la revisión jurídica no está `PENDING` (en producción).

1. Publicar (aprobada)  
2. La versión anterior pasa a `ARCHIVED`  
3. Las inscripciones ya hechas **conservan** la versión que aceptaron  
4. **No** se abre el concurso automáticamente  

## 7. Participantes

Al inscribirse ven la versión publicada y deben aceptar por separado:

- bases  
- licencia  
- (si 16–17) autorización de adulto responsable  
- comunicaciones promocionales (opcional)  
