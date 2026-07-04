# ✅ VERIFICACIÓN PASO A PASO - Reconocimiento Facial

## 🎯 OBJETIVO
Verificar y configurar el sistema de reconocimiento facial para que funcione correctamente.

---

## 📝 PASO 1: VERIFICAR VARIABLES DE ENTORNO

### 1.1 Abrir archivo `.env` y verificar estas variables:

```env
# CRON SECRET (obligatorio)
CRON_SECRET=tu_secret_token_aqui

# AWS REKOGNITION (obligatorio para reconocimiento facial)
AWS_ACCESS_KEY_ID=tu_access_key_id
AWS_SECRET_ACCESS_KEY=tu_secret_access_key
AWS_REGION=us-east-1
REKOGNITION_COLLECTION_ID=compramelafoto-faces

# GOOGLE VISION API (obligatorio para OCR)
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}

# R2 STORAGE (obligatorio para descargar imágenes)
R2_ENDPOINT=https://tu-bucket.r2.cloudflarestorage.com
R2_BUCKET_NAME=compramelafoto-prod
R2_ACCOUNT_ID=tu_account_id
R2_ACCESS_KEY_ID=tu_r2_access_key
R2_SECRET_ACCESS_KEY=tu_r2_secret_key
```

### 1.2 Verificar rápidamente (opcional):

```bash
node -e "console.log('CRON_SECRET:', process.env.CRON_SECRET ? '✅' : '❌')"
node -e "console.log('AWS_REGION:', process.env.AWS_REGION || '❌ NO CONFIGURADO')"
node -e "console.log('REKOGNITION_COLLECTION_ID:', process.env.REKOGNITION_COLLECTION_ID || '❌ NO CONFIGURADO')"
```

**✅ Si todas están configuradas:** Continúa al Paso 2  
**❌ Si falta alguna:** Agrégalas al `.env` y reinicia el servidor

---

## 📝 PASO 2: VERIFICAR BASE DE DATOS

### 2.1 Verificar tablas necesarias:

Ejecuta en tu base de datos o usa Prisma Studio:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('Photo', 'PhotoAnalysisJob', 'FaceDetection', 'OcrToken');
```

**✅ Si existen las 4 tablas:** Continúa al Paso 3  
**❌ Si falta alguna:** Ejecuta:
```bash
npx prisma db push
npx prisma generate
```

---

## 📝 PASO 3: VERIFICAR ESTADO DEL SISTEMA

### 3.1 Ejecutar script de diagnóstico:

```bash
node scripts/test-facial-recognition.js
```

Este script verifica automáticamente:
- ✅ Variables de entorno
- ✅ Conexión a AWS Rekognition
- ✅ Base de datos y tablas
- ✅ Estado de fotos y jobs
- ✅ Endpoint de estado

**✅ Si todo pasa:** Continúa al Paso 4  
**❌ Si hay errores:** Revisa los mensajes y corrige los problemas indicados

---

## 📝 PASO 4: VERIFICAR CREDENCIALES AWS

### 4.1 Verificar acceso a AWS Rekognition:

Crea un archivo temporal `test-aws.js`:

```javascript
const { RekognitionClient, ListCollectionsCommand } = require("@aws-sdk/client-rekognition");
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const client = new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function test() {
  try {
    const response = await client.send(new ListCollectionsCommand({}));
    console.log("✅ AWS Rekognition conectado correctamente");
    console.log("Colecciones:", response.CollectionIds);
    
    if (process.env.REKOGNITION_COLLECTION_ID) {
      const exists = response.CollectionIds?.includes(process.env.REKOGNITION_COLLECTION_ID);
      if (exists) {
        console.log(`✅ Colección "${process.env.REKOGNITION_COLLECTION_ID}" existe`);
      } else {
        console.log(`⚠️ Colección "${process.env.REKOGNITION_COLLECTION_ID}" no existe (se creará automáticamente)`);
      }
    }
  } catch (err) {
    console.error("❌ Error conectando a AWS:", err.message);
    console.error("Verifica tus credenciales AWS en la consola de AWS");
  }
}

test();
```

Ejecuta:
```bash
node test-aws.js
```

**✅ Si conecta correctamente:** Continúa al Paso 5  
**❌ Si falla:** Verifica tus credenciales AWS en la consola de AWS

---

## 📝 PASO 5: VERIFICAR GOOGLE VISION API

### 5.1 Verificar formato del JSON:

```bash
node -e "try { JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON); console.log('✅ JSON válido'); } catch(e) { console.log('❌ JSON inválido:', e.message); }"
```

**✅ Si el JSON es válido:** Continúa al Paso 6  
**❌ Si es inválido:** Verifica que el JSON esté correctamente escapado en el `.env`

### 5.2 Verificar permisos:

Asegúrate de que la cuenta de servicio tenga:
- ✅ Cloud Vision API habilitada
- ✅ Permisos de lectura de imágenes

---

## 📝 PASO 6: VERIFICAR ACCESO A R2 (CLOUDFLARE)

### 6.1 Verificar que las fotos tengan `originalKey`:

```sql
SELECT 
  id, 
  "originalKey", 
  "analysisStatus" 
FROM "Photo" 
WHERE "isRemoved" = false 
AND "originalKey" IS NOT NULL 
LIMIT 5;
```

**✅ Si hay fotos con `originalKey`:** Continúa al Paso 7  
**❌ Si `originalKey` es NULL:** Las fotos no se están subiendo correctamente a R2

---

## 📝 PASO 7: EJECUTAR ANÁLISIS MANUALMENTE

### 7.1 Obtener estado actual:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/internal/analysis/status
```

