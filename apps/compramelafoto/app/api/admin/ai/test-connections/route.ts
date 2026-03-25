import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { RekognitionClient, DetectFacesCommand } from "@aws-sdk/client-rekognition";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ai/test-connections
 * 
 * Prueba las conexiones reales con Google Vision API y AWS Rekognition
 * Solo accesible por ADMIN
 */
export async function GET(req: Request) {
  try {
    // Verificar autenticación y rol ADMIN
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
    }

    const results: {
      googleVision: { configured: boolean; working: boolean; error?: string; details?: any };
      awsRekognition: { configured: boolean; working: boolean; error?: string; details?: any };
    } = {
      googleVision: { configured: false, working: false },
      awsRekognition: { configured: false, working: false },
    };

    // Probar Google Vision API
    const hasGoogleVision = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    results.googleVision.configured = hasGoogleVision;

    if (hasGoogleVision) {
      try {
        // Intentar parsear el JSON
        const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
        let credentials;
        try {
          credentials = JSON.parse(credentialsJson!);
          credentials.private_key = credentials.private_key?.replace(/\\n/g, "\n");
        } catch (parseErr: any) {
          results.googleVision.error = `JSON inválido: ${parseErr?.message}`;
          results.googleVision.details = { parseError: parseErr?.message };
        }

        if (credentials) {
          // Crear cliente y hacer una llamada de prueba con una imagen pequeña
          const client = new ImageAnnotatorClient({ credentials });
          
          // Crear una imagen JPEG válida de prueba usando Sharp
          // Una imagen 100x50 píxeles con fondo blanco
          const testImageBuffer = await sharp({
            create: {
              width: 100,
              height: 50,
              channels: 3,
              background: { r: 255, g: 255, b: 255 },
            },
          })
            .jpeg({ 
              quality: 90,
              mozjpeg: false, // JPEG estándar
              progressive: false,
            })
            .withMetadata({}) // Sin metadatos
            .toBuffer();

          // Validar que el buffer es un JPEG válido
          const jpegStart = testImageBuffer.slice(0, 2);
          if (jpegStart[0] !== 0xFF || jpegStart[1] !== 0xD8) {
            throw new Error(`Imagen de prueba no es un JPEG válido (inicio: ${jpegStart.toString('hex')})`);
          }

          // Verificar que Sharp puede leer la imagen generada
          const validationSharp = sharp(testImageBuffer);
          const validationMeta = await validationSharp.metadata();
          if (!validationMeta.width || !validationMeta.height) {
            throw new Error(`Imagen de prueba no tiene dimensiones válidas`);
          }

          // Intentar hacer una llamada de prueba
          // Google Vision API puede tener problemas con Buffers directos en entornos serverless
          // Convertir a base64 para máxima compatibilidad
          const base64Image = testImageBuffer.toString('base64');
          
          // Log detallado para diagnóstico
          console.log("Google Vision API test:", {
            bufferSize: testImageBuffer.length,
            base64Length: base64Image.length,
            bufferStart: testImageBuffer.slice(0, 8).toString('hex'),
            bufferEnd: testImageBuffer.slice(-8).toString('hex'),
            hasCredentials: !!credentials,
            credentialsType: credentials?.type,
            credentialsProjectId: credentials?.project_id,
          });
          
          const [result] = await client.textDetection({
            image: { 
              content: base64Image, // Usar base64 en lugar de Buffer directo
            },
          });

          results.googleVision.working = true;
          results.googleVision.details = {
            hasResult: !!result,
            textAnnotations: result?.textAnnotations?.length || 0,
          };
        }
      } catch (err: any) {
        const errorMsg = String(err?.message ?? err);
        const errorCode = err?.code || err?.statusCode || err?.status || "UNKNOWN";
        
        results.googleVision.error = errorMsg;
        results.googleVision.details = {
          errorCode,
          errorName: err?.name,
          isAuthError: errorMsg.toLowerCase().includes('unauthorized') || 
                      errorMsg.toLowerCase().includes('permission') ||
                      errorCode === 401 ||
                      errorCode === 403,
        };
      }
    } else {
      results.googleVision.error = "GOOGLE_APPLICATION_CREDENTIALS_JSON no está configurado";
    }

    // Probar AWS Rekognition
    const hasAwsRekognition = !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION &&
      process.env.REKOGNITION_COLLECTION_ID
    );
    results.awsRekognition.configured = hasAwsRekognition;

    if (hasAwsRekognition) {
      try {
        const client = new RekognitionClient({
          region: process.env.AWS_REGION,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });

        // Crear una imagen JPEG válida de prueba usando Sharp
        // Una imagen 100x50 píxeles con fondo blanco
        const testImageBuffer = await sharp({
          create: {
            width: 100,
            height: 50,
            channels: 3,
            background: { r: 255, g: 255, b: 255 },
          },
        })
          .jpeg({ 
            quality: 90,
            mozjpeg: false, // JPEG estándar
            progressive: false,
          })
          .toBuffer();

        // Intentar hacer una llamada de prueba
        const command = new DetectFacesCommand({
          Image: { Bytes: testImageBuffer },
        });

        const result = await client.send(command);

        results.awsRekognition.working = true;
        results.awsRekognition.details = {
          hasResult: !!result,
          faceCount: result?.FaceDetails?.length || 0,
        };
      } catch (err: any) {
        const errorMsg = String(err?.message ?? err);
        const errorCode = err?.code || err?.statusCode || err?.status || err?.$metadata?.httpStatusCode || "UNKNOWN";
        const errorName = err?.name || err?.$metadata?.requestId || "UnknownError";
        
        results.awsRekognition.error = errorMsg;
        results.awsRekognition.details = {
          errorCode,
          errorName,
          isAuthError: errorMsg.toLowerCase().includes('unauthorized') ||
                      errorMsg.toLowerCase().includes('accessdenied') ||
                      errorMsg.toLowerCase().includes('invalidkey') ||
                      errorCode === 401 ||
                      errorCode === 403,
        };
      }
    } else {
      const missing = [];
      if (!process.env.AWS_ACCESS_KEY_ID) missing.push("AWS_ACCESS_KEY_ID");
      if (!process.env.AWS_SECRET_ACCESS_KEY) missing.push("AWS_SECRET_ACCESS_KEY");
      if (!process.env.AWS_REGION) missing.push("AWS_REGION");
      if (!process.env.REKOGNITION_COLLECTION_ID) missing.push("REKOGNITION_COLLECTION_ID");
      
      results.awsRekognition.error = `Variables faltantes: ${missing.join(", ")}`;
    }

    return NextResponse.json({
      ok: true,
      results,
      summary: {
        googleVision: results.googleVision.configured && results.googleVision.working,
        awsRekognition: results.awsRekognition.configured && results.awsRekognition.working,
        bothWorking: results.googleVision.configured && results.googleVision.working && 
                     results.awsRekognition.configured && results.awsRekognition.working,
      },
    });
  } catch (error: any) {
    console.error("Error probando conexiones:", error);
    return NextResponse.json(
      { error: "Error al probar conexiones", detail: error?.message },
      { status: 500 }
    );
  }
}
