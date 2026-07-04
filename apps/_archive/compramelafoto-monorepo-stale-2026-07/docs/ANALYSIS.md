# Análisis de fotos (OCR + Rostros)

Este módulo analiza fotos de álbumes para permitir búsquedas por texto y rostro.

## Variables de entorno

- `CRON_SECRET`: token para ejecutar el cron interno.
- `AWS_ACCESS_KEY_ID`: credencial AWS.
- `AWS_SECRET_ACCESS_KEY`: credencial AWS.
- `AWS_REGION`: región de Rekognition.
- `REKOGNITION_COLLECTION_ID`: colección de Rekognition.
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`: JSON completo como string.
- `R2_PUBLIC_BASE_URL` o URL pública/signed para R2.

## Cómo funciona

1) Al subir fotos a un álbum, se crea un `PhotoAnalysisJob` en estado `PENDING`.
2) El cron `/api/internal/analysis/run` procesa jobs en lotes de 10:
   - Descarga la imagen desde R2.
   - OCR (Google Vision) → guarda tokens normalizados.
   - Rostros (Rekognition) → guarda `FaceId` y bounding box.
   - Actualiza `Photo.analysisStatus` a `DONE`.
3) Si falla, reintenta hasta 3 veces. Luego marca `ERROR`.

## Ejecutar localmente

```
curl -X POST \
  -H "Authorization: Bearer <CRON_SECRET>" \
  http://localhost:3000/api/internal/analysis/run
```

## Rekognition

- Crear colección en AWS: podés usar la consola o dejar que la app la cree automáticamente.
- `REKOGNITION_COLLECTION_ID` debe existir o será creada en el primer run.

## Google Vision

- Crear una cuenta de servicio en Google Cloud.
- Copiar el JSON completo y setearlo en `GOOGLE_APPLICATION_CREDENTIALS_JSON`.

## Endpoints de búsqueda

- `GET /api/albums/[albumId]/search/text?q=...`
- `POST /api/albums/[albumId]/search/face` (multipart `file` o `{ imageUrl }`)

Ambos endpoints tienen rate limit básico por IP.