**Respuesta esperada:**
```json
{
  "photos": [
    { "status": "PENDING", "count": 5 },
    { "status": "DONE", "count": 150 }
  ],
  "jobs": [
    { "status": "PENDING", "count": 5 }
  ],
  "missingJobs": 0,
  "recentErrors": []
}
```

### 7.2 Ejecutar análisis con debug:

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/internal/analysis/run?debug=1"
```

**Respuesta esperada:**
```json
{
  "ok": true,
  "processed": 10,
  "backfilled": 5,
  "errors": [],
  "debugChecks": [...]
}
```

**✅ Si procesa fotos sin errores:** Continúa al Paso 8  
**❌ Si hay errores:** Revisa el array `errors` y los logs del servidor

---

## 📝 PASO 8: VERIFICAR QUE SE GUARDEN LOS ROSTROS

### 8.1 Verificar FaceDetection en BD:

```sql
-- Ver cuántos rostros se detectaron
SELECT COUNT(*) as total_rostros 
FROM "FaceDetection";

-- Ver rostros por foto
SELECT 
  p.id as photo_id,
  COUNT(fd.id) as rostros_detectados
FROM "Photo" p
LEFT JOIN "FaceDetection" fd ON fd."photoId" = p.id
WHERE p."isRemoved" = false
GROUP BY p.id
ORDER BY rostros_detectados DESC
LIMIT 10;
```

**✅ Si hay rostros detectados:** Continúa al Paso 9  
**❌ Si no hay rostros:**
- Las fotos pueden no tener rostros visibles
- El análisis puede no haberse ejecutado
- Puede haber un error en Rekognition

### 8.2 Verificar que las fotos estén en estado DONE:

```sql
SELECT COUNT(*) 
FROM "Photo" 
WHERE "analysisStatus" = 'DONE' 
AND "isRemoved" = false;
```

**✅ Si hay fotos en estado DONE:** Continúa al Paso 9  
**❌ Si no hay fotos DONE:** Ejecuta el análisis manualmente (Paso 7)

---

## 📝 PASO 9: PROBAR BÚSQUEDA POR ROSTRO

### 9.1 Probar endpoint de búsqueda:

```bash
# Sube una imagen de prueba (selfie)
curl -X POST \
  -F "file=@/ruta/a/tu/selfie.jpg" \
  "http://localhost:3000/api/albums/1/search/face"
```

**Respuesta esperada:**
```json
{
  "items": [
    {
      "id": 123,
      "previewUrl": "https://...",
      "similarity": 95.5
    }
  ]
}
```

**✅ Si encuentra fotos similares:** ¡El sistema funciona!  
**❌ Si devuelve array vacío:**
- No hay rostros similares en el álbum
- El álbum no tiene fotos analizadas
- El threshold de similitud (70%) es muy alto

---

## 🔧 CHECKLIST RÁPIDO

Marca cada paso cuando lo completes:

- [ ] **Paso 1:** Variables de entorno configuradas (CRON_SECRET, AWS_*, GOOGLE_*, R2_*)
- [ ] **Paso 2:** Tablas de BD existen (Photo, PhotoAnalysisJob, FaceDetection, OcrToken)
- [ ] **Paso 3:** Script de diagnóstico pasa sin errores
- [ ] **Paso 4:** AWS Rekognition conecta correctamente
- [ ] **Paso 5:** Google Vision JSON válido y API habilitada
- [ ] **Paso 6:** Fotos tienen `originalKey` en R2
- [ ] **Paso 7:** Análisis manual procesa fotos sin errores
- [ ] **Paso 8:** Hay rostros detectados en FaceDetection
- [ ] **Paso 9:** Búsqueda por rostro encuentra fotos similares

---

## 🚨 PROBLEMAS COMUNES Y SOLUCIONES

### Problema: "No se procesan las fotos"
**Solución:**
```bash
# Ejecutar análisis manualmente
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/internal/analysis/run
```

### Problema: "Error: AWS_REGION no está configurado"
**Solución:**
```env
AWS_REGION=us-east-1
```

### Problema: "Error: InvalidSignatureException"
**Solución:**
- Verifica que `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` sean correctos
- Verifica que el usuario de AWS tenga permisos para Rekognition

### Problema: "Foto sin originalKey"
**Solución:**
- Verifica que las fotos se suban correctamente a R2
- Revisa el proceso de subida de fotos

### Problema: "No se detectan rostros"
**Posibles causas:**
1. Las fotos no tienen rostros visibles
2. La calidad de la imagen es muy baja
3. Rekognition no puede procesar la imagen

**Solución:**
- Prueba con una foto que claramente tenga un rostro
- Verifica que la imagen se descargue correctamente desde R2

---

## 📞 PRÓXIMOS PASOS

Si después de seguir todos estos pasos el sistema aún no funciona:

1. **Recopila información:**
   - Logs completos del servidor
   - Respuesta del endpoint `/api/internal/analysis/status`
   - Respuesta del endpoint `/api/internal/analysis/run?debug=1`
   - Estado de las tablas en la BD

2. **Verifica cada componente individualmente:**
   - AWS Rekognition (con script de prueba)
   - Google Vision (con script de prueba)
   - R2 Storage (descargar una imagen manualmente)

3. **Revisa la documentación completa:**
   - `DIAGNOSTICO_RECONOCIMIENTO_FACIAL.md` (guía detallada)
   - `docs/ANALYSIS.md` (documentación técnica)

---

**Última actualización:** Enero 2026
